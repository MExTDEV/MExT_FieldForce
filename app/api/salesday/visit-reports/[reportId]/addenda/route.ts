import { badRequest, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { createSalesVisitReportAddendum } from "@/lib/server/salesday-day-execution";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request, context: { params: Promise<{ reportId: string }> }) {
  return handleApiCreated("api/salesday/visit-reports/:reportId/addenda", async () => {
    const { reportId } = await context.params;
    const body = await request.json() as { actorId?: string; deviceId?: string; reason?: string; html?: string };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY"); await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      if (!body.reason || !body.html) badRequest("Correctiereden en inhoud zijn verplicht.");
      const runtime = await getSalesDayRuntimeConfiguration();
      return createSalesVisitReportAddendum({ actor, loginSessionId, deviceId: body.deviceId ?? "", provider: runtime.provider, reportId, reason: body.reason, html: body.html });
    } catch (error) { rethrowSalesDaySyncError(error); }
  }, "Het correctie-addendum kon niet worden toegevoegd.");
}
