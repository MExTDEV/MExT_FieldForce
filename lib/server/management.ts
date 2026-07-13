import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import { can, roleLabels } from "@/lib/permissions";
import {
  missingPermissionKeys,
  resolveRolePermissions,
} from "@/lib/role-permissions";
import {
  applicationRoles,
  listRoleConfigurations,
} from "@/lib/server/role-configuration";
import {
  fieldForcePermissionGroups,
  fieldForcePermissionKeys,
} from "@/lib/user-management";
import {
  normalizeOptionalTeamLeaderId,
  optionalTeamLeaderLabel,
} from "@/lib/team-management";
import {
  createKpiTargetScopeKey,
  detectKpiTargetConflicts,
} from "@/lib/server/kpi-targets";
import { criterionScopeKey } from "@/lib/server/criterion-scopes";
import {
  columnsExist,
  tableExists,
} from "@/lib/server/schema-inspection";
import {
  kpiCategorySeed,
  kpiTargetTypeSeed,
  kpiTypeSeed,
  isKpiPeriodType,
  isKpiTargetScope,
  isKpiUnit,
  validateKpiDates,
  validateKpiRange,
} from "@/lib/kpi-settings";
import type {
  Country,
  FieldForcePermissionKey,
  CriterionScopeType,
  KpiPeriodType,
  KpiTargetScope,
  KpiValueType,
  ManagementConfiguration,
  MockUser,
  Role,
  KpiEvaluationDirection,
  KpiUnit,
} from "@/lib/types";

const roles = applicationRoles;
export type ManagementSection = "teams" | "rollen" | "kpis" | "kapstok";

type ManagementTeamRow = {
  id: string;
  name: string;
  country: string;
  primaryLeaderId: string | null;
  primaryLeaderFirstName: string | null;
  primaryLeaderLastName: string | null;
  active: boolean | number;
  memberCount: bigint | number;
};

type RawKpiRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  typeId: string | null;
  targetTypeId: string | null;
  country: string | null;
  teamId: string | null;
  userId: string | null;
  targetRole: string | null;
  unit: string;
  targetValue: unknown;
  minValue: unknown | null;
  maxValue: unknown | null;
  weight: unknown | null;
  countsForReporting: boolean | number;
  countsForPerformanceCircle: boolean | number;
  sortOrder: number | bigint;
  validFrom: Date;
  validUntil: Date | null;
  evaluationDirection: string;
  active: boolean | number;
};

type RawKpiTargetRow = {
  id: string;
  kpiDefinitionId: string;
  targetTypeId: string;
  scope: string;
  scopeKey: string;
  country: string | null;
  teamId: string | null;
  userId: string | null;
  role: string | null;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  targetValue: unknown;
  active: boolean | number;
};

type RawKpiCategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean | number;
  sortOrder: number | bigint;
};

type RawKpiTypeRow = RawKpiCategoryRow & {
  valueType: string;
};

type RawKpiTargetTypeRow = RawKpiCategoryRow;

export async function listManagementTeams(
  actor: MockUser,
  options: { activeOnly?: boolean; country?: Country } = {}
) {
  const requestedCountry =
    actor.role === "SUPER_ADMIN" ? options.country : actor.country;

  const countryFilter = requestedCountry
    ? Prisma.sql`AND t.country = ${requestedCountry}`
    : Prisma.empty;
  const activeFilter = options.activeOnly
    ? Prisma.sql`AND t.active = TRUE`
    : Prisma.empty;

  const teams = await prisma.$queryRaw<ManagementTeamRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.name,
      t.country,
      t.primaryLeaderId,
      leader.firstName AS primaryLeaderFirstName,
      leader.lastName AS primaryLeaderLastName,
      t.active,
      COUNT(member.id) AS memberCount
    FROM \`Team\` t
    LEFT JOIN \`User\` leader ON leader.id = t.primaryLeaderId
    LEFT JOIN \`User\` member ON member.teamId = t.id
    WHERE 1 = 1
      ${countryFilter}
      ${activeFilter}
    GROUP BY
      t.id,
      t.name,
      t.country,
      t.primaryLeaderId,
      leader.firstName,
      leader.lastName,
      t.active
    ORDER BY t.name ASC
  `);

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    country: team.country as Country,
    primaryLeaderId: team.primaryLeaderId,
    primaryLeaderName: optionalTeamLeaderLabel(
      team.primaryLeaderFirstName || team.primaryLeaderLastName
        ? `${team.primaryLeaderFirstName ?? ""} ${team.primaryLeaderLastName ?? ""}`.trim()
        : null
    ),
    active: Boolean(team.active),
    memberCount: Number(team.memberCount),
  }));
}

export async function getManagementConfiguration(
  actor: MockUser,
  section?: ManagementSection
): Promise<ManagementConfiguration> {
  const needsTeams = !section || section === "teams" || section === "kpis" || section === "kapstok";
  const needsKpis = !section || section === "kpis";
  const needsFocuses = !section || section === "kapstok";
  const needsRoles = !section || section === "rollen";

  const [teams, kpiConfiguration, focuses, managementRoles] = await Promise.all([
    needsTeams ? listManagementTeams(actor) : Promise.resolve([]),
    needsKpis
      ? listManagementKpis(actor)
      : Promise.resolve(emptyKpiConfiguration()),
    needsFocuses ? listManagementFocuses() : Promise.resolve([]),
    needsRoles ? listManagementRoles() : Promise.resolve([]),
  ]);

  return {
    teams,
    ...kpiConfiguration,
    focuses,
    roles: managementRoles,
  };
}

function emptyKpiConfiguration() {
  return {
    kpis: [],
    kpiCategories: [],
    kpiTypes: [],
    kpiTargetTypes: [],
  };
}

async function listManagementFocuses() {
  const focuses = await prisma.coachingFocus.findMany({
    include: {
      criteria: {
        include: {
          criterionScopeLinks: {
            include: {
              team: { select: { id: true, name: true } },
              user: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: [{ scopeType: "asc" }, { sortOrder: "asc" }, { scopeKey: "asc" }],
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return focuses.map((focus) => ({
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
      scopeLinks: criterion.criterionScopeLinks.map((scopeLink) => ({
        id: scopeLink.id,
        scopeType: scopeLink.scopeType as CriterionScopeType,
        scopeKey: scopeLink.scopeKey,
        country: scopeLink.country as Country | null,
        teamId: scopeLink.teamId,
        teamName: scopeLink.team?.name ?? null,
        userId: scopeLink.userId,
        userName: scopeLink.user
          ? `${scopeLink.user.firstName} ${scopeLink.user.lastName}`.trim()
          : null,
        sortOrder: Number(scopeLink.sortOrder),
      })),
    })),
  }));
}

async function listManagementRoles() {
  await ensureFieldForcePermissionRecords();
  const [roleGrants, roleCounts, roleConfigurations] = await Promise.all([
    prisma.rolePermission.findMany({ include: { permission: { select: { key: true } } } }),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    listRoleConfigurations(),
  ]);

  const countMap = new Map(roleCounts.map((item) => [item.role, item._count.id]));
  const activeMap = new Map(
    roleConfigurations.map((configuration) => [
      configuration.role,
      configuration.active,
    ])
  );

  return roles.map((role) => ({
    role,
    label: roleLabels[role],
    userCount: countMap.get(role) ?? 0,
    active: activeMap.get(role) ?? true,
    permissions: resolveRolePermissions(role, roleGrants),
  }));
}

async function ensureFieldForcePermissionRecords() {
  const permissionDefinitions = fieldForcePermissionGroups.flatMap((group) =>
    group.permissions.map((permission) => ({
      key: permission.key,
      label: permission.label,
      group: group.title,
      description: group.description,
    }))
  );
  const existingPermissions = await prisma.permission.findMany({
    where: { key: { in: fieldForcePermissionKeys } },
    select: { key: true },
  });
  const existingPermissionKeys = new Set(
    existingPermissions.map((permission) => permission.key)
  );
  const missingPermissions = permissionDefinitions.filter(
    (permission) => !existingPermissionKeys.has(permission.key)
  );

  if (missingPermissions.length) {
    await prisma.permission.createMany({
      data: missingPermissions,
      skipDuplicates: true,
    });
  }
}

export async function listManagementKpis(actor: MockUser) {
  const [kpis, categories, types, targetTypes] = await Promise.all([
    listManagementKpiRows(actor),
    listKpiCategories(),
    listKpiTypes(),
    listKpiTargetTypes(),
  ]);
  const targets = await listKpiTargets(kpis.map((kpi) => kpi.id));
  const targetsByKpi = groupBy(targets, (target) => target.kpiDefinitionId);
  const conflicts = detectKpiTargetConflicts(
    targets.map((target) => ({
      id: target.id,
      kpiDefinitionId: target.kpiDefinitionId,
      scopeKey: target.scopeKey,
      periodStart: target.periodStart,
      periodEnd: target.periodEnd,
      active: Boolean(target.active),
    }))
  );

  return {
    kpis: kpis.map((kpi) => ({
      id: kpi.id,
      code: kpi.code,
      name: kpi.name,
      description: kpi.description ?? "",
      categoryId: kpi.categoryId ?? fallbackKpiCategoryId(kpi.code),
      typeId: kpi.typeId ?? fallbackKpiTypeId(kpi.unit),
      targetTypeId: kpi.targetTypeId ?? fallbackKpiTargetTypeId(kpi.country as Country | null),
      country: kpi.country as Country | null,
      teamId: kpi.teamId,
      userId: kpi.userId,
      targetRole: kpi.targetRole as Role | null,
      unit: isKpiUnit(kpi.unit) ? kpi.unit : "number",
      targetValue: Number(kpi.targetValue),
      minValue: kpi.minValue === null ? null : Number(kpi.minValue),
      maxValue: kpi.maxValue === null ? null : Number(kpi.maxValue),
      weight: kpi.weight === null ? null : Number(kpi.weight),
      countsForReporting: Boolean(kpi.countsForReporting),
      countsForPerformanceCircle: Boolean(kpi.countsForPerformanceCircle),
      sortOrder: Number(kpi.sortOrder),
      validFrom: dateOnly(kpi.validFrom),
      validUntil: kpi.validUntil ? dateOnly(kpi.validUntil) : null,
      evaluationDirection: normalizeKpiEvaluationDirection(kpi.evaluationDirection),
      active: Boolean(kpi.active),
      targets: (targetsByKpi.get(kpi.id) ?? []).map((target) => ({
        id: target.id,
        kpiDefinitionId: target.kpiDefinitionId,
        targetTypeId: target.targetTypeId,
        scope: target.scope as KpiTargetScope,
        scopeKey: target.scopeKey,
        country: target.country as Country | null,
        teamId: target.teamId,
        userId: target.userId,
        role: target.role as Role | null,
        periodType: target.periodType as KpiPeriodType,
        periodStart: dateOnly(target.periodStart),
        periodEnd: dateOnly(target.periodEnd),
        targetValue: Number(target.targetValue),
        active: Boolean(target.active),
        conflict: conflicts.has(target.id),
      })),
    })),
    kpiCategories: categories.map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description ?? "",
      isActive: Boolean(category.isActive),
      sortOrder: Number(category.sortOrder),
    })),
    kpiTypes: types.map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
      description: type.description ?? "",
      valueType: type.valueType as KpiValueType,
      isActive: Boolean(type.isActive),
      sortOrder: Number(type.sortOrder),
    })),
    kpiTargetTypes: targetTypes.map((targetType) => ({
      id: targetType.id,
      code: targetType.code as KpiTargetScope,
      name: targetType.name,
      description: targetType.description ?? "",
      isActive: Boolean(targetType.isActive),
      sortOrder: Number(targetType.sortOrder),
    })),
  };
}

async function listManagementKpiRows(actor: MockUser) {
  const hasManagementColumns = await columnsExist("KpiDefinition", [
    "category_id",
    "type_id",
    "target_type_id",
    "target_team_id",
    "target_user_id",
    "target_role",
    "weight",
    "counts_for_reporting",
    "counts_for_performance_circle",
    "sort_order",
    "valid_from",
    "valid_until",
  ]);
  if (!hasManagementColumns) return listLegacyManagementKpiRows(actor);

  try {
    return await prisma.$queryRaw<RawKpiRow[]>(Prisma.sql`
      SELECT
        id,
        code,
        name,
        description,
        category_id AS categoryId,
        type_id AS typeId,
        target_type_id AS targetTypeId,
        country,
        target_team_id AS teamId,
        target_user_id AS userId,
        target_role AS targetRole,
        unit,
        \`targetValue\`,
        \`minValue\`,
        \`maxValue\`,
        weight,
        counts_for_reporting AS countsForReporting,
        counts_for_performance_circle AS countsForPerformanceCircle,
        sort_order AS sortOrder,
        valid_from AS validFrom,
        valid_until AS validUntil,
        \`evaluationDirection\`,
        active
      FROM \`KpiDefinition\`
      ${visibleKpiSql(actor)}
      ORDER BY sort_order ASC, country ASC, name ASC
    `);
  } catch (error) {
    if (!isMissingKpiManagementSchema(error)) throw error;
    return listLegacyManagementKpiRows(actor);
  }
}

async function listLegacyManagementKpiRows(actor: MockUser) {
  const hasLegacyColumns = await columnsExist("KpiDefinition", [
    "targetValue",
    "minValue",
    "maxValue",
    "evaluationDirection",
  ]);
  if (!hasLegacyColumns) return listBaseManagementKpiRows(actor);

  try {
    return await prisma.$queryRaw<RawKpiRow[]>(Prisma.sql`
      SELECT
        id,
        code,
        name,
        description,
        NULL AS categoryId,
        NULL AS typeId,
        NULL AS targetTypeId,
        country,
        NULL AS teamId,
        NULL AS userId,
        NULL AS targetRole,
        unit,
        \`targetValue\`,
        \`minValue\`,
        \`maxValue\`,
        NULL AS weight,
        TRUE AS countsForReporting,
        TRUE AS countsForPerformanceCircle,
        0 AS sortOrder,
        \`createdAt\` AS validFrom,
        NULL AS validUntil,
        \`evaluationDirection\`,
        active
      FROM \`KpiDefinition\`
      ${legacyVisibleKpiSql(actor)}
      ORDER BY country ASC, name ASC
    `);
  } catch (error) {
    if (!isMissingKpiManagementSchema(error)) throw error;
    return listBaseManagementKpiRows(actor);
  }
}

function listBaseManagementKpiRows(actor: MockUser) {
  return prisma.$queryRaw<RawKpiRow[]>(Prisma.sql`
    SELECT
      id,
      code,
      name,
      description,
      NULL AS categoryId,
      NULL AS typeId,
      NULL AS targetTypeId,
      country,
      NULL AS teamId,
      NULL AS userId,
      NULL AS targetRole,
      unit,
      0 AS targetValue,
      NULL AS minValue,
      NULL AS maxValue,
      NULL AS weight,
      TRUE AS countsForReporting,
      TRUE AS countsForPerformanceCircle,
      0 AS sortOrder,
      \`createdAt\` AS validFrom,
      NULL AS validUntil,
      'HIGHER_IS_BETTER' AS evaluationDirection,
      active
    FROM \`KpiDefinition\`
    ${legacyVisibleKpiSql(actor)}
    ORDER BY country ASC, name ASC
  `);
}

async function listKpiTargets(kpiIds: string[]) {
  if (!kpiIds.length) return [];
  if (!(await tableExists("kpi_targets"))) return [];
  try {
    return await prisma.$queryRaw<RawKpiTargetRow[]>(Prisma.sql`
      SELECT
        id,
        kpi_definition_id AS kpiDefinitionId,
        target_type_id AS targetTypeId,
        scope,
        scope_key AS scopeKey,
        country,
        team_id AS teamId,
        user_id AS userId,
        role,
        period_type AS periodType,
        period_start AS periodStart,
        period_end AS periodEnd,
        target_value AS targetValue,
        active
      FROM \`kpi_targets\`
      WHERE kpi_definition_id IN (${Prisma.join(kpiIds)})
      ORDER BY period_start DESC, scope_key ASC
    `);
  } catch (error) {
    if (!isMissingKpiManagementSchema(error)) throw error;
    return [];
  }
}

async function listKpiCategories(): Promise<RawKpiCategoryRow[]> {
  if (!(await tableExists("kpi_categories"))) return kpiCategorySeedRows();
  try {
    return await prisma.$queryRaw<RawKpiCategoryRow[]>(Prisma.sql`
      SELECT id, code, name, description, is_active AS isActive, sort_order AS sortOrder
      FROM \`kpi_categories\`
      ORDER BY sort_order ASC, name ASC
    `);
  } catch (error) {
    if (!isMissingKpiManagementSchema(error)) throw error;
    return kpiCategorySeedRows();
  }
}

async function listKpiTypes(): Promise<RawKpiTypeRow[]> {
  if (!(await tableExists("kpi_types"))) return kpiTypeSeedRows();
  try {
    return await prisma.$queryRaw<RawKpiTypeRow[]>(Prisma.sql`
      SELECT id, code, name, description, value_type AS valueType, is_active AS isActive, sort_order AS sortOrder
      FROM \`kpi_types\`
      ORDER BY sort_order ASC, name ASC
    `);
  } catch (error) {
    if (!isMissingKpiManagementSchema(error)) throw error;
    return kpiTypeSeedRows();
  }
}

async function listKpiTargetTypes(): Promise<RawKpiTargetTypeRow[]> {
  if (!(await tableExists("kpi_target_types"))) return kpiTargetTypeSeedRows();
  try {
    return await prisma.$queryRaw<RawKpiTargetTypeRow[]>(Prisma.sql`
      SELECT id, code, name, description, is_active AS isActive, sort_order AS sortOrder
      FROM \`kpi_target_types\`
      ORDER BY sort_order ASC, name ASC
    `);
  } catch (error) {
    if (!isMissingKpiManagementSchema(error)) throw error;
    return kpiTargetTypeSeedRows();
  }
}

function kpiCategorySeedRows(): RawKpiCategoryRow[] {
  return kpiCategorySeed.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    isActive: true,
    sortOrder: category.sortOrder,
  }));
}

function kpiTypeSeedRows(): RawKpiTypeRow[] {
  return kpiTypeSeed.map((type) => ({
    id: type.id,
    code: type.code,
    name: type.name,
    description: type.description,
    valueType: type.valueType,
    isActive: true,
    sortOrder: type.sortOrder,
  }));
}

function kpiTargetTypeSeedRows(): RawKpiTargetTypeRow[] {
  return kpiTargetTypeSeed.map((targetType) => ({
    id: targetType.id,
    code: targetType.code,
    name: targetType.name,
    description: targetType.description,
    isActive: true,
    sortOrder: targetType.sortOrder,
  }));
}

function visibleKpiSql(actor: MockUser) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return Prisma.empty;
  const countries = kpiCountriesForActor(actor);
  const clauses = [
    Prisma.sql`(country IS NULL AND target_team_id IS NULL AND target_user_id IS NULL AND target_role IS NULL)`,
    Prisma.sql`target_role = ${actor.role}`,
  ];
  if (countries.length) clauses.push(Prisma.sql`country IN (${Prisma.join(countries)})`);
  if (actor.teamId) clauses.push(Prisma.sql`target_team_id = ${actor.teamId}`);
  clauses.push(Prisma.sql`target_user_id = ${actor.id}`);
  return Prisma.sql`WHERE (${Prisma.join(clauses, " OR ")})`;
}

function legacyVisibleKpiSql(actor: MockUser) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return Prisma.empty;
  const countries = kpiCountriesForActor(actor);
  if (!countries.length) return Prisma.sql`WHERE country IS NULL`;
  return Prisma.sql`WHERE (country IS NULL OR country IN (${Prisma.join(countries)}))`;
}

function isMissingKpiManagementSchema(error: unknown) {
  const maybeError = error as { code?: string; meta?: unknown; message?: string };
  if (maybeError.code === "P2021" || maybeError.code === "P2022") return true;
  const details = `${maybeError.code ?? ""} ${JSON.stringify(maybeError.meta ?? {})} ${
    maybeError.message ?? ""
  }`;
  return [
    "doesn't exist",
    "Unknown column",
    "ER_NO_SUCH_TABLE",
    "ER_BAD_FIELD_ERROR",
    "P2010",
    "kpi_categories",
    "kpi_types",
    "kpi_target_types",
    "kpi_targets",
    "category_id",
    "type_id",
    "target_type_id",
    "target_team_id",
    "target_user_id",
    "target_role",
    "counts_for_reporting",
    "counts_for_performance_circle",
    "sort_order",
    "valid_from",
    "targetValue",
    "evaluationDirection",
  ].some((needle) => details.includes(needle));
}

function fallbackKpiCategoryId(code: string) {
  const normalized = code.toUpperCase();
  if (["SALES_DAY", "SALES_ORDER", "TOTAL_SALES"].includes(normalized)) {
    return "kpicat_turnover";
  }
  if (["LEADS", "PROSPECT_CUSTOMER"].includes(normalized)) return "kpicat_sales";
  if (normalized === "FM_ORDER") return "kpicat_orders";
  if (normalized === "CASH_TRANSFER") return "kpicat_service";
  return "kpicat_coaching";
}

function fallbackKpiTypeId(unit: string) {
  if (unit === "%") return "kpitype_percentage";
  if (unit === "EUR") return "kpitype_currency";
  return "kpitype_number";
}

function fallbackKpiTargetTypeId(country: Country | null) {
  return country ? "kpitarget_country" : "kpitarget_global";
}

function normalizeKpiEvaluationDirection(value: string): KpiEvaluationDirection {
  if (["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET"].includes(value)) {
    return value as KpiEvaluationDirection;
  }
  return "HIGHER_IS_BETTER";
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function kpiCountriesForActor(actor: MockUser): Country[] {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return ["BE", "NL", "DE"];
  if (actor.role === "SALES_MANAGER") return actor.countryAccess?.length ? actor.countryAccess : [actor.country];
  return [actor.country];
}

function actorCanAccessKpiCountry(actor: MockUser, country: Country | null | undefined) {
  if (!country) return ["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role);
  return kpiCountriesForActor(actor).includes(country);
}

function assertKpiDefinitionAccess(actor: MockUser, kpi: {
  country: Country | null;
  teamId?: string | null;
  userId?: string | null;
  targetRole?: Role | null;
}) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return;
  if (kpi.country && actorCanAccessKpiCountry(actor, kpi.country)) return;
  if (kpi.teamId && actor.teamId === kpi.teamId) return;
  if (kpi.userId && kpi.userId === actor.id) return;
  if (kpi.targetRole && kpi.targetRole === actor.role) return;
  throw new Error("Deze KPI valt buiten je toegestane scope.");
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function assertCountryScope(actor: MockUser, country: Country | null) {
  if (actor.role !== "SUPER_ADMIN" && country !== actor.country) {
    throw new Error("Deze configuratie valt buiten je landenscope.");
  }
}

export async function saveTeam(
  actor: MockUser,
  input: { id?: string; name: string; country: Country; primaryLeaderId?: string | null }
) {
  assertCountryScope(actor, input.country);
  const name = input.name.trim();
  if (!name) throw new Error("Teamnaam is verplicht.");
  const duplicate = await prisma.team.findFirst({
    where: {
      country: input.country,
      name,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("Er bestaat al een team met deze naam in dit land.");
  }
  const primaryLeaderId = normalizeOptionalTeamLeaderId(input.primaryLeaderId);
  const leader = primaryLeaderId
    ? await prisma.user.findFirst({
        where: { id: primaryLeaderId, active: true, country: input.country },
        select: { id: true },
      })
    : null;
  if (primaryLeaderId && !leader) {
    throw new Error("De gekozen teamleider is niet actief in dit land.");
  }
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
            name,
            country: input.country,
            primaryLeaderId,
            active: true,
          },
        })
      : await tx.team.create({
          data: {
            name,
            country: input.country,
            primaryLeaderId,
            active: true,
          },
        });
    await tx.teamLeader.deleteMany({ where: { teamId: team.id, type: "PRIMARY" } });
    if (leader) {
      await tx.teamLeader.upsert({
        where: { teamId_userId: { teamId: team.id, userId: leader.id } },
        update: { type: "PRIMARY" },
        create: { teamId: team.id, userId: leader.id, type: "PRIMARY" },
      });
    }
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
    categoryId: string | null;
    typeId: string | null;
    targetTypeId: string | null;
    country: Country | null;
    teamId: string | null;
    userId: string | null;
    targetRole: Role | null;
    unit: KpiUnit;
    targetValue: number;
    minValue: number | null;
    maxValue: number | null;
    weight: number | null;
    countsForReporting: boolean;
    countsForPerformanceCircle: boolean;
    sortOrder: number;
    validFrom: Date;
    validUntil: Date | null;
    evaluationDirection: KpiEvaluationDirection;
    active: boolean;
  }
) {
  if (input.id) {
    if (!can(actor, "kpisManage")) throw new Error("Je mag KPI's niet beheren.");
  } else if (!can(actor, "kpisCreate")) {
    throw new Error("Je mag geen KPI's aanmaken.");
  }
  if (!input.code.trim()) throw new Error("Code is verplicht.");
  if (!input.name.trim()) throw new Error("Naam is verplicht.");
  if (!Number.isFinite(input.targetValue)) throw new Error("Doelwaarde moet numeriek zijn.");
  if (!isKpiUnit(input.unit)) throw new Error("Selecteer een geldige eenheid.");
  if (!["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET"].includes(input.evaluationDirection)) {
    throw new Error("Selecteer een geldige beoordelingsrichting.");
  }
  validateKpiRange(input.targetValue, input.minValue, input.maxValue);
  validateKpiDates(input.validFrom, input.validUntil);
  if (input.weight !== null && (!Number.isFinite(input.weight) || input.weight < 0)) {
    throw new Error("Gewicht moet een positief numeriek getal zijn.");
  }
  if (input.id) {
    const existing = await prisma.kpiDefinition.findUniqueOrThrow({
      where: { id: input.id },
      select: { country: true, teamId: true, userId: true, targetRole: true },
    });
    assertKpiDefinitionAccess(actor, {
      country: existing.country as Country | null,
      teamId: existing.teamId,
      userId: existing.userId,
      targetRole: existing.targetRole as Role | null,
    });
  }
  const scope = await resolveKpiDefinitionScope(actor, input);
  const data = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description.trim(),
    categoryId: normalizeId(input.categoryId),
    typeId: normalizeId(input.typeId),
    targetTypeId: scope.targetTypeId,
    country: scope.country,
    teamId: scope.teamId,
    userId: scope.userId,
    targetRole: scope.targetRole,
    unit: input.unit.trim(),
    targetValue: input.targetValue,
    minValue: input.minValue,
    maxValue: input.maxValue,
    weight: input.weight,
    countsForReporting: input.countsForReporting,
    countsForPerformanceCircle: input.countsForPerformanceCircle,
    sortOrder: input.sortOrder,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    evaluationDirection: input.evaluationDirection,
    active: input.active,
    updatedById: actor.id,
  };
  return input.id
    ? prisma.kpiDefinition.update({ where: { id: input.id }, data })
    : prisma.kpiDefinition.create({ data: { ...data, createdById: actor.id } });
}

export async function deactivateKpi(actor: MockUser, id: string) {
  if (!can(actor, "kpisManage")) throw new Error("Je mag KPI's niet beheren.");
  const kpi = await prisma.kpiDefinition.findUniqueOrThrow({ where: { id } });
  assertKpiDefinitionAccess(actor, {
    country: kpi.country as Country | null,
    teamId: kpi.teamId,
    userId: kpi.userId,
    targetRole: kpi.targetRole as Role | null,
  });
  return prisma.kpiDefinition.update({ where: { id }, data: { active: false } });
}

async function resolveKpiDefinitionScope(
  actor: MockUser,
  input: {
    targetTypeId: string | null;
    country: Country | null;
    teamId: string | null;
    userId: string | null;
    targetRole: Role | null;
  }
) {
  const targetType = input.targetTypeId
    ? await prisma.kpiTargetType.findUnique({ where: { id: input.targetTypeId } })
    : await prisma.kpiTargetType.findUnique({ where: { code: "GLOBAL" } });
  if (!targetType || !targetType.isActive) throw new Error("Selecteer een geldige KPI-scope.");
  const scope = targetType.code as KpiTargetScope;

  if (scope === "GLOBAL") {
    if (!["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) {
      throw new Error("Globale KPI's kunnen alleen door groepsbeheer worden aangemaakt.");
    }
    return {
      targetTypeId: targetType.id,
      country: null,
      teamId: null,
      userId: null,
      targetRole: null,
    };
  }

  if (scope === "COUNTRY") {
    if (!input.country) throw new Error("Selecteer een land voor deze KPI.");
    if (!actorCanAccessKpiCountry(actor, input.country)) {
      throw new Error("Deze KPI valt buiten je toegestane scope.");
    }
    return {
      targetTypeId: targetType.id,
      country: input.country,
      teamId: null,
      userId: null,
      targetRole: null,
    };
  }

  if (scope === "TEAM") {
    const teamId = normalizeId(input.teamId);
    if (!teamId) throw new Error("Selecteer een team voor deze KPI.");
    const team = await prisma.team.findFirst({
      where: { id: teamId, active: true },
      select: { id: true, country: true },
    });
    if (!team) throw new Error("Het gekozen team bestaat niet meer.");
    const country = team.country as Country;
    if (!actorCanAccessKpiCountry(actor, country)) {
      throw new Error("Deze KPI valt buiten je toegestane scope.");
    }
    return {
      targetTypeId: targetType.id,
      country,
      teamId: team.id,
      userId: null,
      targetRole: null,
    };
  }

  if (scope === "USER") {
    const userId = normalizeId(input.userId);
    if (!userId) throw new Error("Selecteer een gebruiker voor deze KPI.");
    const user = await prisma.user.findFirst({
      where: { id: userId, active: true },
      select: { id: true, country: true, teamId: true },
    });
    if (!user) throw new Error("De gekozen gebruiker bestaat niet meer.");
    const country = user.country as Country;
    if (!actorCanAccessKpiCountry(actor, country)) {
      throw new Error("Deze KPI valt buiten je toegestane scope.");
    }
    return {
      targetTypeId: targetType.id,
      country,
      teamId: user.teamId,
      userId: user.id,
      targetRole: null,
    };
  }

  const role = input.targetRole;
  if (!role) throw new Error("Selecteer een rol voor deze KPI.");
  const country = input.country ?? (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role) ? null : actor.country);
  if (!actorCanAccessKpiCountry(actor, country)) {
    throw new Error("Deze KPI valt buiten je toegestane scope.");
  }
  return {
    targetTypeId: targetType.id,
    country,
    teamId: null,
    userId: null,
    targetRole: role,
  };
}

function normalizeId(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function saveKpiTarget(
  actor: MockUser,
  input: {
    id?: string;
    kpiDefinitionId: string;
    targetTypeId: string | null;
    scope: KpiTargetScope;
    country: Country | null;
    teamId: string | null;
    userId: string | null;
    role: Role | null;
    periodType: KpiPeriodType;
    periodStart: Date;
    periodEnd: Date;
    targetValue: number;
    active: boolean;
  }
) {
  if (!can(actor, "kpiTargetsManage")) throw new Error("Je mag KPI-doelwaarden niet beheren.");
  if (!isKpiTargetScope(input.scope)) throw new Error("Selecteer een geldige KPI-scope.");
  if (!isKpiPeriodType(input.periodType)) throw new Error("Selecteer een geldige KPI-periode.");
  if (!Number.isFinite(input.targetValue)) throw new Error("Doelwaarde moet numeriek zijn.");
  validateKpiDates(input.periodStart, input.periodEnd);

  const definition = await prisma.kpiDefinition.findUniqueOrThrow({
    where: { id: input.kpiDefinitionId },
    select: { id: true, country: true, teamId: true, userId: true, targetRole: true },
  });
  assertKpiDefinitionAccess(actor, {
    country: definition.country as Country | null,
    teamId: definition.teamId,
    userId: definition.userId,
    targetRole: definition.targetRole as Role | null,
  });

  const scope = await resolveKpiTargetScope(actor, input);
  if (definition.country && scope.country && definition.country !== scope.country) {
    throw new Error("Deze doelwaarde valt buiten de scope van de KPI.");
  }
  if (definition.teamId && definition.teamId !== scope.teamId) {
    throw new Error("Deze doelwaarde valt buiten de scope van de KPI.");
  }
  if (definition.userId && definition.userId !== scope.userId) {
    throw new Error("Deze doelwaarde valt buiten de scope van de KPI.");
  }

  const overlap = input.active
    ? await prisma.kpiTarget.findFirst({
        where: {
          kpiDefinitionId: definition.id,
          scopeKey: scope.scopeKey,
          active: true,
          ...(input.id ? { id: { not: input.id } } : {}),
          periodStart: { lte: input.periodEnd },
          periodEnd: { gte: input.periodStart },
        },
        select: { id: true },
      })
    : null;
  if (overlap) {
    throw new Error("Er bestaat al een actieve doelwaarde voor deze KPI, scope en periode.");
  }

  const data = {
    kpiDefinitionId: definition.id,
    targetTypeId: scope.targetTypeId,
    scope: scope.scope,
    scopeKey: scope.scopeKey,
    country: scope.country,
    teamId: scope.teamId,
    userId: scope.userId,
    role: scope.role,
    periodType: input.periodType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    targetValue: input.targetValue,
    active: input.active,
    updatedById: actor.id,
  };
  return input.id
    ? prisma.kpiTarget.update({ where: { id: input.id }, data })
    : prisma.kpiTarget.create({ data: { ...data, createdById: actor.id } });
}

export async function deactivateKpiTarget(actor: MockUser, id: string) {
  if (!can(actor, "kpiTargetsManage")) throw new Error("Je mag KPI-doelwaarden niet beheren.");
  const target = await prisma.kpiTarget.findUniqueOrThrow({
    where: { id },
    include: { kpiDefinition: { select: { country: true, teamId: true, userId: true, targetRole: true } } },
  });
  assertKpiDefinitionAccess(actor, {
    country: target.kpiDefinition.country as Country | null,
    teamId: target.kpiDefinition.teamId,
    userId: target.kpiDefinition.userId,
    targetRole: target.kpiDefinition.targetRole as Role | null,
  });
  return prisma.kpiTarget.update({ where: { id }, data: { active: false, updatedById: actor.id } });
}

async function resolveKpiTargetScope(
  actor: MockUser,
  input: {
    targetTypeId: string | null;
    scope: KpiTargetScope;
    country: Country | null;
    teamId: string | null;
    userId: string | null;
    role: Role | null;
  }
) {
  const targetType = input.targetTypeId
    ? await prisma.kpiTargetType.findUnique({ where: { id: input.targetTypeId } })
    : await prisma.kpiTargetType.findUnique({ where: { code: input.scope } });
  if (!targetType || !targetType.isActive || targetType.code !== input.scope) {
    throw new Error("Selecteer een geldige KPI-scope.");
  }
  if (input.scope === "GLOBAL") {
    if (!["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) {
      throw new Error("Globale KPI-doelwaarden kunnen alleen door groepsbeheer worden aangemaakt.");
    }
    return {
      targetTypeId: targetType.id,
      scope: input.scope,
      scopeKey: createKpiTargetScopeKey({ ...input, country: null, teamId: null, userId: null, role: null }),
      country: null,
      teamId: null,
      userId: null,
      role: null,
    };
  }
  if (input.scope === "COUNTRY") {
    if (!input.country) throw new Error("Selecteer een land voor deze doelwaarde.");
    if (!actorCanAccessKpiCountry(actor, input.country)) {
      throw new Error("Deze doelwaarde valt buiten je toegestane scope.");
    }
    return {
      targetTypeId: targetType.id,
      scope: input.scope,
      scopeKey: createKpiTargetScopeKey(input),
      country: input.country,
      teamId: null,
      userId: null,
      role: null,
    };
  }
  if (input.scope === "TEAM") {
    const teamId = normalizeId(input.teamId);
    if (!teamId) throw new Error("Selecteer een team voor deze doelwaarde.");
    const team = await prisma.team.findFirst({
      where: { id: teamId, active: true },
      select: { id: true, country: true },
    });
    if (!team) throw new Error("Het gekozen team bestaat niet meer.");
    const country = team.country as Country;
    if (!actorCanAccessKpiCountry(actor, country)) {
      throw new Error("Deze doelwaarde valt buiten je toegestane scope.");
    }
    return {
      targetTypeId: targetType.id,
      scope: input.scope,
      scopeKey: createKpiTargetScopeKey({ ...input, teamId: team.id }),
      country,
      teamId: team.id,
      userId: null,
      role: null,
    };
  }
  if (input.scope === "USER") {
    const userId = normalizeId(input.userId);
    if (!userId) throw new Error("Selecteer een gebruiker voor deze doelwaarde.");
    const user = await prisma.user.findFirst({
      where: { id: userId, active: true },
      select: { id: true, country: true, teamId: true },
    });
    if (!user) throw new Error("De gekozen gebruiker bestaat niet meer.");
    const country = user.country as Country;
    if (!actorCanAccessKpiCountry(actor, country)) {
      throw new Error("Deze doelwaarde valt buiten je toegestane scope.");
    }
    return {
      targetTypeId: targetType.id,
      scope: input.scope,
      scopeKey: createKpiTargetScopeKey({ ...input, userId: user.id }),
      country,
      teamId: user.teamId,
      userId: user.id,
      role: null,
    };
  }

  if (!input.role) throw new Error("Selecteer een rol voor deze doelwaarde.");
  const country = input.country ?? (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role) ? null : actor.country);
  if (!actorCanAccessKpiCountry(actor, country)) {
    throw new Error("Deze doelwaarde valt buiten je toegestane scope.");
  }
  return {
    targetTypeId: targetType.id,
    scope: input.scope,
    scopeKey: createKpiTargetScopeKey({ ...input, country, role: input.role }),
    country,
    teamId: null,
    userId: null,
    role: input.role,
  };
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

export async function saveCriterionScopeLink(
  actor: MockUser,
  input: {
    id?: string;
    criterionId: string;
    scopeType: CriterionScopeType;
    country: Country | null;
    teamId: string | null;
    userId: string | null;
    sortOrder: number;
  }
) {
  requireCriterionScopeManagement(actor);
  const criterion = await prisma.coachingCriterion.findUnique({
    where: { id: input.criterionId },
    select: { id: true },
  });
  if (!criterion) throw new Error("Het gekozen kapstokcriterium bestaat niet meer.");

  if (input.id) {
    const existing = await prisma.criterionScopeLink.findUnique({
      where: { id: input.id },
      select: { coachingCriterionId: true, country: true, teamId: true, userId: true },
    });
    if (!existing || existing.coachingCriterionId !== criterion.id) {
      throw new Error("De gekozen kapstokkoppeling bestaat niet meer.");
    }
    await assertCriterionScopeLinkAccess(actor, existing);
  }

  const scope = await resolveCriterionScopeLink(actor, input);
  const data = {
    criterionType: "COAT_RACK" as const,
    criterionKey: `COAT_RACK:${criterion.id}`,
    coachingCriterionId: criterion.id,
    scopeType: scope.scopeType,
    scopeKey: scope.scopeKey,
    country: scope.country,
    teamId: scope.teamId,
    userId: scope.userId,
    sortOrder: Math.max(0, Math.trunc(input.sortOrder || 0)),
    updatedById: actor.id,
  };

  return input.id
    ? prisma.criterionScopeLink.update({ where: { id: input.id }, data })
    : prisma.criterionScopeLink.create({ data: { ...data, createdById: actor.id } });
}

export async function deactivateCriterionScopeLink(actor: MockUser, id: string) {
  requireCriterionScopeManagement(actor);
  const existing = await prisma.criterionScopeLink.findUnique({
    where: { id },
    select: { id: true, criterionType: true, country: true, teamId: true, userId: true },
  });
  if (!existing || existing.criterionType !== "COAT_RACK") {
    throw new Error("De gekozen kapstokkoppeling bestaat niet meer.");
  }
  await assertCriterionScopeLinkAccess(actor, existing);
  return prisma.criterionScopeLink.delete({ where: { id } });
}

function requireCriterionScopeManagement(actor: MockUser) {
  if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("Je mag kapstokkoppelingen niet beheren.");
  }
}

async function resolveCriterionScopeLink(
  actor: MockUser,
  input: {
    scopeType: CriterionScopeType;
    country: Country | null;
    teamId: string | null;
    userId: string | null;
  }
) {
  if (input.scopeType === "GLOBAL") {
    if (actor.role !== "SUPER_ADMIN") {
      throw new Error("Globale kapstokkoppelingen kunnen alleen door een Super Admin worden gewijzigd.");
    }
    return {
      scopeType: input.scopeType,
      scopeKey: criterionScopeKey("GLOBAL"),
      country: null,
      teamId: null,
      userId: null,
    };
  }

  if (input.scopeType === "COUNTRY") {
    if (!input.country) throw new Error("Selecteer een land voor deze kapstokkoppeling.");
    if (!actorCanAccessKpiCountry(actor, input.country)) {
      throw new Error("Deze kapstokkoppeling valt buiten je toegestane scope.");
    }
    return {
      scopeType: input.scopeType,
      scopeKey: criterionScopeKey("COUNTRY", { country: input.country }),
      country: input.country,
      teamId: null,
      userId: null,
    };
  }

  if (input.scopeType === "TEAM") {
    const teamId = normalizeId(input.teamId);
    if (!teamId) throw new Error("Selecteer een team voor deze kapstokkoppeling.");
    const team = await prisma.team.findFirst({
      where: { id: teamId, active: true },
      select: { id: true, country: true },
    });
    if (!team) throw new Error("Het gekozen team bestaat niet meer.");
    const country = team.country as Country;
    if (!actorCanAccessKpiCountry(actor, country)) {
      throw new Error("Deze kapstokkoppeling valt buiten je toegestane scope.");
    }
    return {
      scopeType: input.scopeType,
      scopeKey: criterionScopeKey("TEAM", { teamId: team.id }),
      country,
      teamId: team.id,
      userId: null,
    };
  }

  if (input.scopeType === "USER") {
    const userId = normalizeId(input.userId);
    if (!userId) throw new Error("Selecteer een gebruiker voor deze kapstokkoppeling.");
    const user = await prisma.user.findFirst({
      where: { id: userId, active: true },
      select: { id: true, country: true, teamId: true },
    });
    if (!user) throw new Error("De gekozen gebruiker bestaat niet meer.");
    const country = user.country as Country;
    if (!actorCanAccessKpiCountry(actor, country)) {
      throw new Error("Deze kapstokkoppeling valt buiten je toegestane scope.");
    }
    return {
      scopeType: input.scopeType,
      scopeKey: criterionScopeKey("USER", { userId: user.id }),
      country,
      teamId: user.teamId,
      userId: user.id,
    };
  }

  throw new Error("Selecteer een geldige kapstokscope.");
}

async function assertCriterionScopeLinkAccess(
  actor: MockUser,
  scope: { country: Country | null; teamId: string | null; userId: string | null }
) {
  if (actor.role === "SUPER_ADMIN") return;
  if (scope.country && actorCanAccessKpiCountry(actor, scope.country)) return;
  if (scope.teamId) {
    const team = await prisma.team.findUnique({ where: { id: scope.teamId }, select: { country: true } });
    if (team && actorCanAccessKpiCountry(actor, team.country as Country)) return;
  }
  if (scope.userId) {
    const user = await prisma.user.findUnique({ where: { id: scope.userId }, select: { country: true } });
    if (user && actorCanAccessKpiCountry(actor, user.country as Country)) return;
  }
  throw new Error("Deze kapstokkoppeling valt buiten je toegestane scope.");
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
  const missingPayloadKeys = fieldForcePermissionKeys.filter(
    (key) => typeof permissions[key] !== "boolean"
  );
  if (missingPayloadKeys.length) {
    throw new Error(
      `De rollenwijziging mist ${missingPayloadKeys.length} rechten: ${missingPayloadKeys.join(", ")}.`
    );
  }

  await ensureFieldForcePermissionRecords();

  const [records, currentGrants, currentConfiguration] = await Promise.all([
    prisma.permission.findMany({ where: { key: { in: fieldForcePermissionKeys } } }),
    prisma.rolePermission.findMany({
      where: { role },
      include: { permission: { select: { key: true } } },
    }),
    prisma.roleConfiguration.findUnique({ where: { role } }),
  ]);
  const missingRecords = missingPermissionKeys(records.map((record) => record.key));
  if (missingRecords.length) {
    throw new Error(
      `Permission-basisrecords ontbreken: ${missingRecords.join(", ")}. Voer de configuratieseed uit.`
    );
  }

  const previousPermissions = resolveRolePermissions(role, currentGrants);
  const nextPermissions = Object.fromEntries(
    fieldForcePermissionKeys.map((key) => [key, Boolean(permissions[key])])
  ) as Record<FieldForcePermissionKey, boolean>;
  const changedPermissions = fieldForcePermissionKeys
    .filter((key) => previousPermissions[key] !== nextPermissions[key])
    .map((key) => ({ key, from: previousPermissions[key], to: nextPermissions[key] }));
  const recordsByKey = new Map(
    records.map((record) => [record.key as FieldForcePermissionKey, record])
  );

  await prisma.$transaction(async (transaction) => {
    for (const change of changedPermissions) {
      const permission = recordsByKey.get(change.key);
      if (!permission) continue;

      await transaction.userPermission.deleteMany({
        where: {
          permissionId: permission.id,
          enabled: change.from,
          user: { role },
        },
      });
      await transaction.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: permission.id } },
        update: { enabled: change.to },
        create: { role, permissionId: permission.id, enabled: change.to },
      });
    }
    if (typeof active === "boolean") {
      await transaction.roleConfiguration.upsert({
        where: { role },
        update: { active },
        create: { role, active },
      });
    }
  });

  return {
    role,
    active: active ?? currentConfiguration?.active ?? true,
    permissions: nextPermissions,
    changedPermissions,
  };
}
