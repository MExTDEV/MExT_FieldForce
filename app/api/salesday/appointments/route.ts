import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  createSalesDayAppointment,
  listSalesDayAppointments,
  type SalesDayAppointmentInput,
} from "@/lib/server/salesday-appointments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/appointments:get", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return { appointments: await listSalesDayAppointments(actor) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De afspraken konden niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApiCreated("api/salesday/appointments:post", async () => {
    const body = await request.json() as { actorId?: string; deviceId?: string; appointment?: SalesDayAppointmentInput };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      if (!body.appointment) badRequest("Afspraakgegevens ontbreken.");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return createSalesDayAppointment({
        actor,
        deviceId: device.deviceId,
        provider: runtime.provider,
        appointment: body.appointment,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De afspraak kon niet worden aangemaakt.");
}
