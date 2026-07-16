import { ErpOutboxStatus, ErpReconciliationIncidentStatus } from "@prisma/client";

import type { MockUser } from "@/lib/types";
import { prisma } from "@/lib/server/db";
import {
  assertSalesErpProvider,
  prismaSalesErpProvider,
  type SalesErpProvider,
} from "@/lib/server/integrations/sales-erp";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";

const openStatuses = [
  ErpOutboxStatus.PENDING,
  ErpOutboxStatus.PROCESSING,
  ErpOutboxStatus.RETRYABLE,
];

export async function getOwnSalesDaySyncStatus(input: {
  actor: MockUser;
  loginSessionId: string | null;
  deviceId: string;
  provider: string;
  now?: Date;
}) {
  const { deviceId } = await requireActiveSalesDayDevice(input);
  assertSalesErpProvider(input.provider);
  const provider: SalesErpProvider = input.provider;
  const prismaProvider = prismaSalesErpProvider(provider);
  const commandScope = {
    provider: prismaProvider,
    actorUserId: input.actor.id,
    deviceId,
  } as const;
  const [counts, latestStored, latestAcknowledged, oldestOpen, checkpoint, incidents, recentCommands] =
    await Promise.all([
      prisma.erpOutboxCommand.groupBy({
        by: ["status"],
        where: commandScope,
        _count: { _all: true },
      }),
      prisma.erpOutboxCommand.findFirst({
        where: commandScope,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.erpOutboxCommand.findFirst({
        where: { ...commandScope, acknowledgedAt: { not: null } },
        orderBy: { acknowledgedAt: "desc" },
        select: { acknowledgedAt: true },
      }),
      prisma.erpOutboxCommand.findFirst({
        where: { ...commandScope, status: { in: openStatuses } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.erpReplicaCheckpoint.findFirst({
        where: { provider: prismaProvider },
        orderBy: { lastSuccessfulSyncAt: "desc" },
        select: { lastSuccessfulSyncAt: true },
      }),
      prisma.erpReconciliationIncident.count({
        where: {
          provider: prismaProvider,
          status: ErpReconciliationIncidentStatus.OPEN,
          command: { is: { actorUserId: input.actor.id, deviceId } },
        },
      }),
      prisma.erpOutboxCommand.findMany({
        where: commandScope,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          commandId: true,
          commandType: true,
          status: true,
          attemptCount: true,
          createdAt: true,
          acknowledgedAt: true,
          lastErrorCode: true,
          lastErrorMessage: true,
        },
      }),
    ]);

  const byStatus = Object.fromEntries(
    Object.values(ErpOutboxStatus).map((status) => [status, 0]),
  ) as Record<ErpOutboxStatus, number>;
  for (const row of counts) byStatus[row.status] = row._count._all;

  return {
    provider,
    deviceId,
    serverNow: (input.now ?? new Date()).toISOString(),
    commands: byStatus,
    openCommandCount: openStatuses.reduce((total, status) => total + byStatus[status], 0),
    openIncidentCount: incidents,
    lastLedgerAcceptedAt: latestStored?.createdAt.toISOString() ?? null,
    lastErpAcknowledgedAt: latestAcknowledged?.acknowledgedAt?.toISOString() ?? null,
    oldestOpenCommandAt: oldestOpen?.createdAt.toISOString() ?? null,
    lastReplicaSyncAt: checkpoint?.lastSuccessfulSyncAt.toISOString() ?? null,
    recentCommands: recentCommands.map((command) => ({
      ...command,
      createdAt: command.createdAt.toISOString(),
      acknowledgedAt: command.acknowledgedAt?.toISOString() ?? null,
    })),
  };
}

export type SalesDayServerSyncStatus = Awaited<ReturnType<typeof getOwnSalesDaySyncStatus>>;
