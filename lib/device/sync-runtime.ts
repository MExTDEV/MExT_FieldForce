import type { SalesErpProvider } from "../server/integrations/sales-erp/contracts";
import type {
  DeviceSyncBatch,
  DeviceSyncBatchResult,
  DeviceSyncQueueSummary,
} from "./sync-queue";
import { DeviceSyncTransportError } from "./sync-queue";

export type SalesDayServerSyncStatusDto = {
  provider: SalesErpProvider;
  deviceId: string;
  serverNow: string;
  commands: Record<string, number>;
  openCommandCount: number;
  openIncidentCount: number;
  lastLedgerAcceptedAt: string | null;
  lastErpAcknowledgedAt: string | null;
  oldestOpenCommandAt: string | null;
  lastReplicaSyncAt: string | null;
  recentCommands: Array<{
    commandId: string;
    commandType: string;
    status: string;
    attemptCount: number;
    createdAt: string;
    acknowledgedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  }>;
};

type SyncQueuePort = {
  summary(): Promise<DeviceSyncQueueSummary>;
  syncOnce(
    sendBatch: (batch: DeviceSyncBatch) => Promise<DeviceSyncBatchResult>,
  ): Promise<{ status: "uploaded" | "idle" | "busy" | "retryable" | "rejected" }>;
  retry(commandId: string): Promise<void>;
};
type LocalSyncSummary = DeviceSyncQueueSummary;

export type SalesDaySyncRuntimePhase =
  | "STOPPED"
  | "OFFLINE"
  | "IDLE"
  | "SYNCING"
  | "ATTENTION"
  | "ERROR";

export type SalesDaySyncRuntimeSnapshot = {
  phase: SalesDaySyncRuntimePhase;
  local: LocalSyncSummary | null;
  server: SalesDayServerSyncStatusDto | null;
  lastAttemptAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
};

type RuntimeEventSource = {
  addEventListener(type: "online", listener: () => void): void;
  removeEventListener(type: "online", listener: () => void): void;
};

type RuntimeVisibilitySource = {
  visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};

export class SalesDaySyncRuntime {
  private readonly listeners = new Set<(snapshot: SalesDaySyncRuntimeSnapshot) => void>();
  private readonly onlineListener = () => { void this.syncNow(); };
  private readonly visibilityListener = () => {
    if (this.options.visibilitySource?.visibilityState === "visible") void this.syncNow();
  };
  private snapshot: SalesDaySyncRuntimeSnapshot = {
    phase: "STOPPED",
    local: null,
    server: null,
    lastAttemptAt: null,
    lastCompletedAt: null,
    lastError: null,
  };
  private running: Promise<SalesDaySyncRuntimeSnapshot> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor(private readonly options: {
    queue: SyncQueuePort;
    sendBatch: (batch: DeviceSyncBatch) => Promise<DeviceSyncBatchResult>;
    fetchServerStatus?: () => Promise<SalesDayServerSyncStatusDto>;
    isOnline?: () => boolean;
    eventSource?: RuntimeEventSource;
    visibilitySource?: RuntimeVisibilitySource;
    refreshIntervalMs?: number;
    maxBatchesPerRun?: number;
    now?: () => Date;
  }) {}

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: SalesDaySyncRuntimeSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.options.eventSource?.addEventListener("online", this.onlineListener);
    this.options.visibilitySource?.addEventListener("visibilitychange", this.visibilityListener);
    void this.syncNow();
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.clearTimer();
    this.options.eventSource?.removeEventListener("online", this.onlineListener);
    this.options.visibilitySource?.removeEventListener("visibilitychange", this.visibilityListener);
    this.update({ phase: "STOPPED" });
  }

  async retry(commandId: string) {
    await this.options.queue.retry(commandId);
    return this.syncNow();
  }

  syncNow() {
    if (this.running) return this.running;
    this.clearTimer();
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.started) this.scheduleNext();
    });
    return this.running;
  }

  private async run() {
    const attemptedAt = this.now().toISOString();
    let local = await this.options.queue.summary();
    if (!(this.options.isOnline ?? defaultOnline)()) {
      this.update({ phase: "OFFLINE", local, lastAttemptAt: attemptedAt, lastError: null });
      return this.snapshot;
    }

    this.update({ phase: "SYNCING", local, lastAttemptAt: attemptedAt, lastError: null });
    try {
      const maxBatches = normalizePositiveInteger(this.options.maxBatchesPerRun ?? 20, "maxBatchesPerRun", 100);
      for (let batch = 0; batch < maxBatches; batch += 1) {
        const result = await this.options.queue.syncOnce(this.options.sendBatch);
        if (result.status !== "uploaded") break;
      }
      local = await this.options.queue.summary();
      const server = this.options.fetchServerStatus
        ? await this.options.fetchServerStatus()
        : this.snapshot.server;
      const requiresAttention = local.rejected > 0 || local.retryable > 0 || Boolean(
        server && (server.openIncidentCount > 0 || (server.commands.REJECTED ?? 0) > 0),
      );
      this.update({
        phase: requiresAttention ? "ATTENTION" : "IDLE",
        local,
        server,
        lastCompletedAt: this.now().toISOString(),
        lastError: null,
      });
    } catch (error) {
      local = await this.options.queue.summary().catch(() => local);
      this.update({
        phase: "ERROR",
        local,
        lastCompletedAt: this.now().toISOString(),
        lastError: error instanceof Error ? error.message : "Onbekende synchronisatiefout.",
      });
    }
    return this.snapshot;
  }

  private scheduleNext() {
    const interval = normalizePositiveInteger(
      this.options.refreshIntervalMs ?? 30_000,
      "refreshIntervalMs",
      30 * 60_000,
    );
    const nextRetryAt = this.snapshot.local?.nextRetryAt;
    const retryDelay = nextRetryAt
      ? Math.max(0, new Date(nextRetryAt).getTime() - this.now().getTime())
      : interval;
    this.timer = setTimeout(() => void this.syncNow(), Math.min(interval, retryDelay));
  }

  private clearTimer() {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private update(patch: Partial<SalesDaySyncRuntimeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private now() {
    return (this.options.now ?? (() => new Date()))();
  }
}

export function createSalesDayServerSyncStatusTransport(input: {
  deviceId: string;
  provider: SalesErpProvider;
  actorId?: string;
  endpoint?: string;
  fetch?: typeof fetch;
}) {
  const request = input.fetch ?? globalThis.fetch;
  if (!request) throw new DeviceSyncTransportError("Fetch is niet beschikbaar.", false, "FETCH_UNAVAILABLE");
  return async (): Promise<SalesDayServerSyncStatusDto> => {
    const parameters = new URLSearchParams({ deviceId: input.deviceId, provider: input.provider });
    if (input.actorId) parameters.set("actorId", input.actorId);
    const response = await request(`${input.endpoint ?? "/api/salesday/sync/status"}?${parameters}`, {
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({})) as SalesDayServerSyncStatusDto & { error?: string };
    if (!response.ok) {
      throw new DeviceSyncTransportError(
        body.error ?? `Synchronisatiestatus-HTTP ${response.status}`,
        response.status >= 500 || response.status === 408 || response.status === 429,
        `STATUS_HTTP_${response.status}`,
      );
    }
    validateServerStatus(body, input);
    return body;
  };
}

function validateServerStatus(
  value: SalesDayServerSyncStatusDto,
  expected: { provider: SalesErpProvider; deviceId: string },
) {
  if (
    !value ||
    value.provider !== expected.provider ||
    value.deviceId !== expected.deviceId ||
    !value.commands ||
    typeof value.commands !== "object" ||
    !Number.isSafeInteger(value.openCommandCount) ||
    !Number.isSafeInteger(value.openIncidentCount) ||
    !Array.isArray(value.recentCommands)
  ) {
    throw new DeviceSyncTransportError("Ongeldige server-synchronisatiestatus.", true, "INVALID_STATUS_RESPONSE");
  }
}

function normalizePositiveInteger(value: number, label: string, maximum: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new DeviceSyncTransportError(`${label} moet tussen 1 en ${maximum} liggen.`, false, "INVALID_RUNTIME_OPTION");
  }
  return value;
}

function defaultOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}
