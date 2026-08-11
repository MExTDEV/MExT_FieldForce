export const ACTION_POINT_CLOSE_REASONS = [
  "GOAL_REACHED",
  "NO_LONGER_APPLICABLE",
  "RESOLVED_VIA_OTHER_ACTION",
  "NOT_FEASIBLE",
  "OTHER",
] as const;

export type ActionPointCloseReason = typeof ACTION_POINT_CLOSE_REASONS[number];

export function isActionPointCloseReason(value: unknown): value is ActionPointCloseReason {
  return typeof value === "string" && ACTION_POINT_CLOSE_REASONS.includes(value as ActionPointCloseReason);
}
