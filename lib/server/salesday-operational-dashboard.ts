import {
  ErpOutboxStatus,
  ErpReconciliationIncidentStatus,
  InventoryConsumablesRequestStatus,
  InventoryReplenishmentStatus,
  Prisma,
  SalesAppointmentStatus,
  SalesDocumentDeliveryStatus,
  SalesDocumentStatus,
  SalesDocumentType,
  type Country as PrismaCountry,
} from "@prisma/client";

import { can, canAccessSalesday } from "@/lib/permissions";
import {
  evaluateSalesDayProductionReadiness,
  parseSalesDayPowerBiSetting,
  serializeSalesDayPowerBiSetting,
  summarizeReadiness,
  type SalesDayPowerBiLinkInput,
} from "@/lib/salesday/operational-dashboard";
import type { SalesErpProvider } from "@/lib/server/integrations/sales-erp";
import { prismaSalesErpProvider, SalesErpError } from "@/lib/server/integrations/sales-erp";
import { salesDayBusinessDate } from "@/lib/server/salesday-customer-access";
import { getSalesDayFeatureAccess, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { prisma } from "@/lib/server/db";
import type { MockUser } from "@/lib/types";

export const salesDayPowerBiSettingKey = "salesday.powerbi.v1";
export const salesDayProductionReadinessEvidenceSettingKey = "salesday.productionReadiness.v1";
type SalesDayRuntimeEnvironment = Parameters<typeof getSalesDayRuntimeConfiguration>[0];

const openOutboxStatuses = [
  ErpOutboxStatus.PENDING,
  ErpOutboxStatus.PROCESSING,
  ErpOutboxStatus.RETRYABLE,
];

export async function getSalesDayOperationalDashboard(input: {
  actor: MockUser;
  provider: SalesErpProvider;
  businessDate?: string;
  now?: Date;
  runtimeEnvironment?: SalesDayRuntimeEnvironment;
}) {
  if (!canAccessSalesday(input.actor)) denied("Je hebt geen toegang tot SalesDay.");
  const businessDate = input.businessDate ?? salesDayBusinessDate(input.actor, input.now);
  assertBusinessDate(businessDate);
  const date = dateOnly(businessDate);
  const provider = prismaSalesErpProvider(input.provider);
  const userScope = scopedRepresentativeUserWhere(input.actor);
  const appointmentWhere: Prisma.SalesAppointmentWhereInput = { businessDate: date, representative: { is: userScope } };
  const documentWhere: Prisma.SalesDocumentWhereInput = { businessDate: date, representative: { is: userScope } };
  const cashWhere: Prisma.SalesCashBalanceWhereInput = { representative: { is: userScope } };
  const openCommandWhere: Prisma.ErpOutboxCommandWhereInput = {
    provider,
    status: { in: openOutboxStatuses },
    actor: { is: userScope },
  };
  const openIncidentWhere: Prisma.ErpReconciliationIncidentWhereInput = input.actor.role === "REPRESENTATIVE"
    ? {
      provider,
      status: ErpReconciliationIncidentStatus.OPEN,
      command: { is: { actorUserId: input.actor.id } },
    }
    : {
      provider,
      status: ErpReconciliationIncidentStatus.OPEN,
      OR: [
        { command: { is: { actor: { is: userScope } } } },
        { commandId: null },
      ],
    };
  const todayCommandWhere: Prisma.ErpOutboxCommandWhereInput = {
    provider,
    businessDate: date,
    actor: { is: userScope },
  };
  const today = new Date(`${businessDate}T00:00:00.000Z`);
  const expiryHorizon = new Date(today);
  expiryHorizon.setUTCDate(expiryHorizon.getUTCDate() + 180);

  const [
    appointmentsByStatus,
    documentsByType,
    documentsByStatus,
    documentsByDelivery,
    documentTotals,
    closures,
    nonZeroCashBalances,
    cashBalances,
    expiringOwnStock,
    replenishmentsOpen,
    consumablesOpen,
    todayCommandsByStatus,
    openCommandCount,
    openIncidentCount,
    lastReplicaSync,
    features,
    runtime,
    powerBi,
    readinessEvidence,
    activePilotFlags,
  ] = await Promise.all([
    prisma.salesAppointment.groupBy({ by: ["status"], where: appointmentWhere, _count: { _all: true } }),
    prisma.salesDocument.groupBy({ by: ["documentType"], where: documentWhere, _count: { _all: true } }),
    prisma.salesDocument.groupBy({ by: ["status"], where: documentWhere, _count: { _all: true } }),
    prisma.salesDocument.groupBy({ by: ["deliveryStatus"], where: documentWhere, _count: { _all: true } }),
    prisma.salesDocument.aggregate({ where: documentWhere, _sum: { amountIncludingVat: true }, _count: { _all: true } }),
    prisma.salesDayClosure.count({ where: { businessDate: date, representative: { is: userScope } } }),
    prisma.salesCashBalance.count({ where: { ...cashWhere, confirmedBalance: { not: new Prisma.Decimal(0) } } }),
    prisma.salesCashBalance.count({ where: cashWhere }),
    prisma.inventoryBalance.count({
      where: {
        quantity: { gt: new Prisma.Decimal(0) },
        expiryDate: { not: null, lte: expiryHorizon },
        location: {
          archived: false,
          type: "REPRESENTATIVE_VEHICLE",
          representative: { is: userScope },
        },
      },
    }),
    prisma.inventoryReplenishment.count({
      where: {
        status: { in: [InventoryReplenishmentStatus.IN_TRANSIT, InventoryReplenishmentStatus.PARTIALLY_RECEIVED] },
        representative: { is: userScope },
      },
    }),
    prisma.inventoryConsumablesRequest.count({
      where: {
        status: { in: [InventoryConsumablesRequestStatus.SUBMITTED, InventoryConsumablesRequestStatus.REJECTED] },
        actor: { is: userScope },
      },
    }),
    prisma.erpOutboxCommand.groupBy({ by: ["status"], where: todayCommandWhere, _count: { _all: true } }),
    prisma.erpOutboxCommand.count({ where: openCommandWhere }),
    prisma.erpReconciliationIncident.count({ where: openIncidentWhere }),
    prisma.erpReplicaCheckpoint.findFirst({
      where: { provider },
      orderBy: { lastSuccessfulSyncAt: "desc" },
      select: { lastSuccessfulSyncAt: true, streamKey: true, scopeKey: true },
    }),
    getSalesDayFeatureAccess(input.actor),
    getSalesDayRuntimeConfiguration(input.runtimeEnvironment),
    getSalesDayPowerBiLink(),
    getSalesDayProductionReadinessEvidence(),
    prisma.salesDayFeatureFlag.count({ where: { enabled: true } }),
  ]);

  const appointmentCounts = enumCounts(SalesAppointmentStatus, appointmentsByStatus, "status");
  const documentTypeCounts = enumCounts(SalesDocumentType, documentsByType, "documentType");
  const documentStatusCounts = enumCounts(SalesDocumentStatus, documentsByStatus, "status");
  const documentDeliveryCounts = enumCounts(SalesDocumentDeliveryStatus, documentsByDelivery, "deliveryStatus");
  const todayCommandCounts = enumCounts(ErpOutboxStatus, todayCommandsByStatus, "status");
  const openAppointmentCount = appointmentCounts.PLANNED;
  const operationalWarnings = [
    ...(openCommandCount > 0 ? [{ code: "OPEN_SYNC", severity: "ATTENTION" as const, label: "Open synchronisatie", detail: `${openCommandCount} ERP-commando('s) staan nog open.` }] : []),
    ...(openIncidentCount > 0 ? [{ code: "OPEN_INCIDENT", severity: "BLOCKED" as const, label: "Open incident", detail: `${openIncidentCount} reconciliation incident(en) staan open.` }] : []),
    ...(nonZeroCashBalances > 0 ? [{ code: "CASH_NON_ZERO", severity: "ATTENTION" as const, label: "Kassaldo", detail: `${nonZeroCashBalances} bevestigd kassaldo('s) staan niet op nul.` }] : []),
    ...(expiringOwnStock > 0 ? [{ code: "EXPIRY_WARNING", severity: "ATTENTION" as const, label: "Vervaldatum", detail: `${expiringOwnStock} voorraadlijn(en) vallen binnen de 180-dagen waarschuwing.` }] : []),
  ];
  const readinessChecks = can(input.actor, "salesday.integration.monitor") || can(input.actor, "salesday.settings.manage")
    ? evaluateSalesDayProductionReadiness({
      salesdayFeatureEnabled: features.SALESDAY.enabled,
      inventoryFeatureEnabled: features.INVENTORY.enabled,
      offlineCommandsEnabled: features.OFFLINE_COMMANDS.enabled,
      erpWritesEnabled: features.ERP_WRITES.enabled,
      runtimeProvider: runtime.provider,
      powerBiConfigured: powerBi.configured,
      openIncidentCount,
      openOutboxCommandCount: openCommandCount,
      runtimeEnvironment: input.runtimeEnvironment ?? process.env.NODE_ENV,
      externalEvidence: readinessEvidence,
    })
    : [];

  return {
    businessDate,
    provider: input.provider,
    scope: input.actor.role === "REPRESENTATIVE" ? "OWN" : "MANAGEMENT",
    generatedAt: (input.now ?? new Date()).toISOString(),
    indicators: {
      appointments: {
        total: sumCounts(appointmentCounts),
        open: openAppointmentCount,
        completed: appointmentCounts.COMPLETED,
        notCompleted: appointmentCounts.NOT_COMPLETED,
        moved: appointmentCounts.MOVED,
        cancelled: appointmentCounts.CANCELLED,
      },
      documents: {
        total: documentTotals._count._all,
        amountIncludingVat: documentTotals._sum.amountIncludingVat?.toFixed(4) ?? "0.0000",
        byType: documentTypeCounts,
        byStatus: documentStatusCounts,
        byDeliveryStatus: documentDeliveryCounts,
      },
      cash: {
        balanceCount: cashBalances,
        nonZeroBalanceCount: nonZeroCashBalances,
      },
      inventory: {
        expiringOwnStockCount: expiringOwnStock,
        openReplenishmentCount: replenishmentsOpen,
        openConsumablesRequestCount: consumablesOpen,
      },
      sync: {
        todayCommands: todayCommandCounts,
        openCommandCount,
        openIncidentCount,
        lastReplicaSyncAt: lastReplicaSync?.lastSuccessfulSyncAt.toISOString() ?? null,
        lastReplicaStreamKey: lastReplicaSync?.streamKey ?? null,
      },
      dayClosure: {
        closedRepresentativeCount: closures,
      },
      pilot: {
        activeFlagCount: activePilotFlags,
        featureAccess: features,
      },
    },
    warnings: operationalWarnings,
    powerBi,
    readiness: readinessChecks.length
      ? { status: summarizeReadiness(readinessChecks), checks: readinessChecks }
      : null,
  };
}

export async function getSalesDayPowerBiLink() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: salesDayPowerBiSettingKey },
    select: { value: true, updatedAt: true },
  });
  const parsed = parseSalesDayPowerBiSetting(setting?.value);
  return {
    ...parsed,
    updatedAt: parsed.updatedAt ?? setting?.updatedAt.toISOString() ?? null,
  };
}

export async function setSalesDayPowerBiLink(actor: MockUser, input: SalesDayPowerBiLinkInput) {
  if (!can(actor, "salesday.settings.manage")) denied("Je hebt geen recht om de SalesDay Power BI-link te beheren.");
  const value = serializeSalesDayPowerBiSetting(input);
  return prisma.$transaction(async (tx) => {
    const previous = await tx.appSetting.findUnique({ where: { key: salesDayPowerBiSettingKey } });
    const setting = await tx.appSetting.upsert({
      where: { key: salesDayPowerBiSettingKey },
      update: { value, updatedById: actor.id },
      create: { key: salesDayPowerBiSettingKey, value, updatedById: actor.id },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        entityType: "AppSetting",
        entityId: setting.id,
        action: "salesday.powerbi.set",
        oldValue: previous?.value ?? null,
        newValue: value,
      },
    });
    return parseSalesDayPowerBiSetting(value);
  });
}

async function getSalesDayProductionReadinessEvidence() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: salesDayProductionReadinessEvidenceSettingKey },
    select: { value: true },
  });
  if (!setting?.value) return {};
  try {
    const parsed = JSON.parse(setting.value) as Partial<Record<"realErp" | "uat" | "migration" | "backupRestore" | "mdmDeviceLoss", boolean>>;
    return parsed;
  } catch {
    return {};
  }
}

function scopedRepresentativeUserWhere(actor: MockUser): Prisma.UserWhereInput {
  if (actor.role === "REPRESENTATIVE") return { id: actor.id };
  if (actor.role === "SALES_LEADER") return actor.teamId ? { teamId: actor.teamId, role: "REPRESENTATIVE" } : noUsers();
  if (actor.role === "SALES_MANAGER") {
    const countries = actor.countryAccess ?? [];
    return countries.length ? { country: { in: countries as PrismaCountry[] }, role: "REPRESENTATIVE" } : noUsers();
  }
  if (actor.role === "COUNTRY_MANAGER" || actor.role === "ADMIN") return { country: actor.country as PrismaCountry, role: "REPRESENTATIVE" };
  if (actor.role === "GROUP_MANAGER" || actor.role === "SUPER_ADMIN") return { role: "REPRESENTATIVE" };
  return noUsers();
}

function noUsers(): Prisma.UserWhereInput {
  return { id: "__no_salesday_scope__" };
}

function enumCounts<T extends string, Row extends Record<Key, T> & { _count: { _all: number } }, Key extends string>(
  values: Record<string, T>,
  rows: Row[],
  key: Key,
) {
  const result = Object.fromEntries(Object.values(values).map((value) => [value, 0])) as Record<T, number>;
  for (const row of rows) result[row[key]] = row._count._all;
  return result;
}

function sumCounts(values: Record<string, number>) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

function assertBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("businessDate moet YYYY-MM-DD gebruiken.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid("businessDate is geen geldige kalenderdatum.");
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function denied(message: string): never {
  throw new SalesErpError({ code: "PERMISSION_REVOKED", message });
}

function invalid(message: string): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message });
}
