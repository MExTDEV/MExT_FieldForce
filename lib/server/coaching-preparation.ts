import {
  buildPreparationReferenceOptions,
  resolvePreparationReferenceId,
  type PreparationReferenceCandidate,
  type PreparationReferenceDetail,
  type PreparationReferenceResponse,
  type PreparationScoreGroup,
  type PreparationScoreRow,
} from "@/lib/coaching/preparation-reference";
import { forbidden, notFound } from "@/lib/server/api";
import { requireCoachingParticipantScope } from "@/lib/server/authenticated-user";
import {
  historicalInterventionInclude,
  historicalStatuses,
  toHistoricalCoaching,
  type HistoricalIntervention,
} from "@/lib/server/coaching-historical-comparison";
import { buildCoachingVisibilityFilter, buildVisibleCoachingWhere } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { splitCriterionLabel } from "@/lib/performance-data";
import type { MockUser } from "@/lib/types";

export async function loadCoachingPreparationReferences(input: {
  actor: MockUser;
  representativeId: string;
  currentId?: string | null;
  referenceId?: string | null;
}): Promise<PreparationReferenceResponse> {
  await requireCoachingParticipantScope(input.actor, [input.representativeId]);
  const representative = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: ["REPRESENTATIVE", "SALES_LEADER"] },
      OR: [{ id: input.representativeId }, { representativeId: input.representativeId }],
    },
    select: { id: true, representativeId: true },
  });
  if (!representative) notFound("Begeleide persoon niet gevonden.");

  const current = input.currentId
    ? await prisma.intervention.findFirst({
        where: buildVisibleCoachingWhere(input.actor, {
          id: input.currentId,
          representativeId: representative.id,
        }),
        select: { id: true, preparationReferenceCoachingId: true },
      })
    : undefined;
  if (input.currentId && !current) notFound("Geplande begeleiding niet gevonden.");

  const rows = await prisma.intervention.findMany({
    where: {
      AND: [
        buildCoachingVisibilityFilter(input.actor),
        {
          type: "BEGELEIDING",
          representativeId: representative.id,
          deletedAt: null,
          status: { in: historicalStatuses },
          ...(input.currentId ? { id: { not: input.currentId } } : {}),
        },
      ],
    },
    select: {
      id: true,
      status: true,
      plannedAt: true,
      completedAt: true,
      finalizedAt: true,
      updatedAt: true,
      owner: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ completedAt: "desc" }, { finalizedAt: "desc" }, { plannedAt: "desc" }, { updatedAt: "desc" }],
  });

  const publicRepresentativeId = representative.representativeId ?? representative.id;
  const candidates: PreparationReferenceCandidate[] = rows.map((row) => ({
    id: row.id,
    representativeId: publicRepresentativeId,
    date: historicalDate(row),
    ownerName: fullName(row.owner),
    status: row.status,
  }));
  const options = buildPreparationReferenceOptions({
    representativeId: publicRepresentativeId,
    currentId: input.currentId ?? undefined,
    today: dateOnly(new Date()),
    candidates,
  });

  if (input.referenceId && !options.some((option) => option.id === input.referenceId)) {
    forbidden("De gekozen referentiebegeleiding is niet toegankelijk of niet volledig uitgevoerd.");
  }
  const selectedId = resolvePreparationReferenceId(
    options,
    input.referenceId,
    current?.preparationReferenceCoachingId
  );
  const latestId = options[0]?.id;
  const detailIds = [...new Set([selectedId, latestId].filter((id): id is string => Boolean(id)))];
  if (!detailIds.length) return { options };

  const detailRows = await prisma.intervention.findMany({
    where: {
      AND: [
        buildCoachingVisibilityFilter(input.actor),
        {
          id: { in: detailIds },
          type: "BEGELEIDING",
          representativeId: representative.id,
          deletedAt: null,
          status: { in: historicalStatuses },
        },
      ],
    },
    include: historicalInterventionInclude,
  });
  if (detailRows.length !== detailIds.length) {
    forbidden("De gekozen historische begeleiding valt buiten je toegestane scope.");
  }

  const details = new Map(detailRows.map((row) => {
    const option = options.find((item) => item.id === row.id)!;
    return [row.id, toPreparationDetail(row, option)] as const;
  }));
  return {
    options,
    selectedId,
    selected: selectedId ? details.get(selectedId) : undefined,
    latest: latestId ? details.get(latestId) : undefined,
  };
}

function toPreparationDetail(
  row: HistoricalIntervention,
  option: { id: string; date: string; ownerName: string; isLatest: boolean }
): PreparationReferenceDetail {
  return {
    ...option,
    history: toHistoricalCoaching(row),
    scoreGroups: buildPreparationScoreGroups(row),
  };
}

function buildPreparationScoreGroups(row: HistoricalIntervention): PreparationScoreGroup[] {
  const snapshotOrder = new Map<string, number>();
  for (const snapshot of row.criterionSnapshots) {
    const category = snapshotCategory(snapshot.criterionType, snapshot.focusName, snapshot.section);
    snapshotOrder.set(scoreKey(category, snapshot.title), snapshot.sortOrder);
  }

  const grouped = new Map<string, Array<PreparationScoreRow & { sortOrder: number }>>();
  for (const [index, score] of row.scores.entries()) {
    const category = score.category ?? score.criterion?.focus.name ?? score.personalCriterion?.focusName ?? "Algemeen";
    const criterion = score.label ?? score.criterionSnapshot?.title ?? score.criterion?.name ?? score.personalCriterion?.title ?? "Criterium";
    const current = grouped.get(category) ?? [];
    current.push({
      id: score.id,
      category,
      criterion,
      score: score.score ?? undefined,
      notApplicable: score.notApplicable,
      comment: score.comment ?? "",
      sortOrder: score.criterionSnapshot?.sortOrder ?? snapshotOrder.get(scoreKey(category, criterion)) ?? index,
    });
    grouped.set(category, current);
  }

  const result: PreparationScoreGroup[] = [];
  for (const [category, scoreRows] of grouped) {
    if (!hasFilledScoreRows(scoreRows)) continue;
    const display = displayCategory(category);
    result.push({
      id: `score:${category}`,
      kind: display.kind,
      title: display.title,
      rows: scoreRows
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((score) => ({
          id: score.id,
          category: score.category,
          criterion: score.criterion,
          score: score.score,
          notApplicable: score.notApplicable,
          comment: score.comment,
        })),
    });
  }

  for (const [appointmentIndex, appointment] of (row.coachingDetail?.appointments ?? []).entries()) {
    const scoreRows = [...appointment.scoreRows]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((score) => {
        const label = splitCriterionLabel(score.criterion);
        return {
          id: score.id,
          category: label.focus,
          criterion: label.criterion,
          score: score.score ?? undefined,
          notApplicable: score.notApplicable,
          comment: score.comment ?? "",
        };
      });
    if (!hasFilledScoreRows(scoreRows)) continue;
    result.push({
      id: `appointment:${appointment.id}`,
      kind: "appointment",
      title: appointment.customer,
      sequence: appointmentIndex + 1,
      rows: scoreRows,
    });
  }
  return result;
}

function hasFilledScoreRows(rows: Array<Pick<PreparationScoreRow, "score" | "comment">>) {
  return rows.some((row) => row.score !== undefined || row.comment.trim().length > 0);
}

function snapshotCategory(type: string, focusName: string | null, section: string | null) {
  if (type === "GENERAL_EVALUATION") return "Dossier:Algemeen";
  if (type === "PERSONALITY") return "Dossier:Persoonlijkheid";
  return focusName || section || "Algemeen";
}

function displayCategory(category: string) {
  if (category === "Dossier:Algemeen") return { kind: "general" as const, title: category };
  if (category === "Dossier:Persoonlijkheid") return { kind: "personality" as const, title: category };
  return { kind: "phase" as const, title: category };
}

function scoreKey(category: string, criterion: string) {
  return `${category.trim().toLocaleLowerCase("nl-BE")}::${criterion.trim().toLocaleLowerCase("nl-BE")}`;
}

function historicalDate(row: {
  plannedAt: Date | null;
  completedAt: Date | null;
  finalizedAt: Date | null;
  updatedAt: Date;
}) {
  return dateOnly(row.completedAt ?? row.finalizedAt ?? row.plannedAt ?? row.updatedAt);
}

function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
