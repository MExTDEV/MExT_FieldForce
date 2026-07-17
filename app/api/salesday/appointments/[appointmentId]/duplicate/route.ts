import { handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { duplicateSalesDayAppointment } from "@/lib/server/salesday-appointments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  return handleApiCreated("api/salesday/appointments/:appointmentId/duplicate", async () => {
    const { appointmentId } = await context.params;
    const body = await request.json() as { actorId?: string; deviceId?: string };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return duplicateSalesDayAppointment({ actor, deviceId: device.deviceId, provider: runtime.provider, appointmentId });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De afspraak kon niet worden gedupliceerd.");
}
