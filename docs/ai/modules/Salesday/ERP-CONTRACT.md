# SalesDay ERP Contract

## Status

- Provider-neutral contract: `DEFINED` as `sales-erp.v1`
- Deterministic mock provider: `IMPLEMENTED FOR DEVELOPMENT AND CONTRACT TESTS`
- Business Central/NAV transport and mapping: `UNDEFINED`
- Odoo transport and mapping: `UNDEFINED`

This document owns the application-level boundary between SalesDay and an ERP. It does not define a native ERP endpoint, authentication scheme, webhook, queue or delivery guarantee. Those details must be mapped by a concrete adapter after the real interface is supplied.

## Ownership and authority

FieldForce owns local user input, offline drafts, permissions, command ordering and presentation. ERP-originated customer, appointment, article, price, commercial-history, replenishment, cash and reference data is replicated for scoped operational use.

A FieldForce mutation is not final ERP data until the ERP acknowledges its command. While a customer or appointment command is pending, the FieldForce change has conflict priority. An ERP event with a competing version must not silently overwrite it; reconciliation must resolve or surface the conflict.

## Versioning

Every page, event, command, acknowledgement and reconciliation result carries `schemaVersion: sales-erp.v1`. A breaking semantic or structural change requires a new version. Adapters must reject unsupported versions instead of guessing.

Canonical application values use:

- ISO `YYYY-MM-DD` for business dates;
- ISO-8601 UTC instants for timestamps;
- an explicit IANA timezone where local scheduling matters;
- decimal strings for amounts, quantities and percentages;
- ISO country codes `BE`, `NL` and `DE`;
- stable FieldForce status values, with native ERP statuses mapped explicitly by an adapter.

## Provider port

`SalesErpPort` exposes five operations:

1. `getCapabilities` announces supported resources and commands.
2. `getBootstrapPage` returns a scoped, cursor-paged resource snapshot.
3. `getEvents` returns ordered, cursor-paged ERP changes.
4. `submitCommand` sends one idempotent FieldForce mutation.
5. `getCommandStatus` and `reconcile` recover acknowledgement state after timeouts or outages.

The port is transport-neutral. Polling, webhook ingestion or queue consumers may feed the same event contract.

## ERP to FieldForce resources

| Resource | Purpose |
| --- | --- |
| `customers` | Customer/prospect identity, contacts, addresses, billing validation and effective scope |
| `appointments` | ERP/contact-center sequence and appointment state |
| `articles` | Official SKU, descriptions, VAT, units, tracking flags and country prices |
| `commercialHistory` | Quote/order/delivery/invoice/credit-note history with immutable line snapshots |
| `replenishments` | Representative shipments and expected lines |
| `cashBalances` | ERP-confirmed Representative cash balance and last deposit confirmation |
| `appointmentOutcomeReasons` | ERP-managed non-execution reasons |
| `documentCategories` | ERP-managed customer/appointment attachment categories |
| `paymentMethods` | ERP-managed payment methods and cash impact |
| `customerLocations` | Customer locations, sublocations and carriers |
| `carrierBalances` | Article balance per customer carrier, including optional lot/expiry |

Bootstrap requests include country, Representative and effective team scope. The adapter may return less than that effective scope, never more. Appointment-gated customer-detail access remains a FieldForce application rule on top of the replica.

Events carry a provider, globally stable `messageId`, entity external ID, source version and occurrence time. The future inbox must enforce uniqueness on provider plus message ID and apply an event transactionally.

## FieldForce to ERP commands

The versioned command set covers:

- customer/prospect changes;
- own appointment creation/change and appointment outcome;
- visit report and immutable addendum;
- lead, follow-up and customer-provided reference;
- Order, Order-Reeds-Geleverd and Factuur with signed snapshots;
- customer location/carrier changes and optional carrier count;
- replenishment receipt;
- consumables request;
- day close;
- staged attachment submission.

All commands carry a stable `commandId`, semantic `businessKey`, generated `idempotencyKey`, actor/device/country context and optional command dependencies.

An appointment outcome carries the stable local appointment ID and may omit the external appointment ID while its own-appointment create command is still pending. In that case the outcome depends on the create command; an adapter resolves the acknowledged external identity before submission. Cancellation is represented as an appointment outcome and, like moved/not-completed, uses the ERP reason contract.

## Idempotency and ordering

The idempotency key is a SHA-256 hash over canonical JSON containing command type, business key, context and payload. Object keys are sorted; array order is preserved. `commandId` and `issuedAt` are excluded so a transport retry remains the same business request.

Rules:

- retry the same command with the same command ID and idempotency key;
- return the prior acknowledgement for an identical duplicate;
- reject the same idempotency key with a different semantic fingerprint;
- never send a command before all `dependsOnCommandIds` are acknowledged as `ACCEPTED`;
- persist the local mutation and future outbox command in one database transaction;
- never infer success from a timeout: query status or reconcile.

Important dependency examples include prospect creation before its first sale, location creation before carrier count, and sales document acknowledgement before related finalisation where the concrete ERP requires it.

For `sales-document.create`, FieldForce includes external customer and appointment IDs when already acknowledged. If a prospect/customer or own appointment is still pending, the command carries `localRelationId` and/or `localAppointmentId` and depends on the earlier command. The adapter must resolve the acknowledged ERP identity before native submission. Document lines include `representativeStockImpactQuantity` so Order, Order-Reeds-Geleverd and Factuur stock effects remain deterministic across retries.

## Acknowledgements, retry and reconciliation

Acknowledgement statuses are:

- `ACCEPTED`: final provider acknowledgement with external ID/version when available;
- `REJECTED`: permanent business or contract rejection requiring correction or an explicit workflow;
- `RETRYABLE`: transient outage or an unacknowledged dependency.

Contract errors distinguish invalid input, unsupported capability, idempotency conflict, missing dependency, unavailable provider, provider rejection and invalid cursor. Concrete adapters must map native errors into these stable classes and retain the native code in diagnostics where safe.

Reconciliation receives command IDs and returns known acknowledgements plus unknown IDs. This is mandatory for acknowledgement loss, process crashes and ERP recovery.

## Mock policy

The mock dataset is fully fictitious, deterministic and covers Belgium, the Netherlands and Germany. Email addresses use the reserved `.invalid` domain. Fixtures must remain clearly marked as demo data and must not be generated from production exports.

The factory rejects the `MOCK` provider when the runtime environment is `production`, unless the server operator explicitly enables controlled live system-test mode through `SALESDAY_PRODUCTION_MOCK_MODE=true`. BC/NAV and Odoo also fail closed until their adapters exist. No environment may automatically fall back to mock data or a different provider.

The Milestone 7 UAT seed runner remains a non-production operator tool. A separate live-system runner may target the controlled live test environment only with the production-mock switch, the non-test-database acknowledgement and the explicit operator command. It preserves real users, creates user-scoped fictitious records, fills a bounded rolling daily SalesDay appointment window and is not an ERP substitute.

## Real-adapter acceptance gate

A real adapter is not accepted until all resource and command mappings document:

- native endpoint/message and authentication;
- source ID and version semantics;
- status and timezone conversion;
- decimal precision and rounding;
- paging/checkpoint behaviour;
- duplicate-delivery and acknowledgement guarantees;
- error-to-retry classification;
- reconciliation after timeout;
- scope enforcement;
- test-tenant evidence for every supported capability.

## Shared Inventory command ownership

Milestone 4 persists Inventory source records locally but keeps the ERP/backoffice as owner of central warehouse stock, fulfilment and later consumables status.

- `replenishment-receipt.submit` is emitted once per local receipt key and includes the local receipt ID, replenishment external ID, actual and damaged quantities, signature upload token and photo upload tokens.
- `consumables-request.create` is emitted once per local request key. FieldForce does not approve, edit or cancel the request after submission.
- `customer-location.upsert` is emitted for create, edit and archive of customer locations, sublocations and carriers. Archiving carries the FieldForce reason code.
- `carrier-count.submit` is emitted for optional physical customer-carrier counts. Lines include theoretical quantity, counted quantity and reason code when a discrepancy exists.
- Direct delivery SalesDay documents create local Inventory movements in the same transaction as the document source record and ERP outbox command. Ordinary Orders may carry an intended carrier but do not increase customer-carrier stock until ERP delivery confirmation.

## Cash and payment ownership

Milestone 5 keeps payment methods and cash-balance clearing ERP-owned.

- `paymentMethods` are replicated from the ERP and determine whether a SalesDay document has cash impact.
- `sales-document.create` may include `paymentMethodExternalId`; FieldForce stores the selected ERP method but does not invent payment types.
- Only payment methods with `affectsCashBalance = true` create local cash entries, and ordinary `ORDER` documents do not affect the Representative cash balance.
- `cashBalances` are the ERP/backoffice-confirmed Representative balances. They are the normal source for clearing the weekly exact-zero cash gate.
- FieldForce does not emit a deposit-confirmation or manual cash-override command. A Representative can see the cash sheet and sync/support while blocked, but unblocking requires a replicated ERP/backoffice confirmation.

## Production acceptance boundary

Milestone 6 adds source-level readiness checks, but the real ERP adapter remains an external acceptance gate.

- Every command and event type in this contract must complete a real test-tenant round trip before production activation.
- Mock provider and mock seed are forbidden in normal or real-ERP-accepted production; controlled live system-test mode is the sole explicit temporary exception.
- Reconciliation incidents must be resolved from ERP evidence; FieldForce must not recreate uncertain business transactions with new command identities.
- The operational dashboard may surface current ledger health, but Power BI remains the official historical reporting and KPI source.
