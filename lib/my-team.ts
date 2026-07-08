import { can } from "@/lib/permissions";
import { localDateKey } from "@/lib/coaching/visibility";
import type { AppModuleConfig, Country, MockUser, Role } from "@/lib/types";

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
  hasPlannedCoaching?: boolean;
  profileHref: string;
};

export type PlannedCoachingIndicatorSource = {
  representativeId: string;
  status: string;
  plannedDate?: string;
  updatedAt: string;
  subject?: {
    id?: string;
    userId?: string;
  };
};

export function sortMyTeamMembers(members: MyTeamMember[]) {
  return [...members].sort((left, right) =>
    Number(right.isTeamLeader) - Number(left.isTeamLeader) ||
    left.lastName.localeCompare(right.lastName, "nl-BE") ||
    left.firstName.localeCompare(right.firstName, "nl-BE")
  );
}

export function canShowPlannedCoachingIndicator(
  user: MockUser,
  modules: AppModuleConfig[]
) {
  return modules.some((module) => module.code === "BEGELEIDINGEN" && module.enabled) &&
    can(user, "moduleVisitRecord");
}

export function isPlannedCoachingIndicatorCandidate(
  intervention: PlannedCoachingIndicatorSource,
  todayKey = localDateKey()
) {
  const plannedDate = intervention.plannedDate ?? intervention.updatedAt.slice(0, 10);
  return intervention.status === "gepland" && plannedDate >= todayKey;
}

export function isCoachingForMyTeamMember(
  member: MyTeamMember,
  intervention: PlannedCoachingIndicatorSource
) {
  const targetIds = new Set(
    [member.id, member.representativeId].filter(Boolean) as string[]
  );
  return targetIds.has(intervention.representativeId) ||
    Boolean(intervention.subject?.id && targetIds.has(intervention.subject.id)) ||
    Boolean(intervention.subject?.userId && targetIds.has(intervention.subject.userId));
}

export function withPlannedCoachingIndicators(
  members: MyTeamMember[],
  interventions: PlannedCoachingIndicatorSource[],
  todayKey = localDateKey()
) {
  const plannedInterventions = interventions.filter((intervention) =>
    isPlannedCoachingIndicatorCandidate(intervention, todayKey)
  );
  return members.map((member) => ({
    ...member,
    hasPlannedCoaching: plannedInterventions.some((intervention) =>
      isCoachingForMyTeamMember(member, intervention)
    ),
  }));
}
