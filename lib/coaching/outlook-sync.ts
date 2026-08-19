type OutlookCoachingSnapshot = Record<string, unknown>;

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

export function shouldSyncCoachingOutlook(
  current: OutlookCoachingCandidate,
  previous?: OutlookCoachingSnapshot
) {
  if (!previous) return true;

  const fieldsChanged =
    text(previous.title) !== text(current.title) ||
    text(previous.representativeId) !== text(current.representativeId) ||
    text(previous.ownerId) !== text(current.ownerId) ||
    date(previous.plannedAt) !== date(current.plannedDate) ||
    text(previous.startTime) !== text(current.startTime) ||
    text(previous.endTime) !== text(current.endTime) ||
    Boolean(previous.notifyRepresentative) !== Boolean(current.notifyRepresentative);

  if (fieldsChanged) return true;

  const previousDeleted = Boolean(previous.deletedAt) || isCancelled(previous.status);
  const currentDeleted = Boolean(current.deletedAt) || isCancelled(current.status);
  return previousDeleted !== currentDeleted;
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
