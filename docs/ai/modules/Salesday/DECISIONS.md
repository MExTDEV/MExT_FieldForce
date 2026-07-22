# SalesDay Decisions

## Purpose and authority

This document records the SalesDay business decisions approved on 16 July 2026.

It is the owning source for SalesDay behaviour. The integration audit provides evidence and recommendations; where an older audit recommendation conflicts with this document, this document wins.

Do not invent missing ERP behaviour. Open technical dependencies are listed at the end.

---

# 1. System ownership and synchronisation

## 1.1 ERP as final business source

Business Central/NAV is the current final system of record for effective sales data. Odoo will take this role later.

FieldForce is the:

- data-entry interface;
- offline working environment;
- presentation layer;
- permission and scope enforcement layer;
- reliable command and synchronisation layer.

After ERP acknowledgement, the ERP version is the effective business record.

## 1.2 FieldForce replica

FieldForce may keep a server-side and encrypted device replica for:

- offline use;
- fast screens;
- effective-scope filtering;
- synchronisation and retry;
- operational daily indicators;
- audit and reconciliation.

Every replicated object records at least the ERP identity, ERP/source version, last source update, last successful sync and local sync status.

Mock data is never an operational fallback.

## 1.3 Immediate bidirectional sync

ERP changes must be pushed to FieldForce as immediately as the real ERP interface permits. Poll-only daily refresh is not acceptable.

The target integration combines:

- immediate event/push delivery;
- idempotent command submission from FieldForce;
- periodic reconciliation to detect missed events;
- visible freshness and sync status.

## 1.4 Conflict ownership

An explicit FieldForce change made by a Representative takes precedence when the same customer or appointment was changed in the ERP while the Representative was offline.

FieldForce never silently discards or rewrites the user's command. The ERP must acknowledge the resulting version and publish it back to FieldForce.

Pending changes remain stored until explicit ERP acknowledgement. Repeated failures escalate but never silently delete the command.

## 1.5 Unknown ERP interface

The current BC/NAV API, middleware or transport is not yet known.

Implementation starts with provider-neutral ports and a deterministic mock adapter. Production activation is prohibited until the real adapter, credentials, event delivery, idempotency and reconciliation have passed end-to-end acceptance.

---

# 2. Central customer and prospect data

## 2.1 One shared relation

SalesDay and Contract use the same central customer/prospect, contact and address records.

Do not create independent `SalesDayCustomer` and `ContractCustomer` business truths. The local Contract customer structure must be migrated or linked to a shared relation model through a forward-compatible path.

## 2.2 ERP ownership and FieldForce edits

The ERP stores and distributes the effective customer record.

A Representative who is physically with the customer may directly edit customer master data in FieldForce, including official data. No backoffice approval is required. The FieldForce command has priority and is sent to the ERP immediately or queued offline.

Every change records actor, device, appointment, old value, proposed value, validation result, timestamps and ERP acknowledgement.

## 2.3 Billing validation

For VAT numbers:

- local format and modulo-97 validation provide an immediate first check;
- a locally valid value may be saved while offline;
- VIES and Peppol are authoritative for billing identity and invoicing data;
- official data returned by those services updates the central customer billing data.

External validation unavailability does not block completing a sales or Contract workflow.

## 2.4 Existing documents after correction

- A signed document is immutable and keeps the customer/billing snapshot used at signing time.
- A not-yet-signed Contract concept is not automatically regenerated after later billing correction; the application may show a warning.
- New documents use the corrected central customer data.

## 2.5 Prospect lifecycle

When customer search has no result, a Representative may create a prospect, including offline.

The prospect automatically becomes a customer when the first Order, Order-Reeds-Geleverd or Factuur is created. The synchronisation dependency is customer creation first, commercial document second.

## 2.6 Customer visibility

A Representative normally sees full customer data only when the customer has an appointment in today's agenda.

When adding an own appointment for today, the Representative may search across all customers in the effective customer/team scope. Search works offline. The encrypted device dataset may contain broader scoped data, but the UI and APIs enforce appointment-gated full-detail visibility.

---

# 3. Appointments, preparation and day closure

## 3.1 Appointment source and write capability

The ERP/contact centre is the source for planned appointments and their order.

FieldForce supports the complete appointment capabilities represented by SalesApp:

- create an own appointment for today;
- edit an allowed appointment for today;
- duplicate only where the resulting appointment is also for today;
- cancel or mark today's appointment moved according to ERP-supported reason commands;
- execute;
- register a definitive outcome.

Future appointments remain the responsibility of the contact centre. A Representative may create an own appointment only for today. Marking an appointment moved does not create a future appointment or a FieldForce contact-centre task.

## 3.2 Binding route order

The appointment order supplied by the contact centre/ERP is binding. The Representative cannot reorder the day.

SalesDay does not optimise routes. It presents the supplied sequence and opens device navigation.

## 3.3 Preparation window

Mijn voorbereiding shows the appointments of the next effective workday.

It becomes visible from a per-country Beheer parameter. The default is `16:30` in the country's local timezone.

The Representative marks each preparation explicitly as prepared. This records actor and timestamp but does not block opening the later agenda.

Preparation notes are visible to:

- the Representative;
- management roles within their effective read-only scope.

## 3.4 Today's agenda

Mijn agenda shows only today's appointments and their customer data.

Every contact-centre appointment must receive a definitive outcome. The Representative either performs it or records that it was not performed.

## 3.5 Non-execution reasons

Non-execution reasons and their active/country configuration come from the ERP and are cached offline.

When “moved” is selected, FieldForce records the reason and any required explanation. It does not create a future appointment or contact-centre task.

## 3.6 Mandatory day closure

The day cannot be closed until every appointment is:

- completed;
- not completed with an ERP reason and required explanation; or
- marked moved according to the same reason process.

After the appointment day, the Representative cannot edit the appointment. An unresolved appointment becomes a management exception.

Local day closure is allowed while commands are pending, but the UI must state prominently that ERP synchronisation is still required.

## 3.7 Visit reports

Visit reports are visible in FieldForce only to:

- the originating Representative;
- management within the effective read-only scope.

They are also sent to the ERP, where separate ERP rights apply. ERP visibility must not broaden FieldForce access.

After day closure, the original report is immutable. A separately authorised administrator may add an audited correction addendum without changing the original.

## 3.8 Leads, follow-up and references

- Leads originate in FieldForce and are sent to the ERP. The ERP owns later lead statuses.
- Follow-up actions originate in FieldForce; ERP/contact centre owns their planning and later status.
- A reference is a potential customer supplied by the visited customer.
- A reference does not automatically become a FieldForce prospect.
- It is sent as a separate reference to ERP/contact centre, which decides whether to convert it.

---

# 4. Rights and scope

## 4.1 Role naming

`Sales Leader` and `Verkoopleider` are the same business role and reuse the Coaching team relation.

## 4.2 Scope

- Representative: own SalesDay data and appointment-gated customer details.
- Verkoopleider/Sales Leader: read-only data for effective team(s).
- Sales Manager and Country Manager: read-only data for teams in assigned countries.
- Group Manager: read-only data within assigned group/countries.
- Admin: read-only operational data according to effective country/team scope; separate permissions for administration.
- Super Admin: read-only operational access to all scoped data plus separately granted administration.

Management roles cannot act operationally on behalf of a Representative. They cannot create or edit the Representative's appointments, customers, sales, cash or stock.

Warehouse, integration and Beheer actions use separate explicit permissions.

## 4.3 Enforcement

Menu, page, API, offline dataset and file download enforce the same effective scope server-side.

Query parameters may narrow scope but never broaden it.

---

# 5. Sales history and operational reporting

## 5.1 Full history

A Representative with current appointment access to a customer may see the complete ERP sales history for that customer, across all Representatives and channels and for the full period available in the ERP.

This includes:

- quotes;
- orders;
- deliveries;
- invoices;
- credit notes;
- payment status and open balance.

The history is paginated for UI performance. The offline replica may be synchronised incrementally but must support the approved full history requirement.

## 5.2 Reporting ownership

SalesDay shows only operational daily indicators such as today's appointments, sales, preparation, stock warnings, cash and sync state.

Power BI is the single source of truth for official reporting, historical KPI and management analysis.

The first release may provide a secure Power BI link. Embedded Power BI is a later option after licensing, SSO and row-level-security analysis. Reporting is not a top first-release priority.

---

# 6. Articles and preparation recommendations

## 6.1 Article and price master

BC/NAV, later Odoo, owns:

- article identity and number;
- multilingual descriptions;
- units;
- VAT configuration;
- official prices;
- article stock/lot/expiry configuration.

FieldForce stores a replica and keeps article, unit, VAT and price snapshots on sales documents.

## 6.2 Recommendations

FieldForce calculates preparation recommendations from the complete ERP sales history.

The algorithm is deterministic and explainable. It may use last purchase, average frequency, season, quantity and expected reorder/expiry timing. Each recommendation shows why it exists.

Parameters are managed per country where documented. No opaque AI model is used for the initial implementation.

Representatives may mark recommendations relevant/not relevant and add an extra existing ERP article. Feedback never changes the ERP article master automatically.

Only Admin/Super Admin with a specific SalesDay Beheer permission may configure extra preparation articles by country, team or Representative.

## 6.3 Expiry warning

Articles configured by the ERP for lot/expiry tracking include lot and expiry in the relevant customer inventory.

FieldForce uses one central Beheer parameter for the warning window. Default: `180` days before expiry.

---

# 7. Commercial documents

## 7.1 Supported document types

FieldForce creates:

- **Order** when the Representative has insufficient or no stock;
- **Order-Reeds-Geleverd** when goods were delivered but an on-site invoice cannot or may not be created;
- **Factuur** for direct on-site sale and invoicing.

FieldForce proposes the valid type from stock and customer configuration.

The Representative may override the proposal. An override requires a reason. Reasons are maintained in FieldForce Beheer per country, including “Andere” with mandatory text.

## 7.2 Stock effect

- Order: no Representative-stock deduction.
- Order-Reeds-Geleverd: immediate Representative-stock deduction.
- Factuur: immediate Representative-stock deduction.

Document creation and the corresponding local inventory command are one atomic local business operation and one idempotent synchronisation chain.

## 7.3 Offline price

The official price snapshot available at the moment of offline sale remains valid. A later ERP price change does not silently reprice the document.

If the customer becomes blocked in the ERP while the Representative is offline, the valid FieldForce sale remains valid and must be sent. The block is logged and shown but does not undo the sale.

## 7.4 Number ranges

The ERP pre-reserves official number ranges for offline FieldForce use.

Every reservation, allocation, skipped number, cancellation, submission and ERP acknowledgement is reconciled and audited.

## 7.5 Signature

Order, Order-Reeds-Geleverd and Factuur all require a customer signature.

An exception is allowed when the customer cannot or will not sign. A FieldForce Beheer reason and mandatory explanation are required. A Representative may never sign on behalf of the customer.

The immutable evidence includes document hash, content/version, customer-signature data, signer context, Representative, timestamp, device and exception where applicable.

## 7.6 Language and delivery

The default document language is the ERP customer language. Before signing, the Representative may choose another language supported for that country. The chosen language and template/translation version are stored in the document snapshot.

FieldForce creates an offline document copy that can be shown or printed. After sync, the ERP sends the official document to the customer and returns delivery status.

Android printing supports:

- the standard Android print/share service in the first release;
- a replaceable direct-printer adapter after final hardware selection.

The current reference printer is Epson WF-110 but must not be hardcoded.

## 7.7 Contract boundary

SalesDay may open the existing FieldForce Contract module from an appointment with server-validated customer and appointment context.

Product sale and Contract remain separate transactions and document flows linked to the same appointment. SalesDay does not implement another Contract calculator.

---

# 8. Shared Inventory

## 8.1 Domain ownership

Inventory is a shared FieldForce domain used by SalesDay and later Service.

The first SalesDay production release includes the Inventory foundation required for sales:

- Representative/vehicle stock;
- transit stock;
- replenishment receipt;
- consumables requests;
- immutable movement history;
- customer location/carrier stock.

## 8.2 Split system ownership

- Central warehouse stock is ERP-owned.
- Representative/vehicle stock and offline operational movements are managed by FieldForce until synchronised.
- The ERP is the final effective source after acknowledgement.

There are no direct Representative-to-Representative transfers.

A Representative cannot count or correct personal/vehicle stock in FieldForce. Corrections come from ERP/backoffice.

Customer returns are outside SalesDay.

## 8.3 Replenishment and receipt

Stock becomes Representative stock only after the Representative confirms receipt. Until then it is in transit.

Partial receipt is supported per line.

Every receipt requires:

- digital confirmation;
- Representative signature;
- at least one photo.

FieldForce books the actual received quantity. Shortage, excess or damage becomes a separate discrepancy sent to ERP/backoffice.

Damaged goods go to non-sellable quarantine stock.

## 8.4 Consumables

FieldForce submits a consumables order request to the ERP.

ERP warehouse/backoffice owns approval, picking and later status. The request cannot be edited or cancelled in FieldForce after submission.

## 8.5 Customer locations and carriers

A carrier is the physical place/object at the customer where material is held, for example a cabinet, rack or first-aid kit. A carrier may itself reference an ERP article.

Representatives may create, edit and archive customer locations, sublocations and carriers. FieldForce changes take precedence and sync to the ERP.

Locations and carriers are never physically deleted when history exists. Archiving requires a FieldForce Beheer reason and keeps all history.

## 8.6 Carrier inventory

FieldForce maintains current article balances per carrier.

- Direct delivered lines move stock to the chosen carrier when the ERP article is carrier-bound.
- An ordinary Order may record an intended carrier, but carrier stock changes only after ERP delivery confirmation.
- Other articles may be delivered directly to the customer without carrier.
- The theoretical balance uses deliveries and external registered consumption.
- A Representative may optionally perform a physical count.
- A physical difference creates an immediate, immutable correction with mandatory reason and sync to ERP.
- Lot and expiry are tracked only where the ERP article requires them.

---

# 9. Cash sheet and weekly blocking

## 9.1 Payment methods

Payment methods come from the ERP and may vary by country/customer.

Only cash payments increase the FieldForce cash balance. Card, bank and other payment methods stay linked to the document but do not affect cash.

## 9.2 Weekly zero rule

On the first effective workday of each week, the confirmed cash balance must be exactly zero before Mijn agenda or Mijn voorbereiding can open.

The workday calculation respects country timezone, holidays and the Representative's planning. The normal case is Monday.

During a cash block, only these remain accessible:

- block reason/dashboard;
- cash sheet and deposit process;
- synchronisation;
- help/support.

Agenda, preparation, Contract and new sales remain blocked.

## 9.3 Unblocking

Cash unblocking happens only automatically after the ERP or backoffice confirms the required deposit.

There is no manual FieldForce cash override.

---

# 10. Offline, devices and application form

## 10.1 First production scope

The first production release includes full offline mutations for customers, appointments, sales, Inventory and day closure.

It is not an online-only or read-only release.

## 10.2 PWA and future Android app

The first release is an installable PWA for Android.

Backend contracts, device services, sync and business rules must remain reusable by a later native Android app. Creating the native app is a later supported project, not a first-release blocker.

## 10.3 Device ownership and MDM

Each Representative has a personal device. Current devices are Windows tablets; target devices are Android tablets managed centrally through MDM.

Production requires device binding, encryption, supported OS policy, remote lock/logout and remote wipe.

## 10.4 Offline dataset

All SalesDay data allowed by effective scope must be available offline, including full history.

The device can hold the encrypted data required for this, while the UI still enforces appointment-gated customer visibility.

Offline customer search covers the effective customer/team scope. Selecting a customer and creating today's appointment unlocks the full dossier according to the normal rules.

## 10.5 Authentication and local lock

Normal offline work is limited to one workday. The next workday requires successful sync and online session renewal because the next agenda must come from the ERP.

The app unlocks through device biometrics/PIN whenever the tablet/app resumes after device sleep or lock. There is no separate short inactivity timeout that interrupts an active customer conversation.

Forms autosave continuously as encrypted local drafts.

## 10.6 Synchronisation UX

Sync is automatic when connectivity is available. The UI shows:

- last successful sync;
- pending commands;
- failures/conflicts;
- a “Nu synchroniseren” retry.

The user never chooses technical records to sync.

The next workday cannot start while day −1 commands remain unacknowledged.

## 10.7 ERP outage emergency mode

A Super Admin may centrally activate emergency mode for a prolonged ERP outage. Activation requires incident reason, start/end, actor and audit.

Emergency mode allows Representatives to:

- execute the last synchronised agenda;
- add own appointments for today;
- record customer, sales and inventory changes offline;
- queue everything for ordered sync after recovery.

No new contact-centre appointments can arrive while the ERP is unavailable.

Technical/backoffice recipients and Super Admin receive sync incident notifications. Verkoopleiders see operational impact on their teams without technical details.

## 10.8 Push notifications

In-app and Android push notifications cover appointment changes, preparation availability, sync failures, cash block and ERP document acknowledgement/failure.

Notification types are configurable. Lock-screen notifications contain no customer names, amounts or sensitive commercial details.

---

# 11. Files and document categories

Representatives may add photos/documents and choose whether they belong to the appointment or central customer record.

Document and photo categories come from the ERP and are cached per country for offline use.

The ERP is the final file source. FieldForce uses private encrypted upload staging and an authorised cache. After successful upload, the ERP identity and acknowledgement are stored. Device/server caches follow scope, retention and remote-wipe policy.

---

# 12. UI, modules and reuse

## 12.1 Native FieldForce UI

The SalesApp functional flow is retained, but screens are rebuilt with FieldForce shell, components, permissions, translations and tablet patterns.

Do not copy the SalesApp monolith, client login, role switching, mock state, user management or duplicate i18n/runtime.

## 12.2 Module allocation

- SalesDay: daily sales work.
- Shared Inventory: stock/replenishment/consumables used through SalesDay.
- Contract: existing FieldForce module, only linked from SalesDay.
- PST: later PST module.
- Service: later Service module.
- Beheer: existing users, roles, countries, permissions and shared technical tables.

## 12.3 Profile

SalesDay shows a compact “Mijn info” summary and links to the existing FieldForce profile/user process. It does not create another profile implementation.

---

# 13. Rollout, mock data and acceptance

## 13.1 One complete first production release

The first production activation contains the complete approved operational SalesDay and Inventory scope, including offline writes.

Implementation proceeds through independently tested internal milestones behind server-side flags. Partial milestones are not exposed as the production SalesDay promise.

## 13.2 All-country pilot

The pilot covers all configured countries. Activation remains controllable per country, team and user.

Dutch, French and German are mandatory where applicable.

## 13.3 Acceptance group

Each country provides at least:

- one Representative;
- one Verkoopleider;
- one backoffice/warehouse user;
- one Admin/Super Admin.

The same agreed scenarios are executed in all supported languages.

## 13.4 Mock data

SalesApp contains only mock/test data and no operational data to migrate.

FieldForce provides repeatable seeds with clearly marked fictitious records. Normal production must reject the mock provider and mock seed and must never fall back to them during an ERP outage. A live environment that is intentionally used as a controlled system-test environment may enable the mock provider only through the server-side `SALESDAY_PRODUCTION_MOCK_MODE=true` switch and the separate explicit live-system-mock command. The switch is never inferred from database content and must be disabled before real ERP acceptance.

The live system seed preserves all real users, enables SalesDay/Inventory feature flags explicitly for every active user, gives every active Representative a separate rolling daily SalesDay fixture, and creates Contract and personal Inventory fixtures for every active user. The default SalesDay appointment window is 30 calendar days from the resolved business date and can be bounded with `--days=1..90`. Management roles continue to use their documented read-only team/country scope; the seed does not let them act as a Representative.

PST and Service currently have placeholder navigation only and no owned persistent domain model. Their behaviour may not be invented by the system seed; they require separate approved module definitions before meaningful mock records can exist.

Real FieldForce users must be preserved.

---

# 14. Confirmed implementation order

1. Provider-neutral integration, replica, offline, audit, permissions and feature flags.
2. Customers, appointments, agenda, preparation and day closure.
3. Commercial documents, signatures, reserved numbers and printing.
4. Shared Inventory and replenishment receipt.
5. Cash sheet and weekly blocking.
6. Reporting/Power BI last.

Production activation occurs only after the complete mandatory scope passes its gates.

---

# 15. Open external decisions

These are not permission to invent behaviour:

1. Exact BC/NAV API, event, middleware, authentication and reconciliation mechanism.
2. Odoo adapter timing and target interface.
3. Final Android printer hardware and direct-driver SDK; Epson WF-110 is only the current reference.
4. Exact legal/Finance/DPO retention periods; ERP/legal policy remains authoritative.
5. Power BI embedding, licensing, SSO and row-level security; a secure link is sufficient initially.
6. Operational owners and credentials for VIES/Peppol access.
