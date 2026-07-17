import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesDayContractContext } from "@/lib/server/salesday-commercial-documents";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApi("api/salesday/appointments/:appointmentId/contract-context:get", async () => {
    const { appointmentId } = await context.params;
    const query = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      const runtime = await getSalesDayRuntimeConfiguration();
      return getSalesDayContractContext({ actor, loginSessionId, deviceId: query.get("deviceId") ?? "", provider: runtime.provider, appointmentId });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  });
}
