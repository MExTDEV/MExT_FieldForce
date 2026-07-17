import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listOwnReplenishments } from "@/lib/server/inventory/replenishments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/inventory/replenishments:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      const runtime = await getSalesDayRuntimeConfiguration();
      return { replenishments: await listOwnReplenishments({ actor, provider: runtime.provider }) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De bevoorrading kon niet worden geladen.");
}
