import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  setSalesDayAppointmentOutcome,
  type SalesDayAppointmentOutcome,
} from "@/lib/server/salesday-appointments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

const outcomes: SalesDayAppointmentOutcome[] = ["COMPLETED", "NOT_COMPLETED", "MOVED", "CANCELLED"];

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  return handleApi("api/salesday/appointments/:appointmentId/outcome", async () => {
    const { appointmentId } = await context.params;
    const body = await request.json() as {
      actorId?: string;
      deviceId?: string;
      outcome?: SalesDayAppointmentOutcome;
      reasonExternalId?: string;
      comment?: string;
    };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      if (!body.outcome || !outcomes.includes(body.outcome)) badRequest("Een geldige afspraakuitkomst is verplicht.");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      const runtime = await getSalesDayRuntimeConfiguration();
      return setSalesDayAppointmentOutcome({
        actor,
        deviceId: device.deviceId,
        provider: runtime.provider,
        appointmentId,
        outcome: body.outcome,
        reasonExternalId: body.reasonExternalId,
        comment: body.comment,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De afspraakuitkomst kon niet worden opgeslagen.");
}
