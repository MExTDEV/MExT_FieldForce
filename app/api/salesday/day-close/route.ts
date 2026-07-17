import { handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { closeSalesDay } from "@/lib/server/salesday-day-execution";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request) {
  return handleApiCreated("api/salesday/day-close", async () => {
    const body = await request.json() as { actorId?: string; deviceId?: string }; const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try { await assertSalesDayFeatureEnabled(actor, "SALESDAY"); await assertSalesDayFeatureEnabled(actor, "ERP_WRITES"); const runtime = await getSalesDayRuntimeConfiguration(); return closeSalesDay({ actor, loginSessionId, deviceId: body.deviceId ?? "", provider: runtime.provider }); } catch (error) { rethrowSalesDaySyncError(error); }
  }, "De werkdag kon niet worden afgesloten.");
}
