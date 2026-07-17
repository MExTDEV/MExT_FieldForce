# Milestone 2 Customer Operations

## Status

Implemented in source on 17 July 2026. Migration `0047_salesday_customer_operations` is additive and has not been applied to production.

## Scope and access

- `BusinessRelation` remains the single customer/prospect root shared with Contract.
- Representatives receive a limited search index inside effective owner, representative and team scope.
- Full customer detail and every customer mutation require the Representative's own non-cancelled appointment for the current local business date.
- The appointment authorization is checked once before validation and again inside the serializable mutation transaction.
- Sales Leaders are limited to their team. Sales Managers and Admins use country scope. Management customer access is read-only.
- Prospect creation is limited to a Representative in the Representative's own country.

## Customer edits and prospects

Customer edits replace the normalized active contact/address projection, update billing-validation state, increment `localRevision` and mark `pendingFieldForceEdit`. The same serializable transaction writes:

- the customer or prospect record;
- an ordered `customer.upsert` ERP outbox command;
- a `BusinessRelationChange` before/proposed-value record;
- an `AuditLog` entry;
- the existing Contract compatibility projection when linked.

An unsynchronised prospect update depends on the prospect's preceding create command. This prevents a first edit from overtaking ERP identity creation.

## Billing validation

Local validation normalises VAT numbers, checks Belgian modulo-97 and validates Dutch and German formats. VIES and Peppol are provider ports: no external endpoint or credentials are invented here.

- matching authoritative responses correct the legal billing identity before it is stored;
- a valid/invalid disagreement or conflicting official identities produces `CONFLICT` and is not silently resolved;
- provider unavailability produces `UNAVAILABLE`; the locally valid edit can still be stored and is marked pending for later verification;
- signed documents and closed snapshots are never rewritten by a central customer correction.

## Persistence

Migration `0047` adds:

- `SalesAppointment`, as the appointment-gated access foundation for later appointment command work;
- `BusinessRelationChange`, for customer mutation evidence and ERP command correlation;
- the corresponding user, team and relation foreign keys and indexes.

The migration contains no destructive statements and no production data was changed while implementing this slice.

## Validation

Run `npm run test:salesday-customer-operations`. The test covers VAT rules, VIES/Peppol outcomes, role scope, country-local business date, additive schema guarantees and static security/audit/outbox integration assertions.

Appointment ingestion and commands, preparation, agenda and day execution remain subsequent Milestone 2 slices.
