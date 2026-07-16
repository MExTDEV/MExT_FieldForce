import { ApiRequestError, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { SalesErpError } from "@/lib/server/integrations/sales-erp";
import { ingestOfflineSalesErpCommands } from "@/lib/server/salesday-offline-sync";

export async function POST(request: Request) {
  return handleApi("api/salesday/sync/commands", async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(
      typeof body.actorId === "string" ? body.actorId : undefined,
    );
    try {
      return await ingestOfflineSalesErpCommands({
        actor,
        loginSessionId,
        deviceId: String(body.deviceId ?? ""),
        provider: String(body.provider ?? ""),
        items: body.items,
      });
    } catch (error) {
      rethrowSalesErpIngestError(error);
    }
  }, "Offline SalesDay-commando's konden niet duurzaam worden opgeslagen.");
}

function rethrowSalesErpIngestError(error: unknown): never {
  if (!(error instanceof SalesErpError)) throw error;
  const status = error.code === "PERMISSION_REVOKED"
    ? 403
    : error.retryable
      ? 503
      : error.code === "IDEMPOTENCY_CONFLICT"
        ? 409
        : 400;
  throw new ApiRequestError(error.message, status);
}
