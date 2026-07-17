import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listConsumablesRequests, submitConsumablesRequest, type ConsumablesRequestInput } from "@/lib/server/inventory/consumables";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/inventory/consumables:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      const runtime = await getSalesDayRuntimeConfiguration();
      return { requests: await listConsumablesRequests({ actor, provider: runtime.provider }) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De verbruiksgoederenaanvragen konden niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApiCreated("api/inventory/consumables:post", async () => {
    const body = await request.json() as { actorId?: string; deviceId?: string; request?: ConsumablesRequestInput };
    if (!body.request) badRequest("Aanvraaggegevens ontbreken.");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return submitConsumablesRequest({ actor, provider: runtime.provider, deviceId: device.deviceId, request: body.request });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De verbruiksgoederenaanvraag kon niet worden geregistreerd.");
}
