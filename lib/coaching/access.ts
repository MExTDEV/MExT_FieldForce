import { canCreateIntervention } from "@/lib/permissions";
import type { CoachingIntervention, Country, MockUser } from "@/lib/types";
import { canOpenCoachingDetail, localDateKey } from "@/lib/coaching/visibility";

export function canManageCoaching(
  currentUser: MockUser,
  intervention: CoachingIntervention
) {
  if (!canCreateIntervention(currentUser)) return false;
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) return true;

  const targetRole = intervention.subject?.role ?? "REPRESENTATIVE";

  if (currentUser.role === "SALES_LEADER") {
    if (targetRole === "SALES_LEADER") return false;
    return intervention.ownerId === currentUser.id ||
      intervention.initiatorId === currentUser.id ||
      Boolean(currentUser.teamId && intervention.teamId === currentUser.teamId);
  }

  if (["COUNTRY_MANAGER", "SALES_MANAGER", "ADMIN"].includes(currentUser.role)) {
    return targetRole === "SALES_LEADER" &&
      canAccessActorCountry(currentUser, intervention.country);
  }

  return false;
}

export function canEditFutureCoachingPlanning(
  currentUser: MockUser,
  intervention: CoachingIntervention,
  today = localDateKey()
) {
  return intervention.status === "gepland" &&
    (intervention.plannedDate ?? intervention.createdAt.slice(0, 10)) > today &&
    canManageCoaching(currentUser, intervention);
}

export function coachingOpenHref(
  currentUser: MockUser,
  intervention: CoachingIntervention,
  today = localDateKey()
) {
  if (canEditFutureCoachingPlanning(currentUser, intervention, today)) {
    return `/begeleidingen/nieuw?id=${encodeURIComponent(intervention.id)}`;
  }
  if (canOpenCoachingDetail(currentUser, intervention)) {
    return `/begeleidingen/${intervention.id}`;
  }
  return undefined;
}

function canAccessActorCountry(currentUser: MockUser, country: Country) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) return true;
  if (currentUser.role === "SALES_MANAGER") {
    return (currentUser.countryAccess ?? []).includes(country);
  }
  if (currentUser.role === "ADMIN" && currentUser.countryAccess?.length) {
    return currentUser.countryAccess.includes(country);
  }
  return currentUser.country === country;
}
