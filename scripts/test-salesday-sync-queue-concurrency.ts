import assert from "node:assert/strict";

import { SalesDayDeviceSyncQueue } from "../lib/device/sync-queue";
import {
  EncryptedDeviceStore,
  importDeviceStoreKey,
  type DeviceStoreQuarantineRecord,
  type EncryptedDeviceStoreDriver,
  type EncryptedDeviceStoreEnvelope,
} from "../lib/device/encrypted-store";
import { buildSalesErpCommand } from "../lib/server/integrations/sales-erp";

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
  const key = await importDeviceStoreKey(Uint8Array.from({ length: 32 }, (_, index) => index + 30));
  const encryptedStore = new EncryptedDeviceStore({
    namespace: "salesday-sync-concurrency",
    binding: { userId: "rep-sync-001", deviceId: "device-sync-001" },
    key,
    driver,
    now: () => now,
  });
  const queue = new SalesDayDeviceSyncQueue(encryptedStore, () => now);
  const command = buildSalesErpCommand({
    commandId: "command-concurrent-sync-001",
    issuedAt: now.toISOString(),
    commandType: "follow-up.create",
    businessKey: "follow-up:concurrent-sync-001",
    context: {
      actorUserId: "rep-sync-001",
      representativeExternalId: "rep-sync-001",
      deviceId: "device-sync-001",
      country: "BE",
      appointmentExternalId: "appointment-sync-001",
    },
    payload: {
      appointmentExternalId: "appointment-sync-001",
      localFollowUpId: "local-follow-up-concurrent-sync-001",
      customerExternalId: "customer-sync-001",
      type: "BACKOFFICE",
      description: "Gelijktijdige synchronisatie",
    },
  });
  await queue.enqueue({ provider: "MOCK", command, businessDate: "2026-07-16" });

  let releaseUpload!: () => void;
  const uploadGate = new Promise<void>((resolve) => { releaseUpload = resolve; });
  let markUploadStarted!: () => void;
  const uploadStarted = new Promise<void>((resolve) => { markUploadStarted = resolve; });
  const activeSync = queue.syncOnce(async (batch) => {
    markUploadStarted();
    await uploadGate;
    return { persistedCommandIds: batch.items.map((item) => item.command.commandId) };
  });
  await uploadStarted;
  const concurrentSync = await queue.syncOnce(async () => {
    throw new Error("Een tweede transport mag niet starten.");
  });
  assert.equal(concurrentSync.status, "busy");
  releaseUpload();
  assert.equal((await activeSync).status, "uploaded");
  assert.equal((await queue.summary()).open, 0);
  await assert.rejects(
    () => queue.enqueue({
      provider: "MOCK",
      command: { ...command, commandId: "command-concurrent-sync-rebuilt-001" },
      businessDate: "2026-07-16",
    }),
    /reeds bewaard ERP-commando/,
  );

  console.log("SalesDay sync queue: gelijktijdige upload en hergebruik van idempotentie worden veilig geweigerd.");
}

void main();
