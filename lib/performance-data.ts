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
  criterionScores: {
    focus: string;
    criterion: string;
    score: number;
  }[];
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
};

export type MonthlyKpiSnapshot = {
  id: string;
  representativeId: string;
  month: string;
  values: {
    label: string;
    value: number;
    target: number;
    unit: "%" | "EUR" | "number";
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
  return coaching.overallScore !== undefined || coaching.phaseScores.length > 0 || coaching.generalScores.length > 0;
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
