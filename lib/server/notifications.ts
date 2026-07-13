import type { Prisma } from "@prisma/client";
import { notFound } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { translate } from "@/lib/i18n";
import type { AppNotification, AppNotificationEntityType, AppNotificationType, NotificationLanguage } from "@/lib/notifications";
import type { MockUser } from "@/lib/types";

const inAppNotificationChannel = "in_app";
const inAppUnreadStatus = "unread";
const inAppReadStatus = "read";

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

const inAppNotificationSelect = {
  id: true,
  eventKey: true,
  recipientUserId: true,
  status: true,
  sourceModule: true,
  entityType: true,
  entityId: true,
  originalTo: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationDeliverySelect;

type InAppNotificationRecord = Prisma.NotificationDeliveryGetPayload<{
  select: typeof inAppNotificationSelect;
}>;

type NotificationWriter = {
  notificationDelivery: Prisma.TransactionClient["notificationDelivery"];
};

const notificationMetadata: Record<
  Exclude<AppNotificationType, "COACHING_APPROVAL_REQUEST" | "TODO_ASSIGNED" | "MESSAGE_RECEIVED">,
  {
    entityType: AppNotificationEntityType;
    titleKey: Parameters<typeof translate>[1];
    bodyKey: Parameters<typeof translate>[1];
    link: (entityId: string) => string;
  }
> = {
  COACHING_APPROVAL_CONFIRMED: {
    entityType: "coaching",
    titleKey: "notifications.coachingApproval.confirmed.title",
    bodyKey: "notifications.coachingApproval.confirmed.body",
    link: (entityId) => `/begeleidingen/${entityId}`,
  },
  HELP_REQUEST_CREATED: {
    entityType: "helpRequest",
    titleKey: "notifications.helpRequest.created.title",
    bodyKey: "notifications.helpRequest.created.body",
    link: (entityId) => `/hulpaanvragen/${entityId}`,
  },
  HELP_REQUEST_ANSWERED: {
    entityType: "helpRequest",
    titleKey: "notifications.helpRequest.answered.title",
    bodyKey: "notifications.helpRequest.answered.body",
    link: (entityId) => `/hulpaanvragen/${entityId}`,
  },
  HELP_REQUEST_CLOSED: {
    entityType: "helpRequest",
    titleKey: "notifications.helpRequest.closed.title",
    bodyKey: "notifications.helpRequest.closed.body",
    link: (entityId) => `/hulpaanvragen/${entityId}`,
  },
  HELP_REQUEST_FOLLOW_UP: {
    entityType: "helpRequest",
    titleKey: "notifications.helpRequest.followUp.title",
    bodyKey: "notifications.helpRequest.followUp.body",
    link: (entityId) => `/hulpaanvragen/${entityId}`,
  },
  CONTACT_MOMENT_PLANNED: {
    entityType: "contactMoment",
    titleKey: "notifications.contactMoment.planned.title",
    bodyKey: "notifications.contactMoment.planned.body",
    link: (entityId) => `/contactmomenten/${entityId}`,
  },
  CONTACT_MOMENT_UPDATED: {
    entityType: "contactMoment",
    titleKey: "notifications.contactMoment.updated.title",
    bodyKey: "notifications.contactMoment.updated.body",
    link: (entityId) => `/contactmomenten/${entityId}`,
  },
  CONTACT_MOMENT_SHARED: {
    entityType: "contactMoment",
    titleKey: "notifications.contactMoment.shared.title",
    bodyKey: "notifications.contactMoment.shared.body",
    link: (entityId) => `/contactmomenten/${entityId}`,
  },
  CONTACT_MOMENT_CANCELLED: {
    entityType: "contactMoment",
    titleKey: "notifications.contactMoment.cancelled.title",
    bodyKey: "notifications.contactMoment.cancelled.body",
    link: (entityId) => `/contactmomenten/${entityId}`,
  },
  CONTACT_MOMENT_NOT_EXECUTED: {
    entityType: "contactMoment",
    titleKey: "notifications.contactMoment.notExecuted.title",
    bodyKey: "notifications.contactMoment.notExecuted.body",
    link: (entityId) => `/contactmomenten/${entityId}`,
  },
  ACTION_POINT_CLOSED: {
    entityType: "actionPoint",
    titleKey: "notifications.actionPoint.closed.title",
    bodyKey: "notifications.actionPoint.closed.body",
    link: (entityId) => `/actiepunten?actionPoint=${encodeURIComponent(entityId)}`,
  },
  PEER_COACHING_ASSIGNED: {
    entityType: "coaching",
    titleKey: "notifications.peerCoaching.assigned.title",
    bodyKey: "notifications.peerCoaching.assigned.body",
    link: (entityId) => `/begeleidingen/${entityId}`,
  },
  PEER_COACHING_LATE: {
    entityType: "coaching",
    titleKey: "notifications.peerCoaching.late.title",
    bodyKey: "notifications.peerCoaching.late.body",
    link: (entityId) => `/begeleidingen/${entityId}`,
  },
  PEER_COACHING_ACTION_REVIEW: {
    entityType: "coaching",
    titleKey: "notifications.peerCoaching.actionReview.title",
    bodyKey: "notifications.peerCoaching.actionReview.body",
    link: (entityId) => `/begeleidingen/${entityId}`,
  },
  PEER_COACHING_FINAL_APPROVED: {
    entityType: "coaching",
    titleKey: "notifications.peerCoaching.finalApproved.title",
    bodyKey: "notifications.peerCoaching.finalApproved.body",
    link: (entityId) => `/begeleidingen/${entityId}`,
  },
  PEER_COACHING_FINAL_REJECTED: {
    entityType: "coaching",
    titleKey: "notifications.peerCoaching.finalRejected.title",
    bodyKey: "notifications.peerCoaching.finalRejected.body",
    link: (entityId) => `/begeleidingen/${entityId}`,
  },
};

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

export async function createInAppNotification(
  tx: NotificationWriter,
  input: {
    type: Exclude<AppNotificationType, "COACHING_APPROVAL_REQUEST" | "TODO_ASSIGNED" | "MESSAGE_RECEIVED">;
    recipientUserId: string;
    entityId: string;
    eventKey?: string;
    triggeredByUserId?: string;
    sourceModule?: string;
  }
) {
  const metadata = notificationMetadata[input.type];
  const eventKey = input.eventKey ?? `${input.type}:${metadata.entityType}:${input.entityId}`;
  return tx.notificationDelivery.upsert({
    where: {
      eventKey_recipientUserId_channel: {
        eventKey,
        recipientUserId: input.recipientUserId,
        channel: inAppNotificationChannel,
      },
    },
    create: {
      eventKey,
      recipientUserId: input.recipientUserId,
      channel: inAppNotificationChannel,
      status: inAppUnreadStatus,
      sourceModule: input.sourceModule,
      entityType: metadata.entityType,
      entityId: input.entityId,
      mailTestActive: false,
      originalTo: input.triggeredByUserId,
    },
    update: {
      status: inAppUnreadStatus,
      sourceModule: input.sourceModule,
      entityType: metadata.entityType,
      entityId: input.entityId,
      originalTo: input.triggeredByUserId,
      updatedAt: new Date(),
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
  const [approvals, inAppRows] = await Promise.all([
    prisma.approval.findMany({
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
    }),
    prisma.notificationDelivery.findMany({
      where: {
        recipientUserId: actor.id,
        channel: inAppNotificationChannel,
        status: { in: [inAppUnreadStatus, inAppReadStatus] },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
      take: 30,
      select: inAppNotificationSelect,
    }),
  ]);

  return [
    ...approvals.map((approval) => buildCoachingApprovalNotification(approval, actor.language)),
    ...inAppRows.flatMap((row) => {
      const notification = buildInAppNotification(row, actor.language);
      return notification ? [notification] : [];
    }),
  ].sort((left, right) => Number(left.isRead) - Number(right.isRead) || Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 30);
}

export async function getUnreadNotificationsForCurrentUser(actor: MockUser) {
  return (await getNotificationsForCurrentUser(actor)).filter((notification) => !notification.isRead);
}

export async function markNotificationAsRead(actor: MockUser, notificationId: string) {
  const inApp = await prisma.notificationDelivery.findFirst({
    where: {
      id: notificationId,
      recipientUserId: actor.id,
      channel: inAppNotificationChannel,
      status: { in: [inAppUnreadStatus, inAppReadStatus] },
    },
    select: inAppNotificationSelect,
  });
  if (inApp) {
    const updated = inApp.status === inAppReadStatus
      ? inApp
      : await prisma.notificationDelivery.update({
          where: { id: notificationId },
          data: { status: inAppReadStatus },
          select: inAppNotificationSelect,
        });
    return buildInAppNotification(updated, actor.language);
  }

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
  await Promise.all([
    prisma.approval.updateMany({
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
    }),
    prisma.notificationDelivery.updateMany({
      where: {
        recipientUserId: actor.id,
        channel: inAppNotificationChannel,
        status: inAppUnreadStatus,
      },
      data: { status: inAppReadStatus },
    }),
  ]);

  return getNotificationsForCurrentUser(actor);
}

export async function markNotificationsForEntityAsRead(
  actor: MockUser,
  entityType: AppNotification["entityType"],
  entityId: string
) {
  const [approvalResult, inAppResult] = await Promise.all([
    entityType === "coaching"
      ? prisma.approval.updateMany({
          where: {
            interventionId: entityId,
            representativeId: actor.id,
            openedAt: null,
          },
          data: { openedAt: new Date() },
        })
      : Promise.resolve({ count: 0 }),
    prisma.notificationDelivery.updateMany({
      where: {
        entityType,
        entityId,
        recipientUserId: actor.id,
        channel: inAppNotificationChannel,
        status: inAppUnreadStatus,
      },
      data: { status: inAppReadStatus },
    }),
  ]);
  return approvalResult.count + inAppResult.count;
}

export function buildInAppNotification(
  row: InAppNotificationRecord,
  language: NotificationLanguage
): AppNotification | undefined {
  const type = notificationTypeFromEventKey(row.eventKey);
  if (!type) return undefined;
  const metadata = notificationMetadata[type];
  if (!row.entityId) return undefined;
  const readAt = row.status === inAppReadStatus ? row.updatedAt.toISOString() : undefined;
  return {
    id: row.id,
    targetUserId: row.recipientUserId,
    type,
    title: translate(language, metadata.titleKey),
    body: translate(language, metadata.bodyKey),
    linkUrl: metadata.link(row.entityId),
    entityType: metadata.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
    readAt,
    isRead: Boolean(readAt),
    triggeredByUserId: row.originalTo ?? undefined,
  };
}

function notificationTypeFromEventKey(eventKey: string) {
  const rawType = eventKey.split(":")[0] as AppNotificationType;
  if (rawType in notificationMetadata) {
    return rawType as keyof typeof notificationMetadata;
  }
  return undefined;
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
