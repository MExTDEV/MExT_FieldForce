import { badRequest, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { createSalesVisitReport } from "@/lib/server/salesday-day-execution";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApiCreated("api/salesday/appointments/:appointmentId/visit-report", async () => {
    const { appointmentId } = await context.params;
    const body = await request.json() as { actorId?: string; deviceId?: string; html?: string };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY"); await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      if (!body.html) badRequest("Het bezoekverslag ontbreekt.");
      const runtime = await getSalesDayRuntimeConfiguration();
      return createSalesVisitReport({ actor, loginSessionId, deviceId: body.deviceId ?? "", provider: runtime.provider, appointmentId, html: body.html });
    } catch (error) { rethrowSalesDaySyncError(error); }
  }, "Het bezoekverslag kon niet worden afgesloten.");
}
