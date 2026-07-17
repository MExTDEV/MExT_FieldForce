import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { ingestOfflineSalesErpCommands } from "@/lib/server/salesday-offline-sync";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request) {
  return handleApi("api/salesday/sync/commands", async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(
      typeof body.actorId === "string" ? body.actorId : undefined,
    );
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "OFFLINE_COMMANDS");
      const runtime = await getSalesDayRuntimeConfiguration();
      return await ingestOfflineSalesErpCommands({
        actor,
        loginSessionId,
        deviceId: String(body.deviceId ?? ""),
        provider: runtime.provider,
        items: body.items,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "Offline SalesDay-commando's konden niet duurzaam worden opgeslagen.");
}
