# SalesDay Shared Schema and Migration Design

## Status and scope

Status:

- shared BusinessRelation/Article bridges: `DESIGNED — NOT APPLIED`;
- ERP integration ledger: `IMPLEMENTED IN PRISMA + MIGRATION 0040 — DATABASE DEPLOYMENT PENDING`;
- cash/payment replicas and weekly gate evidence: `IMPLEMENTED IN PRISMA + MIGRATION 0055 — DATABASE DEPLOYMENT PENDING`.

The shared relation/article models below remain proposed logical names. The integration-ledger subset is now implemented as `ErpInboxMessage`, `ErpOutboxCommand`, `ErpOutboxDependency`, `ErpReplicaCheckpoint` and `ErpReconciliationIncident`. No production data has been migrated.

This design resolves the Milestone 0 ownership path for Contract customers/articles and specifies the later ERP replica/inbox/outbox foundation.

## Data classes

Keep four data classes explicit:

1. **ERP replica:** latest acknowledged external customer, appointment, article, price, history, replenishment, cash and reference data.
2. **FieldForce operational state:** drafts, visit execution, offline command state, scope snapshots and device context.
3. **Immutable evidence:** signed document lines/totals, visit reports, addenda, signatures, rendered-document hashes and audit events.
4. **Integration ledger:** inbound messages, outbound commands, dependencies, acknowledgements, attempts, checkpoints and reconciliation incidents.

Replica records are not a second ERP master. Pending FieldForce customer/appointment edits are retained as local commands until acknowledged, after which the acknowledged replica version becomes current.

## Shared business relation

Introduce a shared `BusinessRelation` root instead of creating another SalesDay customer table.

Proposed shape:

| Concept | Required fields and constraints |
| --- | --- |
| `BusinessRelation` | internal ID, type `CUSTOMER/PROSPECT`, legal/display name, VAT number, language, active/block state, country, current owner/team scope, demo flag, timestamps |
| `BusinessRelationContact` | relation FK, type, name, email/phone/mobile, primary, active, stable source identity |
| `BusinessRelationAddress` | relation FK, type, structured address, country, primary, active, stable source identity |
| `BusinessRelationBillingValidation` | relation FK, state, modulo-97 result, VIES/Peppol check timestamps, official legal/billing snapshots |
| `BusinessRelationExternalLink` | relation FK, provider, external ID, source version and source update time |

External identity is unique by `(provider, externalId)` within the relation-owned link table, never by external ID alone. Entity-specific link tables preserve real foreign keys instead of a polymorphic unvalidated local ID. Primary contact/address uniqueness must be enforced by the service transaction because MariaDB conditional uniqueness is limited. Historic source versions belong in integration evidence, not parallel current relation rows.

### Contract customer bridge

`ContractCustomer` already contains useful customer data and is referenced by Contract calculations. It must not be dropped or bulk-replaced in the first SalesDay migration.

Use this forward-compatible sequence:

1. Add the shared relation tables and an optional, unique `businessRelationId` bridge on `ContractCustomer`.
2. Backfill one shared relation for every Contract customer, preserving owner, team/country snapshots, language, VAT, demo marker and external source identity.
3. Verify one-to-one counts, field checksums, country/owner scope and every Contract calculation reference.
4. Change Contract create/update services to write `BusinessRelation` as canonical data and maintain the compatibility row in the same transaction.
5. Add a nullable shared-relation FK to the Contract aggregate where required, backfill it through the bridge, then switch reads behind a server-side flag.
6. Keep the compatibility fields until all Contract queries, exports, letters and tests use the shared relation. Removal is a later destructive migration with its own rollback rehearsal.

During the bridge period the shared relation is canonical. `ContractCustomer` is a compatibility projection, not an independent source of truth. Existing signed/generated Contract documents keep their captured customer snapshot and are never rewritten.

## Shared saleable article

Do not reuse Coaching `Product` as an ERP SKU. Coaching `Product` is a compact analysis dimension with a unique name and no SKU, price, VAT, unit or source-version semantics.

Introduce:

| Concept | Required fields and constraints |
| --- | --- |
| `Article` | internal ID, article number, optional stem number, NL/FR/DE descriptions, unit, VAT rate, active and tracking flags |
| `ArticlePrice` | article FK, country, currency, price type, amount, validity interval, source identity |
| `ArticleExternalLink` | article FK with provider-scoped external article ID and version |
| `ArticlePriceExternalLink` | price FK with provider-scoped external price ID and version where supplied |

`articleNumber` is the stable business key only when the ERP mapping confirms that guarantee. Integration identity remains unique by `(provider, externalId)` within each entity-specific link table. Overlapping active price intervals for the same article/country/currency/type must be rejected by the application service.

### Contract article bridge

1. Add shared article/price tables and an optional, unique `articleId` bridge on `ContractArticle`.
2. Backfill article identity, descriptions, unit, VAT and active state.
3. Backfill current Contract price/cost as explicitly typed compatibility prices or cost snapshots; do not pretend they are ERP sales prices without mapping evidence.
4. Keep `ContractCalculationLine` snapshots immutable.
5. Switch Contract catalogue reads to shared articles only after calculation/import/letter regression tests pass.
6. Retain `ContractArticle` compatibility rows until model-version imports and all historic calculations no longer depend on them.

## ERP replica models

Migrations should add dedicated replica aggregates for:

- appointments with business date, UTC times, timezone, sequence, canonical/native status and relation/Representative/team scope;
- commercial-history documents and immutable lines;
- replenishments and expected receipt lines;
- Representative cash balances and deposit acknowledgement;
- ERP-managed appointment reasons, attachment categories and payment methods;
- customer locations/sublocations/carriers and carrier article balances.

Store the canonical status used by FieldForce plus the native status/code needed for diagnostics. Do not add competing lifecycle fields to an existing aggregate merely to avoid mapping.

Milestone 5 implements the cash/payment subset as `SalesPaymentMethod`, `SalesCashBalance`, `SalesCashEntry` and the Sales document payment-method link. ERP/backoffice confirmation remains the source for clearing the weekly exact-zero cash gate; FieldForce does not store a manual override state.

## Integration ledger

The later persistence layer requires at least:

| Logical model | Purpose and critical constraints |
| --- | --- |
| `ErpInboxMessage` | provider + message ID unique, event type/version, payload hash/body, received/applied timestamps, processing status/error |
| `ErpOutboxCommand` | command ID unique, idempotency key unique, schema/type/business key, payload/context, status, attempts, next attempt, acknowledgement and error |
| `ErpCommandDependency` | unique `(commandId, dependsOnCommandId)`, no self dependency |
| `ErpReplicaCheckpoint` | unique provider + stream/resource + scope key, opaque cursor/checkpoint |
| `ErpReconciliationIncident` | missing/mismatched command or entity, severity, state, detected/resolved timestamps and audit reference |

The business mutation and `ErpOutboxCommand` insert must commit in one database transaction. Inbox application and its applied marker must also commit together. Workers claim due commands with bounded batches and a lease/compare-and-set pattern suitable for MariaDB; process memory is never the ledger.

`ACCEPTED` and `REJECTED` are terminal acknowledgement states. `RETRYABLE` schedules another attempt. A command that was sent but timed out remains uncertain until status lookup/reconciliation; it must not be recreated with a new business key.

## Precision, dates and snapshots

Proposed database precision:

- money and unit price: `Decimal(14,4)`;
- quantity: `Decimal(14,3)` unless the confirmed ERP requires greater scale;
- VAT/percentage: `Decimal(5,2)`;
- document totals: `Decimal(16,4)` where aggregation can exceed line scale.

Use database decimals and contract decimal strings, never floating-point arithmetic. Define and test the rounding point per document type when the real ERP mapping is known.

Business date is stored separately from UTC timestamps. Scheduled appointments retain their IANA timezone. Every signed commercial line stores article number, description, unit price, VAT, quantity and unit snapshots; later article or customer changes do not rewrite signed documents.

## Migration sequence

Every migration is forward-only and deployed through expand, backfill, verify, switch and later contract phases:

1. **Preflight:** database backup/restore check, row counts, duplicate external IDs/article numbers, orphan checks and storage sizing.
2. **Expand:** additive tables, nullable bridges, indexes and feature flags; old code remains valid.
3. **Backfill:** bounded idempotent batches with progress and checksum reporting.
4. **Verify:** relation/article parity, Contract calculations, scope, external uniqueness and replica fixture rebuild.
5. **Switch:** enable canonical shared reads/writes per country/team only after validation.
6. **Observe:** reconciliation dashboards and rollback by flag to the compatibility read path.
7. **Contract:** remove duplicate compatibility fields only in a later release after rollback is no longer required.

No production migration starts until the concrete BC/NAV mapping is approved for external identity, versions, timestamps, statuses and decimal semantics.

## Required migration tests

- Contract customer/article backfill is idempotent and count-preserving;
- no Contract calculation, line, generated letter or signed evidence changes;
- duplicate provider external IDs fail before switch;
- old application code can run against the expanded schema during rollout;
- new application code can read every backfilled Contract aggregate;
- rollback flag restores compatibility reads without data loss;
- mock snapshot plus events rebuild the same replica twice;
- outbox/inbox crash tests prove no silent command or event loss;
- MariaDB indexes and batch queries are verified on production-like volume.
