import { normalizePerformanceScore } from "@/lib/performance-data";

export type OfficialCoachingScoreValue = number | null | "nvt" | "NVT";

/**
 * Calculates the official coaching score in percent.
 *
 * Appointment scores count for 80% and the two dossier sections together
 * count for 20%. Unscored/NVT values are excluded, while an explicit zero is
 * a valid score. This is the single calculation used by detail and list views.
 */
export function calculateOfficialCoachingScore(input: {
  dossierScores: OfficialCoachingScoreValue[];
  appointmentScores: OfficialCoachingScoreValue[][];
}) {
  const dossierScore = averagePercent(input.dossierScores);
  const appointmentAverages = input.appointmentScores
    .map(averagePercent)
    .filter((score): score is number => score !== undefined);
  const appointmentScore = appointmentAverages.length
    ? average(appointmentAverages)
    : undefined;

  if (appointmentScore === undefined && dossierScore === undefined) return undefined;
  if (appointmentScore === undefined) return dossierScore;
  if (dossierScore === undefined) return appointmentScore;
  return (appointmentScore * 0.8) + (dossierScore * 0.2);
}

export function calculateCoachingDossierScore(dossierScores: OfficialCoachingScoreValue[]) {
  return calculateAverageScorePercentage(dossierScores);
}

export function calculateAverageScorePercentage(values: OfficialCoachingScoreValue[]) {
  return averagePercent(values);
}

export function coachingScorePercentage(value: OfficialCoachingScoreValue | undefined) {
  if (value === undefined || value === null || value === "nvt" || value === "NVT") {
    return undefined;
  }
  return normalizePerformanceScore(value);
}

export function formatCoachingScorePercentage(
  value: OfficialCoachingScoreValue | undefined,
  notScoredLabel = "—",
) {
  const percentage = coachingScorePercentage(value);
  return percentage === undefined ? notScoredLabel : `${percentage}%`;
}

export function formatCoachingScoreDifference(
  current: OfficialCoachingScoreValue | undefined,
  previous: OfficialCoachingScoreValue | undefined,
  emptyLabel = "—",
) {
  const currentPercentage = coachingScorePercentage(current);
  const previousPercentage = coachingScorePercentage(previous);
  if (currentPercentage === undefined || previousPercentage === undefined) return emptyLabel;
  const difference = currentPercentage - previousPercentage;
  return `${difference > 0 ? "+" : ""}${difference}%`;
}

function averagePercent(values: OfficialCoachingScoreValue[]) {
  const scored = values.flatMap((value) => {
    if (value === null || value === "nvt" || value === "NVT") return [];
    return [normalizePerformanceScore(value)];
  });
  return scored.length ? average(scored) : undefined;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
