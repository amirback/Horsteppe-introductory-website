import { after } from "next/server";
import { handleLead } from "../../../lib/api.ts";
import { getStore } from "../../../lib/leads/store.ts";
import { notifyTelegram } from "../../../lib/notify.ts";
import { siteUrl } from "../../../lib/site.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const store = getStore();
  return handleLead(request, {
    store,
    // Уведомление — после ответа: человек не ждёт Telegram.
    defer: (task) => after(task),
    notify: (lead, created) => notifyTelegram(lead, created, { store, site: siteUrl() }),
  });
}
