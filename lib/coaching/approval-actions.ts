import type { AuditEntry, CoachingIntervention, MockUser } from "@/lib/types";
import { canManageCoachingApproval } from "@/lib/coaching/access";

export const pendingCoachingApprovalStatuses = new Set([
  "verzonden_ter_akkoord",
  "wacht_op_akkoord",
  "VERZONDEN_TER_AKKOORD",
  "WACHT_OP_AKKOORD",
]);

type ApprovalSentAudit = Pick<AuditEntry, "at" | "action" | "newValue">;

export function isPendingCoachingApprovalStatus(status?: string | null) {
  return Boolean(status && pendingCoachingApprovalStatuses.has(status));
}

export function resolveCoachingApprovalSentForApprovalAt(input: {
  sentForApprovalAt?: string | Date | null;
  auditTrail?: ApprovalSentAudit[] | null;
  approvalCreatedAt?: string | Date | null;
}) {
  const stored = validIsoDate(input.sentForApprovalAt);
  if (stored) return stored;

  const sentAudit = [...(input.auditTrail ?? [])]
    .filter((entry) => entry.action === "coaching.sent_for_approval")
    .sort((left, right) => right.at.localeCompare(left.at))[0];
  if (sentAudit) {
    const sentForApprovalAt = sentAudit.newValue?.sentForApprovalAt;
    const sentAt = sentAudit.newValue?.sentAt;
    const fromAuditValue = validIsoDate(
      typeof sentForApprovalAt === "string" || sentForApprovalAt instanceof Date
        ? sentForApprovalAt
        : typeof sentAt === "string" || sentAt instanceof Date
          ? sentAt
          : undefined
    );
    if (fromAuditValue) return fromAuditValue;

    const fromAuditTime = validIsoDate(sentAudit.at);
    if (fromAuditTime) return fromAuditTime;
  }

  return validIsoDate(input.approvalCreatedAt);
}

export function canRemindCoachingApproval(
  currentUser: MockUser,
  intervention: CoachingIntervention
) {
  return canManageCoachingApproval(currentUser, intervention) &&
    isPendingCoachingApprovalStatus(intervention.status);
}

function validIsoDate(value?: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
