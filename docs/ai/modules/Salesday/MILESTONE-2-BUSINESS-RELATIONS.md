# SalesDay Milestone 2 — Shared business relations

Status: `IMPLEMENTED IN SOURCE — DATABASE DEPLOYMENT PENDING`

## Scope

This slice introduces the shared customer/prospect root required by SalesDay while preserving existing Contract behaviour.

Implemented:

- `BusinessRelation` as the central customer/prospect identity and scope root;
- provider-owned external links with uniqueness on provider plus external ID;
- normalized contacts, addresses and billing-validation state;
- Representative/team external scope references without inventing a BC/NAV mapping;
- an optional unique `ContractCustomer.businessRelationId` compatibility bridge;
- additive backfill of existing Contract customers, primary contacts, legal addresses and billing state;
- transactionally creating a shared relation and compatibility row for every new Contract customer;
- ERP customer normalization and transactional replica application;
- preserving pending explicit FieldForce edits when a competing ERP event arrives;
- updating the Contract compatibility projection after an acknowledged ERP replica update.

Migration `0046_salesday_business_relations` is additive. It has not been applied to the production database.

## Contract compatibility

Existing Contract calculations and signed/generated documents keep their existing customer snapshots and references. The bridge does not rewrite calculations or evidence. Contract creation now writes the shared relation first and maintains `ContractCustomer` in the same database transaction.

Legacy `externalSource` values are not guessed into an ERP provider. An external link is created only when the provider-neutral SalesDay adapter supplies a known `MOCK`, `BC_NAV` or `ODOO` identity.

## Validation

Primary command: `npm run test:salesday-business-relations`.

Related regression checks:

- `npm run test:contract-calculation`;
- `npm run test:contract-letter`;
- `npm run test:sales-erp-contracts`;
- `npm run typecheck`;
- `npx prisma validate`.

## Next slice

The next Milestone 2 slice adds appointment-gated customer detail, scoped offline search, audited Representative edits, VAT validation ports and prospect creation on top of this shared root.
