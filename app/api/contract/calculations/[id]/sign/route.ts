import type { NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { signContractCalculation } from "@/lib/contract/services";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("contract.calculations.sign", async () => {
    const { id } = await params;
    const body = await request.json() as { actorId?: string; signedByName: string; signedPlace?: string; signatureData?: string };
    const actor = await requireAuthenticatedUser(body.actorId);
    return signContractCalculation(actor, id, body);
  });
}
