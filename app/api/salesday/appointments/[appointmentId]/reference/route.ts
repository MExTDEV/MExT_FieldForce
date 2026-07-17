import { badRequest, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { createSalesReference } from "@/lib/server/salesday-day-execution";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApiCreated("api/salesday/appointments/:appointmentId/reference", async () => {
    const { appointmentId } = await context.params; const body = await request.json() as { actorId?: string; deviceId?: string; proposedName?: string; contactName?: string; email?: string; phone?: string; comment?: string };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try { await assertSalesDayFeatureEnabled(actor, "SALESDAY"); await assertSalesDayFeatureEnabled(actor, "ERP_WRITES"); if (!body.proposedName) badRequest("De naam van de potentiële klant ontbreekt."); const runtime = await getSalesDayRuntimeConfiguration(); return createSalesReference({ actor, loginSessionId, deviceId: body.deviceId ?? "", provider: runtime.provider, appointmentId, proposedName: body.proposedName, contactName: body.contactName, email: body.email, phone: body.phone, comment: body.comment }); } catch (error) { rethrowSalesDaySyncError(error); }
  }, "De klantreferentie kon niet worden doorgestuurd.");
}
