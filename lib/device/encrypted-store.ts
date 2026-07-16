export const DEVICE_STORE_FORMAT_VERSION = 1;

export type DeviceStoreBinding = {
  userId: string;
  deviceId: string;
};

export type EncryptedDeviceStoreEnvelope = {
  formatVersion: typeof DEVICE_STORE_FORMAT_VERSION;
  namespace: string;
  recordKey: string;
  bindingHash: string;
  payloadVersion: number;
  iv: string;
  ciphertext: string;
  savedAt: string;
};

export type DeviceStoreQuarantineReason =
  | "INVALID_ENVELOPE"
  | "DECRYPTION_FAILED"
  | "INVALID_PAYLOAD"
  | "MIGRATION_FAILED";

export type DeviceStoreQuarantineRecord = {
  storageKey: string;
  reason: DeviceStoreQuarantineReason;
  quarantinedAt: string;
};

export interface EncryptedDeviceStoreDriver {
  get(storageKey: string): Promise<unknown | null>;
  put(storageKey: string, envelope: EncryptedDeviceStoreEnvelope): Promise<void>;
  remove(storageKey: string): Promise<void>;
  quarantineAndRemove(record: DeviceStoreQuarantineRecord): Promise<void>;
  clear(): Promise<number>;
}

export type DeviceStoreMigration = (value: unknown) => unknown;

export type DeviceStoreReadOptions = {
  targetVersion: number;
  migrations?: Readonly<Record<number, DeviceStoreMigration>>;
};

export type DeviceStoreReadResult<T> =
  | { status: "missing" }
  | {
      status: "found";
      value: T;
      payloadVersion: number;
      savedAt: string;
      migrated: boolean;
    }
  | {
      status: "corrupt";
      reason: DeviceStoreQuarantineReason;
      quarantined: true;
    };

export type DeviceStoreErrorCode =
  | "CRYPTO_UNAVAILABLE"
  | "INVALID_ARGUMENT"
  | "INVALID_KEY"
  | "BINDING_MISMATCH"
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_PAYLOAD_VERSION"
  | "MIGRATION_REQUIRED"
  | "SERIALIZATION_FAILED";

export class DeviceStoreError extends Error {
  constructor(
    public readonly code: DeviceStoreErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DeviceStoreError";
  }
}

type EncryptedDeviceStoreOptions = {
  namespace: string;
  binding: DeviceStoreBinding;
  key: CryptoKey;
  driver: EncryptedDeviceStoreDriver;
  crypto?: Crypto;
  now?: () => Date;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) {
    throw new DeviceStoreError("INVALID_ARGUMENT", `${label} is verplicht.`);
  }
}

function assertPayloadVersion(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DeviceStoreError("INVALID_ARGUMENT", `${label} moet een positief geheel getal zijn.`);
  }
}

function assertKey(key: CryptoKey) {
  const algorithm = key.algorithm as AesKeyAlgorithm;
  if (
    key.type !== "secret" ||
    key.extractable ||
    algorithm.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    !key.usages.includes("encrypt") ||
    !key.usages.includes("decrypt")
  ) {
    throw new DeviceStoreError(
      "INVALID_KEY",
      "De device store vereist een niet-exporteerbare AES-256-GCM-sleutel voor encryptie en decryptie.",
    );
  }
}

function getCrypto(cryptoOverride?: Crypto) {
  const crypto = cryptoOverride ?? globalThis.crypto;
  if (!crypto?.subtle) {
    throw new DeviceStoreError("CRYPTO_UNAVAILABLE", "Web Crypto is niet beschikbaar in deze runtime.");
  }
  return crypto;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createStorageKey(namespace: string, recordKey: string) {
  return `fieldforce-device:${JSON.stringify([namespace, recordKey])}`;
}

function createAdditionalData(envelope: Pick<
  EncryptedDeviceStoreEnvelope,
  "formatVersion" | "namespace" | "recordKey" | "bindingHash" | "payloadVersion" | "savedAt"
>) {
  return encoder.encode(JSON.stringify([
    envelope.formatVersion,
    envelope.namespace,
    envelope.recordKey,
    envelope.bindingHash,
    envelope.payloadVersion,
    envelope.savedAt,
  ]));
}

function isEncryptedEnvelope(value: unknown): value is EncryptedDeviceStoreEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<EncryptedDeviceStoreEnvelope>;
  return (
    typeof envelope.formatVersion === "number" &&
    typeof envelope.namespace === "string" &&
    typeof envelope.recordKey === "string" &&
    typeof envelope.bindingHash === "string" &&
    typeof envelope.payloadVersion === "number" &&
    typeof envelope.iv === "string" &&
    typeof envelope.ciphertext === "string" &&
    typeof envelope.savedAt === "string"
  );
}

export async function importDeviceStoreKey(rawKey: Uint8Array, cryptoOverride?: Crypto) {
  if (rawKey.byteLength !== 32) {
    throw new DeviceStoreError("INVALID_KEY", "De device store vereist exact 32 sleutelbytes.");
  }
  const crypto = getCrypto(cryptoOverride);
  const keyBytes = Uint8Array.from(rawKey);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export class EncryptedDeviceStore {
  private readonly namespace: string;
  private readonly binding: DeviceStoreBinding;
  private readonly key: CryptoKey;
  private readonly driver: EncryptedDeviceStoreDriver;
  private readonly crypto: Crypto;
  private readonly now: () => Date;
  private readonly bindingHash: Promise<string>;

  constructor(options: EncryptedDeviceStoreOptions) {
    assertNonEmpty(options.namespace, "namespace");
    assertNonEmpty(options.binding.userId, "userId");
    assertNonEmpty(options.binding.deviceId, "deviceId");
    assertKey(options.key);

    this.namespace = options.namespace;
    this.binding = { ...options.binding };
    this.key = options.key;
    this.driver = options.driver;
    this.crypto = getCrypto(options.crypto);
    this.now = options.now ?? (() => new Date());
    this.bindingHash = this.createBindingHash();
  }

  async write<T>(recordKey: string, value: T, payloadVersion: number) {
    assertNonEmpty(recordKey, "recordKey");
    assertPayloadVersion(payloadVersion, "payloadVersion");

    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      throw new DeviceStoreError("SERIALIZATION_FAILED", "Het lokale record kan niet worden geserialiseerd.", {
        cause: error,
      });
    }
    if (serialized === undefined) {
      throw new DeviceStoreError("SERIALIZATION_FAILED", "Het lokale record heeft geen serialiseerbare waarde.");
    }

    const envelopeBase = {
      formatVersion: DEVICE_STORE_FORMAT_VERSION,
      namespace: this.namespace,
      recordKey,
      bindingHash: await this.bindingHash,
      payloadVersion,
      savedAt: this.now().toISOString(),
    } as const;
    const iv = this.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await this.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: createAdditionalData(envelopeBase),
        tagLength: 128,
      },
      this.key,
      encoder.encode(serialized),
    );
    const envelope: EncryptedDeviceStoreEnvelope = {
      ...envelopeBase,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
    await this.driver.put(createStorageKey(this.namespace, recordKey), envelope);
    return envelope.savedAt;
  }

  async read<T>(recordKey: string, options: DeviceStoreReadOptions): Promise<DeviceStoreReadResult<T>> {
    assertNonEmpty(recordKey, "recordKey");
    assertPayloadVersion(options.targetVersion, "targetVersion");

    const storageKey = createStorageKey(this.namespace, recordKey);
    const storedRecord = await this.driver.get(storageKey);
    if (storedRecord === null) return { status: "missing" };

    if (!isEncryptedEnvelope(storedRecord)) {
      return this.quarantine(storageKey, "INVALID_ENVELOPE");
    }
    if (storedRecord.formatVersion !== DEVICE_STORE_FORMAT_VERSION) {
      throw new DeviceStoreError(
        "UNSUPPORTED_FORMAT",
        `Niet-ondersteunde device-storeversie ${storedRecord.formatVersion}.`,
      );
    }
    if (storedRecord.namespace !== this.namespace || storedRecord.recordKey !== recordKey) {
      return this.quarantine(storageKey, "INVALID_ENVELOPE");
    }
    if (storedRecord.bindingHash !== await this.bindingHash) {
      throw new DeviceStoreError("BINDING_MISMATCH", "Het lokale record behoort tot een andere gebruiker of toestel.");
    }
    assertPayloadVersion(storedRecord.payloadVersion, "opgeslagen payloadVersion");
    if (storedRecord.payloadVersion > options.targetVersion) {
      throw new DeviceStoreError(
        "UNSUPPORTED_PAYLOAD_VERSION",
        `Payloadversie ${storedRecord.payloadVersion} is nieuwer dan ondersteunde versie ${options.targetVersion}.`,
      );
    }

    let plaintext: ArrayBuffer;
    try {
      plaintext = await this.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64ToBytes(storedRecord.iv),
          additionalData: createAdditionalData(storedRecord),
          tagLength: 128,
        },
        this.key,
        base64ToBytes(storedRecord.ciphertext),
      );
    } catch {
      return this.quarantine(storageKey, "DECRYPTION_FAILED");
    }

    let value: unknown;
    try {
      value = JSON.parse(decoder.decode(plaintext));
    } catch {
      return this.quarantine(storageKey, "INVALID_PAYLOAD");
    }

    let payloadVersion = storedRecord.payloadVersion;
    let migrated = false;
    while (payloadVersion < options.targetVersion) {
      const migration = options.migrations?.[payloadVersion];
      if (!migration) {
        throw new DeviceStoreError(
          "MIGRATION_REQUIRED",
          `Migratie van payloadversie ${payloadVersion} naar ${payloadVersion + 1} ontbreekt.`,
        );
      }
      try {
        value = migration(value);
      } catch {
        return this.quarantine(storageKey, "MIGRATION_FAILED");
      }
      payloadVersion += 1;
      migrated = true;
    }

    let savedAt = storedRecord.savedAt;
    if (migrated) {
      savedAt = await this.write(recordKey, value, payloadVersion);
    }

    return {
      status: "found",
      value: value as T,
      payloadVersion,
      savedAt,
      migrated,
    };
  }

  async remove(recordKey: string) {
    assertNonEmpty(recordKey, "recordKey");
    await this.driver.remove(createStorageKey(this.namespace, recordKey));
  }

  async wipe() {
    return this.driver.clear();
  }

  private async quarantine(storageKey: string, reason: DeviceStoreQuarantineReason): Promise<DeviceStoreReadResult<never>> {
    await this.driver.quarantineAndRemove({
      storageKey,
      reason,
      quarantinedAt: this.now().toISOString(),
    });
    return { status: "corrupt", reason, quarantined: true };
  }

  private async createBindingHash() {
    const digest = await this.crypto.subtle.digest(
      "SHA-256",
      encoder.encode(JSON.stringify([this.binding.userId, this.binding.deviceId])),
    );
    return bytesToBase64(new Uint8Array(digest));
  }
}
