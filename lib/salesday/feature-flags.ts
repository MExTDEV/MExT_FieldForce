import type { Country, MockUser } from "@/lib/types";

export const salesDayFeatureKeys = [
  "SALESDAY",
  "INVENTORY",
  "OFFLINE_COMMANDS",
  "ERP_WRITES",
] as const;

export type SalesDayFeatureKey = (typeof salesDayFeatureKeys)[number];
export type SalesDayFeatureScope = "GLOBAL" | "COUNTRY" | "TEAM" | "USER";

export type SalesDayFeatureFlagRecord = {
  key: SalesDayFeatureKey;
  scope: SalesDayFeatureScope;
  enabled: boolean;
  country?: Country | null;
  teamId?: string | null;
  userId?: string | null;
};

export type SalesDayFeatureDecision = {
  key: SalesDayFeatureKey;
  enabled: boolean;
  matchedScope: SalesDayFeatureScope | null;
  reason: "ENABLED" | "GLOBAL_DISABLED" | "TARGET_DISABLED" | "SALESDAY_DISABLED";
};

export function salesDayFeatureScopeKey(
  key: SalesDayFeatureKey,
  scope: SalesDayFeatureScope,
  targetId?: string,
) {
  const normalizedTarget = scope === "GLOBAL" ? "global" : targetId?.trim();
  if (!normalizedTarget) throw new Error(`SalesDay ${scope.toLowerCase()} target is required`);
  return `${key}:${scope}:${normalizedTarget}`;
}

export function resolveSalesDayFeature(
  flags: readonly SalesDayFeatureFlagRecord[],
  actor: Pick<MockUser, "id" | "country" | "teamId">,
  key: SalesDayFeatureKey,
): SalesDayFeatureDecision {
  if (key !== "SALESDAY") {
    const salesDay = resolveDirectFeature(flags, actor, "SALESDAY");
    if (!salesDay.enabled) {
      return { key, enabled: false, matchedScope: salesDay.matchedScope, reason: "SALESDAY_DISABLED" };
    }
  }
  return resolveDirectFeature(flags, actor, key);
}

export function resolveSalesDayFeatures(
  flags: readonly SalesDayFeatureFlagRecord[],
  actor: Pick<MockUser, "id" | "country" | "teamId">,
) {
  return Object.fromEntries(
    salesDayFeatureKeys.map((key) => [key, resolveSalesDayFeature(flags, actor, key)]),
  ) as Record<SalesDayFeatureKey, SalesDayFeatureDecision>;
}

function resolveDirectFeature(
  flags: readonly SalesDayFeatureFlagRecord[],
  actor: Pick<MockUser, "id" | "country" | "teamId">,
  key: SalesDayFeatureKey,
): SalesDayFeatureDecision {
  const global = flags.find((flag) => flag.key === key && flag.scope === "GLOBAL");
  if (!global?.enabled) {
    return { key, enabled: false, matchedScope: "GLOBAL", reason: "GLOBAL_DISABLED" };
  }

  const user = flags.find(
    (flag) => flag.key === key && flag.scope === "USER" && flag.userId === actor.id,
  );
  const team = actor.teamId
    ? flags.find(
        (flag) => flag.key === key && flag.scope === "TEAM" && flag.teamId === actor.teamId,
      )
    : undefined;
  const country = flags.find(
    (flag) => flag.key === key && flag.scope === "COUNTRY" && flag.country === actor.country,
  );
  const target = user ?? team ?? country;
  if (!target?.enabled) {
    return {
      key,
      enabled: false,
      matchedScope: target?.scope ?? null,
      reason: "TARGET_DISABLED",
    };
  }
  return { key, enabled: true, matchedScope: target.scope, reason: "ENABLED" };
}
