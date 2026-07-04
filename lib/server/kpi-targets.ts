import { prisma } from "@/lib/server/db";
import { validateKpiRange } from "@/lib/kpi-settings";
import type { Country, KpiEvaluationDirection } from "@/lib/types";

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
};

type StoredKpiTarget = {
  targetValue: unknown;
  minValue: unknown | null;
  maxValue: unknown | null;
  evaluationDirection: KpiEvaluationDirection;
};

export function resolveKpiTargetFromDefinition(
  definition: StoredKpiTarget & { targetOverrides: (StoredKpiTarget & { scopeKey: string })[] },
  context: KpiTargetContext
): KpiTargetValues {
  const priorityKeys = [
    context.userId ? `USER:${context.userId}` : undefined,
    context.teamId ? `TEAM:${context.teamId}` : undefined,
    context.country ? `COUNTRY:${context.country}` : undefined,
  ].filter((key): key is string => Boolean(key));
  const override = priorityKeys
    .map((key) => definition.targetOverrides.find((item) => item.scopeKey === key))
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
    include: { targetOverrides: true },
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
