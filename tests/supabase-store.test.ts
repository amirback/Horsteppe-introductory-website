/**
 * Хранилище Supabase на подменённом fetch: сеть не используется, проверяется
 * форма запросов к PostgREST и разбор ответов. Живую базу этот тест не
 * заменяет — он ловит ошибки в запросах до того, как их увидит прод.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MissingTableError } from "../lib/leads/errors.ts";
import { SupabaseLeadStore } from "../lib/leads/supabase-store.ts";
import type { NewLead } from "../lib/leads/schema.ts";

type Seen = { method: string; url: URL; headers: Headers; body: unknown };

function fakeFetch(reply: (seen: Seen) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const seen: Seen[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const text = init?.body ? String(init.body) : await request.text();
    const entry = {
      method: (init?.method || request.method).toUpperCase(),
      url: new URL(request.url),
      headers: new Headers(init?.headers ?? request.headers),
      body: text ? JSON.parse(text) : undefined,
    };
    seen.push(entry);
    const r = reply(entry);
    // Как PostgREST: на просьбу об одном объекте (.single()) отдаётся объект, а не массив.
    const wantsObject = (entry.headers.get("accept") ?? "").includes("vnd.pgrst.object");
    if (wantsObject && Array.isArray(r.body) && (r.status ?? 200) < 300) r.body = r.body[0];
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  }) as typeof fetch;
  return { impl, seen };
}

const input: NewLead = {
  name: "Ali", email: "ali@example.kz", contact: null, company: "Steppe", use_case: "social", volume: null,
  message: null, lang: "ru", utm_source: null, utm_medium: null, utm_campaign: null, referrer: null, landing_path: "/ru",
};
const row = { id: "5f9c1a62-6d1b-4a8e-9f5e-0c1d2e3f4a5b", ...input, status: "new", submit_count: 1 };
const URL_BASE = "https://abcdefghijklmnopqrst.supabase.co";

test("новая заявка: поиск по почте, затем вставка с возвратом строки", async () => {
  const { impl, seen } = fakeFetch((s) => (s.method === "GET" ? { body: [] } : { status: 201, body: [row] }));
  const store = new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl);
  const result = await store.saveLead(input, { country: "KZ", city: null }, new Date("2026-11-03T10:00:00Z"));

  assert.equal(result.created, true);
  assert.equal(result.lead.email, "ali@example.kz");
  const [lookup, insert] = seen;
  assert.equal(lookup.url.pathname, "/rest/v1/intro_leads");
  assert.equal(lookup.url.searchParams.get("email"), "eq.ali@example.kz");
  assert.equal(insert.method, "POST");
  assert.equal((insert.body as Record<string, unknown>).country, "KZ");
  assert.equal((insert.body as Record<string, unknown>).last_submitted_at, "2026-11-03T10:00:00.000Z");
  assert.ok(insert.url.searchParams.get("select")?.includes("admin_note"), "возвращается вся строка");
});

test("новый секретный ключ уходит так же, как у официального клиента в продукте", async () => {
  // supabase-js 2.116 для запросов к таблицам шлёт ключ и в apikey, и как
  // Bearer; без Bearer — только вызовы Edge Functions. Тест фиксирует это,
  // чтобы обновление библиотеки не поменяло поведение молча.
  const { impl, seen } = fakeFetch(() => ({ body: [] }));
  await new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl).listLeads();
  assert.equal(seen[0].headers.get("apikey"), "sb_secret_test_key");
  assert.equal(seen[0].headers.get("authorization"), "Bearer sb_secret_test_key");
});

test("старый JWT-ключ — и в apikey, и в Authorization", async () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl";
  const { impl, seen } = fakeFetch(() => ({ body: [] }));
  await new SupabaseLeadStore(URL_BASE, jwt, impl).listLeads();
  assert.equal(seen[0].headers.get("apikey"), jwt);
  assert.equal(seen[0].headers.get("authorization"), `Bearer ${jwt}`);
});

test("повтор: обновляются только присланные поля, счётчик растёт", async () => {
  const { impl, seen } = fakeFetch((s) =>
    s.method === "GET" ? { body: [{ id: row.id, submit_count: 2 }] } : { body: [{ ...row, submit_count: 3 }] },
  );
  const result = await new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl).saveLead(input, { country: null, city: null });
  assert.equal(result.created, false);
  const update = seen[1];
  assert.equal(update.method, "PATCH");
  assert.equal(update.url.searchParams.get("id"), `eq.${row.id}`);
  const body = update.body as Record<string, unknown>;
  assert.equal(body.submit_count, 3);
  assert.equal("contact" in body, false, "пустое поле не затирает прежнее значение");
  assert.equal("country" in body, false);
});

test("гонка одинаковых заявок: вторая становится повтором", async () => {
  let lookups = 0;
  const { impl } = fakeFetch((s) => {
    if (s.method === "GET") return lookups++ === 0 ? { body: [] } : { body: [{ id: row.id, submit_count: 1 }] };
    if (s.method === "POST") return { status: 409, body: { code: "23505", message: "duplicate key value" } };
    return { body: [{ ...row, submit_count: 2 }] };
  });
  const result = await new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl).saveLead(input, { country: null, city: null });
  assert.equal(result.created, false);
  assert.equal(result.lead.submit_count, 2);
});

test("ошибка базы не превращается в тихий успех", async () => {
  const { impl } = fakeFetch(() => ({ status: 500, body: { code: "XX000", message: "boom" } }));
  await assert.rejects(
    new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl).saveLead(input, { country: null, city: null }),
    /lookup/,
  );
});

test("счётчик лимита — запрос HEAD с точным подсчётом", async () => {
  const { impl, seen } = fakeFetch(() => ({ body: [], headers: { "content-range": "*/4" } }));
  const n = await new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl).countEvents("lead", "abc", new Date("2026-11-03T09:00:00Z"));
  assert.equal(n, 4);
  assert.equal(seen[0].method, "HEAD");
  assert.equal(seen[0].url.pathname, "/rest/v1/intro_rate_events");
  assert.equal(seen[0].url.searchParams.get("kind"), "eq.lead");
  assert.equal(seen[0].url.searchParams.get("created_at"), "gte.2026-11-03T09:00:00.000Z");
  assert.match(seen[0].headers.get("prefer") ?? "", /count=exact/);
});

test("чаты бота: подключение — upsert по chat_id, нет таблицы — понятная ошибка", async () => {
  const { impl, seen } = fakeFetch(() => ({ status: 201, body: [] }));
  await new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl).addChat({ chat_id: 777, title: "Амирхан" });
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].url.pathname, "/rest/v1/intro_telegram_chats");
  assert.equal(seen[0].url.searchParams.get("on_conflict"), "chat_id");
  assert.match(seen[0].headers.get("prefer") ?? "", /resolution=merge-duplicates/, "повторное подключение не падает на дубле");
  assert.deepEqual(seen[0].body, { chat_id: 777, title: "Амирхан" });

  const missing = fakeFetch(() => ({
    status: 404,
    body: { code: "PGRST205", message: "Could not find the table 'public.intro_telegram_chats' in the schema cache" },
  }));
  await assert.rejects(new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", missing.impl).listChats(), MissingTableError);
  const other = fakeFetch(() => ({ status: 500, body: { code: "XX000", message: "boom" } }));
  await assert.rejects(new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", other.impl).listChats(), (e) => !(e instanceof MissingTableError));
});

test("одна заявка по id — запрос с фильтром и ответ-объект", async () => {
  const { impl, seen } = fakeFetch(() => ({ body: [row] }));
  const lead = await new SupabaseLeadStore(URL_BASE, "sb_secret_test_key", impl).getLead(row.id);
  assert.equal(lead?.email, "ali@example.kz");
  assert.equal(seen[0].url.searchParams.get("id"), `eq.${row.id}`);
});
