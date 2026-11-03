import { handleExport } from "../../../../lib/api.ts";
import { getStore } from "../../../../lib/leads/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV для скачивания (сессия) и для Google Таблиц (=IMPORTDATA по секретной ссылке). */
export async function GET(request: Request) {
  return handleExport(request, { store: getStore() });
}
