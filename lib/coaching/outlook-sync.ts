type OutlookCoachingSnapshot = Record<string, unknown>;

export type CoachingOutlookSyncStatus = "NOT_SYNCED" | "SYNCED" | "ERROR";

type OutlookCoachingCandidate = {
  title?: string;
  status?: string;
  representativeId?: string;
  ownerId?: string;
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  deletedAt?: string;
};

export function isCoachingOutlookSyncRelevant(status: unknown) {
  return text(status).toLowerCase() === "gepland";
}

export function shouldSyncCoachingOutlook(
  current: OutlookCoachingCandidate,
  previous?: OutlookCoachingSnapshot
) {
  if (!previous) return isCoachingOutlookSyncRelevant(current.status);

  const previousCancelled = Boolean(previous.deletedAt) || isCancelled(previous.status);
  const currentCancelled = Boolean(current.deletedAt) || isCancelled(current.status);
  if (!previousCancelled && currentCancelled) return true;

  const currentRelevant = isCoachingOutlookSyncRelevant(current.status);
  if (!currentRelevant) return false;
  if (!isCoachingOutlookSyncRelevant(previous.status)) return true;

  return (
    text(previous.title) !== text(current.title) ||
    text(previous.representativeId) !== text(current.representativeId) ||
    text(previous.ownerId) !== text(current.ownerId) ||
    date(previous.plannedAt) !== date(current.plannedDate) ||
    text(previous.startTime) !== text(current.startTime) ||
    text(previous.endTime) !== text(current.endTime) ||
    Boolean(previous.notifyRepresentative) !== Boolean(current.notifyRepresentative)
  );
}

export function nextCoachingOutlookSyncState(
  current: OutlookCoachingCandidate,
  previous?: OutlookCoachingSnapshot
): { outlookSyncStatus: CoachingOutlookSyncStatus; syncError?: string } {
  if (shouldSyncCoachingOutlook(current, previous)) {
    return { outlookSyncStatus: "NOT_SYNCED" };
  }

  const previousStatus = normalizeSyncStatus(previous?.outlookSyncStatus);
  const canHealInterruptedStatus =
    previousStatus === "NOT_SYNCED" &&
    Boolean(previous?.outlookEventId) &&
    Boolean(previous?.lastSyncedAt) &&
    !previous?.syncError;
  if (canHealInterruptedStatus) {
    return { outlookSyncStatus: "SYNCED" };
  }

  return {
    outlookSyncStatus: previousStatus ?? "NOT_SYNCED",
    syncError: text(previous?.syncError) || undefined,
  };
}

function normalizeSyncStatus(value: unknown): CoachingOutlookSyncStatus | undefined {
  return value === "NOT_SYNCED" || value === "SYNCED" || value === "ERROR"
    ? value
    : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function date(value: unknown) {
  return text(value).slice(0, 10);
}

function isCancelled(value: unknown) {
  const status = text(value).toLowerCase();
  return status === "geannuleerd" || status === "niet_uitgevoerd";
}
