# Milestone 7 — Mock/UAT seed and SalesDay navigation

## Status

`IMPLEMENTED IN SOURCE — NOT SEEDED ON CURRENT DATABASE` on 17 July 2026.

Milestone 7 is a non-production enablement milestone. It makes SalesDay usable for local/UAT walkthroughs while the real ERP integration is still pending. It does not change the production acceptance boundary: production still requires a real accepted ERP adapter and must contain no mock business data.

## What changed

- The deterministic mock ERP fixture was expanded into a richer UAT scenario for Belgium, the Netherlands and Germany.
- A guarded local seed runner was added for isolated development, demo, test, mock, sandbox or UAT databases.
- The seed uses existing real FieldForce users with the `REPRESENTATIVE` role; it does not create demo users.
- The seed applies ERP-originated business records through the SalesDay replica event path instead of inventing a parallel write path.
- The SalesDay app switcher and blue left navigation now use the same domain definition and server-evaluated SalesDay feature state.
- SalesDay workspace routes for `Mijn voorraad` and `Kasblad` were connected to their existing APIs so the menu items open meaningful screens.

## Seed safety rules

The seed runner fails closed unless all of the following are true:

1. the runtime is not production;
2. the database name clearly contains one of `test`, `uat`, `dev`, `demo`, `mock`, `sandbox` or `local`;
3. at least one active representative user exists for each seeded country that should receive appointments;
4. the operator intentionally runs the seed against that isolated database.

The current `.env` points at `MExT_FieldForce`, which is not a clearly isolated test/UAT/mock database name. The dry-run guard therefore refuses it. No seed was executed against that database during this milestone.

An override exists only for exceptional local operator-controlled cases and requires both:

- CLI flag `--allow-non-test-db`;
- environment variable `SALESDAY_UAT_SEED_ALLOW_NON_TEST_DATABASE=true`.

This override must not be used for production.

## Commands

Dry-run against the active environment:

```bash
npm run salesday:seed:uat-mock -- --dry-run
```

Run against an explicitly selected isolated UAT/mock database:

```bash
DATABASE_URL="mysql://user:password@host:3306/MExT_FieldForce_UAT" npm run salesday:seed:uat-mock
```

Include blocker scenarios, such as a non-zero cash balance and an open previous-day command:

```bash
npm run salesday:seed:uat-mock -- --include-blockers
```

The default seed keeps walkthrough users usable by normalising cash balances to zero and avoiding open previous-day blockers.

## Seed content

The fixture contains fictitious data only:

- customers and prospects across Belgium, the Netherlands and Germany;
- appointments for the current and next effective workday scenario;
- article, price and VAT data;
- commercial history;
- replenishments;
- ERP-confirmed cash balances;
- appointment outcome reasons;
- document categories;
- payment methods;
- customer locations, sublocations, carriers and carrier balances.

The fixture remains provider-neutral and uses the reserved `.invalid` email domain where email addresses are needed.

## Navigation behaviour

The app switcher menu and the blue left sidebar now use `getAvailableDomainsForFeatureState`.

For the SalesDay domain this means:

- the whole SalesDay domain is hidden while the `SALESDAY` feature is disabled or still unresolved;
- `Mijn voorraad` is hidden when the `INVENTORY` feature is disabled;
- SalesDay routes open the SalesDay domain sidebar instead of falling back to Coaching navigation;
- representative SalesDay navigation includes overview, preparation, agenda, stock, cash sheet and day closure;
- team navigation remains permission-driven and is not shown to representatives by default.

`Dagafsluiting` is exposed through the existing `menu.salesday.agenda` permission because no separate day-closure menu permission exists yet and the screen belongs to the representative workday/agenda flow.

## Validation

Milestone validation is covered by:

- `npm run test:sales-erp-contracts`
- `npm run test:salesday-uat-mock-seed`
- `npm run test:menu-rights`
- dry-run guard check on the current environment, which must refuse `MExT_FieldForce`
- positive dry-run with a synthetic `MExT_FieldForce_UAT` database URL
- `npm run typecheck`

## Remaining external work

- The real Business Central/NAV adapter is still undefined and must be supplied and accepted separately.
- UAT data may only be inserted after an isolated UAT/mock database is selected.
- Production activation remains blocked until the real ERP adapter, migration rehearsal, backup/restore, MDM/device evidence and country UAT are complete.
