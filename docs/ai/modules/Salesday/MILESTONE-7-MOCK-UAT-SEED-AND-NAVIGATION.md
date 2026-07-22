# Milestone 7 — Mock/UAT seed and SalesDay navigation

## Status

`IMPLEMENTED IN SOURCE — NOT SEEDED ON CURRENT DATABASE` on 17 July 2026.

Milestone 7 started as non-production enablement. On 22 July 2026 it gained a separate controlled live system-test extension. Real ERP production acceptance still requires the real adapter and controlled mock mode to be disabled.

## What changed

- The deterministic mock ERP fixture was expanded into a richer UAT scenario for Belgium, the Netherlands and Germany.
- A guarded local seed runner was added for isolated development, demo, test, mock, sandbox or UAT databases.
- The original UAT seed maps one existing Representative per country. The live-system seed preserves every real user, gives every active Representative a distinct SalesDay fixture, and creates Contract and personal Inventory fixtures for every active user.
- The seed applies ERP-originated business records through the SalesDay replica event path instead of inventing a parallel write path.
- The SalesDay app switcher and blue left navigation now use the same permission-filtered domain definition.
- SalesDay workspace routes for `Mijn voorraad` and `Kasblad` were connected to their existing APIs so the menu items open meaningful screens.

## Seed safety rules

The seed runner fails closed unless all of the following are true:

1. the runtime is not production, unless the separate live-system runner receives the explicit production double opt-in;
2. the database name clearly contains one of `test`, `uat`, `dev`, `demo`, `mock`, `sandbox` or `local`;
3. at least one active representative user exists for each seeded country that should receive appointments;
4. the operator intentionally runs the seed against that isolated database.

The current `.env` points at `MExT_FieldForce`, which is not a clearly isolated test/UAT/mock database name. The dry-run guard therefore refuses it. No seed was executed against that database during this milestone.

An override exists only for exceptional local operator-controlled cases and requires both:

- CLI flag `--allow-non-test-db`;
- environment variable `SALESDAY_UAT_SEED_ALLOW_NON_TEST_DATABASE=true`.

The original UAT command must not be used for production. The separate live-system command requires both server-side values below and includes the two explicit CLI flags itself:

- `SALESDAY_PRODUCTION_MOCK_MODE=true`;
- `SALESDAY_UAT_SEED_ALLOW_NON_TEST_DATABASE=true`.

```bash
npm run salesday:seed:live-system-mock -- --dry-run
npm run salesday:seed:live-system-mock
```

By default the live-system command creates a rolling 30-calendar-day SalesDay appointment window starting at the resolved business date. Operators may set another bounded window with `--days=N`; the runner accepts 1 through 90 days. Each copied appointment receives a date-specific external ID so rerunning the seed updates the same fictitious records instead of overwriting another day.

The command is idempotent and is not part of `deploy:prepare`. It:

- writes global, country and user SalesDay/Inventory activation flags for every active user;
- creates rolling daily SalesDay appointment data for every active Representative so management users see data through their normal read-only scope;
- creates a personal Inventory location and a Contract customer/calculation for every active user, including Admin and Super Admin;
- does not grant management roles Representative write behaviour;
- does not touch Coaching;
- reports PST and Service as unavailable because those routes are placeholders without a persistent domain model.

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
- date-specific appointments for every day in the selected live-system seed window;
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

The app switcher menu and the blue left sidebar use `getAvailableDomains` so they share the same permission-filtered domain definition.

For the SalesDay domain this means:

- SalesDay and its permitted submenu entries remain visible independently of runtime feature activation;
- opening a SalesDay route still shows the server-evaluated loading or disabled state, and APIs continue to enforce activation and scope;
- SalesDay routes open the SalesDay domain sidebar instead of falling back to Coaching navigation;
- representative SalesDay navigation includes overview, preparation, agenda, stock, cash sheet and day closure;
- team navigation remains permission-driven and is not shown to representatives by default.

Clicking a top-level application in the app switcher navigates immediately to its dashboard or designated domain start page. If that landing link is not available through the user's menu permissions, the first permitted submenu link is used instead.

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
- Normal UAT data may only be inserted after an isolated UAT/mock database is selected; live-system mock data additionally requires the explicit double opt-in above.
- Real ERP production acceptance remains blocked until controlled mock mode is disabled and the real ERP adapter, migration rehearsal, backup/restore, MDM/device evidence and country UAT are complete.
