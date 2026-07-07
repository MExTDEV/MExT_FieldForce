import { prisma } from "@/lib/server/db";
import { roleLabels } from "@/lib/permissions";
import {
  applicationRoles,
  listRoleConfigurations,
} from "@/lib/server/role-configuration";
import {
  fieldForcePermissionKeys,
  roleTemplates,
} from "@/lib/user-management";
import { isKpiUnit, validateKpiRange } from "@/lib/kpi-settings";
import type {
  Country,
  FieldForcePermissionKey,
  ManagementConfiguration,
  MockUser,
  Role,
  KpiEvaluationDirection,
  KpiUnit,
} from "@/lib/types";

const roles = applicationRoles;

export async function listManagementTeams(
  actor: MockUser,
  options: { activeOnly?: boolean; country?: Country } = {}
) {
  const requestedCountry =
    actor.role === "SUPER_ADMIN" ? options.country : actor.country;
  const teams = await prisma.team.findMany({
    where: {
      ...(requestedCountry ? { country: requestedCountry } : {}),
      ...(options.activeOnly ? { active: true } : {}),
    },
    include: {
      primaryLeader: { select: { firstName: true, lastName: true } },
      _count: { select: { members: true } },
    },
    orderBy: [{ name: "asc" }],
  });
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    country: team.country as Country,
    primaryLeaderId: team.primaryLeaderId,
    primaryLeaderName:
      `${team.primaryLeader.firstName} ${team.primaryLeader.lastName}`.trim(),
    active: team.active,
    memberCount: team._count.members,
  }));
}

export async function getManagementConfiguration(
  actor: MockUser
): Promise<ManagementConfiguration> {
  const [teams, kpis, focuses, permissions, roleGrants, roleCounts, roleConfigurations] = await Promise.all([
    listManagementTeams(actor),
    prisma.kpiDefinition.findMany({
      where: actor.role === "SUPER_ADMIN"
        ? {}
        : { OR: [{ country: actor.country }, { country: null }] },
      orderBy: [{ country: "asc" }, { name: "asc" }],
    }),
    prisma.coachingFocus.findMany({
      include: { criteria: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.permission.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] }),
    prisma.rolePermission.findMany(),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    listRoleConfigurations(),
  ]);

  const grantMap = new Map(
    roleGrants.map((grant) => [`${grant.role}:${grant.permissionId}`, grant.enabled])
  );
  const countMap = new Map(roleCounts.map((item) => [item.role, item._count.id]));
  const activeMap = new Map(
    roleConfigurations.map((configuration) => [
      configuration.role,
      configuration.active,
    ])
  );

  return {
    teams,
    kpis: kpis.map((kpi) => ({
      id: kpi.id,
      code: kpi.code,
      name: kpi.name,
      description: kpi.description,
      country: kpi.country as Country | null,
      unit: isKpiUnit(kpi.unit) ? kpi.unit : "number",
      targetValue: Number(kpi.targetValue),
      minValue: kpi.minValue === null ? null : Number(kpi.minValue),
      maxValue: kpi.maxValue === null ? null : Number(kpi.maxValue),
      evaluationDirection: kpi.evaluationDirection,
      active: kpi.active,
    })),
    focuses: focuses.map((focus) => ({
      id: focus.id,
      code: focus.code,
      name: focus.name,
      active: focus.active,
      sortOrder: focus.sortOrder,
      criteria: focus.criteria.map((criterion) => ({
        id: criterion.id,
        name: criterion.name,
        active: criterion.active,
        sortOrder: criterion.sortOrder,
      })),
    })),
    roles: roles.map((role) => ({
      role,
      label: roleLabels[role],
      userCount: countMap.get(role) ?? 0,
      active: activeMap.get(role) ?? true,
      permissions: Object.fromEntries(
        fieldForcePermissionKeys.map((key) => {
          const permission = permissions.find((item) => item.key === key);
          const stored = permission ? grantMap.get(`${role}:${permission.id}`) : undefined;
          return [key, stored ?? roleTemplates[role].permissions[key]];
        })
      ) as Record<FieldForcePermissionKey, boolean>,
    })),
  };
}

export function assertCountryScope(actor: MockUser, country: Country | null) {
  if (actor.role !== "SUPER_ADMIN" && country !== actor.country) {
    throw new Error("Deze configuratie valt buiten je landenscope.");
  }
}

export async function saveTeam(
  actor: MockUser,
  input: { id?: string; name: string; country: Country; primaryLeaderId: string }
) {
  assertCountryScope(actor, input.country);
  const leader = await prisma.user.findFirst({
    where: { id: input.primaryLeaderId, active: true, country: input.country },
    select: { id: true },
  });
  if (!leader) throw new Error("De gekozen teamleider is niet actief in dit land.");
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const existing = await tx.team.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          country: true,
          members: { select: { country: true } },
        },
      });
      if (
        existing.country !== input.country &&
        existing.members.some((member) => member.country !== input.country)
      ) {
        throw new Error(
          "Verplaats eerst de bestaande teamleden voordat je het land van dit team wijzigt."
        );
      }
    }
    const team = input.id
      ? await tx.team.update({
          where: { id: input.id },
          data: {
            name: input.name.trim(),
            country: input.country,
            primaryLeaderId: leader.id,
            active: true,
          },
        })
      : await tx.team.create({
          data: {
            name: input.name.trim(),
            country: input.country,
            primaryLeaderId: leader.id,
            active: true,
          },
        });
    await tx.teamLeader.deleteMany({ where: { teamId: team.id, type: "PRIMARY" } });
    await tx.teamLeader.upsert({
      where: { teamId_userId: { teamId: team.id, userId: leader.id } },
      update: { type: "PRIMARY" },
      create: { teamId: team.id, userId: leader.id, type: "PRIMARY" },
    });
    return team;
  });
}

export async function deactivateTeam(actor: MockUser, id: string) {
  const team = await prisma.team.findUniqueOrThrow({ where: { id } });
  assertCountryScope(actor, team.country as Country);
  return prisma.team.update({ where: { id }, data: { active: false } });
}

export async function saveKpi(
  actor: MockUser,
  input: {
    id?: string;
    code: string;
    name: string;
    description: string;
    country: Country | null;
    unit: KpiUnit;
    targetValue: number;
    minValue: number | null;
    maxValue: number | null;
    evaluationDirection: KpiEvaluationDirection;
  }
) {
  if (!input.code.trim()) throw new Error("Code is verplicht.");
  if (!input.name.trim()) throw new Error("Naam is verplicht.");
  if (!Number.isFinite(input.targetValue)) throw new Error("Doelwaarde moet numeriek zijn.");
  if (!isKpiUnit(input.unit)) throw new Error("Selecteer een geldige eenheid.");
  if (!["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET"].includes(input.evaluationDirection)) {
    throw new Error("Selecteer een geldige beoordelingsrichting.");
  }
  validateKpiRange(input.targetValue, input.minValue, input.maxValue);
  const country = actor.role === "SUPER_ADMIN" ? input.country : actor.country;
  assertCountryScope(actor, country);
  const data = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description.trim(),
    country,
    unit: input.unit.trim(),
    targetValue: input.targetValue,
    minValue: input.minValue,
    maxValue: input.maxValue,
    evaluationDirection: input.evaluationDirection,
    active: true,
  };
  return input.id
    ? prisma.kpiDefinition.update({ where: { id: input.id }, data })
    : prisma.kpiDefinition.create({ data });
}

export async function deactivateKpi(actor: MockUser, id: string) {
  const kpi = await prisma.kpiDefinition.findUniqueOrThrow({ where: { id } });
  if (actor.role !== "SUPER_ADMIN" && kpi.country !== actor.country) {
    throw new Error("Een Admin kan alleen KPI's van het eigen land verwijderen.");
  }
  return prisma.kpiDefinition.update({ where: { id }, data: { active: false } });
}

export async function saveFocus(
  actor: MockUser,
  input: { id?: string; code: string; name: string; sortOrder: number }
) {
  if (actor.role !== "SUPER_ADMIN") {
    throw new Error("De globale kapstok kan alleen door een Super Admin worden gewijzigd.");
  }
  const data = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    sortOrder: input.sortOrder,
    active: true,
  };
  return input.id
    ? prisma.coachingFocus.update({ where: { id: input.id }, data })
    : prisma.coachingFocus.create({ data });
}

export async function deactivateFocus(actor: MockUser, id: string) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Super Admin vereist.");
  return prisma.coachingFocus.update({ where: { id }, data: { active: false } });
}

export async function saveCriterion(
  actor: MockUser,
  input: { id?: string; focusId: string; name: string; sortOrder: number }
) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Super Admin vereist.");
  const data = {
    focusId: input.focusId,
    name: input.name.trim(),
    sortOrder: input.sortOrder,
    active: true,
  };
  return input.id
    ? prisma.coachingCriterion.update({ where: { id: input.id }, data })
    : prisma.coachingCriterion.create({ data });
}

export async function deactivateCriterion(actor: MockUser, id: string) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Super Admin vereist.");
  return prisma.coachingCriterion.update({ where: { id }, data: { active: false } });
}

export async function saveRolePermissions(
  actor: MockUser,
  role: Role,
  permissions: Partial<Record<FieldForcePermissionKey, boolean>>,
  active?: boolean
) {
  if (actor.role !== "SUPER_ADMIN") {
    throw new Error("Rollen en globale rechten kunnen alleen door een Super Admin worden gewijzigd.");
  }
  if (!roles.includes(role)) {
    throw new Error("Onbekende rol.");
  }
  const records = await prisma.permission.findMany({
    where: { key: { in: fieldForcePermissionKeys } },
  });
  await prisma.$transaction(
    [
      ...records.map((permission) =>
      prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: permission.id } },
        update: { enabled: Boolean(permissions[permission.key as FieldForcePermissionKey]) },
        create: {
          role,
          permissionId: permission.id,
          enabled: Boolean(permissions[permission.key as FieldForcePermissionKey]),
        },
      })
      ),
      ...(typeof active === "boolean"
        ? [
            prisma.roleConfiguration.upsert({
              where: { role },
              update: { active },
              create: { role, active },
            }),
          ]
        : []),
    ]
  );
}
