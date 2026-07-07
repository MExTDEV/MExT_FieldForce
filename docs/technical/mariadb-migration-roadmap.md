# MariaDB migration roadmap

Current status:

- Prisma uses MariaDB/MySQL.
- Initial schema migration has been applied to `MExT_FieldForce`.
- Safe configuration seed is active.
- App modules read/write through MariaDB.
- Permission catalog and role permission templates are seeded in MariaDB.
- Development users, teams and user permission overrides are seeded in MariaDB.
- Session/user management reads and writes through MariaDB APIs.
- Representatives, levels and KPI snapshots are seeded and exposed through a MariaDB API.
- Dashboard, representative list and representative detail use the MariaDB representatives provider.
- Planning uses the MariaDB representatives provider for dynamic workflow event labels.
- Contact moments, help requests, retrainings and sales trainings use the MariaDB representatives provider for lists, details and participant pickers.
- The coaching wizard uses the MariaDB representatives provider for scope filtering, selection, preparation and summaries.
- Reporting uses the MariaDB representatives provider for scope, datasets, labels, teams and KPI reporting.
- Personal criteria and representative workflow detail helpers use the MariaDB representatives provider for representative metadata.
- WorkflowProvider loads and persists workflow state through `/api/workflows`.
- Personal criteria load and persist through `/api/personal-criteria`.
- Migration `0003_extend_workflow_persistence` extends workflow tables for MariaDB persistence.
- Migration `0004_add_coaching_appointment_scores` stores coaching appointment scores in queryable MariaDB rows.
- Workflow writes use granular endpoints per workflow type.
- A global workflow save error banner is shown when database persistence fails.
- The broad workflow `PUT /api/workflows` endpoint has been removed; writes must use the granular workflow endpoints.
- Failed workflow saves can be retried from the global error banner.
- Fixed coaching focuses and criteria are seeded through the safe configuration seed.
- Coaching focus names, workflow scores, dossier scores and appointment score rows load from and persist to MariaDB.
- Performance data loads through `/api/performance` from MariaDB KPI snapshots, scores, contact moments and action points.
- Reporting datasets use the MariaDB performance provider instead of generated performance arrays.
- Migration `0005_add_reporting_performance_indexes` adds indexes for reporting and performance queries.
- API routes use a shared error-response helper with server-side request-id logging.
- Database write routes create audit log records for workflow, module, user and personal criteria changes.
- Production app paths no longer import `lib/mock-data.ts`.
- Coaching focuses, coaching criteria and KPI definition lists load through `/api/configuration` from MariaDB.
- Representatives, users, personal criteria, teams and planning no longer fall back to hardcoded browser data.
- Demo users and teams live in an explicit development seed module.
- Local storage is limited to selected prototype session identity and recoverable draft/offline metadata.

Remaining work:

1. Workflows
   - Status: granular persistence foundation complete.
   - Next hardening: replace optimistic client-side workflow engine writes with server-authoritative responses.
   - Add audit trail rows for workflow writes.
   - Add automated integration tests for each workflow endpoint.

2. Criteria and scoring
   - Status: fixed coaching focuses, fixed criteria, personal criteria, workflow scores, dossier scores and appointment score rows are database-backed.
   - Next hardening: add automated persistence tests for score writes and reloads.

3. Performance and reporting
   - Status: KPI snapshots, coaching scores, contact moments, action points, prestatiecirkels and reporting datasets are database-backed.
   - Next hardening: move remaining client-side reporting filtering into dedicated server-side reporting endpoints for very large datasets.

4. Error handling and audit
   - Status: core API routes use consistent error responses, technical errors are logged server-side with request IDs, and core database writes create audit log records.
   - Next hardening: expose an audit log viewer for admins and add export/search filters.

5. Mock/localStorage cleanup
   - Status: complete.
   - Production code has no mock-data imports or business-data localStorage fallback.
   - `db:seed:config` only upserts technical configuration.
   - The safe configuration seed does not load development/mock modules.
   - Development/demo data requires the explicit destructive `db:seed:dev` command and guard.
   - Session selection uses local storage only while the demo switcher is enabled.
   - Other local storage remains limited to drafts and future retry metadata.
   - Next hardening: replace prototype user selection with the production identity provider and move offline drafts to IndexedDB.

6. Deployment hardening
   - Status: complete, except for the external credential rotation in Plesk.
   - Production environment validation, security headers and `/api/health` are active.
   - `deploy:prepare` runs validation, Prisma generation, migrations, safe config seed and build.
   - Plesk setup, monitoring, backups, rollback and password rotation are documented.
   - Remaining operator action: rotate the exposed database password in Plesk and update local and VPS environment variables.
   - Public production remains blocked until server-validated authentication replaces the prototype session selector.

7. Release validation
   - Status: complete.
   - Typecheck, build, domain tests, database tests and runtime health passed.
   - Real API create/update/reload tests passed for coaching, contact moments, help requests, retraining, sales training, personal criteria and action points.
   - Main workflow screens display the persisted STEP9 records.
   - Test details and record IDs are documented in `docs/step9-release-validation.md`.

8. Direct MariaDB verification
   - Status: complete.
   - Both retained STEP9 runs were verified directly through Prisma against MariaDB.
   - Interventions, detail rows, action points, participants, personal criteria, foreign-key relations, timestamps and 24 audit rows are present.
   - The repeatable verification command is `npm run test:db-verification`.
   - Equivalent read-only phpMyAdmin queries are documented in `docs/step10-phpmyadmin.sql`.
