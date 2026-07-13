import type { Representative, Status, WorkflowActionPoint } from "@/lib/types";

export const generalCompetencies = [
  "Stiptheid",
  "Voorbereiding",
  "Administratie",
  "Tempo",
  "Zelfzekerheid",
  "Overtuigingskracht",
  "Respect",
  "Persoonlijke verzorging",
] as const;

export type PerformanceDimension = {
  label: string;
  score: number;
};

export type HistoricalCriterionScore = {
  focus: string;
  criterion: string;
  score: number;
  scored?: boolean;
};

export type RawCriterionScore = {
  criterion: string;
  score: number | null;
  notApplicable?: boolean;
};

export type HistoricalCoaching = {
  id: string;
  representativeId: string;
  date: string;
  ownerId: string;
  ownerName: string;
  status: Status;
  overallScore?: number;
  wasReopened?: boolean;
  focusNames: string[];
  phaseScores: PerformanceDimension[];
  generalScores: PerformanceDimension[];
  criterionScores: HistoricalCriterionScore[];
};

export type HistoricalContactMoment = {
  id: string;
  representativeId: string;
  date: string;
  ownerId: string;
  reason: string;
  status: "afgesloten";
};

export type HistoricalActionPoint = {
  id: string;
  representativeId: string;
  title: string;
  type: WorkflowActionPoint["type"];
  status: WorkflowActionPoint["status"] | "achterstallig";
  due: string;
  progress: number;
  updatedAt: string;
  closedAt?: string;
  closedByUserId?: string;
};

export type MonthlyKpiSnapshot = {
  id: string;
  representativeId: string;
  month: string;
  values: {
    label: string;
    value: number;
    target: number;
    unit: "%" | "EUR" | "count" | "minutes" | "hours" | "km" | "number";
  }[];
};

export type PerformanceDataset = {
  historicalCoachings: HistoricalCoaching[];
  historicalContactMoments: HistoricalContactMoment[];
  historicalActionPoints: HistoricalActionPoint[];
  monthlyKpiSnapshots: MonthlyKpiSnapshot[];
};

export const emptyPerformanceDataset: PerformanceDataset = {
  historicalCoachings: [],
  historicalContactMoments: [],
  historicalActionPoints: [],
  monthlyKpiSnapshots: [],
};

export function coachingsForRepresentative(dataset: PerformanceDataset, representativeId: string) {
  return dataset.historicalCoachings
    .filter((item) => item.representativeId === representativeId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function coachingById(dataset: PerformanceDataset, id: string) {
  return dataset.historicalCoachings.find((item) => item.id === id);
}

export function performanceTrend(dataset: PerformanceDataset, representativeId: string): -1 | 0 | 1 {
  const coachings = coachingsForRepresentative(dataset, representativeId).filter(hasCoachingScoreData);
  if (coachings.length < 2) return 0;
  const current = average(coachings.at(-1)!.phaseScores.map((item) => item.score));
  const previous = average(coachings.at(-2)!.phaseScores.map((item) => item.score));
  const difference = current - previous;
  return difference >= 2 ? 1 : difference <= -2 ? -1 : 0;
}

export function latestHistoricalCoaching(dataset: PerformanceDataset, representativeId: string) {
  return coachingsForRepresentative(dataset, representativeId).at(-1);
}

export function latestScoredCoaching(dataset: PerformanceDataset, representativeId: string) {
  return coachingsForRepresentative(dataset, representativeId)
    .filter(hasCoachingScoreData)
    .at(-1);
}

export function hasCoachingScoreData(coaching: HistoricalCoaching) {
  return coaching.overallScore !== undefined || coaching.phaseScores.length > 0 || coaching.generalScores.length > 0 || coaching.criterionScores.length > 0;
}

/**
 * Converts the score rows used by appointment tables into the exact criterion
 * dataset used by the performance wheel. Repeated criteria across appointments
 * are averaged; their first occurrence determines the stable display order.
 */
export function criterionScoresFromRows(rows: RawCriterionScore[]): HistoricalCriterionScore[] {
  const grouped = new Map<string, {
    focus: string;
    criterion: string;
    values: number[];
  }>();

  for (const row of rows) {
    const { focus, criterion } = splitCriterionLabel(row.criterion);
    const key = criterionScoreKey({ focus, criterion });
    const current = grouped.get(key) ?? { focus, criterion, values: [] };
    if (row.score !== null && !row.notApplicable) {
      current.values.push(normalizePerformanceScore(row.score));
    }
    grouped.set(key, current);
  }

  return [...grouped.values()].map((item) => ({
    focus: item.focus,
    criterion: item.criterion,
    score: item.values.length ? Math.round(average(item.values)) : 0,
    scored: item.values.length > 0,
  }));
}

/** Keep the primary score source authoritative and append non-overlapping rows. */
export function mergeCriterionScores(
  primary: HistoricalCriterionScore[],
  ...fallbacks: HistoricalCriterionScore[][]
) {
  const merged = new Map<string, HistoricalCriterionScore>();
  for (const score of primary) merged.set(criterionScoreKey(score), score);
  for (const fallback of fallbacks) {
    for (const score of fallback) {
      const key = criterionScoreKey(score);
      const existing = merged.get(key);
      if (!existing || (existing.scored === false && score.scored !== false)) {
        merged.set(key, score);
      }
    }
  }
  return [...merged.values()];
}

export function splitCriterionLabel(label: string) {
  const [rawFocus, ...criterionParts] = label.split(" - ");
  const focus = criterionParts.length ? rawFocus.trim() : "Algemeen";
  const criterion = (criterionParts.length ? criterionParts.join(" - ") : label).trim();
  return {
    focus: focus || "Algemeen",
    criterion: criterion || label.trim() || "Criterium",
  };
}

export function normalizePerformanceScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  if (score >= 0 && score <= 5) return Math.round(score * 20);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function criterionScoreKey(score: Pick<HistoricalCriterionScore, "focus" | "criterion">) {
  return `${score.focus.trim().toLocaleLowerCase("nl-BE")}::${score.criterion.trim().toLocaleLowerCase("nl-BE")}`;
}

export function representativeForCoaching(
  coaching: HistoricalCoaching,
  representatives: Representative[]
): Representative | undefined {
  return representatives.find((item) => item.id === coaching.representativeId);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
