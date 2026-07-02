import { badRequest, forbidden, handleApi, notFound } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { buildVisibleCoachingWhere } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";

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
    const payload = await request.json() as { action?: CoachingTransition };
    if (!payload.action || !["reopen", "send_for_approval", "approve"].includes(payload.action)) {
      badRequest("Ongeldige statusovergang.");
    }

    const coaching = await prisma.intervention.findFirst({
      where: buildVisibleCoachingWhere(actor, { id }),
      select: {
        id: true,
        status: true,
        representativeId: true,
        initiatorId: true,
        ownerId: true,
        teamId: true,
        country: true,
        sentForApprovalAt: true,
        approvedByRepAt: true,
      },
    });
    if (!coaching) notFound("Begeleiding niet gevonden.");

    const now = new Date();
    const oldValue = transitionSnapshot(coaching);
    if (payload.action === "reopen") {
      requireManager(actor, coaching);
      if (!completedStatuses.includes(coaching.status as typeof completedStatuses[number])) {
        badRequest("Alleen een afgewerkte begeleiding kan opnieuw geopend worden.");
      }
      await prisma.$transaction(async (tx) => {
        await tx.intervention.update({
          where: { id },
          data: { status: "IN_UITVOERING" },
        });
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            entityType: "Intervention",
            entityId: id,
            action: "coaching.reopened",
            oldValue: JSON.stringify(oldValue),
            newValue: JSON.stringify({ status: "IN_UITVOERING" }),
          },
        });
      });
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
        await tx.approval.upsert({
          where: { interventionId: id },
          create: {
            interventionId: id,
            representativeId: coaching.representativeId,
            openedAt: now,
          },
          update: { status: null, comment: null, openedAt: now, confirmedAt: null },
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
    } else {
      if (actor.role !== "REPRESENTATIVE" || coaching.representativeId !== actor.id) {
        forbidden("Alleen de betrokken vertegenwoordiger kan voor akkoord bevestigen.");
      }
      if (coaching.status !== "VERZONDEN_TER_AKKOORD") {
        badRequest("Deze begeleiding staat niet klaar voor akkoord.");
      }
      await prisma.$transaction(async (tx) => {
        await tx.intervention.update({
          where: { id },
          data: {
            status: "AKKOORD_DOOR_VERTEGENWOORDIGER",
            approvedByRepAt: now,
            approvedByRepId: actor.id,
          },
        });
        await tx.approval.update({
          where: { interventionId: id },
          data: { status: "GELEZEN_AKKOORD", confirmedAt: now },
        });
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
    }

    const state = await loadWorkflowStateFromDatabase({
      interventionWhere: buildVisibleCoachingWhere(actor, { id }),
    });
    const intervention = state.interventions.find((item) => item.id === id);
    if (!intervention) notFound("Begeleiding niet gevonden.");
    return { intervention };
  }, "De status van de begeleiding kon niet worden aangepast.");
}

function requireManager(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  coaching: { initiatorId: string; ownerId: string; teamId: string | null; country: string }
) {
  const allowed = actor.role === "SUPER_ADMIN" ||
    (actor.role === "ADMIN" && actor.country === coaching.country) ||
    (actor.role === "SALES_LEADER" && (
      actor.id === coaching.initiatorId ||
      actor.id === coaching.ownerId ||
      Boolean(actor.teamId && actor.teamId === coaching.teamId)
    ));
  if (!allowed) forbidden("Je mag deze begeleiding niet beheren.");
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
