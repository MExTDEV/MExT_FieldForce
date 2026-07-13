import { getToken } from "next-auth/jwt";
import { unauthorized } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { getValidMicrosoftAccessToken } from "@/lib/server/microsoft-token-store";
import type { CoachingIntervention, ContactMoment } from "@/lib/types";

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

type OutlookSyncItemKind = "BEGELEIDING" | "CONTACTMOMENT";

type PlanningOutlookItem = {
  id: string;
  kind: OutlookSyncItemKind;
  title: string;
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  location?: string;
  deleted?: boolean;
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
  return syncPlanningItemsToOutlook(
    accessToken,
    actorId,
    coachings.map((coaching) => ({
      id: coaching.id,
      kind: "BEGELEIDING",
      title: coaching.title,
      plannedDate: coaching.plannedDate,
      startTime: coaching.startTime,
      endTime: coaching.endTime,
      notifyRepresentative: coaching.notifyRepresentative,
      deleted: Boolean(coaching.deletedAt || coaching.status === "geannuleerd"),
    }))
  );
}

export async function syncContactMomentsToOutlook(
  accessToken: string,
  actorId: string,
  contactMoments: ContactMoment[]
): Promise<OutlookSyncResult[]> {
  return syncPlanningItemsToOutlook(
    accessToken,
    actorId,
    contactMoments.map((contactMoment) => ({
      id: contactMoment.id,
      kind: "CONTACTMOMENT",
      title: contactMoment.subject?.trim() || contactMoment.reason,
      plannedDate: contactMoment.plannedDate,
      startTime: contactMoment.startTime,
      endTime: contactMoment.endTime,
      notifyRepresentative: contactMoment.notifyRepresentative,
      location: contactMoment.location,
      deleted: contactMoment.status === "geannuleerd" || contactMoment.status === "niet_uitgevoerd",
    }))
  );
}

async function syncPlanningItemsToOutlook(
  accessToken: string,
  actorId: string,
  items: PlanningOutlookItem[]
): Promise<OutlookSyncResult[]> {
  const results: OutlookSyncResult[] = [];
  for (const item of items) {
    const stored = await prisma.intervention.findUnique({
      where: { id: item.id },
      select: {
        id: true,
        type: true,
        ownerId: true,
        outlookEventId: true,
        outlookICalUId: true,
        representative: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!stored || stored.type !== item.kind) continue;
    const ownerAccessToken = stored.ownerId === actorId ? accessToken : await getValidMicrosoftAccessToken(stored.ownerId);
    if (!ownerAccessToken) {
      results.push(await storeSyncError(
        stored.id,
        stored.outlookEventId,
        stored.outlookICalUId,
        "De eigenaar heeft geen geldige Microsoft-agendakoppeling."
      ));
      continue;
    }
    try {
      if (item.deleted) {
        if (stored.outlookEventId) {
          await deleteGraphEvent(ownerAccessToken, stored.outlookEventId);
        }
        const synced = await prisma.intervention.update({
          where: { id: stored.id },
          data: { outlookSyncStatus: "SYNCED", lastSyncedAt: new Date(), syncError: null },
          select: syncSelection,
        });
        results.push(toSyncResult(synced));
        continue;
      }

      if (!item.plannedDate || !item.startTime || !item.endTime) {
        results.push(await storeSyncError(
          stored.id,
          stored.outlookEventId,
          stored.outlookICalUId,
          "Datum, starttijd en eindtijd zijn vereist voor Outlook-synchronisatie."
        ));
        continue;
      }

      const payload = buildPlanningOutlookEventPayload(item, stored.representative);
      let event: GraphEvent;
      if (stored.outlookEventId) {
        try {
          event = await updateGraphEvent(ownerAccessToken, stored.outlookEventId, payload);
        } catch (error) {
          if (!(error instanceof GraphRequestError) || error.status !== 404) throw error;
          event = await createGraphEvent(ownerAccessToken, item.id, payload);
        }
      } else {
        event = await createGraphEvent(ownerAccessToken, item.id, payload);
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

export async function transferCoachingsBetweenOwners(
  actorAccessToken: string,
  actorId: string,
  changes: { interventionId: string; oldOwnerId: string; newOwnerId: string; outlookEventId?: string }[]
) {
  for (const change of changes) {
    if (change.oldOwnerId === change.newOwnerId || !change.outlookEventId) continue;
    const oldOwnerToken = change.oldOwnerId === actorId ? actorAccessToken : await getValidMicrosoftAccessToken(change.oldOwnerId);
    if (!oldOwnerToken) throw new Error("De oude begeleider heeft geen geldige Microsoft-agendakoppeling.");
    await deleteGraphEvent(oldOwnerToken, change.outlookEventId);
    await prisma.intervention.update({ where: { id: change.interventionId }, data: { outlookEventId: null, outlookICalUId: null, outlookSyncStatus: "NOT_SYNCED", syncError: null } });
  }
}

export async function recordOutlookSyncFailure(
  actorId: string,
  items: Array<Pick<CoachingIntervention, "id"> | Pick<ContactMoment, "id">>,
  error: unknown,
  type: OutlookSyncItemKind = "BEGELEIDING"
): Promise<OutlookSyncResult[]> {
  const results: OutlookSyncResult[] = [];
  const message = graphErrorMessage(error);
  for (const item of items) {
    const stored = await prisma.intervention.findFirst({
      where: { id: item.id, type, ownerId: actorId },
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

export function buildPlanningOutlookEventPayload(
  item: PlanningOutlookItem,
  participant: { email: string; firstName: string; lastName: string }
) {
  const timeZone = process.env.OUTLOOK_TIME_ZONE || "Romance Standard Time";
  const bodySentence = item.kind === "CONTACTMOMENT"
    ? "Beheer dit contactmoment uitsluitend in Fieldforce."
    : "Beheer deze begeleiding uitsluitend in Fieldforce.";
  return {
    subject: `Fieldforce: ${item.title}`,
    body: {
      contentType: "HTML",
      content: `<p>${escapeHtml(item.title)}</p><p>${bodySentence}</p>`,
    },
    start: { dateTime: `${item.plannedDate}T${item.startTime}:00`, timeZone },
    end: { dateTime: `${item.plannedDate}T${item.endTime}:00`, timeZone },
    location: item.location ? { displayName: item.location } : undefined,
    showAs: "busy",
    sensitivity: "normal",
    attendees: item.notifyRepresentative ? [{ emailAddress: { address: participant.email, name: `${participant.firstName} ${participant.lastName}`.trim() }, type: "required" }] : [],
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
