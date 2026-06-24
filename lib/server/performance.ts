import { prisma } from "@/lib/server/db";
import type {
  HistoricalActionPoint,
  HistoricalCoaching,
  HistoricalContactMoment,
  MonthlyKpiSnapshot,
  PerformanceDataset,
} from "@/lib/performance-data";
import type { WorkflowActionPoint } from "@/lib/types";

type KpiUnit = "%" | "EUR" | "number";

export async function loadPerformanceDatasetFromDatabase(): Promise<PerformanceDataset> {
  const [coachings, contactMoments, actionPoints, kpiSnapshots] = await Promise.all([
    loadHistoricalCoachings(),
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

async function loadHistoricalCoachings(): Promise<HistoricalCoaching[]> {
  const interventions = await prisma.intervention.findMany({
    where: {
      type: "BEGELEIDING",
      OR: [
        { completedAt: { not: null } },
        { finalizedAt: { not: null } },
        { status: { in: ["AFGESLOTEN", "GEFINALISEERD", "GESLOTEN"] } },
      ],
      deletedAt: null,
    },
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
    },
    orderBy: [{ completedAt: "asc" }, { finalizedAt: "asc" }, { updatedAt: "asc" }],
  });

  return interventions.map((item) => {
    const representativeId = item.representative.representativeId ?? item.representativeId;
    const scoreRows = item.scores.filter((score) => score.score !== null && !score.notApplicable);
    const phaseScores = averageByLabel(scoreRows
      .filter((score) => score.category && !score.category.startsWith("Dossier:"))
      .map((score) => ({
        label: score.category ?? score.criterion?.focus.name ?? score.personalCriterion?.focusName ?? "Algemeen",
        score: scoreToPercent(score.score),
      })));
    const generalScores = scoreRows
      .filter((score) => score.category === "Dossier:Algemeen" || score.category === "Dossier:Persoonlijkheid")
      .map((score) => ({
        label: score.label ?? score.criterion?.name ?? score.personalCriterion?.title ?? "Criterium",
        score: scoreToPercent(score.score),
      }));
    const criterionScores = scoreRows
      .filter((score) => !score.category?.startsWith("Dossier:"))
      .map((score) => ({
        focus: score.category ?? score.criterion?.focus.name ?? score.personalCriterion?.focusName ?? "Algemeen",
        criterion: score.label ?? score.criterion?.name ?? score.personalCriterion?.title ?? "Criterium",
        score: scoreToPercent(score.score),
      }));

    return {
      id: item.id,
      representativeId,
      date: dateOnly(item.completedAt ?? item.finalizedAt ?? item.plannedAt ?? item.updatedAt),
      ownerId: item.ownerId,
      ownerName: `${item.owner.firstName} ${item.owner.lastName}`,
      status: "afgesloten",
      focusNames: item.focuses.map((focus) => focus.focus.name),
      phaseScores,
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
  const actions = await prisma.actionPoint.findMany({
    include: {
      representative: true,
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });

  return actions.map((action) => {
    const status = toActionStatus(action.status);
    const due = action.dueDate ? dateOnly(action.dueDate) : "";
    return {
      id: action.id,
      representativeId: action.representative.representativeId ?? action.representativeId,
      title: action.title,
      type: action.type.toLowerCase() as WorkflowActionPoint["type"],
      status: due && due < today() && !["behaald", "afgerond", "geannuleerd"].includes(status)
        ? "achterstallig"
        : status,
      due,
      progress: progressForStatus(status),
      updatedAt: dateOnly(action.updatedAt),
    };
  });
}

async function loadMonthlyKpiSnapshots(): Promise<MonthlyKpiSnapshot[]> {
  const snapshots = await prisma.kpiSnapshot.findMany({
    include: {
      user: true,
      kpiDefinition: true,
    },
    orderBy: [{ periodStart: "asc" }, { kpiDefinition: { name: "asc" } }],
  });
  const grouped = new Map<string, MonthlyKpiSnapshot>();

  for (const snapshot of snapshots) {
    const representativeId = snapshot.user.representativeId ?? snapshot.userId;
    const month = dateOnly(snapshot.periodStart).slice(0, 7);
    const key = `${representativeId}:${month}`;
    const current = grouped.get(key) ?? {
      id: `kpi-${representativeId}-${month}`,
      representativeId,
      month,
      values: [],
    };
    current.values.push({
      label: snapshot.kpiDefinition.name,
      value: Number(snapshot.value),
      target: snapshot.target ? Number(snapshot.target) : 0,
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

function scoreToPercent(score: number | null) {
  if (score === null) return 0;
  if (score <= 5) return Math.round((score / 5) * 100);
  return Math.max(0, Math.min(100, score));
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

function toKpiUnit(unit: string): KpiUnit {
  if (unit === "%") return "%";
  if (unit === "EUR") return "EUR";
  return "number";
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
