import type { Country, Role } from "@/lib/types";

export type MyTeamMember = {
  id: string;
  representativeId?: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: Role;
  country: Country;
  countryId: string;
  team: string;
  teamId: string;
  isTeamLeader: boolean;
  lastCoaching?: string;
  overallScore?: number;
  profileHref: string;
};

export function sortMyTeamMembers(members: MyTeamMember[]) {
  return [...members].sort((left, right) =>
    Number(right.isTeamLeader) - Number(left.isTeamLeader) ||
    left.lastName.localeCompare(right.lastName, "nl-BE") ||
    left.firstName.localeCompare(right.firstName, "nl-BE")
  );
}
