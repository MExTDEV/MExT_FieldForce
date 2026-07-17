# SalesDay Milestone 4 — Shared Inventory

This milestone adds the shared FieldForce Inventory foundation used by SalesDay and later reusable by Service.

Implemented in source:

- migration `0054_shared_inventory`;
- shared `InventoryLocation`, immutable `InventoryMovement` and derived `InventoryBalance`;
- central warehouse, transit, Representative/vehicle, customer location/sublocation/carrier and quarantine location types;
- ERP replenishment, customer-location and carrier-balance replica application;
- replenishment receipt with mandatory Representative signature and at least one photo;
- partial, excess and damaged receipt handling;
- damaged receipt quantity moves to quarantine and never becomes sellable stock;
- idempotent receipt, consumables and carrier-count command keys;
- consumables request creation only; later approval/status remains ERP/backoffice-owned;
- customer location/sublocation/carrier create, edit and archive commands;
- Beheer-managed Inventory reasons;
- carrier stock and optional carrier count with mandatory discrepancy reason;
- commercial document stock movements for direct delivery only;
- ordinary Order keeps only the intended carrier and does not increase carrier balance;
- centrally managed expiry warning parameter with default `180` days.

Explicitly not implemented:

- Representative-to-Representative transfer;
- customer return flow;
- Representative personal/vehicle stock count or correction;
- FieldForce approval, edit or cancel of consumables requests after submission.

Validation:

- run `npm run test:inventory-shared`;
- run `npm run test:salesday-commercial-documents`;
- run `npx prisma validate`;
- run `npx prisma generate --no-engine`;
- run `npm run typecheck`.

Operational boundary:

Inventory APIs require the server-side `INVENTORY` feature flag. Mutating APIs also require `ERP_WRITES` and an active SalesDay device. Local source mutations and ERP outbox commands are committed together in the same database transaction.
