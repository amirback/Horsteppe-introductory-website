/**
 * Уведомление о заявке в Telegram — если заданы TELEGRAM_BOT_TOKEN и
 * TELEGRAM_CHAT_ID. Без них молча выключено.
 *
 * Уведомление вторично: заявка уже записана. Поэтому сбой Telegram не
 * роняет ответ посетителю, а ожидание ограничено несколькими секундами.
 */
import { USE_CASE_LABEL, VOLUME_LABEL } from "./leads/labels.ts";
import type { Lead } from "./leads/schema.ts";

type Env = Record<string, string | undefined>;

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function leadMessage(lead: Lead, created: boolean, adminUrl?: string): string {
  const lines = [
    `<b>${created ? "Новая заявка" : "Повторная заявка"} — Horsteppe</b>`,
    "",
    `<b>${escape(lead.name)}</b> · ${escape(lead.email)}`,
  ];
  if (lead.contact) lines.push(`Связь: ${escape(lead.contact)}`);
  if (lead.company) lines.push(`Компания: ${escape(lead.company)}`);
  if (lead.use_case) lines.push(`Задача: ${escape(USE_CASE_LABEL[lead.use_case])}`);
  if (lead.volume) lines.push(`Объём: ${escape(VOLUME_LABEL[lead.volume])}`);
  if (lead.message) lines.push("", escape(lead.message.slice(0, 600)));
  const origin = [lead.lang.toUpperCase(), lead.country, lead.city, lead.utm_source && `utm: ${lead.utm_source}`]
    .filter(Boolean)
    .map((v) => escape(String(v)));
  lines.push("", origin.join(" · "));
  if (adminUrl) lines.push(adminUrl);
  return lines.join("\n");
}

export async function notifyTelegram(
  lead: Lead,
  created: boolean,
  options: { env?: Env; fetchImpl?: typeof fetch; adminUrl?: string; timeoutMs?: number } = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chat) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 3500);
  try {
    const response = await (options.fetchImpl ?? fetch)(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: leadMessage(lead, created, options.adminUrl),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
