import { after } from "next/server";
import { getStore } from "../../../../lib/leads/store.ts";
import { siteUrl } from "../../../../lib/site.ts";
import { handleWebhook } from "../../../../lib/telegram/bot.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Сюда Telegram присылает сообщения и нажатия кнопок бота. */
export async function POST(request: Request) {
  return handleWebhook(request, {
    store: getStore(),
    site: siteUrl(),
    // Ответ Telegram — сразу, работа — после: так он не шлёт то же обновление повторно.
    defer: (task) => after(task),
  });
}
