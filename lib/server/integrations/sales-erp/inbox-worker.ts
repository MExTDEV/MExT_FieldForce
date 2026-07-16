import { ErpInboxStatus, ErpReconciliationIncidentType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db";

import type { SalesErpEvent } from "./contracts";
import { SalesErpError } from "./errors";
import { createSalesErpIncidentKey, recordSalesErpIncident } from "./ledger";
import { deserializeSalesErpEvent } from "./serialization";
import {
  nextSalesErpRetryAt,
  normalizeSalesErpWorkerPolicy,
  salesErpErrorDetails,
  type SalesErpWorkerPolicy,
} from "./worker-utils";

export type SalesErpInboxApplyHandler = (
  tx: Prisma.TransactionClient,
  event: SalesErpEvent,
) => Promise<void>;

export type ProcessSalesErpInboxInput = {
  workerId: string;
  handler: SalesErpInboxApplyHandler;
  limit?: number;
  now?: Date;
  policy?: SalesErpWorkerPolicy;
};

function inboxEligibility(now: Date): Prisma.ErpInboxMessageWhereInput {
  return {
    OR: [
      {
        status: { in: [ErpInboxStatus.RECEIVED, ErpInboxStatus.RETRYABLE] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      { status: ErpInboxStatus.PROCESSING, leaseExpiresAt: { lte: now } },
    ],
  };
}

export async function processSalesErpInboxBatch(input: ProcessSalesErpInboxInput) {
  if (!input.workerId.trim()) {
    throw new SalesErpError({ code: "INVALID_CONTRACT", message: "Inbox worker ID is required" });
  }
  const now = input.now ?? new Date();
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new SalesErpError({ code: "INVALID_CONTRACT", message: "Inbox batch limit must be 1 to 500" });
  }
  const policy = normalizeSalesErpWorkerPolicy(input.policy);
  const candidates = await prisma.erpInboxMessage.findMany({
    where: inboxEligibility(now),
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  const claimedIds: string[] = [];
  for (const candidate of candidates) {
    const claimed = await prisma.erpInboxMessage.updateMany({
      where: { id: candidate.id, ...inboxEligibility(now) },
      data: {
        status: ErpInboxStatus.PROCESSING,
        leaseOwner: input.workerId,
        leaseExpiresAt: new Date(now.getTime() + policy.leaseMs),
        attemptCount: { increment: 1 },
        nextAttemptAt: null,
      },
    });
    if (claimed.count === 1) claimedIds.push(candidate.id);
  }

  let applied = 0;
  let retryable = 0;
  let failed = 0;
  for (const id of claimedIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const row = await tx.erpInboxMessage.findUniqueOrThrow({ where: { id } });
        if (row.status !== ErpInboxStatus.PROCESSING || row.leaseOwner !== input.workerId) {
          throw new SalesErpError({
            code: "COMMAND_LEASE_LOST",
            message: "Inbox lease was lost before event application",
            retryable: true,
          });
        }
        const event = deserializeSalesErpEvent(row);
        await input.handler(tx, event);
        const finalized = await tx.erpInboxMessage.updateMany({
          where: { id, status: ErpInboxStatus.PROCESSING, leaseOwner: input.workerId },
          data: {
            status: ErpInboxStatus.APPLIED,
            appliedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
            nextAttemptAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        if (finalized.count !== 1) {
          throw new SalesErpError({
            code: "COMMAND_LEASE_LOST",
            message: "Inbox lease was lost while finalizing event application",
            retryable: true,
          });
        }
      });
      applied += 1;
    } catch (error) {
      const details = salesErpErrorDetails(error);
      const current = await prisma.erpInboxMessage.findUnique({ where: { id } });
      if (!current || current.leaseOwner !== input.workerId || current.status !== ErpInboxStatus.PROCESSING) {
        continue;
      }
      const permanent = details.code === "INVALID_CONTRACT" || details.code === "EVENT_PAYLOAD_CONFLICT";
      await prisma.erpInboxMessage.update({
        where: { id },
        data: {
          status: permanent ? ErpInboxStatus.FAILED : ErpInboxStatus.RETRYABLE,
          nextAttemptAt: permanent ? null : nextSalesErpRetryAt(now, current.attemptCount, policy),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: details.code,
          lastErrorMessage: details.message,
        },
      });
      await recordSalesErpIncident({
        provider: current.provider,
        type: ErpReconciliationIncidentType.EVENT_APPLY_FAILED,
        deduplicationKey: createSalesErpIncidentKey("event-apply", {
          provider: current.provider,
          messageId: current.messageId,
        }),
        summary: `ERP event ${current.messageId} could not be applied`,
        entityType: current.eventType,
        entityExternalId: current.entityExternalId,
        details,
      });
      if (current.attemptCount >= policy.repeatedFailureThreshold) {
        await recordSalesErpIncident({
          provider: current.provider,
          type: ErpReconciliationIncidentType.REPEATED_FAILURE,
          deduplicationKey: createSalesErpIncidentKey("event-repeated", {
            provider: current.provider,
            messageId: current.messageId,
          }),
          summary: `ERP event ${current.messageId} repeatedly failed`,
          entityType: current.eventType,
          entityExternalId: current.entityExternalId,
          details: { attemptCount: current.attemptCount, ...details },
        });
      }
      if (permanent) failed += 1;
      else retryable += 1;
    }
  }

  return { claimed: claimedIds.length, applied, retryable, failed };
}
