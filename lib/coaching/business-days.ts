const DEFAULT_APPLICATION_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || process.env.APP_TIME_ZONE || "Europe/Brussels";

export function applicationDateKey(now = new Date(), timeZone = DEFAULT_APPLICATION_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Adds Monday-Friday calendar days. Holidays are intentionally not excluded. */
export function addBusinessDaysToDateKey(from: string, businessDays: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("Ongeldige datum.");
  if (!Number.isInteger(businessDays) || businessDays < 0) throw new Error("Aantal werkdagen mag niet negatief zijn.");

  const [year, month, day] = from.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  let counted = 0;
  while (counted < businessDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekDay = cursor.getUTCDay();
    if (weekDay !== 0 && weekDay !== 6) counted += 1;
  }
  return cursor.toISOString().slice(0, 10);
}

export function defaultCoachingDate(now = new Date(), timeZone = DEFAULT_APPLICATION_TIME_ZONE) {
  return addBusinessDaysToDateKey(applicationDateKey(now, timeZone), 5);
}
