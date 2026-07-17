import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesDayOperationalDashboard } from "@/lib/server/salesday-operational-dashboard";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/operational-dashboard:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      const runtime = await getSalesDayRuntimeConfiguration();
      return getSalesDayOperationalDashboard({
        actor,
        provider: runtime.provider,
        businessDate: query.get("businessDate") ?? undefined,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "Het SalesDay-operationeel overzicht kon niet worden geladen.");
}
