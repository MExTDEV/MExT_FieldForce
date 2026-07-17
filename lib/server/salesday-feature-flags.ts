import {
  SalesDayFeatureKey as PrismaSalesDayFeatureKey,
  SalesDayFeatureScope as PrismaSalesDayFeatureScope,
  type Country as PrismaCountry,
} from "@prisma/client";

import { can } from "@/lib/permissions";
import {
  resolveSalesDayFeatures,
  salesDayFeatureKeys,
  salesDayFeatureScopeKey,
  type SalesDayFeatureFlagRecord,
  type SalesDayFeatureKey,
  type SalesDayFeatureScope,
} from "@/lib/salesday/feature-flags";
import {
  parseSalesDayRuntimeConfiguration,
  type SalesDayRuntimeConfiguration,
} from "@/lib/salesday/runtime-configuration";
import { actorCanAccessCountry } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import type { Country, MockUser } from "@/lib/types";

export const salesDayRuntimeSettingKey = "salesday.runtime.v1";

export class SalesDayFeatureError extends Error {
  constructor(
    readonly code: "FEATURE_DISABLED" | "PERMISSION_REQUIRED" | "INVALID_SCOPE" | "TARGET_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "SalesDayFeatureError";
  }
}

export async function getSalesDayFeatureAccess(actor: MockUser) {
  const flags = await prisma.salesDayFeatureFlag.findMany({
    where: {
      OR: [
        { scope: PrismaSalesDayFeatureScope.GLOBAL },
        { scope: PrismaSalesDayFeatureScope.COUNTRY, country: actor.country as PrismaCountry },
        ...(actor.teamId ? [{ scope: PrismaSalesDayFeatureScope.TEAM, teamId: actor.teamId }] : []),
        { scope: PrismaSalesDayFeatureScope.USER, userId: actor.id },
      ],
    },
  });
  return resolveSalesDayFeatures(flags.map(toFeatureRecord), actor);
}

export async function assertSalesDayFeatureEnabled(actor: MockUser, key: SalesDayFeatureKey) {
  const decision = (await getSalesDayFeatureAccess(actor))[key];
  if (!decision.enabled) {
    throw new SalesDayFeatureError("FEATURE_DISABLED", "Deze SalesDay-functie is niet geactiveerd voor je scope.");
  }
  return decision;
}

export async function getSalesDayRuntimeConfiguration(
  runtimeEnvironment = process.env.NODE_ENV,
) {
  const setting = await prisma.appSetting.findUnique({
    where: { key: salesDayRuntimeSettingKey },
    select: { value: true },
  });
  return parseSalesDayRuntimeConfiguration(setting?.value, runtimeEnvironment);
}

export async function listSalesDayFeatureFlags(actor: MockUser) {
  requireSettingsPermission(actor);
  return prisma.salesDayFeatureFlag.findMany({
    orderBy: [{ key: "asc" }, { scope: "asc" }, { scopeKey: "asc" }],
  });
}

export async function setSalesDayFeatureFlag(
  actor: MockUser,
  input: {
    key: SalesDayFeatureKey;
    scope: SalesDayFeatureScope;
    enabled: boolean;
    country?: Country;
    teamId?: string;
    userId?: string;
  },
) {
  requireSettingsPermission(actor);
  if (
    !salesDayFeatureKeys.includes(input.key) ||
    !(["GLOBAL", "COUNTRY", "TEAM", "USER"] as const).includes(input.scope)
  ) {
    invalidScope();
  }
  const target = await validateTarget(actor, input);
  const scopeKey = salesDayFeatureScopeKey(input.key, input.scope, target.targetId);
  return prisma.$transaction(async (tx) => {
    const previous = await tx.salesDayFeatureFlag.findUnique({ where: { scopeKey } });
    const flag = await tx.salesDayFeatureFlag.upsert({
      where: { scopeKey },
      update: { enabled: input.enabled, updatedById: actor.id },
      create: {
        key: input.key as PrismaSalesDayFeatureKey,
        scope: input.scope as PrismaSalesDayFeatureScope,
        scopeKey,
        enabled: input.enabled,
        country: target.country as PrismaCountry | undefined,
        teamId: target.teamId,
        userId: target.userId,
        updatedById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        entityType: "SalesDayFeatureFlag",
        entityId: flag.id,
        action: "salesday.feature.set",
        oldValue: previous ? JSON.stringify({ enabled: previous.enabled }) : null,
        newValue: JSON.stringify({ key: input.key, scope: input.scope, ...target, enabled: flag.enabled }),
      },
    });
    return flag;
  });
}

export async function setSalesDayRuntimeConfiguration(
  actor: MockUser,
  configuration: SalesDayRuntimeConfiguration,
  runtimeEnvironment = process.env.NODE_ENV,
) {
  requireSettingsPermission(actor);
  const normalized = parseSalesDayRuntimeConfiguration(JSON.stringify(configuration), runtimeEnvironment);
  const value = JSON.stringify(normalized);
  return prisma.$transaction(async (tx) => {
    const previous = await tx.appSetting.findUnique({ where: { key: salesDayRuntimeSettingKey } });
    const setting = await tx.appSetting.upsert({
      where: { key: salesDayRuntimeSettingKey },
      update: { value, updatedById: actor.id },
      create: { key: salesDayRuntimeSettingKey, value, updatedById: actor.id },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        entityType: "AppSetting",
        entityId: setting.id,
        action: "salesday.runtime.set",
        oldValue: previous?.value ?? null,
        newValue: value,
      },
    });
    return normalized;
  });
}

function requireSettingsPermission(actor: MockUser) {
  if (!can(actor, "salesday.settings.manage")) {
    throw new SalesDayFeatureError("PERMISSION_REQUIRED", "Je hebt geen recht om SalesDay-activatie te beheren.");
  }
}

async function validateTarget(
  actor: MockUser,
  input: { scope: SalesDayFeatureScope; country?: Country; teamId?: string; userId?: string },
) {
  if (input.scope === "GLOBAL") {
    if (input.country || input.teamId || input.userId) invalidScope();
    return { targetId: undefined, country: undefined, teamId: undefined, userId: undefined };
  }
  if (input.scope === "COUNTRY") {
    if (!input.country || input.teamId || input.userId || !actorCanAccessCountry(actor, input.country)) invalidScope();
    return { targetId: input.country, country: input.country, teamId: undefined, userId: undefined };
  }
  if (input.scope === "TEAM") {
    if (!input.teamId || input.country || input.userId) invalidScope();
    const team = await prisma.team.findUnique({ where: { id: input.teamId }, select: { id: true, country: true } });
    if (!team) throw new SalesDayFeatureError("TARGET_NOT_FOUND", "SalesDay-teamdoel bestaat niet.");
    if (!actorCanAccessCountry(actor, team.country)) invalidScope();
    return { targetId: team.id, country: undefined, teamId: team.id, userId: undefined };
  }
  if (!input.userId || input.country || input.teamId) invalidScope();
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, country: true } });
  if (!user) throw new SalesDayFeatureError("TARGET_NOT_FOUND", "SalesDay-gebruikersdoel bestaat niet.");
  if (!actorCanAccessCountry(actor, user.country)) invalidScope();
  return { targetId: user.id, country: undefined, teamId: undefined, userId: user.id };
}

function invalidScope(): never {
  throw new SalesDayFeatureError("INVALID_SCOPE", "De SalesDay-vlag bevat een ongeldige of verboden scope.");
}

function toFeatureRecord(flag: {
  key: PrismaSalesDayFeatureKey;
  scope: PrismaSalesDayFeatureScope;
  enabled: boolean;
  country: PrismaCountry | null;
  teamId: string | null;
  userId: string | null;
}): SalesDayFeatureFlagRecord {
  return {
    key: flag.key as SalesDayFeatureKey,
    scope: flag.scope as SalesDayFeatureScope,
    enabled: flag.enabled,
    country: flag.country as Country | null,
    teamId: flag.teamId,
    userId: flag.userId,
  };
}
