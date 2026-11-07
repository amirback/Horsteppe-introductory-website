/**
 * Telegram в админке: состояние бота, подключение чата, проверка связи,
 * отключение. Всё — только после входа в админку; изменения — только с
 * нашего же сайта (защита от CSRF, как у остальных действий админки).
 */
import { isAdmin, json, readJson } from "../api.ts";
import { MissingTableError } from "../leads/errors.ts";
import type { LeadStore, TelegramChat } from "../leads/store.ts";
import { sameOrigin } from "../request.ts";
import { botToken, isTestApi, telegramApi } from "./api.ts";
import { LINK_TTL_MS, makeLinkCode, webhookSecret } from "./keys.ts";

type Env = Record<string, string | undefined>;
type Deps = { store: LeadStore | null; site: string; env?: Env; now?: Date; fetchImpl?: typeof fetch };

/** Меню команд, которое Telegram показывает по кнопке «/» рядом с полем ввода. */
export const BOT_COMMANDS = [
  { command: "new", description: "Новые заявки — ждут ответа" },
  { command: "all", description: "Все заявки" },
  { command: "stats", description: "Статистика" },
  { command: "find", description: "Найти заявку по имени, почте или компании" },
  { command: "help", description: "Что умеет бот" },
  { command: "stop", description: "Не присылать заявки в этот чат" },
];

async function linkedChats(store: LeadStore | null): Promise<{ chats: TelegramChat[]; tableMissing: boolean }> {
  if (!store) return { chats: [], tableMissing: false };
  try {
    return { chats: await store.listChats(), tableMissing: false };
  } catch (error) {
    if (error instanceof MissingTableError) return { chats: [], tableMissing: true };
    throw error;
  }
}

export async function handleTelegramStatus(request: Request, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!(await isAdmin(request, env, (deps.now ?? new Date()).getTime()))) return json({ error: "unauthorized" }, 401);
  const token = botToken(env);
  // Токен не показываем никогда — только есть ли он и похож ли на настоящий.
  if (!token) return json({ configured: false, tokenInvalid: !!env.TELEGRAM_BOT_TOKEN?.trim() });

  const api = telegramApi(token, { env, fetchImpl: deps.fetchImpl });
  const me = await api.call<{ username: string; first_name: string }>("getMe");
  if (!me.ok) return json({ configured: true, ok: false, error: me.description });
  const info = await api.call<{ url: string; last_error_message?: string }>("getWebhookInfo");

  let chats: { chats: TelegramChat[]; tableMissing: boolean };
  try {
    chats = await linkedChats(deps.store);
  } catch (error) {
    console.error("telegram status: chats failed —", (error as Error).message);
    return json({ error: "store_unavailable" }, 503);
  }
  return json({
    configured: true,
    ok: true,
    bot: { username: me.result.username, name: me.result.first_name },
    webhook: {
      connected: info.ok && info.result.url === `${deps.site}/api/telegram/webhook`,
      lastError: info.ok ? (info.result.last_error_message ?? null) : info.description,
    },
    chats: chats.chats,
    tableMissing: chats.tableMissing,
    envChat: !!env.TELEGRAM_CHAT_ID?.trim(),
    storeReady: !!deps.store,
  });
}

export async function handleTelegramAction(request: Request, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();
  if (!(await isAdmin(request, env, now.getTime()))) return json({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  const token = botToken(env);
  if (!token) return json({ error: "not_configured" }, 409);
  const body = ((await readJson(request)) ?? {}) as { action?: unknown; chat_id?: unknown };
  const api = telegramApi(token, { env, fetchImpl: deps.fetchImpl });

  if (body.action === "link") {
    // Telegram доставляет обновления только на https. Исключение — проверка с поддельным Telegram.
    if (!deps.site.startsWith("https://") && !isTestApi(env)) return json({ error: "need_https" }, 409);
    const hook = await api.call("setWebhook", {
      url: `${deps.site}/api/telegram/webhook`,
      secret_token: await webhookSecret(token),
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    if (!hook.ok) return json({ error: "telegram", detail: hook.description }, 502);
    await api.call("setMyCommands", { commands: BOT_COMMANDS });
    const me = await api.call<{ username: string }>("getMe");
    if (!me.ok) return json({ error: "telegram", detail: me.description }, 502);
    const code = await makeLinkCode(token, env, now.getTime());
    if (!code) return json({ error: "admin_not_configured" }, 503);
    return json({
      ok: true,
      link: `https://t.me/${me.result.username}?start=${code}`,
      groupLink: `https://t.me/${me.result.username}?startgroup=${code}`,
      expiresInMin: LINK_TTL_MS / 60_000,
    });
  }

  if (body.action === "test") {
    const { chats } = await linkedChats(deps.store).catch(() => ({ chats: [] as TelegramChat[] }));
    const targets = [...new Set([...chats.map((c) => String(c.chat_id)), env.TELEGRAM_CHAT_ID?.trim() ?? ""].filter(Boolean))];
    if (!targets.length) return json({ error: "no_chats" }, 409);
    const results = await Promise.all(
      targets.map((chat) =>
        api.call("sendMessage", { chat_id: chat, text: "✅ Проверка связи: бот Horsteppe на месте. Новые заявки будут приходить сюда." }),
      ),
    );
    return json({ ok: true, delivered: results.filter((r) => r.ok).length, total: targets.length });
  }

  if (body.action === "unlink") {
    const chatId = Number(body.chat_id);
    if (!Number.isSafeInteger(chatId)) return json({ error: "invalid" }, 400);
    if (!deps.store) return json({ error: "store_unavailable" }, 503);
    try {
      const removed = await deps.store.removeChat(chatId);
      if (removed) {
        await api.call("sendMessage", {
          chat_id: chatId,
          text: "Этот чат отключили от заявок Horsteppe в админке сайта.",
          reply_markup: { remove_keyboard: true },
        });
      }
      return json({ ok: true, removed });
    } catch (error) {
      console.error("telegram unlink failed —", (error as Error).message);
      return json({ error: "store_unavailable" }, 503);
    }
  }

  return json({ error: "invalid" }, 400);
}
