import { badRequest, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { createSalesFollowUp } from "@/lib/server/salesday-day-execution";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApiCreated("api/salesday/appointments/:appointmentId/follow-up", async () => {
    const { appointmentId } = await context.params; const body = await request.json() as { actorId?: string; deviceId?: string; type?: string; description?: string };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try { await assertSalesDayFeatureEnabled(actor, "SALESDAY"); await assertSalesDayFeatureEnabled(actor, "ERP_WRITES"); if (!body.type || !body.description) badRequest("Opvolgtype en beschrijving zijn verplicht."); const runtime = await getSalesDayRuntimeConfiguration(); return createSalesFollowUp({ actor, loginSessionId, deviceId: body.deviceId ?? "", provider: runtime.provider, appointmentId, type: body.type, description: body.description }); } catch (error) { rethrowSalesDaySyncError(error); }
  }, "De opvolging kon niet worden aangemaakt.");
}
