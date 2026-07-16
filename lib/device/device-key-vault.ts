import { DeviceStoreError, importDeviceStoreKey } from "./encrypted-store";

export type DeviceKeyVaultRecord = {
  deviceId: string;
  keyVersion: number;
  fingerprint: string;
  key: CryptoKey;
  provisionedAt: string;
};

export interface DeviceKeyVaultDriver {
  get(deviceId: string): Promise<DeviceKeyVaultRecord | null>;
  put(record: DeviceKeyVaultRecord): Promise<void>;
  remove(deviceId: string): Promise<void>;
  clear(): Promise<number>;
}

export type ProvisionLocalDeviceKeyOptions = {
  deviceId: string;
  keyVersion: number;
  driver: DeviceKeyVaultDriver;
  crypto?: Crypto;
  now?: () => Date;
};

export async function provisionLocalDeviceKey(options: ProvisionLocalDeviceKeyOptions) {
  assertIdentifier(options.deviceId, "deviceId");
  assertKeyVersion(options.keyVersion);
  const crypto = requireCrypto(options.crypto);
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  try {
    const fingerprint = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", rawKey)));
    const key = await importDeviceStoreKey(rawKey, crypto);
    const record: DeviceKeyVaultRecord = {
      deviceId: options.deviceId,
      keyVersion: options.keyVersion,
      fingerprint,
      key,
      provisionedAt: (options.now ?? (() => new Date()))().toISOString(),
    };
    await options.driver.put(record);
    return { key, keyVersion: record.keyVersion, fingerprint, provisionedAt: record.provisionedAt };
  } finally {
    rawKey.fill(0);
  }
}

export async function loadLocalDeviceKey(options: {
  deviceId: string;
  expectedKeyVersion: number;
  expectedFingerprint: string;
  driver: DeviceKeyVaultDriver;
}) {
  assertIdentifier(options.deviceId, "deviceId");
  assertKeyVersion(options.expectedKeyVersion);
  assertFingerprint(options.expectedFingerprint);
  const record = await options.driver.get(options.deviceId);
  if (!record) return { status: "missing" } as const;
  if (
    record.keyVersion !== options.expectedKeyVersion ||
    !constantTimeTextEqual(record.fingerprint, options.expectedFingerprint)
  ) {
    await options.driver.remove(options.deviceId);
    return { status: "mismatch", removed: true } as const;
  }
  assertVaultKey(record.key);
  return { status: "found", ...record } as const;
}

export class IndexedDbDeviceKeyVault implements DeviceKeyVaultDriver {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly databaseName = "fieldforce-device-key-vault",
    private readonly indexedDb: IDBFactory | undefined = globalThis.indexedDB,
  ) {}

  async get(deviceId: string) {
    const database = await this.open();
    const transaction = database.transaction("keys", "readonly");
    const completion = transactionCompletion(transaction);
    const record = await requestResult<DeviceKeyVaultRecord | undefined>(
      transaction.objectStore("keys").get(deviceId),
    );
    await completion;
    return record ?? null;
  }

  async put(record: DeviceKeyVaultRecord) {
    assertVaultKey(record.key);
    assertKeyVersion(record.keyVersion);
    assertFingerprint(record.fingerprint);
    const database = await this.open();
    const transaction = database.transaction("keys", "readwrite");
    const completion = transactionCompletion(transaction);
    await requestResult(transaction.objectStore("keys").put(record));
    await completion;
  }

  async remove(deviceId: string) {
    const database = await this.open();
    const transaction = database.transaction("keys", "readwrite");
    const completion = transactionCompletion(transaction);
    await requestResult(transaction.objectStore("keys").delete(deviceId));
    await completion;
  }

  async clear() {
    const database = await this.open();
    const transaction = database.transaction("keys", "readwrite");
    const completion = transactionCompletion(transaction);
    const store = transaction.objectStore("keys");
    const count = await requestResult(store.count());
    await requestResult(store.clear());
    await completion;
    return count;
  }

  async close() {
    if (!this.databasePromise) return;
    const database = await this.databasePromise;
    database.close();
    this.databasePromise = null;
  }

  private open() {
    if (this.databasePromise) return this.databasePromise;
    if (!this.indexedDb) return Promise.reject(new Error("IndexedDB is niet beschikbaar in deze runtime."));
    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.indexedDb!.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("keys")) {
          request.result.createObjectStore("keys", { keyPath: "deviceId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Device key vault kon niet worden geopend."));
      request.onblocked = () => reject(new Error("Device key vault-upgrade is geblokkeerd door een andere app-sessie."));
    });
    return this.databasePromise;
  }
}

function assertVaultKey(key: CryptoKey) {
  const algorithm = key.algorithm as AesKeyAlgorithm;
  if (
    key.type !== "secret" ||
    key.extractable ||
    algorithm.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    !key.usages.includes("encrypt") ||
    !key.usages.includes("decrypt")
  ) {
    throw new DeviceStoreError("INVALID_KEY", "De key vault accepteert alleen een niet-exporteerbare AES-256-GCM-sleutel.");
  }
}

function assertIdentifier(value: string, label: string) {
  if (!value.trim()) throw new DeviceStoreError("INVALID_ARGUMENT", `${label} is verplicht.`);
}

function assertKeyVersion(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "keyVersion moet een positief geheel getal zijn.");
  }
}

function assertFingerprint(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "Ongeldige sleutelfingerprint.");
  }
}

function requireCrypto(override?: Crypto) {
  const crypto = override ?? globalThis.crypto;
  if (!crypto?.subtle) throw new DeviceStoreError("CRYPTO_UNAVAILABLE", "Web Crypto is niet beschikbaar.");
  return crypto;
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeTextEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

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
