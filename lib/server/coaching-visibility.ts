import type { InterventionStatus, Prisma } from "@prisma/client";
import { canRoleEditCoachingForm } from "@/lib/coaching/form-access";
import type { MockUser } from "@/lib/types";
import { actorCanAccessCountry, actorCountryWhere } from "@/lib/server/authenticated-user";

const representativeReviewStatuses = [
  "WACHT_OP_AKKOORD",
  "VERZONDEN_TER_AKKOORD",
  "AKKOORD_DOOR_VERTEGENWOORDIGER",
  "GESLOTEN",
  "GEFINALISEERD",
  "AFGESLOTEN",
  "VOLTOOID",
] as readonly InterventionStatus[];

export function buildCoachingVisibilityFilter(
  currentUser: MockUser
): Prisma.InterventionWhereInput {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) return {};
  if (currentUser.role === "SALES_MANAGER") return actorCountryWhere(currentUser);
  if (currentUser.role === "ADMIN") return { country: currentUser.country };
  if (currentUser.role === "SALES_LEADER") {
    return {
      OR: [
        { initiatorId: currentUser.id },
        { ownerId: currentUser.id },
        ...(currentUser.teamId ? [{ teamId: currentUser.teamId }] : []),
      ],
    };
  }
  if (currentUser.role === "REPRESENTATIVE") {
    return {
      representativeId: currentUser.id,
      OR: [
        { status: { in: [...representativeReviewStatuses] } },
        { status: "GEPLAND", notifyRepresentative: true },
      ],
    };
  }
  return { country: currentUser.country };
}

export function buildCoachingDetailAccessFilter(
  currentUser: MockUser
): Prisma.InterventionWhereInput {
  if (currentUser.role === "REPRESENTATIVE") {
    return {
      representativeId: currentUser.id,
      status: { in: [...representativeReviewStatuses] },
    };
  }
  return buildCoachingVisibilityFilter(currentUser);
}

export function buildWorkflowInterventionVisibilityFilter(
  currentUser: MockUser
): Prisma.InterventionWhereInput {
  return {
    OR: [
      { type: { not: "BEGELEIDING" } },
      {
        type: "BEGELEIDING",
        AND: [buildCoachingVisibilityFilter(currentUser)],
      },
    ],
  };
}

export function buildVisibleCoachingWhere(
  currentUser: MockUser,
  extra: Prisma.InterventionWhereInput = {}
): Prisma.InterventionWhereInput {
  return {
    type: "BEGELEIDING",
    deletedAt: null,
    AND: [buildCoachingVisibilityFilter(currentUser), extra],
  };
}

export function buildOpenableCoachingWhere(
  currentUser: MockUser,
  extra: Prisma.InterventionWhereInput = {}
): Prisma.InterventionWhereInput {
  return {
    type: "BEGELEIDING",
    deletedAt: null,
    AND: [buildCoachingDetailAccessFilter(currentUser), extra],
  };
}

export function canManageStoredCoaching(
  actor: MockUser,
  coaching: {
    representative: { role: string };
    initiatorId: string;
    ownerId: string;
    teamId: string | null;
    country: string;
  }
) {
  if (!canRoleEditCoachingForm(actor.role)) return false;
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return true;

  if (actor.role === "SALES_LEADER") {
    if (coaching.representative.role === "SALES_LEADER") return false;
    return actor.id === coaching.initiatorId ||
      actor.id === coaching.ownerId ||
      Boolean(actor.teamId && actor.teamId === coaching.teamId);
  }

  return actorCanAccessCountry(actor, coaching.country);
}
