import assert from "node:assert/strict";
import { test } from "node:test";
import type { Lead } from "../lib/leads/schema.ts";
import { leadMessage, notifyTelegram } from "../lib/notify.ts";

const lead: Lead = {
  id: "5f9c1a62-6d1b-4a8e-9f5e-0c1d2e3f4a5b", created_at: "", updated_at: "", last_submitted_at: "", submit_count: 1,
  name: "<b>Ali</b>", email: "ali@example.kz", contact: "@ali", company: "A & B", use_case: "product_ads",
  volume: "6-20", message: "<script>x</script>", lang: "ru", country: "KZ", city: "Almaty", utm_source: "ig",
  utm_medium: null, utm_campaign: null, referrer: null, landing_path: null, status: "new", admin_note: null,
};

test("сообщение экранирует разметку из заявки", () => {
  const text = leadMessage(lead, true, "https://site/admin");
  assert.ok(text.startsWith("<b>Новая заявка — Horsteppe</b>"));
  assert.ok(text.includes("&lt;b&gt;Ali&lt;/b&gt;"));
  assert.ok(text.includes("A &amp; B"));
  assert.ok(text.includes("&lt;script&gt;"));
  assert.ok(text.includes("Реклама товара"));
  assert.ok(text.includes("RU · KZ · Almaty · utm: ig"));
  assert.ok(text.endsWith("https://site/admin"));
});

test("без бота уведомление выключено и сеть не трогается", async () => {
  let called = false;
  const sent = await notifyTelegram(lead, true, { env: {}, fetchImpl: (async () => { called = true; return new Response(); }) as typeof fetch });
  assert.equal(sent, false);
  assert.equal(called, false);
});

test("с ботом — один запрос sendMessage в HTML", async () => {
  let url = "";
  let body: Record<string, unknown> = {};
  const sent = await notifyTelegram(lead, false, {
    env: { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "-100500" },
    fetchImpl: (async (u: string, init: RequestInit) => {
      url = u;
      body = JSON.parse(String(init.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(sent, true);
  assert.equal(url, "https://api.telegram.org/bot123:abc/sendMessage");
  assert.equal(body.chat_id, "-100500");
  assert.equal(body.parse_mode, "HTML");
  assert.ok(String(body.text).startsWith("<b>Повторная заявка"));
});

test("зависший Telegram не держит ответ дольше срока", async () => {
  const started = Date.now();
  const sent = await notifyTelegram(lead, true, {
    env: { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" },
    timeoutMs: 50,
    fetchImpl: ((_u: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch,
  });
  assert.equal(sent, false);
  assert.ok(Date.now() - started < 1000);
});
