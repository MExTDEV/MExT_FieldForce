# Release baseline - 2026-07-12

## Doel

Deze baseline voert `TODO.md` item `FF-P1-001 - Releasebasis en dirty working tree formaliseren` uit.

Het doel is niet om bestaande wijzigingen te beoordelen als correct of af, maar om de bestaande dirty working tree reviewbaar te maken voordat er verdere functionele taken worden opgepakt.

## Snapshot

- Datum: 2026-07-12 22:48:08 +02:00
- Branch: `main`
- Commit: `2f1319302406319cbe90a1522064f4be42ddfaba`
- Tracked modified files bij startsnapshot: 75
- Untracked files bij startsnapshot: 71
- Devserver gestart: nee
- Migraties uitgevoerd: nee
- Seeds uitgevoerd: nee
- Functionele code aangepast door deze baseline: nee

## Conclusie

De working tree moet niet als één wijzigingsset worden gereviewd of gecommit. De wijzigingen vallen in afzonderlijke reviewbatches met andere risico's, documentatie-eigenaars en validatiebehoeften.

De aanbevolen eerstvolgende technische stap na deze baseline is:

1. `FF-P1-002 - Prisma Client generatie en productiebuild opnieuw bevestigen`
2. `FF-P1-004 - Productiestatus van migraties 0021-0029 bevestigen`

Die twee bepalen of de bestaande code- en migratiewijzigingen veilig verder richting release kunnen.

## Reviewbatches

### Batch A - AI-instructies en actieve documentatie

Status: review nodig.

Bestanden en mappen:

- `.gitignore`
- `AGENTS.md`
- `20260712-old-AGENTS.md`
- `docs/ai/00_PROJECT.md`
- `docs/ai/01_ARCHITECTURE.md`
- `docs/ai/02_DATABASE.md`
- `docs/ai/03_ROLES.md`
- `docs/ai/05_DEVELOPMENT_STANDARDS.md`
- `docs/ai/07_KNOWN_ISSUES.md`
- `docs/ai/09_CHANGELOG.md`
- `docs/ai/INDEX.md`
- `docs/ai/modules/Coaching/*.md`
- `docs/ai/modules/Coaching/DECISIONS.md`
- `docs/ai/modules/Coaching/history/COMPLETED_2026-Q3.md`

Betekenis:

- Deze groep wijzigt de instructie- en kennisbasis waar toekomstige AI-taken op steunen.
- Controleer dat `AGENTS.md`, `docs/ai/INDEX.md`, Coaching-modulebestanden en TODO/historiek elkaar niet tegenspreken.

Aanbevolen validatie:

- Smalle documentreview.
- Geen build nodig.
- Controleer dat toekomstige taken via `docs/ai/INDEX.md` naar de kleinste relevante documentenset blijven gaan.

### Batch B - Audit-, roadmap- en rootdocumentatie

Status: door Codex bijgewerkt tijdens audit en baseline; inhoudelijke owner-review nodig.

Bestanden:

- `TODO.md`
- `TODO-archive-2026-07-12.md`
- `FieldForce.md`
- `DONE.md`
- `MIGRATION_GUIDE.md`
- `ROADMAP-260711.md`
- `TODO-extra.md`
- `docs/technical/release-baseline-2026-07-12.md`

Betekenis:

- Dit zijn de actieve audit-, backlog-, history- en overdrachtsdocumenten.
- `TODO.md` is vanaf deze baseline de actieve takenlijst.
- `TODO-archive-2026-07-12.md` bewaart de vorige root TODO.

Aanbevolen validatie:

- Controleer dat open werk alleen in `TODO.md` staat.
- Controleer dat afgewerkte taken in `DONE.md` staan.
- Controleer dat oude roadmap/TODO-bestanden niet opnieuw als actieve bron worden gebruikt.

### Batch C - Authenticatie, sessies, gebruikers en scope

Status: functionele review nodig.

Bestanden:

- `app/api/auth/me/route.ts`
- `components/user-management.tsx`
- `lib/server/authenticated-user.ts`
- `lib/server/users.ts`
- `lib/user-management.ts`
- `lib/role-permissions.ts`
- `lib/development-seed.ts`
- `scripts/test-role-permission-save.ts`

Betekenis:

- Deze groep raakt logincontext, gebruikersbeheer, rolrechten, user overrides en demo/dev-seeding.
- Omdat FieldForce permission- en scope-driven is, moet deze batch apart worden bekeken.

Aanbevolen validatie:

- `npm run test:auth-session`
- `npm run test:login-history`
- `npm run test:role-permission-save`
- `npm run test:menu-rights`
- `npm run typecheck`
- `npm run lint`

### Batch D - Coaching-workflows, lifecycle en zichtbaarheid

Status: functionele review nodig.

Bestanden:

- `app/api/coaching-participants/route.ts`
- `app/api/workflows/help-requests/route.ts`
- `app/api/workflows/persist-route.ts`
- `components/app-shell.tsx`
- `components/coaching-wizard.tsx`
- `components/contact-help-workflows.tsx`
- `components/notification-provider.tsx`
- `components/planning-calendar.tsx`
- `components/reporting-dashboard.tsx`
- `components/workflow-provider.tsx`
- `components/workspace-pages.tsx`
- `lib/coaching/visibility.ts`
- `lib/coaching/peer-execution.ts`
- `lib/dashboard-attention.ts`
- `lib/data-access.ts`
- `lib/notifications.ts`
- `lib/server/business-days.ts`
- `lib/server/microsoft-graph.ts`
- `lib/server/notifications.ts`
- `lib/server/representatives.ts`
- `lib/server/workflows.ts`
- `lib/smart-coaching.ts`
- `lib/types.ts`
- `lib/workflow-engine.ts`

Betekenis:

- Deze groep raakt Begeleidingen, Contactmomenten, Hulpaanvragen, Professional/Expert, planning, dashboard, notificaties, rapportage en zichtbaarheid.
- Review deze batch niet samen met beheer/import of documentatie.

Aanbevolen validatie:

- `npm run test:workflow`
- `npm run test:coaching-visibility`
- `npm run test:coaching-action-persistence`
- `npm run test:coaching-empty-remarks`
- `npm run test:coaching-expansion`
- `npm run test:representative-level-peer-coaching`
- `npm run test:dashboard-attention`
- `npm run test:header-todos`
- `npm run test:notifications`
- `npm run test:planning-items`
- `npm run test:contact-moments`
- `npm run test:help-requests`
- `npm run test:outlook-sync`
- `npm run typecheck`
- `npm run lint`

### Batch E - Contactmomentfoto's en private bestanden

Status: review en deploymentafspraak nodig.

Bestanden:

- `app/api/workflows/contact-moments/[id]/photos/route.ts`
- `app/api/workflows/contact-moments/[id]/photos/[photoId]/route.ts`
- `lib/contact-moment-photo-metadata.ts`
- `lib/server/contact-moment-photos.ts`
- `prisma/migrations/0029_contact_moment_private_photos/migration.sql`
- `scripts/test-contact-moments.ts`

Betekenis:

- Deze groep introduceert private API-backed foto-opslag voor Contactmomenten.
- De code gebruikt bestandsopslag naast database-metadata; deployment, backup en retentie moeten expliciet worden bevestigd.

Aanbevolen validatie:

- `npm run test:contact-moments`
- Upload/download/delete test op staging via extern beheerde server.
- Controleer `FIELD_FORCE_UPLOAD_ROOT` of het standaardpad in deploymentdocumentatie.

### Batch F - Beheer, KPI, import/export en mailinstellingen

Status: functionele en technische review nodig.

Bestanden:

- `app/api/management/route.ts`
- `app/api/management/settings/mail-test/route.ts`
- `components/configuration-management.tsx`
- `components/management-import-export-panel.tsx`
- `components/settings-management.tsx`
- `lib/csv.ts`
- `lib/csv-encoding.ts`
- `lib/server/criterion-scopes.ts`
- `lib/server/management.ts`
- `lib/server/management-import-export.ts`
- `lib/server/mail-service.ts`
- `lib/server/mail-settings.ts`
- `lib/server/mail-templates.ts`
- `lib/server/mail-test.ts`
- `docs/technical/mail-settings.md`
- `scripts/test-configurable-criterion-scopes.ts`
- `scripts/test-mail-service.ts`
- `scripts/test-mail-test-settings.ts`
- `scripts/test-management-import-export.ts`
- `scripts/test-menu-rights.ts`

Betekenis:

- Deze batch raakt beheer-UI, CSV-import/export, KPI's, kapstok/criteria, mailtestmodus en SMTP runtime-instellingen.

Aanbevolen validatie:

- `npm run test:criterion-scopes`
- `npm run test:management-import-export`
- `npm run test:mail-test-settings`
- `npm run test:mail-service`
- `npm run test:menu-rights`
- `npm run typecheck`
- `npm run lint`

### Batch G - Database, Prisma en configuratieseed

Status: releasekritisch; apart behandelen.

Bestanden:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/0021_normalize_user_permission_overrides/migration.sql`
- `prisma/migrations/0022_utf8_database_default_and_aurelie_repair/migration.sql`
- `prisma/migrations/0023_representative_levels_peer_coaching/migration.sql`
- `prisma/migrations/0024_seed_missing_permission_basis_records/migration.sql`
- `prisma/migrations/0025_configurable_criterion_scopes/migration.sql`
- `prisma/migrations/0026_contact_moment_execution_contract/migration.sql`
- `prisma/migrations/0027_help_request_handling_contract/migration.sql`
- `prisma/migrations/0028_help_request_open_default/migration.sql`
- `prisma/migrations/0029_contact_moment_private_photos/migration.sql`
- `docs/technical/database.md`
- `scripts/diagnose-utf8.ts`

Betekenis:

- Deze batch bepaalt of de database aansluit bij de huidige code.
- Geen enkele codebatch met velden uit deze migraties is releaseklaar zonder migratiestatus per omgeving.

Aanbevolen validatie:

- `npm run db:migrate:status`
- `npx prisma validate`
- `npm run db:generate` zodra de Windows query-engine lock weg is.
- `npm run build` pas nadat `db:generate` slaagt.
- `npm run test:db-verification` wanneer de databasecontext veilig beschikbaar is.

### Batch H - i18n en locale-bestanden

Status: review nodig.

Bestanden:

- `locales/nl.json`
- `locales/fr.json`
- `locales/de.json`
- `scripts/test-contact-help-i18n.ts`

Betekenis:

- Deze batch bevat meertalige tekst voor Contactmomenten, Hulpaanvragen, notificaties, mail en beheer.
- Omdat user-facing tekst in NL/FR/DE moet bestaan, mag deze batch niet los van UI-wijzigingen worden gereleased.

Aanbevolen validatie:

- `npm run test:contact-help-i18n`
- Handmatige taalreview voor NL/FR/DE.

### Batch I - Packages, scripts en technische testdekking

Status: review nodig.

Bestanden:

- `package.json`
- `package-lock.json`
- `next-env.d.ts`
- `scripts/test-action-points-overview.ts`
- `scripts/test-coaching-empty-remarks.ts`
- `scripts/test-contact-help-i18n.ts`
- `scripts/test-contact-moment-filters.ts`
- `scripts/test-contact-moments.ts`
- `scripts/test-help-requests.ts`
- `scripts/test-management-import-export.ts`
- `scripts/test-menu-rights.ts`
- `scripts/test-notifications.ts`
- `scripts/test-outlook-sync.ts`
- `scripts/test-representative-level-peer-coaching.ts`
- `scripts/test-role-permission-save.ts`
- `scripts/test-workflow.ts`

Betekenis:

- Deze batch wijzigt test- en scriptoppervlak.
- `package-lock.json` moet samen met `package.json` worden beoordeeld.

Aanbevolen validatie:

- Controleer alle nieuwe scripts in `package.json`.
- Draai relevante tests per functionele batch.
- `npm run typecheck`
- `npm run lint`

### Batch J - Oude documentatie en superpowers-plannen

Status: archiefreview nodig.

Bestanden en mappen:

- `docs/ai/old/`
- `docs/ai/modules/Coaching/old/`
- `docs/superpowers/plans/2026-07-12-fieldforce-roadmap-execution-plan.md`
- `docs/superpowers/specs/2026-07-12-fieldforce-roadmap-execution-design.md`

Betekenis:

- Deze bestanden zijn nuttig als historiek, maar mogen niet als actuele bron boven `AGENTS.md`, `docs/ai/INDEX.md`, actuele modulebestanden of `TODO.md` worden gebruikt.

Aanbevolen validatie:

- Controleer dat actieve docs niet naar oude docs routeren.
- Markeer archiefstatus expliciet wanneer deze batch wordt gereviewd.

## Commitstrategie

Niet automatisch committen. Wanneer de eigenaar akkoord gaat, gebruik dan kleine commits per batch.

Aanbevolen volgorde:

1. Batch A en B: instructies, auditdocs en baseline.
2. Batch G: Prisma schema, migraties en seed, pas na migratiestatuscheck.
3. Batch C: auth, sessies, rollen en scope.
4. Batch D en E: coaching-workflows en contactfoto's.
5. Batch F: beheer, import/export en mail.
6. Batch H: locales bij de bijbehorende UI-batches.
7. Batch I: package/scripts/tests bij de batches waarvoor ze dekking bieden.
8. Batch J: archieven apart.

## Validatie uitgevoerd voor deze baseline

Deze baseline documenteert bestaande wijzigingen en verandert geen applicatiegedrag. Daarom is geen build, devserver, migratie of seed uitgevoerd.

Verse controles na het schrijven van deze baseline:

- `npm run typecheck` - geslaagd.
- `npm run lint` - geslaagd.
- `npm run test:modules` - geslaagd.
- `npm run test:menu-rights` - geslaagd.

Tijdens de voorafgaande audit op dezelfde werkboom was ook `npm run test:contact-help-i18n` groen.

## Open risico's

- De codewijzigingen zelf zijn met deze baseline niet inhoudelijk goedgekeurd.
- Migratiestatus van 0021-0029 per omgeving is niet bevestigd.
- `npm run db:generate` en `npm run build` blijven afhankelijk van het bekende Prisma query-engine lock-risico.
- Browser/tabletacceptatie is niet uitgevoerd.
- Echte Graph-, Entra- en SMTP-integraties zijn niet bevestigd.
- Line-ending waarschuwingen tonen dat Git op Windows LF naar CRLF kan converteren wanneer bestanden opnieuw worden aangeraakt; dit is geen functionele fout, maar wel reviewruis.

## Definitie van afgerond voor FF-P1-001

`FF-P1-001` is vanuit Codex uitgevoerd wanneer:

- deze baseline bestaat;
- de dirty tree per reviewbatch verklaard is;
- de aanbevolen commit- en validatievolgorde vastligt;
- `TODO.md` naar deze baseline verwijst;
- `DONE.md` de uitvoering vermeldt;
- er geen functionele codewijziging voor deze taak is toegevoegd.
