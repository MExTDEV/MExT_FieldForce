import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";
import { getOwnSalesDaySyncStatus } from "@/lib/server/salesday-sync-status";

export async function GET(request: Request) {
  return handleApi("api/salesday/sync/status", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      return await getOwnSalesDaySyncStatus({
        actor,
        loginSessionId,
        deviceId: parameters.get("deviceId") ?? "",
        provider: parameters.get("provider") ?? "",
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De SalesDay-synchronisatiestatus kon niet worden geladen.");
}
