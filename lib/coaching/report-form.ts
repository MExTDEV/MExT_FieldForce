import type {
  CoachingDossier,
  CoachingSimpleScore,
  WorkflowActionPoint,
} from "@/lib/types";
import { isBlankRichText } from "@/lib/rich-text";

export type CoachingReportStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type CoachingReportIssue = {
  code:
    | "general_score_missing"
    | "personality_score_missing"
    | "action_point_missing"
    | "action_point_title_missing"
    | "action_point_priority_missing"
    | "action_point_tips_missing";
  step: CoachingReportStepId;
  criterion?: string;
  actionId?: string;
};

export type CoachingReportValidationInput = {
  dossier?: CoachingDossier;
  actionPoints: WorkflowActionPoint[];
};

export function coachingReportIssues(input: CoachingReportValidationInput): CoachingReportIssue[] {
  const issues: CoachingReportIssue[] = [];

  if (!input.dossier?.generalScores.length) {
    issues.push({ code: "general_score_missing", step: 3 });
  } else {
    for (const score of input.dossier.generalScores) {
      if (!hasExplicitScore(score)) {
        issues.push({ code: "general_score_missing", step: 3, criterion: score.criterion });
      }
    }
  }
  if (!input.dossier?.personalityScores.length) {
    issues.push({ code: "personality_score_missing", step: 4 });
  } else {
    for (const score of input.dossier.personalityScores) {
      if (!hasExplicitScore(score)) {
        issues.push({ code: "personality_score_missing", step: 4, criterion: score.criterion });
      }
    }
  }

  const newActions = input.actionPoints.filter((action) => action.isNew);
  if (!newActions.some((action) => action.title.trim())) {
    issues.push({ code: "action_point_missing", step: 6 });
  }
  for (const action of newActions) {
    if (!action.title.trim()) {
      issues.push({ code: "action_point_title_missing", step: 6, actionId: action.id });
    }
    if (!action.priority) {
      issues.push({ code: "action_point_priority_missing", step: 6, actionId: action.id });
    }
    if (isBlankRichText(action.tipsAndTricks)) {
      issues.push({ code: "action_point_tips_missing", step: 6, actionId: action.id });
    }
  }

  return issues;
}

export function hasExplicitScore(score: Pick<CoachingSimpleScore, "score">) {
  return score.score !== null;
}

export function missingScores(scores: CoachingSimpleScore[]) {
  return scores.filter((score) => !hasExplicitScore(score));
}

export function firstIssueForStep(issues: CoachingReportIssue[], step: CoachingReportStepId) {
  return issues.find((issue) => issue.step === step);
}
