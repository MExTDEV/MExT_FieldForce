import type { Country } from "@/lib/types";
import { prisma } from "@/lib/server/db";

export type HolidayLike = {
  country: Country;
  date: Date | string;
  active: boolean;
};

export async function addBusinessDaysForCountry(input: {
  country: Country;
  from: Date;
  businessDays: number;
}) {
  const holidays = await prisma.holiday.findMany({
    where: {
      country: input.country,
      active: true,
      date: {
        gte: startOfDay(input.from),
      },
    },
    select: { country: true, date: true, active: true },
  });
  return addBusinessDays(input.from, input.businessDays, input.country, holidays);
}

export function addBusinessDays(
  from: Date,
  businessDays: number,
  country: Country,
  holidays: HolidayLike[]
) {
  if (businessDays < 0) throw new Error("Aantal werkdagen mag niet negatief zijn.");
  const holidayKeys = new Set(
    holidays
      .filter((holiday) => holiday.active && holiday.country === country)
      .map((holiday) => dateKey(new Date(holiday.date)))
  );
  let cursor = startOfDay(from);
  let counted = 0;
  while (counted < businessDays) {
    cursor = addCalendarDays(cursor, 1);
    if (isBusinessDay(cursor, holidayKeys)) counted += 1;
  }
  return endOfDay(cursor);
}

export function isBusinessDay(date: Date, holidayKeys = new Set<string>()) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidayKeys.has(dateKey(date));
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
