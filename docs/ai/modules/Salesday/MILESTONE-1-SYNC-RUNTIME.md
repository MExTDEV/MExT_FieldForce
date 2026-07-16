# Milestone 1 — Automatic sync runtime and freshness status

Status: `SOURCE FOUNDATION COMPLETE — PWA BOOTSTRAP WIRING PENDING`

This slice adds the operational runtime and status contract above the encrypted command queue. It does not claim that a command accepted into the FieldForce ledger has already been acknowledged by the ERP.

## Automatic runtime

`SalesDaySyncRuntime`:

- performs only one synchronization run at a time;
- drains ready queue batches serially, with a bounded maximum per run;
- starts an immediate run when activated;
- reacts to the browser `online` event and to the app becoming visible;
- repeats on a 30-second default interval and honours an earlier queue retry time;
- keeps offline work in the encrypted queue and reports `OFFLINE` instead of raising a destructive error;
- supports an explicit user retry for a retryable or rejected local command;
- treats failure to confirm server status as `ERROR`, never as “up to date”.

The runtime phases are `STOPPED`, `OFFLINE`, `SYNCING`, `IDLE`, `ATTENTION` and `ERROR`.

## Scoped server status

`GET /api/salesday/sync/status` requires the authenticated Representative, active login session and active key-provisioned personal device. Results are restricted to that actor and device.

It returns:

- own ledger command counts by status;
- own open reconciliation-incident count;
- last durable FieldForce-ledger acceptance;
- last ERP acknowledgement;
- oldest own open command;
- latest provider replica checkpoint timestamp;
- the latest twenty own command statuses without command payloads.

The endpoint is read-only. It does not select or invoke a real ERP adapter and does not expose global command totals or another Representative's records.

## Tablet status card

The reusable status card:

- distinguishes local open work from commands still travelling through the server/ERP path;
- shows FieldForce acceptance and ERP-replica freshness as separate timestamps;
- combines icon, text and colour for each state;
- offers touch-friendly “sync now” and per-command retry actions;
- explicitly warns that previous-day changes must be synchronized before the next workday;
- is translated in Dutch, French and German.

No arbitrary “fresh enough” duration is introduced. Day −1 blocking uses business-date evidence and is implemented in the dedicated next slice.

## Source

- `lib/device/sync-runtime.ts`
- `lib/device/sync-queue.ts`
- `lib/server/salesday-sync-status.ts`
- `lib/server/salesday-sync-api.ts`
- `lib/server/salesday-offline-sync.ts`
- `app/api/salesday/sync/status/route.ts`
- `components/salesday/sync-status-card.tsx`
- `scripts/test-salesday-sync-runtime.ts`

## Validation

`npm run test:salesday-sync-runtime` covers serial draining, concurrent-trigger coalescing, offline state, manual retry, automatic online recovery, own-device server scope, status-response validation, accessible status-card controls and translation-key parity.

The encrypted queue regression suite, TypeScript and targeted ESLint also pass.

## Remaining runtime integration

- instantiate the runtime only after personal-device registration and key provisioning succeed;
- provide the server-selected provider through fail-closed SalesDay feature configuration;
- mount the status card in the SalesDay shell and keep it available while normal work is blocked;
- connect global device-control polling/logout and the encrypted store lifecycle;
- validate timers, online/visibility events and IndexedDB behaviour in a real Android browser/PWA.
