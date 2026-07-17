import { badRequest, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { submitCarrierCount, type CarrierCountInput } from "@/lib/server/inventory/carrier-stock";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request) {
  return handleApiCreated("api/inventory/carrier-counts:post", async () => {
    const body = await request.json() as { actorId?: string; deviceId?: string; carrierLocationId?: string; count?: CarrierCountInput };
    if (!body.carrierLocationId) badRequest("Drager ontbreekt.");
    if (!body.count) badRequest("Tellingsgegevens ontbreken.");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return submitCarrierCount({
        actor,
        provider: runtime.provider,
        deviceId: device.deviceId,
        carrierLocationId: body.carrierLocationId,
        count: body.count,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De drager-telling kon niet worden geregistreerd.");
}
