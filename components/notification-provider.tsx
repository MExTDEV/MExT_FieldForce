"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { translate } from "@/lib/i18n";
import {
  notificationPollIntervalMs,
  notificationRefreshEventName,
  type AppNotification,
} from "@/lib/notifications";
import { useSession } from "@/components/session-provider";

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  openNotification: (notification: AppNotification) => Promise<void>;
};

type NotificationToast = {
  toastId: string;
  notification: AppNotification;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { language, status, user } = useSession();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const seenNotifiedIdsRef = useRef(new Set<string>());
  const firstLoadRef = useRef(true);
  const fetchingRef = useRef(false);
  const toastTimeoutsRef = useRef(new Map<string, number>());

  const dismissToast = useCallback((toastId: string) => {
    const timeoutId = toastTimeoutsRef.current.get(toastId);
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    toastTimeoutsRef.current.delete(toastId);
    setToasts((current) => current.filter((toast) => toast.toastId !== toastId));
  }, []);

  const enqueueToast = useCallback((notification: AppNotification) => {
    const toastId = `${notification.id}-${Date.now().toString(36)}`;
    setToasts((current) => [...current.slice(-2), { toastId, notification }]);
    const timeoutId = window.setTimeout(() => dismissToast(toastId), 7_000);
    toastTimeoutsRef.current.set(toastId, timeoutId);
  }, [dismissToast]);

  const fetchNotifications = useCallback(async (options?: { announce?: boolean }) => {
    if (status !== "authenticated" || !user.id || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/notifications?actorId=${encodeURIComponent(user.id)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        notifications?: AppNotification[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Meldingen konden niet worden geladen.");
      }
      const nextNotifications = payload.notifications ?? [];
      const shouldAnnounce = Boolean(options?.announce) && !firstLoadRef.current;
      const newUnread = shouldAnnounce
        ? nextNotifications.filter((notification) =>
            !notification.isRead && !seenNotifiedIdsRef.current.has(notification.id)
          )
        : [];

      setNotifications(nextNotifications);
      nextNotifications.forEach((notification) => seenNotifiedIdsRef.current.add(notification.id));
      firstLoadRef.current = false;

      if (newUnread.length > 0) {
        newUnread.slice(0, 3).forEach(enqueueToast);
        playNotificationPing();
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[notifications] Meldingen konden niet worden geladen.", error);
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [enqueueToast, status, user.id]);

  useEffect(() => {
    if (status !== "authenticated" || !user.id) {
      setNotifications([]);
      setToasts([]);
      seenNotifiedIdsRef.current.clear();
      firstLoadRef.current = true;
      return;
    }

    seenNotifiedIdsRef.current.clear();
    firstLoadRef.current = true;
    void fetchNotifications({ announce: false });
    const intervalId = window.setInterval(
      () => void fetchNotifications({ announce: true }),
      notificationPollIntervalMs
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchNotifications({ announce: true });
    };
    const handleManualRefresh = () => {
      void fetchNotifications({ announce: false });
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(notificationRefreshEventName, handleManualRefresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(notificationRefreshEventName, handleManualRefresh);
    };
  }, [fetchNotifications, status, user.id]);

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current;
    return () => {
      toastTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeouts.clear();
    };
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((current) => current.map((notification) =>
      notification.id === notificationId
        ? { ...notification, isRead: true, readAt: notification.readAt ?? new Date().toISOString() }
        : notification
    ));
    const response = await fetch(
      `/api/notifications/${encodeURIComponent(notificationId)}/read?actorId=${encodeURIComponent(user.id)}`,
      { method: "POST", cache: "no-store" }
    );
    const payload = (await response.json()) as {
      notification?: AppNotification;
      error?: string;
    };
    if (!response.ok || !payload.notification) {
      throw new Error(payload.error ?? "Melding kon niet als gelezen worden gemarkeerd.");
    }
    setNotifications((current) => current.map((notification) =>
      notification.id === notificationId ? payload.notification! : notification
    ));
  }, [user.id]);

  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((current) => current.map((notification) =>
      notification.isRead ? notification : { ...notification, isRead: true, readAt: now }
    ));
    const response = await fetch(
      `/api/notifications/read-all?actorId=${encodeURIComponent(user.id)}`,
      { method: "POST", cache: "no-store" }
    );
    const payload = (await response.json()) as {
      notifications?: AppNotification[];
      error?: string;
    };
    if (!response.ok || !payload.notifications) {
      throw new Error(payload.error ?? "Meldingen konden niet als gelezen worden gemarkeerd.");
    }
    setNotifications(payload.notifications);
  }, [user.id]);

  const openNotification = useCallback(async (notification: AppNotification) => {
    setToasts((current) => {
      const remaining: NotificationToast[] = [];
      for (const toast of current) {
        if (toast.notification.id === notification.id) {
          const timeoutId = toastTimeoutsRef.current.get(toast.toastId);
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
          toastTimeoutsRef.current.delete(toast.toastId);
        } else {
          remaining.push(toast);
        }
      }
      return remaining;
    });
    try {
      if (!notification.isRead) await markAsRead(notification.id);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[notifications] Melding kon niet als gelezen worden gemarkeerd.", error);
      }
    } finally {
      router.push(notification.linkUrl);
    }
  }, [markAsRead, router]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    loading,
    refresh: () => fetchNotifications({ announce: false }),
    markAsRead,
    markAllAsRead,
    openNotification,
  }), [fetchNotifications, loading, markAllAsRead, markAsRead, notifications, openNotification, unreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-24 z-[70] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <NotificationToastCard
            key={toast.toastId}
            toast={toast}
            language={language}
            onOpen={() => void openNotification(toast.notification)}
            onDismiss={() => dismissToast(toast.toastId)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}

function NotificationToastCard({
  language,
  onDismiss,
  onOpen,
  toast,
}: {
  language: "nl" | "fr" | "de";
  onDismiss: () => void;
  onOpen: () => void;
  toast: NotificationToast;
}) {
  return (
    <div role="status" className="pointer-events-auto overflow-hidden rounded-xl border border-brand-100 bg-white shadow-2xl">
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-brand-50/50">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-700" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-950">
            {notificationTitle(toast.notification, language)}
          </span>
          <span className="mt-1 block text-sm leading-5 text-slate-600">
            {translate(language, "notifications.coachingApproval.toastBody")}
          </span>
          <span className="mt-2 block text-xs font-bold uppercase tracking-wide text-brand-700">
            {translate(language, "notifications.open")}
          </span>
        </span>
      </button>
      <button type="button" onClick={onDismiss} className="sr-only">
        {translate(language, "notifications.dismiss")}
      </button>
    </div>
  );
}

export function notificationTitle(notification: AppNotification, language: "nl" | "fr" | "de") {
  if (notification.type === "COACHING_APPROVAL_REQUEST") {
    return translate(language, "notifications.coachingApproval.title");
  }
  return notification.title;
}

export function notificationBody(notification: AppNotification, language: "nl" | "fr" | "de") {
  if (notification.type === "COACHING_APPROVAL_REQUEST") {
    return translate(language, "notifications.coachingApproval.body");
  }
  return notification.body;
}

function playNotificationPing() {
  try {
    const AudioContextConstructor = window.AudioContext ?? windowWithWebkitAudio().webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    playTone(context, 880, now, 0.11, 0.045);
    playTone(context, 1174.66, now + 0.105, 0.15, 0.04);
    window.setTimeout(() => void context.close().catch(() => undefined), 700);
  } catch {
    // Browser autoplay policy may block audio; notifications remain visual.
  }
}

function playTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

function windowWithWebkitAudio() {
  return window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
}
