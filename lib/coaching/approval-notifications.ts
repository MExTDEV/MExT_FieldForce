import type { CoachingIntervention } from "@/lib/types";

export const coachingApprovalConfirmedNotificationType = "COACHING_APPROVAL_CONFIRMED" as const;

export type CoachingApprovalConfirmedSource = Pick<
  CoachingIntervention,
  "id" | "title" | "ownerId" | "initiatorId" | "sentForApprovalById" | "plannedDate"
> & {
  representativeName?: string;
  officialCoachIds?: string[];
};

export function resolveCoachingApprovalConfirmedRecipients(
  source: CoachingApprovalConfirmedSource,
  signerUserId: string
) {
  const primaryRecipients = compactUserIds([
    ...(source.officialCoachIds ?? []),
    source.ownerId,
    source.sentForApprovalById,
  ]);
  const fallbackRecipients = compactUserIds([source.initiatorId]);
  const candidates = primaryRecipients.length ? primaryRecipients : fallbackRecipients;
  return uniqueUserIds(candidates).filter((recipientId) => recipientId !== signerUserId);
}

export function buildCoachingApprovalConfirmedEventKey(interventionId: string, approvalId?: string) {
  return `COACHING_APPROVAL_CONFIRMED:coaching:${interventionId}:approval:${approvalId ?? "confirmed"}`;
}

export function buildCoachingApprovalConfirmedEntityTitle(source: CoachingApprovalConfirmedSource) {
  const details = [
    source.representativeName,
    source.plannedDate,
  ].filter(Boolean);
  return details.length ? `${source.title} (${details.join(" - ")})` : source.title;
}

function uniqueUserIds(userIds: string[]) {
  return [...new Set(userIds.filter((userId) => userId.trim()))];
}

function compactUserIds(userIds: Array<string | undefined>) {
  return userIds.filter((userId): userId is string => Boolean(userId?.trim()));
}
