# Milestone 2 Appointment Operations

## Status

Implemented in source on 17 July 2026. Migration `0048_salesday_appointment_operations` is additive and has not been applied to production.

## ERP replica

ERP/contact-centre appointments are normalised into `SalesAppointment` with their business date, UTC timestamps, IANA timezone, canonical/native status, customer, Representative/team scope and binding sequence. Appointment and outcome-reason events use the same transactional inbox dispatcher as customer events.

An ERP event does not overwrite an appointment while `pendingFieldForceEdit` is true. A later acknowledgement/reconciliation flow must clear that state before the next ERP version becomes authoritative.

## Representative commands

Only a Representative can mutate the Representative's own `PLANNED` appointment on the current local business date. The check is repeated inside the serializable transaction.

Supported commands are:

- create an own appointment for today;
- edit customer/time fields without exposing sequence mutation;
- duplicate an appointment into another own appointment for today;
- record `COMPLETED`, `NOT_COMPLETED`, `MOVED` or `CANCELLED`;
- validate an active ERP reason and any required comment for non-completed outcomes.

The ERP sequence cannot be reordered. A new or duplicated own appointment receives `max(sequence) + 1` and therefore follows the supplied route.

## Offline ordering and evidence

Every mutation atomically writes the appointment, `SalesAppointmentChange`, `AuditLog` and ordered ERP outbox command. An edit or outcome for an own appointment that has not yet received an ERP ID depends on its create command and uses the stable local appointment ID. This preserves full-day offline execution without inventing an external identity.

Own appointment creation currently requires an ERP-confirmed customer external ID. Future appointments remain owned by the contact centre.

## Persistence

Migration `0048` adds local revision/write-priority fields to `SalesAppointment`, plus:

- `SalesAppointmentChange` for old/proposed values, validation evidence, actor/device and ERP command correlation;
- `SalesAppointmentOutcomeReason` for provider-owned multilingual, country-scoped reason configuration.

The migration contains no destructive statement and was not applied to any database during implementation.

## Validation

Run `npm run test:salesday-appointment-operations`. It validates ERP normalisation, immutable sequence input, local-day locks, outbox dependencies, event ownership, additive schema and API device enforcement.
