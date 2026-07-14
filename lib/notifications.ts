import type { Language } from "@/lib/types";

export const notificationPollIntervalMs = 15_000;
export const notificationRefreshEventName = "fieldforce:notifications-refresh";

export type AppNotificationType =
  | "COACHING_APPROVAL_REQUEST"
  | "COACHING_PLANNED"
  | "COACHING_APPROVAL_CONFIRMED"
  | "HELP_REQUEST_CREATED"
  | "HELP_REQUEST_ANSWERED"
  | "HELP_REQUEST_CLOSED"
  | "HELP_REQUEST_FOLLOW_UP"
  | "CONTACT_MOMENT_PLANNED"
  | "CONTACT_MOMENT_UPDATED"
  | "CONTACT_MOMENT_SHARED"
  | "CONTACT_MOMENT_CANCELLED"
  | "CONTACT_MOMENT_NOT_EXECUTED"
  | "ACTION_POINT_CLOSED"
  | "PEER_COACHING_ASSIGNED"
  | "PEER_COACHING_LATE"
  | "PEER_COACHING_ACTION_REVIEW"
  | "PEER_COACHING_FINAL_APPROVED"
  | "PEER_COACHING_FINAL_REJECTED"
  | "TODO_ASSIGNED"
  | "MESSAGE_RECEIVED";

export type AppNotificationEntityType =
  | "coaching"
  | "helpRequest"
  | "contactMoment"
  | "actionPoint"
  | "todo"
  | "message";

export type AppNotification = {
  id: string;
  targetUserId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  linkUrl: string;
  entityType: AppNotificationEntityType;
  entityId: string;
  createdAt: string;
  readAt?: string;
  isRead: boolean;
  triggeredByUserId?: string;
};

export type NotificationLanguage = Language;
