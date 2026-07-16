import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DeviceSyncTransportError,
  SalesDayDeviceSyncQueue,
} from "../lib/device/sync-queue";
import {
  EncryptedDeviceStore,
  importDeviceStoreKey,
  type DeviceStoreQuarantineRecord,
  type EncryptedDeviceStoreDriver,
  type EncryptedDeviceStoreEnvelope,
} from "../lib/device/encrypted-store";
import { buildSalesErpCommand } from "../lib/server/integrations/sales-erp";
import {
  assertOfflineCommandActor,
  parseOfflineSalesErpCommandItems,
} from "../lib/server/salesday-offline-sync";
import type { MockUser } from "../lib/types";

class MemoryEncryptedDriver implements EncryptedDeviceStoreDriver {
  readonly records = new Map<string, unknown>();
  readonly quarantine: DeviceStoreQuarantineRecord[] = [];

  async get(storageKey: string) {
    return this.records.get(storageKey) ?? null;
  }

  async put(storageKey: string, envelope: EncryptedDeviceStoreEnvelope) {
    this.records.set(storageKey, structuredClone(envelope));
  }

  async remove(storageKey: string) {
    this.records.delete(storageKey);
  }

  async quarantineAndRemove(record: DeviceStoreQuarantineRecord) {
    this.quarantine.push(structuredClone(record));
    this.records.delete(record.storageKey);
  }

  async clear() {
    const count = this.records.size + this.quarantine.length;
    this.records.clear();
    this.quarantine.splice(0);
    return count;
  }
}

async function main() {
  const now = new Date("2026-07-16T23:00:00.000Z");
  const driver = new MemoryEncryptedDriver();
  const key = await importDeviceStoreKey(Uint8Array.from({ length: 32 }, (_, index) => index + 20));
  const encryptedStore = new EncryptedDeviceStore({
    namespace: "salesday-sync",
    binding: { userId: "rep-sync-001", deviceId: "device-sync-001" },
    key,
    driver,
    now: () => now,
  });
  const queue = new SalesDayDeviceSyncQueue(encryptedStore, () => now);
  const context = {
    actorUserId: "rep-sync-001",
    representativeExternalId: "rep-sync-001",
    deviceId: "device-sync-001",
    country: "BE" as const,
    appointmentExternalId: "appointment-sync-001",
  };
  const appointment = buildSalesErpCommand({
    commandId: "command-appointment-sync-001",
    issuedAt: now.toISOString(),
    commandType: "appointment.upsert",
    businessKey: "appointment:sync-001",
    context,
    payload: {
      localAppointmentId: "local-appointment-sync-001",
      businessDate: "2026-07-16",
      timeZone: "Europe/Brussels",
      sequence: 1,
      customerExternalId: "customer-sync-001",
      representativeExternalId: "rep-sync-001",
    },
  });
  const visitReport = buildSalesErpCommand({
    commandId: "command-report-sync-001",
    issuedAt: now.toISOString(),
    commandType: "visit-report.submit",
    businessKey: "visit-report:sync-001",
    context,
    dependsOnCommandIds: [appointment.commandId],
    payload: {
      appointmentExternalId: "appointment-sync-001",
      localReportId: "local-report-sync-001",
      html: "<p>Verslag met gevoelige inhoud</p>",
      closedAt: now.toISOString(),
    },
  });

  await assert.rejects(
    () => queue.enqueue({ provider: "MOCK", command: visitReport, businessDate: "2026-07-16" }),
    /niet gekend/,
  );
  assert.equal((await queue.enqueue({ provider: "MOCK", command: appointment, businessDate: "2026-07-16" })).status, "queued");
  assert.equal((await queue.enqueue({ provider: "MOCK", command: appointment, businessDate: "2026-07-16" })).status, "already-queued");
  await queue.enqueue({ provider: "MOCK", command: visitReport, businessDate: "2026-07-16" });
  const rawQueue = JSON.stringify([...driver.records.values()][0]);
  assert.equal(rawQueue.includes("Verslag met gevoelige inhoud"), false);
  assert.equal(rawQueue.includes("customer-sync-001"), false);

  const uploadedBatches: string[][] = [];
  const send = async (batch: { items: Array<{ command: { commandId: string } }> }) => {
    const ids = batch.items.map((item) => item.command.commandId);
    uploadedBatches.push(ids);
    return { persistedCommandIds: ids };
  };
  const firstSync = await queue.syncOnce(send);
  assert.equal(firstSync.status, "uploaded");
  assert.deepEqual(uploadedBatches[0], [appointment.commandId]);
  const secondSync = await queue.syncOnce(send);
  assert.equal(secondSync.status, "uploaded");
  assert.deepEqual(uploadedBatches[1], [visitReport.commandId]);
  assert.equal((await queue.summary()).open, 0);

  const lostAcknowledgement = buildSalesErpCommand({
    commandId: "command-lost-ack-sync-001",
    issuedAt: now.toISOString(),
    commandType: "follow-up.create",
    businessKey: "follow-up:sync-001",
    context,
    payload: {
      appointmentExternalId: "appointment-sync-001",
      localFollowUpId: "local-follow-up-sync-001",
      customerExternalId: "customer-sync-001",
      type: "BACKOFFICE",
      description: "Opvolging",
    },
  });
  await queue.enqueue({ provider: "MOCK", command: lostAcknowledgement, businessDate: "2026-07-16" });
  const serverPersisted = new Set<string>();
  const lostResult = await queue.syncOnce(async (batch) => {
    for (const item of batch.items) serverPersisted.add(item.command.commandId);
    throw new DeviceSyncTransportError("Netwerk weg na duurzame serveropslag", true, "ACK_LOST");
  });
  assert.equal(lostResult.status, "retryable");
  assert.equal(serverPersisted.has(lostAcknowledgement.commandId), true);
  await queue.retry(lostAcknowledgement.commandId);
  const replay = await queue.syncOnce(async (batch) => ({
    persistedCommandIds: batch.items.map((item) => item.command.commandId),
  }));
  assert.equal(replay.status, "uploaded");
  assert.equal((await queue.summary()).open, 0);

  const interrupted = buildSalesErpCommand({
    commandId: "command-interrupted-sync-001",
    issuedAt: now.toISOString(),
    commandType: "reference.create",
    businessKey: "reference:sync-001",
    context,
    payload: {
      appointmentExternalId: "appointment-sync-001",
      localReferenceId: "local-reference-sync-001",
      referringCustomerExternalId: "customer-sync-001",
      proposedName: "Nieuwe referentie",
    },
  });
  await queue.enqueue({ provider: "MOCK", command: interrupted });
  const storedQueue = await encryptedStore.read<{
    entries: Array<{ command: { commandId: string }; status: string }>;
    persistedCommands: unknown[];
    updatedAt: string;
  }>("sync-queue", { targetVersion: 1 });
  assert.equal(storedQueue.status, "found");
  if (storedQueue.status === "found") {
    const entry = storedQueue.value.entries.find((item) => item.command.commandId === interrupted.commandId)!;
    entry.status = "UPLOADING";
    await encryptedStore.write("sync-queue", storedQueue.value, 1);
  }
  assert.equal(await queue.recoverInterruptedUploads(), 1);
  assert.equal((await queue.summary()).retryable, 1);

  await queue.retry(interrupted.commandId);
  const rejected = await queue.syncOnce(async () => {
    throw new DeviceSyncTransportError("Commando definitief geweigerd", false, "INVALID_COMMAND");
  });
  assert.equal(rejected.status, "rejected");
  assert.equal((await queue.summary()).rejected, 1);

  const actor: MockUser = {
    id: "rep-sync-001",
    name: "Representative Sync",
    email: "rep-sync@example.test",
    role: "REPRESENTATIVE",
    country: "BE",
    countryAccess: ["BE"],
    language: "nl",
    representativeId: "rep-sync-001",
  };
  const parsed = parseOfflineSalesErpCommandItems([{ command: appointment, businessDate: "2026-07-16" }]);
  assertOfflineCommandActor(actor, context.deviceId, parsed);
  assert.throws(
    () => assertOfflineCommandActor(actor, "different-device", parsed),
    /buiten de aangemelde gebruiker/,
  );
  assert.throws(
    () => parseOfflineSalesErpCommandItems([{ command: { ...appointment, payload: "invalid" } }]),
    /Onvolledige synchronisatie-envelop/,
  );

  const serverSource = readFileSync("lib/server/salesday-offline-sync.ts", "utf8");
  const routeSource = readFileSync("app/api/salesday/sync/commands/route.ts", "utf8");
  assert(serverSource.includes("enqueueSalesErpCommandInTransaction"));
  assert(serverSource.includes("deviceTokenRevokedAt: null"));
  assert(serverSource.includes("loginSessions"));
  assert(routeSource.includes("requireAuthenticatedUserContext"));

  console.log(
    "SalesDay sync queue: versleutelde outbox, dependencies, crash recovery, acknowledgement-replay, retry/reject en server-binding gevalideerd.",
  );
}

void main();
