import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MIN_FILL_MS, STATUSES, USE_CASES, VOLUMES, parseLead, parseLeadPatch } from "../lib/leads/schema.ts";

const NOW = 1_800_000_000_000;
const good = {
  name: "  Айгерим   Нурланова ",
  email: "Aigerim@Example.KZ ",
  contact: "@aigerim",
  company: "Steppe Coffee",
  use_case: "product_ads",
  volume: "6-20",
  message: "Реклама кофе\r\nдля Reels",
  lang: "kk",
  consent: true,
  started_at: NOW - 30_000,
  website: "",
  utm_source: "instagram",
};

test("нормальная заявка принимается и чистится", () => {
  const r = parseLead(good, NOW);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.lead.name, "Айгерим Нурланова");
  assert.equal(r.lead.email, "aigerim@example.kz", "почта — в нижнем регистре, по ней склеиваются повторы");
  assert.equal(r.lead.message, "Реклама кофе\nдля Reels");
  assert.equal(r.lead.lang, "kk");
  assert.equal(r.lead.utm_source, "instagram");
});

test("обязательны имя, почта и согласие", () => {
  for (const [patch, field] of [
    [{ name: "   " }, "name"],
    [{ email: "not-an-email" }, "email"],
    [{ email: "a@b.c" }, "email"],
    [{ consent: false }, "consent"],
    [{ consent: "true" }, "consent"],
  ] as const) {
    const r = parseLead({ ...good, ...patch }, NOW);
    assert.deepEqual(r, { ok: false, bot: false, field }, JSON.stringify(patch));
  }
});

test("значения из списков — только из списков", () => {
  assert.deepEqual(parseLead({ ...good, use_case: "hack" }, NOW), { ok: false, bot: false, field: "use_case" });
  assert.deepEqual(parseLead({ ...good, volume: "1000" }, NOW), { ok: false, bot: false, field: "volume" });
  const r = parseLead({ ...good, use_case: "", volume: null }, NOW);
  assert.ok(r.ok && r.lead.use_case === null && r.lead.volume === null, "пустой выбор — не ошибка");
});

test("слишком длинные поля отклоняются, а метки источника просто отбрасываются", () => {
  assert.deepEqual(parseLead({ ...good, message: "a".repeat(1501) }, NOW), { ok: false, bot: false, field: "message" });
  assert.deepEqual(parseLead({ ...good, name: "a".repeat(101) }, NOW), { ok: false, bot: false, field: "name" });
  const r = parseLead({ ...good, utm_campaign: "x".repeat(500) }, NOW);
  assert.ok(r.ok && r.lead.utm_campaign === null, "человеку не отказываем из-за метки рекламы");
});

test("бот узнаётся по ловушке и по скорости", () => {
  assert.deepEqual(parseLead({ ...good, website: "http://spam" }, NOW), { ok: false, bot: true });
  assert.deepEqual(parseLead({ ...good, started_at: NOW - (MIN_FILL_MS - 100) }, NOW), { ok: false, bot: true });
  assert.equal(parseLead({ ...good, started_at: undefined }, NOW).ok, true, "без отметки времени не подозреваем");
});

test("управляющие символы вырезаются, неизвестный язык — английский", () => {
  const r = parseLead({ ...good, name: "Ali\u0000ce\u0007", lang: "de" }, NOW);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.lead.name, "Alice");
  assert.equal(r.lead.lang, "en");
});

test("мусор вместо формы", () => {
  for (const raw of [null, "x", 1, [], undefined]) {
    assert.deepEqual(parseLead(raw, NOW), { ok: false, bot: false, field: "form" });
  }
});

test("правка из админки — только статус и заметка", () => {
  assert.deepEqual(parseLeadPatch({ status: "invited" }), { status: "invited" });
  assert.deepEqual(parseLeadPatch({ admin_note: "  звонили  " }), { admin_note: "звонили" });
  assert.deepEqual(parseLeadPatch({ admin_note: "" }), { admin_note: null });
  assert.equal(parseLeadPatch({ status: "vip" }), null);
  assert.equal(parseLeadPatch({ email: "x@y.zz" }), null, "почту из админки не меняем");
  assert.equal(parseLeadPatch(null), null);
});

test("списки совпадают с проверками таблицы в SQL", () => {
  const sql = readFileSync(new URL("../supabase/intro_leads.sql", import.meta.url), "utf8");
  const listed = (column: string) => {
    const m = sql.match(new RegExp(`${column}\\s+text[^\\n]*?in\\s*\\(([^)]*)\\)`, "s"));
    assert.ok(m, `в SQL нет проверки ${column}`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  assert.deepEqual(listed("use_case"), [...USE_CASES]);
  assert.deepEqual(listed("volume"), [...VOLUMES]);
  assert.deepEqual(listed("status"), [...STATUSES]);
  assert.deepEqual(listed("lang"), ["en", "ru", "kk"]);
});
