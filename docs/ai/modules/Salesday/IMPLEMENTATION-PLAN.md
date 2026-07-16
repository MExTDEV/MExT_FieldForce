# SalesDay Implementation Plan

## 1. Objective

Build the approved SalesDay and shared Inventory functionality as native FieldForce modules.

The first production activation must support the complete approved operational scope, including offline writes. Development and review proceed through internal milestones. Each milestone is independently testable and remains behind server-side feature flags until the production gate passes.

This plan does not authorise invented ERP behaviour. The provider-neutral mock adapter is a development aid, not a production fallback.

## 2. Non-negotiable constraints

- Preserve all existing Coaching, Contract, authentication, user, role and permission behaviour.
- Reuse FieldForce shell, translations, storage, API error handling and effective scope.
- ERP is the final effective source after acknowledgement.
- FieldForce persists replica, drafts, commands, evidence and reconciliation metadata only as required for offline/reliable operation.
- No SalesApp mock record is migrated as business data.
- No production activation without a real, accepted ERP adapter.
- No client-only permission, stock, cash, document-number or lifecycle rule.
- No silent command loss, last-write-wins by browser timestamp or duplicate business command.
- No direct copy of the SalesApp monolith, Supabase subrepository, login, role switcher or package/runtime configuration.

## 3. Delivery model

### 3.1 Production promise

The first activated production SalesDay includes milestones 1 through 5 below.

Milestone 6 reporting is limited to operational indicators and a Power BI link. Embedded Power BI is explicitly optional and later.

### 3.2 Flags

Use server-evaluated flags at these levels:

- global SalesDay kill switch;
- country activation;
- team activation;
- user pilot override;
- Inventory activation;
- offline-command activation;
- ERP adapter write activation;
- emergency mode, centrally controlled and incident-bound.

Flags affect navigation, pages, APIs, bootstrap datasets and background processing. A public client environment variable alone is not a security control.

### 3.3 Environments

- Development: deterministic mock adapter and repeatable fictitious seed allowed.
- Test/UAT: mock adapter and later isolated ERP test tenant.
- Production: real ERP adapter only; mock seed and mock fallback must fail closed.

## 4. Target source structure

The exact filenames may be refined to existing conventions, but ownership must remain clear.

```text
app/salesday/
  layout.tsx
  page.tsx
  mijn-voorbereiding/page.tsx
  mijn-voorbereiding/[appointmentId]/page.tsx
  mijn-agenda/page.tsx
  afspraken/[appointmentId]/page.tsx
  afspraken/nieuw/page.tsx
  dagafsluiting/page.tsx
  mijn-team/page.tsx
  verkoop/nieuw/page.tsx
  verkoop/[documentId]/page.tsx
  kas/page.tsx

app/inventory/
  mijn-voorraad/page.tsx
  bevoorrading/page.tsx
  bevoorrading/[receiptId]/page.tsx
  verbruiksgoederen/page.tsx

app/beheer/salesday/
  page.tsx
  voorbereiding/page.tsx
  document-overrides/page.tsx
  handtekening-uitzonderingen/page.tsx
  archiefredenen/page.tsx
  cash/page.tsx

app/api/salesday/
  bootstrap/route.ts
  dashboard/route.ts
  preparations/route.ts
  preparations/[appointmentId]/route.ts
  appointments/route.ts
  appointments/[appointmentId]/route.ts
  appointments/[appointmentId]/outcome/route.ts
  appointments/[appointmentId]/visit-report/route.ts
  appointments/[appointmentId]/references/route.ts
  appointments/[appointmentId]/leads/route.ts
  appointments/[appointmentId]/follow-ups/route.ts
  appointments/[appointmentId]/attachments/route.ts
  day-close/route.ts
  customers/search/route.ts
  customers/[relationId]/route.ts
  customers/[relationId]/attachments/route.ts
  customers/[relationId]/locations/route.ts
  recommendations/route.ts
  sales-documents/route.ts
  sales-documents/[documentId]/route.ts
  sales-documents/[documentId]/sign/route.ts
  sales-documents/[documentId]/render/route.ts
  sales-documents/[documentId]/override/route.ts
  team/route.ts
  cash/route.ts

app/api/inventory/
  balances/route.ts
  replenishments/route.ts
  replenishments/[receiptId]/route.ts
  replenishments/[receiptId]/evidence/route.ts
  consumables/route.ts
  carrier-balances/route.ts
  carrier-counts/route.ts

app/api/sync/
  bootstrap/route.ts
  commands/route.ts
  status/route.ts
  acknowledge/route.ts
  emergency/route.ts

components/salesday/
components/inventory/
components/management/salesday/

lib/salesday/
  permissions.ts
  routes.ts
  types.ts
  status.ts
  formatting.ts
  recommendations.ts

lib/inventory/
  types.ts
  movement-policy.ts
  quantities.ts

lib/server/salesday/
  access.ts
  scope.ts
  service.ts
  repository.ts
  mappers.ts
  day-close.ts
  sales-document-service.ts
  document-renderer.ts

lib/server/inventory/
  access.ts
  service.ts
  receipt-service.ts
  carrier-stock-service.ts

lib/server/integrations/sales-erp/
  port.ts
  contracts.ts
  errors.ts
  idempotency.ts
  reconciliation.ts
  mock-adapter.ts
  bc-nav-adapter.ts       # only after interface is known
  odoo-adapter.ts         # later

lib/server/sync/
  command-service.ts
  event-consumer.ts
  projection-service.ts
  retry-policy.ts
  emergency-mode.ts

lib/device/
  encrypted-store.ts
  draft-store.ts
  sync-queue.ts
  biometric-gate.ts
  printing.ts
```

Do not add empty placeholder route trees. Create only the files used by the current milestone.

## 5. Provider-neutral ERP contracts

### 5.1 Read/event contracts

Define versioned internal contracts for:

- customers/prospects, contacts and addresses;
- customer locations, sublocations and carriers;
- appointments, sequence and non-execution reasons;
- articles, descriptions, units, VAT, prices, lot/expiry flags;
- complete commercial history and payment/open-balance status;
- central stock, in-transit shipments and corrections;
- payment methods and cash-deposit acknowledgement;
- document/photo categories;
- leads, follow-ups and references;
- commercial-document acknowledgements and delivery status;
- VIES/Peppol normalised billing results where the ERP exposes them.

Every event has:

- provider name;
- event/message ID;
- entity type and external ID;
- source version;
- occurred-at timestamp and source timezone semantics;
- payload schema version;
- correlation/reconciliation identifiers.

### 5.2 Command contracts

Commands cover:

- update/create customer or prospect;
- create/update/cancel/complete appointment;
- submit visit report/addendum;
- create lead, follow-up or reference;
- create Order, Order-Reeds-Geleverd or Factuur;
- submit signature/exception evidence;
- create/archive customer location/carrier;
- submit carrier count/correction;
- acknowledge replenishment actuals/discrepancies/evidence;
- create consumables request;
- close day;
- submit attachments;
- consume reserved document number.

Every command has a stable FieldForce command ID and deterministic business idempotency key. Retrying the same command returns the same acknowledgement. Reusing the key with different content is an error.

### 5.3 Ordering

The queue supports explicit dependencies, for example:

```text
CreateProspect
  → Promote/CreateCustomer
  → CreateSalesDocument
  → UploadSignatureEvidence
  → ERP customer delivery status
```

and:

```text
CreateSalesDocument
  → Representative stock movement
  → Customer carrier movement where required
```

## 6. Persistence design

The Prisma schema is designed during milestone 0 and added only when its milestone uses it. Final names must follow existing FieldForce conventions.

### 6.1 Shared relation replica

- `BusinessRelation`
- `BusinessRelationExternalReference`
- `BusinessContact`
- `BusinessAddress`
- optional `BusinessRelationValidation`

These are marked with ERP identity/version/freshness and sync state. They serve SalesDay and Contract. Migration from or linkage to local `ContractCustomer` must preserve all existing Contract records and tests.

### 6.2 Appointment and execution replica

- `SalesAppointment`
- `SalesAppointmentExternalReference`
- `SalesAppointmentOutcome`
- `SalesPreparationState`
- `SalesPreparationNote`
- `SalesVisitReport`
- `SalesVisitReportAddendum`
- `SalesLeadReplica`
- `SalesFollowUpReplica`
- `SalesReferenceReplica`
- `SalesDayClosure`

Immutable outcomes and closed reports are not overwritten by a later import.

### 6.3 Article and commercial snapshots

- generalised `Article` direction from local `ContractArticle`;
- `ArticleExternalReference`;
- `ArticleCountryConfiguration`;
- `ArticlePriceReplica`;
- `SalesDocumentDraft`/pending document;
- `SalesDocumentLineSnapshot`;
- `ReservedDocumentNumberBlock` and `ReservedDocumentNumberUse`;
- `SalesDocumentSignatureEvidence`;
- `SalesDocumentOverrideReason` and use record.

Official acknowledged documents remain ERP-owned. FieldForce stores the pending transaction, immutable snapshot/evidence and replica needed for offline viewing and reconciliation.

### 6.4 Shared Inventory

- `InventoryLocation` with warehouse, transit, vehicle/Representative, customer carrier and quarantine types;
- `InventoryMovementCommand`/immutable local movement;
- `InventoryBalanceReplica`;
- `InventoryReplenishmentReplica` and lines;
- `InventoryReceipt` and lines;
- `InventoryReceiptEvidence`;
- `InventoryDiscrepancy`;
- `ConsumablesRequestReplica` and lines;
- `CustomerLocation`, `CustomerCarrier`, archive reason/use;
- `CustomerCarrierBalanceReplica`;
- `CustomerCarrierCount` and correction movement.

Quantities and money use Prisma `Decimal` with documented scale. No JavaScript floating-point business calculation.

### 6.5 Cash

- `CashBalanceReplica`;
- `CashEntryReplica`;
- `CashDepositReplica`;
- `CashAccessBlock`/derived policy state;
- first-workday calendar/configuration dependencies.

The ERP/backoffice acknowledgement is required to remove a cash block.

### 6.6 Synchronisation and devices

- `IntegrationRun`;
- `IntegrationCursor`;
- `IntegrationEventInbox` with unique provider event ID;
- `IntegrationCommandOutbox`;
- `IntegrationCommandAttempt`;
- `IntegrationConflict`;
- `ReplicaCheckpoint`;
- `DeviceRegistration`;
- `DeviceSyncCheckpoint`;
- `EmergencyModeIncident`;
- generic file staging/cache metadata where existing storage models are insufficient.

Critical local record, command/outbox and domain movement are persisted in one Prisma transaction.

## 7. Permissions

Final keys must be added to the central typed permission catalogue, role defaults, navigation, user overrides, API enforcement and tests.

Suggested keys:

```text
menu.salesday.enabled
menu.salesday.dashboard
menu.salesday.preparation
menu.salesday.agenda
menu.salesday.team
menu.salesday.sales
menu.salesday.cash
menu.inventory.enabled
menu.inventory.myStock
menu.inventory.replenishments
menu.inventory.consumables

salesday.customers.read
salesday.customers.writeOwnAppointment
salesday.appointments.read
salesday.appointments.writeOwn
salesday.visitReports.writeOwn
salesday.sales.createOwn
salesday.dayClose.own
salesday.team.read
salesday.manage

inventory.balance.readOwn
inventory.receipts.acceptOwn
inventory.consumables.requestOwn
inventory.carriers.writeOwnAppointment
inventory.manage

salesday.integration.monitor
salesday.emergencyMode.manage
salesday.settings.manage
```

Representative defaults grant own operational actions. Management defaults grant scoped read only. Admin/Super Admin management actions remain explicit rather than implied by role name.

## 8. Internal milestones

## Milestone 0 — Contracts, baseline and migration design

Status: `COMPLETE` (16 July 2026)

Evidence and deliberately unresolved adapter details are recorded in `MILESTONE-0-BASELINE.md`, `ERP-CONTRACT.md` and `SCHEMA-DESIGN.md`.

### Deliverables

- approve this decision document and plan;
- baseline current local Contract code and its tests;
- define the provider-neutral ERP port and versioned fixtures;
- decide the safe `ContractCustomer` → shared relation path;
- decide the `ContractArticle` → shared article path without assuming Coaching `Product` is a SKU;
- define date/time/status mappings, decimal scales and external-ID uniqueness;
- define command ordering, retry classes, conflict result and reconciliation reports;
- define server-side flags and production fail-closed configuration;
- create mock-data policy and fixture catalogue;
- repair or formally isolate existing red test-harness baselines.

### Exit criteria

- no unresolved contradiction between Contract and SalesDay ownership;
- schema/migration design reviewed without running production migrations;
- real ERP interface remains explicitly unresolved, not guessed;
- test commands and known baseline failures documented.

## Milestone 1 — Platform integration, replica and offline foundation

Status: `IN PROGRESS` — the persistent integration-ledger, encrypted offline-store, personal device-registration, device-security, encrypted draft/autosave, offline-command queue, automatic sync/status and day −1/emergency foundations are implemented in source. Authenticated offline batches can be accepted transactionally into the ERP ledger; see the linked Milestone 1 evidence documents in `README.md`. Production database deployment, PWA/workflow wiring, feature controls and the remaining platform deliverables are still pending.

### Deliverables

- sync inbox/outbox, unique event IDs and idempotent command service;
- deterministic mock ERP adapter;
- reconciliation and retry dashboard;
- device registration, MDM/device-binding hooks and remote session invalidation;
- encrypted IndexedDB/device store abstraction;
- continuous draft autosave;
- automatic sync, manual retry and freshness UI;
- day −1 blocking;
- centrally audited emergency mode;
- server-side feature flags by global/country/team/user;
- neutral lock-screen push notifications;
- repeatable mock seed blocked in production.

### Required tests

- duplicate event and duplicate command;
- same key/different payload rejection;
- dependency ordering;
- crash between local mutation and outbox write;
- retry after timeout with acknowledgement lost;
- permission revoked before offline replay;
- device/user mismatch and remote wipe/logout;
- encrypted-store migration and corrupt local record recovery;
- day −1 block and emergency-mode audit;
- production configuration rejects mock adapter/seed.

### Exit criteria

- zero silent command loss in fault-injection tests;
- deterministic replica rebuild from fixtures/events;
- flags block menu, page, API, bootstrap and background writes consistently.

## Milestone 2 — Customers, appointments and day execution

### Deliverables

- shared relation/contact/address replica and Contract compatibility;
- direct Representative customer edits and validation state;
- local VAT modulo-97 check and provider ports for VIES/Peppol;
- offline effective-scope customer index with appointment-gated detail;
- prospect creation and dependent first-sale promotion;
- today's own appointment creation and full allowed appointment commands;
- binding ERP sequence;
- next-workday preparation after per-country time parameter;
- prepared state, recommendations and notes;
- today's agenda;
- ERP-configured non-execution reasons;
- immutable visit report plus admin addendum;
- leads, follow-ups and references;
- mandatory day closure;
- scoped read-only Mijn Team;
- attachment staging by appointment/customer and ERP categories.

### Required tests

- Representative cannot access a customer without today's appointment except scoped search;
- creating today's appointment unlocks the correct dossier only;
- management sees scope but cannot mutate;
- direct URL/API and offline bootstrap enforce identical scope;
- next effective workday, holiday and per-country timezone;
- preparation hidden before configured time and visible at/after it;
- every appointment requires a final outcome;
- closed report immutable; addendum separate;
- offline edit wins documented ERP conflict and is re-published;
- VIES/Peppol unavailable versus authoritative correction;
- signed/closed snapshots unaffected by central customer correction;
- complete history pagination and offline availability.

### Exit criteria

- all approved roles pass scope matrix in all countries;
- full one-day offline scenario closes locally and later reconciles;
- existing Contract customer flows remain green.

## Milestone 3 — Commercial documents, signature and printing

### Deliverables

- server policy proposes Order, Order-Reeds-Geleverd or Factuur;
- configured override reason and mandatory explanation rules;
- official ERP article/price/VAT/unit replica and immutable line snapshots;
- reserved-number-block allocation and reconciliation;
- offline commercial document transaction;
- stock impact rules;
- customer-carrier selection for configured articles;
- customer signature on all document types;
- unsigned exception reasons in FieldForce Beheer;
- offline PDF/document rendering and hash;
- language selection and template-version snapshot;
- standard Android print/share;
- replaceable direct-printer adapter boundary;
- ERP send and customer-delivery status;
- link to existing Contract with validated context;
- product and Contract transactions remain separate.

### Required tests

- insufficient stock recommends Order;
- direct delivery types deduct once and Order never deducts Representative stock;
- override blocked without active reason;
- offline price snapshot survives later ERP price update;
- ERP customer block does not delete a valid offline sale;
- number range exhaustion, duplicate use, skipped/voided number and recovery;
- signature hash verification and immutable content;
- unsigned exception without reason rejected;
- language/template snapshot reproducible;
- print failure does not duplicate document;
- prospect customer command acknowledged before document command;
- Contract route rejects missing Contract permission or out-of-scope appointment.

### Exit criteria

- every test document reconciles to exactly one ERP document in the test adapter;
- document and associated inventory command are atomic/idempotent;
- signed document can be regenerated byte/content-equivalently where the renderer guarantees it.

## Milestone 4 — Shared Inventory

### Deliverables

- shared location and immutable movement primitives;
- central, transit, Representative/vehicle, customer-carrier and quarantine locations;
- Representative balances from acknowledged movements;
- ERP replenishments and in-transit state;
- partial actual receipt;
- mandatory Representative signature and photo;
- discrepancy and quarantine flow;
- consumables request to ERP with read-only later status;
- customer location/sublocation/carrier create/edit/archive;
- Beheer archive reasons;
- carrier stock, intended carrier on Order and confirmed delivery movement;
- optional carrier count with mandatory discrepancy reason;
- lot/expiry when ERP configured;
- centrally managed 180-day warning parameter.

### Explicit exclusions

- no Representative-to-Representative transfer;
- no customer return flow;
- no Representative personal-stock count or correction;
- no FieldForce consumables approval/edit/cancel after submission.

### Required tests

- partial, excess and damaged receipt;
- mandatory photo/signature;
- timeout/retry creates one receipt and one movement set;
- damaged quantity never becomes sellable;
- archived carrier preserves history and rejects new delivery;
- carrier-bound article requires carrier;
- Order intended carrier does not increase balance before ERP delivery;
- optional physical carrier count creates immutable correction;
- lot/expiry conditional on ERP article flag;
- exact 180-day threshold across leap year/timezones;
- no forbidden transfer/return/correction endpoints.

### Exit criteria

- movement reconciliation closes for every test scenario;
- no negative or duplicate Representative/customer balance without an explicit allowed correction source;
- Service can later reuse Inventory services without SalesDay dependencies.

## Milestone 5 — Cash and weekly access control

### Deliverables

- ERP payment-method replica;
- cash-only cash entries;
- ERP/backoffice deposit acknowledgement;
- first-effective-workday calculation using country calendar/timezone;
- exact-zero gate for agenda/preparation;
- blocked-mode navigation;
- automatic-only unblocking;
- sync/support access while blocked.

### Required tests

- cash versus non-cash document effects;
- Monday and non-Monday first workday;
- holiday, leave/planning and timezone edge cases;
- balance not exactly zero blocks all required modules;
- Contract and new sales blocked;
- confirmation unblocks automatically;
- no Admin/Super Admin manual bypass endpoint;
- sync remains available during block.

### Exit criteria

- no route/API leak of blocked operational functionality;
- ERP confirmation is the only normal unblock path.

## Milestone 6 — Operational KPI, Power BI link and production readiness

### Deliverables

- operational daily indicators from current replica;
- secure Power BI link;
- embedded Power BI kept out unless separately approved;
- monitoring, alerts, support runbook and reconciliation procedures;
- country/team/user pilot controls;
- all-country UAT fixtures and scripts;
- performance and offline storage sizing with full scoped history;
- backup/restore and device-loss exercises;
- real ERP end-to-end adapter acceptance;
- final migration rehearsal and production cutover/rollback runbook.

### Exit criteria

- every country UAT group signs off;
- no open P0/P1 data-loss, scope, idempotency, financial or stock defect;
- real ERP round trips are proven for every command/event type;
- emergency mode and rollback are rehearsed;
- production contains no mock business data.

## 9. Validation matrix

Every source milestone runs proportionate existing checks plus its own tests.

Mandatory final gate:

- TypeScript typecheck;
- lint with zero new warnings;
- production Next build, with known Windows Prisma lock reported separately if encountered;
- module/menu/role-permission/data-access tests;
- SalesDay role and scope matrix;
- API auth, IDOR and direct-route tests;
- Contract calculation/import/document regressions;
- offline fault-injection and replay suite;
- document number and signature suite;
- Inventory concurrency/reconciliation suite;
- cash access-control suite;
- NL/FR/DE translation parity;
- tablet/PWA accessibility and Android device acceptance;
- real ERP test-tenant end-to-end suite;
- migration status and forward-compatible migration rehearsal.

No check may depend on undisclosed pre-existing manual fixture data or an interactive login unless the test explicitly provisions and cleans its own fixture/session.

## 10. Acceptance scenarios per country

At minimum each Representative/Verkoopleider/backoffice/Admin country group executes:

1. online bootstrap and full offline dataset;
2. next-workday preparation becoming visible at configured time;
3. today's agenda and binding sequence;
4. own same-day appointment with offline customer search;
5. prospect then first sale/customer creation;
6. direct customer update and later official billing normalisation;
7. complete and non-complete appointment plus day closure;
8. visit report, lead, follow-up and reference;
9. Order, Order-Reeds-Geleverd and Factuur;
10. document override with reason;
11. signature and unsigned exception;
12. offline print, later ERP delivery acknowledgement;
13. partial/damaged replenishment with photo/signature;
14. carrier delivery, expiry warning and optional count correction;
15. consumables request;
16. cash zero gate on first effective workday;
17. day −1 sync block;
18. centrally activated ERP emergency mode;
19. manager read-only scope and attempted forbidden mutation;
20. device lock/resume, autosaved draft and MDM remote invalidation.

## 11. Rollback and recovery

### 11.1 Feature rollback

- disable country/team/user activation or global kill switch;
- stop accepting new SalesDay commands;
- keep pending commands and evidence intact;
- continue safe acknowledgement/reconciliation where required to avoid stranded business transactions;
- never delete pending sales, numbers, signatures, stock or cash records during rollback.

### 11.2 Adapter rollback

- disable writes independently from reads/events;
- quarantine malformed events without dropping them;
- resume from durable cursors after correction;
- reconcile command IDs and ERP acknowledgements before re-enable.

### 11.3 Schema rollback

Use expand/backfill/switch/contract migrations.

Do not drop old Contract customer/article fields in the same release that introduces shared relations/articles. A rollback leaves new tables/columns intact but unused until reconciliation; no destructive emergency down migration.

### 11.4 Device recovery

- MDM remote lock/wipe;
- revoke device registration and offline key;
- re-bootstrap a replacement device from server replica/ERP;
- never reuse unacknowledged command identity on another device without controlled recovery.

## 12. Open blockers before production

- Real BC/NAV transport, contracts, credentials and event delivery.
- VIES/Peppol integration ownership and credentials.
- ERP reserved-number-block mechanism.
- ERP support for every command and conflict-priority rule.
- ERP document generation/delivery acknowledgement contract.
- Final Android device and printer procurement; direct printing is not a release blocker because standard Android printing is accepted.
- Legal/Finance/DPO retention periods.
- Production MDM policy and remote-wipe exercise.
- Power BI secure link details; embedding remains later and non-blocking.

## 13. Definition of done

SalesDay is production-ready only when:

1. all mandatory decisions in `DECISIONS.md` are implemented without an undocumented exception;
2. every protected query/action is server-scoped;
3. the complete first-release scope works online and for one full offline workday;
4. day −1 sync blocks the next day unless audited emergency mode applies;
5. every command is idempotent, durable, observable and reconciled;
6. ERP is proven as the final effective source without FieldForce command loss;
7. customer, appointment, document, stock and cash conflicts follow the approved policies;
8. Contract uses the shared relation/article direction without regression or duplicate calculator;
9. all countries and NL/FR/DE pass acceptance;
10. personal Android devices pass PWA, encryption, lock, MDM and offline storage tests;
11. no mock business data or mock adapter can activate in production;
12. documentation, TODO/history and operational runbooks reflect the released behaviour;
13. rollback/emergency/recovery are rehearsed, not merely documented.
