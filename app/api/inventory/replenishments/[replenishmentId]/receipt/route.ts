import { badRequest, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { submitReplenishmentReceipt, type ReplenishmentReceiptInput } from "@/lib/server/inventory/replenishments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request, context: { params: Promise<{ replenishmentId: string }> }) {
  return handleApiCreated("api/inventory/replenishments/:replenishmentId/receipt:post", async () => {
    const { replenishmentId } = await context.params;
    const body = await request.json() as { actorId?: string; deviceId?: string; receipt?: Omit<ReplenishmentReceiptInput, "replenishmentId"> };
    if (!body.receipt) badRequest("Ontvangstgegevens ontbreken.");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return submitReplenishmentReceipt({
        actor,
        provider: runtime.provider,
        deviceId: device.deviceId,
        receipt: { ...body.receipt, replenishmentId },
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De ontvangst kon niet worden geregistreerd.");
}
