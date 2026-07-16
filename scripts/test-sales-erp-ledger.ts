import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ErpInboxStatus,
  ErpIntegrationProvider,
  ErpOutboxStatus,
  type ErpInboxMessage,
} from "@prisma/client";

import {
  SALES_ERP_SCHEMA_VERSION,
  SalesErpError,
  SalesErpMockAdapter,
  assertSalesErpAcknowledgement,
  buildSalesErpCommand,
  createSalesErpIncidentKey,
  deserializeSalesErpCommand,
  deserializeSalesErpEvent,
  fingerprintSalesErpCommand,
  nextSalesErpRetryAt,
  normalizeSalesErpWorkerPolicy,
  salesErpMockEvents,
  serializeSalesErpCommand,
  serializeSalesErpEvent,
  type PersistedOutboxCommand,
  type SalesErpPort,
} from "../lib/server/integrations/sales-erp";

async function main() {
const fixedNow = new Date("2026-07-16T12:00:00.000Z");
const command = buildSalesErpCommand({
  commandId: "ledger-command-001",
  issuedAt: fixedNow.toISOString(),
  commandType: "follow-up.create",
  businessKey: "follow-up:ledger-001",
  dependsOnCommandIds: ["dependency-z", "dependency-a"],
  context: {
    actorUserId: "ledger-user-001",
    representativeExternalId: "ledger-rep-001",
    deviceId: "ledger-device-001",
    country: "BE",
    appointmentExternalId: "mock-appointment-be-001",
  },
  payload: {
    appointmentExternalId: "mock-appointment-be-001",
    localFollowUpId: "ledger-follow-up-001",
    customerExternalId: "mock-customer-be-001",
    type: "BACKOFFICE",
    description: "Ledgercontrole",
  },
});

assert.deepEqual(command.dependsOnCommandIds, ["dependency-a", "dependency-z"]);
assert.equal(
  fingerprintSalesErpCommand(command),
  fingerprintSalesErpCommand({ ...command, dependsOnCommandIds: [...command.dependsOnCommandIds].reverse() }),
);

const serializedCommand = serializeSalesErpCommand(command);
const persistedCommand: PersistedOutboxCommand = {
  id: "ledger-row-001",
  provider: ErpIntegrationProvider.MOCK,
  commandId: command.commandId,
  schemaVersion: command.schemaVersion,
  commandType: command.commandType,
  businessKey: command.businessKey,
  idempotencyKey: command.idempotencyKey,
  commandFingerprint: serializedCommand.commandFingerprint,
  issuedAt: fixedNow,
  conflictPriority: "FIELDFORCE",
  contextJson: serializedCommand.contextJson,
  payloadJson: serializedCommand.payloadJson,
  actorUserId: command.context.actorUserId,
  representativeExternalId: command.context.representativeExternalId,
  deviceId: command.context.deviceId,
  country: command.context.country,
  appointmentExternalId: command.context.appointmentExternalId ?? null,
  businessDate: new Date("2026-07-16T00:00:00.000Z"),
  status: ErpOutboxStatus.PENDING,
  attemptCount: 0,
  nextAttemptAt: null,
  lastAttemptAt: null,
  leaseOwner: null,
  leaseExpiresAt: null,
  acknowledgedAt: null,
  externalEntityId: null,
  acknowledgedSourceVersion: null,
  acknowledgementJson: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
  dependencies: command.dependsOnCommandIds.map((dependsOnCommandId) => ({ dependsOnCommandId })),
};
assert.deepEqual(deserializeSalesErpCommand(persistedCommand), command);
assert.throws(
  () => deserializeSalesErpCommand({ ...persistedCommand, deviceId: "different-device" }),
  (error: unknown) => error instanceof SalesErpError && error.code === "INVALID_CONTRACT",
);
assert.throws(
  () => deserializeSalesErpCommand({ ...persistedCommand, commandFingerprint: "0".repeat(64) }),
  (error: unknown) => error instanceof SalesErpError && error.code === "INVALID_CONTRACT",
);

const event = salesErpMockEvents[0];
const serializedEvent = serializeSalesErpEvent(event);
const persistedEvent: ErpInboxMessage = {
  id: "ledger-event-row-001",
  provider: ErpIntegrationProvider.MOCK,
  messageId: event.messageId,
  schemaVersion: SALES_ERP_SCHEMA_VERSION,
  eventType: event.eventType,
  entityExternalId: event.entityExternalId,
  sourceVersion: event.sourceVersion,
  occurredAt: new Date(event.occurredAt),
  payloadJson: serializedEvent.payloadJson,
  eventFingerprint: serializedEvent.eventFingerprint,
  status: ErpInboxStatus.RECEIVED,
  attemptCount: 0,
  nextAttemptAt: null,
  leaseOwner: null,
  leaseExpiresAt: null,
  appliedAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};
assert.deepEqual(deserializeSalesErpEvent(persistedEvent), event);
assert.throws(
  () => deserializeSalesErpEvent({ ...persistedEvent, payloadJson: "{}" }),
  (error: unknown) => error instanceof SalesErpError && error.code === "INVALID_CONTRACT",
);

const adapter = new SalesErpMockAdapter({ now: () => fixedNow });
const adapterAcknowledgement = await adapter.submitCommand(
  buildSalesErpCommand({
    commandId: "ledger-ack-command-001",
    issuedAt: fixedNow.toISOString(),
    commandType: "day-close.submit",
    businessKey: "day-close:ledger-001",
    context: command.context,
    payload: {
      localDayCloseId: "ledger-day-close-001",
      businessDate: "2026-07-16",
      closedAt: fixedNow.toISOString(),
      appointmentExternalIds: ["mock-appointment-be-001"],
    },
  }),
);
const acknowledgedCommand = adapter.inspectSubmittedCommands()[0];
assertSalesErpAcknowledgement("MOCK", acknowledgedCommand, adapterAcknowledgement);
assert.throws(
  () =>
    assertSalesErpAcknowledgement("MOCK", acknowledgedCommand, {
      ...adapterAcknowledgement,
      commandId: "wrong-command",
    }),
  (error: unknown) => error instanceof SalesErpError && error.code === "PROVIDER_REJECTED",
);

const retryPolicy = normalizeSalesErpWorkerPolicy({
  leaseMs: 1_000,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 4_000,
});
assert.equal(nextSalesErpRetryAt(fixedNow, 1, retryPolicy).getTime() - fixedNow.getTime(), 1_000);
assert.equal(nextSalesErpRetryAt(fixedNow, 3, retryPolicy).getTime() - fixedNow.getTime(), 4_000);
assert.equal(nextSalesErpRetryAt(fixedNow, 20, retryPolicy).getTime() - fixedNow.getTime(), 4_000);
assert.equal(
  createSalesErpIncidentKey("provider error", { commandId: "x", at: fixedNow }),
  createSalesErpIncidentKey("provider error", { at: new Date(fixedNow), commandId: "x" }),
);

const lossAdapter = new SalesErpMockAdapter({ now: () => fixedNow });
let loseFirstAcknowledgement = true;
const lostAcknowledgementPort: SalesErpPort = {
  provider: lossAdapter.provider,
  getCapabilities: () => lossAdapter.getCapabilities(),
  getBootstrapPage: (request) => lossAdapter.getBootstrapPage(request),
  getEvents: (request) => lossAdapter.getEvents(request),
  getCommandStatus: (commandId) => lossAdapter.getCommandStatus(commandId),
  reconcile: (request) => lossAdapter.reconcile(request),
  submitCommand: async (submittedCommand) => {
    const acknowledgement = await lossAdapter.submitCommand(submittedCommand);
    if (loseFirstAcknowledgement) {
      loseFirstAcknowledgement = false;
      throw new SalesErpError({
        code: "PROVIDER_UNAVAILABLE",
        message: "Simulated connection loss after provider acceptance",
        retryable: true,
      });
    }
    return acknowledgement;
  },
};
const replayCommand = buildSalesErpCommand({
  commandId: "ledger-replay-command-001",
  issuedAt: fixedNow.toISOString(),
  commandType: "consumables-request.create",
  businessKey: "consumables:ledger-001",
  context: command.context,
  payload: {
    localRequestId: "ledger-consumables-001",
    requestedAt: fixedNow.toISOString(),
    lines: [{ articleExternalId: "mock-article-ehbo-001", quantity: "1.000", unit: "ST" }],
  },
});
await assert.rejects(() => lostAcknowledgementPort.submitCommand(replayCommand));
const replayAcknowledgement = await lostAcknowledgementPort.submitCommand(replayCommand);
assert.equal(replayAcknowledgement.status, "ACCEPTED");
assert.equal(lossAdapter.inspectSubmittedCommands().length, 1);

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/0040_sales_erp_integration_ledger/migration.sql", "utf8");
for (const model of [
  "ErpInboxMessage",
  "ErpOutboxCommand",
  "ErpOutboxDependency",
  "ErpReplicaCheckpoint",
  "ErpReconciliationIncident",
]) {
  assert(schema.includes(`model ${model}`));
  assert(migration.includes(`CREATE TABLE \`${model}\``));
}
assert(migration.includes("ErpInboxMessage_provider_messageId_key"));
assert(migration.includes("ErpOutboxCommand_provider_idempotencyKey_key"));
assert(migration.includes("ErpOutboxDependency_dependsOnCommandId_fkey"));
assert.equal(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i.test(migration), false);

console.log(
  "Sales ERP-ledger: serialisatie, integriteitscontrole, backoff, acknowledgement replay en additieve migratie gevalideerd.",
);
}

void main();
