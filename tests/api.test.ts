/**
 * Обработчики API на настоящем файловом хранилище во временной папке.
 * Запрос и ответ — стандартные Request/Response, без Next.js.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import {
  LIMITS, handleDelete, handleExport, handleList, handleLead, handleLogin, handleLogout, handleUpdate,
} from "../lib/api.ts";
import { FileLeadStore } from "../lib/leads/file-store.ts";
import { getStore } from "../lib/leads/store.ts";

const dirs: string[] = [];
let store: FileLeadStore;
beforeEach(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "hs-leads-"));
  dirs.push(dir);
  store = new FileLeadStore(dir);
});
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const ENV = { ADMIN_PASSWORD: "correct horse battery" };
const BASE = "http://site.test";
const form = (extra: Record<string, unknown> = {}) => ({
  name: "Ali", email: "ali@example.kz", consent: true, lang: "ru", started_at: Date.now() - 10_000, ...extra,
});

function post(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${BASE}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, host: "site.test", "x-forwarded-for": "10.0.0.1", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function login(): Promise<string> {
  const res = await handleLogin(post("/api/admin/login", { password: ENV.ADMIN_PASSWORD }), { store, env: ENV });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  return cookie.split(";")[0];
}

// --- заявка --------------------------------------------------------------------------

test("заявка записывается, страна и город — из заголовков Vercel", async () => {
  const res = await handleLead(post("/api/lead", form(), { "x-vercel-ip-country": "kz", "x-vercel-ip-city": "Almaty" }), { store, env: ENV });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const [lead] = await store.listLeads();
  assert.equal(lead.email, "ali@example.kz");
  assert.equal(lead.country, "KZ");
  assert.equal(lead.city, "Almaty");
  assert.equal(lead.status, "new");
});

test("повторная заявка склеивается и не затирает прежние ответы", async () => {
  await handleLead(post("/api/lead", form({ company: "Steppe Coffee" })), { store, env: ENV });
  await handleLead(post("/api/lead", form({ email: "ALI@example.kz", message: "Ещё вопрос" })), { store, env: ENV });
  const leads = await store.listLeads();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].company, "Steppe Coffee");
  assert.equal(leads[0].message, "Ещё вопрос");
  assert.equal(leads[0].submit_count, 2);
});

test("без хранилища — честный отказ, а не притворный успех", async () => {
  const res = await handleLead(post("/api/lead", form()), { store: null, env: ENV });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "unavailable" });
});

test("боту отвечают как человеку, но ничего не хранят", async () => {
  const res = await handleLead(post("/api/lead", form({ website: "http://spam.example" })), { store, env: ENV });
  assert.equal(res.status, 200);
  assert.deepEqual(await store.listLeads(), []);
});

test("ошибки формы называют поле", async () => {
  const res = await handleLead(post("/api/lead", form({ email: "nope" })), { store, env: ENV });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "invalid", field: "email" });
  const garbage = await handleLead(post("/api/lead", "{not json"), { store, env: ENV });
  assert.equal(garbage.status, 400);
  const huge = await handleLead(post("/api/lead", JSON.stringify({ name: "x".repeat(20_000) })), { store, env: ENV });
  assert.equal(huge.status, 400, "огромное тело не разбираем");
});

test("лимит частоты на адрес", async () => {
  for (let i = 0; i < LIMITS.leadPerIp.count; i++) {
    const r = await handleLead(post("/api/lead", form({ email: `u${i}@example.kz` })), { store, env: ENV });
    assert.equal(r.status, 200);
  }
  const blocked = await handleLead(post("/api/lead", form({ email: "late@example.kz" })), { store, env: ENV });
  assert.equal(blocked.status, 429);
  const other = await handleLead(
    post("/api/lead", form({ email: "other@example.kz" }), { "x-forwarded-for": "10.0.0.2" }),
    { store, env: ENV },
  );
  assert.equal(other.status, 200, "чужой адрес не страдает");
});

test("уведомление уходит после ответа и не роняет заявку", async () => {
  const deferred: Array<() => Promise<unknown>> = [];
  const seen: string[] = [];
  const res = await handleLead(post("/api/lead", form()), {
    store, env: ENV,
    defer: (task) => deferred.push(task),
    notify: async (lead, created) => {
      seen.push(`${lead.email}:${created}`);
      throw new Error("telegram is down");
    },
  });
  assert.equal(res.status, 200);
  assert.equal(seen.length, 0, "до ответа уведомление не отправлялось");
  await deferred[0]();
  assert.deepEqual(seen, ["ali@example.kz:true"]);
});

// --- админка ----------------------------------------------------------------------------

test("вход: неверный пароль, чужой сайт, лимит попыток", async () => {
  const wrong = await handleLogin(post("/api/admin/login", { password: "guess" }), { store, env: ENV });
  assert.equal(wrong.status, 401);
  const foreign = await handleLogin(post("/api/admin/login", { password: ENV.ADMIN_PASSWORD }, { origin: "http://evil.test" }), { store, env: ENV });
  assert.equal(foreign.status, 403);
  for (let i = 1; i < LIMITS.adminFail.count; i++) {
    await handleLogin(post("/api/admin/login", { password: `guess${i}` }), { store, env: ENV });
  }
  const locked = await handleLogin(post("/api/admin/login", { password: ENV.ADMIN_PASSWORD }), { store, env: ENV });
  assert.equal(locked.status, 429, "после серии неудач не пускает даже с верным паролем");
});

test("без пароля в окружении админка выключена", async () => {
  const res = await handleLogin(post("/api/admin/login", { password: "anything" }), { store, env: {} });
  assert.equal(res.status, 503);
});

test("список, правка, удаление, выгрузка — только с сессией", async () => {
  await handleLead(post("/api/lead", form({ company: "=HYPERLINK(1)" })), { store, env: ENV });
  const cookie = await login();
  const anonymous = await handleList(new Request(`${BASE}/api/admin/leads`), { store, env: ENV });
  assert.equal(anonymous.status, 401);

  const list = await handleList(new Request(`${BASE}/api/admin/leads`, { headers: { cookie } }), { store, env: ENV });
  const body = await list.json();
  assert.equal(body.leads.length, 1);
  assert.match(body.sheetsUrl, /^http:\/\/site\.test\/api\/admin\/export\?key=[0-9a-f]{40}$/);
  const id = body.leads[0].id;

  const patchReq = (payload: unknown, headers: Record<string, string> = {}) =>
    new Request(`${BASE}/api/admin/leads/${id}`, {
      method: "PATCH", headers: { cookie, origin: BASE, host: "site.test", ...headers }, body: JSON.stringify(payload),
    });
  assert.equal((await handleUpdate(patchReq({ status: "invited", admin_note: "созвон в пятницу" }), id, { store, env: ENV })).status, 200);
  assert.equal((await handleUpdate(patchReq({ status: "vip" }), id, { store, env: ENV })).status, 400);
  assert.equal((await handleUpdate(patchReq({ status: "new" }, { origin: "http://evil.test" }), id, { store, env: ENV })).status, 403);
  assert.equal((await handleUpdate(patchReq({ status: "new" }), "not-a-uuid", { store, env: ENV })).status, 404);
  const [updated] = await store.listLeads();
  assert.equal(updated.status, "invited");
  assert.equal(updated.admin_note, "созвон в пятницу");

  const download = await handleExport(new Request(`${BASE}/api/admin/export`, { headers: { cookie } }), { store, env: ENV });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition")!, /^attachment/);
  // Метку BOM проверяем по байтам: Response.text() по стандарту её срезает.
  const bytes = new Uint8Array(await download.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "для Excel — с BOM");
  const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  assert.ok(csv.startsWith("﻿Дата заявки"));
  assert.ok(csv.includes("'=HYPERLINK(1)"), "формула обезврежена");

  const sheets = await handleExport(new Request(body.sheetsUrl), { store, env: ENV });
  assert.equal(sheets.status, 200, "Google Таблица забирает по ключу без cookie");
  const sheetBytes = new Uint8Array(await sheets.arrayBuffer());
  assert.notEqual(sheetBytes[0], 0xef, "для таблицы — без BOM");
  assert.ok(new TextDecoder().decode(sheetBytes).startsWith("Дата заявки"));
  const badKey = await handleExport(new Request(`${BASE}/api/admin/export?key=${"0".repeat(40)}`), { store, env: ENV });
  assert.equal(badKey.status, 401);

  const del = new Request(`${BASE}/api/admin/leads/${id}`, { method: "DELETE", headers: { cookie, origin: BASE, host: "site.test" } });
  assert.equal((await handleDelete(del, id, { store, env: ENV })).status, 200);
  assert.deepEqual(await store.listLeads(), []);
});

test("выход стирает cookie", () => {
  const res = handleLogout(new Request(`${BASE}/api/admin/logout`, { method: "POST" }));
  assert.match(res.headers.get("set-cookie")!, /hs_admin=; .*Max-Age=0/);
});

test("на Vercel без базы хранилища нет — даже если просили файловое", () => {
  assert.equal(getStore({ VERCEL: "1", LEADS_FILE_STORE: "1", NODE_ENV: "production" }), null);
  assert.equal(getStore({ NODE_ENV: "production" }), null);
  assert.equal(getStore({ NODE_ENV: "development" })?.kind, "file");
  assert.equal(getStore({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", VERCEL: "1" })?.kind, "supabase");
});
