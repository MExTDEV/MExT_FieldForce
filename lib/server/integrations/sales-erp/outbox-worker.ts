import {
  ErpOutboxStatus,
  ErpReconciliationIncidentType,
  type ErpOutboxCommand,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/server/db";

import { assertSalesErpAcknowledgement, salesErpAcknowledgementUpdate } from "./acknowledgements";
import type { SalesErpCommand, SalesErpProvider } from "./contracts";
import { SalesErpError } from "./errors";
import { createSalesErpIncidentKey, recordSalesErpIncident } from "./ledger";
import type { SalesErpPort } from "./port";
import { deserializeSalesErpCommand, type PersistedOutboxCommand } from "./serialization";
import {
  nextSalesErpRetryAt,
  normalizeSalesErpWorkerPolicy,
  prismaSalesErpProvider,
  salesErpErrorDetails,
  type NormalizedSalesErpWorkerPolicy,
  type SalesErpWorkerPolicy,
} from "./worker-utils";

export type SalesErpReplayAuthorization = (
  command: SalesErpCommand,
) => Promise<{ allowed: true } | { allowed: false; reason: string; reasonCode?: string }>;

export type DispatchSalesErpOutboxInput = {
  port: SalesErpPort;
  workerId: string;
  writesEnabled: boolean;
  authorize: SalesErpReplayAuthorization;
  limit?: number;
  now?: Date;
  policy?: SalesErpWorkerPolicy;
};

function outboxEligibility(
  provider: SalesErpProvider,
  now: Date,
): Prisma.ErpOutboxCommandWhereInput {
  return {
    provider: prismaSalesErpProvider(provider),
    dependencies: { every: { dependsOnCommand: { status: ErpOutboxStatus.ACCEPTED } } },
    OR: [
      {
        status: { in: [ErpOutboxStatus.PENDING, ErpOutboxStatus.RETRYABLE] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      { status: ErpOutboxStatus.PROCESSING, leaseExpiresAt: { lte: now } },
    ],
  };
}

async function rejectCommandsWithRejectedDependencies(provider: SalesErpProvider) {
  const blocked = await prisma.erpOutboxCommand.findMany({
    where: {
      provider: prismaSalesErpProvider(provider),
      status: { in: [ErpOutboxStatus.PENDING, ErpOutboxStatus.RETRYABLE] },
      dependencies: { some: { dependsOnCommand: { status: ErpOutboxStatus.REJECTED } } },
    },
    include: {
      dependencies: {
        where: { dependsOnCommand: { status: ErpOutboxStatus.REJECTED } },
        include: { dependsOnCommand: { select: { commandId: true, lastErrorCode: true } } },
      },
    },
    take: 500,
  });
  let rejected = 0;
  for (const command of blocked) {
    const dependency = command.dependencies[0]?.dependsOnCommand;
    const updated = await prisma.erpOutboxCommand.updateMany({
      where: {
        id: command.id,
        status: { in: [ErpOutboxStatus.PENDING, ErpOutboxStatus.RETRYABLE] },
      },
      data: {
        status: ErpOutboxStatus.REJECTED,
        lastErrorCode: "DEPENDENCY_REJECTED",
        lastErrorMessage: dependency
          ? `Dependency ${dependency.commandId} was rejected`
          : "A command dependency was rejected",
        nextAttemptAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    if (updated.count === 1) {
      rejected += 1;
      await recordSalesErpIncident({
        provider,
        type: ErpReconciliationIncidentType.DEPENDENCY_REJECTED,
        deduplicationKey: createSalesErpIncidentKey("dependency-rejected", {
          provider,
          commandId: command.commandId,
        }),
        commandId: command.commandId,
        summary: `ERP command ${command.commandId} has a rejected dependency`,
        details: { dependsOnCommandId: dependency?.commandId, dependencyErrorCode: dependency?.lastErrorCode },
      });
    }
  }
  return rejected;
}

async function markRetryableFailure(input: {
  row: ErpOutboxCommand;
  workerId: string;
  provider: SalesErpProvider;
  error: unknown;
  now: Date;
  policy: NormalizedSalesErpWorkerPolicy;
  incidentType: "ACKNOWLEDGEMENT_MISMATCH" | "AUTHORIZATION_ERROR" | "PROVIDER_ERROR";
}) {
  const details = salesErpErrorDetails(input.error);
  const updated = await prisma.erpOutboxCommand.updateMany({
    where: { id: input.row.id, status: ErpOutboxStatus.PROCESSING, leaseOwner: input.workerId },
    data: {
      status: ErpOutboxStatus.RETRYABLE,
      nextAttemptAt: nextSalesErpRetryAt(input.now, input.row.attemptCount, input.policy),
      leaseOwner: null,
      leaseExpiresAt: null,
      lastErrorCode: details.code,
      lastErrorMessage: details.message,
    },
  });
  if (updated.count !== 1) return false;

  await recordSalesErpIncident({
    provider: input.provider,
    type: ErpReconciliationIncidentType[input.incidentType],
    deduplicationKey: createSalesErpIncidentKey(input.incidentType.toLowerCase(), {
      provider: input.provider,
      commandId: input.row.commandId,
    }),
    commandId: input.row.commandId,
    summary: `ERP command ${input.row.commandId} could not be acknowledged safely`,
    details,
  });
  if (input.row.attemptCount >= input.policy.repeatedFailureThreshold) {
    await recordSalesErpIncident({
      provider: input.provider,
      type: ErpReconciliationIncidentType.REPEATED_FAILURE,
      deduplicationKey: createSalesErpIncidentKey("command-repeated", {
        provider: input.provider,
        commandId: input.row.commandId,
      }),
      commandId: input.row.commandId,
      summary: `ERP command ${input.row.commandId} repeatedly failed`,
      details: { attemptCount: input.row.attemptCount, ...details },
    });
  }
  return true;
}

export async function dispatchSalesErpOutboxBatch(input: DispatchSalesErpOutboxInput) {
  if (!input.workerId.trim()) {
    throw new SalesErpError({ code: "INVALID_CONTRACT", message: "Outbox worker ID is required" });
  }
  const now = input.now ?? new Date();
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new SalesErpError({ code: "INVALID_CONTRACT", message: "Outbox batch limit must be 1 to 500" });
  }
  if (!input.writesEnabled) {
    return {
      disabled: true,
      dependencyRejected: 0,
      claimed: 0,
      accepted: 0,
      rejected: 0,
      retryable: 0,
      permissionRejected: 0,
    };
  }
  const policy = normalizeSalesErpWorkerPolicy(input.policy);
  const dependencyRejected = await rejectCommandsWithRejectedDependencies(input.port.provider);
  const candidates = await prisma.erpOutboxCommand.findMany({
    where: outboxEligibility(input.port.provider, now),
    orderBy: [{ issuedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  const claimed: PersistedOutboxCommand[] = [];
  for (const candidate of candidates) {
    const claim = await prisma.erpOutboxCommand.updateMany({
      where: { id: candidate.id, ...outboxEligibility(input.port.provider, now) },
      data: {
        status: ErpOutboxStatus.PROCESSING,
        leaseOwner: input.workerId,
        leaseExpiresAt: new Date(now.getTime() + policy.leaseMs),
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
        nextAttemptAt: null,
      },
    });
    if (claim.count === 1) {
      claimed.push(
        await prisma.erpOutboxCommand.findUniqueOrThrow({
          where: { id: candidate.id },
          include: { dependencies: { select: { dependsOnCommandId: true } } },
        }),
      );
    }
  }

  let accepted = 0;
  let rejected = 0;
  let retryable = 0;
  let permissionRejected = 0;
  for (const row of claimed) {
    let command: SalesErpCommand;
    try {
      command = deserializeSalesErpCommand(row);
    } catch (error) {
      const details = salesErpErrorDetails(error);
      const update = await prisma.erpOutboxCommand.updateMany({
        where: { id: row.id, status: ErpOutboxStatus.PROCESSING, leaseOwner: input.workerId },
        data: {
          status: ErpOutboxStatus.REJECTED,
          lastErrorCode: details.code,
          lastErrorMessage: details.message,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      if (update.count === 1) rejected += 1;
      continue;
    }

    let authorization: Awaited<ReturnType<SalesErpReplayAuthorization>>;
    try {
      authorization = await input.authorize(command);
    } catch (error) {
      if (
        await markRetryableFailure({
          row,
          workerId: input.workerId,
          provider: input.port.provider,
          error,
          now,
          policy,
          incidentType: "AUTHORIZATION_ERROR",
        })
      ) {
        retryable += 1;
      }
      continue;
    }
    if (!authorization.allowed) {
      const update = await prisma.erpOutboxCommand.updateMany({
        where: { id: row.id, status: ErpOutboxStatus.PROCESSING, leaseOwner: input.workerId },
        data: {
          status: ErpOutboxStatus.REJECTED,
          lastErrorCode: authorization.reasonCode ?? "PERMISSION_REVOKED",
          lastErrorMessage: authorization.reason,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      if (update.count === 1) {
        permissionRejected += 1;
        rejected += 1;
        await recordSalesErpIncident({
          provider: input.port.provider,
          type: ErpReconciliationIncidentType.PERMISSION_REVOKED,
          deduplicationKey: createSalesErpIncidentKey("permission-revoked", {
            provider: input.port.provider,
            commandId: row.commandId,
          }),
          commandId: row.commandId,
          summary: `ERP command ${row.commandId} was blocked during replay authorization`,
          details: { reasonCode: authorization.reasonCode, reason: authorization.reason },
        });
      }
      continue;
    }

    let acknowledgement;
    try {
      acknowledgement = await input.port.submitCommand(command);
    } catch (error) {
      if (
        await markRetryableFailure({
          row,
          workerId: input.workerId,
          provider: input.port.provider,
          error,
          now,
          policy,
          incidentType: "PROVIDER_ERROR",
        })
      ) {
        retryable += 1;
      }
      continue;
    }

    try {
      assertSalesErpAcknowledgement(input.port.provider, command, acknowledgement);
    } catch (error) {
      if (
        await markRetryableFailure({
          row,
          workerId: input.workerId,
          provider: input.port.provider,
          error,
          now,
          policy,
          incidentType: "ACKNOWLEDGEMENT_MISMATCH",
        })
      ) {
        retryable += 1;
      }
      continue;
    }

    const update = await prisma.erpOutboxCommand.updateMany({
      where: { id: row.id, status: ErpOutboxStatus.PROCESSING, leaseOwner: input.workerId },
      data: salesErpAcknowledgementUpdate(
        acknowledgement,
        nextSalesErpRetryAt(now, row.attemptCount, policy),
      ),
    });
    if (update.count !== 1) continue;
    if (acknowledgement.status === "ACCEPTED") accepted += 1;
    else if (acknowledgement.status === "REJECTED") rejected += 1;
    else retryable += 1;
  }

  return {
    disabled: false,
    dependencyRejected,
    claimed: claimed.length,
    accepted,
    rejected,
    retryable,
    permissionRejected,
  };
}
