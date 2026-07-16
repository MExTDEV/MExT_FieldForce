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
- Original repository and prototype evidence: `../../../SALESDAY-INTEGRATION-AUDIT.md`
- Shared roles and scope: `../../03_ROLES.md`
- Shared architecture and integration boundaries: `../../01_ARCHITECTURE.md`
- Shared persistence rules: `../../02_DATABASE.md`
- Shared UI rules: `../../04_UI_GUIDELINES.md`
- Shared development and validation rules: `../../05_DEVELOPMENT_STANDARDS.md`

## Implementation rule

The first production release contains the complete approved operational scope, including offline mutations. Development still proceeds through isolated internal milestones behind server-side feature flags. No team is activated in production until every mandatory production gate in `IMPLEMENTATION-PLAN.md` passes.
