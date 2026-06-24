import { appModuleRegistry } from "@/lib/modules";
import { setAppModuleEnabled } from "@/lib/server/modules";
import { badRequest, handleApi, notFound } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import type { AppModuleCode } from "@/lib/types";
import { requireAuthenticatedUser, requireRole } from "@/lib/server/authenticated-user";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  return handleApi("api/modules/:code:patch", async () => {
    const { code } = await params;
    const normalizedCode = code.toUpperCase() as AppModuleCode;
    if (!appModuleRegistry.some((module) => module.code === normalizedCode)) {
      notFound("Onbekende module.");
    }

    const body = (await request.json()) as { actorId?: string; enabled?: unknown };
    if (typeof body.enabled !== "boolean") {
      badRequest("Ongeldige modulewaarde.");
    }
    const enabled = body.enabled;
    const actor = await requireAuthenticatedUser(body.actorId);
    requireRole(actor, ["SUPER_ADMIN"]);

    const appModule = await setAppModuleEnabled(normalizedCode, enabled);
    await writeAuditLog({
      actorId: actor.id,
      entityType: "AppModule",
      entityId: appModule.id,
      action: "module.update",
      newValue: { code: appModule.code, enabled: appModule.enabled },
    });
    return { module: appModule };
  }, "Module kon niet worden opgeslagen.");
}
