import { Prisma } from "@prisma/client";
import { badRequest, forbidden, handleApi, notFound, ApiRequestError } from "@/lib/server/api";
import { requireAuthenticatedUser, requirePermission } from "@/lib/server/authenticated-user";
import { buildVisibleCoachingWhere, canManageStoredCoaching } from "@/lib/server/coaching-visibility";
import { applicationDateKey } from "@/lib/coaching/business-days";
import { cancelStoredOutlookEvent, requireMicrosoftAccessToken } from "@/lib/server/microsoft-graph";
import { createInAppNotification } from "@/lib/server/notifications";
import { sendWorkflowEventMail } from "@/lib/server/mail-service";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import { prisma } from "@/lib/server/db";
import { translate } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import { requireAppModuleEnabled } from "@/lib/server/modules";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi("api/workflows/coaching/cancel", async () => {
    const { id } = await context.params;
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    await requireAppModuleEnabled("BEGELEIDINGEN");
    requirePermission(actor, "moduleVisitRecord");
    const payload = await request.json().catch(() => ({})) as { reason?: unknown };
    const requestedReason = typeof payload.reason === "string" ? payload.reason.trim() : "";

    const coaching = await prisma.intervention.findFirst({
      where: buildVisibleCoachingWhere(actor, { id }),
      select: {
        id: true,
        title: true,
        status: true,
        representativeId: true,
        initiatorId: true,
        ownerId: true,
        teamId: true,
        country: true,
        plannedAt: true,
        startTime: true,
        endTime: true,
        startedAt: true,
        actualStartedAt: true,
        outlookEventId: true,
        calendarCancellationPending: true,
        notificationRecipientIdsJson: true,
        representative: { select: { firstName: true, lastName: true, role: true } },
        owner: { select: { firstName: true, lastName: true } },
      },
    });
    if (!coaching) notFound("Begeleiding niet gevonden.");
    if (!canManageStoredCoaching(actor, coaching)) forbidden("Je mag deze begeleiding niet beheren.");

    if (coaching.status !== "GEANNULEERD") {
      if (coaching.status !== "GEPLAND" || coaching.startedAt || coaching.actualStartedAt) {
        badRequest("Alleen een toekomstige, nog niet gestarte begeleiding kan worden geannuleerd.");
      }
      const plannedDate = coaching.plannedAt ? applicationDateKey(coaching.plannedAt) : undefined;
      if (!plannedDate || plannedDate <= applicationDateKey()) {
        badRequest("Alleen een toekomstige, nog niet gestarte begeleiding kan worden geannuleerd.");
      }
      if (!requestedReason) badRequest("Geef een reden van annulering op.");
      if (requestedReason.length > 2000) badRequest("De reden van annulering is te lang.");
    }

    const now = new Date();
    const alreadyCancelled = coaching.status === "GEANNULEERD";
    const cancelled = await prisma.$transaction(async (tx) => {
      const current = await tx.intervention.findUnique({
        where: { id },
        select: { status: true, startedAt: true, actualStartedAt: true, outlookEventId: true, calendarCancellationPending: true },
      });
      if (!current) notFound("Begeleiding niet gevonden.");
      if (current.status === "GEANNULEERD") {
        return tx.intervention.findUniqueOrThrow({ where: { id }, select: cancellationSelect });
      }
      if (current.status !== "GEPLAND" || current.startedAt || current.actualStartedAt) {
        badRequest("De begeleiding is intussen gestart of gewijzigd.");
      }
      const result = await tx.intervention.updateMany({
        where: { id, type: "BEGELEIDING", status: "GEPLAND", startedAt: null, actualStartedAt: null },
        data: {
          status: "GEANNULEERD",
          cancelledAt: now,
          cancelledById: actor.id,
          cancellationReason: requestedReason,
          cancelledPreviousStatus: "GEPLAND",
          calendarCancellationPending: Boolean(current.outlookEventId),
          calendarCancellationError: null,
        },
      });
      if (result.count !== 1) badRequest("De begeleiding is intussen gewijzigd. Vernieuw de lijst en probeer opnieuw.");
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          entityType: "Intervention",
          entityId: id,
          action: "coaching.cancelled",
          oldValue: JSON.stringify({ status: "GEPLAND" }),
          newValue: JSON.stringify({
            status: "GEANNULEERD",
            cancelledAt: now.toISOString(),
            cancelledByUserId: actor.id,
            reason: requestedReason,
            calendarCancellationPending: Boolean(current.outlookEventId),
          }),
        },
      });
      return tx.intervention.findUniqueOrThrow({ where: { id }, select: cancellationSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (cancelled.calendarCancellationPending) {
      try {
        const accessToken = await requireMicrosoftAccessToken(request);
        await cancelStoredOutlookEvent(accessToken, actor.id, id);
        await prisma.$transaction(async (tx) => {
          await tx.intervention.update({
            where: { id },
            data: {
              calendarCancellationPending: false,
              calendarCancellationError: null,
              outlookSyncStatus: "SYNCED",
              lastSyncedAt: now,
              syncError: null,
            },
          });
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              entityType: "Intervention",
              entityId: id,
              action: "coaching.cancellation_outlook_succeeded",
              newValue: JSON.stringify({ eventId: cancelled.outlookEventId, completedAt: now.toISOString() }),
            },
          });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : "Onbekende Outlook-fout.";
        console.error("[coaching-cancel] Outlook-annulering mislukt", { interventionId: id, actorId: actor.id, message });
        await prisma.$transaction(async (tx) => {
          await tx.intervention.update({
            where: { id },
            data: { calendarCancellationPending: true, calendarCancellationError: message, outlookSyncStatus: "ERROR", syncError: message },
          });
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              entityType: "Intervention",
              entityId: id,
              action: "coaching.cancellation_outlook_failed",
              newValue: JSON.stringify({ attemptedAt: now.toISOString(), result: "retry_required" }),
            },
          });
        });
        throw new ApiRequestError("De begeleiding is geannuleerd in FieldForce, maar de Outlook-afspraak kon niet worden geannuleerd. Probeer opnieuw.", 502);
      }
    }

    const recipients = parseIds(cancelled.notificationRecipientIdsJson);
    const notificationAudit = alreadyCancelled
      ? await prisma.auditLog.findFirst({ where: { entityType: "Intervention", entityId: id, action: "coaching.cancelled_notifications" }, select: { id: true } })
      : null;
    const notificationResults = notificationAudit
      ? { inApp: 0, emailSent: 0, emailFailed: 0 }
      : await sendCancellationNotifications({
          intervention: cancelled,
          actorId: actor.id,
          recipientUserIds: recipients,
          reason: cancelled.cancellationReason ?? requestedReason,
          cancelledAt: cancelled.cancelledAt ?? now,
        });
    if (!notificationAudit) {
      await prisma.auditLog.create({
        data: {
          userId: actor.id,
          entityType: "Intervention",
          entityId: id,
          action: "coaching.cancelled_notifications",
          newValue: JSON.stringify({ recipientUserIds: recipients, ...notificationResults }),
        },
      });
    }

    const state = await loadWorkflowStateFromDatabase({ interventionWhere: buildVisibleCoachingWhere(actor, { id }) });
    const intervention = state.interventions.find((item) => item.id === id);
    if (!intervention) notFound("Begeleiding niet gevonden.");
    return { ok: true, intervention, notificationResults };
  }, "De begeleiding kon niet worden geannuleerd.");
}

const cancellationSelect = {
  id: true,
  title: true,
  status: true,
  representativeId: true,
  ownerId: true,
  plannedAt: true,
  startTime: true,
  endTime: true,
  outlookEventId: true,
  calendarCancellationPending: true,
  cancellationReason: true,
  cancelledAt: true,
  notificationRecipientIdsJson: true,
  representative: { select: { firstName: true, lastName: true } },
  owner: { select: { firstName: true, lastName: true } },
} as const;

async function sendCancellationNotifications(input: {
  intervention: Prisma.InterventionGetPayload<{ select: typeof cancellationSelect }>;
  actorId: string;
  recipientUserIds: string[];
  reason: string;
  cancelledAt: Date;
}) {
  const recipients = await prisma.user.findMany({
    where: { id: { in: input.recipientUserIds }, active: true },
    select: { id: true, language: true },
  });
  let inApp = 0;
  let emailSent = 0;
  let emailFailed = 0;
  const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { firstName: true, lastName: true } });
  const actorName = `${actor?.firstName ?? ""} ${actor?.lastName ?? ""}`.trim();
  const coachedName = `${input.intervention.representative.firstName} ${input.intervention.representative.lastName}`.trim();
  const coachName = `${input.intervention.owner.firstName} ${input.intervention.owner.lastName}`.trim();
  const dateTime = formatCancellationDateTime(input.intervention.plannedAt, input.intervention.startTime, input.intervention.endTime);
  for (const recipient of recipients) {
    const eventKey = `COACHING_CANCELLED:coaching:${input.intervention.id}`;
    const message = cancellationMessage(recipient.language, { coachedName, dateTime, coachName, actorName, reason: input.reason });
    await createInAppNotification(prisma, {
      type: "COACHING_CANCELLED",
      recipientUserId: recipient.id,
      entityId: input.intervention.id,
      eventKey,
      triggeredByUserId: input.actorId,
      sourceModule: "BEGELEIDINGEN",
      message,
    });
    inApp += 1;
    const existingMail = await prisma.notificationDelivery.findUnique({
      where: { eventKey_recipientUserId_channel: { eventKey, recipientUserId: recipient.id, channel: "email" } },
      select: { status: true },
    });
    if (existingMail?.status === "sent") continue;
    try {
      const result = await sendWorkflowEventMail({
        type: "COACHING_CANCELLED",
        recipientUserId: recipient.id,
        triggeredByUserId: input.actorId,
        entityTitle: input.intervention.title,
        linkUrl: `/begeleidingen/${input.intervention.id}`,
        contentHtml: `<p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>`,
        parameters: {
          "coaching.date": input.intervention.plannedAt,
          "coaching.startTime": input.intervention.startTime,
          "coaching.endTime": input.intervention.endTime,
          "coaching.reason": input.reason,
        },
        context: { sourceModule: "BEGELEIDINGEN", entityType: "Intervention", entityId: input.intervention.id, eventKey, reason: "Begeleiding geannuleerd", sentAt: input.cancelledAt },
      });
      if (result.status === "sent") emailSent += 1;
    } catch (error) {
      emailFailed += 1;
      console.error("[coaching-cancel] annuleringsmail mislukt", { interventionId: input.intervention.id, recipientUserId: recipient.id, message: error instanceof Error ? error.message : "unknown" });
    }
  }
  return { inApp, emailSent, emailFailed };
}

function cancellationMessage(language: Language, input: { coachedName: string; dateTime: string; coachName: string; actorName: string; reason: string }) {
  return translate(language, "notifications.coaching.cancelled.details")
    .replace("{coachedUser}", input.coachedName)
    .replace("{dateTime}", input.dateTime)
    .replace("{coach}", input.coachName)
    .replace("{actor}", input.actorName)
    .replace("{reason}", input.reason);
}

function formatCancellationDateTime(date: Date | null, startTime: string | null, endTime: string | null) {
  const dateText = date ? applicationDateKey(date) : "-";
  return `${dateText} ${startTime ?? ""}${endTime ? ` - ${endTime}` : ""}`.trim();
}

function parseIds(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0))] : [];
  } catch {
    return [];
  }
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
