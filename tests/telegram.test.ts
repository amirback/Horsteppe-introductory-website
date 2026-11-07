/**
 * Бот заявок на настоящем файловом хранилище и поддельном Telegram: сеть не
 * используется. Проверяется то, что увидит человек в чате, и то, чего не
 * должен увидеть чужой.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import { handleLogin } from "../lib/api.ts";
import { MissingTableError } from "../lib/leads/errors.ts";
import { FileLeadStore } from "../lib/leads/file-store.ts";
import type { NewLead } from "../lib/leads/schema.ts";
import type { LeadStore } from "../lib/leads/store.ts";
import type { TelegramApi } from "../lib/telegram/api.ts";
import { handleTelegramAction, handleTelegramStatus } from "../lib/telegram/admin.ts";
import { handleUpdate, handleWebhook, type TgUpdate } from "../lib/telegram/bot.ts";
import { LINK_EXPIRED, MENU, NO_TABLE } from "../lib/telegram/format.ts";
import { publicLang } from "../lib/telegram/public.ts";
import { LINK_TTL_MS, checkLinkCode, makeLinkCode, webhookSecret } from "../lib/telegram/keys.ts";

const TOKEN = "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
const ENV = { ADMIN_PASSWORD: "correct horse battery", TELEGRAM_BOT_TOKEN: TOKEN };
const NOW = new Date("2026-11-06T09:30:00Z");
const SITE = "https://site.example";
type Chat = { id: number; type: string; first_name?: string; title?: string };
const OWNER: Chat = { id: 777, type: "private", first_name: "Амирхан" };

const dirs: string[] = [];
let store: FileLeadStore;
beforeEach(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "hs-tg-"));
  dirs.push(dir);
  store = new FileLeadStore(dir);
});
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

type Call = { method: string; params: Record<string, unknown> };
function fakeApi(webhookUrl = "") {
  const calls: Call[] = [];
  const api: TelegramApi = {
    async call<T>(method: string, params: Record<string, unknown> = {}) {
      calls.push({ method, params });
      if (method === "setWebhook") webhookUrl = String(params.url);
      const result =
        method === "getMe" ? { username: "horsteppe_test_bot", first_name: "Horsteppe Заявки" }
          : method === "getWebhookInfo" ? { url: webhookUrl }
            : method === "sendMessage" ? { message_id: calls.length }
              : true;
      return { ok: true as const, result: result as T };
    },
  };
  const sent = (chat?: number) =>
    calls.filter((c) => c.method === "sendMessage" && (chat === undefined || Number(c.params.chat_id) === chat)).map((c) => String(c.params.text));
  return { api, calls, sent };
}

function newLead(name: string, extra: Partial<NewLead> = {}): NewLead {
  return {
    name, email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.kz`, contact: null, company: null, use_case: "product_ads",
    volume: null, message: null, lang: "ru", utm_source: null, utm_medium: null, utm_campaign: null, referrer: null, landing_path: "/ru",
    ...extra,
  };
}

async function seed(...names: string[]) {
  const ids: string[] = [];
  for (const [i, name] of names.entries()) {
    const { lead } = await store.saveLead(newLead(name, i === 0 ? { company: "Steppe Coffee" } : {}), { country: "KZ", city: null }, new Date(NOW.getTime() - i * 60_000));
    ids.push(lead.id);
  }
  return ids;
}

const say = (text: string, chat: Chat = OWNER, extra: Record<string, unknown> = {}): TgUpdate =>
  ({ message: { message_id: 1, chat, from: { id: chat.id, first_name: "Амирхан" }, text, ...extra } }) as TgUpdate;
const press = (data: string, chat: Chat = OWNER, messageId = 50): TgUpdate =>
  ({ callback_query: { id: "cb1", data, message: { message_id: messageId, chat } } }) as TgUpdate;

async function linkOwner(deps: { api: TelegramApi }) {
  const code = (await makeLinkCode(TOKEN, ENV, NOW.getTime()))!;
  await handleUpdate(say(`/start ${code}`), { store, api: deps.api, token: TOKEN, env: ENV, now: NOW, site: SITE });
}

// --- секреты ---------------------------------------------------------------------------

test("код подключения: подходит Telegram, живёт 30 минут, подделку не принимает", async () => {
  const code = (await makeLinkCode(TOKEN, ENV, NOW.getTime()))!;
  assert.match(code, /^[A-Za-z0-9_-]{1,64}$/, "символы и длина как требует ссылка t.me/…?start=");
  assert.equal(await checkLinkCode(code, TOKEN, ENV, NOW.getTime() + 60_000), true);
  assert.equal(await checkLinkCode(code, TOKEN, ENV, NOW.getTime() + LINK_TTL_MS + 1000), false, "устарел");
  assert.equal(await checkLinkCode(code.slice(0, -1) + (code.endsWith("0") ? "1" : "0"), TOKEN, ENV, NOW.getTime()), false, "подпись подделана");
  assert.equal(await checkLinkCode(code, TOKEN, { ...ENV, ADMIN_PASSWORD: "another long password" }, NOW.getTime()), false, "сменили пароль админки");
  assert.equal(await checkLinkCode(code, "999999:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", ENV, NOW.getTime()), false, "другой бот");
  assert.equal(await makeLinkCode(TOKEN, { TELEGRAM_BOT_TOKEN: TOKEN }, NOW.getTime()), null, "без пароля админки ссылок нет");
});

test("секрет вебхука постоянный для бота и годится для заголовка Telegram", async () => {
  const secret = await webhookSecret(TOKEN);
  assert.equal(secret, await webhookSecret(TOKEN));
  assert.match(secret, /^[A-Za-z0-9_-]{1,256}$/);
  assert.notEqual(secret, await webhookSecret("654321:ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"));
});

// --- вебхук ----------------------------------------------------------------------------

test("вебхук: без бота — 404, чужой секрет — 401, мусор — 200 без действий", async () => {
  const hook = (secret: string | null, body: string) =>
    new Request(`${SITE}/api/telegram/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) },
      body,
    });
  const update = JSON.stringify(say("/all"));
  assert.equal((await handleWebhook(hook(null, update), { store, env: {} })).status, 404);
  assert.equal((await handleWebhook(hook("guess", update), { store, env: ENV })).status, 401);
  assert.equal((await handleWebhook(hook(null, update), { store, env: ENV })).status, 401);

  const sentRequests: string[] = [];
  const fetchImpl = (async (url: string) => {
    sentRequests.push(url);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
  }) as unknown as typeof fetch;
  const secret = await webhookSecret(TOKEN);
  assert.equal((await handleWebhook(hook(secret, "{not json"), { store, env: ENV, fetchImpl })).status, 200);
  assert.equal(sentRequests.length, 0);

  const deferred: Array<() => Promise<unknown>> = [];
  const res = await handleWebhook(hook(secret, update), { store, env: ENV, fetchImpl, defer: (t) => deferred.push(t) });
  assert.equal(res.status, 200);
  assert.equal(sentRequests.length, 0, "Telegram получает ответ до работы");
  await deferred[0]();
  assert.equal(sentRequests.length, 1, "человек не из команды получил ответ — где заказать видео");
});

// --- подключение -----------------------------------------------------------------------

test("подключение по ссылке из админки: чат сохранён, приветствие с кнопками", async () => {
  const { api, calls, sent } = fakeApi();
  await linkOwner({ api });
  assert.deepEqual((await store.listChats()).map((c) => [c.chat_id, c.title]), [[777, "Амирхан"]]);
  assert.match(sent(777)[0], /Готово! Этот чат подключён к заявкам Horsteppe/);
  const keyboard = calls[0].params.reply_markup as { keyboard: { text: string }[][] };
  assert.deepEqual(keyboard.keyboard.flat().map((b) => b.text), [MENU.new, MENU.all, MENU.stats, MENU.help]);
  const menu = calls.find((c) => c.method === "setMyCommands")!;
  assert.deepEqual(menu.params.scope, { type: "chat", chat_id: 777 }, "рабочие команды — только в этом чате");
  assert.ok((menu.params.commands as { command: string }[]).some((c) => c.command === "stats"));
});

test("второй чат подключается — первый узнаёт об этом", async () => {
  const { api, sent } = fakeApi();
  await linkOwner({ api });
  const code = (await makeLinkCode(TOKEN, ENV, NOW.getTime()))!;
  const group = { id: -100200, type: "supergroup", title: "Команда" };
  await handleUpdate(say(`/start@horsteppe_test_bot ${code}`, group), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.equal((await store.listChats()).length, 2);
  assert.ok(sent(777).some((t) => t.includes("подключён ещё один чат: <b>группа «Команда»</b>")));
});

test("устаревшая или чужая ссылка не подключает", async () => {
  const { api, sent } = fakeApi();
  const old = (await makeLinkCode(TOKEN, ENV, NOW.getTime() - LINK_TTL_MS - 60_000))!;
  await handleUpdate(say(`/start ${old}`), { store, api, token: TOKEN, env: ENV, now: NOW });
  await handleUpdate(say("/start Lzzzz_0123456789abcdef0123456789abcdef"), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.deepEqual(await store.listChats(), []);
  assert.deepEqual(sent(777), [LINK_EXPIRED, LINK_EXPIRED]);
});

test("нет таблицы чатов — человек видит, что сделать, а не тишину", async () => {
  const { api, sent } = fakeApi();
  const broken = Object.assign(Object.create(store), {
    listChats: async () => {
      throw new MissingTableError("intro_telegram_chats");
    },
  }) as LeadStore;
  const code = (await makeLinkCode(TOKEN, ENV, NOW.getTime()))!;
  await handleUpdate(say(`/start ${code}`), { store: broken, api, token: TOKEN, env: ENV, now: NOW });
  assert.deepEqual(sent(777), [NO_TABLE]);
});

// --- закрытость ------------------------------------------------------------------------

test("клиент, нашедший бота, получает ссылку на заказ и контакт команды — но не заявки", async () => {
  await seed("Айгерим Тестова");
  const { api, calls, sent } = fakeApi();
  const stranger = { id: 999, type: "private", first_name: "Кто-то" };
  for (const text of [MENU.all, "/new", "/stats", "Айгерим", "/start"]) {
    await handleUpdate(say(text, stranger), { store, api, token: TOKEN, env: ENV, now: NOW, site: SITE });
  }
  assert.equal(sent(999).length, 5);
  for (const text of sent(999)) {
    assert.ok(text.includes("Видео можно заказать здесь"), text);
    assert.ok(text.includes(`${SITE}/ru#access`));
    assert.ok(text.includes("@horsteppe"));
  }
  const reply = calls.find((c) => Number(c.params.chat_id) === 999)!;
  const buttons = (reply.params.reply_markup as { inline_keyboard: { text: string; url: string }[][] }).inline_keyboard.flat();
  assert.deepEqual(buttons.map((b) => b.url), [`${SITE}/ru#access`, "https://t.me/horsteppe"]);
  assert.equal(reply.params.disable_web_page_preview, false, "с карточкой сайта — логотип и описание");
  assert.ok(!calls.some((c) => JSON.stringify(c.params).includes("Айгерим")), "ни одной заявки");

  const strangerGroup = { id: -5, type: "group", title: "Чужая группа" };
  await handleUpdate(say("/all", strangerGroup), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.equal(sent(-5).length, 0, "в чужой группе бот молчит");

  const [id] = await store.listLeads();
  await handleUpdate(press(`s:a:${id.id}`, stranger), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.equal((await store.getLead(id.id))!.status, "new", "чужая кнопка статус не меняет");
  assert.equal(calls.at(-1)!.params.text, "Нет доступа");
});

test("чат из TELEGRAM_CHAT_ID пускается без подключения в админке", async () => {
  await seed("Айгерим Тестова");
  const { api, sent } = fakeApi();
  await handleUpdate(say(MENU.all, { id: 4242, type: "private", first_name: "x" }), {
    store, api, token: TOKEN, env: { ...ENV, TELEGRAM_CHAT_ID: "4242" }, now: NOW,
  });
  assert.match(sent(4242)[0], /Айгерим Тестова/);
});

// --- работа с заявками -----------------------------------------------------------------

test("новые и все заявки — списком с кнопками имён", async () => {
  const [first, second, third] = await seed("Айгерим Тестова", "Ерлан Бекович", "Дана Серикова");
  await store.updateLead(third, { status: "contacted" });
  const { api, calls, sent } = fakeApi();
  await linkOwner({ api });
  await handleUpdate(say(MENU.new), { store, api, token: TOKEN, env: ENV, now: NOW, site: SITE });
  const fresh = sent(777).at(-1)!;
  assert.ok(fresh.includes("Новые заявки — ждут ответа</b> · 2"));
  assert.ok(fresh.includes("Айгерим Тестова") && fresh.includes("Ерлан Бекович") && !fresh.includes("Дана"));
  const buttons = (calls.at(-1)!.params.reply_markup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard.flat();
  assert.deepEqual(buttons.map((b) => b.callback_data), [`v:${first}`, `v:${second}`]);

  await handleUpdate(say("/all"), { store, api, token: TOKEN, env: ENV, now: NOW, site: SITE });
  assert.ok(sent(777).at(-1)!.includes("Все заявки</b> · 3"));
});

test("длинный список листается кнопками — то же сообщение меняется", async () => {
  await seed(...Array.from({ length: 10 }, (_, i) => `Клиент ${String.fromCharCode(1040 + i)}`));
  const { api, calls } = fakeApi();
  await linkOwner({ api });
  await handleUpdate(say(MENU.all), { store, api, token: TOKEN, env: ENV, now: NOW });
  const nav = (calls.at(-1)!.params.reply_markup as { inline_keyboard: { text: string; callback_data: string }[][] }).inline_keyboard.at(-1)!;
  assert.deepEqual(nav.map((b) => b.callback_data), ["p:all:8"]);
  await handleUpdate(press("p:all:8"), { store, api, token: TOKEN, env: ENV, now: NOW });
  const edit = calls.find((c) => c.method === "editMessageText")!;
  assert.equal(edit.params.message_id, 50);
  assert.ok(String(edit.params.text).includes("9. <b>"));
  assert.ok(String(edit.params.text).includes("10. <b>"));
});

test("кнопка статуса меняет заявку и отмечает новый статус галочкой", async () => {
  const [id] = await seed("Айгерим Тестова");
  const { api, calls } = fakeApi();
  await linkOwner({ api });
  await handleUpdate(press(`s:c:${id}`), { store, api, token: TOKEN, env: ENV, now: NOW, site: SITE });
  assert.equal((await store.getLead(id))!.status, "contacted");
  const edit = calls.find((c) => c.method === "editMessageReplyMarkup")!;
  const texts = (edit.params.reply_markup as { inline_keyboard: { text: string }[][] }).inline_keyboard.flat().map((b) => b.text);
  assert.ok(texts.includes("✓ Связались") && texts.includes("Новая"));
  assert.equal(calls.at(-1)!.params.text, "Статус: Связались");

  await handleUpdate(press("s:c:not-a-uuid"), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.match(String(calls.at(-1)!.params.text), /не найдена/);
});

test("ответ на карточку — заметка, дописывается, видна в админке", async () => {
  const [id] = await seed("Айгерим Тестова");
  const { api, sent } = fakeApi();
  await linkOwner({ api });
  const card = { text: "📄 Заявка ...", reply_markup: { inline_keyboard: [[{ text: "Новая", callback_data: `s:n:${id}` }]] } };
  await handleUpdate(say("Созвонились, ждём фото", OWNER, { reply_to_message: card }), { store, api, token: TOKEN, env: ENV, now: NOW });
  await handleUpdate(say("Фото пришли", OWNER, { reply_to_message: { text: `👤 Айгерим\n✉️ айгерим.тестова@example.kz` } }), {
    store, api, token: TOKEN, env: ENV, now: NOW,
  });
  assert.equal((await store.getLead(id))!.admin_note, "6 нояб., Амирхан: Созвонились, ждём фото\n6 нояб., Амирхан: Фото пришли");
  assert.match(sent(777).at(-1)!, /Заметка сохранена: <b>Айгерим Тестова<\/b>/);
});

test("поиск: одна находка — сразу карточка, ничего — подсказка", async () => {
  await seed("Айгерим Тестова", "Ерлан Бекович");
  const { api, sent } = fakeApi();
  await linkOwner({ api });
  await handleUpdate(say("steppe coffee"), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.ok(sent(777).at(-1)!.startsWith("📄 <b>Заявка</b>"));
  assert.ok(sent(777).at(-1)!.includes("Айгерим Тестова"));
  await handleUpdate(say("/find <нет такого>"), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.match(sent(777).at(-1)!, /«&lt;нет такого&gt;» ничего не нашёл/);
});

test("статистика: всего, по статусам, за сегодня", async () => {
  const [, second] = await seed("Айгерим Тестова", "Ерлан Бекович", "Дана Серикова");
  await store.updateLead(second, { status: "active" });
  const { api, sent } = fakeApi();
  await linkOwner({ api });
  await handleUpdate(say(MENU.stats), { store, api, token: TOKEN, env: ENV, now: NOW });
  const text = sent(777).at(-1)!;
  assert.ok(text.includes("Всего: <b>3</b>"));
  assert.ok(text.includes("🆕 Новые, ждут ответа: 2"));
  assert.ok(text.includes("⭐ Стали клиентами: 1"));
  assert.ok(text.includes("Сегодня: 3"));
  assert.ok(text.includes("Язык сайта: RU 3 · KK 0 · EN 0"));
});

test("/stop отключает чат и убирает кнопки", async () => {
  const { api, calls } = fakeApi();
  await linkOwner({ api });
  await handleUpdate(say("/stop"), { store, api, token: TOKEN, env: ENV, now: NOW });
  assert.deepEqual(await store.listChats(), []);
  assert.deepEqual(calls.at(-1)!.params.reply_markup, { remove_keyboard: true });
  assert.deepEqual(calls.find((c) => c.method === "deleteMyCommands")?.params.scope, { type: "chat", chat_id: 777 }, "рабочее меню убрано");
  await handleUpdate(say(MENU.all), { store, api, token: TOKEN, env: ENV, now: NOW, site: SITE });
  assert.match(String(calls.at(-1)!.params.text), /Видео можно заказать здесь/, "после отключения — как для клиента");
});

// --- админка ----------------------------------------------------------------------------

const BASE = "http://site.test";
async function adminCookie(): Promise<string> {
  const res = await handleLogin(
    new Request(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, host: "site.test" },
      body: JSON.stringify({ password: ENV.ADMIN_PASSWORD }),
    }),
    { store, env: ENV },
  );
  return res.headers.get("set-cookie")!.split(";")[0];
}

function apiFetch(webhookUrl = "") {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const method = url.split("/").at(-1)!;
    const params = JSON.parse(String(init.body));
    calls.push({ method, params });
    if (method === "setWebhook") webhookUrl = params.url;
    const result =
      method === "getMe" ? { username: "horsteppe_test_bot", first_name: "Horsteppe Заявки" }
        : method === "getWebhookInfo" ? { url: webhookUrl }
          : method === "sendMessage" ? { message_id: 1 }
            : true;
    return new Response(JSON.stringify({ ok: true, result }));
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("админка: без входа закрыто, без токена — инструкция, токен не раскрывается", async () => {
  const anonymous = await handleTelegramStatus(new Request(`${BASE}/api/admin/telegram`), { store, site: SITE, env: ENV });
  assert.equal(anonymous.status, 401);
  const cookie = await adminCookie();
  const get = () => new Request(`${BASE}/api/admin/telegram`, { headers: { cookie } });
  assert.deepEqual(await (await handleTelegramStatus(get(), { store, site: SITE, env: { ADMIN_PASSWORD: ENV.ADMIN_PASSWORD } })).json(), {
    configured: false, tokenInvalid: false,
  });
  assert.deepEqual(
    await (await handleTelegramStatus(get(), { store, site: SITE, env: { ...ENV, TELEGRAM_BOT_TOKEN: "мой токен" } })).json(),
    { configured: false, tokenInvalid: true },
  );
  const { impl } = apiFetch();
  const body = await (await handleTelegramStatus(get(), { store, site: SITE, env: ENV, fetchImpl: impl })).json();
  assert.equal(body.bot.username, "horsteppe_test_bot");
  assert.equal(body.webhook.connected, false);
  assert.ok(!JSON.stringify(body).includes(TOKEN.split(":")[1]), "токен в ответ не попадает");
});

test("админка: «Подключить» настраивает вебхук с секретом и выдаёт рабочую ссылку", async () => {
  const cookie = await adminCookie();
  const { impl, calls } = apiFetch();
  const post = (body: unknown, origin = BASE) =>
    new Request(`${BASE}/api/admin/telegram`, {
      method: "POST",
      headers: { cookie, origin, host: "site.test", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await handleTelegramAction(post({ action: "link" }, "http://evil.test"), { store, site: SITE, env: ENV, fetchImpl: impl })).status, 403);
  assert.equal(
    (await handleTelegramAction(post({ action: "link" }), { store, site: "http://localhost:3000", env: ENV, fetchImpl: impl })).status,
    409,
    "Telegram шлёт только на https",
  );

  // Без подменённого времени: сессия входа подписана настоящими часами.
  const res = await handleTelegramAction(post({ action: "link" }), { store, site: SITE, env: ENV, fetchImpl: impl });
  assert.equal(res.status, 200);
  const { link, groupLink } = await res.json();
  const hook = calls.find((c) => c.method === "setWebhook")!;
  assert.equal(hook.params.url, `${SITE}/api/telegram/webhook`);
  assert.equal(hook.params.secret_token, await webhookSecret(TOKEN));
  assert.deepEqual(hook.params.allowed_updates, ["message", "callback_query"]);
  // Витрина для клиентов: в меню только /start, описание — на трёх языках.
  const publicMenus = calls.filter((c) => c.method === "setMyCommands" && !c.params.scope);
  assert.equal(publicMenus.length, 3);
  for (const menu of publicMenus) assert.deepEqual((menu.params.commands as { command: string }[]).map((c) => c.command), ["start"]);
  const descriptions = calls.filter((c) => c.method === "setMyDescription");
  assert.deepEqual(descriptions.map((c) => c.params.language_code ?? "по умолчанию").sort(), ["en", "kk", "по умолчанию"]);
  assert.ok(String(descriptions.find((c) => !c.params.language_code)!.params.description).includes("Запустить"));
  assert.ok(calls.some((c) => c.method === "setMyShortDescription"));
  const code = new URL(link).searchParams.get("start")!;
  assert.match(link, /^https:\/\/t\.me\/horsteppe_test_bot\?start=/);
  assert.equal(new URL(groupLink).searchParams.get("startgroup"), code);
  assert.equal(await checkLinkCode(code, TOKEN, ENV), true);

  const status = await (await handleTelegramStatus(new Request(`${BASE}/api/admin/telegram`, { headers: { cookie } }), {
    store, site: SITE, env: ENV, fetchImpl: impl,
  })).json();
  assert.equal(status.webhook.connected, true, "после подключения бот слышит сайт");

  assert.equal((await handleTelegramAction(post({ action: "test" }), { store, site: SITE, env: ENV, fetchImpl: impl })).status, 409, "некуда слать");
  await store.addChat({ chat_id: 777, title: "Амирхан" });
  const tested = await (await handleTelegramAction(post({ action: "test" }), { store, site: SITE, env: ENV, fetchImpl: impl })).json();
  assert.deepEqual(tested, { ok: true, delivered: 1, total: 1 });

  const unlinked = await (await handleTelegramAction(post({ action: "unlink", chat_id: 777 }), { store, site: SITE, env: ENV, fetchImpl: impl })).json();
  assert.deepEqual(unlinked, { ok: true, removed: true });
  assert.deepEqual(await store.listChats(), []);
  assert.deepEqual(calls.at(-1)!.params.reply_markup, { remove_keyboard: true });
});

test("язык ответа клиенту — из настроек его Telegram", async () => {
  assert.equal(publicLang("kk"), "kk");
  assert.equal(publicLang("ru"), "ru");
  assert.equal(publicLang("uk"), "ru");
  assert.equal(publicLang(undefined), "ru");
  assert.equal(publicLang("en-US"), "en");
  assert.equal(publicLang("de"), "en");

  const { api, sent } = fakeApi();
  const ask = (id: number, language_code: string) =>
    handleUpdate(
      { message: { message_id: 1, chat: { id, type: "private" }, from: { id, first_name: "Client", language_code }, text: "/start" } } as TgUpdate,
      { store, api, token: TOKEN, env: ENV, now: NOW, site: SITE },
    );
  await ask(501, "kk");
  await ask(502, "en");
  assert.ok(sent(501)[0].includes(`${SITE}/kk#access`) && sent(501)[0].includes("тапсырыс"));
  assert.ok(sent(502)[0].includes(`${SITE}/en#access`) && sent(502)[0].includes("You can order a video here"));
});
