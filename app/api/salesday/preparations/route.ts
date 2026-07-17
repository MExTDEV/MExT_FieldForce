import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesPreparationOverview } from "@/lib/server/salesday-preparation";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/preparations:get", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return getSalesPreparationOverview({
        actor,
        loginSessionId,
        deviceId: parameters.get("deviceId") ?? "",
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De voorbereiding kon niet worden geladen.");
}
