# SalesDay Milestone 0 Baseline

## Scope

Milestone 0 establishes contracts and migration design only. It does not add SalesDay UI, persistent replica/outbox tables, a Prisma migration, a production ERP adapter or production data.

The clean pre-implementation baseline is commit `e4894cb` (`Add Contract workflows and SalesDay integration plan`), pushed to `origin/main` before SalesDay implementation resumed.

## Baseline evidence

The pre-implementation baseline recorded:

- `npm run typecheck`: pass;
- `npm run lint`: zero errors and one existing `react-hooks/exhaustive-deps` warning in `components/workspace-pages.tsx`;
- menu-rights, role-permission-save and data-access tests: pass;
- Contract calculation, import and letter tests: pass;
- direct `npx next build`: pass.

The normal `npm run build` can be blocked on Windows by the documented Prisma query-engine lock because its prebuild runs Prisma generation. This is an environment risk, not a SalesDay contract exception.

## Milestone 0 implementation

Implemented:

- `sales-erp.v1` provider-neutral resources, events, commands, acknowledgements and reconciliation contracts;
- stable error classes, canonical payload hashing and command idempotency keys;
- `SalesErpPort` independent of HTTP, queue or webhook transport;
- deterministic mock fixtures for Belgium, the Netherlands and Germany;
- mock scope/paging/events/acknowledgement/dependency/reconciliation behaviour;
- fail-closed provider factory: mock is rejected in production and unimplemented real providers are rejected;
- shared BusinessRelation/Article, replica and integration-ledger schema design;
- forward-compatible `ContractCustomer` and `ContractArticle` bridge plan without a database migration.

Validation command:

```text
npm run test:sales-erp-contracts
```

The contract test covers effective scope, cursors, deterministic fixtures, canonical JSON, duplicate command replay, same-key/different-payload rejection, dependency ordering, reconciliation, invalid cursors and production mock rejection.

Final Milestone 0 validation on 16 July 2026:

- `npm run typecheck`: pass;
- `npm run lint`: pass with zero errors and the one unchanged `workspace-pages.tsx` warning;
- `npm run test:sales-erp-contracts`: pass;
- Contract calculation, import and letter regression tests: pass;
- direct `npx next build`: pass, including static-page generation;
- `git diff --check`: pass.

## Formally isolated baseline harness failures

These two existing scripts are not reliable source-only gates in the current local environment:

1. `npm run test:api-persistence` calls authenticated API routes without establishing a session and fails on `/api/representatives` with `Aanmelden is vereist.` The endpoint must remain protected. Repair belongs in the test harness by creating an authenticated test context.
2. `npm run test:db-verification` requires at least two STEP9 database runs with four interventions each. The current database does not contain that fixture state. Repair belongs in deterministic test seeding or an explicitly prepared integration database.

Both failures were reproduced on 16 July 2026 and are tracked in `../../07_KNOWN_ISSUES.md`. They do not justify weakening authentication or inserting business fixtures into a developer database during Milestone 0.

## Explicit unresolved items

- BC/NAV endpoint, authentication, payload, source-version and acknowledgement semantics;
- Odoo mapping;
- ERP rounding and native status mapping;
- deployment feature-flag names and operational adapter credentials;
- production-volume migration rehearsal.

These remain deliberately unresolved. No implementation may guess them.
