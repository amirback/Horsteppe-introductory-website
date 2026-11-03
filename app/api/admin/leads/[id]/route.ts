import { handleDelete, handleUpdate } from "../../../../../lib/api.ts";
import { getStore } from "../../../../../lib/leads/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handleUpdate(request, id, { store: getStore() });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return handleDelete(request, id, { store: getStore() });
}
