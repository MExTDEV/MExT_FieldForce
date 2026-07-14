import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { isAppModuleEnabled } from "@/lib/server/modules";
import {
  calculateStarterEvaluationMilestones,
  dateOnlyUtc,
  dueStarterEvaluationMoments,
  momentsJson,
  parseMomentsJson,
  scopeApplies,
  scopePriority,
  starterEvaluationModuleCode,
  starterEvaluationQuestionSeeds,
  starterEvaluationSectionSeeds,
  type StarterEvaluationMoment,
} from "@/lib/starter-evaluations";

export type StarterEvaluationGenerationResult = {
  checkedUsers: number;
  createdEvaluations: number;
  skippedMissingStartDate: number;
  skippedModuleDisabled: number;
  errors: { userId: string; message: string }[];
};

type StarterEvaluationUser = {
  id: string;
  country: "BE" | "NL" | "DE";
  teamId: string | null;
  starterStartDate: Date | null;
  representativeLevel: string;
  role: string;
  active: boolean;
  team: { primaryLeaderId: string | null } | null;
};

export async function ensureStarterEvaluationConfiguration(tx: Prisma.TransactionClient = prisma) {
  const sectionByCode = new Map<string, string>();
  for (const section of starterEvaluationSectionSeeds) {
    const stored = await tx.starterEvaluationSection.upsert({
      where: { code: section.code },
      create: {
        code: section.code,
        titleNl: section.titleNl,
        sortOrder: section.sortOrder,
        active: section.active ?? true,
        momentsJson: momentsJson(section.moments),
      },
      update: {
        titleNl: section.titleNl,
        sortOrder: section.sortOrder,
        momentsJson: momentsJson(section.moments),
      },
    });
    sectionByCode.set(section.code, stored.id);
  }

  for (const question of starterEvaluationQuestionSeeds) {
    const sectionId = sectionByCode.get(question.sectionCode);
    if (!sectionId) continue;
    await tx.starterEvaluationQuestion.upsert({
      where: { key: question.key },
      create: {
        key: question.key,
        sectionId,
        textNl: question.textNl,
        sortOrder: question.sortOrder,
        required: question.required ?? false,
        active: question.active ?? true,
        answerType: question.answerType,
        assignee: question.assignee,
        momentsJson: momentsJson(question.moments),
        scopeType: question.scopeType ?? "GLOBAL",
        scopeKey: question.scopeKey ?? "GLOBAL",
      },
      update: {
        sectionId,
        textNl: question.textNl,
        sortOrder: question.sortOrder,
        required: question.required ?? false,
        momentsJson: momentsJson(question.moments),
      },
    });
  }
}

export async function generateDueStarterEvaluations(referenceDate = new Date()): Promise<StarterEvaluationGenerationResult> {
  const moduleEnabled = await isAppModuleEnabled(starterEvaluationModuleCode);
  const result: StarterEvaluationGenerationResult = {
    checkedUsers: 0,
    createdEvaluations: 0,
    skippedMissingStartDate: 0,
    skippedModuleDisabled: 0,
    errors: [],
  };
  if (!moduleEnabled) {
    result.skippedModuleDisabled = 1;
    return result;
  }

  await ensureStarterEvaluationConfiguration();
  const starters = await prisma.user.findMany({
    where: {
      active: true,
      role: "REPRESENTATIVE",
      representativeLevel: "STARTER",
    },
    select: {
      id: true,
      country: true,
      teamId: true,
      starterStartDate: true,
      representativeLevel: true,
      role: true,
      active: true,
      team: { select: { primaryLeaderId: true } },
    },
  });

  for (const starter of starters) {
    result.checkedUsers += 1;
    try {
      if (!starter.starterStartDate) {
        result.skippedMissingStartDate += 1;
        continue;
      }
      const created = await ensureDueEvaluationsForStarter(starter, referenceDate);
      result.createdEvaluations += created;
    } catch (error) {
      result.errors.push({
        userId: starter.id,
        message: error instanceof Error ? error.message : "Onbekende fout.",
      });
    }
  }
  return result;
}

export async function ensureDueEvaluationsForStarter(
  starter: StarterEvaluationUser,
  referenceDate = new Date()
) {
  if (starter.role !== "REPRESENTATIVE" || starter.representativeLevel !== "STARTER" || !starter.active) {
    return 0;
  }
  if (!starter.starterStartDate) return 0;
  const dueMoments = dueStarterEvaluationMoments(starter.starterStartDate, referenceDate);
  if (!dueMoments.length) return 0;
  const milestones = calculateStarterEvaluationMilestones(starter.starterStartDate);
  let created = 0;
  for (const moment of dueMoments) {
    const wasCreated = await prisma.$transaction(async (tx) =>
      createEvaluationIfMissing(tx, starter, moment, milestones[moment])
    );
    if (wasCreated) created += 1;
  }
  return created;
}

async function createEvaluationIfMissing(
  tx: Prisma.TransactionClient,
  starter: StarterEvaluationUser,
  moment: StarterEvaluationMoment,
  milestoneDate: Date
) {
  const existing = await tx.starterEvaluation.findUnique({
    where: { representativeId_moment: { representativeId: starter.id, moment } },
    select: { id: true },
  });
  if (existing) return false;

  const countryManager = await tx.user.findFirst({
    where: {
      active: true,
      role: "COUNTRY_MANAGER",
      country: starter.country,
    },
    select: { id: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const evaluation = await tx.starterEvaluation.create({
    data: {
      representativeId: starter.id,
      moment,
      status: "DUE",
      milestoneDate: dateOnlyUtc(milestoneDate),
      starterStartDateSnapshot: dateOnlyUtc(starter.starterStartDate!),
      leaderId: starter.team?.primaryLeaderId ?? null,
      countryManagerId: moment === "MONTH_5" ? countryManager?.id ?? null : null,
      milestoneNotifiedAt: new Date(),
    },
  });

  await snapshotEvaluationForm(tx, evaluation.id, {
    country: starter.country,
    teamId: starter.teamId,
    userId: starter.id,
  }, moment);
  if (starter.team?.primaryLeaderId) {
    await tx.notificationDelivery.upsert({
      where: {
        eventKey_recipientUserId_channel: {
          eventKey: `STARTER_EVALUATION_DUE:${evaluation.id}`,
          recipientUserId: starter.team.primaryLeaderId,
          channel: "in_app",
        },
      },
      create: {
        eventKey: `STARTER_EVALUATION_DUE:${evaluation.id}`,
        recipientUserId: starter.team.primaryLeaderId,
        channel: "in_app",
        status: "unread",
        sourceModule: "TUSSENTIJDSE_EVALUATIES",
        entityType: "starterEvaluation",
        entityId: evaluation.id,
        mailTestActive: false,
        originalTo: starter.id,
      },
      update: { status: "unread", updatedAt: new Date() },
    });
  }
  return true;
}

async function snapshotEvaluationForm(
  tx: Prisma.TransactionClient,
  evaluationId: string,
  context: { country: "BE" | "NL" | "DE"; teamId: string | null; userId: string },
  moment: StarterEvaluationMoment
) {
  const sections = await tx.starterEvaluationSection.findMany({
    where: { active: true },
    include: { questions: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  for (const section of sections) {
    if (!parseMomentsJson(section.momentsJson).includes(moment)) continue;
    const applicableQuestions = dedupeApplicableQuestions(section.questions, context, moment);
    if (!applicableQuestions.length) continue;
    const sectionSnapshot = await tx.starterEvaluationSectionSnapshot.create({
      data: {
        evaluationId,
        sourceSectionId: section.id,
        code: section.code,
        titleNl: section.titleNl,
        titleFr: section.titleFr,
        titleDe: section.titleDe,
        descriptionNl: section.descriptionNl,
        descriptionFr: section.descriptionFr,
        descriptionDe: section.descriptionDe,
        sortOrder: section.sortOrder,
        momentsJson: section.momentsJson,
      },
    });
    for (const question of applicableQuestions) {
      await tx.starterEvaluationQuestionSnapshot.create({
        data: {
          evaluationId,
          sectionSnapshotId: sectionSnapshot.id,
          sourceQuestionId: question.id,
          key: question.key,
          textNl: question.textNl,
          textFr: question.textFr,
          textDe: question.textDe,
          helpNl: question.helpNl,
          helpFr: question.helpFr,
          helpDe: question.helpDe,
          sortOrder: question.sortOrder,
          required: question.required,
          answerType: question.answerType,
          assignee: question.assignee,
          momentsJson: question.momentsJson,
          appliedScopeType: question.scopeType,
          appliedScopeKey: question.scopeKey,
          linkedCriterionType: question.linkedCriterionType,
          linkedCriterionId: question.linkedCriterionId,
        },
      });
    }
  }
}

function dedupeApplicableQuestions<
  T extends {
    key: string;
    scopeType: "GLOBAL" | "COUNTRY" | "TEAM" | "USER";
    scopeKey: string;
    momentsJson: string;
  }
>(
  questions: T[],
  context: { country: "BE" | "NL" | "DE"; teamId: string | null; userId: string },
  moment: StarterEvaluationMoment
) {
  const byKey = new Map<string, T>();
  for (const question of questions) {
    if (!parseMomentsJson(question.momentsJson).includes(moment)) continue;
    if (!scopeApplies(question, context)) continue;
    const current = byKey.get(question.key);
    if (!current || scopePriority(question.scopeType) > scopePriority(current.scopeType)) {
      byKey.set(question.key, question);
    }
  }
  return [...byKey.values()].sort((a, b) => ("sortOrder" in a && "sortOrder" in b ? Number(a.sortOrder) - Number(b.sortOrder) : 0));
}
