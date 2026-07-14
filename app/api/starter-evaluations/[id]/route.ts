import { notFound, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { canStartStarterEvaluationForRepresentative } from "@/lib/starter-evaluations";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi("api/starter-evaluations/[id]:get", async () => {
    const { id } = await context.params;
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    const evaluation = await prisma.starterEvaluation.findUnique({
      where: { id },
      select: {
        id: true,
        representativeId: true,
        status: true,
        moment: true,
        milestoneDate: true,
        leaderId: true,
        manualStartedById: true,
      },
    });
    if (!evaluation) notFound("Tussentijdse evaluatie niet gevonden.");
    const representative = await prisma.user.findUnique({
      where: { id: evaluation.representativeId },
      select: {
        id: true,
        representativeId: true,
        firstName: true,
        lastName: true,
        role: true,
        country: true,
        teamId: true,
        team: { select: { name: true } },
      },
    });
    if (!representative) notFound("Tussentijdse evaluatie niet gevonden.");
    const ownRepresentative = actor.role === "REPRESENTATIVE" &&
      [representative.id, representative.representativeId].includes(actor.representativeId ?? actor.id);
    const scopedManager = canStartStarterEvaluationForRepresentative(actor, representative);
    if (!ownRepresentative && !scopedManager) notFound("Tussentijdse evaluatie niet gevonden.");
    const [leader, manualStartedBy, sections] = await Promise.all([
      evaluation.leaderId
        ? prisma.user.findUnique({ where: { id: evaluation.leaderId }, select: { firstName: true, lastName: true } })
        : null,
      evaluation.manualStartedById
        ? prisma.user.findUnique({ where: { id: evaluation.manualStartedById }, select: { firstName: true, lastName: true } })
        : null,
      prisma.starterEvaluationSectionSnapshot.findMany({
        where: { evaluationId: evaluation.id },
        select: { id: true, titleNl: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);
    const questions = await prisma.starterEvaluationQuestionSnapshot.findMany({
      where: { evaluationId: evaluation.id },
      select: {
        id: true,
        sectionSnapshotId: true,
        key: true,
        textNl: true,
        answerType: true,
        assignee: true,
        sortOrder: true,
      },
      orderBy: [{ sectionSnapshotId: "asc" }, { sortOrder: "asc" }],
    });
    const questionsBySection = new Map<string, typeof questions>();
    for (const question of questions) {
      questionsBySection.set(question.sectionSnapshotId, [
        ...(questionsBySection.get(question.sectionSnapshotId) ?? []),
        question,
      ]);
    }
    return {
      evaluation: {
        id: evaluation.id,
        status: evaluation.status,
        moment: evaluation.moment,
        evaluationDate: evaluation.milestoneDate.toISOString().slice(0, 10),
        representativeName: `${representative.firstName} ${representative.lastName}`.trim(),
        teamName: representative.team?.name ?? "",
        country: representative.country,
        leaderName: leader ? `${leader.firstName} ${leader.lastName}`.trim() : "",
        manualStartedByName: manualStartedBy ? `${manualStartedBy.firstName} ${manualStartedBy.lastName}`.trim() : "",
        sections: sections.map((section) => ({
          id: section.id,
          title: section.titleNl,
          questions: (questionsBySection.get(section.id) ?? []).map((question) => ({
            id: question.id,
            key: question.key,
            text: question.textNl,
            answerType: question.answerType,
            assignee: question.assignee,
          })),
        })),
      },
    };
  }, "Tussentijdse evaluatie kon niet worden geladen.");
}
