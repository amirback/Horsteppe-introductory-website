/**
 * Уведомление о заявке в Telegram: карточка с кнопками статуса — во все чаты,
 * подключённые из админки, и в TELEGRAM_CHAT_ID, если он задан. Без токена
 * бота (TELEGRAM_BOT_TOKEN) молча выключено.
 *
 * Уведомление вторично: заявка уже записана. Поэтому сбой Telegram не
 * роняет ответ посетителю, а ожидание ограничено несколькими секундами.
 */
import type { Lead } from "./leads/schema.ts";
import type { LeadStore } from "./leads/store.ts";
import { botToken, telegramApi } from "./telegram/api.ts";
import { leadCard } from "./telegram/format.ts";

type Env = Record<string, string | undefined>;

/** Кому слать: подключённые чаты и чат из настроек, без повторов. */
export async function notifyTargets(env: Env, store?: LeadStore | null): Promise<string[]> {
  const targets = new Set<string>();
  const fixed = env.TELEGRAM_CHAT_ID?.trim();
  if (fixed) targets.add(fixed);
  if (store) {
    try {
      for (const chat of await store.listChats()) targets.add(String(chat.chat_id));
    } catch {
      // Таблицы чатов может ещё не быть — тогда только чат из настроек.
    }
  }
  return [...targets];
}

export async function notifyTelegram(
  lead: Lead,
  created: boolean,
  options: { env?: Env; store?: LeadStore | null; site?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const token = botToken(env);
  if (!token) return false;
  const targets = await notifyTargets(env, options.store);
  if (!targets.length) return false;

  const card = leadCard(lead, created ? "new" : "repeat", options.site);
  const api = telegramApi(token, { env, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs ?? 3500 });
  const results = await Promise.all(
    targets.map((chat) =>
      api.call("sendMessage", {
        chat_id: chat,
        text: card.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: card.reply_markup,
      }),
    ),
  );
  return results.some((r) => r.ok);
}
