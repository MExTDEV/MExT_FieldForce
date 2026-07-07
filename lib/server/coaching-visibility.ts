import type { Prisma } from "@prisma/client";
import type { MockUser } from "@/lib/types";
import { actorCountryWhere } from "@/lib/server/authenticated-user";

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
      status: { in: ["VERZONDEN_TER_AKKOORD", "AKKOORD_DOOR_VERTEGENWOORDIGER"] },
    };
  }
  return { country: currentUser.country };
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
