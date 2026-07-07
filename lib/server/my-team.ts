import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { loadPerformanceDatasetFromDatabase } from "@/lib/server/performance";
import { buildCoachingVisibilityFilter } from "@/lib/server/coaching-visibility";
import { actorCountryWhere } from "@/lib/server/authenticated-user";
import { latestHistoricalCoaching, latestScoredCoaching } from "@/lib/performance-data";
import { sortMyTeamMembers, type MyTeamMember } from "@/lib/my-team";
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
  const teams = await prisma.team.findMany({
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
  });

  const representativeIds = new Set<string>();
  for (const team of teams) {
    for (const member of team.members) {
      if (member.role === "REPRESENTATIVE") {
        representativeIds.add(member.representativeId ?? member.id);
      }
    }
  }

  const performance = representativeIds.size
    ? await loadPerformanceDatasetFromDatabase({
        coachingWhere: buildCoachingVisibilityFilter(actor),
      })
    : undefined;

  return teams.flatMap((team) => {
    const linkedLeaderIds = new Set([
      team.primaryLeader.active ? team.primaryLeader.id : "",
      ...team.leaders.map(({ user }) => user.id),
    ]);
    const users = new Map([
      ...team.members.map((member) => [member.id, member] as const),
      ...(team.primaryLeader.active
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
}
