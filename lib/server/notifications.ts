import type { Prisma } from "@prisma/client";
import { notFound } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { translate } from "@/lib/i18n";
import type { AppNotification, NotificationLanguage } from "@/lib/notifications";
import type { MockUser } from "@/lib/types";

const coachingApprovalNotificationSelect = {
  id: true,
  representativeId: true,
  openedAt: true,
  createdAt: true,
  interventionId: true,
  intervention: {
    select: {
      id: true,
      title: true,
      sentForApprovalAt: true,
      sentForApprovalById: true,
    },
  },
} satisfies Prisma.ApprovalSelect;

type CoachingApprovalRecord = Prisma.ApprovalGetPayload<{
  select: typeof coachingApprovalNotificationSelect;
}>;

export async function createCoachingApprovalNotification(
  tx: Prisma.TransactionClient,
  input: {
    interventionId: string;
    representativeId: string;
  }
) {
  return tx.approval.upsert({
    where: { interventionId: input.interventionId },
    create: {
      interventionId: input.interventionId,
      representativeId: input.representativeId,
      openedAt: null,
    },
    update: {
      representativeId: input.representativeId,
      status: null,
      comment: null,
      openedAt: null,
      confirmedAt: null,
    },
  });
}

export async function markCoachingApprovalNotificationHandled(
  tx: Prisma.TransactionClient,
  input: {
    interventionId: string;
    handledAt: Date;
  }
) {
  return tx.approval.update({
    where: { interventionId: input.interventionId },
    data: {
      status: "GELEZEN_AKKOORD",
      openedAt: input.handledAt,
      confirmedAt: input.handledAt,
    },
  });
}

export async function getNotificationsForCurrentUser(actor: MockUser) {
  const approvals = await prisma.approval.findMany({
    where: {
      representativeId: actor.id,
      status: null,
      intervention: {
        deletedAt: null,
        representativeId: actor.id,
        status: "VERZONDEN_TER_AKKOORD",
      },
    },
    orderBy: [
      { openedAt: "asc" },
      { createdAt: "desc" },
    ],
    take: 30,
    select: coachingApprovalNotificationSelect,
  });

  return approvals.map((approval) =>
    buildCoachingApprovalNotification(approval, actor.language)
  );
}

export async function getUnreadNotificationsForCurrentUser(actor: MockUser) {
  return (await getNotificationsForCurrentUser(actor)).filter((notification) => !notification.isRead);
}

export async function markNotificationAsRead(actor: MockUser, notificationId: string) {
  const approval = await prisma.approval.findFirst({
    where: {
      id: notificationId,
      representativeId: actor.id,
      status: null,
      intervention: {
        deletedAt: null,
        representativeId: actor.id,
        status: "VERZONDEN_TER_AKKOORD",
      },
    },
    select: coachingApprovalNotificationSelect,
  });
  if (!approval) notFound("Melding niet gevonden.");

  const openedAt = approval.openedAt ?? new Date();
  const updated = approval.openedAt
    ? approval
    : await prisma.approval.update({
        where: { id: notificationId },
        data: { openedAt },
        select: coachingApprovalNotificationSelect,
      });

  return buildCoachingApprovalNotification(updated, actor.language);
}

export async function markAllNotificationsAsRead(actor: MockUser) {
  await prisma.approval.updateMany({
    where: {
      representativeId: actor.id,
      status: null,
      openedAt: null,
      intervention: {
        deletedAt: null,
        representativeId: actor.id,
        status: "VERZONDEN_TER_AKKOORD",
      },
    },
    data: { openedAt: new Date() },
  });

  return getNotificationsForCurrentUser(actor);
}

export async function markNotificationsForEntityAsRead(
  actor: MockUser,
  entityType: AppNotification["entityType"],
  entityId: string
) {
  if (entityType !== "coaching") return 0;
  const result = await prisma.approval.updateMany({
    where: {
      interventionId: entityId,
      representativeId: actor.id,
      openedAt: null,
    },
    data: { openedAt: new Date() },
  });
  return result.count;
}

export function buildCoachingApprovalNotification(
  approval: CoachingApprovalRecord,
  language: NotificationLanguage
): AppNotification {
  const readAt = approval.openedAt?.toISOString();
  return {
    id: approval.id,
    targetUserId: approval.representativeId,
    type: "COACHING_APPROVAL_REQUEST",
    title: translate(language, "notifications.coachingApproval.title"),
    body: translate(language, "notifications.coachingApproval.body"),
    linkUrl: `/begeleidingen/${approval.interventionId}`,
    entityType: "coaching",
    entityId: approval.interventionId,
    createdAt: (approval.intervention.sentForApprovalAt ?? approval.createdAt).toISOString(),
    readAt,
    isRead: Boolean(readAt),
    triggeredByUserId: approval.intervention.sentForApprovalById ?? undefined,
  };
}
