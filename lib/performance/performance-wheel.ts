import {
  type HistoricalCoaching,
} from "@/lib/performance-data";

export type PerformanceWheelType = "kapstok" | "algemeen";
export type PerformanceTrend = "better" | "worse" | "equal" | "first";

export type PerformanceWheelCriterion = {
  id: string;
  index: number;
  category: string;
  criterion: string;
  currentScored: boolean;
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
  currentAverage?: number;
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
  currentAverage?: number;
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
  const currentCriteria = criteriaFor(current, type);
  const previousScores = new Map(
    criteriaFor(comparison, type)
      .filter((item) => item.scored !== false)
      .map((item) => [criterionKey(item), item.score])
  );
  const criteria = currentCriteria.map((item, index) => {
    const previousScore = previousScores.get(criterionKey(item));
    const currentScored = item.scored !== false;
    return {
      id: `${type}-${index}-${criterionKey(item)}`,
      index: index + 1,
      category: item.category,
      criterion: item.criterion,
      currentScored,
      currentScore: item.score,
      previousScore,
      currentTen: normalizeScoreToTen(item.score),
      previousTen: previousScore === undefined ? undefined : normalizeScoreToTen(previousScore),
      difference: currentScored && previousScore !== undefined ? item.score - previousScore : undefined,
      differenceTen: !currentScored || previousScore === undefined
        ? undefined
        : normalizeDifferenceToTen(item.score - previousScore),
      trend: currentScored ? calculateTrend(item.score, previousScore) : "first",
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
    currentAverage: averageScored(criteria.map((item) => ({ score: item.currentScore, scored: item.currentScored }))),
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
        currentAverage: averageScored(criteria.slice(criterion.index - 1, criterion.index).map((item) => ({
          score: item.currentScore,
          scored: item.currentScored,
        }))),
        previousAverage: averageOptional([criterion.previousScore]),
      });
      continue;
    }
    const rows = criteria.slice(existing.startIndex, criterion.index);
    existing.endIndex = criterion.index;
    existing.currentAverage = averageScored(rows.map((item) => ({
      score: item.currentScore,
      scored: item.currentScored,
    })));
    const previous = rows.flatMap((item) => item.previousScore === undefined ? [] : [item.previousScore]);
    existing.previousAverage = averageOptional(previous);
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
      generalCategoryOrder.flatMap((category) =>
        category.criteria.map((criterion) => {
          const score = intervention.generalScores.find((item) => item.label === criterion)?.score;
          return {
            category: category.name,
            criterion,
            score: score ?? 0,
            scored: score !== undefined,
          };
        })
      )
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

function averageScored(values: Array<{ score: number; scored: boolean }>) {
  const scored = values.filter((item) => item.scored).map((item) => item.score);
  return scored.length ? average(scored) : undefined;
}

function averageOptional(values: Array<number | undefined>) {
  const defined = values.flatMap((value) => value === undefined ? [] : [value]);
  return defined.length ? average(defined) : undefined;
}
