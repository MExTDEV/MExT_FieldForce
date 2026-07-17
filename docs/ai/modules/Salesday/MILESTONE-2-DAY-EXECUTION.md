# SalesDay Milestone 2 — Agenda en daguitvoering

## Status

Implemented in source; migration `0050_salesday_day_execution` is additive and remains deployment-pending.

## Scope

- `Mijn agenda` returns only the representative's current local business date and preserves ERP/contact-centre sequence.
- A representative may write only their own current-day appointment while the day is open and the active-device/day-minus-one gates pass.
- Every appointment needs a definitive outcome. Completed appointments require one immutable visit report; non-completed or moved appointments require an active ERP reason and any configured explanation.
- Day close is an idempotent local transaction. It is allowed with pending ERP commands but exposes `synchronizationRequired` and submits a dependent `day-close.submit` command.
- The original visit report cannot be replaced. A scoped management user may add an audited addendum only after day close.
- Leads, follow-ups and customer-provided references are separate ERP commands. A reference never auto-creates a prospect.
- `Mijn Team` is a read-only operational projection scoped to team/country permissions; it contains counts and sequence/status only, not customer dossiers or mutation endpoints.

All writes persist the local record, audit evidence and ERP outbox command in one serializable transaction. Commands use stable business keys and explicit dependencies so offline replay remains ordered and idempotent.

## Validation

Run `npm run test:salesday-day-execution` for the route/service/schema invariants, then `npm run typecheck` and the existing SalesDay relation/customer/appointment/preparation tests. No production migration or ERP adapter write is performed by these checks.
