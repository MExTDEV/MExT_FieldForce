import { badRequest, forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser, requirePermission } from "@/lib/server/authenticated-user";
import { closeActionPoint } from "@/lib/server/action-points";
import { isAppModuleEnabled } from "@/lib/server/modules";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi("api/action-points:close", async () => {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const closedReason = typeof body.closedReason === "string" ? body.closedReason : "";
    const closedReasonExplanation = typeof body.closedReasonExplanation === "string" ? body.closedReasonExplanation : "";
    if (!closedReason) badRequest("Kies een reden om het actiepunt af te sluiten.");
    const actor = await requireAuthenticatedUser(String(body.actorId ?? ""));
    requirePermission(actor, "modulePreparation");
    requirePermission(actor, "menu.coaching.actionPoints");
    requirePermission(actor, "actionPointsClose");
    if (!(await isAppModuleEnabled("ACTIEPUNTEN"))) {
      forbidden("Actiepuntenmodule is niet actief.");
    }
    return {
      actionPoint: await closeActionPoint(actor, {
        actionPointId: id,
        representativeId: body.representativeId ? String(body.representativeId) : undefined,
        closedReason,
        closedReasonExplanation,
      }),
    };
  }, "Actiepunt kon niet worden gesloten.");
}
