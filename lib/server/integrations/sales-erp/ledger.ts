import {
  ErpIntegrationProvider,
  ErpReconciliationIncidentStatus,
  Prisma,
  type ErpInboxMessage,
  type ErpOutboxCommand,
  type ErpReconciliationIncidentType,
} from "@prisma/client";

import { prisma } from "@/lib/server/db";

import {
  SALES_ERP_SCHEMA_VERSION,
  type SalesErpCommand,
  type SalesErpEvent,
  type SalesErpEventPage,
  type SalesErpProvider,
} from "./contracts";
import { SalesErpError, invalidSalesErpContract } from "./errors";
import { canonicalSalesErpJson, hashSalesErpContract } from "./idempotency";
import { serializeSalesErpCommand, serializeSalesErpEvent } from "./serialization";

export type EnqueueSalesErpCommandInput = {
  provider: SalesErpProvider;
  command: SalesErpCommand;
  businessDate?: string;
};

export type SalesErpIncidentInput = {
  provider: SalesErpProvider;
  type: ErpReconciliationIncidentType;
  deduplicationKey: string;
  summary: string;
  commandId?: string;
  entityType?: string;
  entityExternalId?: string;
  details?: unknown;
};

function prismaProvider(provider: SalesErpProvider): ErpIntegrationProvider {
  return provider as ErpIntegrationProvider;
}

function parseBusinessDate(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalidSalesErpContract("Business date must use YYYY-MM-DD");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    invalidSalesErpContract("Business date is invalid");
  }
  return parsed;
}

function assertDeduplicationKey(value: string) {
  if (!value.trim() || value.length > 191) {
    invalidSalesErpContract("Incident deduplication key must contain 1 to 191 characters");
  }
}

export function createSalesErpIncidentKey(prefix: string, value: unknown): string {
  const normalizedPrefix = prefix.replace(/[^a-z0-9.-]/gi, "-").slice(0, 48) || "incident";
  return `${normalizedPrefix}:${hashSalesErpContract(value)}`;
}

export async function enqueueSalesErpCommandInTransaction(
  tx: Prisma.TransactionClient,
  input: EnqueueSalesErpCommandInput,
): Promise<ErpOutboxCommand> {
  const serialized = serializeSalesErpCommand(input.command);
  const provider = prismaProvider(input.provider);
  const existing = await tx.erpOutboxCommand.findFirst({
    where: {
      OR: [
        { commandId: input.command.commandId },
        { provider, idempotencyKey: input.command.idempotencyKey },
      ],
    },
  });
  if (existing) {
    if (
      existing.provider !== provider ||
      existing.commandId !== input.command.commandId ||
      existing.idempotencyKey !== input.command.idempotencyKey ||
      existing.commandFingerprint !== serialized.commandFingerprint
    ) {
      throw new SalesErpError({
        code: "IDEMPOTENCY_CONFLICT",
        message: "A persisted command ID or idempotency key belongs to different content",
        details: { commandId: input.command.commandId },
      });
    }
    return existing;
  }

  const dependencyIds = [...new Set(input.command.dependsOnCommandIds)].sort();
  if (dependencyIds.includes(input.command.commandId)) {
    invalidSalesErpContract("A command cannot depend on itself", { commandId: input.command.commandId });
  }
  if (dependencyIds.length !== input.command.dependsOnCommandIds.length) {
    invalidSalesErpContract("A command contains duplicate dependency IDs", {
      commandId: input.command.commandId,
    });
  }
  if (dependencyIds.length) {
    const persistedDependencies = await tx.erpOutboxCommand.findMany({
      where: { commandId: { in: dependencyIds } },
      select: { commandId: true, provider: true },
    });
    const persistedIds = new Set(persistedDependencies.map((item) => item.commandId));
    const missing = dependencyIds.filter((commandId) => !persistedIds.has(commandId));
    if (missing.length) {
      throw new SalesErpError({
        code: "DEPENDENCY_NOT_ACKNOWLEDGED",
        message: "A command dependency has not been persisted",
        retryable: true,
        details: { commandId: input.command.commandId, missingCommandIds: missing.join(",") },
      });
    }
    const otherProvider = persistedDependencies.find((dependency) => dependency.provider !== provider);
    if (otherProvider) {
      invalidSalesErpContract("A command cannot depend on a command for another ERP provider", {
        commandId: input.command.commandId,
        dependsOnCommandId: otherProvider.commandId,
      });
    }
  }

  return tx.erpOutboxCommand.create({
    data: {
      provider,
      commandId: input.command.commandId,
      schemaVersion: input.command.schemaVersion,
      commandType: input.command.commandType,
      businessKey: input.command.businessKey,
      idempotencyKey: input.command.idempotencyKey,
      commandFingerprint: serialized.commandFingerprint,
      issuedAt: new Date(input.command.issuedAt),
      conflictPriority: input.command.conflictPriority,
      contextJson: serialized.contextJson,
      payloadJson: serialized.payloadJson,
      actorUserId: input.command.context.actorUserId,
      representativeExternalId: input.command.context.representativeExternalId,
      deviceId: input.command.context.deviceId,
      country: input.command.context.country,
      appointmentExternalId: input.command.context.appointmentExternalId,
      businessDate: parseBusinessDate(input.businessDate),
      dependencies: dependencyIds.length
        ? { create: dependencyIds.map((dependsOnCommandId) => ({ dependsOnCommandId })) }
        : undefined,
    },
  });
}

export async function enqueueSalesErpCommand(input: EnqueueSalesErpCommandInput) {
  try {
    return await prisma.$transaction((tx) => enqueueSalesErpCommandInTransaction(tx, input));
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const serialized = serializeSalesErpCommand(input.command);
    const provider = prismaProvider(input.provider);
    const existing = await prisma.erpOutboxCommand.findFirst({
      where: {
        OR: [
          { commandId: input.command.commandId },
          { provider, idempotencyKey: input.command.idempotencyKey },
        ],
      },
    });
    if (
      existing?.provider === provider &&
      existing.commandId === input.command.commandId &&
      existing.idempotencyKey === input.command.idempotencyKey &&
      existing.commandFingerprint === serialized.commandFingerprint
    ) {
      return existing;
    }
    throw new SalesErpError({
      code: "IDEMPOTENCY_CONFLICT",
      message: "A concurrent command insert used the same command ID or idempotency key",
      details: { commandId: input.command.commandId },
    });
  }
}

export async function recordSalesErpEventInTransaction(
  tx: Prisma.TransactionClient,
  event: SalesErpEvent,
): Promise<{ record: ErpInboxMessage; duplicate: boolean }> {
  const serialized = serializeSalesErpEvent(event);
  const provider = prismaProvider(event.provider);
  const insertion = await tx.erpInboxMessage.createMany({
    data: [
      {
      provider,
      messageId: event.messageId,
      schemaVersion: event.schemaVersion,
      eventType: event.eventType,
      entityExternalId: event.entityExternalId,
      sourceVersion: event.sourceVersion,
      occurredAt: new Date(event.occurredAt),
      payloadJson: serialized.payloadJson,
      eventFingerprint: serialized.eventFingerprint,
      },
    ],
    skipDuplicates: true,
  });
  const record = await tx.erpInboxMessage.findUniqueOrThrow({
    where: { provider_messageId: { provider, messageId: event.messageId } },
  });
  if (record.eventFingerprint !== serialized.eventFingerprint) {
    throw new SalesErpError({
      code: "EVENT_PAYLOAD_CONFLICT",
      message: "An ERP message ID was reused for different event content",
      details: { provider: event.provider, messageId: event.messageId },
    });
  }
  return { record, duplicate: insertion.count === 0 };
}

export async function recordSalesErpEvent(event: SalesErpEvent) {
  return prisma.$transaction((tx) => recordSalesErpEventInTransaction(tx, event));
}

export async function persistSalesErpEventPage(input: {
  page: SalesErpEventPage;
  streamKey: string;
  scopeKey: string;
  syncedAt?: Date;
}) {
  if (!input.streamKey.trim() || !input.scopeKey.trim()) {
    invalidSalesErpContract("Checkpoint stream and scope keys are required");
  }
  const provider = prismaProvider(input.page.provider);
  const syncedAt = input.syncedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    let inserted = 0;
    let duplicates = 0;
    for (const event of input.page.events) {
      if (event.provider !== input.page.provider) {
        invalidSalesErpContract("An event page contains an event from another provider");
      }
      const result = await recordSalesErpEventInTransaction(tx, event);
      if (result.duplicate) duplicates += 1;
      else inserted += 1;
    }

    const lastEventOccurredAt = input.page.events.reduce<Date | undefined>((latest, event) => {
      const occurredAt = new Date(event.occurredAt);
      return !latest || occurredAt > latest ? occurredAt : latest;
    }, undefined);
    await tx.erpReplicaCheckpoint.upsert({
      where: {
        provider_streamKey_scopeKey: {
          provider,
          streamKey: input.streamKey,
          scopeKey: input.scopeKey,
        },
      },
      create: {
        provider,
        streamKey: input.streamKey,
        scopeKey: input.scopeKey,
        schemaVersion: SALES_ERP_SCHEMA_VERSION,
        cursor: input.page.nextCursor,
        lastSuccessfulSyncAt: syncedAt,
        lastEventOccurredAt,
      },
      update: {
        schemaVersion: SALES_ERP_SCHEMA_VERSION,
        cursor: input.page.nextCursor,
        lastSuccessfulSyncAt: syncedAt,
        lastEventOccurredAt,
      },
    });
    return { inserted, duplicates, nextCursor: input.page.nextCursor, hasMore: input.page.hasMore };
  });
}

export async function recordSalesErpIncidentInTransaction(
  tx: Prisma.TransactionClient,
  input: SalesErpIncidentInput,
) {
  assertDeduplicationKey(input.deduplicationKey);
  const provider = prismaProvider(input.provider);
  const now = new Date();
  return tx.erpReconciliationIncident.upsert({
    where: { provider_deduplicationKey: { provider, deduplicationKey: input.deduplicationKey } },
    create: {
      provider,
      type: input.type,
      deduplicationKey: input.deduplicationKey,
      commandId: input.commandId,
      entityType: input.entityType,
      entityExternalId: input.entityExternalId,
      summary: input.summary,
      detailsJson: input.details === undefined ? null : canonicalSalesErpJson(input.details),
      firstDetectedAt: now,
      lastDetectedAt: now,
    },
    update: {
      type: input.type,
      status: ErpReconciliationIncidentStatus.OPEN,
      commandId: input.commandId,
      entityType: input.entityType,
      entityExternalId: input.entityExternalId,
      summary: input.summary,
      detailsJson: input.details === undefined ? null : canonicalSalesErpJson(input.details),
      occurrenceCount: { increment: 1 },
      lastDetectedAt: now,
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
    },
  });
}

export async function recordSalesErpIncident(input: SalesErpIncidentInput) {
  return prisma.$transaction((tx) => recordSalesErpIncidentInTransaction(tx, input));
}

export async function getSalesErpCheckpoint(input: {
  provider: SalesErpProvider;
  streamKey: string;
  scopeKey: string;
}) {
  return prisma.erpReplicaCheckpoint.findUnique({
    where: {
      provider_streamKey_scopeKey: {
        provider: prismaProvider(input.provider),
        streamKey: input.streamKey,
        scopeKey: input.scopeKey,
      },
    },
  });
}
