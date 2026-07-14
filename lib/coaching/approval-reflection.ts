import { isBlankRichText, sanitizeRichText } from "@/lib/rich-text";

export type ApprovalReflectionInput = {
  reflectionKpiHtml?: string | null;
  reflectionLearningHtml?: string | null;
  reflectionGoalHtml?: string | null;
};

type CompletedApprovalReflectionInput = ApprovalReflectionInput & {
  reflectionCompletedAt?: string | Date | null;
};

export const approvalReflectionFields = [
  "reflectionKpiHtml",
  "reflectionLearningHtml",
  "reflectionGoalHtml",
] as const;

export function sanitizeApprovalReflection(input: ApprovalReflectionInput) {
  return {
    reflectionKpiHtml: sanitizeRichText(input.reflectionKpiHtml ?? ""),
    reflectionLearningHtml: sanitizeRichText(input.reflectionLearningHtml ?? ""),
    reflectionGoalHtml: sanitizeRichText(input.reflectionGoalHtml ?? ""),
  };
}

export function approvalReflectionErrors(input: ApprovalReflectionInput) {
  const sanitized = sanitizeApprovalReflection(input);
  return {
    reflectionKpiHtml: isBlankRichText(sanitized.reflectionKpiHtml),
    reflectionLearningHtml: isBlankRichText(sanitized.reflectionLearningHtml),
    reflectionGoalHtml: isBlankRichText(sanitized.reflectionGoalHtml),
  };
}

export function isApprovalReflectionComplete(input: ApprovalReflectionInput) {
  const errors = approvalReflectionErrors(input);
  return !errors.reflectionKpiHtml && !errors.reflectionLearningHtml && !errors.reflectionGoalHtml;
}

export function approvalHasCompletedReflection(approval?: CompletedApprovalReflectionInput | null) {
  return Boolean(approval?.reflectionCompletedAt) && isApprovalReflectionComplete(approval ?? {});
}
