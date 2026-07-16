# SalesDay Milestone 1 — Integration Ledger Slice

## Status

Status: `IMPLEMENTED IN SOURCE — DATABASE DEPLOYMENT PENDING`

This slice implements the persistent ERP integration foundation. It does not complete all Milestone 1 deliverables: device binding, encrypted IndexedDB, draft autosave, day −1 blocking, emergency mode, feature flags, notifications and UI remain open.

Migration `0040_sales_erp_integration_ledger` is additive and has not been applied to the configured external VPS database.

## Persistence model

- `ErpInboxMessage` stores each provider event once by `(provider, messageId)`, including canonical content fingerprint, lease, attempts and apply result.
- `ErpOutboxCommand` stores the complete command envelope, indexed actor/device/scope data, semantic fingerprint, attempts, acknowledgement and optional business date.
- `ErpOutboxDependency` enforces persisted command ordering through stable command IDs.
- `ErpReplicaCheckpoint` stores opaque cursors per provider, stream and scope.
- `ErpReconciliationIncident` deduplicates operational failures and retains occurrence/resolution state.

No existing business table is changed except the additive `User` relation required by the outbox actor foreign key. No customer, Contract, Coaching or other business row is backfilled.

## Atomicity and failure rules

Business services must call `enqueueSalesErpCommandInTransaction` inside the same Prisma transaction as their local mutation. If either write fails, both roll back.

Inbox processing claims an expiring lease and then applies the event plus `APPLIED` marker in one transaction. A crash before or during that transaction leaves no partially applied event. An expired lease may be reclaimed.

Outbox processing:

- claims only due commands with accepted dependencies;
- requires an explicit server-side replay-authorization callback;
- never treats a timeout as success;
- retries the same command ID and idempotency key;
- validates provider acknowledgements before changing terminal state;
- leaves transient errors as `RETRYABLE` with bounded exponential backoff;
- records repeated failures, mismatches, permission revocation and rejected dependencies as incidents;
- never lets reconciliation overwrite a concurrently accepted/rejected command.

`REJECTED` may represent either a provider rejection or a safe local terminal block such as permission/dependency rejection. `acknowledgedAt` is populated only for a real provider acknowledgement; `lastErrorCode` distinguishes the reason.

## Event pull and reconciliation

`pullSalesErpEvents` resumes from the stored cursor and commits all inbox records plus the new checkpoint in one transaction. A conflicting reused message ID rolls back the page and leaves the checkpoint unchanged.

`reconcileSalesErpCommands` checks attempted uncertain commands against the provider. Known acknowledgements are validated and applied; unknown command IDs create stable incidents and remain retained for intervention/retry.

`getSalesErpSyncHealth` exposes status counts, latest successful checkpoint, oldest pending command and open incident count for the later operational dashboard.

## Tests

Source-only tests:

```text
npm run test:sales-erp-contracts
npm run test:sales-erp-ledger
```

The ledger test validates canonical round-trips, tamper detection, retry backoff, acknowledgement loss/replay and the additive migration structure.

The destructive persistence/fault-injection suite is intentionally guarded:

```text
SALES_ERP_LEDGER_TEST_DATABASE_URL=<dedicated database containing "test" in its name>
npm run test:sales-erp-ledger-db
```

It refuses the normal `DATABASE_URL`. On a prepared migrated test database it covers duplicate commands, transaction rollback, dependency ordering, lost acknowledgement reconciliation, revoked replay permission, inbox crash rollback/recovery and health state.

Validation recorded on 16 July 2026:

- Prisma schema validation: pass;
- TypeScript typecheck: pass;
- lint: zero errors and only the existing `workspace-pages.tsx` warning;
- Sales ERP contract and ledger source tests: pass;
- Contract calculation/import/letter regressions: pass;
- direct Next.js production build: pass;
- normal Prisma Client read against the configured datasource: pass;
- dedicated test-database validation: pass; see `MILESTONE-1-DATABASE-VALIDATION-2026-07-16.md`;
- guarded ledger database test: pass on two consecutive runs with zero remaining test artifacts;
- production migration deployment: not run; `0040` remains pending on the configured `MExT_FieldForce` database.

## Deployment gate

Before migration `0040` is applied outside a dedicated test database:

1. create and restore-check a database backup;
2. apply the migration to a dedicated MariaDB test database;
3. run `test:sales-erp-ledger-db` twice and verify cleanup/idempotency;
4. verify migration status and normal Prisma Client generation;
5. review indexes and lease queries on production-like volume;
6. obtain explicit deployment approval;
7. apply through `npm run db:migrate:deploy`, never manual SQL.

The real BC/NAV interface remains unresolved and is not required to validate this provider-neutral ledger with the mock adapter.
