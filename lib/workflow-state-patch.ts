import { dedupeWorkflowState } from "@/lib/coaching/visibility";
import type { WorkflowState } from "@/lib/types";

export type WorkflowStatePatch = Partial<Pick<
  WorkflowState,
  | "interventions"
  | "reflections"
  | "approvals"
  | "contactMoments"
  | "helpRequests"
  | "retrainings"
  | "salesTrainings"
>>;

export type WorkflowPatchSyncResult = {
  interventionId: string;
  outlookEventId?: string;
  outlookICalUId?: string;
  outlookSyncStatus: "NOT_SYNCED" | "SYNCED" | "ERROR";
  lastSyncedAt?: string;
  syncError?: string;
};

export function applyOutlookSyncToWorkflowStatePatch(
  patch: WorkflowStatePatch,
  outlookSync?: WorkflowPatchSyncResult[]
): WorkflowStatePatch {
  if (!outlookSync?.length) return patch;
  return {
    ...patch,
    interventions: patch.interventions?.map((intervention) => applyOutlookSync(intervention, outlookSync)),
    contactMoments: patch.contactMoments?.map((contactMoment) => applyOutlookSync(contactMoment, outlookSync)),
  };
}

export function mergeWorkflowStatePatch(current: WorkflowState, patch: WorkflowStatePatch): WorkflowState {
  return dedupeWorkflowState({
    ...current,
    interventions: mergeById(current.interventions, patch.interventions),
    reflections: mergeById(current.reflections, patch.reflections),
    approvals: mergeById(current.approvals, patch.approvals),
    contactMoments: mergeById(current.contactMoments, patch.contactMoments),
    helpRequests: mergeById(current.helpRequests, patch.helpRequests),
    retrainings: mergeById(current.retrainings, patch.retrainings),
    salesTrainings: mergeById(current.salesTrainings, patch.salesTrainings),
  });
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[] = []) {
  if (!incoming.length) return current;
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...current.filter((item) => !incomingIds.has(item.id)), ...incoming];
}

function applyOutlookSync<T extends { id: string }>(
  item: T,
  outlookSync: WorkflowPatchSyncResult[]
) {
  const sync = outlookSync.find((syncItem) => syncItem.interventionId === item.id);
  return sync ? { ...item, ...sync, id: item.id } : item;
}
