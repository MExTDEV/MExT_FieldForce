import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { updateSalesPreparation } from "@/lib/server/salesday-preparation";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  return handleApi("api/salesday/preparations/:appointmentId:patch", async () => {
    const { appointmentId } = await context.params;
    const body = await request.json() as {
      actorId?: string;
      deviceId?: string;
      note?: string;
      prepared?: boolean;
      feedback?: { articleExternalId: string; relevant?: boolean; addedManually?: boolean; comment?: string };
    };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return updateSalesPreparation({
        actor,
        loginSessionId,
        deviceId: body.deviceId ?? "",
        appointmentId,
        note: body.note,
        prepared: body.prepared,
        feedback: body.feedback,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De voorbereiding kon niet worden opgeslagen.");
}
