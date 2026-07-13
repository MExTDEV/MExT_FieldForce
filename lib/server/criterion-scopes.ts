import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/server/db";
import type { Country } from "@/lib/types";

export type CriterionType =
  | "KPI"
  | "COAT_RACK"
  | "GENERAL_EVALUATION"
  | "PERSONALITY"
  | "GENERAL_COACHING_SCORE";

export type CriterionScopeType = "GLOBAL" | "COUNTRY" | "TEAM" | "USER";

type Queryable = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

type ScopeLinkRow = {
  id: string;
  criterionType: CriterionType;
  criterionKey: string;
  kpiDefinitionId: string | null;
  coachingCriterionId: string | null;
  configurableCriterionId: string | null;
  scopeType: CriterionScopeType;
  scopeKey: string;
  country: Country | null;
  teamId: string | null;
  userId: string | null;
  sortOrder: number | bigint;
  teamName: string | null;
  userFirstName: string | null;
  userLastName: string | null;
};

type CoachedUserRow = {
  id: string;
  country: Country;
  teamId: string | null;
  firstName: string;
  lastName: string;
};

type CriterionDefinition = {
  sourceCriterionId: string;
  criterionKey: string;
  criterionType: CriterionType;
  title: string;
  description: string | null;
  focusName: string | null;
  section: string | null;
  answerType: string;
  scoreType: string;
  minScore: number | null;
  maxScore: number | null;
  weight: number | null;
  targetValue: number | null;
  required: boolean;
};

export type ApplicableCriterion = CriterionDefinition & {
  sourceScopeLinkId: string;
  appliedScopeType: CriterionScopeType;
  appliedScopeKey: string;
  appliedScopeLabel: string;
  sortOrder: number;
};

export type CriterionSnapshotRow = ApplicableCriterion & {
  id: string;
  interventionId: string;
  snapshotVersion: number;
  createdAt: string;
};

const scopePriority: Record<CriterionScopeType, number> = {
  GLOBAL: 0,
  COUNTRY: 1,
  TEAM: 2,
  USER: 3,
};

const groupOrder: Record<CriterionScopeType, number> = {
  GLOBAL: 0,
  COUNTRY: 1,
  TEAM: 2,
  USER: 3,
};

const allCriterionTypes: CriterionType[] = [
  "KPI",
  "COAT_RACK",
  "GENERAL_EVALUATION",
  "PERSONALITY",
  "GENERAL_COACHING_SCORE",
];

export function criterionScopeKey(
  scopeType: CriterionScopeType,
  target?: { country?: Country | null; teamId?: string | null; userId?: string | null }
) {
  if (scopeType === "GLOBAL") return "GLOBAL";
  if (scopeType === "COUNTRY") return `COUNTRY:${target?.country ?? ""}`;
  if (scopeType === "TEAM") return `TEAM:${target?.teamId ?? ""}`;
  return `USER:${target?.userId ?? ""}`;
}

export function sortApplicableCriteria<T extends Pick<ApplicableCriterion, "appliedScopeType" | "sortOrder" | "title" | "sourceCriterionId">>(
  criteria: T[]
) {
  return [...criteria].sort((left, right) =>
    groupOrder[left.appliedScopeType] - groupOrder[right.appliedScopeType] ||
    left.sortOrder - right.sortOrder ||
    left.title.localeCompare(right.title, "nl") ||
    left.sourceCriterionId.localeCompare(right.sourceCriterionId)
  );
}

export async function listApplicableCriteriaForUser(
  userId: string,
  options: { types?: CriterionType[]; db?: Queryable } = {}
): Promise<ApplicableCriterion[]> {
  const db = options.db ?? prisma;
  const types = options.types?.length ? options.types : allCriterionTypes;
  const [coachedUser] = await db.$queryRawUnsafe<CoachedUserRow[]>(
    "SELECT id, country, teamId, firstName, lastName FROM `User` WHERE id = ? AND active = TRUE LIMIT 1",
    userId
  );
  if (!coachedUser) return [];

  const scopeKeys = [
    criterionScopeKey("GLOBAL"),
    criterionScopeKey("COUNTRY", { country: coachedUser.country }),
    ...(coachedUser.teamId ? [criterionScopeKey("TEAM", { teamId: coachedUser.teamId })] : []),
    criterionScopeKey("USER", { userId: coachedUser.id }),
  ];

  const links = await listCandidateScopeLinks(db, scopeKeys, types);
  if (!links.length) return [];

  const definitions = await loadCriterionDefinitions(db, links);
  const definitionsByKey = new Map(definitions.map((definition) => [definition.criterionKey, definition]));
  const bestByCriterion = new Map<string, ApplicableCriterion>();

  for (const link of links) {
    const definition = definitionsByKey.get(link.criterionKey);
    if (!definition) continue;
    const candidate: ApplicableCriterion = {
      ...definition,
      sourceScopeLinkId: link.id,
      appliedScopeType: link.scopeType,
      appliedScopeKey: link.scopeKey,
      appliedScopeLabel: scopeLabel(link),
      sortOrder: Number(link.sortOrder),
    };
    const current = bestByCriterion.get(definition.criterionKey);
    if (!current || isMoreSpecific(candidate, current)) {
      bestByCriterion.set(definition.criterionKey, candidate);
    }
  }

  return sortApplicableCriteria([...bestByCriterion.values()]);
}

export async function ensureCriterionSnapshotsForIntervention(
  db: Queryable,
  interventionId: string,
  coachedUserId: string
) {
  const existing = await db.$queryRawUnsafe<{ count: bigint | number }[]>(
    "SELECT COUNT(*) AS count FROM `CoachingCriterionSnapshot` WHERE `interventionId` = ?",
    interventionId
  );
  if (Number(existing[0]?.count ?? 0) > 0) return;

  const criteria = await listApplicableCriteriaForUser(coachedUserId, { db });
  for (const criterion of criteria) {
    await db.$executeRawUnsafe(
      `INSERT INTO \`CoachingCriterionSnapshot\` (
        \`id\`, \`interventionId\`, \`criterionType\`, \`sourceCriterionId\`, \`sourceCriterionKey\`,
        \`sourceScopeLinkId\`, \`title\`, \`description\`, \`focusName\`, \`section\`, \`answerType\`,
        \`scoreType\`, \`minScore\`, \`maxScore\`, \`weight\`, \`targetValue\`, \`required\`,
        \`appliedScopeType\`, \`appliedScopeKey\`, \`appliedScopeLabel\`, \`sortOrder\`, \`snapshotVersion\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE \`id\` = \`id\``,
      `snapshot-${randomUUID()}`,
      interventionId,
      criterion.criterionType,
      criterion.sourceCriterionId,
      criterion.criterionKey,
      criterion.sourceScopeLinkId,
      criterion.title,
      criterion.description,
      criterion.focusName,
      criterion.section,
      criterion.answerType,
      criterion.scoreType,
      criterion.minScore,
      criterion.maxScore,
      criterion.weight,
      criterion.targetValue,
      criterion.required,
      criterion.appliedScopeType,
      criterion.appliedScopeKey,
      criterion.appliedScopeLabel,
      criterion.sortOrder
    );
  }
}

export async function listCriterionSnapshotsForInterventions(
  interventionIds: string[],
  options: { db?: Queryable } = {}
) {
  if (!interventionIds.length) return [];
  const db = options.db ?? prisma;
  const placeholders = interventionIds.map(() => "?").join(",");
  return db.$queryRawUnsafe<CriterionSnapshotRow[]>(
    `SELECT
      \`id\`,
      \`interventionId\`,
      \`criterionType\`,
      \`sourceCriterionId\`,
      \`sourceCriterionKey\` AS \`criterionKey\`,
      \`sourceScopeLinkId\`,
      \`title\`,
      \`description\`,
      \`focusName\`,
      \`section\`,
      \`answerType\`,
      \`scoreType\`,
      \`minScore\`,
      \`maxScore\`,
      \`weight\`,
      \`targetValue\`,
      \`required\`,
      \`appliedScopeType\`,
      \`appliedScopeKey\`,
      \`appliedScopeLabel\`,
      \`sortOrder\`,
      \`snapshotVersion\`,
      \`createdAt\`
    FROM \`CoachingCriterionSnapshot\`
    WHERE \`interventionId\` IN (${placeholders})
    ORDER BY \`interventionId\`, FIELD(\`appliedScopeType\`, 'GLOBAL', 'COUNTRY', 'TEAM', 'USER'), \`sortOrder\`, \`title\`, \`sourceCriterionId\``,
    ...interventionIds
  );
}

async function listCandidateScopeLinks(db: Queryable, scopeKeys: string[], types: CriterionType[]) {
  const scopePlaceholders = scopeKeys.map(() => "?").join(",");
  const typePlaceholders = types.map(() => "?").join(",");
  return db.$queryRawUnsafe<ScopeLinkRow[]>(
    `SELECT
      link.\`id\`,
      link.\`criterionType\`,
      link.\`criterionKey\`,
      link.\`kpiDefinitionId\`,
      link.\`coachingCriterionId\`,
      link.\`configurableCriterionId\`,
      link.\`scopeType\`,
      link.\`scopeKey\`,
      link.\`country\`,
      link.\`teamId\`,
      link.\`userId\`,
      link.\`sortOrder\`,
      team.\`name\` AS \`teamName\`,
      scopedUser.\`firstName\` AS \`userFirstName\`,
      scopedUser.\`lastName\` AS \`userLastName\`
    FROM \`CriterionScopeLink\` link
    LEFT JOIN \`Team\` team ON team.\`id\` = link.\`teamId\`
    LEFT JOIN \`User\` scopedUser ON scopedUser.\`id\` = link.\`userId\`
    WHERE link.\`scopeKey\` IN (${scopePlaceholders})
      AND link.\`criterionType\` IN (${typePlaceholders})`,
    ...scopeKeys,
    ...types
  );
}

async function loadCriterionDefinitions(db: Queryable, links: ScopeLinkRow[]) {
  const definitions: CriterionDefinition[] = [];
  definitions.push(...await loadConfigurableDefinitions(db, links));
  definitions.push(...await loadCoatRackDefinitions(db, links));
  definitions.push(...await loadKpiDefinitions(db, links));
  return definitions;
}

async function loadConfigurableDefinitions(db: Queryable, links: ScopeLinkRow[]) {
  const ids = [...new Set(links.flatMap((link) => link.configurableCriterionId ? [link.configurableCriterionId] : []))];
  if (!ids.length) return [];
  const rows = await db.$queryRawUnsafe<{
    id: string;
    type: CriterionType;
    title: string;
    description: string | null;
    section: string | null;
    answerType: string;
    scoreType: string;
    minScore: number;
    maxScore: number;
    weight: number | null;
    targetValue: number | null;
    required: boolean | number;
  }[]>(
    `SELECT id, type, title, description, section, answerType, scoreType, minScore, maxScore, weight, targetValue, required
     FROM \`ConfigurableCriterion\`
     WHERE active = TRUE AND id IN (${ids.map(() => "?").join(",")})`,
    ...ids
  );
  return rows.map((row): CriterionDefinition => ({
    sourceCriterionId: row.id,
    criterionKey: `${row.type}:${row.id}`,
    criterionType: row.type,
    title: row.title,
    description: row.description,
    focusName: null,
    section: row.section,
    answerType: row.answerType,
    scoreType: row.scoreType,
    minScore: Number(row.minScore),
    maxScore: Number(row.maxScore),
    weight: row.weight === null ? null : Number(row.weight),
    targetValue: row.targetValue === null ? null : Number(row.targetValue),
    required: Boolean(row.required),
  }));
}

async function loadCoatRackDefinitions(db: Queryable, links: ScopeLinkRow[]) {
  const ids = [...new Set(links.flatMap((link) => link.coachingCriterionId ? [link.coachingCriterionId] : []))];
  if (!ids.length) return [];
  const rows = await db.$queryRawUnsafe<{
    id: string;
    name: string;
    focusName: string;
  }[]>(
    `SELECT criterion.id, criterion.name, focus.name AS focusName
     FROM \`CoachingCriterion\` criterion
     INNER JOIN \`CoachingFocus\` focus ON focus.id = criterion.focusId
     WHERE criterion.active = TRUE AND focus.active = TRUE AND criterion.id IN (${ids.map(() => "?").join(",")})`,
    ...ids
  );
  return rows.map((row): CriterionDefinition => ({
    sourceCriterionId: row.id,
    criterionKey: `COAT_RACK:${row.id}`,
    criterionType: "COAT_RACK",
    title: row.name,
    description: null,
    focusName: row.focusName,
    section: "Kapstok",
    answerType: "SCORE_0_100",
    scoreType: "SCORE",
    minScore: 0,
    maxScore: 100,
    weight: null,
    targetValue: null,
    required: false,
  }));
}

async function loadKpiDefinitions(db: Queryable, links: ScopeLinkRow[]) {
  const ids = [...new Set(links.flatMap((link) => link.kpiDefinitionId ? [link.kpiDefinitionId] : []))];
  if (!ids.length) return [];
  const rows = await db.$queryRawUnsafe<{
    id: string;
    name: string;
    description: string | null;
    unit: string;
    minValue: string | number | null;
    maxValue: string | number | null;
    weight: string | number | null;
    targetValue: string | number | null;
  }[]>(
    `SELECT
       id,
       name,
       description,
       unit,
       CAST(\`minValue\` AS CHAR) AS \`minValue\`,
       CAST(\`maxValue\` AS CHAR) AS \`maxValue\`,
       CAST(weight AS CHAR) AS weight,
       CAST(\`targetValue\` AS CHAR) AS \`targetValue\`
     FROM \`KpiDefinition\`
     WHERE active = TRUE AND id IN (${ids.map(() => "?").join(",")})`,
    ...ids
  );
  return rows.map((row): CriterionDefinition => ({
    sourceCriterionId: row.id,
    criterionKey: `KPI:${row.id}`,
    criterionType: "KPI",
    title: row.name,
    description: row.description,
    focusName: null,
    section: "KPI's",
    answerType: row.unit,
    scoreType: "KPI",
    minScore: nullableNumber(row.minValue),
    maxScore: nullableNumber(row.maxValue),
    weight: nullableNumber(row.weight),
    targetValue: nullableNumber(row.targetValue),
    required: false,
  }));
}

function nullableNumber(value: string | number | null) {
  if (value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isMoreSpecific(candidate: ApplicableCriterion, current: ApplicableCriterion) {
  const candidatePriority = scopePriority[candidate.appliedScopeType];
  const currentPriority = scopePriority[current.appliedScopeType];
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority;
  if (candidate.sortOrder !== current.sortOrder) return candidate.sortOrder < current.sortOrder;
  return candidate.sourceScopeLinkId.localeCompare(current.sourceScopeLinkId) < 0;
}

function scopeLabel(link: ScopeLinkRow) {
  if (link.scopeType === "GLOBAL") return "Globaal";
  if (link.scopeType === "COUNTRY") return `Land: ${link.country ?? link.scopeKey.replace("COUNTRY:", "")}`;
  if (link.scopeType === "TEAM") return `Team: ${link.teamName ?? link.scopeKey.replace("TEAM:", "")}`;
  const name = `${link.userFirstName ?? ""} ${link.userLastName ?? ""}`.trim();
  return `Gebruiker: ${name || link.scopeKey.replace("USER:", "")}`;
}
