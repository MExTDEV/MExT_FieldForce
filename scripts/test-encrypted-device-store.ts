import assert from "node:assert/strict";

import {
  DeviceStoreError,
  EncryptedDeviceStore,
  importDeviceStoreKey,
  type DeviceStoreQuarantineRecord,
  type EncryptedDeviceStoreDriver,
  type EncryptedDeviceStoreEnvelope,
} from "../lib/device/encrypted-store";

class MemoryDeviceStoreDriver implements EncryptedDeviceStoreDriver {
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

  envelope(recordKey: string) {
    for (const value of this.records.values()) {
      const envelope = value as EncryptedDeviceStoreEnvelope;
      if (envelope.recordKey === recordKey) return envelope;
    }
    throw new Error(`Record ${recordKey} ontbreekt in de memory driver.`);
  }
}

async function main() {
  const driver = new MemoryDeviceStoreDriver();
  const key = await importDeviceStoreKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
  const binding = { userId: "rep-offline-001", deviceId: "tablet-offline-001" };
  const extractableKey = await globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  assert.throws(
    () => new EncryptedDeviceStore({ namespace: "salesday", binding, key: extractableKey, driver }),
    (error: unknown) => error instanceof DeviceStoreError && error.code === "INVALID_KEY",
  );
  const store = new EncryptedDeviceStore({
    namespace: "salesday",
    binding,
    key,
    driver,
    now: () => new Date("2026-07-16T18:00:00.000Z"),
  });

  await store.write("draft-basic", { customerName: "Sensitive Customer", amount: 42 }, 1);
  const encryptedEnvelope = driver.envelope("draft-basic");
  assert.equal(encryptedEnvelope.bindingHash.length > 0, true);
  assert.equal(encryptedEnvelope.payloadVersion, 1);
  assert.equal(JSON.stringify(encryptedEnvelope).includes("Sensitive Customer"), false);
  assert.equal(JSON.stringify(encryptedEnvelope).includes(binding.userId), false);
  assert.equal(JSON.stringify(encryptedEnvelope).includes(binding.deviceId), false);

  const basicRead = await store.read<{ customerName: string; amount: number }>("draft-basic", {
    targetVersion: 1,
  });
  assert.equal(basicRead.status, "found");
  if (basicRead.status === "found") {
    assert.deepEqual(basicRead.value, { customerName: "Sensitive Customer", amount: 42 });
    assert.equal(basicRead.migrated, false);
  }

  const otherBindingStore = new EncryptedDeviceStore({
    namespace: "salesday",
    binding: { ...binding, deviceId: "tablet-offline-002" },
    key,
    driver,
  });
  await assert.rejects(
    () => otherBindingStore.read("draft-basic", { targetVersion: 1 }),
    (error: unknown) => error instanceof DeviceStoreError && error.code === "BINDING_MISMATCH",
  );
  const otherUserStore = new EncryptedDeviceStore({
    namespace: "salesday",
    binding: { ...binding, userId: "rep-offline-002" },
    key,
    driver,
  });
  await assert.rejects(
    () => otherUserStore.read("draft-basic", { targetVersion: 1 }),
    (error: unknown) => error instanceof DeviceStoreError && error.code === "BINDING_MISMATCH",
  );
  assert.equal(driver.quarantine.length, 0);
  assert.equal(driver.records.size, 1);

  await store.write("draft-migration", { customerName: "Migrating Customer" }, 1);
  await assert.rejects(
    () => store.read("draft-migration", { targetVersion: 2 }),
    (error: unknown) => error instanceof DeviceStoreError && error.code === "MIGRATION_REQUIRED",
  );
  const migratedRead = await store.read<{ customerName: string; confirmed: boolean }>("draft-migration", {
    targetVersion: 2,
    migrations: {
      1: (value) => ({ ...(value as { customerName: string }), confirmed: false }),
    },
  });
  assert.equal(migratedRead.status, "found");
  if (migratedRead.status === "found") {
    assert.equal(migratedRead.migrated, true);
    assert.equal(migratedRead.payloadVersion, 2);
    assert.deepEqual(migratedRead.value, { customerName: "Migrating Customer", confirmed: false });
  }
  const migratedReadAgain = await store.read("draft-migration", { targetVersion: 2 });
  assert.equal(migratedReadAgain.status, "found");
  if (migratedReadAgain.status === "found") assert.equal(migratedReadAgain.migrated, false);

  await store.write("draft-corrupt", { note: "Must be quarantined" }, 1);
  const corruptEnvelope = driver.envelope("draft-corrupt");
  corruptEnvelope.ciphertext = `${corruptEnvelope.ciphertext[0] === "A" ? "B" : "A"}${corruptEnvelope.ciphertext.slice(1)}`;
  const corruptRead = await store.read("draft-corrupt", { targetVersion: 1 });
  assert.deepEqual(corruptRead, {
    status: "corrupt",
    reason: "DECRYPTION_FAILED",
    quarantined: true,
  });
  assert.equal(driver.quarantine.length, 1);
  assert.deepEqual(Object.keys(driver.quarantine[0]).sort(), ["quarantinedAt", "reason", "storageKey"]);
  assert.equal(JSON.stringify(driver.quarantine[0]).includes("Must be quarantined"), false);
  assert.throws(() => driver.envelope("draft-corrupt"), /ontbreekt/);

  await store.write("draft-wipe", { pending: true }, 1);
  const wipedRecordCount = await store.wipe();
  assert.equal(wipedRecordCount, 4);
  assert.equal(driver.records.size, 0);
  assert.equal(driver.quarantine.length, 0);
  assert.deepEqual(await store.read("draft-basic", { targetVersion: 1 }), { status: "missing" });

  console.log(
    "Encrypted device store: encryptie, user/device-binding, payloadmigratie, quarantaine en remote-wipe hook gevalideerd.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
