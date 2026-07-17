import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  archiveCustomerInventoryLocation,
  updateCustomerInventoryLocation,
  type InventoryLocationArchiveInput,
  type InventoryLocationUpdateInput,
} from "@/lib/server/inventory/service";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

type Body = {
  actorId?: string;
  deviceId?: string;
  action?: "update" | "archive";
  patch?: InventoryLocationUpdateInput;
  archive?: InventoryLocationArchiveInput;
};

export async function PATCH(request: Request, context: { params: Promise<{ locationId: string }> }) {
  return handleApi("api/inventory/locations/:locationId:patch", async () => {
    const { locationId } = await context.params;
    const body = await request.json() as Body;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      if (body.action === "archive") {
        if (!body.archive) badRequest("Archiveringsgegevens ontbreken.");
        return archiveCustomerInventoryLocation({ actor, provider: runtime.provider, deviceId: device.deviceId, locationId, archive: body.archive });
      }
      if (!body.patch) badRequest("Wijzigingsgegevens ontbreken.");
      return updateCustomerInventoryLocation({ actor, provider: runtime.provider, deviceId: device.deviceId, locationId, patch: body.patch });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De klantlocatie kon niet worden gewijzigd.");
}
