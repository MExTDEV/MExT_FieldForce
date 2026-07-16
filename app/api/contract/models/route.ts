import type { NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listContractModelVersions } from "@/lib/contract/services";

export async function GET(request: NextRequest) {
  return handleApi("contract.models", async () => {
    const actor = await requireAuthenticatedUser(request.nextUrl.searchParams.get("actorId"));
    return listContractModelVersions(actor);
  });
}
