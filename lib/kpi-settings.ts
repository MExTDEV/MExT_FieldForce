import type {
  Country,
  KpiEvaluationDirection,
  KpiPeriodType,
  KpiTargetScope,
  KpiUnit,
  KpiValueType,
  Role,
} from "@/lib/types";

export const kpiUnitOptions: { value: KpiUnit; label: string }[] = [
  { value: "%", label: "Percentage" },
  { value: "EUR", label: "Euro" },
  { value: "count", label: "Aantal" },
  { value: "minutes", label: "Minuten" },
  { value: "hours", label: "Uren" },
  { value: "km", label: "Kilometer" },
  { value: "number", label: "Vrije numerieke waarde" },
];

export const kpiEvaluationLabels: Record<KpiEvaluationDirection, string> = {
  HIGHER_IS_BETTER: "Hoger is beter",
  LOWER_IS_BETTER: "Lager is beter",
  TARGET: "Exact doel",
};

export const kpiTargetScopeLabels: Record<KpiTargetScope, string> = {
  GLOBAL: "Globaal",
  COUNTRY: "Land",
  TEAM: "Team",
  USER: "Gebruiker",
  ROLE: "Rol",
};

export const kpiPeriodTypeLabels: Record<KpiPeriodType, string> = {
  DAY: "Dag",
  WEEK: "Week",
  MONTH: "Maand",
  QUARTER: "Kwartaal",
  YEAR: "Jaar",
  CUSTOM: "Vrije periode",
};

export const kpiValueTypeLabels: Record<KpiValueType, string> = {
  NUMBER: "Getal",
  DECIMAL: "Decimaal",
  CURRENCY: "Valuta",
  BOOLEAN: "Ja/nee",
  SCORE: "Score",
};

export const kpiCategorySeed = [
  { id: "kpicat_sales", code: "SALES", name: "Sales", description: "KPI's rond commerciële resultaten.", sortOrder: 10 },
  { id: "kpicat_visits", code: "VISITS", name: "Bezoeken", description: "KPI's rond bezoekplanning en bezoekkwaliteit.", sortOrder: 20 },
  { id: "kpicat_orders", code: "ORDERS", name: "Orders", description: "KPI's rond orders en ordermix.", sortOrder: 30 },
  { id: "kpicat_turnover", code: "TURNOVER", name: "Omzet", description: "KPI's rond omzet en gemiddelde orderwaarde.", sortOrder: 40 },
  { id: "kpicat_coaching", code: "COACHING", name: "Coaching", description: "KPI's rond coaching en opvolging.", sortOrder: 50 },
  { id: "kpicat_service", code: "SERVICE", name: "Service", description: "KPI's rond service en klantopvolging.", sortOrder: 60 },
  { id: "kpicat_custom", code: "CUSTOM", name: "Vrij", description: "Vrij configureerbare KPI's.", sortOrder: 70 },
] as const;

export const kpiTypeSeed = [
  { id: "kpitype_number", code: "NUMBER", name: "Aantal", description: "Hele of vrije numerieke waarde.", valueType: "NUMBER" as const, sortOrder: 10 },
  { id: "kpitype_percentage", code: "PERCENTAGE", name: "Percentage", description: "Procentuele waarde.", valueType: "DECIMAL" as const, sortOrder: 20 },
  { id: "kpitype_currency", code: "CURRENCY", name: "Valuta", description: "Bedrag in euro.", valueType: "CURRENCY" as const, sortOrder: 30 },
  { id: "kpitype_boolean", code: "BOOLEAN", name: "Ja/nee", description: "Booleaanse KPI.", valueType: "BOOLEAN" as const, sortOrder: 40 },
  { id: "kpitype_score", code: "SCORE", name: "Score", description: "Score of indexwaarde.", valueType: "SCORE" as const, sortOrder: 50 },
] as const;

export const kpiTargetTypeSeed = [
  { id: "kpitarget_global", code: "GLOBAL" as const, name: "Globaal", description: "Doel geldt voor iedereen.", sortOrder: 10 },
  { id: "kpitarget_country", code: "COUNTRY" as const, name: "Land", description: "Doel geldt voor een land.", sortOrder: 20 },
  { id: "kpitarget_team", code: "TEAM" as const, name: "Team", description: "Doel geldt voor een team.", sortOrder: 30 },
  { id: "kpitarget_user", code: "USER" as const, name: "Gebruiker", description: "Doel geldt voor een individuele gebruiker.", sortOrder: 40 },
  { id: "kpitarget_role", code: "ROLE" as const, name: "Rol", description: "Doel geldt voor gebruikers met een rol.", sortOrder: 50 },
] as const;

export function isKpiUnit(value: string): value is KpiUnit {
  return kpiUnitOptions.some((option) => option.value === value);
}

export function isKpiTargetScope(value: string): value is KpiTargetScope {
  return value in kpiTargetScopeLabels;
}

export function isKpiPeriodType(value: string): value is KpiPeriodType {
  return value in kpiPeriodTypeLabels;
}

export function parseRequiredKpiNumber(value: unknown, label: string) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(`${label} is verplicht.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} moet numeriek zijn.`);
  return parsed;
}

export function parseOptionalKpiNumber(value: unknown, label: string) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} moet numeriek zijn.`);
  return parsed;
}

export function validateKpiRange(targetValue: number, minValue: number | null, maxValue: number | null) {
  if (minValue !== null && maxValue !== null && minValue > maxValue) {
    throw new Error("Minimumwaarde mag niet hoger zijn dan maximumwaarde.");
  }
  if (minValue !== null && targetValue < minValue) {
    throw new Error("Doelwaarde mag niet lager zijn dan minimumwaarde.");
  }
  if (maxValue !== null && targetValue > maxValue) {
    throw new Error("Doelwaarde mag niet hoger zijn dan maximumwaarde.");
  }
}

export function kpiScopeKey(scope: KpiTargetScope, input: {
  country?: Country | null;
  teamId?: string | null;
  userId?: string | null;
  role?: Role | null;
}) {
  if (scope === "GLOBAL") return "GLOBAL";
  if (scope === "COUNTRY" && input.country) return `COUNTRY:${input.country}`;
  if (scope === "TEAM" && input.teamId) return `TEAM:${input.teamId}`;
  if (scope === "USER" && input.userId) return `USER:${input.userId}`;
  if (scope === "ROLE" && input.role) return `ROLE:${input.role}`;
  throw new Error("Selecteer een geldige KPI-scope.");
}

export function validateKpiDates(validFrom: Date, validUntil: Date | null) {
  if (Number.isNaN(validFrom.getTime())) throw new Error("Begindatum is verplicht.");
  if (validUntil && Number.isNaN(validUntil.getTime())) throw new Error("Einddatum is ongeldig.");
  if (validUntil && validUntil < validFrom) throw new Error("Einddatum mag niet voor begindatum liggen.");
}
