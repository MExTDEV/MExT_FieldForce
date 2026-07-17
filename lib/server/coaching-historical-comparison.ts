import type { InterventionStatus, Prisma } from "@prisma/client";

import {
  buildHistoricalComparisonOptions,
  historicalScoreKey,
  type HistoricalComparisonCandidate,
  type HistoricalComparisonResponse,
  type HistoricalScoreReference,
  type HistoricalScoreValue,
} from "@/lib/coaching/historical-comparison";
import { forbidden, notFound } from "@/lib/server/api";
import { buildCoachingVisibilityFilter, buildOpenableCoachingWhere } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import {
  criterionScoresFromRows,
  mergeCriterionScores,
  normalizePerformanceScore,
  splitCriterionLabel,
} from "@/lib/performance-data";
import type { HistoricalCoaching, PerformanceDimension } from "@/lib/performance-data";
import type { MockUser, Status } from "@/lib/types";

export const historicalStatuses: InterventionStatus[] = [
  "AKKOORD_DOOR_VERTEGENWOORDIGER",
  "AFGESLOTEN",
  "GEFINALISEERD",
  "GESLOTEN",
  "VOLTOOID",
];

export const historicalInterventionInclude = {
  owner: { select: { firstName: true, lastName: true } },
  representative: { select: { representativeId: true } },
  focuses: { include: { focus: true } },
  criterionSnapshots: true,
  scores: {
    include: {
      criterion: { include: { focus: true } },
      personalCriterion: true,
      criterionSnapshot: true,
    },
  },
  coachingDetail: {
    include: {
      appointments: {
        where: { deletedAt: null },
        include: { scoreRows: true },
      },
    },
  },
} as const satisfies Prisma.InterventionInclude;

export type HistoricalIntervention = Prisma.InterventionGetPayload<{
  include: typeof historicalInterventionInclude;
}>;

export async function loadHistoricalScoreComparison(input: {
  actor: MockUser;
  currentId: string;
  compareId?: string | null;
}): Promise<HistoricalComparisonResponse> {
  const current = await prisma.intervention.findFirst({
    where: buildOpenableCoachingWhere(input.actor, { id: input.currentId }),
    select: {
      id: true,
      representativeId: true,
      representative: { select: { representativeId: true } },
      plannedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!current) notFound("Begeleiding niet gevonden.");

  const currentDate = dateOnly(current.plannedAt ?? current.createdAt ?? current.updatedAt);
  const today = dateOnly(new Date());
  const rows = await prisma.intervention.findMany({
    where: {
      AND: [
        buildCoachingVisibilityFilter(input.actor),
        {
          type: "BEGELEIDING",
          deletedAt: null,
          representativeId: current.representativeId,
          id: { not: current.id },
          status: { in: historicalStatuses },
        },
      ],
    },
    include: historicalInterventionInclude,
    orderBy: [{ plannedAt: "desc" }, { completedAt: "desc" }, { updatedAt: "desc" }],
  });

  const candidates = rows
    .map(toHistoricalCandidate)
    .filter((candidate) => candidate.date <= today);
  const options = buildHistoricalComparisonOptions({
    currentId: current.id,
    representativeId: publicRepresentativeId(current.representativeId, current.representative.representativeId),
    currentDate,
    candidates,
  });

  if (!options.length || input.compareId === "none") {
    return { options };
  }

  const selectedId = input.compareId ?? options[0]?.id;
  const selectedOption = options.find((option) => option.id === selectedId);
  if (!selectedOption) {
    forbidden("Je hebt geen toegang tot deze historische begeleiding of ze bevat geen bruikbare scoregegevens.");
  }

  const selectedRow = rows.find((row) => row.id === selectedOption.id);
  if (!selectedRow) {
    forbidden("Je hebt geen toegang tot deze historische begeleiding of ze bevat geen bruikbare scoregegevens.");
  }

  return {
    options,
    selectedId: selectedOption.id,
    selected: {
      ...selectedOption,
      scores: buildScoreReferences(selectedRow),
      history: toHistoricalCoaching(selectedRow),
    },
  };
}

function toHistoricalCandidate(row: HistoricalIntervention): HistoricalComparisonCandidate {
  return {
    id: row.id,
    representativeId: publicRepresentativeId(row.representativeId, row.representative.representativeId),
    date: dateOnly(row.plannedAt ?? row.completedAt ?? row.finalizedAt ?? row.updatedAt),
    ownerName: fullName(row.owner),
    status: row.status,
    scores: buildScoreReferences(row),
  };
}

function buildScoreReferences(row: HistoricalIntervention): HistoricalScoreReference[] {
  const grouped = new Map<string, { label: string; values: number[] }>();

  for (const score of row.scores) {
    if (score.score === null || score.notApplicable || !isFivePointScore(score.score)) continue;
    const label = score.label ?? score.criterion?.name ?? score.personalCriterion?.title ?? "Criterium";
    const category = score.category ?? score.criterion?.focus.name ?? score.personalCriterion?.focusName ?? "Algemeen";
    addScore(grouped, historicalScoreKey(category, label), label, score.score);
  }

  for (const appointment of row.coachingDetail?.appointments ?? []) {
    for (const score of appointment.scoreRows) {
      if (score.score === null || score.notApplicable || !isFivePointScore(score.score)) continue;
      const { focus, criterion } = splitCriterionLabel(score.criterion);
      addScore(grouped, historicalScoreKey(focus, criterion), criterion, score.score);
    }
  }

  return [...grouped.entries()].map(([key, value]) => ({
    key,
    label: value.label,
    score: Math.round(average(value.values)) as HistoricalScoreValue,
  }));
}

export function toHistoricalCoaching(row: HistoricalIntervention): HistoricalCoaching {
  const scoreRows = row.scores.flatMap((score) =>
    score.score === null || score.notApplicable ? [] : [{ ...score, score: score.score }]
  );
  const storedCriterionScores = scoreRows
    .filter((score) => score.category && !score.category.startsWith("Dossier:"))
    .map((score) => ({
      focus: score.category ?? score.criterion?.focus.name ?? score.personalCriterion?.focusName ?? "Algemeen",
      criterion: score.label ?? score.criterion?.name ?? score.personalCriterion?.title ?? "Criterium",
      score: normalizePerformanceScore(score.score),
      scored: true,
    }));
  const appointmentCriterionScores = criterionScoresFromRows(
    (row.coachingDetail?.appointments ?? []).flatMap((appointment) =>
      appointment.scoreRows.map((score) => ({
        criterion: score.criterion,
        score: score.score,
        notApplicable: score.notApplicable,
      }))
    )
  );
  const criterionScores = mergeCriterionScores(appointmentCriterionScores, storedCriterionScores);
  const phaseScores = averageByLabel(criterionScores
    .filter((score) => score.scored !== false)
    .map((score) => ({ label: score.focus, score: score.score })));
  const generalScores = scoreRows
    .filter((score) => score.category === "Dossier:Algemeen" || score.category === "Dossier:Persoonlijkheid")
    .map((score) => ({
      label: score.label ?? score.criterion?.name ?? score.personalCriterion?.title ?? "Criterium",
      score: normalizePerformanceScore(score.score),
    }));
  const dossierValues = scoreRows
    .filter((score) => score.category?.startsWith("Dossier:"))
    .map((score) => normalizePerformanceScore(score.score));
  const appointmentAverages = (row.coachingDetail?.appointments ?? []).flatMap((appointment) => {
    const values = appointment.scoreRows.flatMap((score) =>
      score.score === null || score.notApplicable ? [] : [normalizePerformanceScore(score.score)]
    );
    return values.length ? [average(values)] : [];
  });
  const appointmentScore = appointmentAverages.length ? average(appointmentAverages) : undefined;
  const dossierScore = dossierValues.length ? average(dossierValues) : undefined;
  const overallScore = appointmentScore === undefined && dossierScore === undefined
    ? undefined
    : appointmentScore === undefined
      ? dossierScore
      : dossierScore === undefined
        ? appointmentScore
        : (appointmentScore * 0.8) + (dossierScore * 0.2);

  return {
    id: row.id,
    representativeId: publicRepresentativeId(row.representativeId, row.representative.representativeId),
    date: dateOnly(row.plannedAt ?? row.completedAt ?? row.finalizedAt ?? row.updatedAt),
    ownerId: row.ownerId,
    ownerName: fullName(row.owner),
    status: row.status.toLowerCase() as Status,
    overallScore,
    focusNames: [...new Set([
      ...row.focuses.map((focus) => focus.focus.name),
      ...criterionScores.map((score) => score.focus),
    ])],
    phaseScores: phaseScores.length
      ? phaseScores
      : overallScore !== undefined
        ? [{ label: "Algemene begeleiding", score: Math.round(overallScore) }]
        : [],
    generalScores,
    criterionScores,
  };
}

function addScore(grouped: Map<string, { label: string; values: number[] }>, key: string, label: string, score: HistoricalScoreValue) {
  const current = grouped.get(key) ?? { label, values: [] };
  current.values.push(score);
  grouped.set(key, current);
}

function isFivePointScore(value: number): value is HistoricalScoreValue {
  return [0, 1, 2, 3, 4, 5].includes(value);
}

function averageByLabel(items: { label: string; score: number }[]): PerformanceDimension[] {
  const grouped = new Map<string, number[]>();
  for (const item of items) {
    const current = grouped.get(item.label) ?? [];
    current.push(item.score);
    grouped.set(item.label, current);
  }
  return [...grouped.entries()].map(([label, values]) => ({
    label,
    score: Math.round(average(values)),
  }));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function publicRepresentativeId(representativeId: string, publicId?: string | null) {
  return publicId ?? representativeId;
}

function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
