import { badRequest, forbidden, handleApi, notFound } from "@/lib/server/api";
import { requireAuthenticatedUser, requirePermission } from "@/lib/server/authenticated-user";
import { buildVisibleCoachingWhere, canManageStoredCoaching } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { sendWorkflowEventMail } from "@/lib/server/mail-service";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import {
  isCoachingApprovalOverrideDue,
  isScheduledCoachingEndPast,
  latestCoachingApprovalOverrideSentAt,
} from "@/lib/coaching/schedule";
import { isCoachingApprovalManagerRole } from "@/lib/coaching/access";
import {
  isPendingCoachingApprovalStatus,
  resolveCoachingApprovalSentForApprovalAt,
} from "@/lib/coaching/approval-actions";
import { Prisma } from "@prisma/client";

const reminderCooldownMs = 10 * 60 * 1000;

type CoachingAction = "remind_approval" | "override_approval" | "not_executed";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/coaching/actions", async () => {
    const { id } = await context.params;
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    requirePermission(actor, "moduleVisitRecord");
    const payload = await request.json() as { action?: CoachingAction };
    if (!payload.action || !["remind_approval", "override_approval", "not_executed"].includes(payload.action)) {
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
        sentForApprovalAt: true,
        representative: { select: { firstName: true, lastName: true, role: true, email: true } },
        approval: { select: { representativeId: true, createdAt: true } },
      },
    });
    if (!coaching) notFound("Begeleiding niet gevonden.");
    if (!canManageStoredCoaching(actor, coaching) || !isCoachingApprovalManagerRole(actor.role)) {
      forbidden("Je mag deze begeleiding niet beheren.");
    }

    if (payload.action === "remind_approval") {
      return remindApproval(coaching, actor.id);
    }

    if (payload.action === "override_approval") {
      return overrideApproval(coaching, actor.id);
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
    approval: { representativeId: string; createdAt: Date } | null;
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

async function overrideApproval(
  coaching: {
    id: string;
    status: string;
    representativeId: string;
    sentForApprovalAt: Date | null;
    approval: { representativeId: string; createdAt: Date } | null;
  },
  actorId: string
) {
  if (!isPendingCoachingApprovalStatus(coaching.status)) {
    badRequest("COACHING_APPROVAL_OVERRIDE_STATUS_CHANGED");
  }
  const sentForApprovalAt = await resolveStoredApprovalSentAt(coaching);
  if (!sentForApprovalAt) {
    badRequest("COACHING_APPROVAL_OVERRIDE_TIMESTAMP_MISSING");
  }
  const now = new Date();
  if (!isCoachingApprovalOverrideDue({ sentForApprovalAt, now })) {
    badRequest("COACHING_APPROVAL_OVERRIDE_TOO_EARLY");
  }

  const approvalRecipientUserId = coaching.approval?.representativeId ?? coaching.representativeId;
  await prisma.$transaction(async (tx) => {
    const update = await tx.intervention.updateMany({
      where: {
        id: coaching.id,
        type: "BEGELEIDING",
        deletedAt: null,
        status: { in: ["VERZONDEN_TER_AKKOORD", "WACHT_OP_AKKOORD"] },
        OR: [
          { sentForApprovalAt: { lte: latestCoachingApprovalOverrideSentAt(now) } },
          { sentForApprovalAt: null },
        ],
      },
      data: {
        status: "AKKOORD_DOOR_VERTEGENWOORDIGER",
        sentForApprovalAt,
      },
    });
    if (update.count !== 1) {
      badRequest("COACHING_APPROVAL_OVERRIDE_STATUS_CHANGED");
    }
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entityType: "Intervention",
        entityId: coaching.id,
        action: "coaching.approved_by_manager_override",
        oldValue: JSON.stringify({
          status: "VERZONDEN_TER_AKKOORD",
          sentForApprovalAt: sentForApprovalAt.toISOString(),
        }),
        newValue: JSON.stringify({
          status: "AKKOORD_DOOR_VERTEGENWOORDIGER",
          overriddenByUserId: actorId,
          overriddenAt: now.toISOString(),
          approvalRecipientUserId,
          originalSentForApprovalAt: sentForApprovalAt.toISOString(),
          reason: "ACKNOWLEDGEMENT_TIMEOUT",
        }),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const state = await loadWorkflowStateFromDatabase({
    interventionWhere: { type: "BEGELEIDING", id: coaching.id, deletedAt: null },
  });
  const intervention = state.interventions.find((item) => item.id === coaching.id);
  if (!intervention) notFound("Begeleiding niet gevonden.");
  return { action: "override_approval" as const, intervention };
}

async function resolveStoredApprovalSentAt(coaching: {
  id: string;
  sentForApprovalAt: Date | null;
  approval: { createdAt: Date } | null;
}) {
  if (coaching.sentForApprovalAt) return coaching.sentForApprovalAt;
  const audit = await prisma.auditLog.findMany({
    where: {
      entityType: "Intervention",
      entityId: coaching.id,
      action: "coaching.sent_for_approval",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, action: true, newValue: true },
  });
  const resolved = resolveCoachingApprovalSentForApprovalAt({
    sentForApprovalAt: coaching.sentForApprovalAt,
    auditTrail: audit.map((entry) => ({
      at: entry.createdAt.toISOString(),
      action: entry.action,
      newValue: parseJsonObject(entry.newValue),
    })),
    approvalCreatedAt: coaching.approval?.createdAt,
  });
  return resolved ? new Date(resolved) : null;
}

function parseJsonObject(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}
