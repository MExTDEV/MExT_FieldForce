import type { NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listContractImports } from "@/lib/contract/services";

export async function GET(request: NextRequest) {
  return handleApi("contract.import-history", async () => {
    const actor = await requireAuthenticatedUser(request.nextUrl.searchParams.get("actorId"));
    return listContractImports(actor);
  });
}
