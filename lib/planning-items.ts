export type PlanningItemSource = "FIELD_FORCE" | "EXTERNAL_CALENDAR";

export type PlanningItemType =
  | "COACHING"
  | "CONTACT_MOMENT"
  | "RETRAINING"
  | "SALES_TRAINING"
  | "HELP_REQUEST"
  | "OUTLOOK_APPOINTMENT";

export type SortablePlanningItem = {
  id: string;
  date: string;
  planningSource: PlanningItemSource;
  planningType: PlanningItemType;
  startTime?: string;
  endTime?: string;
  startMinutes?: number;
  endMinutes?: number;
};

export type PlanningLayoutItem<T extends SortablePlanningItem> = T & {
  layoutColumn: number;
  layoutColumnCount: number;
  layoutOrder: number;
};

export type FieldForceCalendarLink = {
  outlookEventId?: string | null;
  outlookICalUId?: string | null;
};

export type ExternalCalendarLink = {
  id?: string | null;
  iCalUId?: string | null;
};

const sourcePriority: Record<PlanningItemSource, number> = {
  FIELD_FORCE: 0,
  EXTERNAL_CALENDAR: 1,
};

export function sortPlanningItems<T extends SortablePlanningItem>(items: T[]) {
  return [...items].sort(comparePlanningItems);
}

export function layoutOverlappingPlanningItems<T extends SortablePlanningItem>(
  items: T[],
): Array<PlanningLayoutItem<T>> {
  const clusters = overlappingClusters(items);
  return clusters.flatMap((cluster) => layoutCluster(cluster));
}

export function comparePlanningItems(left: SortablePlanningItem, right: SortablePlanningItem) {
  return (
    compareText(left.date, right.date) ||
    sourcePriority[left.planningSource] - sourcePriority[right.planningSource] ||
    planningStartMinutes(left) - planningStartMinutes(right) ||
    planningEndMinutes(left) - planningEndMinutes(right) ||
    compareText(left.planningType, right.planningType) ||
    compareText(left.id, right.id)
  );
}

export function planningStartMinutes(item: SortablePlanningItem) {
  return finiteNumber(item.startMinutes) ?? timeToMinutes(item.startTime) ?? 0;
}

export function planningEndMinutes(item: SortablePlanningItem) {
  return Math.max(
    planningStartMinutes(item),
    finiteNumber(item.endMinutes) ?? timeToMinutes(item.endTime) ?? planningStartMinutes(item),
  );
}

export function createExternalCalendarDedupeKeys(items: FieldForceCalendarLink[]) {
  return items.reduce(
    (keys, item) => {
      const eventId = normalizedKey(item.outlookEventId);
      const iCalUId = normalizedKey(item.outlookICalUId);
      if (eventId) keys.eventIds.add(eventId);
      if (iCalUId) keys.iCalUIds.add(iCalUId);
      return keys;
    },
    {
      eventIds: new Set<string>(),
      iCalUIds: new Set<string>(),
    },
  );
}

export function isLinkedExternalCalendarItem(
  item: ExternalCalendarLink,
  keys: ReturnType<typeof createExternalCalendarDedupeKeys>,
) {
  const eventId = normalizedKey(item.id);
  const iCalUId = normalizedKey(item.iCalUId);
  return Boolean(
    (eventId && keys.eventIds.has(eventId)) ||
    (iCalUId && keys.iCalUIds.has(iCalUId)),
  );
}

function overlappingClusters<T extends SortablePlanningItem>(items: T[]) {
  const byStart = [...items].sort((left, right) =>
    planningStartMinutes(left) - planningStartMinutes(right) ||
    planningEndMinutes(left) - planningEndMinutes(right) ||
    compareText(left.id, right.id)
  );
  const clusters: T[][] = [];
  let current: T[] = [];
  let clusterEnd = 0;

  for (const item of byStart) {
    const start = planningStartMinutes(item);
    const end = planningEndMinutes(item);
    if (current.length === 0 || start < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, end);
      continue;
    }
    clusters.push(current);
    current = [item];
    clusterEnd = end;
  }

  if (current.length > 0) clusters.push(current);
  return clusters;
}

function layoutCluster<T extends SortablePlanningItem>(cluster: T[]): Array<PlanningLayoutItem<T>> {
  const ordered = sortPlanningItems(cluster);
  const laneEnds: number[] = [];
  const laidOut = ordered.map((item, layoutOrder) => {
    const start = planningStartMinutes(item);
    const end = planningEndMinutes(item);
    let layoutColumn = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (layoutColumn === -1) {
      layoutColumn = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[layoutColumn] = end;
    }
    return { ...item, layoutColumn, layoutOrder };
  });

  const layoutColumnCount = Math.max(1, laneEnds.length);
  return laidOut.map((item) => ({ ...item, layoutColumnCount }));
}

function finiteNumber(value?: number) {
  return Number.isFinite(value) ? value : undefined;
}

function timeToMinutes(value?: string) {
  const [hours, minutes] = (value ?? "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right);
}

function normalizedKey(value?: string | null) {
  const key = value?.trim();
  return key ? key : undefined;
}
