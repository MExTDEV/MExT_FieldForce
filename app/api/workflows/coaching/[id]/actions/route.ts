import { badRequest, forbidden, handleApi, notFound } from "@/lib/server/api";
import { requireAuthenticatedUser, requirePermission } from "@/lib/server/authenticated-user";
import { buildVisibleCoachingWhere, canManageStoredCoaching } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { sendWorkflowEventMail } from "@/lib/server/mail-service";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import { isScheduledCoachingEndPast } from "@/lib/coaching/schedule";
import { isCoachingApprovalManagerRole } from "@/lib/coaching/access";
import { isPendingCoachingApprovalStatus } from "@/lib/coaching/approval-actions";
import { Prisma } from "@prisma/client";

const reminderCooldownMs = 10 * 60 * 1000;

type CoachingAction = "remind_approval" | "not_executed";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/coaching/actions", async () => {
    const { id } = await context.params;
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    requirePermission(actor, "moduleVisitRecord");
    const payload = await request.json() as { action?: CoachingAction };
    if (!payload.action || !["remind_approval", "not_executed"].includes(payload.action)) {
      badRequest("Ongeldige begeleidingactie.");
    }

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
        endTime: true,
        representative: { select: { firstName: true, lastName: true, role: true, email: true } },
        approval: { select: { representativeId: true } },
      },
    });
    if (!coaching) notFound("Begeleiding niet gevonden.");
    if (!canManageStoredCoaching(actor, coaching) || !isCoachingApprovalManagerRole(actor.role)) {
      forbidden("Je mag deze begeleiding niet beheren.");
    }

    if (payload.action === "remind_approval") {
      return remindApproval(coaching, actor.id);
    }

    if (coaching.status !== "GEPLAND") {
      badRequest("Alleen een geplande begeleiding kan als niet uitgevoerd worden afgesloten.");
    }
    if (!isScheduledCoachingEndPast({
      plannedDate: coaching.plannedAt?.toISOString().slice(0, 10),
      endTime: coaching.endTime ?? undefined,
      country: coaching.country,
    })) {
      badRequest("De geplande eindtijd is nog niet verstreken.");
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.intervention.updateMany({
        where: { id, type: "BEGELEIDING", status: "GEPLAND", deletedAt: null },
        data: {
          status: "NIET_UITGEVOERD",
          administrativelyClosedAt: now,
          administrativelyClosedById: actor.id,
          administrativeCloseReason: "Niet uitgevoerd",
        },
      });
      if (result.count !== 1) {
        badRequest("De begeleiding is intussen gewijzigd. Vernieuw de lijst en probeer opnieuw.");
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          entityType: "Intervention",
          entityId: id,
          action: "coaching.marked_not_executed",
          oldValue: JSON.stringify({ status: "GEPLAND" }),
          newValue: JSON.stringify({
            status: "NIET_UITGEVOERD",
            closedAt: now.toISOString(),
            closedByUserId: actor.id,
            reason: "Niet uitgevoerd",
          }),
        },
      });
      return tx.intervention.findUnique({ where: { id }, select: { id: true, status: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!updated) notFound("Begeleiding niet gevonden.");
    const state = await loadWorkflowStateFromDatabase({
      interventionWhere: { type: "BEGELEIDING", id, deletedAt: null },
    });
    const intervention = state.interventions.find((item) => item.id === id);
    if (!intervention) notFound("Begeleiding niet gevonden.");
    return { action: payload.action, intervention };
  }, "De begeleidingactie kon niet worden uitgevoerd.");
}
async function remindApproval(
  coaching: {
    id: string;
    title: string;
    status: string;
    representativeId: string;
    approval: { representativeId: string } | null;
  },
  actorId: string
) {
  if (!isPendingCoachingApprovalStatus(coaching.status)) {
    badRequest("Alleen een begeleiding die ter akkoord is verzonden kan herinnerd worden.");
  }
  const recipientUserId = coaching.approval?.representativeId ?? coaching.representativeId;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const lastReminder = await tx.auditLog.findFirst({
      where: { entityType: "Intervention", entityId: coaching.id, action: "coaching.approval_reminded" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastReminder && now.getTime() - lastReminder.createdAt.getTime() < reminderCooldownMs) {
      badRequest(`Er werd recent al een herinnering verstuurd (${lastReminder.createdAt.toISOString()}).`);
    }
    await tx.approval.upsert({
      where: { interventionId: coaching.id },
      create: { interventionId: coaching.id, representativeId: recipientUserId, openedAt: null },
      update: {
        representativeId: recipientUserId,
        status: null,
        comment: null,
        openedAt: null,
        confirmedAt: null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entityType: "Intervention",
        entityId: coaching.id,
        action: "coaching.approval_reminded",
        newValue: JSON.stringify({
          sentAt: now.toISOString(),
          senderUserId: actorId,
          recipientUserId,
        }),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  let mailStatus: "sent" | "skipped" | "error" = "skipped";
  let mailError: string | undefined;
  try {
    const result = await sendWorkflowEventMail({
      type: "COACHING_APPROVAL_REQUEST",
      recipientUserId,
      triggeredByUserId: actorId,
      entityTitle: coaching.title,
      linkUrl: `/begeleidingen/${coaching.id}`,
      context: {
        sourceModule: "BEGELEIDINGEN",
        entityType: "Intervention",
        entityId: coaching.id,
        eventKey: `COACHING_APPROVAL_REMINDER:coaching:${coaching.id}:${now.toISOString()}`,
        reason: "Herinnering aan ontbrekend akkoord voor begeleiding",
        sentAt: now,
      },
    });
    mailStatus = result.status === "sent" ? "sent" : "skipped";
  } catch (error) {
    mailStatus = "error";
    mailError = error instanceof Error ? error.message : "Onbekende mailfout.";
    console.error("[mail] Herinnering voor begeleiding kon niet worden verzonden.", error);
  }

  return { action: "remind_approval" as const, lastReminderAt: now.toISOString(), mailStatus, mailError };
}
