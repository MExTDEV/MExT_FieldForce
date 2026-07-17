import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listOwnInventoryBalances } from "@/lib/server/inventory/service";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/inventory/balances:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      return { locations: await listOwnInventoryBalances({ actor }) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De voorraad kon niet worden geladen.");
}
