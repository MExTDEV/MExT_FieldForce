import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden } from "@/lib/server/api";
import { isAppModuleEnabled } from "@/lib/server/modules";
import {
  canStartStarterEvaluation,
  canStartStarterEvaluationForRepresentative,
  calculateStarterEvaluationMilestones,
  dateOnlyUtc,
  dueStarterEvaluationMoments,
  parseStarterEvaluationDateInput,
  momentsJson,
  parseMomentsJson,
  scopeApplies,
  scopePriority,
  starterEvaluationModuleCode,
  starterEvaluationHref,
  starterEvaluationQuestionSeeds,
  starterEvaluationSectionSeeds,
  type StarterEvaluationMoment,
} from "@/lib/starter-evaluations";
import type { Country, MockUser } from "@/lib/types";

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

export class StarterEvaluationDuplicateError extends Error {
  existingEvaluationId: string;
  href: string;

  constructor(existingEvaluationId: string) {
    super("Er bestaat al een actieve tussentijdse evaluatie voor deze vertegenwoordiger op deze evaluatiedatum.");
    this.name = "StarterEvaluationDuplicateError";
    this.existingEvaluationId = existingEvaluationId;
    this.href = starterEvaluationHref(existingEvaluationId);
  }
}

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
    const storedQuestion = await tx.starterEvaluationQuestion.upsert({
      where: { key: question.key },
      create: {
        key: question.key,
        sectionId,
        textNl: question.textNl,
        sortOrder: question.sortOrder,
        required: question.required ?? false,
        active: question.active ?? true,
        answerType: question.answerType,
        optionsJson: question.options ? JSON.stringify(question.options) : null,
        assignee: question.assignee,
        momentsJson: momentsJson(question.moments),
        scopeType: question.scopeType ?? "GLOBAL",
        scopeKey: question.scopeKey ?? "GLOBAL",
      } as unknown as Prisma.StarterEvaluationQuestionUncheckedCreateInput,
      update: {
        sectionId,
        textNl: question.textNl,
        sortOrder: question.sortOrder,
        required: question.required ?? false,
        momentsJson: momentsJson(question.moments),
      },
    });
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO \`StarterEvaluationQuestionScopeLink\`
        (\`id\`, \`questionId\`, \`scopeType\`, \`scopeKey\`, \`country\`, \`teamId\`, \`userId\`, \`sortOrder\`, \`createdAt\`, \`updatedAt\`)
      VALUES
        (${createStarterEvaluationId("seqs")}, ${storedQuestion.id}, ${question.scopeType ?? "GLOBAL"}, ${question.scopeKey ?? "GLOBAL"}, ${question.scopeType === "COUNTRY" ? parseCountryScope(question.scopeKey) : null}, ${question.scopeType === "TEAM" ? parseEntityScope(question.scopeKey, "TEAM") : null}, ${question.scopeType === "USER" ? parseEntityScope(question.scopeKey, "USER") : null}, ${question.sortOrder}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        \`sortOrder\` = VALUES(\`sortOrder\`),
        \`updatedAt\` = CURRENT_TIMESTAMP(3)
    `);
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

export async function listManualStarterEvaluationCandidates(actor: MockUser) {
  if (!canStartStarterEvaluation(actor)) return [];
  return searchManualStarterEvaluationCandidates(actor, "");
}

export async function searchManualStarterEvaluationCandidates(actor: MockUser, query: string, limit = 50) {
  if (!canStartStarterEvaluation(actor)) return [];
  const normalizedQuery = normalizeCandidateSearchValue(query);
  const resultLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 50;
  const representatives = await prisma.user.findMany({
    where: {
      active: true,
      role: "REPRESENTATIVE",
    },
    select: {
      id: true,
      representativeId: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      role: true,
      country: true,
      teamId: true,
      starterStartDate: true,
      representativeLevel: true,
      team: { select: { name: true, primaryLeaderId: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return representatives
    .filter((representative) => canStartStarterEvaluationForRepresentative(actor, representative))
    .filter((representative) => {
      if (!normalizedQuery) return true;
      const haystack = normalizeCandidateSearchValue([
        representative.firstName,
        representative.lastName,
        `${representative.firstName} ${representative.lastName}`,
        representative.email,
        representative.representativeId ?? "",
        representative.representativeLevel,
        representative.country,
        representative.team?.name ?? "",
      ].join(" "));
      return haystack.includes(normalizedQuery);
    })
    .slice(0, resultLimit)
    .map((representative) => ({
      id: representative.id,
      name: `${representative.firstName} ${representative.lastName}`.trim(),
      email: representative.email,
      initials: `${representative.firstName[0] ?? ""}${representative.lastName[0] ?? ""}`.toUpperCase(),
      avatarUrl: representative.avatarUrl ?? "",
      representativeId: representative.representativeId ?? "",
      representativeLevel: representative.representativeLevel,
      country: representative.country,
      teamId: representative.teamId,
      teamName: representative.team?.name ?? "",
      starterStartDate: representative.starterStartDate?.toISOString().slice(0, 10) ?? "",
    }));
}

export async function createManualStarterEvaluation(input: {
  actor: MockUser;
  representativeId: string;
  evaluationDate: string;
}) {
  const moduleEnabled = await isAppModuleEnabled(starterEvaluationModuleCode);
  if (!moduleEnabled) badRequest("De module Tussentijdse evaluaties is niet actief.");
  if (!canStartStarterEvaluation(input.actor)) forbidden("Je mag geen tussentijdse evaluatie starten.");
  const evaluationDate = parseStarterEvaluationDateInput(input.evaluationDate);
  const representative = await prisma.user.findFirst({
    where: {
      id: input.representativeId,
      active: true,
      role: "REPRESENTATIVE",
    },
    select: {
      id: true,
      representativeId: true,
      firstName: true,
      lastName: true,
      role: true,
      country: true,
      teamId: true,
      starterStartDate: true,
      representativeLevel: true,
      team: { select: { name: true, primaryLeaderId: true } },
    },
  });
  if (!representative) badRequest("Selecteer een geldige vertegenwoordiger.");
  if (!canStartStarterEvaluationForRepresentative(input.actor, representative)) {
    forbidden("Deze vertegenwoordiger valt buiten je toegestane scope.");
  }

  await ensureStarterEvaluationConfiguration();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.starterEvaluation.findFirst({
      where: {
        representativeId: representative.id,
        milestoneDate: evaluationDate,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (existing) throw new StarterEvaluationDuplicateError(existing.id);

    const moment = inferMomentFromEvaluationDate(representative.starterStartDate, evaluationDate);
    const countryManager = await tx.user.findFirst({
      where: { active: true, role: "COUNTRY_MANAGER", country: representative.country },
      select: { id: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const kpiSnapshot = await snapshotApplicableStarterEvaluationKpis(tx, {
      country: representative.country,
      teamId: representative.teamId,
      userId: representative.id,
      evaluationDate,
    });
    const evaluationData = {
      representativeId: representative.id,
      moment,
      status: "PREPARATION",
      milestoneDate: evaluationDate,
      starterStartDateSnapshot: dateOnlyUtc(representative.starterStartDate ?? evaluationDate),
      leaderId: representative.team?.primaryLeaderId ?? (input.actor.role === "SALES_LEADER" ? input.actor.id : null),
      countryManagerId: moment === "MONTH_5" ? countryManager?.id ?? null : null,
      manualStartedById: input.actor.id,
      manualStartedAt: new Date(),
      preparationOpenedAt: new Date(),
      kpiSnapshotJson: JSON.stringify(kpiSnapshot),
    };
    const evaluation = await tx.starterEvaluation.create({
      data: evaluationData as unknown as Prisma.StarterEvaluationUncheckedCreateInput,
    });
    await snapshotEvaluationForm(tx, evaluation.id, {
      country: representative.country,
      teamId: representative.teamId,
      userId: representative.id,
    }, moment);
    return {
      evaluation: {
        id: evaluation.id,
        href: starterEvaluationHref(evaluation.id),
        representativeName: `${representative.firstName} ${representative.lastName}`.trim(),
        evaluationDate: evaluation.milestoneDate.toISOString().slice(0, 10),
      },
      duplicate: false as const,
    };
  });
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
  moment: StarterEvaluationMoment | null
) {
  const sections = await tx.starterEvaluationSection.findMany({
    where: { active: true },
    include: {
      questions: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
  const questionIds = sections.flatMap((section) => section.questions.map((question) => question.id));
  const scopeLinks = questionIds.length
    ? await tx.$queryRaw<{ questionId: string; scopeType: "GLOBAL" | "COUNTRY" | "TEAM" | "USER"; scopeKey: string; sortOrder: number }[]>(Prisma.sql`
        SELECT \`questionId\`, \`scopeType\`, \`scopeKey\`, \`sortOrder\`
        FROM \`StarterEvaluationQuestionScopeLink\`
        WHERE \`questionId\` IN (${Prisma.join(questionIds)})
      `)
    : [];
  const linksByQuestion = new Map<string, typeof scopeLinks>();
  for (const link of scopeLinks) {
    linksByQuestion.set(link.questionId, [...(linksByQuestion.get(link.questionId) ?? []), link]);
  }
  for (const section of sections) {
    if (moment && !parseMomentsJson(section.momentsJson).includes(moment)) continue;
    const applicableQuestions = dedupeApplicableQuestions(
      section.questions.map((question) => ({ ...question, scopeLinks: linksByQuestion.get(question.id) ?? [] })),
      context,
      moment
    );
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
      const questionSnapshotData = {
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
            optionsJson: (question as { optionsJson?: string | null }).optionsJson ?? null,
            assignee: question.assignee,
          momentsJson: question.momentsJson,
          appliedScopeType: question.scopeType,
          appliedScopeKey: question.scopeKey,
          linkedCriterionType: question.linkedCriterionType,
          linkedCriterionId: question.linkedCriterionId,
        };
      await tx.starterEvaluationQuestionSnapshot.create({
        data: questionSnapshotData as unknown as Prisma.StarterEvaluationQuestionSnapshotUncheckedCreateInput,
      });
    }
  }
}

function dedupeApplicableQuestions<
  T extends {
    id: string;
    key: string;
    textNl: string;
    textFr: string | null;
    textDe: string | null;
    helpNl: string | null;
    helpFr: string | null;
    helpDe: string | null;
    sortOrder: number;
    required: boolean;
    answerType: string;
    optionsJson?: string | null;
    assignee: string;
    linkedCriterionType: string | null;
    linkedCriterionId: string | null;
    scopeType: "GLOBAL" | "COUNTRY" | "TEAM" | "USER";
    scopeKey: string;
    momentsJson: string;
    scopeLinks?: { scopeType: "GLOBAL" | "COUNTRY" | "TEAM" | "USER"; scopeKey: string; sortOrder: number }[];
  }
>(
  questions: T[],
  context: { country: "BE" | "NL" | "DE"; teamId: string | null; userId: string },
  moment: StarterEvaluationMoment | null
) {
  const byKey = new Map<string, T>();
  for (const question of questions) {
    if (moment && !parseMomentsJson(question.momentsJson).includes(moment)) continue;
    const matchingLinks = (question.scopeLinks?.length ? question.scopeLinks : [question])
      .filter((link) => scopeApplies(link, context));
    if (!matchingLinks.length) continue;
    const current = byKey.get(question.key);
    if (!current) {
      const bestLink = matchingLinks.sort((a, b) =>
        scopePriority(b.scopeType) - scopePriority(a.scopeType) ||
        Number("sortOrder" in a ? a.sortOrder : question.sortOrder) - Number("sortOrder" in b ? b.sortOrder : question.sortOrder)
      )[0];
      byKey.set(question.key, {
        ...question,
        scopeType: bestLink.scopeType,
        scopeKey: bestLink.scopeKey,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => ("sortOrder" in a && "sortOrder" in b ? Number(a.sortOrder) - Number(b.sortOrder) : 0));
}

function parseCountryScope(scopeKey: string | undefined) {
  const value = parseEntityScope(scopeKey, "COUNTRY");
  return value === "BE" || value === "NL" || value === "DE" ? value : null;
}

function parseEntityScope(scopeKey: string | undefined, prefix: string) {
  const raw = scopeKey ?? "";
  return raw.startsWith(`${prefix}:`) ? raw.slice(prefix.length + 1) : null;
}

function createStarterEvaluationId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function snapshotApplicableStarterEvaluationKpis(
  tx: Prisma.TransactionClient,
  context: { country: Country; teamId: string | null; userId: string; evaluationDate: Date }
) {
  const kpis = await tx.kpiDefinition.findMany({
    where: {
      active: true,
      includeInStarterEvaluations: true,
      validFrom: { lte: context.evaluationDate },
      OR: [{ validUntil: null }, { validUntil: { gte: context.evaluationDate } }],
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      country: true,
      teamId: true,
      userId: true,
      targetRole: true,
      unit: true,
      targetValue: true,
      minValue: true,
      maxValue: true,
      weight: true,
      sortOrder: true,
      evaluationDirection: true,
      validFrom: true,
      validUntil: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return kpis
    .filter((kpi) => {
      if (kpi.userId) return kpi.userId === context.userId;
      if (kpi.teamId) return kpi.teamId === context.teamId;
      if (kpi.country) return kpi.country === context.country;
      if (kpi.targetRole) return kpi.targetRole === "REPRESENTATIVE";
      return true;
    })
    .map((kpi) => ({
      ...kpi,
      targetValue: kpi.targetValue.toString(),
      minValue: kpi.minValue?.toString() ?? null,
      maxValue: kpi.maxValue?.toString() ?? null,
      weight: kpi.weight?.toString() ?? null,
      validFrom: kpi.validFrom.toISOString().slice(0, 10),
      validUntil: kpi.validUntil?.toISOString().slice(0, 10) ?? null,
    }));
}

function inferMomentFromEvaluationDate(startDate: Date | null, evaluationDate: Date): StarterEvaluationMoment | null {
  if (!startDate) return null;
  const milestones = calculateStarterEvaluationMilestones(startDate);
  const iso = evaluationDate.toISOString().slice(0, 10);
  const match = (Object.entries(milestones) as [StarterEvaluationMoment, Date][])
    .find(([, date]) => date.toISOString().slice(0, 10) === iso);
  return match?.[0] ?? null;
}

function normalizeCandidateSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
