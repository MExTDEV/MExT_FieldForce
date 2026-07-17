import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  createCustomerInventoryLocation,
  listCustomerInventoryLocations,
  type InventoryLocationInput,
} from "@/lib/server/inventory/service";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request, context: { params: Promise<{ relationId: string }> }) {
  return handleApi("api/inventory/customers/:relationId/locations:get", async () => {
    const { relationId } = await context.params;
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      return { locations: await listCustomerInventoryLocations({ actor, relationId }) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De klantlocaties konden niet worden geladen.");
}

export async function POST(request: Request, context: { params: Promise<{ relationId: string }> }) {
  return handleApiCreated("api/inventory/customers/:relationId/locations:post", async () => {
    const { relationId } = await context.params;
    const body = await request.json() as { actorId?: string; deviceId?: string; location?: Omit<InventoryLocationInput, "relationId"> };
    if (!body.location) badRequest("Locatiegegevens ontbreken.");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return createCustomerInventoryLocation({
        actor,
        provider: runtime.provider,
        deviceId: device.deviceId,
        location: { ...body.location, relationId },
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De klantlocatie kon niet worden aangemaakt.");
}
