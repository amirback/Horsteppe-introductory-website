import { handleLogin } from "../../../../lib/api.ts";
import { getStore } from "../../../../lib/leads/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleLogin(request, { store: getStore() });
}
