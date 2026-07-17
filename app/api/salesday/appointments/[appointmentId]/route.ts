import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { updateSalesDayAppointment, type SalesDayAppointmentInput } from "@/lib/server/salesday-appointments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  return handleApi("api/salesday/appointments/:appointmentId:patch", async () => {
    const { appointmentId } = await context.params;
    const body = await request.json() as { actorId?: string; deviceId?: string; appointment?: SalesDayAppointmentInput };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      if (!body.appointment) badRequest("Afspraakgegevens ontbreken.");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return updateSalesDayAppointment({
        actor,
        deviceId: device.deviceId,
        provider: runtime.provider,
        appointmentId,
        appointment: body.appointment,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De afspraak kon niet worden gewijzigd.");
}
