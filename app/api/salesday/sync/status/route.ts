import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";
import { getOwnSalesDaySyncStatus } from "@/lib/server/salesday-sync-status";
import { getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";

export async function GET(request: Request) {
  return handleApi("api/salesday/sync/status", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      const runtime = await getSalesDayRuntimeConfiguration();
      return await getOwnSalesDaySyncStatus({
        actor,
        loginSessionId,
        deviceId: parameters.get("deviceId") ?? "",
        provider: runtime.provider,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De SalesDay-synchronisatiestatus kon niet worden geladen.");
}
