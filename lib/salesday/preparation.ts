import type { Country } from "@/lib/types";

export type SalesPreparationCountryConfiguration = {
  timeZone: string;
  visibleFrom: string;
  recommendationHorizonDays: number;
  singlePurchaseIntervalDays: number;
};

export type SalesPreparationConfiguration = {
  countries: Record<Country, SalesPreparationCountryConfiguration>;
};

export type PreparationHistoryDocument = {
  documentType: string;
  documentDate: Date | string;
  lines: Array<{
    articleExternalId: string;
    articleNumberSnapshot: string;
    descriptionSnapshot: string;
    quantity: string | number | { toString(): string };
    unitSnapshot: string;
  }>;
};

export const defaultSalesPreparationConfiguration: SalesPreparationConfiguration = {
  countries: {
    BE: { timeZone: "Europe/Brussels", visibleFrom: "16:30", recommendationHorizonDays: 30, singlePurchaseIntervalDays: 180 },
    NL: { timeZone: "Europe/Amsterdam", visibleFrom: "16:30", recommendationHorizonDays: 30, singlePurchaseIntervalDays: 180 },
    DE: { timeZone: "Europe/Berlin", visibleFrom: "16:30", recommendationHorizonDays: 30, singlePurchaseIntervalDays: 180 },
  },
};

export function parseSalesPreparationConfiguration(value: string | null | undefined) {
  if (!value) return structuredClone(defaultSalesPreparationConfiguration);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("De SalesDay-voorbereidingsconfiguratie is geen geldige JSON.");
  }
  if (!isRecord(parsed) || !isRecord(parsed.countries)) throw new Error("De SalesDay-voorbereidingsconfiguratie mist landen.");
  const parsedCountries = parsed.countries;
  const countries = Object.fromEntries((["BE", "NL", "DE"] as const).map((country) => {
    const current = parsedCountries[country];
    if (!isRecord(current)) throw new Error(`De voorbereidingsconfiguratie voor ${country} ontbreekt.`);
    const visibleFrom = String(current.visibleFrom ?? "");
    const timeZone = String(current.timeZone ?? "");
    const recommendationHorizonDays = Number(current.recommendationHorizonDays);
    const singlePurchaseIntervalDays = Number(current.singlePurchaseIntervalDays);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(visibleFrom)) throw new Error(`Het zichtbaarheidstijdstip voor ${country} is ongeldig.`);
    try { new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); } catch { throw new Error(`De tijdzone voor ${country} is ongeldig.`); }
    if (!Number.isInteger(recommendationHorizonDays) || recommendationHorizonDays < 0 || recommendationHorizonDays > 365) {
      throw new Error(`De aanbevelingshorizon voor ${country} is ongeldig.`);
    }
    if (!Number.isInteger(singlePurchaseIntervalDays) || singlePurchaseIntervalDays < 1 || singlePurchaseIntervalDays > 730) {
      throw new Error(`Het standaardinterval voor ${country} is ongeldig.`);
    }
    return [country, { timeZone, visibleFrom, recommendationHorizonDays, singlePurchaseIntervalDays }];
  }));
  return { countries } as SalesPreparationConfiguration;
}

export function countryLocalDateTime(now: Date, configuration: SalesPreparationCountryConfiguration) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: configuration.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}

export function nextEffectiveBusinessDate(currentDate: string, holidays: Array<Date | string>) {
  const holidayKeys = new Set(holidays.map(dateKey));
  const cursor = parseDate(currentDate);
  for (let offset = 1; offset <= 370; offset += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    const key = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidayKeys.has(key)) return key;
  }
  throw new Error("De volgende effectieve werkdag kon niet worden bepaald.");
}

export function buildPreparationRecommendations(input: {
  appointmentBusinessDate: string;
  configuration: SalesPreparationCountryConfiguration;
  documents: PreparationHistoryDocument[];
}) {
  const byArticle = new Map<string, {
    articleExternalId: string;
    articleNumber: string;
    description: string;
    unit: string;
    purchases: Array<{ date: string; quantity: number }>;
  }>();
  for (const document of input.documents) {
    if (document.documentType !== "INVOICE") continue;
    const date = dateKey(document.documentDate);
    for (const line of document.lines) {
      const quantity = Number(line.quantity.toString());
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      const current = byArticle.get(line.articleExternalId) ?? {
        articleExternalId: line.articleExternalId,
        articleNumber: line.articleNumberSnapshot,
        description: line.descriptionSnapshot,
        unit: line.unitSnapshot,
        purchases: [],
      };
      current.purchases.push({ date, quantity });
      byArticle.set(line.articleExternalId, current);
    }
  }
  const appointment = parseDate(input.appointmentBusinessDate);
  return [...byArticle.values()].flatMap((article) => {
    article.purchases.sort((left, right) => left.date.localeCompare(right.date));
    const uniqueDates = [...new Set(article.purchases.map((purchase) => purchase.date))];
    const intervals = uniqueDates.slice(1).map((date, index) => daysBetween(uniqueDates[index], date));
    const intervalDays = intervals.length
      ? Math.max(1, Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length))
      : input.configuration.singlePurchaseIntervalDays;
    const lastPurchaseDate = uniqueDates.at(-1)!;
    const expectedDate = parseDate(lastPurchaseDate);
    expectedDate.setUTCDate(expectedDate.getUTCDate() + intervalDays);
    const daysUntilExpected = Math.round((expectedDate.getTime() - appointment.getTime()) / 86_400_000);
    if (daysUntilExpected > input.configuration.recommendationHorizonDays) return [];
    return [{
      articleExternalId: article.articleExternalId,
      articleNumber: article.articleNumber,
      description: article.description,
      unit: article.unit,
      reasonCode: "EXPECTED_REORDER_DUE" as const,
      lastPurchaseDate,
      purchaseCount: uniqueDates.length,
      averageIntervalDays: intervalDays,
      expectedReorderDate: expectedDate.toISOString().slice(0, 10),
      daysUntilExpected,
      averageQuantity: article.purchases.reduce((sum, purchase) => sum + purchase.quantity, 0) / article.purchases.length,
    }];
  }).sort((left, right) => left.daysUntilExpected - right.daysUntilExpected || left.articleNumber.localeCompare(right.articleNumber));
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ongeldige kalenderdatum.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Ongeldige kalenderdatum.");
  return date;
}

function dateKey(value: Date | string) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function daysBetween(left: string, right: string) {
  return Math.round((parseDate(right).getTime() - parseDate(left).getTime()) / 86_400_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
