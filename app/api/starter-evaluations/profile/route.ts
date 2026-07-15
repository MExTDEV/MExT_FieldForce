import { handleApi, notFound } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { canStartStarterEvaluationForRepresentative, starterEvaluationHref } from "@/lib/starter-evaluations";

export async function GET(request: Request) {
  return handleApi("api/starter-evaluations/profile:get", async () => {
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    const representativeId = url.searchParams.get("representativeId")?.trim();
    if (!representativeId) notFound("Vertegenwoordiger niet gevonden.");

    const representative = await prisma.user.findFirst({
      where: {
        active: true,
        role: "REPRESENTATIVE",
        OR: [
          { id: representativeId },
          { representativeId },
        ],
      },
      select: {
        id: true,
        representativeId: true,
        role: true,
        country: true,
        teamId: true,
      },
    });
    if (!representative) notFound("Vertegenwoordiger niet gevonden.");

    const ownRepresentative = actor.role === "REPRESENTATIVE" &&
      [representative.id, representative.representativeId].includes(actor.representativeId ?? actor.id);
    const scopedManager = canStartStarterEvaluationForRepresentative(actor, representative);
    if (!ownRepresentative && !scopedManager) notFound("Tussentijdse evaluaties niet gevonden.");

    const evaluations = await prisma.starterEvaluation.findMany({
      where: { representativeId: representative.id },
      select: {
        id: true,
        moment: true,
        status: true,
        milestoneDate: true,
        approvedAt: true,
        leader: { select: { firstName: true, lastName: true } },
        manualStartedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ milestoneDate: "desc" }, { createdAt: "desc" }],
    });

    return {
      evaluations: evaluations.map((evaluation) => ({
        id: evaluation.id,
        href: starterEvaluationHref(evaluation.id),
        moment: evaluation.moment,
        status: evaluation.status,
        evaluationDate: evaluation.milestoneDate.toISOString().slice(0, 10),
        approvedAt: evaluation.approvedAt?.toISOString().slice(0, 10) ?? "",
        leaderName: evaluation.leader ? `${evaluation.leader.firstName} ${evaluation.leader.lastName}`.trim() : "",
        startedByName: evaluation.manualStartedBy ? `${evaluation.manualStartedBy.firstName} ${evaluation.manualStartedBy.lastName}`.trim() : "",
      })),
    };
  }, "Tussentijdse evaluaties konden niet worden geladen.");
}
