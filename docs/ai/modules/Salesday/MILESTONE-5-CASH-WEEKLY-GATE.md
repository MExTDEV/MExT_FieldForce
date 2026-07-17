# Milestone 5 — Cash and weekly access control

Status: `IMPLEMENTED IN SOURCE`

Implemented on 17 July 2026. Not deployed by this milestone.

## Scope

Milestone 5 implements the approved SalesDay cash-sheet gate without adding a manual FieldForce override path.

- ERP payment methods are replicated into `SalesPaymentMethod`.
- ERP/backoffice-confirmed Representative cash balances are replicated into `SalesCashBalance`.
- Cash-affecting evidence is stored in immutable `SalesCashEntry` records.
- Sales documents store the chosen ERP payment method.
- Only ERP payment methods marked `affectsCashBalance` create cash entries, and ordinary `ORDER` documents do not affect cash.
- On the first effective workday of a week, SalesDay blocks operational work until every confirmed cash balance for the Representative is exactly zero.
- First effective workday calculation uses country timezone, holidays and existing Representative appointment planning.
- While cash-blocked, only the SalesDay landing page, cash sheet, sync and support remain reachable.
- Unblocking happens automatically when the ERP/backoffice sends a `cash-balance.upserted` event/bootstrap record with exact zero balance.

## Main implementation

- Migration: `prisma/migrations/0055_salesday_cash_weekly_gate/migration.sql`
- Schema: `SalesPaymentMethod`, `SalesCashBalance`, `SalesCashEntry`, document payment-method linkage
- Pure date policy: `lib/salesday/cash.ts`
- Server cash service: `lib/server/salesday-cash.ts`
- Day gate integration: `lib/server/salesday-day-access.ts`, `lib/salesday/day-access.ts`
- Cash API: `app/api/salesday/cash/route.ts`
- Document cash effect: `lib/server/salesday-commercial-documents.ts`
- ERP event application: `lib/server/salesday-business-relations.ts`
- UI notice: `components/salesday/day-gate-notice.tsx`
- Menu permission: `menu.salesday.cash`

## Security and ownership rules

- There is no `POST`, deposit or override endpoint under `app/api/salesday/cash`.
- Admin and Super Admin can configure rights, but cannot manually clear a Representative cash block.
- Emergency mode does not clear a cash block.
- The normal unblock path is ERP/backoffice confirmation through the existing ERP replica flow.
- The cash sheet API remains available while blocked so the user can see why the day is blocked and sync/support remain usable.

## Validation

Validated with:

- `npx prisma validate`
- `npx prisma generate --no-engine`
- `npm run test:salesday-cash-gate`
- `npm run test:salesday-day-gate`
- `npm run test:salesday-commercial-documents`
- `npm run test:sales-erp-contracts`
- `npm run test:salesday-feature-controls`
- `npm run lint`
- `npm run typecheck`
- `npx next build`
