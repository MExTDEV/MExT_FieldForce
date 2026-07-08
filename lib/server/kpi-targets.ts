import { prisma } from "@/lib/server/db";
import { kpiScopeKey, validateKpiRange } from "@/lib/kpi-settings";
import type {
  Country,
  KpiEvaluationDirection,
  KpiPeriodType,
  KpiTargetScope,
  Role,
} from "@/lib/types";

export type KpiTargetValues = {
  targetValue: number;
  minValue: number | null;
  maxValue: number | null;
  evaluationDirection: KpiEvaluationDirection;
};

export type KpiTargetContext = {
  country?: Country;
  teamId?: string;
  userId?: string;
  role?: Role;
  periodStart?: Date;
  periodEnd?: Date;
  atDate?: Date;
};

type StoredKpiTarget = {
  targetValue: unknown;
  minValue: unknown | null;
  maxValue: unknown | null;
  evaluationDirection: KpiEvaluationDirection;
};

export type StoredKpiPeriodTarget = {
  scopeKey: string;
  targetValue: unknown;
  periodStart: Date;
  periodEnd: Date;
  active: boolean;
};

export function resolveKpiTargetFromDefinition(
  definition: StoredKpiTarget & {
    targetOverrides?: (StoredKpiTarget & { scopeKey: string })[];
    targets?: StoredKpiPeriodTarget[];
  },
  context: KpiTargetContext
): KpiTargetValues {
  const priorityKeys = kpiPriorityKeys(context);
  const periodTarget = priorityKeys
    .map((key) =>
      (definition.targets ?? [])
        .filter((item) => item.scopeKey === key && item.active && kpiTargetPeriodApplies(item, context))
        .sort((left, right) => right.periodStart.getTime() - left.periodStart.getTime())[0]
    )
    .find(Boolean);
  if (periodTarget) {
    return {
      targetValue: Number(periodTarget.targetValue),
      minValue: definition.minValue === null ? null : Number(definition.minValue),
      maxValue: definition.maxValue === null ? null : Number(definition.maxValue),
      evaluationDirection: definition.evaluationDirection,
    };
  }

  const override = priorityKeys
    .map((key) => (definition.targetOverrides ?? []).find((item) => item.scopeKey === key))
    .find(Boolean);
  const source = override ?? definition;
  return {
    targetValue: Number(source.targetValue),
    minValue: source.minValue === null ? null : Number(source.minValue),
    maxValue: source.maxValue === null ? null : Number(source.maxValue),
    evaluationDirection: source.evaluationDirection,
  };
}

export async function resolveKpiTarget(
  kpiDefinitionId: string,
  context: KpiTargetContext
): Promise<KpiTargetValues> {
  const definition = await prisma.kpiDefinition.findUniqueOrThrow({
    where: { id: kpiDefinitionId },
    include: { targetOverrides: true, targets: true },
  });
  return resolveKpiTargetFromDefinition(definition, context);
}

export async function upsertKpiTargetOverride(
  kpiDefinitionId: string,
  scope: KpiTargetContext,
  values: KpiTargetValues
) {
  validateKpiRange(values.targetValue, values.minValue, values.maxValue);
  const selected = scope.userId
    ? { type: "USER" as const, key: `USER:${scope.userId}` }
    : scope.teamId
      ? { type: "TEAM" as const, key: `TEAM:${scope.teamId}` }
      : scope.country
        ? { type: "COUNTRY" as const, key: `COUNTRY:${scope.country}` }
        : undefined;
  if (!selected) throw new Error("Een land-, team- of gebruikersscope is verplicht.");
  return prisma.kpiTargetOverride.upsert({
    where: { kpiDefinitionId_scopeKey: { kpiDefinitionId, scopeKey: selected.key } },
    update: { ...values, country: scope.country, teamId: scope.teamId, userId: scope.userId },
    create: {
      kpiDefinitionId,
      scope: selected.type,
      scopeKey: selected.key,
      country: scope.country,
      teamId: scope.teamId,
      userId: scope.userId,
      ...values,
    },
  });
}

export type KpiPeriodTargetInput = {
  id?: string;
  kpiDefinitionId: string;
  targetTypeId: string;
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
  actorId: string;
};

export function kpiPriorityKeys(context: KpiTargetContext) {
  return [
    context.userId ? `USER:${context.userId}` : undefined,
    context.teamId ? `TEAM:${context.teamId}` : undefined,
    context.country ? `COUNTRY:${context.country}` : undefined,
    context.role ? `ROLE:${context.role}` : undefined,
    "GLOBAL",
  ].filter((key): key is string => Boolean(key));
}

export function kpiTargetPeriodApplies(
  target: Pick<StoredKpiPeriodTarget, "periodStart" | "periodEnd">,
  context: Pick<KpiTargetContext, "periodStart" | "periodEnd" | "atDate">
) {
  const from = context.periodStart ?? context.atDate;
  const until = context.periodEnd ?? context.atDate;
  if (!from || !until) return true;
  return target.periodStart <= until && target.periodEnd >= from;
}

export function kpiTargetPeriodsOverlap(
  left: Pick<StoredKpiPeriodTarget, "periodStart" | "periodEnd">,
  right: Pick<StoredKpiPeriodTarget, "periodStart" | "periodEnd">
) {
  return left.periodStart <= right.periodEnd && right.periodStart <= left.periodEnd;
}

export function detectKpiTargetConflicts<T extends {
  id: string;
  kpiDefinitionId: string;
  scopeKey: string;
  periodStart: Date;
  periodEnd: Date;
  active: boolean;
}>(targets: T[]) {
  const conflicted = new Set<string>();
  const activeTargets = targets.filter((target) => target.active);
  for (let leftIndex = 0; leftIndex < activeTargets.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < activeTargets.length; rightIndex++) {
      const left = activeTargets[leftIndex];
      const right = activeTargets[rightIndex];
      if (
        left.kpiDefinitionId === right.kpiDefinitionId &&
        left.scopeKey === right.scopeKey &&
        kpiTargetPeriodsOverlap(left, right)
      ) {
        conflicted.add(left.id);
        conflicted.add(right.id);
      }
    }
  }
  return conflicted;
}

export function createKpiTargetScopeKey(input: Pick<
  KpiPeriodTargetInput,
  "scope" | "country" | "teamId" | "userId" | "role"
>) {
  return kpiScopeKey(input.scope, input);
}
