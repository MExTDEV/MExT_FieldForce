import { canRoleEditCoachingForm } from "@/lib/coaching/form-access";
import type { CoachingIntervention, MockUser } from "@/lib/types";
import { canOpenCoachingDetail, localDateKey } from "@/lib/coaching/visibility";

const representativeApprovalStatuses = new Set([
  "wacht_op_akkoord",
  "verzonden_ter_akkoord",
]);

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
