import { ActionScope, type Priority } from "@prisma/client";

import {
  canCreateActionPointDefinition,
  canManageActionPointDefinitions,
  canManageScopedActionDefinition,
  canViewScopedActionDefinition,
  visibleActionPointCountries,
} from "@/lib/action-points/visibility";
import { sanitizeRichText } from "@/lib/rich-text";
import { actorCanAccessCountry } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import type {
  ActionPointProductOption,
  ActionPointTargetTypeOption,
  Country,
  MockUser,
  ScopedActionDefinition,
} from "@/lib/types";

type ActionDefinitionInput = {
  id?: string;
  title: string;
  description: string;
  tipsAndTricks: string;
  targetValue?: number | null;
  priority: "laag" | "normaal" | "hoog";
  scope: ActionScope;
  country?: Country;
  teamId?: string;
  userId?: string;
  validFrom: string;
  validUntil?: string;
  active?: boolean;
  productIds?: string[];
};

type ActionDefinitionWithRelations = Awaited<ReturnType<typeof findActionDefinitionForEdit>>;

export async function listEffectiveActionDefinitions(userId: string, date: Date): Promise<ScopedActionDefinition[]> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, country: true, teamId: true } });
  const keys = ["GLOBAL", `COUNTRY:${user.country}`, ...(user.teamId ? [`TEAM:${user.teamId}`] : []), `USER:${user.id}`];
  const definitions = await prisma.actionDefinition.findMany({
    where: {
      active: true,
      deletedAt: null,
      scopeKey: { in: keys },
      validFrom: { lte: date },
      OR: [{ validUntil: null }, { validUntil: { gte: date } }],
    },
    include: {
      products: { include: { product: true } },
      targetOverrides: { where: { scopeKey: { in: keys } } },
      targetType: true,
    },
    orderBy: [{ priority: "desc" }, { title: "asc" }],
  });
  return definitions.map((definition) => {
    const target = [`USER:${user.id}`, ...(user.teamId ? [`TEAM:${user.teamId}`] : []), `COUNTRY:${user.country}`]
      .map((key) => definition.targetOverrides.find((item) => item.scopeKey === key))
      .find(Boolean)?.targetValue ?? definition.targetValue;
    return serializeActionDefinition(definition, target === null ? undefined : Number(target));
  });
}

export async function listVisibleActionDefinitions(actor: MockUser) {
  const canManage = canManageActionPointDefinitions(actor);
  const today = startOfToday();
  const definitions = await prisma.actionDefinition.findMany({
    where: {
      AND: [
        { deletedAt: null },
        canManage ? {} : {
          active: true,
          validFrom: { lte: today },
          OR: [{ validUntil: null }, { validUntil: { gte: today } }],
        },
        actionDefinitionVisibilityWhere(actor),
      ],
    },
    include: {
      products: { include: { product: true } },
      targetType: true,
    },
    orderBy: [{ active: "desc" }, { priority: "desc" }, { title: "asc" }],
  });
  return definitions
    .filter((definition) =>
      canViewScopedActionDefinition(actor, {
        scope: definition.scope,
        country: definition.country ?? undefined,
        teamId: definition.teamId ?? undefined,
        userId: definition.userId ?? undefined,
        active: definition.active,
        createdById: definition.createdById,
      })
    )
    .map((definition) => serializeActionDefinition(definition));
}

export async function listActionPointTargetTypes(): Promise<ActionPointTargetTypeOption[]> {
  const targetTypes = await prisma.actionPointTargetType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return targetTypes.map((targetType) => ({
    id: targetType.id,
    code: targetType.code,
    name: targetType.name,
    description: targetType.description ?? undefined,
    isActive: targetType.isActive,
    sortOrder: targetType.sortOrder,
  }));
}

export async function listActionPointProducts(): Promise<ActionPointProductOption[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sortOrder: product.sortOrder,
    active: product.active,
  }));
}

export async function saveActionDefinition(actor: MockUser, input: ActionDefinitionInput) {
  const existing = input.id ? await findActionDefinitionForEdit(input.id) : null;
  if (existing) {
    assertCanManageActionDefinition(actor, existing);
  } else if (!canCreateActionPointDefinition(actor)) {
    throw new Error("Geen rechten om actiepunten aan te maken.");
  }

  const title = input.title.trim();
  if (!title) throw new Error("Naam is verplicht.");

  const validFrom = parseDate(input.validFrom, false);
  const validUntil = input.validUntil ? parseDate(input.validUntil, true) : null;
  if (!validFrom || (input.validUntil && !validUntil) || (validUntil && validUntil < validFrom)) {
    throw new Error("De geldigheidsperiode is ongeldig.");
  }

  const scopeData = await resolveActionScopeData(actor, input.scope, input);
  const targetType = await prisma.actionPointTargetType.findUnique({
    where: { code: input.scope },
    select: { id: true, isActive: true },
  });
  if (!targetType?.isActive) {
    throw new Error("Selecteer een geldig soort actiepunt.");
  }

  const productIds = uniqueIds(input.productIds ?? []);
  if (productIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new Error("Een of meer gekoppelde producten zijn niet actief of bestaan niet meer.");
    }
  }

  const data = {
    title,
    description: stripHtml(input.description).trim(),
    tipsAndTricks: sanitizeRichText(input.tipsAndTricks || input.description),
    targetTypeId: targetType.id,
    targetValue: input.targetValue ?? null,
    priority: toPriority(input.priority),
    scope: input.scope,
    ...scopeData,
    active: input.active ?? true,
    validFrom,
    validUntil,
    updatedById: actor.id,
  };

  return prisma.$transaction(async (tx) => {
    const definition = existing
      ? await tx.actionDefinition.update({ where: { id: existing.id }, data })
      : await tx.actionDefinition.create({ data: { ...data, createdById: actor.id } });

    await tx.actionDefinitionProduct.deleteMany({ where: { actionDefinitionId: definition.id } });
    if (productIds.length) {
      await tx.actionDefinitionProduct.createMany({
        data: productIds.map((productId) => ({ actionDefinitionId: definition.id, productId })),
      });
    }
    const saved = await tx.actionDefinition.findUniqueOrThrow({
      where: { id: definition.id },
      include: { products: { include: { product: true } }, targetType: true },
    });
    return serializeActionDefinition(saved);
  });
}

export async function softDeleteActionDefinition(actor: MockUser, id: string) {
  const item = await findActionDefinitionForEdit(id);
  assertCanManageActionDefinition(actor, item);
  const definition = await prisma.actionDefinition.update({
    where: { id },
    data: { active: false, deletedAt: new Date(), updatedById: actor.id },
    include: { products: { include: { product: true } }, targetType: true },
  });
  return serializeActionDefinition(definition);
}

export function toPriority(value: "laag" | "normaal" | "hoog"): Priority {
  return value === "hoog" ? "HIGH" : value === "laag" ? "LOW" : "NORMAL";
}

export function fromPriority(value: Priority) {
  return value === "HIGH" ? "hoog" : value === "LOW" ? "laag" : "normaal";
}

function serializeActionDefinition(
  definition: {
    id: string;
    title: string;
    description: string;
    tipsAndTricks: string;
    targetTypeId: string | null;
    targetType?: { code: ActionScope } | null;
    targetValue: { toString(): string } | number | null;
    priority: Priority;
    scope: ActionScope;
    scopeKey: string;
    country: Country | null;
    teamId: string | null;
    userId: string | null;
    active: boolean;
    validFrom: Date;
    validUntil: Date | null;
    createdById: string;
    updatedById: string;
    createdAt?: Date;
    updatedAt?: Date;
    products?: { product: { id: string; name: string; sortOrder: number; active: boolean } }[];
  },
  targetValue?: number
): ScopedActionDefinition {
  const products = [...(definition.products ?? [])]
    .map((item) => item.product)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "nl-BE"))
    .map((product) => ({
      id: product.id,
      name: product.name,
      sortOrder: product.sortOrder,
      active: product.active,
    }));
  const storedTarget = definition.targetValue === null ? undefined : Number(definition.targetValue);
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    tipsAndTricks: definition.tipsAndTricks,
    targetTypeId: definition.targetTypeId ?? undefined,
    targetTypeCode: definition.targetType?.code ?? definition.scope,
    targetValue: targetValue ?? storedTarget,
    priority: fromPriority(definition.priority),
    scope: definition.scope,
    scopeKey: definition.scopeKey,
    country: definition.country ?? undefined,
    teamId: definition.teamId ?? undefined,
    userId: definition.userId ?? undefined,
    productIds: products.map((product) => product.id),
    products,
    createdById: definition.createdById,
    updatedById: definition.updatedById,
    active: definition.active,
    validFrom: definition.validFrom.toISOString().slice(0, 10),
    validUntil: definition.validUntil?.toISOString().slice(0, 10),
    createdAt: definition.createdAt?.toISOString(),
    updatedAt: definition.updatedAt?.toISOString(),
  };
}

function actionDefinitionVisibilityWhere(actor: MockUser) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return {};

  if (actor.role === "REPRESENTATIVE") {
    return {
      OR: [
        { scope: "GLOBAL" as const },
        { scope: "USER" as const, userId: { in: [actor.id, actor.representativeId].filter(Boolean) as string[] } },
      ],
    };
  }

  if (actor.role === "SALES_LEADER") {
    return {
      OR: [
        { scope: "GLOBAL" as const },
        { scope: "COUNTRY" as const, country: actor.country },
        ...(actor.teamId
          ? [
            { scope: "TEAM" as const, teamId: actor.teamId },
            { scope: "USER" as const, teamId: actor.teamId },
          ]
          : []),
        { scope: "USER" as const, userId: actor.id },
      ],
    };
  }

  const countries = visibleActionPointCountries(actor);
  if (countries) {
    return {
      OR: [
        { scope: "GLOBAL" as const },
        { country: { in: countries } },
        { scope: "USER" as const, userId: actor.id },
      ],
    };
  }

  return {};
}

async function resolveActionScopeData(
  actor: MockUser,
  scope: ActionScope,
  input: Pick<ActionDefinitionInput, "country" | "teamId" | "userId">
) {
  if (scope === "GLOBAL") {
    assertCanCreateGlobal(actor);
    return { scopeKey: "GLOBAL", country: null, teamId: null, userId: null };
  }

  if (scope === "COUNTRY") {
    if (!input.country) throw new Error("Selecteer een land.");
    if (actor.role === "SALES_LEADER") throw new Error("Geen rechten om landactiepunten aan te maken.");
    assertCountryScope(actor, input.country);
    return { scopeKey: `COUNTRY:${input.country}`, country: input.country, teamId: null, userId: null };
  }

  if (scope === "TEAM") {
    if (!input.teamId) throw new Error("Selecteer een team.");
    if (actor.role === "SALES_LEADER") throw new Error("Geen rechten om teamactiepunten aan te maken.");
    const team = await prisma.team.findUnique({
      where: { id: input.teamId },
      select: { id: true, country: true, active: true },
    });
    if (!team?.active) throw new Error("Selecteer een actief team.");
    assertCountryScope(actor, team.country as Country);
    return { scopeKey: `TEAM:${team.id}`, country: team.country as Country, teamId: team.id, userId: null };
  }

  if (scope === "USER") {
    if (!input.userId) throw new Error("Selecteer een gebruiker.");
    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true, country: true, teamId: true, active: true },
    });
    if (!target?.active) throw new Error("Selecteer een actieve gebruiker.");
    if (actor.role === "SALES_LEADER") {
      if (target.role !== "REPRESENTATIVE" || !actor.teamId || target.teamId !== actor.teamId) {
        throw new Error("Een Verkoopleider kan alleen actiepunten aanmaken op vertegenwoordigers van het eigen team.");
      }
    } else {
      assertCountryScope(actor, target.country as Country);
    }
    return {
      scopeKey: `USER:${target.id}`,
      country: target.country as Country,
      teamId: target.teamId,
      userId: target.id,
    };
  }

  throw new Error("Selecteer een geldig soort actiepunt.");
}

async function findActionDefinitionForEdit(id: string) {
  return prisma.actionDefinition.findUniqueOrThrow({
    where: { id },
    include: { products: { include: { product: true } }, targetType: true },
  });
}

function assertCanManageActionDefinition(actor: MockUser, item: NonNullable<ActionDefinitionWithRelations>) {
  if (!canManageScopedActionDefinition(actor, {
    scope: item.scope,
    country: item.country ?? undefined,
    teamId: item.teamId ?? undefined,
    userId: item.userId ?? undefined,
    active: item.active,
    createdById: item.createdById,
  })) {
    throw new Error("Geen rechten om dit actiepunt te beheren.");
  }
}

function assertCanCreateGlobal(actor: MockUser) {
  if (["SUPER_ADMIN", "GROUP_MANAGER", "ADMIN"].includes(actor.role)) return;
  throw new Error("Geen rechten om globale actiepunten aan te maken.");
}

function assertCountryScope(actor: MockUser, country: Country) {
  if (!actorCanAccessCountry(actor, country)) {
    throw new Error("Dit actiepunt valt buiten je toegestane scope.");
  }
}

function parseDate(value: string, endOfDay: boolean) {
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function stripHtml(value: string) {
  return sanitizeRichText(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
