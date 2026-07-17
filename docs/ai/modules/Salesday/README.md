# SalesDay Domain

## Status

- Business behaviour: `DEFINED`
- External ERP transport: `PARTIALLY_DEFINED`
- Production readiness: `NOT_IMPLEMENTED`

The business decisions were confirmed on 16 July 2026.

The concrete Business Central/NAV interface is not yet known. Do not invent ERP endpoints, payloads, authentication or delivery guarantees. Build only against the provider-neutral contracts documented for this module until the real interface is supplied and validated.

## Purpose

SalesDay supports the complete working day of a field sales Representative:

- offline preparation;
- daily agenda and customer context;
- customer maintenance;
- appointment execution and day closure;
- product sales and customer signatures;
- personal/vehicle inventory and replenishment receipt;
- consumables requests;
- cash-sheet enforcement;
- reliable synchronisation with the ERP.

FieldForce is the entry, offline and presentation layer for sales operations. Business Central/NAV, and later Odoo, is the final system of record after successful synchronisation.

## Core boundaries

- SalesDay owns the Representative sales-day experience.
- Shared Inventory owns stock, replenishments and consumables primitives.
- Contract remains owned by the existing FieldForce Contract module.
- PST is implemented in the PST module.
- Service is implemented in the Service module.
- User, role, team, country, permission and technical-reference management reuse existing FieldForce platform functionality.
- Power BI remains the reporting source of truth. SalesDay owns only operational daily indicators.

## Documentation map

- Stable approved behaviour: `DECISIONS.md`
- Implementation order and acceptance gates: `IMPLEMENTATION-PLAN.md`
- Provider-neutral ERP resources, commands and delivery rules: `ERP-CONTRACT.md`
- Shared relation/article and integration-ledger migration design: `SCHEMA-DESIGN.md`
- Milestone 0 validation and isolated baseline failures: `MILESTONE-0-BASELINE.md`
- Milestone 1 persistent integration-ledger slice: `MILESTONE-1-INTEGRATION-LEDGER.md`
- Milestone 1 encrypted offline-store foundation: `MILESTONE-1-OFFLINE-STORE.md`
- Milestone 1 personal device registration: `MILESTONE-1-DEVICE-REGISTRATION.md`
- Milestone 1 key provisioning and remote control: `MILESTONE-1-DEVICE-SECURITY.md`
- Milestone 1 encrypted drafts and autosave: `MILESTONE-1-DRAFT-AUTOSAVE.md`
- Milestone 1 encrypted offline command queue: `MILESTONE-1-SYNC-QUEUE.md`
- Milestone 1 automatic sync runtime and freshness status: `MILESTONE-1-SYNC-RUNTIME.md`
- Milestone 1 day −1 gate and audited emergency mode: `MILESTONE-1-DAY-GATE.md`
- Milestone 1 server feature controls, production guard and notification privacy: `MILESTONE-1-FEATURE-CONTROLS.md`
- Milestone 1 closing validation: `MILESTONE-1-VALIDATION-2026-07-16.md`
- Milestone 2 shared business relations and Contract bridge: `MILESTONE-2-BUSINESS-RELATIONS.md`
- Milestone 2 scoped customer operations, VAT validation and prospects: `MILESTONE-2-CUSTOMERS.md`
- Milestone 2 appointment replica, order and commands: `MILESTONE-2-APPOINTMENTS.md`
- Milestone 2 next-workday preparation and recommendations: `MILESTONE-2-PREPARATION.md`
- Milestone 3 commercial documents, signatures, reserved numbers and printing: `MILESTONE-3-COMMERCIAL-DOCUMENTS.md`
- Milestone 4 shared Inventory, receipt, consumables and carrier stock: `MILESTONE-4-SHARED-INVENTORY.md`
- Milestone 5 cash sheet and weekly access gate: `MILESTONE-5-CASH-WEEKLY-GATE.md`
- Original repository and prototype evidence: `../../../SALESDAY-INTEGRATION-AUDIT.md`
- Shared roles and scope: `../../03_ROLES.md`
- Shared architecture and integration boundaries: `../../01_ARCHITECTURE.md`
- Shared persistence rules: `../../02_DATABASE.md`
- Shared UI rules: `../../04_UI_GUIDELINES.md`
- Shared development and validation rules: `../../05_DEVELOPMENT_STANDARDS.md`

## Implementation rule

The first production release contains the complete approved operational scope, including offline mutations. Development still proceeds through isolated internal milestones behind server-side feature flags. No team is activated in production until every mandatory production gate in `IMPLEMENTATION-PLAN.md` passes.
