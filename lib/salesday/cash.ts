import type { Country } from "@/lib/types";

export const salesDayCashCountryTimeZones: Record<Country, string> = {
  BE: "Europe/Brussels",
  NL: "Europe/Amsterdam",
  DE: "Europe/Berlin",
};

export function countryBusinessDate(country: Country, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: salesDayCashCountryTimeZones[country],
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function firstEffectiveWorkdayOfWeek(input: {
  businessDate: string;
  holidays: Array<Date | string>;
  plannedBusinessDates?: string[];
}) {
  const weekStart = mondayOfWeek(input.businessDate);
  const holidays = new Set(input.holidays.map(dateKey));
  const planned = new Set((input.plannedBusinessDates ?? []).filter(Boolean));
  const usePlanning = planned.size > 0;
  const firstFallback = firstWeekdayNotHoliday(weekStart, holidays);
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    const key = dateKey(date);
    if (isWeekend(date) || holidays.has(key)) continue;
    if (!usePlanning || planned.has(key)) return key;
  }
  return firstFallback;
}

export function isFirstEffectiveWorkday(input: {
  businessDate: string;
  holidays: Array<Date | string>;
  plannedBusinessDates?: string[];
}) {
  return input.businessDate === firstEffectiveWorkdayOfWeek(input);
}

export function weekRange(businessDate: string) {
  const start = mondayOfWeek(businessDate);
  const end = addDays(start, 6);
  return { start: dateKey(start), end: dateKey(end) };
}

function firstWeekdayNotHoliday(weekStart: Date, holidays: Set<string>) {
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    const key = dateKey(date);
    if (!isWeekend(date) && !holidays.has(key)) return key;
  }
  throw new Error("Deze week heeft geen effectieve werkdag.");
}

function mondayOfWeek(value: string) {
  const date = parseDate(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isWeekend(value: Date) {
  const day = value.getUTCDay();
  return day === 0 || day === 6;
}

function dateKey(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  assertBusinessDate(value);
  return value;
}

function parseDate(value: string) {
  assertBusinessDate(value);
  return new Date(`${value}T00:00:00.000Z`);
}

function assertBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("businessDate moet YYYY-MM-DD gebruiken.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("businessDate is geen geldige kalenderdatum.");
  }
}
