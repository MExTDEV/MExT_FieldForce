import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesDayServerDayGate } from "@/lib/server/salesday-day-access";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/sync/day-gate", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      return await getSalesDayServerDayGate({
        actor,
        loginSessionId,
        deviceId: parameters.get("deviceId") ?? "",
        businessDate: parameters.get("businessDate") ?? "",
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De toegang tot de SalesDay-werkdag kon niet worden bepaald.");
}
