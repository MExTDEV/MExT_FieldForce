import type { CoachingFrameworkFocus, CoachingSimpleScore } from "@/lib/types";
import { splitCriterionLabel } from "@/lib/performance-data";
import { calculateAverageScorePercentage } from "@/lib/coaching/score";

export type AppointmentScoreGroup = {
  name: string;
  average?: number;
  scores: CoachingSimpleScore[];
};

type GroupBuilder = {
  name: string;
  configuredOrder: number;
  firstScoreOrder: number;
  scores: Array<{ score: CoachingSimpleScore; criterionOrder: number; scoreOrder: number }>;
};

export function groupAppointmentScores(
  scores: CoachingSimpleScore[],
  framework: CoachingFrameworkFocus[],
): AppointmentScoreGroup[] {
  const groups = new Map<string, GroupBuilder>();

  scores.forEach((score, scoreOrder) => {
    const parsed = splitCriterionLabel(score.criterion);
    const configuredFocus = framework.find((focus) => focus.name === parsed.focus);
    const name = configuredFocus?.name ?? parsed.focus ?? "Algemeen";
    const group = groups.get(name) ?? {
      name,
      configuredOrder: configuredFocus ? framework.indexOf(configuredFocus) : Number.MAX_SAFE_INTEGER,
      firstScoreOrder: scoreOrder,
      scores: [],
    };
    const configuredCriterionOrder = configuredFocus?.criteria.indexOf(parsed.criterion) ?? -1;
    group.scores.push({
      score,
      criterionOrder: configuredCriterionOrder >= 0 ? configuredCriterionOrder : Number.MAX_SAFE_INTEGER,
      scoreOrder,
    });
    groups.set(name, group);
  });

  return [...groups.values()]
    .sort((left, right) => left.configuredOrder - right.configuredOrder || left.firstScoreOrder - right.firstScoreOrder)
    .map((group) => {
      const orderedScores = [...group.scores]
        .sort((left, right) => left.criterionOrder - right.criterionOrder || left.scoreOrder - right.scoreOrder)
        .map((item) => item.score);
      return {
        name: group.name,
        average: calculateAverageScorePercentage(orderedScores.map((score) => score.score)),
        scores: orderedScores,
      };
    });
}
