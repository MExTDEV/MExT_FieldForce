import type { NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { searchContractArticles } from "@/lib/contract/services";

export async function GET(request: NextRequest) {
  return handleApi("contract.articles", async () => {
    const actor = await requireAuthenticatedUser(request.nextUrl.searchParams.get("actorId"));
    return searchContractArticles(actor, request.nextUrl.searchParams.get("q") ?? "");
  });
}
