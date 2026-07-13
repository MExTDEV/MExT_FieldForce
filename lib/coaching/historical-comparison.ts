import type { CoachingSimpleScore } from "@/lib/types";
import type { HistoricalCoaching } from "@/lib/performance-data";

export type HistoricalScoreValue = 0 | 1 | 2 | 3 | 4 | 5;

export type HistoricalScoreReference = {
  key: string;
  label?: string;
  score: HistoricalScoreValue;
};

export type HistoricalComparisonCandidate = {
  id: string;
  representativeId: string;
  date: string;
  ownerName: string;
  status: string;
  scores: HistoricalScoreReference[];
};

export type HistoricalComparisonOption = {
  id: string;
  date: string;
  ownerName: string;
  status: string;
};

export type HistoricalComparisonDetail = HistoricalComparisonOption & {
  scores: HistoricalScoreReference[];
  history: HistoricalCoaching;
};

export type HistoricalComparisonResponse = {
  options: HistoricalComparisonOption[];
  selectedId?: string;
  selected?: HistoricalComparisonDetail;
};

export type CurrentComparableScore = {
  key: string;
  label: string;
  score: CoachingSimpleScore["score"];
};

export type ScoreComparisonStatus = "better" | "worse" | "equal" | "new" | "not_scored";

export type ScoreComparisonRow = CurrentComparableScore & {
  previousScore?: HistoricalScoreValue;
  difference?: number;
  status: ScoreComparisonStatus;
};

const comparableStatuses = new Set([
  "akkoord_door_vertegenwoordiger",
  "afgesloten",
  "gefinaliseerd",
  "gesloten",
  "voltooid",
]);

export function buildHistoricalComparisonOptions(input: {
  currentId: string;
  representativeId: string;
  currentDate: string;
  candidates: HistoricalComparisonCandidate[];
}): HistoricalComparisonOption[] {
  return input.candidates
    .filter((candidate) =>
      candidate.id !== input.currentId &&
      candidate.representativeId === input.representativeId &&
      candidate.date < input.currentDate &&
      isHistoricalComparisonStatus(candidate.status) &&
      candidate.scores.length > 0
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .map(({ id, date, ownerName, status }) => ({ id, date, ownerName, status }));
}

export function isHistoricalComparisonStatus(status: string) {
  return comparableStatuses.has(status.toLocaleLowerCase("nl-BE"));
}

export function buildHistoricalScoreLookup(scores: HistoricalScoreReference[]) {
  return new Map(scores.map((score) => [score.key, score]));
}

export function compareScoreRows(
  currentScores: CurrentComparableScore[],
  historicalScores: Map<string, HistoricalScoreReference>
): ScoreComparisonRow[] {
  return currentScores.map((score) => {
    const previousScore = historicalScores.get(score.key)?.score;
    if (typeof score.score !== "number") {
      return { ...score, previousScore, status: "not_scored" };
    }
    if (previousScore === undefined) {
      return { ...score, status: "new" };
    }
    const difference = score.score - previousScore;
    return {
      ...score,
      previousScore,
      difference,
      status: difference > 0 ? "better" : difference < 0 ? "worse" : "equal",
    };
  });
}

export function historicalScoreKey(category: string, criterion: string) {
  return `${normaliseScorePart(category)}::${normaliseScorePart(criterion)}`;
}

function normaliseScorePart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-BE");
}
