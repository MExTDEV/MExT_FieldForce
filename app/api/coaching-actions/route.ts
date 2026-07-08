import { forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser, requireCoachingParticipantScope, requirePermission } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { listEffectiveActionDefinitions } from "@/lib/server/action-definitions";
import { isAppModuleEnabled } from "@/lib/server/modules";

export async function GET(request: Request) {
  return handleApi("api/coaching-actions:get", async () => {
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    requirePermission(actor, "modulePreparation");
    if (!(await isAppModuleEnabled("ACTIEPUNTEN"))) {
      forbidden("Actiepuntenmodule is niet actief.");
    }
    const participantId = url.searchParams.get("participantId") ?? "";
    const date = new Date(`${url.searchParams.get("date") ?? ""}T12:00:00.000Z`);
    await requireCoachingParticipantScope(actor, [participantId]);
    const participant = await prisma.user.findFirstOrThrow({ where: { OR: [{ id: participantId }, { representativeId: participantId }] }, select: { id: true } });
    return { actions: await listEffectiveActionDefinitions(participant.id, date) };
  }, "Actiepunten konden niet worden geladen.");
}
