import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  activateSalesDayEmergencyMode,
  deactivateSalesDayEmergencyMode,
  getOpenSalesDayEmergencyMode,
  SalesDayEmergencyModeError,
  toSalesDayEmergencyModeResponse,
} from "@/lib/server/salesday-emergency-mode";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/sync/emergency:get", async () => {
    const parameters = new URL(request.url).searchParams;
    await requireAuthenticatedUserContext(parameters.get("actorId"));
    return toSalesDayEmergencyModeResponse(await getOpenSalesDayEmergencyMode());
  }, "De SalesDay-noodmodus kon niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/salesday/sync/emergency:post", async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await requireAuthenticatedUserContext(
      typeof body.actorId === "string" ? body.actorId : undefined,
    );
    try {
      if (body.action === "ACTIVATE") {
        const result = await activateSalesDayEmergencyMode(actor, {
          reason: String(body.reason ?? ""),
          startsAt: String(body.startsAt ?? ""),
          endsAt: String(body.endsAt ?? ""),
        });
        return toSalesDayEmergencyModeResponse(result);
      }
      if (body.action === "DEACTIVATE") {
        const result = await deactivateSalesDayEmergencyMode(actor, {
          emergencyModeId: String(body.emergencyModeId ?? ""),
          reason: String(body.reason ?? ""),
        });
        return toSalesDayEmergencyModeResponse(result);
      }
      throw new SalesDayEmergencyModeError("INVALID_INPUT", "Ongeldige SalesDay-noodmodusactie.");
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De SalesDay-noodmodus kon niet worden gewijzigd.");
}
