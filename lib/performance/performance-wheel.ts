import {
  type HistoricalCoaching,
} from "@/lib/performance-data";

export type PerformanceWheelType = "kapstok" | "algemeen";
export type PerformanceTrend = "better" | "worse" | "equal" | "first";

export const performanceTrendColors: Record<PerformanceTrend, string> = {
  better: "#16a34a",
  worse: "#dc2626",
  equal: "#003b83",
  first: "#1266b3",
};

export function performanceTrendColor(trend: PerformanceTrend) {
  return performanceTrendColors[trend];
}

export type PerformanceWheelCriterion = {
  id: string;
  index: number;
  category: string;
  criterion: string;
  currentScored: boolean;
  currentScore: number;
  currentPercentage?: number;
  previousScore?: number;
  previousPercentage?: number;
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
  currentPercentage?: number;
  previousPercentage?: number;
  trend: PerformanceTrend;
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
  totalPercentage?: number;
  previousTotalPercentage?: number;
  totalTrend: PerformanceTrend;
};

/** Historical wheel values are normalised to this scale by performance-data. */
export const performanceWheelScoreScale = {
  minimum: 0,
  maximum: 100,
} as const;

export function getPerformanceWheelData(
  representativeId: string,
  currentInterventionId: string,
  type: PerformanceWheelType,
  comparisonInterventionId?: string,
  source: HistoricalCoaching[] = []
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
  return buildPerformanceWheelData({
    current,
    comparison,
    type,
    representativeId,
    currentInterventionId,
  });
}

export function buildPerformanceWheelData(input: {
  current: HistoricalCoaching;
  comparison?: HistoricalCoaching;
  type: PerformanceWheelType;
  representativeId?: string;
  currentInterventionId?: string;
}): PerformanceWheelData {
  const { current, comparison, type } = input;
  const currentCriteria = criteriaFor(current, type);
  const previousScores = new Map(
    criteriaFor(comparison, type)
      .filter((item) => item.scored !== false)
      .map((item) => [criterionKey(item), item.score])
  );
  const criteria = currentCriteria.map((item, index) => {
    const previousScore = previousScores.get(criterionKey(item));
    const currentScored = item.scored !== false;
    const currentPercentage = currentScored ? percentageFromScore(item.score) : undefined;
    const previousPercentage = previousScore === undefined ? undefined : percentageFromScore(previousScore);
    return {
      id: `${type}-${index}-${criterionKey(item)}`,
      index: index + 1,
      category: item.category,
      criterion: item.criterion,
      currentScored,
      currentScore: item.score,
      currentPercentage,
      previousScore,
      previousPercentage,
      currentTen: currentPercentage === undefined ? 0 : percentageToTen(currentPercentage),
      previousTen: previousPercentage === undefined ? undefined : percentageToTen(previousPercentage),
      difference: currentPercentage === undefined || previousPercentage === undefined ? undefined : currentPercentage - previousPercentage,
      differenceTen: currentPercentage === undefined || previousPercentage === undefined
        ? undefined
        : normalizeDifferenceToTen(currentPercentage - previousPercentage),
      trend: currentPercentage === undefined ? "first" : calculateTrend(currentPercentage, previousPercentage),
    } satisfies PerformanceWheelCriterion;
  });

  return {
    representativeId: input.representativeId ?? current.representativeId,
    currentInterventionId: input.currentInterventionId ?? current.id,
    comparisonInterventionId: comparison?.id,
    type,
    currentDate: current.date,
    comparisonDate: comparison?.date,
    criteria,
    categories: calculateCategoryAverages(criteria),
    totalPercentage: calculateAveragePercentage(criteria.map((item) => ({
      score: item.currentScore,
      scored: item.currentScored,
    }))),
    previousTotalPercentage: calculateAveragePercentage(criteriaFor(comparison, type).map((item) => ({
      score: item.score,
      scored: item.scored !== false,
    }))),
    totalTrend: calculateTrend(
      calculateAveragePercentage(criteria.map((item) => ({ score: item.currentScore, scored: item.currentScored }))),
      calculateAveragePercentage(criteriaFor(comparison, type).map((item) => ({ score: item.score, scored: item.scored !== false })))
    ),
  };
}

export function calculateCriterionAverages(
  scores: Array<{ category: string; criterion: string; score: number; scored?: boolean }>
) {
  const grouped = new Map<string, { category: string; criterion: string; values: number[] }>();
  for (const score of scores) {
    const key = `${score.category}::${score.criterion}`;
    const current = grouped.get(key) ?? { category: score.category, criterion: score.criterion, values: [] };
    if (score.scored !== false) current.values.push(score.score);
    grouped.set(key, current);
  }
  return [...grouped.values()].map((item) => ({
    category: item.category,
    criterion: item.criterion,
    score: item.values.length ? average(item.values) : 0,
    scored: item.values.length > 0,
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
        currentPercentage: undefined,
        previousPercentage: undefined,
        trend: "first",
      });
      continue;
    }
    const rows = criteria.slice(existing.startIndex, criterion.index);
    existing.endIndex = criterion.index;
    existing.currentPercentage = calculateAveragePercentage(rows.map((item) => ({
      score: item.currentScore,
      scored: item.currentScored,
    })));
    existing.previousPercentage = calculateAveragePercentage(rows.map((item) => ({
      score: item.previousScore ?? 0,
      scored: item.previousScore !== undefined,
    })));
  }
  for (const category of categories) {
    const rows = criteria.slice(category.startIndex, category.endIndex);
    category.currentPercentage = calculateAveragePercentage(rows.map((item) => ({
      score: item.currentScore,
      scored: item.currentScored,
    })));
    category.previousPercentage = calculateAveragePercentage(rows.map((item) => ({
      score: item.previousScore ?? 0,
      scored: item.previousScore !== undefined,
    })));
    category.trend = calculateTrend(category.currentPercentage, category.previousPercentage);
  }
  return categories;
}

export function calculateTrend(current: number | undefined, previous?: number): PerformanceTrend {
  if (current === undefined) return "first";
  if (previous === undefined) return "first";
  if (current > previous) return "better";
  if (current < previous) return "worse";
  return "equal";
}

export function normalizeScoreToTen(score: number) {
  const percentage = percentageFromScore(score);
  return percentage === undefined ? 0 : percentageToTen(percentage);
}

export function percentageFromScore(
  score: number,
  scale: { minimum: number; maximum: number } = performanceWheelScoreScale
) {
  if (!Number.isFinite(score) || !Number.isFinite(scale.minimum) || !Number.isFinite(scale.maximum)) return undefined;
  const range = scale.maximum - scale.minimum;
  if (range <= 0) return undefined;
  const clamped = Math.max(scale.minimum, Math.min(scale.maximum, score));
  return Math.round(((clamped - scale.minimum) / range) * 100);
}

export function calculateAveragePercentage(
  values: Array<{ score: number; scored?: boolean }>,
  scale: { minimum: number; maximum: number } = performanceWheelScoreScale
) {
  const scored = values
    .filter((item) => item.scored !== false && Number.isFinite(item.score))
    .map((item) => item.score);
  if (!scored.length) return undefined;
  return percentageFromScore(average(scored), scale);
}

export function formatPerformancePercentage(value: number | undefined, notScoredLabel = "Niet gescoord") {
  return value === undefined
    ? notScoredLabel
    : `${Math.round(value).toLocaleString("nl-BE")}%`;
}

function percentageToTen(percentage: number) {
  return Math.round(percentage) / 10;
}

export function getPreviousComparableIntervention(
  representativeId: string,
  currentInterventionId: string,
  source: HistoricalCoaching[] = []
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
      intervention.generalScores.map((item) => ({
        category: "Algemeen",
        criterion: item.label,
        score: item.score,
        scored: item.scored,
      }))
    );
  }
  const categoryOrder = [
    ...new Set([
      ...intervention.focusNames,
      ...intervention.criterionScores.map((score) => score.focus),
      ...intervention.phaseScores.map((score) => score.label),
    ]),
  ];
  return calculateCriterionAverages(
    categoryOrder.flatMap((focus) =>
      intervention.criterionScores.filter((score) => score.focus === focus).length
        ? intervention.criterionScores
          .filter((score) => score.focus === focus)
          .sort((left, right) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER))
          .map((score) => ({
            category: focus,
            criterion: score.criterion,
            score: score.score,
            scored: score.scored,
          }))
        : []
    )
  );
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
