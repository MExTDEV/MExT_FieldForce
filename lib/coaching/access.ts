import { canRoleEditCoachingForm } from "@/lib/coaching/form-access";
import type { CoachingIntervention, MockUser, Role } from "@/lib/types";
import { canOpenCoachingDetail, localDateKey } from "@/lib/coaching/visibility";

const representativeApprovalStatuses = new Set([
  "wacht_op_akkoord",
  "verzonden_ter_akkoord",
]);

const coachingApprovalManagerRoles = new Set<Role>([
  "SALES_LEADER",
  "SALES_MANAGER",
  "COUNTRY_MANAGER",
  "GROUP_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);

export function isCoachingApprovalManagerRole(role: Role) {
  return coachingApprovalManagerRoles.has(role);
}

export function canManageCoaching(
  currentUser: MockUser,
  intervention: CoachingIntervention
) {
  return canRoleEditCoachingForm(currentUser.role) &&
    canOpenCoachingDetail(currentUser, intervention);
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

export function canCancelFutureCoaching(
  currentUser: MockUser,
  intervention: CoachingIntervention,
  today = localDateKey(),
) {
  return intervention.status === "gepland" &&
    (intervention.plannedDate ?? "") > today &&
    !intervention.actualStartedAt &&
    canManageCoaching(currentUser, intervention);
}

export function coachingOpenHref(
  currentUser: MockUser,
  intervention: CoachingIntervention,
  today = localDateKey(),
  approvalId?: string
) {
  const approvalHref = representativeApprovalHref(currentUser, intervention, approvalId);
  if (approvalHref) return approvalHref;
  if (canEditFutureCoachingPlanning(currentUser, intervention, today)) {
    return `/begeleidingen/nieuw?id=${encodeURIComponent(intervention.id)}`;
  }
  if (canOpenCoachingDetail(currentUser, intervention)) {
    return `/begeleidingen/${intervention.id}`;
  }
  return undefined;
}

export function canManageCoachingApproval(
  currentUser: MockUser,
  intervention: CoachingIntervention
) {
  return isCoachingApprovalManagerRole(currentUser.role) &&
    canManageCoaching(currentUser, intervention);
}

export function representativeApprovalHref(
  currentUser: MockUser,
  intervention: CoachingIntervention,
  approvalId?: string
) {
  if (
    currentUser.role !== "REPRESENTATIVE" ||
    !representativeApprovalStatuses.has(intervention.status)
  ) {
    return undefined;
  }
  return approvalId
    ? `/mijn-verslagen/${encodeURIComponent(approvalId)}`
    : "/mijn-verslagen";
}
