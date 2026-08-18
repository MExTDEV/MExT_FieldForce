import { completedCoachingStatuses } from "@/lib/coaching/visibility";

export type CoachingOverviewStatusFilter = "all" | "planned" | "closed";
export type CoachingOverviewPeriodFilter = "all" | "next30Days" | "thisQuarter";

export type CoachingOverviewFilterRow = {
  status: string;
  plannedDate: string;
};

export function isActivePlannedCoaching(
  row: CoachingOverviewFilterRow,
  todayKey: string,
) {
  return row.status === "gepland" && row.plannedDate >= todayKey;
}

export function matchesCoachingOverviewStatus(
  row: CoachingOverviewFilterRow,
  filter: CoachingOverviewStatusFilter,
  todayKey: string,
) {
  if (filter === "planned") return isActivePlannedCoaching(row, todayKey);
  if (filter === "closed") {
    return completedCoachingStatuses.has(row.status) || row.status === "geannuleerd";
  }
  return true;
}

export function matchesCoachingOverviewPeriod(
  row: CoachingOverviewFilterRow,
  filter: CoachingOverviewPeriodFilter,
  todayKey: string,
) {
  if (filter === "all") return true;
  const date = parseDateKey(row.plannedDate);
  const today = parseDateKey(todayKey);
  if (!date || !today) return false;
  if (filter === "next30Days") {
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 30);
    return date >= today && date <= end;
  }
  const quarterStartMonth = Math.floor(today.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth, 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth + 3, 1));
  return date >= start && date < end;
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
