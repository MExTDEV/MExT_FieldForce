# SalesDay Milestone 3 — Commerciële documenten

Implemented in source on 17 July 2026. Migration `0053_salesday_commercial_documents` is additive and remains deployment-pending; no production database was changed.

## Scope

This milestone adds the SalesDay commercial-document foundation for:

- Order, Order-Reeds-Geleverd and Factuur selection;
- ERP article/price/unit/VAT replica for sales use;
- immutable document, customer, billing, line, total, language and template snapshots;
- reserved number blocks and number-use reconciliation;
- override reasons and unsigned-exception reasons managed through SalesDay Beheer;
- signed evidence or mandatory unsigned-exception evidence on every document type;
- provider-neutral `sales-document.create` outbox commands;
- standard Android print/share descriptor and replaceable direct-printer boundary;
- validated context handoff to the existing Contract module.

The concrete BC/NAV, Odoo and direct-printer transports remain undefined. This milestone does not implement a native printer driver, hardcode Epson WF-110 behaviour or bypass the provider-neutral ERP contract.

## Server Behaviour

`proposeSalesDocumentType` proposes:

- `ORDER` when any line has insufficient Representative stock in the captured stock snapshot;
- `ORDER_ALREADY_DELIVERED` when stock is sufficient but on-site invoicing is not allowed;
- `INVOICE` when stock is sufficient and on-site invoicing is allowed.

A Representative may override the proposed type only with an active `OVERRIDE` reason. If the reason requires a comment, the comment is mandatory. The override is stored on the immutable document snapshot and included in the ERP command.

Stock impact is captured once per line:

- `ORDER`: `representativeStockImpactQuantity = 0`;
- `ORDER_ALREADY_DELIVERED` and `INVOICE`: `representativeStockImpactQuantity = quantity`.

The actual shared Inventory movement is completed in Milestone 4. Milestone 3 stores the document-side stock-impact evidence so the later Inventory command can reconcile deterministically.

Carrier-bound articles require a customer carrier for direct-delivery document types. Ordinary Orders may carry an intended carrier but do not move customer-carrier stock until ERP delivery confirmation and the Inventory milestone rules apply.

## Persistence

Migration `0053_salesday_commercial_documents` adds:

- `SalesArticle` and `SalesArticlePrice`;
- `SalesDocumentReason`;
- `SalesDocumentNumberBlock` and `SalesDocumentNumberUse`;
- `SalesDocument`, `SalesDocumentLine` and `SalesDocumentSignatureEvidence`.

Document creation, number use, immutable snapshots, signature/exception evidence, audit log and ERP outbox command are persisted in one serializable transaction.

## API Surface

- `GET /api/salesday/articles`
- `GET|POST /api/salesday/appointments/:appointmentId/documents`
- `GET /api/salesday/documents/:documentId/print`
- `GET /api/salesday/appointments/:appointmentId/contract-context`
- `GET|POST /api/salesday/settings/commercial-documents`

Representative write APIs require SalesDay and ERP-write feature flags plus the active device/day gate. Settings APIs require `salesday.settings.manage`.

## Validation

Run `npm run test:salesday-commercial-documents`.

The test covers proposal policy, stock-impact command evidence, local prospect/appointment IDs with command dependencies, schema/migration invariants, number block administration, signature evidence, print/share descriptor and Contract context gate.
