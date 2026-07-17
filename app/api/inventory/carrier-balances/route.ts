import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listCarrierBalances } from "@/lib/server/inventory/carrier-stock";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/inventory/carrier-balances:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      return {
        carriers: await listCarrierBalances({
          actor,
          relationId: query.get("relationId") ?? undefined,
          carrierLocationId: query.get("carrierLocationId") ?? undefined,
        }),
      };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De dragerstock kon niet worden geladen.");
}
