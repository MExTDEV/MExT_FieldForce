import type { NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { confirmContractImport } from "@/lib/contract/services";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("contract.import.confirm", async () => {
    const { id } = await params;
    const body = await request.json() as { actorId?: string };
    const actor = await requireAuthenticatedUser(body.actorId);
    return confirmContractImport(actor, id);
  });
}
