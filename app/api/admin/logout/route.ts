import { handleLogout } from "../../../../lib/api.ts";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleLogout(request);
}
