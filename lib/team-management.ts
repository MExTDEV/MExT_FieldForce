export const unassignedTeamLeaderLabel = "Geen verkoopleider toegewezen";

export function normalizeOptionalTeamLeaderId(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function optionalTeamLeaderLabel(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : unassignedTeamLeaderLabel;
}
