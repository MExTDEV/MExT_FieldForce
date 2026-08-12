import type {
  CoachingScopeGroupItem,
  CoachingScopeGroups,
} from "@/lib/coaching/scope-groups";

export function normalizeCoachingSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function matchesCoachingSearch(searchText: string, searchTerm: string) {
  const normalizedTerm = normalizeCoachingSearchText(searchTerm);
  if (!normalizedTerm) return true;
  return normalizeCoachingSearchText(searchText).includes(normalizedTerm);
}

export function coachingGroupKey(
  level: "country" | "team" | "user",
  countryId: string,
  teamId?: string,
  userId?: string,
) {
  return [level, countryId, teamId, userId].filter(Boolean).join(":");
}

export function coachingSectionGroupKey(sectionKey: string, groupId: string) {
  return `${sectionKey}:${groupId}`;
}

export function collectCoachingGroupIds<T extends CoachingScopeGroupItem>(
  groups: CoachingScopeGroups<T>,
) {
  const ids = new Set<string>();
  for (const country of groups.countries) {
    if (groups.showCountry) ids.add(coachingGroupKey("country", country.id));
    for (const team of country.teams) {
      ids.add(coachingGroupKey("team", country.id, team.id));
      for (const user of team.users) {
        ids.add(coachingGroupKey("user", country.id, team.id, user.id));
      }
    }
  }
  return ids;
}
