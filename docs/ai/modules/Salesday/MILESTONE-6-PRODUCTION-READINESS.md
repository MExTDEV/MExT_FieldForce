# Milestone 6 — Operational KPI, Power BI link and production readiness

Status: `IMPLEMENTED IN SOURCE — EXTERNAL ACCEPTANCE PENDING`

Implemented on 17 July 2026. Not pushed, deployed or applied to production by this milestone.

## Implemented source scope

Milestone 6 adds the final source-level production-readiness layer without claiming production readiness.

- `/salesday` now opens an operational overview instead of a blocked operational agenda call.
- `GET /api/salesday/operational-dashboard` returns current-day operational indicators from existing SalesDay, Inventory, cash and ERP-ledger tables.
- The overview shows only operational indicators: appointments, documents, cash, inventory warnings, sync state, day closure and pilot-flag counts.
- Power BI remains the official reporting source. FieldForce stores only a validated HTTPS Power BI link in `AppSetting` key `salesday.powerbi.v1`.
- `PUT /api/salesday/power-bi-link` requires `salesday.settings.manage` and audits changes as `salesday.powerbi.set`.
- Embedded Power BI is deliberately not implemented. No `iframe` and no Power BI client dependency are introduced.
- Production-readiness checks are calculated from source state and explicit external evidence flags. Missing real ERP, UAT, migration, backup/restore and MDM evidence remain `EXTERNAL`.
- `scripts/generate-salesday-uat-plan.ts` generates all-country UAT fixture/checklist items for BE, NL and DE across Representative, Sales Leader, Backoffice and Admin groups.
- `scripts/test-salesday-operational-readiness.ts` validates URL security, readiness status, no embedding, translation parity and UAT coverage.

## Operational indicators

The operational overview is not reporting.

It derives only day-level operational state from the current replica and ledger:

- appointment counts by state;
- document count, total amount including VAT and document/delivery state;
- non-zero confirmed cash balances;
- Representative-vehicle expiry warnings inside the 180-day policy window;
- open replenishments and consumables requests;
- open ERP outbox commands and reconciliation incidents;
- last ERP replica checkpoint;
- active SalesDay pilot-control flag count.

Power BI remains the single source of truth for historical KPI, official reporting and management analysis.

## Production readiness gates

The readiness summary intentionally blocks or marks external gates until evidence exists:

- SalesDay, Inventory, Offline Commands and ERP Writes must be enabled for the intended pilot scope.
- Runtime provider must not be `MOCK`.
- Production cannot activate mock provider/mock seed.
- Open P0/P1-equivalent reconciliation incidents must be zero.
- Open ERP outbox commands must be explained before cutover.
- Real ERP end-to-end acceptance is external evidence.
- All-country UAT sign-off is external evidence.
- Migration rehearsal, backup/restore and MDM/device-loss exercises are external evidence.

The optional evidence store is `AppSetting` key `salesday.productionReadiness.v1`. It is not automatically set by the application because those checks require human/external proof.

## Monitoring and alert handling

Monitor these operational signals during pilot and cutover:

1. `GET /api/health` for application/database availability.
2. `GET /api/salesday/operational-dashboard` for scoped SalesDay indicators.
3. `GET /api/salesday/sync/status` for Representative/device sync state.
4. `ErpReconciliationIncident` open count and severity.
5. `ErpOutboxCommand` open/retryable/rejected counts and oldest open command.
6. `ErpReplicaCheckpoint.lastSuccessfulSyncAt` freshness per provider stream.
7. Cash non-zero weekly gate count.
8. Device registration/control commands and replacement-required states.

Alert escalation:

- Open reconciliation incident: integration owner + backoffice; do not replay blindly.
- Old open outbox command: inspect dependency and acknowledgement state before retry.
- Cash block: verify ERP/backoffice deposit acknowledgement; no manual FieldForce override.
- Mock provider in production: stop activation and correct runtime before any pilot.
- Device lost: follow device-loss recovery below.

## Reconciliation procedure

1. Identify the affected command, event or entity.
2. Preserve all `ErpOutboxCommand`, `ErpInboxMessage`, evidence, document number, signature, stock and cash records.
3. Compare FieldForce command ID/business key with ERP acknowledgement or event source identity.
4. If ERP accepted the transaction, reconcile the existing command; do not create a replacement command with a new identity.
5. If ERP rejected the transaction, record the terminal state and expose the operational failure.
6. If delivery is uncertain, keep the command retryable or incident-open until ERP confirms status.
7. Resolve the `ErpReconciliationIncident` only after source and target evidence match.

## Backup/restore exercise

Before production:

1. Take a database backup after a representative has appointments, documents, stock, cash and pending outbox records.
2. Restore into a non-production environment.
3. Verify document numbers, signatures, outbox commands, inbox checkpoints, inventory balances and cash entries.
4. Run SalesDay targeted tests and `npx next build`.
5. Document timestamp, operator, backup identifier, restore target and verification result.

## Device-loss exercise

Before production:

1. Simulate a lost Android tablet.
2. Issue MDM lock/wipe outside FieldForce.
3. Revoke the `DeviceRegistration` in FieldForce.
4. Confirm encrypted local key material can no longer sync.
5. Bootstrap a replacement device for the same Representative.
6. Confirm no unacknowledged command identity is reused on the replacement device without controlled reconciliation.

## Cutover and rollback rehearsal

Cutover rehearsal must prove:

- migrations apply forward without destructive statements;
- feature flags can activate/deactivate by country/team/user;
- ERP writes can be disabled independently from reads/events;
- pending outbox/evidence records remain intact during rollback;
- mock provider/mock data cannot activate in production;
- Power BI link opens externally without embedded reporting;
- rollback leaves new tables/columns intact but unused until reconciliation.

## Validation

Source validation for this milestone:

- `npm run test:salesday-operational-readiness`
- `npm run salesday:uat-plan`
- `npm run test:salesday-feature-controls`
- `npm run test:salesday-sync-runtime`
- `npm run test:salesday-cash-gate`
- `npm run test:inventory-shared`
- `npm run lint`
- `npm run typecheck`
- `npx prisma validate`
- `npx next build`

External production validation remains pending until the real ERP tenant, country UAT sign-offs, migration rehearsal, backup/restore and MDM/device-loss exercises are completed.
