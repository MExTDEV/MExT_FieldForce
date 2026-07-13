import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import { ApiRequestError } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { createManagedUserInDatabase, listManagedUsers, updateManagedUserInDatabase } from "@/lib/server/users";
import { saveCriterion, saveFocus, saveKpi, saveTeam } from "@/lib/server/management";
import { assertRoleAssignable } from "@/lib/server/role-configuration";
import { parseCsv, toCsv, type ParsedCsvRow } from "@/lib/csv";
import {
  isManagementImportExportTopic,
  managementImportExportTopics,
  type ManagementImportExportTopic,
  type ManagementImportMode,
  type ManagementImportResult,
  type ManagementImportRowResult,
} from "@/lib/management-import-export";
import {
  isKpiUnit,
  validateKpiDates,
  validateKpiRange,
} from "@/lib/kpi-settings";
import { prepareManagedUserSave } from "@/lib/user-management";
import { resolveRolePermissions } from "@/lib/role-permissions";
import type {
  Country,
  KpiEvaluationDirection,
  Language,
  ManagedUser,
  MockUser,
  Role,
} from "@/lib/types";

const countries: Country[] = ["BE", "NL", "DE"];
const languages: Language[] = ["nl", "fr", "de"];
const roles: Role[] = [
  "REPRESENTATIVE",
  "SALES_LEADER",
  "SALES_MANAGER",
  "SERVICE_OPERATOR",
  "COUNTRY_MANAGER",
  "GROUP_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
];
const evaluationDirections: KpiEvaluationDirection[] = [
  "HIGHER_IS_BETTER",
  "LOWER_IS_BETTER",
  "TARGET",
];

type ImportOperation<T> = {
  row: number;
  key: string;
  action: "create" | "update" | "skip";
  payload: T;
  errors: string[];
};

type UserImportPayload = {
  existingId?: string;
  draft: ManagedUser;
};

type TeamImportPayload = {
  existingId?: string;
  name: string;
  country: Country;
  primaryLeaderId: string | null;
  active: boolean;
};

type TeamExportRow = {
  name: string;
  country: string;
  primaryLeaderEmail: string | null;
  active: boolean | number;
};

type TeamLookupRow = {
  id: string;
  name: string;
  country: string;
};

type KpiImportPayload = Parameters<typeof saveKpi>[1];

type FocusImportPayload = {
  existingId?: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

type CriterionImportPayload = {
  existingId?: string;
  focusKey: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export function parseManagementImportTopic(topic: string) {
  if (!isManagementImportExportTopic(topic)) {
    throw new ApiRequestError("Onbekend import/export onderwerp.", 400);
  }
  return topic;
}

export async function exportManagementTopic(topic: ManagementImportExportTopic) {
  const rows = await exportRows(topic);
  return {
    filename: managementImportExportTopics[topic].filename,
    csv: toCsv(exportHeaders[topic], rows),
  };
}

export async function importManagementTopic(
  actor: MockUser,
  topic: ManagementImportExportTopic,
  csv: string,
  mode: ManagementImportMode
): Promise<ManagementImportResult> {
  if (mode !== "validate" && mode !== "commit") {
    throw new Error("Ongeldige importmodus.");
  }
  if (!csv.trim()) {
    return emptyResult(topic, mode, [{ row: 1, message: "Selecteer een CSV-bestand." }]);
  }

  const result =
    topic === "users"
      ? await importUsers(actor, csv, mode)
      : topic === "teams"
        ? await importTeams(actor, csv, mode)
        : topic === "kpis"
          ? await importKpis(actor, csv, mode)
          : await importKapstok(actor, csv, mode);

  if (mode === "commit") {
    await writeAuditLog({
      actorId: actor.id,
      entityType: "ManagementImportExport",
      entityId: topic,
      action: "management.import",
      newValue: {
        topic,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      },
    });
  }

  return result;
}

const exportHeaders = {
  users: [
    "firstName",
    "lastName",
    "email",
    "role",
    "country",
    "teamName",
    "language",
    "mobile",
    "branchNumber",
    "active",
    "countryAccess",
  ],
  teams: ["name", "country", "primaryLeaderEmail", "active"],
  kpis: [
    "code",
    "name",
    "description",
    "country",
    "unit",
    "targetValue",
    "minValue",
    "maxValue",
    "evaluationDirection",
    "active",
  ],
  kapstok: [
    "focusCode",
    "focusName",
    "focusSortOrder",
    "focusActive",
    "criterionName",
    "criterionSortOrder",
    "criterionActive",
  ],
} satisfies Record<ManagementImportExportTopic, string[]>;

async function exportRows(
  topic: ManagementImportExportTopic
): Promise<Record<string, unknown>[]> {
  if (topic === "users") {
    const users = await listManagedUsers();
    return users.map((user) => ({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      country: user.country,
      teamName: user.teamName,
      language: user.language,
      mobile: user.mobile,
      branchNumber: user.branchNumber,
      active: booleanText(user.active),
      countryAccess: user.countryAccess.join(";"),
    }));
  }

  if (topic === "teams") {
    const teams = await prisma.$queryRaw<TeamExportRow[]>(Prisma.sql`
      SELECT
        t.name,
        t.country,
        leader.email AS primaryLeaderEmail,
        t.active
      FROM \`Team\` t
      LEFT JOIN \`User\` leader ON leader.id = t.primaryLeaderId
      ORDER BY t.country ASC, t.name ASC
    `);
    return teams.map((team) => ({
      name: team.name,
      country: team.country,
      primaryLeaderEmail: team.primaryLeaderEmail ?? "",
      active: booleanText(team.active),
    }));
  }

  if (topic === "kpis") {
    const kpis = await prisma.kpiDefinition.findMany({
      orderBy: [{ country: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });
    return kpis.map((kpi) => ({
      code: kpi.code,
      name: kpi.name,
      description: kpi.description,
      country: kpi.country ?? "",
      unit: kpi.unit,
      targetValue: decimalText(kpi.targetValue),
      minValue: decimalText(kpi.minValue),
      maxValue: decimalText(kpi.maxValue),
      evaluationDirection: kpi.evaluationDirection,
      active: booleanText(kpi.active),
    }));
  }

  const focuses = await prisma.coachingFocus.findMany({
    include: { criteria: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const rows: Record<string, unknown>[] = [];
  for (const focus of focuses) {
    if (!focus.criteria.length) {
      rows.push({
        focusCode: focus.code,
        focusName: focus.name,
        focusSortOrder: focus.sortOrder,
        focusActive: booleanText(focus.active),
        criterionName: "",
        criterionSortOrder: "",
        criterionActive: "",
      });
      continue;
    }
    for (const criterion of focus.criteria) {
      rows.push({
        focusCode: focus.code,
        focusName: focus.name,
        focusSortOrder: focus.sortOrder,
        focusActive: booleanText(focus.active),
        criterionName: criterion.name,
        criterionSortOrder: criterion.sortOrder,
        criterionActive: booleanText(criterion.active),
      });
    }
  }
  return rows;
}

async function importUsers(
  actor: MockUser,
  csv: string,
  mode: ManagementImportMode
): Promise<ManagementImportResult> {
  const parsed = parseCsv(csv);
  const errors = [...parsed.errors, ...missingColumns(parsed.headers, exportHeaders.users)];
  const users = await listManagedUsers();
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const activeTeams = await prisma.$queryRaw<TeamLookupRow[]>(Prisma.sql`
    SELECT id, name, country
    FROM \`Team\`
    WHERE active = TRUE
  `);
  const rolePermissions = await prisma.rolePermission.findMany({
    include: {
      permission: { select: { key: true } },
    },
  });
  const teamByCountryName = new Map(
    activeTeams.map((team) => [teamKey(team.country as Country, team.name), team])
  );
  const seenEmails = new Set<string>();
  const operations: ImportOperation<UserImportPayload>[] = [];

  for (const row of parsed.rows) {
    const rowErrors: string[] = [];
    const email = read(row, "email").toLowerCase();
    if (!email) rowErrors.push("E-mail is verplicht.");
    if (email && seenEmails.has(email)) rowErrors.push("Deze e-mail komt meer dan een keer voor in de CSV.");
    if (email) seenEmails.add(email);

    const existing = email ? usersByEmail.get(email) : undefined;
    const role = parseRole(read(row, "role"), rowErrors);
    const country = parseCountry(read(row, "country"), rowErrors);
    const language = parseLanguage(read(row, "language"), rowErrors);
    const active = parseBoolean(read(row, "active"), true, rowErrors, "active");
    const teamName = read(row, "teamName");
    const countryAccess = parseCountryList(read(row, "countryAccess"), rowErrors);
    let teamId = "";

    if (role && country && ["REPRESENTATIVE", "SALES_LEADER", "SERVICE_OPERATOR"].includes(role)) {
      if (!teamName) {
        rowErrors.push("teamName is verplicht voor deze rol.");
      } else {
        const team = teamByCountryName.get(teamKey(country, teamName));
        if (!team) rowErrors.push("Het opgegeven team bestaat niet of is niet actief in dit land.");
        else teamId = team.id;
      }
    } else if (teamName && country) {
      const team = teamByCountryName.get(teamKey(country, teamName));
      if (!team) rowErrors.push("Het opgegeven team bestaat niet of is niet actief in dit land.");
      else teamId = team.id;
    }

    if (role === "SALES_MANAGER" && !countryAccess.length) {
      rowErrors.push("Sales Manager vereist minstens een countryAccess.");
    }
    if (role) {
      try {
        await assertRoleAssignable(role, existing?.role);
      } catch (error) {
        rowErrors.push(errorMessage(error));
      }
    }

    const selectedRole = role ?? "REPRESENTATIVE";
    const permissions = existing && existing.role === selectedRole
      ? { ...existing.permissions }
      : resolveRolePermissions(selectedRole, rolePermissions);
    const draft: ManagedUser = {
      id: existing?.id ?? "",
      firstName: read(row, "firstName"),
      lastName: read(row, "lastName"),
      email,
      role: role ?? "REPRESENTATIVE",
      representativeLevel: existing?.representativeLevel ?? (role === "REPRESENTATIVE" || !role ? "SALES_EXECUTIVE" : "STARTER"),
      country: country ?? "BE",
      teamId,
      teamName,
      language: language ?? "nl",
      mobile: read(row, "mobile"),
      branchNumber: read(row, "branchNumber"),
      active,
      countryAccess,
      teamSupervisor: existing?.teamSupervisor ?? false,
      avatarUrl: existing?.avatarUrl ?? "",
      permissions,
      representativeId: existing?.representativeId,
    };

    try {
      if (!errors.length) prepareManagedUserSave(actor, users, draft, existing);
    } catch (error) {
      rowErrors.push(errorMessage(error));
    }

    operations.push({
      row: row.rowNumber,
      key: email || `rij ${row.rowNumber}`,
      action: existing ? "update" : "create",
      payload: { existingId: existing?.id, draft },
      errors: rowErrors,
    });
  }

  return commitOperations(topicResult("users", mode), operations, errors, mode, async (operation) => {
    if (operation.payload.existingId) {
      await updateManagedUserInDatabase(actor.id, operation.payload.existingId, operation.payload.draft);
    } else {
      await createManagedUserInDatabase(actor.id, operation.payload.draft);
    }
  });
}

async function importTeams(
  actor: MockUser,
  csv: string,
  mode: ManagementImportMode
): Promise<ManagementImportResult> {
  const parsed = parseCsv(csv);
  const errors = [...parsed.errors, ...missingColumns(parsed.headers, exportHeaders.teams)];
  const [teams, users] = await Promise.all([
    prisma.$queryRaw<TeamLookupRow[]>(Prisma.sql`
      SELECT id, name, country
      FROM \`Team\`
    `),
    prisma.user.findMany({ select: { id: true, email: true, country: true, active: true } }),
  ]);
  const existingByKey = new Map(
    teams.map((team) => [teamKey(team.country as Country, team.name), team])
  );
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const seenTeams = new Set<string>();
  const operations: ImportOperation<TeamImportPayload>[] = [];

  for (const row of parsed.rows) {
    const rowErrors: string[] = [];
    const name = read(row, "name");
    const country = parseCountry(read(row, "country"), rowErrors);
    if (!name) rowErrors.push("Teamnaam is verplicht.");
    const key = country && name ? teamKey(country, name) : `rij ${row.rowNumber}`;
    if (seenTeams.has(key)) rowErrors.push("Dit team komt meer dan een keer voor in de CSV.");
    seenTeams.add(key);

    const leaderEmail = read(row, "primaryLeaderEmail").toLowerCase();
    const leader = leaderEmail ? usersByEmail.get(leaderEmail) : undefined;
    if (leaderEmail && (!leader || !leader.active || leader.country !== country)) {
      rowErrors.push("primaryLeaderEmail moet verwijzen naar een actieve gebruiker in hetzelfde land.");
    }

    const existing = country && name ? existingByKey.get(key) : undefined;
    operations.push({
      row: row.rowNumber,
      key,
      action: existing ? "update" : "create",
      payload: {
        existingId: existing?.id,
        name,
        country: country ?? "BE",
        primaryLeaderId: leader?.id ?? null,
        active: parseBoolean(read(row, "active"), true, rowErrors, "active"),
      },
      errors: rowErrors,
    });
  }

  return commitOperations(topicResult("teams", mode), operations, errors, mode, async (operation) => {
    const team = await saveTeam(actor, {
      id: operation.payload.existingId,
      name: operation.payload.name,
      country: operation.payload.country,
      primaryLeaderId: operation.payload.primaryLeaderId,
    });
    if (!operation.payload.active) {
      await prisma.team.update({ where: { id: team.id }, data: { active: false } });
    }
  });
}

async function importKpis(
  actor: MockUser,
  csv: string,
  mode: ManagementImportMode
): Promise<ManagementImportResult> {
  const parsed = parseCsv(csv);
  const errors = [...parsed.errors, ...missingColumns(parsed.headers, exportHeaders.kpis)];
  const [kpis, categories, types, targetTypes] = await Promise.all([
    prisma.kpiDefinition.findMany(),
    prisma.kpiCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.kpiType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.kpiTargetType.findMany({ where: { isActive: true } }),
  ]);
  const existingByCode = new Map(kpis.map((kpi) => [kpi.code.toUpperCase(), kpi]));
  const seenCodes = new Set<string>();
  const operations: ImportOperation<KpiImportPayload>[] = [];

  for (const row of parsed.rows) {
    const rowErrors: string[] = [];
    const code = read(row, "code").toUpperCase();
    if (!code) rowErrors.push("Code is verplicht.");
    if (code && seenCodes.has(code)) rowErrors.push("Deze KPI-code komt meer dan een keer voor in de CSV.");
    if (code) seenCodes.add(code);
    const existing = code ? existingByCode.get(code) : undefined;
    const country = parseOptionalCountry(read(row, "country"), rowErrors);
    const unit = read(row, "unit") || existing?.unit || "number";
    if (!isKpiUnit(unit)) rowErrors.push("Selecteer een geldige eenheid.");
    const targetValue = parseNumber(read(row, "targetValue"), "Doelwaarde", rowErrors);
    const minValue = parseOptionalNumber(read(row, "minValue"), "Minimumwaarde", rowErrors);
    const maxValue = parseOptionalNumber(read(row, "maxValue"), "Maximumwaarde", rowErrors);
    const evaluationDirection = parseEvaluationDirection(read(row, "evaluationDirection"), rowErrors);
    const targetTypeCode = country ? "COUNTRY" : "GLOBAL";
    const targetType = targetTypes.find((item) => item.code === targetTypeCode);
    if (!targetType) rowErrors.push("De vereiste KPI-scope bestaat niet.");
    if (!read(row, "name")) rowErrors.push("Naam is verplicht.");
    try {
      validateKpiRange(targetValue, minValue, maxValue);
      validateKpiDates(existing?.validFrom ?? todayDate(), existing?.validUntil ?? null);
    } catch (error) {
      rowErrors.push(errorMessage(error));
    }

    const categoryId = existing?.categoryId ?? categories.find((item) => item.code === "CUSTOM")?.id ?? categories[0]?.id ?? null;
    const typeId = existing?.typeId ?? defaultKpiTypeId(types, unit);
    operations.push({
      row: row.rowNumber,
      key: code || `rij ${row.rowNumber}`,
      action: existing ? "update" : "create",
      payload: {
        id: existing?.id,
        code,
        name: read(row, "name"),
        description: read(row, "description"),
        categoryId,
        typeId,
        targetTypeId: targetType?.id ?? null,
        country,
        teamId: null,
        userId: null,
        targetRole: null,
        unit: isKpiUnit(unit) ? unit : "number",
        targetValue,
        minValue,
        maxValue,
        weight: existing?.weight === null || existing?.weight === undefined ? null : Number(existing.weight),
        countsForReporting: existing?.countsForReporting ?? true,
        countsForPerformanceCircle: existing?.countsForPerformanceCircle ?? true,
        sortOrder: existing?.sortOrder ?? kpis.length + operations.length + 1,
        validFrom: existing?.validFrom ?? todayDate(),
        validUntil: existing?.validUntil ?? null,
        evaluationDirection: evaluationDirection ?? "HIGHER_IS_BETTER",
        active: parseBoolean(read(row, "active"), existing?.active ?? true, rowErrors, "active"),
      },
      errors: rowErrors,
    });
  }

  return commitOperations(topicResult("kpis", mode), operations, errors, mode, async (operation) => {
    await saveKpi(actor, operation.payload);
  });
}

async function importKapstok(
  actor: MockUser,
  csv: string,
  mode: ManagementImportMode
): Promise<ManagementImportResult> {
  const parsed = parseCsv(csv);
  const errors = [...parsed.errors, ...missingColumns(parsed.headers, exportHeaders.kapstok)];
  const focuses = await prisma.coachingFocus.findMany({
    include: { criteria: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const focusByCode = new Map(focuses.map((focus) => [focus.code.toUpperCase(), focus]));
  const focusByName = new Map(focuses.map((focus) => [focus.name.toLowerCase(), focus]));
  const focusOperations = new Map<string, ImportOperation<FocusImportPayload>>();
  const criterionOperations: ImportOperation<CriterionImportPayload>[] = [];
  const seenCriteria = new Set<string>();

  for (const row of parsed.rows) {
    const rowErrors: string[] = [];
    const code = read(row, "focusCode").toUpperCase();
    const name = read(row, "focusName");
    if (!name) rowErrors.push("focusName is verplicht.");
    const existing = code ? focusByCode.get(code) : focusByName.get(name.toLowerCase());
    if (!existing && !code) rowErrors.push("focusCode is verplicht voor een nieuwe kapstok.");
    const focusKey = code ? `code:${code}` : `name:${name.toLowerCase()}`;
    const sortOrder = parseInteger(read(row, "focusSortOrder"), existing?.sortOrder ?? focusOperations.size + 1, rowErrors, "focusSortOrder");
    const active = parseBoolean(read(row, "focusActive"), existing?.active ?? true, rowErrors, "focusActive");
    const previous = focusOperations.get(focusKey);
    const focusPayload = {
      existingId: existing?.id,
      code: code || existing?.code || "",
      name,
      sortOrder,
      active,
    };
    if (!previous) {
      focusOperations.set(focusKey, {
        row: row.rowNumber,
        key: code || name || `rij ${row.rowNumber}`,
        action: existing ? "update" : "create",
        payload: focusPayload,
        errors: [...rowErrors],
      });
    } else if (
      previous.payload.name !== focusPayload.name ||
      previous.payload.code !== focusPayload.code ||
      previous.payload.sortOrder !== focusPayload.sortOrder ||
      previous.payload.active !== focusPayload.active
    ) {
      rowErrors.push("Deze kapstok komt met afwijkende focusgegevens meer dan een keer voor in de CSV.");
    }

    const criterionName = read(row, "criterionName");
    if (criterionName) {
      const criterionKey = `${focusKey}:${criterionName.toLowerCase()}`;
      if (seenCriteria.has(criterionKey)) {
        rowErrors.push("Dit criterium komt meer dan een keer voor binnen dezelfde kapstok.");
      }
      seenCriteria.add(criterionKey);
      const existingCriterion = existing?.criteria.find(
        (criterion) => criterion.name.toLowerCase() === criterionName.toLowerCase()
      );
      criterionOperations.push({
        row: row.rowNumber,
        key: `${code || name}/${criterionName}`,
        action: existingCriterion ? "update" : "create",
        payload: {
          existingId: existingCriterion?.id,
          focusKey,
          name: criterionName,
          sortOrder: parseInteger(read(row, "criterionSortOrder"), existingCriterion?.sortOrder ?? 1, rowErrors, "criterionSortOrder"),
          active: parseBoolean(read(row, "criterionActive"), existingCriterion?.active ?? true, rowErrors, "criterionActive"),
        },
        errors: rowErrors,
      });
    }
  }

  const operations: ImportOperation<unknown>[] = [
    ...focusOperations.values(),
    ...criterionOperations,
  ];
  const result = topicResult("kapstok", mode);
  const rowErrors = allErrors(errors, operations);
  result.rows = operations.map(rowResult);
  result.errors = rowErrors;
  result.created = operations.filter(
    (operation) => operation.action === "create" && !operation.errors.length
  ).length;
  result.updated = operations.filter(
    (operation) => operation.action === "update" && !operation.errors.length
  ).length;
  result.skipped = operations.filter((operation) => operation.action === "skip").length;
  if (mode === "validate" || rowErrors.length) return result;

  result.created = 0;
  result.updated = 0;
  const savedFocusIds = new Map<string, string>();
  for (const [focusKey, operation] of focusOperations) {
    try {
      const focus = await saveFocus(actor, {
        id: operation.payload.existingId,
        code: operation.payload.code,
        name: operation.payload.name,
        sortOrder: operation.payload.sortOrder,
      });
      if (!operation.payload.active) {
        await prisma.coachingFocus.update({ where: { id: focus.id }, data: { active: false } });
      }
      savedFocusIds.set(focusKey, focus.id);
      result[operation.action === "create" ? "created" : "updated"] += 1;
    } catch (error) {
      operation.errors.push(errorMessage(error));
    }
  }
  for (const operation of criterionOperations) {
    try {
      const focusId = savedFocusIds.get(operation.payload.focusKey);
      if (!focusId) throw new Error("Kapstok kon niet worden opgeslagen.");
      const criterion = await saveCriterion(actor, {
        id: operation.payload.existingId,
        focusId,
        name: operation.payload.name,
        sortOrder: operation.payload.sortOrder,
      });
      if (!operation.payload.active) {
        await prisma.coachingCriterion.update({ where: { id: criterion.id }, data: { active: false } });
      }
      result[operation.action === "create" ? "created" : "updated"] += 1;
    } catch (error) {
      operation.errors.push(errorMessage(error));
    }
  }
  result.rows = operations.map(rowResult);
  result.errors = allErrors(errors, operations);
  return result;
}

async function commitOperations<T>(
  result: ManagementImportResult,
  operations: ImportOperation<T>[],
  parseErrors: { row: number; message: string }[],
  mode: ManagementImportMode,
  commit: (operation: ImportOperation<T>) => Promise<void>
) {
  result.rows = operations.map(rowResult);
  result.errors = allErrors(parseErrors, operations);
  result.created = operations.filter(
    (operation) => operation.action === "create" && !operation.errors.length
  ).length;
  result.updated = operations.filter(
    (operation) => operation.action === "update" && !operation.errors.length
  ).length;
  result.skipped = operations.filter((operation) => operation.action === "skip").length;
  if (mode === "validate" || result.errors.length) return result;

  result.created = 0;
  result.updated = 0;
  for (const operation of operations) {
    try {
      await commit(operation);
      result[operation.action === "create" ? "created" : "updated"] += 1;
    } catch (error) {
      operation.errors.push(errorMessage(error));
    }
  }
  result.rows = operations.map(rowResult);
  result.errors = allErrors(parseErrors, operations);
  return result;
}

function topicResult(
  topic: ManagementImportExportTopic,
  mode: ManagementImportMode
): ManagementImportResult {
  return {
    topic,
    mode,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    rows: [],
  };
}

function emptyResult(
  topic: ManagementImportExportTopic,
  mode: ManagementImportMode,
  errors: { row: number; message: string }[]
) {
  return { ...topicResult(topic, mode), errors };
}

function rowResult(operation: ImportOperation<unknown>): ManagementImportRowResult {
  return {
    row: operation.row,
    key: operation.key,
    action: operation.action,
    errors: operation.errors,
  };
}

function allErrors(
  parseErrors: { row: number; message: string }[],
  operations: ImportOperation<unknown>[]
) {
  return [
    ...parseErrors,
    ...operations.flatMap((operation) =>
      operation.errors.map((message) => ({ row: operation.row, message }))
    ),
  ];
}

function missingColumns(headers: string[], required: string[]) {
  const normalizedHeaders = new Set(headers.map((header) => header.toLowerCase()));
  return required
    .filter((header) => !normalizedHeaders.has(header.toLowerCase()))
    .map((header) => ({ row: 1, message: `Kolom '${header}' ontbreekt.` }));
}

function read(row: ParsedCsvRow, column: string) {
  const match = Object.keys(row.values).find(
    (key) => key.toLowerCase() === column.toLowerCase()
  );
  return match ? row.values[match].trim() : "";
}

function parseRole(value: string, errors: string[]) {
  if (!roles.includes(value as Role)) {
    errors.push("Rol moet een bestaande Role enum waarde zijn.");
    return undefined;
  }
  return value as Role;
}

function parseCountry(value: string, errors: string[]) {
  if (!countries.includes(value as Country)) {
    errors.push("Land moet BE, NL of DE zijn.");
    return undefined;
  }
  return value as Country;
}

function parseOptionalCountry(value: string, errors: string[]) {
  if (!value) return null;
  return parseCountry(value, errors) ?? null;
}

function parseLanguage(value: string, errors: string[]) {
  if (!value) return "nl";
  if (!languages.includes(value as Language)) {
    errors.push("Taal moet nl, fr of de zijn.");
    return undefined;
  }
  return value as Language;
}

function parseCountryList(value: string, errors: string[]) {
  if (!value.trim()) return [];
  const parsed = value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = parsed.filter((item) => !countries.includes(item as Country));
  if (invalid.length) errors.push("countryAccess bevat een ongeldig land.");
  return [...new Set(parsed.filter((item) => countries.includes(item as Country)))] as Country[];
}

function parseBoolean(value: string, fallback: boolean, errors: string[], label: string) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "ja", "oui", "active", "actief"].includes(normalized)) return true;
  if (["false", "0", "no", "nee", "non", "inactive", "inactief", "niet-actief"].includes(normalized)) return false;
  errors.push(`${label} moet true of false zijn.`);
  return fallback;
}

function parseNumber(value: string, label: string, errors: string[]) {
  const parsed = Number(value.replace(",", "."));
  if (!value || !Number.isFinite(parsed)) {
    errors.push(`${label} moet numeriek zijn.`);
    return 0;
  }
  return parsed;
}

function parseOptionalNumber(value: string, label: string, errors: string[]) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    errors.push(`${label} moet numeriek zijn.`);
    return null;
  }
  return parsed;
}

function parseInteger(value: string, fallback: number, errors: string[], label: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    errors.push(`${label} moet een geheel getal zijn.`);
    return fallback;
  }
  return parsed;
}

function parseEvaluationDirection(value: string, errors: string[]) {
  if (!evaluationDirections.includes(value as KpiEvaluationDirection)) {
    errors.push("evaluationDirection is ongeldig.");
    return undefined;
  }
  return value as KpiEvaluationDirection;
}

function defaultKpiTypeId(
  types: { id: string; code: string }[],
  unit: string
) {
  const code = unit === "%"
    ? "PERCENTAGE"
    : unit === "EUR"
      ? "CURRENCY"
      : "NUMBER";
  return types.find((type) => type.code === code)?.id ?? types[0]?.id ?? null;
}

function teamKey(country: Country, name: string) {
  return `${country}:${name.trim().toLowerCase()}`;
}

function booleanText(value: boolean | number) {
  return Boolean(value) ? "true" : "false";
}

function decimalText(value: { toString: () => string } | null) {
  return value === null ? "" : value.toString();
}

function todayDate() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00.000Z`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Onbekende validatiefout.";
}
