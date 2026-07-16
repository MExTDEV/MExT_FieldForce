# SalesDay Milestone 1 database validation — 16 July 2026

## Scope

Validation used the dedicated MariaDB database `MExT_FieldForce_SalesErp_Test`. The configured `MExT_FieldForce` database was not migrated or otherwise changed.

## Fresh migration result

All 44 repository migrations were applied successfully, including `0040_sales_erp_integration_ledger` and the local `0041_coaching_preparation_reference` migration.

The first fresh deployment exposed a pre-existing MariaDB incompatibility in `0034_starter_evaluations`: the generated question scope-link uniqueness-index name exceeded MariaDB's 64-character identifier limit. The migration now uses the explicit `SEQSL_question_scope_key` name, matching the later schema-repair migration. The two partially created tables were empty, removed only from the test database and the migration was rerun successfully.

## Ledger fault-injection result

`npm run test:sales-erp-ledger-db` passed on two consecutive runs. The runs covered atomic rollback, dependency ordering, acknowledgement recovery, replay authorization, reconciliation and inbox crash recovery.

Post-test verification found:

- zero matching reconciliation incidents;
- zero matching outbox dependencies or commands;
- zero matching inbox messages;
- zero matching replica checkpoints;
- zero matching test users;
- zero unfinished migrations;
- Prisma migration status: up to date.

## Production status

Migration `0040_sales_erp_integration_ledger` remains pending on the configured `MExT_FieldForce` database. This validation does not authorize or perform production deployment.
