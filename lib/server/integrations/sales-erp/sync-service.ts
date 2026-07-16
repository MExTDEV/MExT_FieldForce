import {
  ErpInboxStatus,
  ErpOutboxStatus,
  ErpReconciliationIncidentStatus,
  ErpReconciliationIncidentType,
} from "@prisma/client";

import { prisma } from "@/lib/server/db";

import { assertSalesErpAcknowledgement, salesErpAcknowledgementUpdate } from "./acknowledgements";
import type { SalesErpProvider } from "./contracts";
import { SalesErpError } from "./errors";
import {
  createSalesErpIncidentKey,
  getSalesErpCheckpoint,
  persistSalesErpEventPage,
  recordSalesErpIncident,
} from "./ledger";
import type { SalesErpPort } from "./port";
import { deserializeSalesErpCommand } from "./serialization";
import {
  nextSalesErpRetryAt,
  normalizeSalesErpWorkerPolicy,
  prismaSalesErpProvider,
  salesErpErrorDetails,
  type SalesErpWorkerPolicy,
} from "./worker-utils";

export async function pullSalesErpEvents(input: {
  port: SalesErpPort;
  streamKey?: string;
  scopeKey?: string;
  limit?: number;
  now?: Date;
}) {
  const streamKey = input.streamKey ?? "events";
  const scopeKey = input.scopeKey ?? "global";
  const checkpoint = await getSalesErpCheckpoint({
    provider: input.port.provider,
    streamKey,
    scopeKey,
  });
  const page = await input.port.getEvents({ cursor: checkpoint?.cursor, limit: input.limit });
  if (page.provider !== input.port.provider) {
    throw new SalesErpError({
      code: "PROVIDER_REJECTED",
      message: "ERP event page provider does not match the configured adapter",
      retryable: true,
    });
  }

  try {
    return await persistSalesErpEventPage({
      page,
      streamKey,
      scopeKey,
      syncedAt: input.now,
    });
  } catch (error) {
    const details = salesErpErrorDetails(error);
    const type =
      details.code === "EVENT_PAYLOAD_CONFLICT"
        ? ErpReconciliationIncidentType.EVENT_PAYLOAD_CONFLICT
        : ErpReconciliationIncidentType.PROVIDER_ERROR;
    await recordSalesErpIncident({
      provider: input.port.provider,
      type,
      deduplicationKey: createSalesErpIncidentKey("event-pull", {
        provider: input.port.provider,
        streamKey,
        scopeKey,
        cursor: checkpoint?.cursor,
        code: details.code,
      }),
      summary: `ERP event stream ${streamKey} could not be persisted`,
      details,
    });
    throw error;
  }
}

export async function reconcileSalesErpCommands(input: {
  port: SalesErpPort;
  limit?: number;
  since?: Date;
  now?: Date;
  policy?: SalesErpWorkerPolicy;
}) {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 200;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new SalesErpError({ code: "INVALID_CONTRACT", message: "Reconciliation limit must be 1 to 500" });
  }
  const policy = normalizeSalesErpWorkerPolicy(input.policy);
  const candidates = await prisma.erpOutboxCommand.findMany({
    where: {
      provider: prismaSalesErpProvider(input.port.provider),
      attemptCount: { gt: 0 },
      OR: [
        { status: ErpOutboxStatus.RETRYABLE },
        { status: ErpOutboxStatus.PROCESSING, leaseExpiresAt: { lte: now } },
      ],
    },
    include: { dependencies: { select: { dependsOnCommandId: true } } },
    orderBy: [{ lastAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
  if (!candidates.length) return { checked: 0, accepted: 0, rejected: 0, retryable: 0, unknown: 0 };

  let result;
  try {
    result = await input.port.reconcile({
      commandIds: candidates.map((item) => item.commandId),
      since: input.since?.toISOString(),
    });
  } catch (error) {
    const details = salesErpErrorDetails(error);
    await recordSalesErpIncident({
      provider: input.port.provider,
      type: ErpReconciliationIncidentType.PROVIDER_ERROR,
      deduplicationKey: createSalesErpIncidentKey("reconciliation-provider", {
        provider: input.port.provider,
        commandIds: candidates.map((item) => item.commandId),
        code: details.code,
      }),
      summary: "ERP command reconciliation failed",
      details,
    });
    throw error;
  }
  if (result.provider !== input.port.provider) {
    throw new SalesErpError({
      code: "PROVIDER_REJECTED",
      message: "ERP reconciliation result came from another provider",
      retryable: true,
    });
  }

  const byCommandId = new Map(candidates.map((item) => [item.commandId, item]));
  let accepted = 0;
  let rejected = 0;
  let retryable = 0;
  for (const acknowledgement of result.acknowledgements) {
    const row = byCommandId.get(acknowledgement.commandId);
    if (!row) {
      await recordSalesErpIncident({
        provider: input.port.provider,
        type: ErpReconciliationIncidentType.ACKNOWLEDGEMENT_MISMATCH,
        deduplicationKey: createSalesErpIncidentKey("unexpected-ack", {
          provider: input.port.provider,
          commandId: acknowledgement.commandId,
        }),
        summary: `ERP returned an acknowledgement for unrequested command ${acknowledgement.commandId}`,
        details: acknowledgement,
      });
      continue;
    }

    try {
      const command = deserializeSalesErpCommand(row);
      assertSalesErpAcknowledgement(input.port.provider, command, acknowledgement);
      const updated = await prisma.erpOutboxCommand.updateMany({
        where: {
          id: row.id,
          OR: [
            { status: ErpOutboxStatus.RETRYABLE },
            { status: ErpOutboxStatus.PROCESSING, leaseExpiresAt: { lte: now } },
          ],
        },
        data: salesErpAcknowledgementUpdate(
          acknowledgement,
          nextSalesErpRetryAt(now, row.attemptCount, policy),
        ),
      });
      if (updated.count !== 1) continue;
      if (acknowledgement.status === "ACCEPTED") accepted += 1;
      else if (acknowledgement.status === "REJECTED") rejected += 1;
      else retryable += 1;

      await prisma.erpReconciliationIncident.updateMany({
        where: {
          provider: prismaSalesErpProvider(input.port.provider),
          deduplicationKey: createSalesErpIncidentKey("command-unknown", {
            provider: input.port.provider,
            commandId: row.commandId,
          }),
          status: ErpReconciliationIncidentStatus.OPEN,
        },
        data: { status: ErpReconciliationIncidentStatus.RESOLVED, resolvedAt: now },
      });
    } catch (error) {
      const details = salesErpErrorDetails(error);
      await recordSalesErpIncident({
        provider: input.port.provider,
        type: ErpReconciliationIncidentType.ACKNOWLEDGEMENT_MISMATCH,
        deduplicationKey: createSalesErpIncidentKey("reconciliation-mismatch", {
          provider: input.port.provider,
          commandId: row.commandId,
        }),
        commandId: row.commandId,
        summary: `ERP reconciliation for command ${row.commandId} did not match`,
        details,
      });
    }
  }

  for (const commandId of result.unknownCommandIds) {
    const row = byCommandId.get(commandId);
    await recordSalesErpIncident({
      provider: input.port.provider,
      type: ErpReconciliationIncidentType.COMMAND_UNKNOWN,
      deduplicationKey: createSalesErpIncidentKey("command-unknown", {
        provider: input.port.provider,
        commandId,
      }),
      commandId: row?.commandId,
      summary: `ERP does not know command ${commandId}`,
      details: { lastAttemptAt: row?.lastAttemptAt?.toISOString(), attemptCount: row?.attemptCount },
    });
  }

  return {
    checked: candidates.length,
    accepted,
    rejected,
    retryable,
    unknown: result.unknownCommandIds.length,
  };
}

export async function getSalesErpSyncHealth(provider: SalesErpProvider) {
  const prismaProvider = prismaSalesErpProvider(provider);
  const [outbox, inbox, openIncidents, latestCheckpoint, oldestPending] = await Promise.all([
    prisma.erpOutboxCommand.groupBy({
      by: ["status"],
      where: { provider: prismaProvider },
      _count: { _all: true },
    }),
    prisma.erpInboxMessage.groupBy({
      by: ["status"],
      where: { provider: prismaProvider },
      _count: { _all: true },
    }),
    prisma.erpReconciliationIncident.count({
      where: { provider: prismaProvider, status: ErpReconciliationIncidentStatus.OPEN },
    }),
    prisma.erpReplicaCheckpoint.findFirst({
      where: { provider: prismaProvider },
      orderBy: { lastSuccessfulSyncAt: "desc" },
      select: { lastSuccessfulSyncAt: true },
    }),
    prisma.erpOutboxCommand.findFirst({
      where: {
        provider: prismaProvider,
        status: { in: [ErpOutboxStatus.PENDING, ErpOutboxStatus.PROCESSING, ErpOutboxStatus.RETRYABLE] },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    provider,
    outbox: Object.fromEntries(outbox.map((item) => [item.status, item._count._all])),
    inbox: Object.fromEntries(inbox.map((item) => [item.status, item._count._all])),
    openIncidents,
    lastSuccessfulSyncAt: latestCheckpoint?.lastSuccessfulSyncAt ?? null,
    oldestPendingCommandAt: oldestPending?.createdAt ?? null,
    hasFailures:
      openIncidents > 0 ||
      (outbox.find((item) => item.status === ErpOutboxStatus.REJECTED)?._count._all ?? 0) > 0 ||
      (inbox.find((item) => item.status === ErpInboxStatus.FAILED)?._count._all ?? 0) > 0,
  };
}
