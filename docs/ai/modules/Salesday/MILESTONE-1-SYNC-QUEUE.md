# Milestone 1 — Encrypted offline command queue

Status: `SOURCE FOUNDATION COMPLETE — RUNTIME SCHEDULER AND STATUS UI PENDING`

This slice connects offline SalesDay commands to the persistent ERP integration ledger without treating browser storage or FieldForce as the final ERP system of record.

## Local queue guarantees

- the complete queue snapshot is stored through `EncryptedDeviceStore` and is therefore bound to one user and one registered device;
- commands are accepted only when every declared dependency is already queued or durably confirmed;
- cyclic dependencies, duplicate command IDs and duplicate provider/idempotency-key pairs are rejected;
- only commands whose dependencies are confirmed are selected for upload;
- a selected batch is durably marked `UPLOADING` before the network call starts;
- an interrupted `UPLOADING` state is recovered as a safe retry after application restart;
- only one upload may run at a time on a queue instance;
- incomplete acknowledgements are retained as retryable instead of being silently removed;
- retryable and definitive errors remain visible in the queue with attempt and error metadata;
- successful commands are removed only after the server confirms every command ID, while a compact local idempotency marker prevents accidental reconstruction under another command ID.

The queue supports explicit manual retry. Exponential retry delay is capped at five minutes. Automatic scheduling and the tablet status contract are implemented by `MILESTONE-1-SYNC-RUNTIME.md`.

## Server ingest guarantees

`POST /api/salesday/sync/commands`:

- requires the normal authenticated FieldForce context;
- accepts batches of 1 through 100 provider-neutral commands;
- validates the ERP command envelope and deterministic idempotency key before persistence;
- permits only a Representative submitting commands for their own actor, Representative, country and device context;
- requires an active, key-provisioned device registration without token/key revocation;
- when the authentication token contains a login-session ID, requires that active session to remain bound to the same device;
- persists the full batch through the existing ERP outbox ledger in one serializable Prisma transaction.

The route does not call Business Central/NAV or Odoo directly. It only performs durable FieldForce ledger acceptance. Existing ledger idempotency makes a retry after a lost HTTP acknowledgement safe.

## Source

- `lib/device/sync-queue.ts`
- `lib/server/salesday-offline-sync.ts`
- `app/api/salesday/sync/commands/route.ts`
- `scripts/test-salesday-sync-queue.ts`
- `scripts/test-salesday-sync-queue-concurrency.ts`

## Validation

- encrypted persistence without readable customer/report content;
- missing dependency rejection and parent-before-child upload ordering;
- acknowledgement loss followed by an idempotent replay;
- interrupted-upload recovery;
- retryable and definitive rejection state;
- concurrent-upload exclusion;
- idempotency-key reuse under another command ID rejection;
- actor/device mismatch and authenticated server-route wiring;
- the existing persistent ERP-ledger test;
- TypeScript and repository lint.

## Remaining runtime work

- wire each approved SalesDay mutation to draft persistence plus outbox enqueue at its safe lifecycle boundary;
- wire the automatic runtime and status card into the provisioned SalesDay PWA shell;
- implement day −1 blocking and audited emergency mode on top of durable status;
- run browser/Android fault-injection tests for reload, storage pressure, offline transitions and remote revocation;
- validate the real ERP adapter separately when its interface is supplied.

Until workflow wiring exists, the implementation does not yet satisfy the required “local mutation and outbox write cannot diverge” acceptance test. That business mutation boundary must be implemented with each concrete workflow rather than simulated in this generic queue.
