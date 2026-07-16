import type { NextRequest } from "next/server";
import { handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { saveContractCalculation } from "@/lib/contract/services";

export async function POST(request: NextRequest) {
  return handleApiCreated("contract.calculations.create", async () => {
    const body = await request.json() as Parameters<typeof saveContractCalculation>[1] & { actorId?: string };
    const actor = await requireAuthenticatedUser(body.actorId);
    return saveContractCalculation(actor, body);
  });
}
