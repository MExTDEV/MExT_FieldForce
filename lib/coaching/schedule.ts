const coachingTimeZones: Record<string, string> = {
  BE: "Europe/Brussels",
  NL: "Europe/Amsterdam",
  DE: "Europe/Berlin",
};

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
