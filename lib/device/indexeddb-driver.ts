import type {
  DeviceStoreQuarantineRecord,
  EncryptedDeviceStoreDriver,
  EncryptedDeviceStoreEnvelope,
} from "./encrypted-store";

const DEFAULT_DATABASE_NAME = "fieldforce-device-store";
const DATABASE_VERSION = 1;
const RECORDS_STORE = "records";
const QUARANTINE_STORE = "quarantine";

type StoredEnvelope = {
  storageKey: string;
  envelope: EncryptedDeviceStoreEnvelope;
};

type StoredQuarantineRecord = DeviceStoreQuarantineRecord & {
  id?: number;
};

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB-request mislukt."));
  });
}

function transactionCompletion(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-transactie werd afgebroken."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB-transactie mislukt."));
  });
}

export class IndexedDbDeviceStoreDriver implements EncryptedDeviceStoreDriver {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly databaseName = DEFAULT_DATABASE_NAME,
    private readonly indexedDb: IDBFactory | undefined = globalThis.indexedDB,
  ) {}

  async get(storageKey: string) {
    const database = await this.open();
    const transaction = database.transaction(RECORDS_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const stored = await requestResult<StoredEnvelope | undefined>(
      transaction.objectStore(RECORDS_STORE).get(storageKey),
    );
    await completion;
    return stored?.envelope ?? null;
  }

  async put(storageKey: string, envelope: EncryptedDeviceStoreEnvelope) {
    const database = await this.open();
    const transaction = database.transaction(RECORDS_STORE, "readwrite");
    const completion = transactionCompletion(transaction);
    await requestResult(transaction.objectStore(RECORDS_STORE).put({ storageKey, envelope } satisfies StoredEnvelope));
    await completion;
  }

  async remove(storageKey: string) {
    const database = await this.open();
    const transaction = database.transaction(RECORDS_STORE, "readwrite");
    const completion = transactionCompletion(transaction);
    await requestResult(transaction.objectStore(RECORDS_STORE).delete(storageKey));
    await completion;
  }

  async quarantineAndRemove(record: DeviceStoreQuarantineRecord) {
    const database = await this.open();
    const transaction = database.transaction([RECORDS_STORE, QUARANTINE_STORE], "readwrite");
    const completion = transactionCompletion(transaction);
    const quarantineRecord: StoredQuarantineRecord = { ...record };
    await Promise.all([
      requestResult(transaction.objectStore(QUARANTINE_STORE).add(quarantineRecord)),
      requestResult(transaction.objectStore(RECORDS_STORE).delete(record.storageKey)),
    ]);
    await completion;
  }

  async clear() {
    const database = await this.open();
    const transaction = database.transaction([RECORDS_STORE, QUARANTINE_STORE], "readwrite");
    const completion = transactionCompletion(transaction);
    const recordsStore = transaction.objectStore(RECORDS_STORE);
    const quarantineStore = transaction.objectStore(QUARANTINE_STORE);
    const [recordCount, quarantineCount] = await Promise.all([
      requestResult(recordsStore.count()),
      requestResult(quarantineStore.count()),
    ]);
    await Promise.all([
      requestResult(recordsStore.clear()),
      requestResult(quarantineStore.clear()),
    ]);
    await completion;
    return recordCount + quarantineCount;
  }

  async close() {
    if (!this.databasePromise) return;
    const database = await this.databasePromise;
    database.close();
    this.databasePromise = null;
  }

  private open() {
    if (this.databasePromise) return this.databasePromise;
    if (!this.indexedDb) {
      return Promise.reject(new Error("IndexedDB is niet beschikbaar in deze runtime."));
    }

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.indexedDb!.open(this.databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RECORDS_STORE)) {
          database.createObjectStore(RECORDS_STORE, { keyPath: "storageKey" });
        }
        if (!database.objectStoreNames.contains(QUARANTINE_STORE)) {
          database.createObjectStore(QUARANTINE_STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB kon niet worden geopend."));
      request.onblocked = () => reject(new Error("IndexedDB-upgrade is geblokkeerd door een andere app-sessie."));
    });
    return this.databasePromise;
  }
}
