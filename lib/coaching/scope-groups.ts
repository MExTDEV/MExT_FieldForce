import type { MockUser } from "@/lib/types";

export type CoachingScopeGroupItem = {
  id: string;
  country: string;
  teamId: string;
  team: string;
  representativeId: string;
  person: string;
};

export type CoachingScopeUserGroup<T extends CoachingScopeGroupItem> = {
  id: string;
  name: string;
  items: T[];
};

export type CoachingScopeTeamGroup<T extends CoachingScopeGroupItem> = {
  id: string;
  name: string;
  users: CoachingScopeUserGroup<T>[];
};

export type CoachingScopeCountryGroup<T extends CoachingScopeGroupItem> = {
  id: string;
  name: string;
  teams: CoachingScopeTeamGroup<T>[];
};

export type CoachingScopeGroups<T extends CoachingScopeGroupItem> = {
  enabled: boolean;
  showCountry: boolean;
  countries: CoachingScopeCountryGroup<T>[];
};

const groupingRoles = new Set(["COUNTRY_MANAGER", "SALES_MANAGER", "ADMIN", "SUPER_ADMIN"]);

export function buildCoachingScopeGroups<T extends CoachingScopeGroupItem>(
  currentUser: MockUser,
  items: T[]
): CoachingScopeGroups<T> {
  const enabled = groupingRoles.has(currentUser.role);
  if (!enabled) return { enabled: false, showCountry: false, countries: [] };

  const countries = [...groupCountries(items).values()]
    .map((country) => ({
      id: country.id,
      name: country.name,
      teams: [...country.teams.values()]
        .map((team) => ({
          id: team.id,
          name: team.name,
          users: [...team.users.values()]
            .map((user) => ({
              id: user.id,
              name: user.name,
              items: user.items,
            }))
            .sort((left, right) => compareLabel(left.name, right.name)),
        }))
        .sort((left, right) => compareLabel(left.name, right.name)),
    }))
    .sort((left, right) => compareLabel(left.name, right.name));

  return {
    enabled,
    showCountry: shouldShowCountryGrouping(currentUser, items),
    countries,
  };
}

export function shouldShowCountryGrouping(
  currentUser: MockUser,
  items: CoachingScopeGroupItem[]
) {
  if (currentUser.role === "SUPER_ADMIN") return true;

  const visibleCountries = new Set(items.map((item) => item.country).filter(Boolean));
  if (visibleCountries.size > 1) return true;

  const scopedCountries = new Set(currentUser.countryAccess ?? []);
  if (scopedCountries.size > 1) return true;

  return false;
}

function groupCountries<T extends CoachingScopeGroupItem>(items: T[]) {
  const countries = new Map<string, {
    id: string;
    name: string;
    teams: Map<string, {
      id: string;
      name: string;
      users: Map<string, {
        id: string;
        name: string;
        items: T[];
      }>;
    }>;
  }>();

  for (const item of items) {
    const countryId = item.country || "ONBEKEND";
    const teamId = item.teamId || "geen-team";
    const userId = item.representativeId || item.person;
    const country = countries.get(countryId) ?? {
      id: countryId,
      name: countryId,
      teams: new Map(),
    };
    const team = country.teams.get(teamId) ?? {
      id: teamId,
      name: item.team || "Geen team",
      users: new Map(),
    };
    const user = team.users.get(userId) ?? {
      id: userId,
      name: item.person || "Onbekend",
      items: [],
    };
    user.items.push(item);
    team.users.set(userId, user);
    country.teams.set(teamId, team);
    countries.set(countryId, country);
  }

  return countries;
}

function compareLabel(left: string, right: string) {
  return left.localeCompare(right, "nl-BE");
}
