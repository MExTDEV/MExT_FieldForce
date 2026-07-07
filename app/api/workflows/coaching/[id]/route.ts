import { handleApi, notFound } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { buildOpenableCoachingWhere } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/coaching/detail", async () => {
    const { id } = await context.params;
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const where = buildOpenableCoachingWhere(actor, { id });

    // Authoriseer eerst uitsluitend op de begeleiding zelf. Relaties worden pas
    // daarna geladen, zodat een directe URL nooit detaildata kan lekken.
    const visible = await prisma.intervention.findFirst({
      where,
      select: { id: true },
    });
    if (!visible) notFound("Begeleiding niet gevonden.");

    const state = await loadWorkflowStateFromDatabase({ interventionWhere: where });
    const intervention = state.interventions.find((item) => item.id === id);
    if (!intervention) notFound("Begeleiding niet gevonden.");
    return { intervention };
  }, "Begeleiding kon niet worden geladen.");
}
