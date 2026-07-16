import type { NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getContractOverview } from "@/lib/contract/services";

export async function GET(request: NextRequest) {
  return handleApi("contract.overview", async () => {
    const actor = await requireAuthenticatedUser(request.nextUrl.searchParams.get("actorId"));
    return getContractOverview(actor);
  });
}
