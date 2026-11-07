import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { FileLeadStore } from "../lib/leads/file-store.ts";
import type { Lead } from "../lib/leads/schema.ts";
import { notifyTelegram, notifyTargets } from "../lib/notify.ts";
import { leadCard } from "../lib/telegram/format.ts";

const TOKEN = "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
const lead: Lead = {
  id: "5f9c1a62-6d1b-4a8e-9f5e-0c1d2e3f4a5b", created_at: "2026-11-06T09:30:00Z", updated_at: "", last_submitted_at: "", submit_count: 1,
  name: "<b>Ali</b>", email: "ali@example.kz", contact: "@ali_kz", company: "A & B", use_case: "product_ads",
  volume: "6-20", message: "<script>x</script>", lang: "ru", country: "KZ", city: "Almaty", utm_source: "ig",
  utm_medium: null, utm_campaign: null, referrer: null, landing_path: null, status: "new", admin_note: null,
};

const dirs: string[] = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
function freshStore(): FileLeadStore {
  const dir = mkdtempSync(path.join(tmpdir(), "hs-notify-"));
  dirs.push(dir);
  return new FileLeadStore(dir);
}

function recorder() {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: calls.length } }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

test("карточка: разметка из заявки экранирована, всё нужное на месте", () => {
  const { text, reply_markup } = leadCard(lead, "new", "https://site.example");
  assert.ok(text.startsWith("🆕 <b>Новая заявка на ранний доступ</b>"));
  assert.ok(text.includes("&lt;b&gt;Ali&lt;/b&gt;"));
  assert.ok(text.includes("A &amp; B"));
  assert.ok(text.includes("&lt;script&gt;"));
  assert.ok(text.includes("Реклама товара · 6–20 в месяц"));
  assert.ok(text.includes("RU · KZ · Almaty · откуда: ig"));
  assert.ok(text.includes("6 нояб., 14:30"), "время по Алматы (UTC+5)");
  const buttons = reply_markup!.inline_keyboard.flat();
  assert.deepEqual(buttons[0], { text: "Telegram", url: "https://t.me/ali_kz" });
  assert.ok(buttons.some((b) => b.text === "✓ Новая" && b.callback_data === `s:n:${lead.id}`), "текущий статус отмечен");
  assert.ok(buttons.some((b) => b.text === "Клиент" && b.callback_data === `s:a:${lead.id}`));
  assert.ok(buttons.some((b) => b.url === "https://site.example/admin"));
  for (const b of buttons) if (b.callback_data) assert.ok(Buffer.byteLength(b.callback_data) <= 64, "данные кнопки ≤ 64 байт");
});

test("в кнопках только https: звонок и админка без https не попадают", () => {
  const { reply_markup } = leadCard({ ...lead, contact: "+7 701 123 45 67" }, "view", "http://localhost:3000");
  const urls = reply_markup!.inline_keyboard.flat().map((b) => b.url).filter(Boolean);
  assert.deepEqual(urls, ["https://wa.me/77011234567"]);
});

test("без токена уведомление выключено и сеть не трогается", async () => {
  const { calls, impl } = recorder();
  assert.equal(await notifyTelegram(lead, true, { env: { TELEGRAM_CHAT_ID: "-100500" }, fetchImpl: impl }), false);
  assert.equal(await notifyTelegram(lead, true, { env: { TELEGRAM_BOT_TOKEN: "не токен", TELEGRAM_CHAT_ID: "1" }, fetchImpl: impl }), false);
  assert.equal(calls.length, 0);
});

test("заявка уходит во все подключённые чаты и в чат из настроек — без повторов", async () => {
  const store = freshStore();
  await store.addChat({ chat_id: 111, title: "Амирхан" });
  await store.addChat({ chat_id: -100500, title: "группа «Команда»" });
  assert.deepEqual((await notifyTargets({ TELEGRAM_CHAT_ID: "-100500" }, store)).sort(), ["-100500", "111"]);

  const { calls, impl } = recorder();
  const sent = await notifyTelegram(lead, false, { env: { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "-100500" }, store, fetchImpl: impl });
  assert.equal(sent, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
  assert.deepEqual(calls.map((c) => String(c.body.chat_id)).sort(), ["-100500", "111"]);
  assert.equal(calls[0].body.parse_mode, "HTML");
  assert.ok(String(calls[0].body.text).startsWith("🔁 <b>Повторная заявка</b>"));
  assert.ok((calls[0].body.reply_markup as { inline_keyboard: unknown[] }).inline_keyboard.length >= 3, "кнопки статуса приложены");
});

test("адрес Bot API подменяется только вне Vercel", async () => {
  const { calls, impl } = recorder();
  const env = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "1", TELEGRAM_API_BASE: "http://127.0.0.1:9" };
  await notifyTelegram(lead, true, { env, fetchImpl: impl });
  await notifyTelegram(lead, true, { env: { ...env, VERCEL: "1" }, fetchImpl: impl });
  assert.equal(calls[0].url, `http://127.0.0.1:9/bot${TOKEN}/sendMessage`);
  assert.equal(calls[1].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`, "на Vercel токен уходит только в Telegram");
});

test("зависший Telegram не держит ответ дольше срока", async () => {
  const started = Date.now();
  const sent = await notifyTelegram(lead, true, {
    env: { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "c" },
    timeoutMs: 50,
    fetchImpl: ((_u: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch,
  });
  assert.equal(sent, false);
  assert.ok(Date.now() - started < 1000);
});
