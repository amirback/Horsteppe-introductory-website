import { handleList } from "../../../../lib/api.ts";
import { getStore } from "../../../../lib/leads/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleList(request, { store: getStore() });
}
