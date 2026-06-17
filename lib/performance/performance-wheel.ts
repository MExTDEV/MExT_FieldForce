import { coachingFramework } from "@/lib/mock-data";
import {
  historicalCoachings,
  type HistoricalCoaching,
  type PerformanceDimension,
} from "@/lib/performance-data";

export type PerformanceWheelType = "kapstok" | "algemeen";
export type PerformanceTrend = "better" | "worse" | "equal" | "first";

export type PerformanceWheelCriterion = {
  id: string;
  index: number;
  category: string;
  criterion: string;
  currentScore: number;
  previousScore?: number;
  currentTen: number;
  previousTen?: number;
  difference?: number;
  differenceTen?: number;
  trend: PerformanceTrend;
};

export type PerformanceWheelCategory = {
  name: string;
  startIndex: number;
  endIndex: number;
  currentAverage: number;
  previousAverage?: number;
};

export type PerformanceWheelData = {
  representativeId: string;
  currentInterventionId: string;
  comparisonInterventionId?: string;
  type: PerformanceWheelType;
  currentDate: string;
  comparisonDate?: string;
  criteria: PerformanceWheelCriterion[];
  categories: PerformanceWheelCategory[];
};

const generalCategoryOrder = [
  { name: "Werkhouding", criteria: ["Stiptheid", "Respect"] },
  { name: "Persoonlijkheid", criteria: ["Zelfzekerheid", "Persoonlijke verzorging"] },
  { name: "Organisatie", criteria: ["Voorbereiding", "Administratie"] },
  { name: "Communicatie", criteria: ["Tempo", "Overtuigingskracht"] },
] as const;

export function getPerformanceWheelData(
  representativeId: string,
  currentInterventionId: string,
  type: PerformanceWheelType,
  comparisonInterventionId?: string,
  source: HistoricalCoaching[] = historicalCoachings
): PerformanceWheelData | undefined {
  const current = source.find((item) =>
    item.id === currentInterventionId && item.representativeId === representativeId
  );
  if (!current) return undefined;
  const comparison = comparisonInterventionId
    ? source.find((item) =>
      item.id === comparisonInterventionId && item.representativeId === representativeId
    )
    : getPreviousComparableIntervention(representativeId, currentInterventionId, source);
  const currentCriteria = criteriaFor(current, type);
  const previousScores = new Map(criteriaFor(comparison, type).map((item) => [criterionKey(item), item.score]));
  const criteria = currentCriteria.map((item, index) => {
    const previousScore = previousScores.get(criterionKey(item));
    return {
      id: `${type}-${index}-${criterionKey(item)}`,
      index: index + 1,
      category: item.category,
      criterion: item.criterion,
      currentScore: item.score,
      previousScore,
      currentTen: normalizeScoreToTen(item.score),
      previousTen: previousScore === undefined ? undefined : normalizeScoreToTen(previousScore),
      difference: previousScore === undefined ? undefined : item.score - previousScore,
      differenceTen: previousScore === undefined
        ? undefined
        : normalizeDifferenceToTen(item.score - previousScore),
      trend: calculateTrend(item.score, previousScore),
    } satisfies PerformanceWheelCriterion;
  });

  return {
    representativeId,
    currentInterventionId,
    comparisonInterventionId: comparison?.id,
    type,
    currentDate: current.date,
    comparisonDate: comparison?.date,
    criteria,
    categories: calculateCategoryAverages(criteria),
  };
}

export function calculateCriterionAverages(
  scores: Array<{ category: string; criterion: string; score: number }>
) {
  const grouped = new Map<string, { category: string; criterion: string; values: number[] }>();
  for (const score of scores) {
    const key = `${score.category}::${score.criterion}`;
    const current = grouped.get(key) ?? { category: score.category, criterion: score.criterion, values: [] };
    current.values.push(score.score);
    grouped.set(key, current);
  }
  return [...grouped.values()].map((item) => ({
    category: item.category,
    criterion: item.criterion,
    score: average(item.values),
  }));
}

export function calculateCategoryAverages(criteria: PerformanceWheelCriterion[]) {
  const categories: PerformanceWheelCategory[] = [];
  for (const criterion of criteria) {
    const existing = categories.at(-1);
    if (!existing || existing.name !== criterion.category) {
      categories.push({
        name: criterion.category,
        startIndex: criterion.index - 1,
        endIndex: criterion.index,
        currentAverage: criterion.currentScore,
        previousAverage: criterion.previousScore,
      });
      continue;
    }
    const rows = criteria.slice(existing.startIndex, criterion.index);
    existing.endIndex = criterion.index;
    existing.currentAverage = average(rows.map((item) => item.currentScore));
    const previous = rows.flatMap((item) => item.previousScore === undefined ? [] : [item.previousScore]);
    existing.previousAverage = previous.length ? average(previous) : undefined;
  }
  return categories;
}

export function calculateTrend(current: number, previous?: number): PerformanceTrend {
  if (previous === undefined) return "first";
  if (current > previous) return "better";
  if (current < previous) return "worse";
  return "equal";
}

export function normalizeScoreToTen(score: number) {
  return Math.round(score) / 10;
}

export function getPreviousComparableIntervention(
  representativeId: string,
  currentInterventionId: string,
  source: HistoricalCoaching[] = historicalCoachings
) {
  const coachings = source
    .filter((item) => item.representativeId === representativeId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const currentIndex = coachings.findIndex((item) => item.id === currentInterventionId);
  return currentIndex > 0 ? coachings[currentIndex - 1] : undefined;
}

function criteriaFor(intervention: HistoricalCoaching | undefined, type: PerformanceWheelType) {
  if (!intervention) return [];
  if (type === "algemeen") {
    return calculateCriterionAverages(
      generalCategoryOrder.flatMap((category) =>
        category.criteria.map((criterion) => ({
          category: category.name,
          criterion,
          score: intervention.generalScores.find((item) => item.label === criterion)?.score ?? 0,
        }))
      )
    );
  }
  return calculateCriterionAverages(
    coachingFramework.flatMap((focus) =>
      focus.criteria.map((criterion) => ({
        category: focus.name,
        criterion,
        score: intervention.criterionScores.find((item) =>
          item.focus === focus.name && item.criterion === criterion
        )?.score ?? phaseFallback(intervention.phaseScores, focus.name),
      }))
    )
  );
}

function phaseFallback(scores: PerformanceDimension[], focus: string) {
  return scores.find((item) => item.label === focus)?.score ?? 0;
}

function criterionKey(item: { category: string; criterion: string }) {
  return `${item.category}::${item.criterion}`;
}

function normalizeDifferenceToTen(difference: number) {
  return Math.round(difference) / 10;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
