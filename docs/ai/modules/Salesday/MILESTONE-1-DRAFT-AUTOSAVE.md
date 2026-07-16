# Milestone 1 — Encrypted drafts and continuous autosave

Status: `SOURCE FOUNDATION COMPLETE — FORM WIRING FOLLOWS WITH EACH SALESDAY WORKFLOW`

This slice provides one encrypted draft path for every approved offline mutation family without making browser storage a business source of truth.

## Draft families

The store accepts versioned drafts for:

- customer changes;
- appointments;
- visit reports;
- sales documents;
- Inventory mutations;
- day closure.

Every draft has a stable local draft ID, mutation family, business date, update timestamp and typed form value. The user/device binding and encryption are inherited from `EncryptedDeviceStore`.

## Autosave behaviour

`createSalesDayDraftAutosave` binds a concrete SalesDay draft identity to the encrypted store.

- rapid changes are debounced and only the newest value is persisted;
- writes are serialised, preventing an older slow write from overwriting a newer one;
- an explicit flush writes immediately;
- closing flushes the latest value before disabling further changes;
- a failed write retains the latest pending value for retry;
- a newer value supersedes an older failed value;
- explicit cancel stops pending autosave without writing;
- explicit discard removes the encrypted draft.

The autosave status contract exposes `idle`, `pending`, `saving`, `saved` and `error` for later tablet UI feedback.

## Source

- `lib/device/draft-store.ts`
- `scripts/test-salesday-draft-store.ts`

## Validation

`npm run test:salesday-draft-store` covers encrypted save/recovery, absence of plaintext in the underlying record, latest-value coalescing, direct draft-store/autosave integration, forced flush, write failure and retry, discard and cancellation.

Typecheck and targeted ESLint pass.

## Runtime boundary

The current SalesDay routes still render a placeholder workspace and do not yet contain the approved customer, appointment, visit-report, sales-document, Inventory or day-close forms. Each workflow slice must instantiate this shared draft store rather than creating local storage of its own. It must recover the matching draft on entry, surface autosave state, flush on the workflow's safe lifecycle boundary and discard only after durable server/outbox acceptance or explicit user cancellation.

Existing Coaching `localStorage` drafts are outside this SalesDay slice and are not migrated or modified here.
