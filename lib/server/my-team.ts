import { Prisma } from "@prisma/client";
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
import type { Country, MockUser, Role } from "@/lib/types";

type MyTeamTeamRow = {
  id: string;
  name: string;
  country: string;
  primaryLeaderId: string | null;
};

type MyTeamUserRow = {
  id: string;
  representativeId: string | null;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean | number;
  teamId: string | null;
};

type MyTeamLeaderRow = MyTeamUserRow & {
  linkedTeamId: string;
};

type MyTeamTeamSnapshot = {
  id: string;
  name: string;
  country: Country;
  primaryLeader?: MyTeamUser;
  leaders: { user: MyTeamUser }[];
  members: MyTeamUser[];
};

type MyTeamUser = {
  id: string;
  representativeId: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  active: boolean;
  teamId: string | null;
};

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
    listMyTeamTeamSnapshots(actor),
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
          includeContactMoments: false,
          includeActionPoints: false,
          includeKpiSnapshots: false,
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

async function listMyTeamTeamSnapshots(actor: MockUser): Promise<MyTeamTeamSnapshot[]> {
  const scopeSql = myTeamScopeSql(actor);
  const teamRows = await prisma.$queryRaw<MyTeamTeamRow[]>(Prisma.sql`
    SELECT t.id, t.name, t.country, t.primaryLeaderId
    FROM \`Team\` t
    WHERE t.active = TRUE
      ${scopeSql}
    ORDER BY t.country ASC, t.name ASC
  `);
  const teamIds = teamRows.map((team) => team.id);
  if (!teamIds.length) return [];

  const primaryLeaderIds = [
    ...new Set(teamRows.map((team) => team.primaryLeaderId).filter(Boolean) as string[]),
  ];
  const [memberRows, leaderRows, primaryLeaderRows] = await Promise.all([
    prisma.$queryRaw<MyTeamUserRow[]>(Prisma.sql`
      SELECT u.id, u.representativeId, u.firstName, u.lastName, u.role, u.active, u.teamId
      FROM \`User\` u
      WHERE u.active = TRUE
        AND u.teamId IN (${Prisma.join(teamIds)})
      ORDER BY u.lastName ASC, u.firstName ASC
    `),
    prisma.$queryRaw<MyTeamLeaderRow[]>(Prisma.sql`
      SELECT
        tl.teamId AS linkedTeamId,
        u.id,
        u.representativeId,
        u.firstName,
        u.lastName,
        u.role,
        u.active,
        u.teamId
      FROM \`TeamLeader\` tl
      INNER JOIN \`User\` u ON u.id = tl.userId
      WHERE u.active = TRUE
        AND tl.teamId IN (${Prisma.join(teamIds)})
      ORDER BY u.lastName ASC, u.firstName ASC
    `),
    primaryLeaderIds.length
      ? prisma.$queryRaw<MyTeamUserRow[]>(Prisma.sql`
          SELECT u.id, u.representativeId, u.firstName, u.lastName, u.role, u.active, u.teamId
          FROM \`User\` u
          WHERE u.active = TRUE
            AND u.id IN (${Prisma.join(primaryLeaderIds)})
        `)
      : Promise.resolve([]),
  ]);

  const membersByTeam = groupBy(memberRows.map(toMyTeamUser), (user) => user.teamId ?? "");
  const leadersByTeam = groupBy(
    leaderRows.map((row) => ({ teamId: row.linkedTeamId, user: toMyTeamUser(row) })),
    (entry) => entry.teamId
  );
  const primaryLeaders = new Map(primaryLeaderRows.map((row) => [row.id, toMyTeamUser(row)]));

  return teamRows.map((team) => ({
    id: team.id,
    name: team.name,
    country: team.country as Country,
    primaryLeader: team.primaryLeaderId
      ? primaryLeaders.get(team.primaryLeaderId)
      : undefined,
    leaders: (leadersByTeam.get(team.id) ?? []).map((entry) => ({ user: entry.user })),
    members: membersByTeam.get(team.id) ?? [],
  }));
}

function myTeamScopeSql(actor: MockUser) {
  if (actor.role === "SALES_LEADER") {
    return actor.teamId
      ? Prisma.sql`AND t.id = ${actor.teamId}`
      : Prisma.sql`AND 1 = 0`;
  }
  if (actor.role === "COUNTRY_MANAGER" || actor.role === "ADMIN") {
    return Prisma.sql`AND t.country = ${actor.country}`;
  }
  if (actor.role === "SALES_MANAGER") {
    const countries = actor.countryAccess ?? [];
    return countries.length
      ? Prisma.sql`AND t.country IN (${Prisma.join(countries)})`
      : Prisma.sql`AND 1 = 0`;
  }
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) {
    return Prisma.empty;
  }
  return Prisma.sql`AND 1 = 0`;
}

function toMyTeamUser(row: MyTeamUserRow): MyTeamUser {
  return {
    id: row.id,
    representativeId: row.representativeId,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role as Role,
    active: Boolean(row.active),
    teamId: row.teamId,
  };
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
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
