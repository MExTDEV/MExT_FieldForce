import assert from "node:assert/strict";

import { loadEnvConfig } from "@next/env";

import type { SalesErpPort } from "../lib/server/integrations/sales-erp/port";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.SALES_ERP_LEDGER_TEST_DATABASE_URL;
  assert(databaseUrl, "SALES_ERP_LEDGER_TEST_DATABASE_URL is required for the destructive ledger database test.");
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  assert(/test/i.test(databaseName), "The ledger database test refuses a database whose name does not contain 'test'.");
  process.env.DATABASE_URL = databaseUrl;

  const { prisma } = await import("../lib/server/db");
  const {
    SalesErpError,
    SalesErpMockAdapter,
    buildSalesErpCommand,
    createSalesErpIncidentKey,
    dispatchSalesErpOutboxBatch,
    enqueueSalesErpCommand,
    enqueueSalesErpCommandInTransaction,
    getSalesErpSyncHealth,
    processSalesErpInboxBatch,
    pullSalesErpEvents,
    reconcileSalesErpCommands,
    salesErpMockEvents,
  } = await import("../lib/server/integrations/sales-erp");

  const prefix = "sales-ledger-dbtest";
  const userId = `${prefix}-user`;
  const commandIds = [
    `${prefix}-base`,
    `${prefix}-rollback`,
    `${prefix}-parent`,
    `${prefix}-child`,
    `${prefix}-lost-ack`,
    `${prefix}-permission`,
  ];
  const eventIds = [`${prefix}-event`, `${prefix}-crash-event`];
  const incidentKeys = [
    createSalesErpIncidentKey("provider_error", { provider: "MOCK", commandId: `${prefix}-lost-ack` }),
    createSalesErpIncidentKey("permission-revoked", { provider: "MOCK", commandId: `${prefix}-permission` }),
    createSalesErpIncidentKey("event-apply", { provider: "MOCK", messageId: `${prefix}-crash-event` }),
  ];

  async function cleanup() {
    await prisma.erpReconciliationIncident.deleteMany({
      where: { OR: [{ commandId: { in: commandIds } }, { deduplicationKey: { in: incidentKeys } }] },
    });
    await prisma.erpOutboxDependency.deleteMany({
      where: { OR: [{ commandId: { in: commandIds } }, { dependsOnCommandId: { in: commandIds } }] },
    });
    await prisma.erpOutboxCommand.deleteMany({ where: { commandId: { in: commandIds } } });
    await prisma.erpInboxMessage.deleteMany({ where: { messageId: { in: eventIds } } });
    await prisma.erpReplicaCheckpoint.deleteMany({ where: { scopeKey: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  await cleanup();
  try {
    await prisma.user.create({
      data: {
        id: userId,
        firstName: "Sales",
        lastName: "Ledger Test",
        email: `${prefix}@example.invalid`,
        role: "SUPER_ADMIN",
        country: "BE",
        active: true,
      },
    });

    const fixedNow = new Date("2026-07-16T12:00:00.000Z");
    const context = {
      actorUserId: userId,
      representativeExternalId: `${prefix}-rep`,
      deviceId: `${prefix}-device`,
      country: "BE" as const,
      appointmentExternalId: "mock-appointment-be-001",
    };
    const createCommand = (commandId: string, businessKey = commandId, dependencies: string[] = []) =>
      buildSalesErpCommand({
        commandId,
        issuedAt: fixedNow.toISOString(),
        commandType: "follow-up.create",
        businessKey,
        dependsOnCommandIds: dependencies,
        context,
        payload: {
          appointmentExternalId: "mock-appointment-be-001",
          localFollowUpId: commandId,
          customerExternalId: "mock-customer-be-001",
          type: "BACKOFFICE",
          description: "Persistente ledgerdatabasetest",
        },
      });

    const baseCommand = createCommand(`${prefix}-base`);
    const firstPersist = await enqueueSalesErpCommand({
      provider: "MOCK",
      command: baseCommand,
      businessDate: "2026-07-16",
    });
    const duplicatePersist = await enqueueSalesErpCommand({
      provider: "MOCK",
      command: baseCommand,
      businessDate: "2026-07-16",
    });
    assert.equal(duplicatePersist.id, firstPersist.id);
    await assert.rejects(
      () =>
        enqueueSalesErpCommand({
          provider: "MOCK",
          command: createCommand(`${prefix}-base`, "different-business-key"),
        }),
      (error: unknown) => error instanceof SalesErpError && error.code === "IDEMPOTENCY_CONFLICT",
    );

    const rollbackCommand = createCommand(`${prefix}-rollback`);
    await assert.rejects(() =>
      prisma.$transaction(async (tx) => {
        await enqueueSalesErpCommandInTransaction(tx, { provider: "MOCK", command: rollbackCommand });
        throw new Error("Simulated business transaction crash");
      }),
    );
    assert.equal(
      await prisma.erpOutboxCommand.findUnique({ where: { commandId: rollbackCommand.commandId } }),
      null,
    );

    const parentCommand = createCommand(`${prefix}-parent`);
    const childCommand = createCommand(`${prefix}-child`, `${prefix}-child`, [parentCommand.commandId]);
    await enqueueSalesErpCommand({ provider: "MOCK", command: parentCommand });
    await enqueueSalesErpCommand({ provider: "MOCK", command: childCommand });
    const adapter = new SalesErpMockAdapter({ now: () => fixedNow });
    await dispatchSalesErpOutboxBatch({
      port: adapter,
      workerId: `${prefix}-worker-1`,
      writesEnabled: true,
      authorize: async () => ({ allowed: true }),
      now: fixedNow,
    });
    assert.equal(
      (await prisma.erpOutboxCommand.findUniqueOrThrow({ where: { commandId: childCommand.commandId } })).status,
      "PENDING",
    );
    await dispatchSalesErpOutboxBatch({
      port: adapter,
      workerId: `${prefix}-worker-2`,
      writesEnabled: true,
      authorize: async () => ({ allowed: true }),
      now: fixedNow,
    });
    assert.equal(
      (await prisma.erpOutboxCommand.findUniqueOrThrow({ where: { commandId: childCommand.commandId } })).status,
      "ACCEPTED",
    );

    const lostCommand = createCommand(`${prefix}-lost-ack`);
    await enqueueSalesErpCommand({ provider: "MOCK", command: lostCommand });
    let loseAcknowledgement = true;
    const lostPort: SalesErpPort = {
      provider: adapter.provider,
      getCapabilities: () => adapter.getCapabilities(),
      getBootstrapPage: (request) => adapter.getBootstrapPage(request),
      getEvents: (request) => adapter.getEvents(request),
      getCommandStatus: (commandId) => adapter.getCommandStatus(commandId),
      reconcile: (request) => adapter.reconcile(request),
      submitCommand: async (submittedCommand) => {
        const acknowledgement = await adapter.submitCommand(submittedCommand);
        if (submittedCommand.commandId === lostCommand.commandId && loseAcknowledgement) {
          loseAcknowledgement = false;
          throw new SalesErpError({
            code: "PROVIDER_UNAVAILABLE",
            message: "Simulated acknowledgement loss",
            retryable: true,
          });
        }
        return acknowledgement;
      },
    };
    const lostDispatch = await dispatchSalesErpOutboxBatch({
      port: lostPort,
      workerId: `${prefix}-worker-lost`,
      writesEnabled: true,
      authorize: async () => ({ allowed: true }),
      now: fixedNow,
      policy: { leaseMs: 1_000, baseRetryDelayMs: 0, maxRetryDelayMs: 0 },
    });
    assert.equal(lostDispatch.retryable, 1);
    const reconciliation = await reconcileSalesErpCommands({
      port: adapter,
      now: fixedNow,
      policy: { leaseMs: 1_000, baseRetryDelayMs: 0, maxRetryDelayMs: 0 },
    });
    assert.equal(reconciliation.accepted, 1);
    assert.equal(
      (await prisma.erpOutboxCommand.findUniqueOrThrow({ where: { commandId: lostCommand.commandId } })).status,
      "ACCEPTED",
    );
    assert.equal(adapter.inspectSubmittedCommands().filter((item) => item.commandId === lostCommand.commandId).length, 1);

    const permissionCommand = createCommand(`${prefix}-permission`);
    await enqueueSalesErpCommand({ provider: "MOCK", command: permissionCommand });
    const permissionDispatch = await dispatchSalesErpOutboxBatch({
      port: adapter,
      workerId: `${prefix}-worker-permission`,
      writesEnabled: true,
      authorize: async (submittedCommand) =>
        submittedCommand.commandId === permissionCommand.commandId
          ? { allowed: false, reason: "Test permission revoked", reasonCode: "PERMISSION_REVOKED" }
          : { allowed: true },
      now: fixedNow,
    });
    assert.equal(permissionDispatch.permissionRejected, 1);

    const event = { ...salesErpMockEvents[0], messageId: `${prefix}-event` };
    const crashEvent = { ...salesErpMockEvents[1], messageId: `${prefix}-crash-event` };
    const eventAdapter = new SalesErpMockAdapter({ now: () => fixedNow, events: [event, crashEvent] });
    const pull = await pullSalesErpEvents({
      port: eventAdapter,
      scopeKey: `${prefix}-scope`,
      now: fixedNow,
    });
    assert.equal(pull.inserted, 2);
    const inboxFailure = await processSalesErpInboxBatch({
      workerId: `${prefix}-inbox-fail`,
      now: fixedNow,
      policy: { leaseMs: 1_000, baseRetryDelayMs: 0, maxRetryDelayMs: 0 },
      handler: async (tx, receivedEvent) => {
        if (receivedEvent.messageId === crashEvent.messageId) {
          await tx.erpReplicaCheckpoint.upsert({
            where: {
              provider_streamKey_scopeKey: {
                provider: "MOCK",
                streamKey: "handler-test",
                scopeKey: `${prefix}-handler-rollback`,
              },
            },
            create: {
              provider: "MOCK",
              streamKey: "handler-test",
              scopeKey: `${prefix}-handler-rollback`,
              schemaVersion: "sales-erp.v1",
              cursor: "must-rollback",
              lastSuccessfulSyncAt: fixedNow,
            },
            update: { cursor: "must-rollback" },
          });
          throw new Error("Simulated event-application crash");
        }
      },
    });
    assert.equal(inboxFailure.applied, 1);
    assert.equal(inboxFailure.retryable, 1);
    assert.equal(
      await prisma.erpReplicaCheckpoint.findUnique({
        where: {
          provider_streamKey_scopeKey: {
            provider: "MOCK",
            streamKey: "handler-test",
            scopeKey: `${prefix}-handler-rollback`,
          },
        },
      }),
      null,
    );
    const inboxRecovery = await processSalesErpInboxBatch({
      workerId: `${prefix}-inbox-recover`,
      now: fixedNow,
      policy: { leaseMs: 1_000, baseRetryDelayMs: 0, maxRetryDelayMs: 0 },
      handler: async () => undefined,
    });
    assert.equal(inboxRecovery.applied, 1);

    const health = await getSalesErpSyncHealth("MOCK");
    assert.equal(health.hasFailures, true);
    assert(health.lastSuccessfulSyncAt);

    console.log(
      "Sales ERP-ledgerdatabase: atomiciteit, dependencies, acknowledgement recovery, replayrechten en inboxherstel gevalideerd.",
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

void main();
