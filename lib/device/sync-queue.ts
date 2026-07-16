import type {
  SalesErpCommand,
  SalesErpProvider,
} from "../server/integrations/sales-erp/contracts";
import { DeviceStoreError, EncryptedDeviceStore } from "./encrypted-store";

export const SALES_DAY_SYNC_QUEUE_PAYLOAD_VERSION = 1;

export type DeviceSyncQueueStatus = "PENDING" | "UPLOADING" | "RETRYABLE" | "REJECTED";

export type DeviceSyncQueueEntry = {
  provider: SalesErpProvider;
  command: SalesErpCommand;
  businessDate?: string;
  status: DeviceSyncQueueStatus;
  attemptCount: number;
  queuedAt: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
};

type PersistedCommandMarker = {
  commandId: string;
  provider: SalesErpProvider;
  idempotencyKey: string;
  persistedAt: string;
};

type DeviceSyncQueueSnapshot = {
  entries: DeviceSyncQueueEntry[];
  persistedCommands: PersistedCommandMarker[];
  updatedAt: string;
};

export type DeviceSyncBatch = {
  provider: SalesErpProvider;
  items: Array<{ command: SalesErpCommand; businessDate?: string }>;
};

export type DeviceSyncBatchResult = {
  persistedCommandIds: string[];
};

export class DeviceSyncTransportError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly code = retryable ? "TRANSPORT_RETRYABLE" : "TRANSPORT_REJECTED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DeviceSyncTransportError";
  }
}

export class SalesDayDeviceSyncQueue {
  private synchronizing = false;

  constructor(
    private readonly encryptedStore: EncryptedDeviceStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async enqueue(input: {
    provider: SalesErpProvider;
    command: SalesErpCommand;
    businessDate?: string;
  }) {
    validateQueueInput(input);
    const snapshot = await this.loadSnapshot();
    if (snapshot.persistedCommands.some((marker) => marker.commandId === input.command.commandId)) {
      return { status: "already-persisted" as const };
    }
    const persistedIdempotency = snapshot.persistedCommands.find((marker) =>
      marker.provider === input.provider && marker.idempotencyKey === input.command.idempotencyKey,
    );
    if (persistedIdempotency) {
      throw new DeviceStoreError(
        "SERIALIZATION_FAILED",
        "Een reeds bewaard ERP-commando werd opnieuw opgebouwd met een ander commandId.",
      );
    }
    const existing = snapshot.entries.find((entry) => entry.command.commandId === input.command.commandId);
    if (existing) {
      if (stableJson(existing.command) !== stableJson(input.command) || existing.provider !== input.provider) {
        throw new DeviceStoreError("SERIALIZATION_FAILED", "Een lokaal commandId werd hergebruikt voor andere inhoud.");
      }
      return { status: "already-queued" as const, entry: existing };
    }
    const queuedIdempotency = snapshot.entries.find((entry) =>
      entry.provider === input.provider && entry.command.idempotencyKey === input.command.idempotencyKey,
    );
    if (queuedIdempotency) {
      throw new DeviceStoreError(
        "SERIALIZATION_FAILED",
        "Een lokaal ERP-commando werd opnieuw opgebouwd met een ander commandId.",
      );
    }
    const knownCommandIds = new Set([
      ...snapshot.entries.map((entry) => entry.command.commandId),
      ...snapshot.persistedCommands.map((marker) => marker.commandId),
    ]);
    const missingDependency = input.command.dependsOnCommandIds.find((commandId) => !knownCommandIds.has(commandId));
    if (missingDependency) {
      throw new DeviceStoreError(
        "INVALID_ARGUMENT",
        `Lokale afhankelijkheid ${missingDependency} is niet gekend door de synchronisatiewachtrij.`,
      );
    }
    const queuedAt = this.now().toISOString();
    const entry: DeviceSyncQueueEntry = {
      ...input,
      status: "PENDING",
      attemptCount: 0,
      queuedAt,
    };
    const entries = [...snapshot.entries, entry];
    assertAcyclic(entries);
    await this.saveSnapshot({ ...snapshot, entries, updatedAt: queuedAt });
    return { status: "queued" as const, entry };
  }

  async recoverInterruptedUploads() {
    const snapshot = await this.loadSnapshot();
    const now = this.now().toISOString();
    let recovered = 0;
    const entries = snapshot.entries.map((entry) => {
      if (entry.status !== "UPLOADING") return entry;
      recovered += 1;
      return {
        ...entry,
        status: "RETRYABLE" as const,
        nextAttemptAt: now,
        lastErrorCode: "UPLOAD_INTERRUPTED",
        lastErrorMessage: "De vorige upload werd onderbroken en wordt veilig herhaald.",
      };
    });
    if (recovered) await this.saveSnapshot({ ...snapshot, entries, updatedAt: now });
    return recovered;
  }

  async syncOnce(
    sendBatch: (batch: DeviceSyncBatch) => Promise<DeviceSyncBatchResult>,
    batchSize = 25,
  ) {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) {
      throw new DeviceStoreError("INVALID_ARGUMENT", "batchSize moet tussen 1 en 100 liggen.");
    }
    if (this.synchronizing) return { status: "busy" as const, uploaded: 0 };
    this.synchronizing = true;
    try {
      return await this.syncBatchOnce(sendBatch, batchSize);
    } finally {
      this.synchronizing = false;
    }
  }

  private async syncBatchOnce(
    sendBatch: (batch: DeviceSyncBatch) => Promise<DeviceSyncBatchResult>,
    batchSize: number,
  ) {
    await this.recoverInterruptedUploads();
    const snapshot = await this.loadSnapshot();
    const now = this.now();
    const persistedIds = new Set(snapshot.persistedCommands.map((marker) => marker.commandId));
    const ready = snapshot.entries.filter((entry) =>
      (entry.status === "PENDING" ||
        (entry.status === "RETRYABLE" && (!entry.nextAttemptAt || new Date(entry.nextAttemptAt) <= now))) &&
      entry.command.dependsOnCommandIds.every((commandId) => persistedIds.has(commandId)),
    );
    if (!ready.length) return { status: "idle" as const, uploaded: 0 };
    const provider = ready[0].provider;
    const selected = ready.filter((entry) => entry.provider === provider).slice(0, batchSize);
    const selectedIds = new Set(selected.map((entry) => entry.command.commandId));
    const attemptAt = now.toISOString();
    const uploadingEntries = snapshot.entries.map((entry) => selectedIds.has(entry.command.commandId)
      ? {
          ...entry,
          status: "UPLOADING" as const,
          attemptCount: entry.attemptCount + 1,
          lastAttemptAt: attemptAt,
          nextAttemptAt: undefined,
          lastErrorCode: undefined,
          lastErrorMessage: undefined,
        }
      : entry);
    await this.saveSnapshot({ ...snapshot, entries: uploadingEntries, updatedAt: attemptAt });

    try {
      const result = await sendBatch({
        provider,
        items: selected.map((entry) => ({ command: entry.command, businessDate: entry.businessDate })),
      });
      const returnedIds = new Set(result.persistedCommandIds);
      if (returnedIds.size !== selected.length || selected.some((entry) => !returnedIds.has(entry.command.commandId))) {
        throw new DeviceSyncTransportError("De server bevestigde niet elk geüpload commando.", true, "INCOMPLETE_CONFIRMATION");
      }
      const confirmedAt = this.now().toISOString();
      const current = await this.loadSnapshot();
      const persisted = new Map(current.persistedCommands.map((marker) => [marker.commandId, marker]));
      for (const entry of selected) {
        persisted.set(entry.command.commandId, {
          commandId: entry.command.commandId,
          provider: entry.provider,
          idempotencyKey: entry.command.idempotencyKey,
          persistedAt: confirmedAt,
        });
      }
      await this.saveSnapshot({
        entries: current.entries.filter((entry) => !returnedIds.has(entry.command.commandId)),
        persistedCommands: [...persisted.values()],
        updatedAt: confirmedAt,
      });
      return { status: "uploaded" as const, uploaded: selected.length, commandIds: [...returnedIds] };
    } catch (error) {
      const transportError = error instanceof DeviceSyncTransportError
        ? error
        : new DeviceSyncTransportError(
            error instanceof Error ? error.message : "Onbekende synchronisatiefout.",
            true,
            "TRANSPORT_FAILURE",
            { cause: error },
          );
      const failedAt = this.now();
      const current = await this.loadSnapshot();
      const entries = current.entries.map((entry) => {
        if (!selectedIds.has(entry.command.commandId)) return entry;
        const attemptCount = Math.max(1, entry.attemptCount);
        return {
          ...entry,
          status: transportError.retryable ? "RETRYABLE" as const : "REJECTED" as const,
          nextAttemptAt: transportError.retryable
            ? new Date(failedAt.getTime() + retryDelayMs(attemptCount)).toISOString()
            : undefined,
          lastErrorCode: transportError.code,
          lastErrorMessage: transportError.message,
        };
      });
      await this.saveSnapshot({ ...current, entries, updatedAt: failedAt.toISOString() });
      return {
        status: transportError.retryable ? "retryable" as const : "rejected" as const,
        uploaded: 0,
        commandIds: [...selectedIds],
        error: transportError,
      };
    }
  }

  async retry(commandId: string) {
    const snapshot = await this.loadSnapshot();
    let found = false;
    const entries = snapshot.entries.map((entry) => {
      if (entry.command.commandId !== commandId) return entry;
      found = true;
      return {
        ...entry,
        status: "PENDING" as const,
        nextAttemptAt: undefined,
        lastErrorCode: undefined,
        lastErrorMessage: undefined,
      };
    });
    if (!found) throw new DeviceStoreError("INVALID_ARGUMENT", "Synchronisatiecommando niet gevonden.");
    await this.saveSnapshot({ ...snapshot, entries, updatedAt: this.now().toISOString() });
  }

  async summary() {
    const snapshot = await this.loadSnapshot();
    const counts = { pending: 0, uploading: 0, retryable: 0, rejected: 0 };
    for (const entry of snapshot.entries) {
      if (entry.status === "PENDING") counts.pending += 1;
      else if (entry.status === "UPLOADING") counts.uploading += 1;
      else if (entry.status === "RETRYABLE") counts.retryable += 1;
      else counts.rejected += 1;
    }
    return {
      ...counts,
      open: snapshot.entries.length,
      persisted: snapshot.persistedCommands.length,
      oldestQueuedAt: snapshot.entries.map((entry) => entry.queuedAt).sort()[0],
      updatedAt: snapshot.updatedAt,
    };
  }

  private async loadSnapshot(): Promise<DeviceSyncQueueSnapshot> {
    const result = await this.encryptedStore.read<DeviceSyncQueueSnapshot>("sync-queue", {
      targetVersion: SALES_DAY_SYNC_QUEUE_PAYLOAD_VERSION,
    });
    if (result.status === "missing") {
      return { entries: [], persistedCommands: [], updatedAt: this.now().toISOString() };
    }
    if (result.status === "corrupt") {
      throw new DeviceStoreError("SERIALIZATION_FAILED", "De lokale synchronisatiewachtrij is beschadigd en werd geïsoleerd.");
    }
    validateSnapshot(result.value);
    return result.value;
  }

  private async saveSnapshot(snapshot: DeviceSyncQueueSnapshot) {
    validateSnapshot(snapshot);
    await this.encryptedStore.write("sync-queue", snapshot, SALES_DAY_SYNC_QUEUE_PAYLOAD_VERSION);
  }
}

export function createSalesDaySyncTransport(input: {
  endpoint?: string;
  actorId?: string;
  deviceId: string;
  fetch?: typeof fetch;
}) {
  const request = input.fetch ?? globalThis.fetch;
  if (!request) throw new DeviceStoreError("INVALID_ARGUMENT", "Fetch is niet beschikbaar.");
  return async (batch: DeviceSyncBatch): Promise<DeviceSyncBatchResult> => {
    const response = await request(input.endpoint ?? "/api/salesday/sync/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(input.actorId ? { actorId: input.actorId } : {}),
        deviceId: input.deviceId,
        provider: batch.provider,
        items: batch.items,
      }),
    });
    const body = await response.json().catch(() => ({})) as {
      persistedCommandIds?: unknown;
      error?: unknown;
    };
    if (!response.ok) {
      throw new DeviceSyncTransportError(
        typeof body.error === "string" ? body.error : `Synchronisatie-HTTP ${response.status}`,
        response.status >= 500 || response.status === 408 || response.status === 429,
        `HTTP_${response.status}`,
      );
    }
    if (!Array.isArray(body.persistedCommandIds) || !body.persistedCommandIds.every((value) => typeof value === "string")) {
      throw new DeviceSyncTransportError("Ongeldig synchronisatieantwoord.", true, "INVALID_RESPONSE");
    }
    return { persistedCommandIds: body.persistedCommandIds };
  };
}

function validateQueueInput(input: { provider: SalesErpProvider; command: SalesErpCommand; businessDate?: string }) {
  if (!["MOCK", "BC_NAV", "ODOO"].includes(input.provider)) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "Ongeldige ERP-provider in de synchronisatiewachtrij.");
  }
  if (
    typeof input.command.commandId !== "string" ||
    typeof input.command.idempotencyKey !== "string" ||
    typeof input.command.context?.deviceId !== "string" ||
    input.command.context.deviceId.trim() === "" ||
    input.command.commandId.trim() === "" ||
    input.command.idempotencyKey.trim() === ""
  ) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "Synchronisatiecommando mist een identiteit.");
  }
  if (input.businessDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "businessDate moet YYYY-MM-DD gebruiken.");
  }
  if (!Array.isArray(input.command.dependsOnCommandIds)) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "Ongeldige commandoafhankelijkheden.");
  }
}

function validateSnapshot(value: DeviceSyncQueueSnapshot) {
  if (
    !value ||
    !Array.isArray(value.entries) ||
    !Array.isArray(value.persistedCommands) ||
    !isIsoDateTime(value.updatedAt)
  ) {
    throw new DeviceStoreError("SERIALIZATION_FAILED", "Ongeldige synchronisatiewachtrij.");
  }
  const ids = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (const entry of value.entries) {
    validateQueueInput(entry);
    const idempotencyIdentity = `${entry.provider}:${entry.command.idempotencyKey}`;
    if (
      ids.has(entry.command.commandId) ||
      idempotencyKeys.has(idempotencyIdentity) ||
      !["PENDING", "UPLOADING", "RETRYABLE", "REJECTED"].includes(entry.status) ||
      !Number.isSafeInteger(entry.attemptCount) ||
      entry.attemptCount < 0 ||
      !isIsoDateTime(entry.queuedAt) ||
      (entry.lastAttemptAt !== undefined && !isIsoDateTime(entry.lastAttemptAt)) ||
      (entry.nextAttemptAt !== undefined && !isIsoDateTime(entry.nextAttemptAt))
    ) {
      throw new DeviceStoreError("SERIALIZATION_FAILED", "Ongeldige of dubbele entry in synchronisatiewachtrij.");
    }
    ids.add(entry.command.commandId);
    idempotencyKeys.add(idempotencyIdentity);
  }
  for (const marker of value.persistedCommands) {
    const idempotencyIdentity = `${marker.provider}:${marker.idempotencyKey}`;
    if (
      typeof marker.commandId !== "string" ||
      !marker.commandId.trim() ||
      !["MOCK", "BC_NAV", "ODOO"].includes(marker.provider) ||
      typeof marker.idempotencyKey !== "string" ||
      !marker.idempotencyKey.trim() ||
      !isIsoDateTime(marker.persistedAt) ||
      ids.has(marker.commandId) ||
      idempotencyKeys.has(idempotencyIdentity)
    ) {
      throw new DeviceStoreError("SERIALIZATION_FAILED", "Ongeldige of dubbele bevestiging in synchronisatiewachtrij.");
    }
    ids.add(marker.commandId);
    idempotencyKeys.add(idempotencyIdentity);
  }
  assertAcyclic(value.entries);
}

function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function assertAcyclic(entries: DeviceSyncQueueEntry[]) {
  const dependencies = new Map(entries.map((entry) => [entry.command.commandId, entry.command.dependsOnCommandIds]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (commandId: string) => {
    if (visiting.has(commandId)) {
      throw new DeviceStoreError("INVALID_ARGUMENT", "Cyclische commandoafhankelijkheid gedetecteerd.");
    }
    if (visited.has(commandId)) return;
    visiting.add(commandId);
    for (const dependency of dependencies.get(commandId) ?? []) {
      if (dependencies.has(dependency)) visit(dependency);
    }
    visiting.delete(commandId);
    visited.add(commandId);
  };
  for (const commandId of dependencies.keys()) visit(commandId);
}

function retryDelayMs(attemptCount: number) {
  return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attemptCount - 1));
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}
