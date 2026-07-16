# Milestone 1 — Day −1 gate and audited emergency mode

Status: `POLICY AND PERSISTENCE COMPLETE IN SOURCE — OPERATIONAL ROUTE WIRING PENDING`

This slice implements the approved rule that a Representative cannot begin the next workday while commands from an earlier business date remain unacknowledged. Synchronisation and support remain accessible.

## Day −1 evidence

The effective gate combines:

- server-side ERP-ledger commands for the authenticated Representative whose `businessDate` is earlier than the requested workday and whose status is not `ACCEPTED`;
- encrypted local queue entries whose business date is earlier than the requested workday.

Provider selection cannot bypass the server check because it covers all providers for the actor. The device check still requires the active, key-provisioned personal device and bound login session.

The result is `NORMAL`, `BLOCKED` or `EMERGENCY`. A blocked shell permits only:

- the SalesDay block dashboard;
- synchronisation;
- support.

Agenda and preparation are explicitly denied by the shared route policy. Every later operational SalesDay API must also call `assertSalesDayServerDayAccess`; navigation visibility alone is not security.

## Emergency mode

Migration `0044_salesday_day_gate_emergency` adds `SalesDayEmergencyMode` and the separate permission `salesday.emergencyMode.manage`, enabled by default only for `SUPER_ADMIN`.

An emergency window requires:

- a non-empty incident reason;
- an explicit start and end with end after start;
- the activating actor;
- an atomic audit entry.

Only one open global window can exist through nullable unique `activeKey`. Expired windows release that key when a later activation is requested. A scheduled future window is visible but bypasses the gate only after its start time. Early deactivation requires a reason and actor and is audited in the same serializable transaction. Repeating a deactivation is idempotent and does not duplicate the audit.

The emergency mode does not fabricate new ERP appointments. It permits work from the last synchronised agenda and keeps new commands ordered in the existing encrypted queue and ERP ledger.

## API and UI contract

- `GET /api/salesday/sync/day-gate` returns the own server evidence and active emergency window;
- `GET /api/salesday/sync/emergency` returns the current or scheduled open window to authenticated users;
- `POST /api/salesday/sync/emergency` activates or deactivates through the separate permission;
- `SalesDayDayGateNotice` provides translated blocked and emergency states with touch-friendly links to sync and support.

## Source

- `lib/salesday/day-access.ts`
- `lib/server/salesday-day-access.ts`
- `lib/server/salesday-emergency-mode.ts`
- `lib/device/sync-queue.ts`
- `app/api/salesday/sync/day-gate/route.ts`
- `app/api/salesday/sync/emergency/route.ts`
- `components/salesday/day-gate-notice.tsx`
- `prisma/migrations/0044_salesday_day_gate_emergency/migration.sql`
- `scripts/test-salesday-day-gate.ts`

## Validation

`npm run test:salesday-day-gate` covers permission denial, activation, duplicate-open rejection, active status, idempotent audited deactivation, local and server previous-day evidence, emergency bypass, blocked-route allowlisting, role defaults, migration structure, authenticated route wiring, accessible UI and Dutch/French/German key parity.

Prisma validation, TypeScript, queue/runtime regression tests and targeted ESLint are also required for this slice.

## Remaining integration

- derive the displayed/current business date from the server-side per-country timezone configuration rather than trusting a browser date;
- mount the gate ahead of every SalesDay page and direct API;
- make the eventual day-close command depend on all commands for that business day;
- prove reload/offline/next-day behaviour in the installed Android PWA;
- deploy migration `0044` only through the approved non-production-to-production migration process; this source task does not deploy it.
