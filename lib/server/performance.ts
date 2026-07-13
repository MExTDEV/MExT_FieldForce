import { prisma } from "@/lib/server/db";
import { resolveKpiTargetFromDefinition } from "@/lib/server/kpi-targets";
import { columnsExist, tableExists } from "@/lib/server/schema-inspection";
import type {
  HistoricalActionPoint,
  HistoricalCoaching,
  HistoricalContactMoment,
  MonthlyKpiSnapshot,
  PerformanceDataset,
} from "@/lib/performance-data";
import {
  criterionScoresFromRows,
  mergeCriterionScores,
  normalizePerformanceScore,
} from "@/lib/performance-data";
import type { KpiUnit, Role, Status, WorkflowActionPoint } from "@/lib/types";
import type { Prisma } from "@prisma/client";

type TargetUserRow = {
  representativeId: string | null;
};

type TargetInterventionRow = {
  representativeId: string;
  representative: TargetUserRow;
};

type LegacyActionPointRow = {
  id: string;
  representativeId: string;
  representative: TargetUserRow;
  interventionId: string | null;
  intervention: TargetInterventionRow | null;
  title: string;
  type: string;
  status: string;
  dueDate: Date | null;
  closedAt: Date | null;
  closedByUserId: string | null;
  updatedAt: Date;
  assignments: {
    id: string;
    representativeId: string;
    status: string;
    closedAt: Date | null;
    closedByUserId: string | null;
    representative: TargetUserRow;
  }[];
};

type CoachingActionRow = {
  id: string;
  interventionId: string;
  intervention: TargetInterventionRow | null;
  userId: string;
  user: TargetUserRow;
  title: string;
  updatedAt: Date;
};

type MonthlyKpiSnapshotBaseRow = Prisma.KpiSnapshotGetPayload<{
  include: {
    user: true;
    kpiDefinition: { include: { targetOverrides: true } };
  };
}>;

type MonthlyKpiSnapshotManagedRow = Prisma.KpiSnapshotGetPayload<{
  include: {
    user: true;
    kpiDefinition: { include: { targetOverrides: true; targets: true } };
  };
}>;

type MonthlyKpiSnapshotRow = MonthlyKpiSnapshotBaseRow | MonthlyKpiSnapshotManagedRow;

export async function loadPerformanceDatasetFromDatabase(
  options: { coachingWhere?: Prisma.InterventionWhereInput } = {}
): Promise<PerformanceDataset> {
  const [coachings, contactMoments, actionPoints, kpiSnapshots] = await Promise.all([
    loadHistoricalCoachings(options.coachingWhere),
    loadHistoricalContactMoments(),
    loadHistoricalActionPoints(),
    loadMonthlyKpiSnapshots(),
  ]);

  return {
    historicalCoachings: coachings,
    historicalContactMoments: contactMoments,
    historicalActionPoints: actionPoints,
    monthlyKpiSnapshots: kpiSnapshots,
  };
}

async function loadHistoricalCoachings(
  visibilityWhere: Prisma.InterventionWhereInput = {}
): Promise<HistoricalCoaching[]> {
  const interventions = await prisma.intervention.findMany({
    where: {
      AND: [
        visibilityWhere,
        {
          type: "BEGELEIDING",
          OR: [
            { completedAt: { not: null } },
            { finalizedAt: { not: null } },
            { status: { in: ["AFGESLOTEN", "GEFINALISEERD", "GESLOTEN", "VOLTOOID", "VERZONDEN_TER_AKKOORD", "AKKOORD_DOOR_VERTEGENWOORDIGER"] } },
          ],
          deletedAt: null,
        },
      ],
    },
    distinct: ["id"],
    include: {
      representative: true,
      owner: true,
      focuses: { include: { focus: true } },
      scores: {
        include: {
          criterion: { include: { focus: true } },
          personalCriterion: true,
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
    },
    orderBy: [{ completedAt: "desc" }, { finalizedAt: "desc" }, { updatedAt: "desc" }],
  });
  const reopenedIds = new Set((await prisma.auditLog.findMany({
    where: {
      entityType: "Intervention",
      entityId: { in: interventions.map((item) => item.id) },
      action: "coaching.reopened",
    },
    select: { entityId: true },
  })).map((item) => item.entityId));

  return interventions.map((item) => {
    const representativeId = item.representative.representativeId ?? item.representativeId;
    const scoreRows = item.scores.filter((score) => score.score !== null && !score.notApplicable);
    const storedCriterionScores = scoreRows
      .filter((score) => score.category && !score.category.startsWith("Dossier:"))
      .map((score) => ({
        focus: score.category ?? score.criterion?.focus.name ?? score.personalCriterion?.focusName ?? "Algemeen",
        criterion: score.label ?? score.criterion?.name ?? score.personalCriterion?.title ?? "Criterium",
        score: scoreToPercent(score.score),
        scored: true,
      }));
    const appointmentCriterionScores = criterionScoresFromRows(
      (item.coachingDetail?.appointments ?? []).flatMap((appointment) =>
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
        score: scoreToPercent(score.score),
      }));
    const dossierValues = scoreRows
      .filter((score) => score.category?.startsWith("Dossier:"))
      .map((score) => scoreToPercent(score.score));
    const appointmentAverages = (item.coachingDetail?.appointments ?? []).flatMap((appointment) => {
      const values = appointment.scoreRows
        .filter((score) => score.score !== null && !score.notApplicable)
        .map((score) => scoreToPercent(score.score));
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
      id: item.id,
      representativeId,
      date: dateOnly(item.completedAt ?? item.finalizedAt ?? item.plannedAt ?? item.updatedAt),
      ownerId: item.ownerId,
      ownerName: `${item.owner.firstName} ${item.owner.lastName}`,
      status: item.status.toLowerCase() as Status,
      overallScore,
      wasReopened: reopenedIds.has(item.id),
      focusNames: [...new Set([
        ...item.focuses.map((focus) => focus.focus.name),
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
  });
}

async function loadHistoricalContactMoments(): Promise<HistoricalContactMoment[]> {
  const contactMoments = await prisma.intervention.findMany({
    where: {
      type: "CONTACTMOMENT",
      status: "AFGESLOTEN",
      contactMoment: { isNot: null },
      deletedAt: null,
    },
    include: {
      representative: true,
      contactMoment: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  return contactMoments.flatMap((item) => item.contactMoment ? [{
    id: item.id,
    representativeId: item.representative.representativeId ?? item.representativeId,
    date: dateOnly(item.completedAt ?? item.updatedAt),
    ownerId: item.ownerId,
    reason: item.contactMoment.reason,
    status: "afgesloten" as const,
  }] : []);
}

async function loadHistoricalActionPoints(): Promise<HistoricalActionPoint[]> {
  const [legacyActions, coachingActions] = await Promise.all([
    prisma.actionPoint.findMany({
      where: {
        OR: [
          { interventionId: null },
          { intervention: { deletedAt: null } },
        ],
      },
      include: {
        representative: true,
        assignments: {
          include: {
            representative: true,
          },
        },
        intervention: {
          include: {
            representative: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.coachingAction.findMany({
      where: {
        intervention: {
          deletedAt: null,
        },
      },
      include: {
        user: true,
        intervention: {
          include: {
            representative: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  return normalizeHistoricalActionPoints(legacyActions, coachingActions);
}

export function normalizeHistoricalActionPoints(
  legacyActions: LegacyActionPointRow[],
  coachingActions: CoachingActionRow[],
  referenceDate = today()
): HistoricalActionPoint[] {
  const items: HistoricalActionPoint[] = [];
  const legacyActionKeys = new Set<string>();

  for (const action of legacyActions) {
    const targets = action.assignments.length
      ? action.assignments.map((assignment) => ({
        id: `${action.id}:${assignment.representativeId}`,
        representativeId: publicRepresentativeId(assignment.representative, assignment.representativeId),
        status: toActionStatus(assignment.status),
        closedAt: assignment.closedAt,
        closedByUserId: assignment.closedByUserId,
      }))
      : [{
        id: action.id,
        representativeId: targetRepresentativeIdForActionPoint(action),
        status: toActionStatus(action.status),
        closedAt: action.closedAt,
        closedByUserId: action.closedByUserId,
      }];
    const due = action.dueDate ? dateOnly(action.dueDate) : "";
    for (const target of targets) {
      if (!target.representativeId) continue;
      legacyActionKeys.add(actionPointTargetKey(action.interventionId, target.representativeId, action.title));
      items.push({
        id: target.id,
        representativeId: target.representativeId,
        title: action.title,
        type: action.type.toLowerCase() as WorkflowActionPoint["type"],
        status: due && due < referenceDate && !["behaald", "afgerond", "geannuleerd"].includes(target.status)
          ? "achterstallig"
          : target.status,
        due,
        progress: progressForStatus(target.status),
        updatedAt: dateOnly(action.updatedAt),
        closedAt: target.closedAt?.toISOString(),
        closedByUserId: target.closedByUserId ?? undefined,
      });
    }
  }

  for (const action of coachingActions) {
    const representativeId = targetRepresentativeIdForCoachingAction(action);
    if (!representativeId) continue;
    const key = actionPointTargetKey(action.interventionId, representativeId, action.title);
    if (legacyActionKeys.has(key)) continue;
    items.push({
      id: `coaching-action:${action.id}`,
      representativeId,
      title: action.title,
      type: "vaardigheid",
      status: "open",
      due: "",
      progress: progressForStatus("open"),
      updatedAt: dateOnly(action.updatedAt),
    });
  }

  return items.sort((left, right) =>
    left.representativeId.localeCompare(right.representativeId) ||
    left.due.localeCompare(right.due) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.title.localeCompare(right.title)
  );
}

async function loadMonthlyKpiSnapshots(): Promise<MonthlyKpiSnapshot[]> {
  const hasKpiManagementSchema = await hasKpiManagementReadSchema();
  if (!hasKpiManagementSchema) {
    const snapshots = await prisma.kpiSnapshot.findMany({
      where: {
        kpiDefinition: {
          active: true,
        },
      },
      include: {
        user: true,
        kpiDefinition: { include: { targetOverrides: true } },
      },
      orderBy: [{ periodStart: "asc" }, { kpiDefinition: { name: "asc" } }],
    });
    return normalizeMonthlyKpiSnapshots(snapshots);
  }

  const snapshots = await prisma.kpiSnapshot.findMany({
    where: {
      kpiDefinition: {
        active: true,
        countsForReporting: true,
        countsForPerformanceCircle: true,
      },
    },
    include: {
      user: true,
      kpiDefinition: { include: { targetOverrides: true, targets: { where: { active: true } } } },
    },
    orderBy: [{ periodStart: "asc" }, { kpiDefinition: { name: "asc" } }],
  });
  return normalizeMonthlyKpiSnapshots(snapshots);
}

async function hasKpiManagementReadSchema() {
  return (await tableExists("kpi_targets")) &&
    (await columnsExist("KpiDefinition", [
      "counts_for_reporting",
      "counts_for_performance_circle",
    ]));
}

function normalizeMonthlyKpiSnapshots(snapshots: MonthlyKpiSnapshotRow[]) {
  const grouped = new Map<string, MonthlyKpiSnapshot>();

  for (const snapshot of snapshots) {
    const representativeId = snapshot.user.representativeId ?? snapshot.userId;
    const month = dateOnly(snapshot.periodStart).slice(0, 7);
    const key = `${representativeId}:${month}`;
    const current: MonthlyKpiSnapshot = grouped.get(key) ?? {
      id: `kpi-${representativeId}-${month}`,
      representativeId,
      month,
      values: [],
    };
    const effectiveTarget = resolveKpiTargetFromDefinition(snapshot.kpiDefinition, {
      country: snapshot.user.country,
      teamId: snapshot.user.teamId ?? undefined,
      userId: snapshot.userId,
      role: snapshot.user.role as Role,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
    });
    current.values.push({
      label: snapshot.kpiDefinition.name,
      value: Number(snapshot.value),
      target: Number(snapshot.target ?? effectiveTarget.targetValue),
      unit: toKpiUnit(snapshot.kpiDefinition.unit),
    });
    grouped.set(key, current);
  }

  return [...grouped.values()].sort((left, right) =>
    left.representativeId.localeCompare(right.representativeId) || left.month.localeCompare(right.month)
  );
}

function averageByLabel(items: { label: string; score: number }[]) {
  const grouped = new Map<string, number[]>();
  for (const item of items) {
    const current = grouped.get(item.label) ?? [];
    current.push(item.score);
    grouped.set(item.label, current);
  }
  return [...grouped].map(([label, values]) => ({
    label,
    score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
  }));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function scoreToPercent(score: number | null) {
  return score === null ? 0 : normalizePerformanceScore(score);
}

function toActionStatus(status: string): WorkflowActionPoint["status"] {
  const normalized = status.toLowerCase();
  if (normalized === "afgerond") return "afgerond";
  if (normalized === "open") return "open";
  return normalized as WorkflowActionPoint["status"];
}

function progressForStatus(status: WorkflowActionPoint["status"]) {
  if (["behaald", "afgerond"].includes(status)) return 100;
  if (status === "in_uitvoering") return 55;
  if (status === "niet_behaald") return 30;
  if (status === "geannuleerd") return 0;
  return 40;
}

function targetRepresentativeIdForActionPoint(action: LegacyActionPointRow) {
  if (action.intervention) {
    return publicRepresentativeId(action.intervention.representative, action.intervention.representativeId);
  }
  return publicRepresentativeId(action.representative, action.representativeId);
}

function targetRepresentativeIdForCoachingAction(action: CoachingActionRow) {
  return publicRepresentativeId(action.user, action.userId) ||
    (action.intervention ? publicRepresentativeId(action.intervention.representative, action.intervention.representativeId) : "");
}

function publicRepresentativeId(user: TargetUserRow | null | undefined, fallback: string) {
  return user?.representativeId || fallback;
}

function actionPointTargetKey(interventionId: string | null | undefined, representativeId: string, title: string) {
  return `${interventionId ?? "standalone"}:${representativeId}:${title.trim().toLocaleLowerCase("nl-BE")}`;
}

function toKpiUnit(unit: string): KpiUnit {
  if (unit === "%") return "%";
  if (unit === "EUR") return "EUR";
  if (["count", "minutes", "hours", "km"].includes(unit)) return unit as KpiUnit;
  return "number";
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
