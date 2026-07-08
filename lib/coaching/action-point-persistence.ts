import type { WorkflowActionPoint } from "@/lib/types";

export type PersistableCoachingActionPoint = Omit<WorkflowActionPoint, "id" | "status">;

export function toPersistableCoachingActionPoints(
  actions: WorkflowActionPoint[]
): PersistableCoachingActionPoint[] {
  return actions.map((action) => ({
    title: action.title,
    type: action.type,
    due: action.due,
    owner: action.owner,
    priority: action.priority,
    description: action.description,
    tipsAndTricks: action.tipsAndTricks,
    targetValue: action.targetValue,
    achievedScore: action.achievedScore,
    definitionId: action.definitionId,
    isNew: action.isNew,
  }));
}
