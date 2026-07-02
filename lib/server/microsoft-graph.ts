import { getToken } from "next-auth/jwt";
import { unauthorized } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { getValidMicrosoftAccessToken } from "@/lib/server/microsoft-token-store";
import type { CoachingIntervention } from "@/lib/types";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const GRAPH_SCOPES = "User.Read Calendars.ReadWrite";

type GraphDateTime = {
  dateTime: string;
  timeZone: string;
};

type GraphEvent = {
  id: string;
  iCalUId?: string;
  subject?: string;
  bodyPreview?: string;
  start: GraphDateTime;
  end: GraphDateTime;
  isAllDay?: boolean;
  showAs?: string;
  location?: { displayName?: string };
};

export type OutlookCalendarEvent = {
  id: string;
  iCalUId?: string;
  title: string;
  preview: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string;
};

export type OutlookSyncResult = {
  interventionId: string;
  outlookEventId?: string;
  outlookICalUId?: string;
  outlookSyncStatus: "NOT_SYNCED" | "SYNCED" | "ERROR";
  lastSyncedAt?: string;
  syncError?: string;
};

export async function requireMicrosoftAccessToken(request: Request) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (!token?.databaseUserId) {
    unauthorized("Meld je aan met Microsoft om de Outlook-agenda te gebruiken.");
  }
  const accessToken = await getValidMicrosoftAccessToken(token.databaseUserId);
  if (!accessToken) unauthorized("Meld je opnieuw aan met Microsoft en geef toegang tot je agenda.");
  return accessToken;
}

export async function listOutlookCalendarEvents(
  accessToken: string,
  start: Date,
  end: Date
): Promise<OutlookCalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    "$select": "id,iCalUId,subject,bodyPreview,start,end,location,isAllDay,showAs",
    "$orderby": "start/dateTime",
    "$top": "250",
  });
  const payload = await graphRequest<{ value: GraphEvent[] }>(
    accessToken,
    `/me/calendarView?${params}`,
    { headers: { Prefer: 'outlook.timezone="UTC"' } }
  );
  return payload.value.map((event) => ({
    id: event.id,
    iCalUId: event.iCalUId,
    title: event.subject?.trim() || "Outlook-afspraak",
    preview: event.bodyPreview?.trim() || "",
    start: graphUtcDate(event.start),
    end: graphUtcDate(event.end),
    isAllDay: Boolean(event.isAllDay),
    location: event.location?.displayName?.trim() || undefined,
  }));
}

export async function syncCoachingsToOutlook(
  accessToken: string,
  actorId: string,
  coachings: CoachingIntervention[]
): Promise<OutlookSyncResult[]> {
  const results: OutlookSyncResult[] = [];
  for (const coaching of coachings) {
    const stored = await prisma.intervention.findUnique({
      where: { id: coaching.id },
      select: {
        id: true,
        type: true,
        ownerId: true,
        outlookEventId: true,
        outlookICalUId: true,
      },
    });
    if (!stored || stored.type !== "BEGELEIDING") continue;
    if (stored.ownerId !== actorId) {
      results.push(await storeSyncError(
        stored.id,
        stored.outlookEventId,
        stored.outlookICalUId,
        "Alleen de eigenaar kan deze begeleiding met de eigen Outlook-agenda synchroniseren."
      ));
      continue;
    }
    try {
      if (coaching.deletedAt || coaching.status === "geannuleerd") {
        if (stored.outlookEventId) {
          await deleteGraphEvent(accessToken, stored.outlookEventId);
        }
        const synced = await prisma.intervention.update({
          where: { id: stored.id },
          data: { outlookSyncStatus: "SYNCED", lastSyncedAt: new Date(), syncError: null },
          select: syncSelection,
        });
        results.push(toSyncResult(synced));
        continue;
      }

      if (!coaching.plannedDate || !coaching.startTime || !coaching.endTime) {
        results.push(await storeSyncError(
          stored.id,
          stored.outlookEventId,
          stored.outlookICalUId,
          "Datum, starttijd en eindtijd zijn vereist voor Outlook-synchronisatie."
        ));
        continue;
      }

      const payload = graphEventPayload(coaching);
      let event: GraphEvent;
      if (stored.outlookEventId) {
        try {
          event = await updateGraphEvent(accessToken, stored.outlookEventId, payload);
        } catch (error) {
          if (!(error instanceof GraphRequestError) || error.status !== 404) throw error;
          event = await createGraphEvent(accessToken, coaching.id, payload);
        }
      } else {
        event = await createGraphEvent(accessToken, coaching.id, payload);
      }
      const synced = await prisma.intervention.update({
        where: { id: stored.id },
        data: {
          outlookEventId: event.id,
          outlookICalUId: event.iCalUId ?? stored.outlookICalUId,
          outlookSyncStatus: "SYNCED",
          lastSyncedAt: new Date(),
          syncError: null,
        },
        select: syncSelection,
      });
      results.push(toSyncResult(synced));
    } catch (error) {
      results.push(await storeSyncError(
        stored.id,
        stored.outlookEventId,
        stored.outlookICalUId,
        graphErrorMessage(error)
      ));
    }
  }
  return results;
}

export async function recordOutlookSyncFailure(
  actorId: string,
  coachings: CoachingIntervention[],
  error: unknown
): Promise<OutlookSyncResult[]> {
  const results: OutlookSyncResult[] = [];
  const message = graphErrorMessage(error);
  for (const coaching of coachings) {
    const stored = await prisma.intervention.findFirst({
      where: { id: coaching.id, type: "BEGELEIDING", ownerId: actorId },
      select: { id: true, outlookEventId: true, outlookICalUId: true },
    });
    if (!stored) continue;
    results.push(await storeSyncError(
      stored.id,
      stored.outlookEventId,
      stored.outlookICalUId,
      message
    ));
  }
  return results;
}

const syncSelection = {
  id: true,
  outlookEventId: true,
  outlookICalUId: true,
  outlookSyncStatus: true,
  lastSyncedAt: true,
  syncError: true,
} as const;

function graphEventPayload(coaching: CoachingIntervention) {
  const timeZone = process.env.OUTLOOK_TIME_ZONE || "Romance Standard Time";
  return {
    subject: `Fieldforce: ${coaching.title}`,
    body: {
      contentType: "HTML",
      content: `<p>${escapeHtml(coaching.title)}</p><p>Beheer deze begeleiding uitsluitend in Fieldforce.</p>`,
    },
    start: { dateTime: `${coaching.plannedDate}T${coaching.startTime}:00`, timeZone },
    end: { dateTime: `${coaching.plannedDate}T${coaching.endTime}:00`, timeZone },
    showAs: "busy",
    sensitivity: "normal",
  };
}

async function createGraphEvent(accessToken: string, interventionId: string, payload: object) {
  return graphRequest<GraphEvent>(accessToken, "/me/events", {
    method: "POST",
    body: JSON.stringify({ ...payload, transactionId: `fieldforce-${interventionId}` }),
  });
}

async function updateGraphEvent(accessToken: string, eventId: string, payload: object) {
  return graphRequest<GraphEvent>(accessToken, `/me/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function deleteGraphEvent(accessToken: string, eventId: string) {
  try {
    await graphRequest<void>(accessToken, `/me/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof GraphRequestError && error.status === 404) return;
    throw error;
  }
}

async function graphRequest<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/me/")) throw new Error("Ongeldige Microsoft Graph-route.");
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => undefined) as
    | { error?: { code?: string; message?: string } }
    | undefined;
  if (!response.ok) {
    throw new GraphRequestError(
      response.status,
      payload?.error?.message || `Microsoft Graph gaf status ${response.status}.`
    );
  }
  return payload as T;
}

class GraphRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "GraphRequestError";
  }
}

async function storeSyncError(
  interventionId: string,
  outlookEventId: string | null,
  outlookICalUId: string | null,
  message: string
) {
  const failed = await prisma.intervention.update({
    where: { id: interventionId },
    data: { outlookSyncStatus: "ERROR", syncError: message.slice(0, 4000) },
    select: syncSelection,
  });
  return toSyncResult({ ...failed, outlookEventId, outlookICalUId });
}

function toSyncResult(value: {
  id: string;
  outlookEventId: string | null;
  outlookICalUId: string | null;
  outlookSyncStatus: "NOT_SYNCED" | "SYNCED" | "ERROR";
  lastSyncedAt: Date | null;
  syncError: string | null;
}): OutlookSyncResult {
  return {
    interventionId: value.id,
    outlookEventId: value.outlookEventId ?? undefined,
    outlookICalUId: value.outlookICalUId ?? undefined,
    outlookSyncStatus: value.outlookSyncStatus,
    lastSyncedAt: value.lastSyncedAt?.toISOString(),
    syncError: value.syncError ?? undefined,
  };
}

function graphUtcDate(value: GraphDateTime) {
  return value.timeZone.toUpperCase() === "UTC" && !/[zZ]|[+-]\d\d:\d\d$/.test(value.dateTime)
    ? `${value.dateTime}Z`
    : value.dateTime;
}

function graphErrorMessage(error: unknown) {
  if (error instanceof Error) return `Outlook-sync mislukt: ${error.message}`;
  return "Outlook-sync mislukt door een onbekende fout.";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export { GRAPH_SCOPES };
