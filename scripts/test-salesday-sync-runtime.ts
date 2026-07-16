import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createSalesDayServerSyncStatusTransport,
  SalesDaySyncRuntime,
  type SalesDayServerSyncStatusDto,
} from "../lib/device/sync-runtime";

type ResultStatus = "uploaded" | "idle" | "busy" | "retryable" | "rejected";

class FakeQueue {
  pending = 2;
  retryable = 0;
  rejected = 0;
  persisted = 0;
  retries: string[] = [];
  syncResults: ResultStatus[] = ["uploaded", "uploaded", "idle"];

  async summary() {
    return {
      pending: this.pending,
      uploading: 0,
      retryable: this.retryable,
      rejected: this.rejected,
      open: this.pending + this.retryable + this.rejected,
      persisted: this.persisted,
      oldestQueuedAt: this.pending ? "2026-07-16T20:00:00.000Z" : undefined,
      nextRetryAt: undefined,
      lastPersistedAt: this.persisted ? "2026-07-16T23:00:00.000Z" : undefined,
      issues: [],
      updatedAt: "2026-07-16T23:00:00.000Z",
    };
  }

  async syncOnce() {
    const status = this.syncResults.shift() ?? "idle";
    if (status === "uploaded") {
      this.pending -= 1;
      this.persisted += 1;
      return { status, uploaded: 1, commandIds: [`command-${this.persisted}`] } as const;
    }
    return { status, uploaded: 0 } as const;
  }

  async retry(commandId: string) {
    this.retries.push(commandId);
  }
}

class FakeEventSource {
  listener: (() => void) | null = null;

  addEventListener(_type: "online", listener: () => void) {
    this.listener = listener;
  }

  removeEventListener(_type: "online", listener: () => void) {
    if (this.listener === listener) this.listener = null;
  }
}

const serverStatus: SalesDayServerSyncStatusDto = {
  provider: "MOCK",
  deviceId: "device-sync-001",
  serverNow: "2026-07-16T23:00:00.000Z",
  commands: { PENDING: 0, PROCESSING: 0, RETRYABLE: 0, ACCEPTED: 2, REJECTED: 0 },
  openCommandCount: 0,
  openIncidentCount: 0,
  lastLedgerAcceptedAt: "2026-07-16T22:59:00.000Z",
  lastErpAcknowledgedAt: "2026-07-16T23:00:00.000Z",
  oldestOpenCommandAt: null,
  lastReplicaSyncAt: "2026-07-16T22:58:00.000Z",
  recentCommands: [],
};

async function main() {
  const queue = new FakeQueue();
  const phases: string[] = [];
  const runtime = new SalesDaySyncRuntime({
    queue,
    sendBatch: async () => ({ persistedCommandIds: [] }),
    fetchServerStatus: async () => serverStatus,
    isOnline: () => true,
    now: () => new Date("2026-07-16T23:00:00.000Z"),
  });
  runtime.subscribe((snapshot) => phases.push(snapshot.phase));
  const first = runtime.syncNow();
  const concurrent = runtime.syncNow();
  assert.equal(first, concurrent);
  const completed = await first;
  assert.equal(completed.phase, "IDLE");
  assert.equal(completed.local?.open, 0);
  assert.equal(completed.local?.persisted, 2);
  assert.equal(completed.server?.lastErpAcknowledgedAt, "2026-07-16T23:00:00.000Z");
  assert.deepEqual(phases.slice(-2), ["SYNCING", "IDLE"]);

  await runtime.retry("command-retry-001");
  assert.deepEqual(queue.retries, ["command-retry-001"]);

  const offlineRuntime = new SalesDaySyncRuntime({
    queue,
    sendBatch: async () => ({ persistedCommandIds: [] }),
    isOnline: () => false,
    now: () => new Date("2026-07-16T23:01:00.000Z"),
  });
  assert.equal((await offlineRuntime.syncNow()).phase, "OFFLINE");

  let online = false;
  const events = new FakeEventSource();
  const automaticQueue = new FakeQueue();
  automaticQueue.pending = 0;
  automaticQueue.syncResults = ["idle"];
  const automatic = new SalesDaySyncRuntime({
    queue: automaticQueue,
    sendBatch: async () => ({ persistedCommandIds: [] }),
    isOnline: () => online,
    eventSource: events,
    refreshIntervalMs: 60_000,
  });
  automatic.start();
  await waitFor(() => automatic.getSnapshot().phase === "OFFLINE");
  online = true;
  events.listener?.();
  await waitFor(() => automatic.getSnapshot().phase === "IDLE");
  automatic.stop();
  assert.equal(events.listener, null);
  assert.equal(automatic.getSnapshot().phase, "STOPPED");

  const statusTransport = createSalesDayServerSyncStatusTransport({
    deviceId: "device-sync-001",
    provider: "MOCK",
    actorId: "rep-sync-001",
    fetch: async (url) => {
      assert(String(url).includes("actorId=rep-sync-001"));
      return new Response(JSON.stringify(serverStatus), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal((await statusTransport()).openCommandCount, 0);

  const statusSource = readFileSync("lib/server/salesday-sync-status.ts", "utf8");
  const routeSource = readFileSync("app/api/salesday/sync/status/route.ts", "utf8");
  const statusCardSource = readFileSync("components/salesday/sync-status-card.tsx", "utf8");
  assert(statusSource.includes("actorUserId: input.actor.id"));
  assert(statusSource.includes("requireActiveSalesDayDevice"));
  assert(statusSource.includes("ErpReconciliationIncidentStatus.OPEN"));
  assert(routeSource.includes("requireAuthenticatedUserContext"));
  assert(statusCardSource.includes('aria-live="polite"'));
  assert(statusCardSource.includes("onRetry(issue.commandId)"));
  const dictionaries = ["nl", "fr", "de"].map((language) => JSON.parse(
    readFileSync(`locales/${language}.json`, "utf8"),
  ) as Record<string, string>);
  const syncKeys = Object.keys(dictionaries[0]).filter((key) => key.startsWith("salesday.sync."));
  assert(syncKeys.length >= 20);
  for (const dictionary of dictionaries) {
    assert.deepEqual(Object.keys(dictionary).filter((key) => key.startsWith("salesday.sync.")).sort(), syncKeys.sort());
  }

  console.log("SalesDay sync runtime: automatische online-trigger, seriële upload, retry en eigen serverstatus gevalideerd.");
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Testconditie werd niet tijdig bereikt.");
}

void main();
