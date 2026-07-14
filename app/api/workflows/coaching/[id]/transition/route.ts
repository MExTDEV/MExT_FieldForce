import { badRequest, forbidden, handleApi, notFound } from "@/lib/server/api";
import {
  requireAuthenticatedUser,
  requirePermission,
} from "@/lib/server/authenticated-user";
import { buildVisibleCoachingWhere, canManageStoredCoaching } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { sendWorkflowEventMail } from "@/lib/server/mail-service";
import {
  createInAppNotification,
  createCoachingApprovalNotification,
  markCoachingApprovalNotificationHandled,
} from "@/lib/server/notifications";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import {
  buildCoachingApprovalConfirmedEntityTitle,
  buildCoachingApprovalConfirmedEventKey,
  coachingApprovalConfirmedNotificationType,
  resolveCoachingApprovalConfirmedRecipients,
} from "@/lib/coaching/approval-notifications";
import { approvalHasCompletedReflection } from "@/lib/coaching/approval-reflection";

type CoachingTransition = "reopen" | "send_for_approval" | "approve";

const completedStatuses = ["VOLTOOID", "GEFINALISEERD", "GESLOTEN", "AFGESLOTEN"] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/coaching/transition", async () => {
    const { id } = await context.params;
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    requirePermission(actor, "moduleVisitRecord");
    const payload = await request.json() as { action?: CoachingTransition };
    if (!payload.action || !["reopen", "send_for_approval", "approve"].includes(payload.action)) {
      badRequest("Ongeldige statusovergang.");
    }

    const coaching = await prisma.intervention.findFirst({
      where: buildVisibleCoachingWhere(actor, { id }),
      select: {
        id: true,
        title: true,
        status: true,
        representativeId: true,
        approval: {
          select: {
            reflectionKpiHtml: true,
            reflectionLearningHtml: true,
            reflectionGoalHtml: true,
            reflectionCompletedAt: true,
          },
        },
        initiatorId: true,
        ownerId: true,
        teamId: true,
        country: true,
        plannedAt: true,
        sentForApprovalAt: true,
        sentForApprovalById: true,
        approvedByRepAt: true,
        representative: { select: { firstName: true, lastName: true, role: true } },
      },
    });
    if (!coaching) notFound("Begeleiding niet gevonden.");

    const now = new Date();
    const oldValue = transitionSnapshot(coaching);
    if (payload.action === "reopen") {
      badRequest("Een uitgevoerde begeleiding is definitief read-only en kan niet heropend worden.");
    } else if (payload.action === "send_for_approval") {
      requireManager(actor, coaching);
      if (!completedStatuses.includes(coaching.status as typeof completedStatuses[number])) {
        badRequest("Werk de begeleiding eerst af voordat je ze ter akkoord verstuurt.");
      }
      await prisma.$transaction(async (tx) => {
        await tx.intervention.update({
          where: { id },
          data: {
            status: "VERZONDEN_TER_AKKOORD",
            sentForApprovalAt: now,
            sentForApprovalById: actor.id,
          },
        });
        await createCoachingApprovalNotification(tx, {
          interventionId: id,
          representativeId: coaching.representativeId,
        });
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            entityType: "Intervention",
            entityId: id,
            action: "coaching.sent_for_approval",
            oldValue: JSON.stringify(oldValue),
            newValue: JSON.stringify({ status: "VERZONDEN_TER_AKKOORD", sentForApprovalAt: now.toISOString() }),
          },
        });
      });
      await sendCoachingApprovalMailSafely({
        actorId: actor.id,
        interventionId: id,
        recipientUserId: coaching.representativeId,
        title: coaching.title,
        sentAt: now,
      });
    } else {
      if (!["REPRESENTATIVE", "SALES_LEADER"].includes(actor.role) || coaching.representativeId !== actor.id) {
        forbidden("Alleen de betrokken begeleide gebruiker kan voor akkoord bevestigen.");
      }
      if (coaching.status !== "VERZONDEN_TER_AKKOORD") {
        badRequest("Deze begeleiding staat niet klaar voor akkoord.");
      }
      if (!approvalHasCompletedReflection(coaching.approval)) {
        badRequest("Vul eerst de drie verplichte reflectievragen in voordat je akkoord geeft.");
      }
      let handledApprovalId: string | undefined;
      await prisma.$transaction(async (tx) => {
        await tx.intervention.update({
          where: { id },
          data: {
            status: "AKKOORD_DOOR_VERTEGENWOORDIGER",
            approvedByRepAt: now,
            approvedByRepId: actor.id,
          },
        });
        const handledApproval = await markCoachingApprovalNotificationHandled(tx, {
          interventionId: id,
          handledAt: now,
        });
        handledApprovalId = handledApproval.id;
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            entityType: "Intervention",
            entityId: id,
            action: "coaching.approved_by_representative",
            oldValue: JSON.stringify(oldValue),
            newValue: JSON.stringify({ status: "AKKOORD_DOOR_VERTEGENWOORDIGER", approvedByRepAt: now.toISOString() }),
          },
        });
      });
      await sendCoachingApprovalConfirmedNotifications({
        actorId: actor.id,
        approvalId: handledApprovalId,
        confirmedAt: now,
        intervention: {
          id: coaching.id,
          title: coaching.title,
          ownerId: coaching.ownerId,
          initiatorId: coaching.initiatorId,
          sentForApprovalById: coaching.sentForApprovalById ?? undefined,
          plannedDate: coaching.plannedAt?.toISOString().slice(0, 10),
          representativeName: `${coaching.representative.firstName} ${coaching.representative.lastName}`.trim(),
        },
      });
    }

    const state = await loadWorkflowStateFromDatabase({
      interventionWhere: buildVisibleCoachingWhere(actor, { id }),
    });
    const intervention = state.interventions.find((item) => item.id === id);
    if (!intervention) notFound("Begeleiding niet gevonden.");
    return { intervention };
  }, "De status van de begeleiding kon niet worden aangepast.");
}

async function sendCoachingApprovalConfirmedNotifications(input: {
  actorId: string;
  approvalId?: string;
  confirmedAt: Date;
  intervention: {
    id: string;
    title: string;
    ownerId: string;
    initiatorId: string;
    sentForApprovalById?: string;
    plannedDate?: string;
    representativeName?: string;
  };
}) {
  const eventKey = buildCoachingApprovalConfirmedEventKey(input.intervention.id, input.approvalId);
  const recipientUserIds = resolveCoachingApprovalConfirmedRecipients(input.intervention, input.actorId);
  const entityTitle = buildCoachingApprovalConfirmedEntityTitle(input.intervention);

  for (const recipientUserId of recipientUserIds) {
    await createInAppNotification(prisma, {
      type: coachingApprovalConfirmedNotificationType,
      recipientUserId,
      entityId: input.intervention.id,
      eventKey,
      triggeredByUserId: input.actorId,
      sourceModule: "BEGELEIDINGEN",
    });
    await sendCoachingApprovalConfirmedMailSafely({
      actorId: input.actorId,
      interventionId: input.intervention.id,
      recipientUserId,
      entityTitle,
      eventKey,
      confirmedAt: input.confirmedAt,
    });
  }
}

async function sendCoachingApprovalConfirmedMailSafely(input: {
  actorId: string;
  interventionId: string;
  recipientUserId: string;
  entityTitle: string;
  eventKey: string;
  confirmedAt: Date;
}) {
  try {
    await sendWorkflowEventMail({
      type: coachingApprovalConfirmedNotificationType,
      recipientUserId: input.recipientUserId,
      triggeredByUserId: input.actorId,
      entityTitle: input.entityTitle,
      linkUrl: `/begeleidingen/${input.interventionId}`,
      context: {
        sourceModule: "BEGELEIDINGEN",
        entityType: "Intervention",
        entityId: input.interventionId,
        eventKey: input.eventKey,
        reason: "Begeleiding voor akkoord bevestigd",
        sentAt: input.confirmedAt,
      },
    });
  } catch (error) {
    console.error("[mail] Begeleidingsmail voor bevestigd akkoord kon niet worden verzonden.", error);
  }
}

async function sendCoachingApprovalMailSafely(input: {
  actorId: string;
  interventionId: string;
  recipientUserId: string;
  title: string;
  sentAt: Date;
}) {
  try {
    await sendWorkflowEventMail({
      type: "COACHING_APPROVAL_REQUEST",
      recipientUserId: input.recipientUserId,
      triggeredByUserId: input.actorId,
      entityTitle: input.title,
      linkUrl: `/begeleidingen/${input.interventionId}`,
      context: {
        sourceModule: "BEGELEIDINGEN",
        entityType: "Intervention",
        entityId: input.interventionId,
        eventKey: `COACHING_APPROVAL_REQUEST:coaching:${input.interventionId}:${input.sentAt.toISOString()}`,
        reason: "Begeleiding ter akkoord verstuurd",
        sentAt: input.sentAt,
      },
    });
  } catch (error) {
    console.error("[mail] Begeleidingsmail voor akkoord kon niet worden verzonden.", error);
  }
}

function requireManager(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  coaching: {
    initiatorId: string;
    ownerId: string;
    teamId: string | null;
    country: string;
    representative: { role: string };
  }
) {
  if (!canManageStoredCoaching(actor, coaching)) {
    forbidden("Je mag deze begeleiding niet beheren.");
  }
}

function transitionSnapshot(coaching: {
  status: string;
  sentForApprovalAt: Date | null;
  approvedByRepAt: Date | null;
}) {
  return {
    status: coaching.status,
    sentForApprovalAt: coaching.sentForApprovalAt?.toISOString(),
    approvedByRepAt: coaching.approvedByRepAt?.toISOString(),
  };
}
