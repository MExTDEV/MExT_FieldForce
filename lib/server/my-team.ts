import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { loadPerformanceDatasetFromDatabase } from "@/lib/server/performance";
import {
  buildCoachingVisibilityFilter,
  buildVisibleCoachingWhere,
} from "@/lib/server/coaching-visibility";
import { actorCountryWhere } from "@/lib/server/authenticated-user";
import { listAppModules } from "@/lib/server/modules";
import { latestHistoricalCoaching, latestScoredCoaching } from "@/lib/performance-data";
import {
  canShowPlannedCoachingIndicator,
  sortMyTeamMembers,
  withPlannedCoachingIndicators,
  type MyTeamMember,
  type PlannedCoachingIndicatorSource,
} from "@/lib/my-team";
import type { MockUser } from "@/lib/types";

export function myTeamScopeWhere(actor: MockUser): Prisma.TeamWhereInput {
  if (actor.role === "SALES_LEADER") {
    return { id: actor.teamId ?? "__geen_team__" };
  }
  if (actor.role === "COUNTRY_MANAGER") {
    return { country: actor.country };
  }
  if (actor.role === "SALES_MANAGER") {
    return actorCountryWhere(actor);
  }
  if (actor.role === "ADMIN") {
    return { country: actor.country };
  }
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) {
    return {};
  }
  return { id: "__geen_toegang__" };
}
export async function listVisibleMyTeamMembers(actor: MockUser): Promise<MyTeamMember[]> {
  const [teams, modules] = await Promise.all([
    prisma.team.findMany({
      where: { active: true, AND: [myTeamScopeWhere(actor)] },
      select: {
        id: true,
        name: true,
        country: true,
        primaryLeader: {
          select: {
            id: true, representativeId: true, firstName: true, lastName: true,
            role: true, active: true,
          },
        },
        leaders: {
          where: { user: { active: true } },
          select: {
            user: {
              select: {
                id: true, representativeId: true, firstName: true, lastName: true,
                role: true, active: true,
              },
            },
          },
        },
        members: {
          where: { active: true },
          select: {
            id: true, representativeId: true, firstName: true, lastName: true,
            role: true, active: true,
          },
        },
      },
      orderBy: [{ country: "asc" }, { name: "asc" }],
    }),
    listAppModules(),
  ]);

  const representativeIds = new Set<string>();
  const plannedCoachingTargetUserIds = new Set<string>();
  for (const team of teams) {
    for (const member of team.members) {
      if (member.role === "REPRESENTATIVE") {
        representativeIds.add(member.representativeId ?? member.id);
      }
      if (member.role === "REPRESENTATIVE" || member.role === "SALES_LEADER") {
        plannedCoachingTargetUserIds.add(member.id);
      }
    }
    if (team.primaryLeader?.active && team.primaryLeader.role === "SALES_LEADER") {
      plannedCoachingTargetUserIds.add(team.primaryLeader.id);
    }
    for (const { user } of team.leaders) {
      if (user.role === "SALES_LEADER") plannedCoachingTargetUserIds.add(user.id);
    }
  }

  const [performance, plannedCoachings] = await Promise.all([
    representativeIds.size
      ? loadPerformanceDatasetFromDatabase({
          coachingWhere: buildCoachingVisibilityFilter(actor),
        })
      : undefined,
    canShowPlannedCoachingIndicator(actor, modules)
      ? loadVisiblePlannedCoachingSources(actor, [...plannedCoachingTargetUserIds])
      : [],
  ]);

  const members = teams.flatMap((team) => {
    const linkedLeaderIds = new Set([
      team.primaryLeader?.active ? team.primaryLeader.id : "",
      ...team.leaders.map(({ user }) => user.id),
    ]);
    const users = new Map([
      ...team.members.map((member) => [member.id, member] as const),
      ...(team.primaryLeader?.active
        ? [[team.primaryLeader.id, team.primaryLeader] as const]
        : []),
      ...team.leaders.map(({ user }) => [user.id, user] as const),
    ]);

    return sortMyTeamMembers([...users.values()].map((user) => {
      const representativeId = user.role === "REPRESENTATIVE"
        ? user.representativeId ?? user.id
        : undefined;
      const latestCompleted = representativeId && performance
        ? latestHistoricalCoaching(performance, representativeId)
        : undefined;
      const latestScored = representativeId && performance
        ? latestScoredCoaching(performance, representativeId)
        : undefined;
      return {
        id: user.id,
        representativeId,
        firstName: user.firstName,
        lastName: user.lastName,
        initials: `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`,
        role: user.role,
        country: team.country,
        countryId: team.country,
        team: team.name,
        teamId: team.id,
        isTeamLeader: linkedLeaderIds.has(user.id) || user.role === "SALES_LEADER",
        lastCoaching: latestCompleted?.date,
        overallScore: latestScored?.overallScore === undefined
          ? undefined
          : latestScored.overallScore / 20,
        profileHref: representativeId
          ? `/mijn-team/${encodeURIComponent(representativeId)}`
          : `/mijn-team/gebruiker/${encodeURIComponent(user.id)}`,
      } satisfies MyTeamMember;
    }));
  });

  return withPlannedCoachingIndicators(members, plannedCoachings);
}

async function loadVisiblePlannedCoachingSources(
  actor: MockUser,
  targetUserIds: string[]
): Promise<PlannedCoachingIndicatorSource[]> {
  if (!targetUserIds.length) return [];
  const rows = await prisma.intervention.findMany({
    where: buildVisibleCoachingWhere(actor, {
      status: "GEPLAND",
      representativeId: { in: targetUserIds },
    }),
    select: {
      representativeId: true,
      plannedAt: true,
      updatedAt: true,
      representative: {
        select: {
          id: true,
          representativeId: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    representativeId: row.representative.representativeId ?? row.representativeId,
    status: "gepland",
    plannedDate: row.plannedAt?.toISOString().slice(0, 10),
    updatedAt: row.updatedAt.toISOString(),
    subject: {
      id: row.representative.representativeId ?? row.representativeId,
      userId: row.representative.id,
    },
  }));
}
