import assert from "node:assert/strict";

import {
  createSalesDayDraftAutosave,
  DraftAutosave,
  SalesDayDraftStore,
  type DraftAutosaveStatus,
} from "../lib/device/draft-store";
import {
  EncryptedDeviceStore,
  importDeviceStoreKey,
  type DeviceStoreQuarantineRecord,
  type EncryptedDeviceStoreDriver,
  type EncryptedDeviceStoreEnvelope,
} from "../lib/device/encrypted-store";

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
  const driver = new MemoryEncryptedDriver();
  const key = await importDeviceStoreKey(Uint8Array.from({ length: 32 }, (_, index) => 255 - index));
  const encryptedStore = new EncryptedDeviceStore({
    namespace: "salesday-drafts",
    binding: { userId: "rep-draft-001", deviceId: "device-draft-001" },
    key,
    driver,
    now: () => new Date("2026-07-16T22:00:00.000Z"),
  });
  const drafts = new SalesDayDraftStore(encryptedStore, () => new Date("2026-07-16T22:00:00.000Z"));

  const saved = await drafts.save({
    draftId: "visit-report-001",
    kind: "visit-report",
    businessDate: "2026-07-16",
    value: { appointmentId: "appointment-001", notes: "Vertrouwelijke bezoeknotitie" },
  });
  assert.equal(saved.updatedAt, "2026-07-16T22:00:00.000Z");
  const rawEnvelope = JSON.stringify([...driver.records.values()][0]);
  assert.equal(rawEnvelope.includes("Vertrouwelijke bezoeknotitie"), false);
  assert.equal(rawEnvelope.includes("appointment-001"), false);

  const recovered = await drafts.load<{ appointmentId: string; notes: string }>(
    "visit-report",
    "visit-report-001",
  );
  assert.equal(recovered.status, "found");
  if (recovered.status === "found") {
    assert.equal(recovered.value.value.notes, "Vertrouwelijke bezoeknotitie");
  }

  const encryptedAutosave = createSalesDayDraftAutosave<{ notes: string }>({
    store: drafts,
    draftId: "appointment-001",
    kind: "appointment",
    businessDate: "2026-07-16",
    debounceMs: 60_000,
  });
  encryptedAutosave.update({ notes: "tussenversie" });
  encryptedAutosave.update({ notes: "laatste versleutelde versie" });
  await encryptedAutosave.close();
  const autosavedDraft = await drafts.load<{ notes: string }>("appointment", "appointment-001");
  assert.equal(autosavedDraft.status, "found");
  if (autosavedDraft.status === "found") {
    assert.deepEqual(autosavedDraft.value.value, { notes: "laatste versleutelde versie" });
  }

  const statuses: DraftAutosaveStatus[] = [];
  const persistedValues: string[] = [];
  let failNextWrite = true;
  const autosave = new DraftAutosave<string>({
    debounceMs: 60_000,
    onStatus: (status) => statuses.push(status),
    save: async (value) => {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error("Simulated storage interruption");
      }
      persistedValues.push(value);
      return { savedAt: "2026-07-16T22:01:00.000Z" };
    },
  });
  autosave.update("eerste versie");
  autosave.update("laatste versie");
  await assert.rejects(() => autosave.flush(), /Simulated storage interruption/);
  assert.equal(statuses.at(-1)?.state, "error");
  await autosave.flush();
  assert.deepEqual(persistedValues, ["laatste versie"]);
  assert.equal(statuses.at(-1)?.state, "saved");
  await autosave.close();

  await drafts.discard("visit-report", "visit-report-001");
  assert.deepEqual(await drafts.load("visit-report", "visit-report-001"), { status: "missing" });

  const cancelled = new DraftAutosave<string>({
    debounceMs: 60_000,
    save: async () => ({ savedAt: new Date().toISOString() }),
  });
  cancelled.update("niet bewaren");
  cancelled.cancel();
  assert.throws(() => cancelled.update("gesloten"), /afgesloten/);

  console.log(
    "SalesDay draft store: versleutelde recovery, continue latest-value-autosave, foutretry, flush en discard gevalideerd.",
  );
}

void main();
