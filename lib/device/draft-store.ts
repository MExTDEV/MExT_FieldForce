import {
  DeviceStoreError,
  EncryptedDeviceStore,
  type DeviceStoreReadResult,
} from "./encrypted-store";

export const SALES_DAY_DRAFT_PAYLOAD_VERSION = 1;

export const salesDayDraftKinds = [
  "customer",
  "appointment",
  "visit-report",
  "sales-document",
  "inventory",
  "day-close",
] as const;

export type SalesDayDraftKind = (typeof salesDayDraftKinds)[number];

export type SalesDayDraft<T> = {
  draftId: string;
  kind: SalesDayDraftKind;
  businessDate: string;
  updatedAt: string;
  value: T;
};

export type SaveSalesDayDraftInput<T> = Omit<SalesDayDraft<T>, "updatedAt">;

export class SalesDayDraftStore {
  constructor(
    private readonly encryptedStore: EncryptedDeviceStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save<T>(input: SaveSalesDayDraftInput<T>) {
    validateDraftIdentity(input);
    const draft: SalesDayDraft<T> = { ...input, updatedAt: this.now().toISOString() };
    const savedAt = await this.encryptedStore.write(
      recordKey(input.kind, input.draftId),
      draft,
      SALES_DAY_DRAFT_PAYLOAD_VERSION,
    );
    return { ...draft, savedAt };
  }

  async load<T>(kind: SalesDayDraftKind, draftId: string): Promise<DeviceStoreReadResult<SalesDayDraft<T>>> {
    validateDraftIdentity({ kind, draftId, businessDate: "2000-01-01", value: null });
    const result = await this.encryptedStore.read<SalesDayDraft<T>>(recordKey(kind, draftId), {
      targetVersion: SALES_DAY_DRAFT_PAYLOAD_VERSION,
    });
    if (result.status !== "found") return result;
    if (!isStoredDraft(result.value, kind, draftId)) {
      await this.encryptedStore.remove(recordKey(kind, draftId));
      throw new DeviceStoreError("SERIALIZATION_FAILED", "Het ontsleutelde SalesDay-concept heeft een ongeldig formaat.");
    }
    return result;
  }

  async discard(kind: SalesDayDraftKind, draftId: string) {
    validateDraftIdentity({ kind, draftId, businessDate: "2000-01-01", value: null });
    await this.encryptedStore.remove(recordKey(kind, draftId));
  }
}

export type DraftAutosaveStatus =
  | { state: "idle" }
  | { state: "pending"; revision: number }
  | { state: "saving"; revision: number }
  | { state: "saved"; revision: number; savedAt: string }
  | { state: "error"; revision: number; error: Error };

export type DraftAutosaveOptions<T> = {
  save: (value: T) => Promise<{ savedAt: string }>;
  debounceMs?: number;
  onStatus?: (status: DraftAutosaveStatus) => void;
};

export class DraftAutosave<T> {
  private readonly debounceMs: number;
  private readonly saveValue: DraftAutosaveOptions<T>["save"];
  private readonly onStatus: NonNullable<DraftAutosaveOptions<T>["onStatus"]>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private revision = 0;
  private pending: { revision: number; value: T } | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(options: DraftAutosaveOptions<T>) {
    if (!Number.isSafeInteger(options.debounceMs ?? 750) || (options.debounceMs ?? 750) < 0) {
      throw new DeviceStoreError("INVALID_ARGUMENT", "Ongeldige autosavevertraging.");
    }
    this.debounceMs = options.debounceMs ?? 750;
    this.saveValue = options.save;
    this.onStatus = options.onStatus ?? (() => undefined);
    this.onStatus({ state: "idle" });
  }

  update(value: T) {
    if (this.closed) throw new DeviceStoreError("INVALID_ARGUMENT", "Deze autosave werd afgesloten.");
    this.revision += 1;
    this.pending = { revision: this.revision, value };
    this.onStatus({ state: "pending", revision: this.revision });
    this.schedule();
    return this.revision;
  }

  async flush() {
    this.clearTimer();
    const target = this.pending;
    if (!target) {
      await this.writeChain;
      return;
    }
    this.pending = null;
    const write = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        this.onStatus({ state: "saving", revision: target.revision });
        try {
          const result = await this.saveValue(target.value);
          if (!this.pending || this.pending.revision <= target.revision) {
            this.onStatus({ state: "saved", revision: target.revision, savedAt: result.savedAt });
          }
        } catch (error) {
          if (!this.pending || this.pending.revision < target.revision) this.pending = target;
          const normalized = error instanceof Error ? error : new Error(String(error));
          this.onStatus({ state: "error", revision: target.revision, error: normalized });
          throw normalized;
        }
      });
    this.writeChain = write;
    await write;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.flush();
    this.clearTimer();
  }

  cancel() {
    this.closed = true;
    this.pending = null;
    this.clearTimer();
  }

  private schedule() {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => undefined);
    }, this.debounceMs);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export function createSalesDayDraftAutosave<T>(options: {
  store: SalesDayDraftStore;
  draftId: string;
  kind: SalesDayDraftKind;
  businessDate: string;
  debounceMs?: number;
  onStatus?: (status: DraftAutosaveStatus) => void;
}) {
  validateDraftIdentity({
    draftId: options.draftId,
    kind: options.kind,
    businessDate: options.businessDate,
    value: null,
  });
  return new DraftAutosave<T>({
    debounceMs: options.debounceMs,
    onStatus: options.onStatus,
    save: async (value) => {
      const result = await options.store.save({
        draftId: options.draftId,
        kind: options.kind,
        businessDate: options.businessDate,
        value,
      });
      return { savedAt: result.savedAt };
    },
  });
}

function recordKey(kind: SalesDayDraftKind, draftId: string) {
  return `draft:${kind}:${draftId}`;
}

function validateDraftIdentity(input: {
  kind: SalesDayDraftKind;
  draftId: string;
  businessDate: string;
  value: unknown;
}) {
  if (!salesDayDraftKinds.includes(input.kind)) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "Ongeldig SalesDay-concepttype.");
  }
  if (!input.draftId.trim() || input.draftId.length > 191) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "Ongeldige conceptidentiteit.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) {
    throw new DeviceStoreError("INVALID_ARGUMENT", "businessDate moet YYYY-MM-DD gebruiken.");
  }
}

function isStoredDraft(value: unknown, kind: SalesDayDraftKind, draftId: string): value is SalesDayDraft<unknown> {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<SalesDayDraft<unknown>>;
  return draft.kind === kind &&
    draft.draftId === draftId &&
    typeof draft.businessDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.businessDate) &&
    typeof draft.updatedAt === "string" &&
    "value" in draft;
}
