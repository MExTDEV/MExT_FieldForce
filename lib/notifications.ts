import type { Language } from "@/lib/types";

export const notificationPollIntervalMs = 15_000;
export const notificationRefreshEventName = "fieldforce:notifications-refresh";

export type AppNotificationType =
  | "COACHING_APPROVAL_REQUEST"
  | "TODO_ASSIGNED"
  | "MESSAGE_RECEIVED";

export type AppNotificationEntityType = "coaching" | "todo" | "message";

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
