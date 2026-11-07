import { getStore } from "../../../../lib/leads/store.ts";
import { siteUrl } from "../../../../lib/site.ts";
import { handleTelegramAction, handleTelegramStatus } from "../../../../lib/telegram/admin.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleTelegramStatus(request, { store: getStore(), site: siteUrl() });
}

export async function POST(request: Request) {
  return handleTelegramAction(request, { store: getStore(), site: siteUrl() });
}
