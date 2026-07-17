# Milestone 1 — Feature controls, runtime guard and notification privacy

## Status

Implemented in source on 16 July 2026. Migration `0045_salesday_feature_controls` has not been applied to production.

## Effective activation

`SalesDayFeatureFlag` stores four independently controlled features: `SALESDAY`, `INVENTORY`, `OFFLINE_COMMANDS` and `ERP_WRITES`.

Every feature requires an enabled global master flag and an enabled target flag. Target resolution is fail-closed and uses this precedence:

1. explicit user pilot override;
2. team override;
3. country activation;
4. no matching target means disabled.

An explicit disabled row at a more specific scope overrides a broader enabled row. `INVENTORY`, `OFFLINE_COMMANDS` and `ERP_WRITES` additionally require effective `SALESDAY` access.

The same server decision feeds the client shell, direct SalesDay route state, API command acceptance and authenticated device bootstrap. The client provider defaults every feature to disabled while loading or after an error.

## Runtime configuration

The server-owned `AppSetting` key `salesday.runtime.v1` selects the provider, controls fictitious seed availability and selects enabled SalesDay notification types.

- development/test may use deterministic `MOCK` configuration;
- production requires an explicit stored configuration;
- production rejects provider `MOCK` and `mockSeedEnabled = true`;
- the mock adapter repeats this check in its constructor, so bypassing the factory does not enable a production fallback;
- sync command and status APIs ignore any client-selected provider and use the stored server provider.

No real BC/NAV or Odoo adapter has been invented. Selecting either provider still fails in the adapter factory until its accepted interface exists.

## Rollback and background writes

New offline command batches require effective `SALESDAY` and `OFFLINE_COMMANDS` access. The outbox worker requires an explicit `writesEnabled` decision before it claims any row.

When ERP writes are disabled, no pending row is claimed or deleted. Stored commands and evidence remain available for recovery, while status, support, remote device control and safe acknowledgement/reconciliation paths remain available.

## Permissions and audit

- `salesday.settings.manage` controls feature and runtime changes;
- `salesday.integration.monitor` controls operational integration monitoring;
- both default to Super Admin only and remain configurable through normal role/user overrides;
- every flag or runtime change writes its `AuditLog` row in the same Prisma transaction.

Representatives receive only the SalesDay preparation, agenda and stock menu permissions. They do not receive SalesDay Mijn Team or management permissions.

## Notification privacy

Lock-screen notifications use fixed Dutch, French and German templates for appointment changes, preparation availability, sync failure, cash blocking and document status. The builder accepts no customer name, amount or commercial detail. Detailed context remains in the authenticated app.

## Validation

Primary command: `npm run test:salesday-feature-controls`.

It verifies scope precedence, fail-closed defaults, Representative menu boundaries, production mock rejection, direct mock-adapter rejection, neutral notification content, schema/migration presence and the menu/API/bootstrap/background gates.

Related validation: `npm run test:menu-rights`, `npm run test:sales-erp-contracts`, `npm run typecheck` and `npx prisma validate`.
