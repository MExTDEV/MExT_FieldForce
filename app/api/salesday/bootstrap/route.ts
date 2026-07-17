import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  assertSalesDayFeatureEnabled,
  getSalesDayFeatureAccess,
  getSalesDayRuntimeConfiguration,
} from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/bootstrap", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      const device = await requireActiveSalesDayDevice({
        actor,
        loginSessionId,
        deviceId: parameters.get("deviceId") ?? "",
      });
      const [features, runtime] = await Promise.all([
        getSalesDayFeatureAccess(actor),
        getSalesDayRuntimeConfiguration(),
      ]);
      return {
        schemaVersion: "salesday-bootstrap-v1",
        serverNow: new Date().toISOString(),
        deviceId: device.deviceId,
        provider: runtime.provider,
        features,
        enabledNotifications: runtime.enabledNotifications,
      };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De SalesDay-opstartgegevens konden niet veilig worden geladen.");
}
