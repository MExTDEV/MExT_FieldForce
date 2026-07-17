import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesDayTeam } from "@/lib/server/salesday-team";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/team:get", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return getSalesDayTeam({ actor });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  });
}
