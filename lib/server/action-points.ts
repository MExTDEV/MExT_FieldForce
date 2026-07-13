import { ActionPointStatus, Prisma } from "@prisma/client";

import { forbidden, notFound } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { createInAppNotification } from "@/lib/server/notifications";
import type { Country, MockUser } from "@/lib/types";

const closedStatuses = new Set<ActionPointStatus>([
  "AFGEROND",
  "BEHAALD",
  "NIET_BEHAALD",
  "GEANNULEERD",
]);

const actionPointCloseSelect = {
  id: true,
  representativeId: true,
  interventionId: true,
  ownerId: true,
  title: true,
  status: true,
  closedAt: true,
  closedByUserId: true,
  updatedAt: true,
  representative: {
    select: {
      id: true,
      representativeId: true,
      role: true,
      country: true,
      teamId: true,
      firstName: true,
      lastName: true,
    },
  },
  closedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  assignments: {
    select: {
      id: true,
      representativeId: true,
      status: true,
      closedAt: true,
      closedByUserId: true,
      representative: {
        select: {
          id: true,
          representativeId: true,
          role: true,
          country: true,
          teamId: true,
          firstName: true,
          lastName: true,
        },
      },
      closedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} satisfies Prisma.ActionPointSelect;

type ActionPointForClose = Prisma.ActionPointGetPayload<{
  select: typeof actionPointCloseSelect;
}>;

type TargetUser = ActionPointForClose["representative"];

export type ClosedActionPointResult = {
  actionPointId: string;
  assignmentId?: string;
  representativeId: string;
  status: "afgerond";
  closedAt: string;
  closedByUserId: string;
  closedByName: string;
};

export async function closeActionPoint(
  actor: MockUser,
  input: { actionPointId: string; representativeId?: string }
): Promise<ClosedActionPointResult> {
  const actionPoint = await prisma.actionPoint.findUnique({
    where: { id: input.actionPointId },
    select: actionPointCloseSelect,
  });
  if (!actionPoint) notFound("Actiepunt niet gevonden.");

  const assignment = findTargetAssignment(actionPoint, input.representativeId);
  const target = assignment?.representative ?? actionPoint.representative;
  assertCanCloseTarget(actor, target);

  if (assignment) {
    if (isClosed(assignment.status, assignment.closedAt)) {
      return serializeClosedAssignment(actionPoint, assignment);
    }
    const closedAt = new Date();
    const closed = await prisma.$transaction(async (tx) => {
      const updated = await tx.actionPointAssignment.updateMany({
        where: {
          id: assignment.id,
          closedAt: null,
          status: { notIn: [...closedStatuses] },
        },
        data: {
          status: "AFGEROND",
          closedAt,
          closedByUserId: actor.id,
        },
      });
      const current = await tx.actionPoint.findUniqueOrThrow({
        where: { id: actionPoint.id },
        select: actionPointCloseSelect,
      });
      const currentAssignment = current.assignments.find((item) => item.id === assignment.id);
      if (!currentAssignment) throw new Error("Actiepunttoewijzing niet gevonden.");
      if (updated.count === 1) {
        await writeActionPointCloseAudit(tx, actor.id, actionPoint, assignment.id, assignment.status, target);
      }
      return { result: serializeClosedAssignment(current, currentAssignment), changed: updated.count === 1 };
    });
    if (closed.changed) await notifyActionPointClosed(actionPoint.id, target.id, actor.id);
    return closed.result;
  }

  if (isClosed(actionPoint.status, actionPoint.closedAt)) {
    return serializeClosedActionPoint(actionPoint);
  }

  const closedAt = new Date();
  const closed = await prisma.$transaction(async (tx) => {
    const updated = await tx.actionPoint.updateMany({
      where: {
        id: actionPoint.id,
        closedAt: null,
        status: { notIn: [...closedStatuses] },
      },
      data: {
        status: "AFGEROND",
        closedAt,
        closedByUserId: actor.id,
      },
    });
    const current = await tx.actionPoint.findUniqueOrThrow({
      where: { id: actionPoint.id },
      select: actionPointCloseSelect,
    });
    if (updated.count === 1) {
      await writeActionPointCloseAudit(tx, actor.id, actionPoint, undefined, actionPoint.status, target);
    }
    return { result: serializeClosedActionPoint(current), changed: updated.count === 1 };
  });
  if (closed.changed) await notifyActionPointClosed(actionPoint.id, target.id, actor.id);
  return closed.result;
}

function findTargetAssignment(actionPoint: ActionPointForClose, representativeId?: string) {
  if (!actionPoint.assignments.length) return undefined;
  const targetId = representativeId ?? actionPoint.representativeId;
  return actionPoint.assignments.find((assignment) =>
    [assignment.representativeId, assignment.representative.representativeId].filter(Boolean).includes(targetId)
  ) ?? notFound("Actiepunttoewijzing niet gevonden.");
}

function assertCanCloseTarget(actor: MockUser, target: TargetUser) {
  if (actor.role === "REPRESENTATIVE" || actor.role === "SERVICE_OPERATOR") {
    forbidden("Je hebt onvoldoende rechten om dit actiepunt te sluiten.");
  }
  if (actor.role === "SUPER_ADMIN") return;
  if (actor.role === "SALES_LEADER") {
    if (target.role === "REPRESENTATIVE" && actor.teamId && target.teamId === actor.teamId) return;
    forbidden("Dit actiepunt valt buiten je toegestane teamscope.");
  }
  const country = target.country as Country;
  if (["COUNTRY_MANAGER", "ADMIN"].includes(actor.role)) {
    if ((actor.countryAccess?.length ? actor.countryAccess : [actor.country]).includes(country)) return;
    forbidden("Dit actiepunt valt buiten je toegestane landenscope.");
  }
  if (actor.role === "GROUP_MANAGER") {
    if ((actor.countryAccess?.length ? actor.countryAccess : [actor.country]).includes(country)) return;
    forbidden("Dit actiepunt valt buiten je toegestane organisatiescope.");
  }
  if (actor.role === "SALES_MANAGER") {
    if ((actor.countryAccess ?? []).includes(country)) return;
    forbidden("Dit actiepunt valt buiten je toegestane landenscope.");
  }
  forbidden("Je hebt onvoldoende rechten om dit actiepunt te sluiten.");
}

function isClosed(status: ActionPointStatus, closedAt: Date | null) {
  return Boolean(closedAt) || closedStatuses.has(status);
}

async function writeActionPointCloseAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  actionPoint: ActionPointForClose,
  assignmentId: string | undefined,
  oldStatus: ActionPointStatus,
  target: TargetUser
) {
  await tx.auditLog.create({
    data: {
      userId: actorId,
      entityType: "ActionPoint",
      entityId: actionPoint.id,
      action: "actionPoint.closed",
      oldValue: JSON.stringify({
        status: oldStatus,
        assignmentId,
        representativeId: target.id,
      }),
      newValue: JSON.stringify({
        status: "AFGEROND",
        assignmentId,
        representativeId: target.id,
        interventionId: actionPoint.interventionId,
        scope: {
          country: target.country,
          teamId: target.teamId,
        },
      }),
    },
  });
}

async function notifyActionPointClosed(actionPointId: string, recipientUserId: string, actorId: string) {
  try {
    await createInAppNotification(prisma, {
      type: "ACTION_POINT_CLOSED",
      recipientUserId,
      entityId: actionPointId,
      eventKey: `ACTION_POINT_CLOSED:${actionPointId}:${recipientUserId}`,
      triggeredByUserId: actorId,
      sourceModule: "ACTIEPUNTEN",
    });
  } catch (error) {
    console.warn("[action-points] Sluitmelding kon niet worden aangemaakt.", error);
  }
}

function serializeClosedActionPoint(actionPoint: ActionPointForClose): ClosedActionPointResult {
  return {
    actionPointId: actionPoint.id,
    representativeId: actionPoint.representative.representativeId ?? actionPoint.representative.id,
    status: "afgerond",
    closedAt: (actionPoint.closedAt ?? actionPoint.updatedAt ?? new Date()).toISOString(),
    closedByUserId: actionPoint.closedByUserId ?? "",
    closedByName: fullName(actionPoint.closedBy),
  };
}

function serializeClosedAssignment(
  actionPoint: ActionPointForClose,
  assignment: ActionPointForClose["assignments"][number]
): ClosedActionPointResult {
  return {
    actionPointId: actionPoint.id,
    assignmentId: assignment.id,
    representativeId: assignment.representative.representativeId ?? assignment.representative.id,
    status: "afgerond",
    closedAt: (assignment.closedAt ?? new Date()).toISOString(),
    closedByUserId: assignment.closedByUserId ?? "",
    closedByName: fullName(assignment.closedBy),
  };
}

function fullName(user: { firstName: string; lastName: string } | null) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "";
}
