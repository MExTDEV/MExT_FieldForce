import { badRequest, forbidden, notFound, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { canStartStarterEvaluationForRepresentative } from "@/lib/starter-evaluations";
import { sanitizeRichText } from "@/lib/rich-text";

const editableStatuses = new Set(["DUE", "PREPARATION", "READY_FOR_CONVERSATION", "IN_PROGRESS", "NOT_AGREED"]);
const textAnswerTypes = new Set(["SHORT_TEXT", "RICH_TEXT", "BOOLEAN", "NUMBER", "PERCENTAGE", "CURRENCY", "SCORE", "CHOICE", "MULTI_CHOICE", "DATE"]);

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
    const [leader, manualStartedBy, sections, answers] = await Promise.all([
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
      prisma.starterEvaluationAnswer.findMany({
        where: { evaluationId: evaluation.id },
        select: { questionSnapshotId: true, role: true, valueJson: true },
      }),
    ]);
    const answersByQuestion = new Map<string, Record<string, string>>();
    for (const answer of answers) {
      const parsed = parseAnswerValue(answer.valueJson);
      answersByQuestion.set(answer.questionSnapshotId, {
        ...(answersByQuestion.get(answer.questionSnapshotId) ?? {}),
        [answer.role]: parsed,
      });
    }
    const questions = await prisma.starterEvaluationQuestionSnapshot.findMany({
      where: { evaluationId: evaluation.id },
      select: {
        id: true,
        sectionSnapshotId: true,
        key: true,
        textNl: true,
        answerType: true,
        assignee: true,
        required: true,
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
            required: question.required,
            answers: answersByQuestion.get(question.id) ?? {},
          })),
        })),
      },
    };
  }, "Tussentijdse evaluatie kon niet worden geladen.");
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi("api/starter-evaluations/[id]:post", async () => {
    const { id } = await context.params;
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    const payload = await request.json() as {
      answers?: Array<{ questionId?: string; value?: string }>;
    };
    if (!Array.isArray(payload.answers)) badRequest("Geen antwoorden ontvangen.");

    const evaluation = await prisma.starterEvaluation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        representativeId: true,
        representative: {
          select: {
            id: true,
            representativeId: true,
            role: true,
            country: true,
            teamId: true,
          },
        },
      },
    });
    if (!evaluation) notFound("Tussentijdse evaluatie niet gevonden.");
    if (!editableStatuses.has(evaluation.status)) forbidden("Deze tussentijdse evaluatie kan niet meer aangepast worden.");

    const ownRepresentative = actor.role === "REPRESENTATIVE" &&
      [evaluation.representative.id, evaluation.representative.representativeId].includes(actor.representativeId ?? actor.id);
    const scopedManager = canStartStarterEvaluationForRepresentative(actor, evaluation.representative);
    if (!ownRepresentative && !scopedManager) notFound("Tussentijdse evaluatie niet gevonden.");

    const role = ownRepresentative ? "REPRESENTATIVE" : "EVALUATOR";
    const questionIds = [...new Set(payload.answers.map((answer) => answer.questionId).filter((value): value is string => Boolean(value)))];
    const questions = await prisma.starterEvaluationQuestionSnapshot.findMany({
      where: { evaluationId: evaluation.id, id: { in: questionIds } },
      select: { id: true, answerType: true, assignee: true },
    });
    const questionsById = new Map(questions.map((question) => [question.id, question]));

    await prisma.$transaction(async (tx) => {
      for (const answer of payload.answers ?? []) {
        if (!answer.questionId) continue;
        const question = questionsById.get(answer.questionId);
        if (!question || !canAnswerStarterQuestion(question.assignee, role) || !textAnswerTypes.has(question.answerType)) continue;
        const value = question.answerType === "RICH_TEXT"
          ? sanitizeRichText(answer.value ?? "")
          : String(answer.value ?? "");
        await tx.starterEvaluationAnswer.upsert({
          where: {
            questionSnapshotId_role: {
              questionSnapshotId: question.id,
              role,
            },
          },
          create: {
            evaluationId: evaluation.id,
            questionSnapshotId: question.id,
            role,
            valueJson: JSON.stringify({ value }),
            updatedById: actor.id,
          },
          update: {
            valueJson: JSON.stringify({ value }),
            updatedById: actor.id,
          },
        });
      }
    });

    return { ok: true };
  }, "Tussentijdse evaluatie kon niet worden opgeslagen.");
}

function parseAnswerValue(valueJson: string | null) {
  if (!valueJson) return "";
  try {
    const parsed = JSON.parse(valueJson) as { value?: unknown };
    return typeof parsed.value === "string" ? parsed.value : "";
  } catch {
    return "";
  }
}

function canAnswerStarterQuestion(assignee: string, role: "REPRESENTATIVE" | "EVALUATOR") {
  if (assignee === "BOTH_SEPARATE") return true;
  if (assignee === "REPRESENTATIVE") return role === "REPRESENTATIVE";
  if (assignee === "EVALUATOR" || assignee === "SHARED_EVALUATOR") return role === "EVALUATOR";
  return false;
}
