import type { KpiEvaluationDirection, KpiUnit } from "@/lib/types";

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

export function isKpiUnit(value: string): value is KpiUnit {
  return kpiUnitOptions.some((option) => option.value === value);
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
