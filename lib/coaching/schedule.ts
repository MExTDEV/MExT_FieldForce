const coachingTimeZones: Record<string, string> = {
  BE: "Europe/Brussels",
  NL: "Europe/Amsterdam",
  DE: "Europe/Berlin",
};

export const coachingApprovalOverrideDelayDays = 14;
export const coachingApprovalOverrideTimeZone = "Europe/Brussels";

/**
 * A manual approval may only be used after the exact stored approval-request
 * instant plus fourteen calendar days in the application timezone.
 */
export function isCoachingApprovalOverrideDue(input: {
  sentForApprovalAt?: string | Date | null;
  now?: Date;
  timeZone?: string;
}) {
  if (!input.sentForApprovalAt) return false;
  const sentAt = new Date(input.sentForApprovalAt);
  if (Number.isNaN(sentAt.getTime())) return false;
  const deadline = addCalendarDaysInTimeZone(
    sentAt,
    coachingApprovalOverrideDelayDays,
    input.timeZone ?? coachingApprovalOverrideTimeZone
  );
  return (input.now ?? new Date()).getTime() >= deadline.getTime();
}

export function latestCoachingApprovalOverrideSentAt(
  now = new Date(),
  timeZone = coachingApprovalOverrideTimeZone
) {
  return addCalendarDaysInTimeZone(now, -coachingApprovalOverrideDelayDays, timeZone);
}

export function addCalendarDaysInTimeZone(date: Date, days: number, timeZone = coachingApprovalOverrideTimeZone) {
  const parts = datePartsInTimeZone(date, timeZone);
  const normalized = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second, parts.millisecond));
  return zonedTimeToUtc({
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: parts.millisecond,
  }, timeZone);
}

export function isScheduledCoachingEndPast(input: {
  plannedDate?: string;
  endTime?: string;
  country: string;
  now?: Date;
}) {
  if (!input.plannedDate) return false;
  const timeZone = coachingTimeZones[input.country] ?? "Europe/Brussels";
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(input.now ?? new Date());
  const values = Object.fromEntries(current.map((part) => [part.type, part.value]));
  const currentKey = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  const scheduledEnd = /^\d{2}:\d{2}$/.test(input.endTime ?? "") ? input.endTime! : "23:59";
  return `${input.plannedDate}T${scheduledEnd}` < currentKey;
}

function datePartsInTimeZone(date: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(formatted.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    millisecond: date.getUTCMilliseconds(),
  };
}

function zonedTimeToUtc(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}, timeZone: string) {
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  let candidate = new Date(targetUtc);
  for (let index = 0; index < 3; index += 1) {
    const current = datePartsInTimeZone(candidate, timeZone);
    const currentUtc = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute, current.second, current.millisecond);
    const delta = targetUtc - currentUtc;
    if (delta === 0) break;
    candidate = new Date(candidate.getTime() + delta);
  }
  return candidate;
}
