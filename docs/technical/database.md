# Database setup

MExT FieldForce uses Prisma migrations with MariaDB/MySQL as the central database.

## Local MariaDB/MySQL

Create a database and user:

```sql
CREATE DATABASE mext_fieldforce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mext_user'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON mext_fieldforce.* TO 'mext_user'@'localhost';
FLUSH PRIVILEGES;
```

Create `.env` from `.env.example` and set:

```env
DATABASE_URL="mysql://mext_user:replace-with-a-strong-password@127.0.0.1:3306/mext_fieldforce"
SEED_ALLOW_DESTRUCTIVE="false"
```

## VPS / production

Use a dedicated database user with only the privileges required by the app. Keep credentials in the VPS environment or `.env` file that is not committed.

Production startup flow:

```bash
npm ci
npm run deploy:prepare
npm run start:production
```

`db:seed:config` only upserts technical configuration such as modules, levels, KPI definitions and coaching criteria. It must not delete business data.

The detailed Plesk runbook is in `docs/vps-deployment.md`.

## Development seed

Demo data is destructive and only intended for local development:

```bash
SEED_ALLOW_DESTRUCTIVE=true npm run db:seed:dev
```

Do not run the development seed against production. The script refuses destructive seed mode when `NODE_ENV=production` or when `SEED_ALLOW_DESTRUCTIVE` is not `true`.

## Migrations

Every database model change must be represented by a Prisma migration in `prisma/migrations`.

Local development:

```bash
npm run db:migrate
```

Production/VPS:

```bash
npm run db:migrate:deploy
```

Do not make manual destructive database edits. If existing records must be transformed, add a migration or a reviewed data backfill script.

## Character set and text encoding

All application text storage must use UTF-8 through MariaDB/MySQL `utf8mb4`.

Rules:

- Database defaults should be `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`.
- Table defaults and textual columns must remain `utf8mb4`.
- Prisma connection sessions must use `utf8mb4` for client, connection and result character sets.
- CSV import files are treated as UTF-8 or UTF-8 with BOM. Invalid UTF-8 and already damaged replacement characters are rejected before commit.
- Do not automatically repair stored `U+FFFD` replacement characters unless the correct value can be derived from a reliable source.
- Use `npm run utf8:diagnose` to inspect database defaults, text-column character sets and suspicious stored values.

Migration `0022_utf8_database_default_and_aurelie_repair` sets the active database default to `utf8mb4_unicode_ci` and repairs the unambiguous `Aurélie Milet` user record.

## Action point management

Scoped action points for the Actiepunten module reuse `ActionDefinition`.

Related tables:

- `ActionDefinition`: global, country, team or user scoped action point definition.
- `action_point_target_types`: seeded target-level configuration for Global, Country, Team and User.
- `action_point_products`: many-to-many link between `ActionDefinition` and existing `Product`.
- `ActionTargetOverride`: optional scoped target override for an action definition.
- `CoachingAction` and legacy `ActionPoint`: concrete workflow-origin action points, kept separate from scoped definitions.
- `ActionPointAssignment`: per-user concrete assignment rows for shared action points.

Rules:

- Do not create a second standalone action-point definition table.
- Product links must reference existing `Product` rows.
- Active, in-date `ActionDefinition` records are counted as open scoped action-point definitions.
- Concrete workflow action points use their workflow status for open/closed reporting.
- `ActionPoint.closedAt` and `ActionPoint.closedByUserId` store close metadata for legacy single-user action points.
- `ActionPointAssignment.status`, `closedAt` and `closedByUserId` store per-assignment close state for shared user assignments.
- Closing an action point never updates or deactivates `ActionDefinition`.

## KPI management

KPI management extends the existing KPI tables instead of duplicating definitions.

Related tables:

- `KpiDefinition`: source of truth for KPI definitions and default target values.
- `kpi_categories`: configurable seeded categories.
- `kpi_types`: configurable seeded value types.
- `kpi_target_types`: configurable seeded scopes Global, Country, Team, User and Role.
- `kpi_targets`: active/inactive period targets per KPI and scope.
- `KpiTargetOverride`: legacy non-periodic overrides retained for backward compatibility.

Rules:

- `KpiDefinition.targetValue` is the default target.
- Effective period target priority is User, Team, Country, Role, Global/default.
- Active period targets may not overlap for the same KPI and scope.
- Reporting and Performance Circle inclusion are controlled separately by `counts_for_reporting` and `counts_for_performance_circle`.
- Seed/config mode upserts KPI categories, types and target types and must not delete business data.

### Operational verification 2026-07-12

The database `MExT_FieldForce` on host `vps-2486653.yourvps.io` was checked for
the Action point and KPI management migrations.

- `0019_action_point_management` was already applied on 2026-07-10.
- `0020_kpi_management` was already applied on 2026-07-10.
- `npm run db:migrate:deploy` reported no pending migrations.
- A logical SQL backup was created before seed validation:
  `C:\Users\jand\AppData\Local\Temp\FieldForce-db-backups\FieldForce-MExT_FieldForce-20260712T135436Z.sql`.
- `npm run db:seed:config` was run twice and remained idempotent.
- Seeded counts after validation: 4 action-point target types, 7 KPI
  categories, 5 KPI types, 5 KPI target types and 10 KPI definitions.
- `npm run db:generate` could not complete locally because the Windows Prisma
  query-engine DLL was locked during rename. Run it again after the lock is gone.
- A retry on 2026-07-12 hit the same local lock. `npm run build` remains
  pending because its prebuild step runs `prisma generate` first.

### Operational verification 2026-07-13

The same database `MExT_FieldForce` on host `vps-2486653.yourvps.io` was
checked with `npm run db:migrate:status`.

- Prisma found 29 local migrations.
- Migrations `0021_normalize_user_permission_overrides` through
  `0028_help_request_open_default` are applied on this database.
- Migration `0029_contact_moment_private_photos` was pending before deployment.
- `npm run db:generate` was retried once and again failed before client
  generation with the Windows query-engine rename lock:
  `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`.
- `npm run build` was not repeated because its `prebuild` step would rerun the
  same blocked `prisma generate` command before Next.js compilation starts.

Deployment update 2026-07-13:

- Backup evidence was confirmed before deployment:
  `C:\Users\jand\AppData\Local\Temp\FieldForce-db-backups\FieldForce-MExT_FieldForce-20260712T135436Z.sql`
  existed locally, was last written on 2026-07-12 15:54:44 and was 610202 bytes.
- `npm run db:migrate:deploy` applied
  `0029_contact_moment_private_photos` successfully.
- `npm run db:migrate:status` then reported: `Database schema is up to date!`.
- The `MExT_FieldForce` database on `vps-2486653.yourvps.io:3306` now has all
  29 local migrations applied.
- `npm run db:generate` was retried after the migration deployment and still
  failed before client generation with the same Windows query-engine rename
  lock. `npm run build` was not run because it would start the same blocked
  `prisma generate` command through `prebuild`.

Build-chain update 2026-07-13:

- The lock holder was identified as the externally managed FieldForce
  development server on port 3000:
  `npm run dev -- --port 3000` / `next dev --port 3000`.
- With user approval, only that FieldForce devserver process tree was stopped.
- `npm run db:generate` then succeeded and generated Prisma Client v6.19.3.
- `npm run build` then succeeded. The build ran `prebuild`, generated Prisma
  Client again, compiled Next.js successfully, checked types and generated all
  static pages.
- The development server was not restarted by the agent; restart remains
  user-managed through `keep-fieldforce-dev.ps1`.

### Country Manager Coaching permission correction

Migration `0030_country_manager_coaching_permission` aligns the persisted
`COUNTRY_MANAGER` role default with the approved role behaviour:

- `moduleVisitRecord` becomes enabled for the Country Manager role;
- stale `UserPermission` rows equal to the previous stored role value are
  removed before the role default changes;
- genuine user-level deviations remain available through the normal sparse
  override model;
- country scope is not changed by this migration.

Deployment and verification 2026-07-13:

- backup evidence was confirmed before deployment;
- `npm run db:migrate:deploy` applied
  `0030_country_manager_coaching_permission` successfully;
- `npm run db:migrate:status` found 30 local migrations and reported that the
  database schema is up to date;
- a direct Prisma read confirmed that `COUNTRY_MANAGER` has stored
  `moduleVisitRecord = true`;
- country scope records were not changed by the migration.

## Configurable criterion scopes

Migration `0025_configurable_criterion_scopes` adds the generic scope foundation for configurable criteria and score questions.

Related tables:

- `ConfigurableCriterion`: source table for configurable general coaching questions that were previously hardcoded, such as general evaluation and personality criteria.
- `CriterionScopeLink`: one or more concrete scope links per criterion with scope `GLOBAL`, `COUNTRY`, `TEAM` or `USER` and an independent `sortOrder` per link.
- `CoachingCriterionSnapshot`: immutable snapshot rows attached to an `Intervention` at coaching creation/planning time.

Existing source tables remain the source of truth for their domain:

- `KpiDefinition` for KPI criteria.
- `CoachingCriterion` for Kapstok criteria.
- `ConfigurableCriterion` for general evaluation, personality and other general coaching score questions.

Rules:

- Scope links are cumulative; they do not override each other.
- The coached user determines applicable scopes through current country, team and user id.
- When the same criterion applies through multiple links, it is deduplicated by stable criterion key.
- The most specific applicable link wins for display grouping and sorting: User, Team, Country, Global.
- Sort order belongs to the concrete `CriterionScopeLink`, not only to the criterion definition.
- Existing KPI and Kapstok records are backfilled with scope links.
- Existing hardcoded general evaluation and personality questions are seeded as global configurable criteria.
- Existing historical coachings and score rows are not rewritten.
- New coachings receive snapshots that must not be recalculated after later configuration, scope or user team/country changes.

## Required check for every future feature

Before implementing a feature or change, verify:

- Is a new table needed?
- Is a new field needed?
- Is a new relation or index needed?
- Is a migration needed?
- Is seed/config data needed?
- Do existing queries, server actions or route handlers need updates?
- Do existing records need a safe migration or backfill?
- Is audit logging required for the mutation?

## Role country scope

`User.country` stores the primary country context for a user. Additional country
scope for roles that may cover more than one country, such as Sales Manager, is
stored in `UserCountryAccess`.

Rules:

- Sales Manager is an explicit `Role` enum value.
- A Sales Manager may have one or more `UserCountryAccess` records.
- A Sales Manager without country access records must not be treated as global.

## Role configuration

Application roles are fixed `Role` enum values. Runtime metadata for those roles
is stored in `RoleConfiguration`.

Fields:

- `role`: unique `Role` enum value.
- `active`: defaults to `true`.

Rules:

- All system roles are active by default.
- Inactive roles remain visible in role management.
- Inactive roles are not available for new user-role assignments.
- Existing users keep inactive roles until an authorised user changes them.

## Team leadership

Permission persistence:

- `Permission` is the basis table for every configurable permission key shown in role management.
- `RolePermission` stores the configurable default per role and permission.
- `UserPermission` stores only explicit user deviations; no row means inheritance.
- Role configuration seed operations only create missing role permission rows.
- Migration `0021_normalize_user_permission_overrides` deletes redundant user copies equal to their current role defaults and preserves actual overrides.
- Migration `0024_seed_missing_permission_basis_records` adds missing action point, KPI and Coaching menu permission basis rows so role saves do not fail on unknown permission keys.
- Saving a role applies its changed default to users without an explicit deviation.

`Team` is the organisational team record. The assigned primary Verkoopleider is optional:

- `Team.primaryLeaderId` is nullable.
- When it is `NULL`, the team is displayed as having no assigned Verkoopleider.
- Primary leadership join rows in `TeamLeader` are removed when no Verkoopleider is assigned.
- Existing teams with a Verkoopleider keep their relation during migration.
- Field users may remain assigned through `User.teamId` even when the team has no primary leader.

## Management import/export

Beheer import/export reuses existing tables and does not introduce a separate staging schema.

CSV export/import topics:

- users: `User` plus `UserCountryAccess`
- teams: `Team` plus primary `TeamLeader`
- kpis: `KpiDefinition`
- kapstok: `CoachingFocus` and `CoachingCriterion`

Rules:

- API access is restricted to `SUPER_ADMIN` and the `technicalImportExport` permission.
- Import validation runs before commit and reports row-level errors.
- User import matches on e-mail.
- Team import matches on `country + name`.
- KPI import matches on the existing globally unique `KpiDefinition.code`.
- Kapstok import matches focus by code, or by name for existing focus rows when no code is supplied.
- User import does not create missing teams.
- Team import updates the nullable primary leader relation through existing team-save logic.
- Import audit logs store topic and created/updated/skipped/error counts, not complete CSV content.

## Representative levels and peer coaching

Migration `0023_representative_levels_peer_coaching` adds the database
foundation for Professional/Expert peer coaching:

- `User.representativeLevel` with values Starter, Sales Executive, Professional
  and Expert.
- `RepresentativeLevelHistory` for auditable level changes.
- peer-coaching metadata on `Intervention`, including mandatory-notification
  choices, deviation flags/reason, actual start, deadlines, late-completion
  reason, administrative close fields and copy relation.
- `CoachingAction.reviewStatus` and review metadata for action-point proposals.
- `Holiday` for central country-specific working-day calculations.
- `AppSetting` with safe default `MAIL_TEST = true` and configurable
  `MAIL_TEST_RECIPIENT`.
- `NotificationDelivery` for event/channel/recipient deduplication and
  MAIL TEST delivery logging.

The permission-protected `Beheer -> Instellingen` screen reads and updates the
global `MAIL_TEST` active state and `MAIL_TEST_RECIPIENT` through a dedicated
API. An absent `MAIL_TEST` row is interpreted as `true`; an absent or invalid
recipient falls back to `helpdesk@mext.be`. Switching `MAIL_TEST` to `false`
requires the exact `PRODUCTIE` confirmation and writes an `AuditLog` entry in
addition to `AppSetting.updatedById`.

Deployment must run `npm run db:migrate:deploy` before code using these fields
is started.
# Contactmomenten

Contactmomenten are stored as `Intervention` rows with
`type = CONTACTMOMENT` and a one-to-one `ContactMomentDetail`.

Migration `0026_contact_moment_execution_contract` adds:

- `NIET_UITGEVOERD` to `InterventionStatus`;
- optional detail fields for subject, contact type, location and internal
  notes;
- `reportHtml` for sanitized rich-text report content;
- `finalSnapshot` for the immutable shared report snapshot;
- share metadata: `sharedAt`, `sharedById`;
- cancellation/not-completed metadata: `closedReason`, `closedAt`,
  `closedById`, `previousStatus`;
- indexes on `sharedAt` and `closedAt`.

The existing `ActionPoint.interventionId` relation is the source link for
action points created from contact moments.

Migration `0029_contact_moment_private_photos` adds nullable
`ContactMomentDetail.photosJson`. The column stores private photo metadata only.
The binary files are stored on the application filesystem below
`FIELD_FORCE_UPLOAD_ROOT/contact-moments/<contactMomentId>/`. If
`FIELD_FORCE_UPLOAD_ROOT` is absent, the application falls back to
`storage/uploads` under the application working directory.
Photo metadata contains a generated ID, original filename, stored filename,
MIME type, size, uploader, upload timestamp and sort order. The upload API
accepts multiple images in one request, validates MIME type, maximum size and
JPEG/PNG/WebP file signatures before writing to disk, and keeps the files
private behind the authenticated photo route.

User profile photos reuse the existing nullable `User.avatarUrl` column. A
manually entered external URL may still be stored there, but Microsoft Graph
photos are never loaded directly by the browser. When a photo is uploaded
through user management or synchronised from Microsoft, the binary file is
stored below `FIELD_FORCE_UPLOAD_ROOT/user-avatars/<userId>/` and
`User.avatarUrl` points to the authenticated `/api/users/<userId>/avatar` route.
Migration `0033_user_profile_photo_sync` adds local photo metadata to `User`
and stores run history and duplicate-run locking in `ProfilePhotoSyncRun`.
See `docs/technical/profile-photo-sync.md`.

Deployment requirements for Contactmoment and user profile photos:

- run `npm run db:migrate:deploy` before starting code that exposes the photo
  API;
- configure `FIELD_FORCE_UPLOAD_ROOT` to a persistent directory outside
  transient build output;
- include the upload root in server backups and restore drills;
- keep the upload root private and serve files only through authenticated photo
  APIs;
- configure Microsoft profile photo sync with `ProfilePhoto.Read.All` admin
  consent and `npm run profile-photos:sync` when Entra photos should be kept
  current;
- do not manually edit `photosJson`; use the API so metadata and files remain
  consistent.

---

# Hulpaanvragen

Help requests are stored in `HelpRequest`.

Migration `0027_help_request_handling_contract` adds the handling contract:

- canonical enum values `OPEN`, `BEGELEIDING`, `CONTACTMOMENT`, `RETRAINING`,
  `SALESTRAINING`, `GESLOTEN` and `INGETROKKEN`;
- nullable `responsibleUserId` with relation `HelpResponsible`;
- sanitized `descriptionHtml` and searchable `descriptionText`;
- first-handling metadata: `firstHandledAt`, `firstHandledByUserId`;
- withdrawal metadata: `withdrawnAt`, `withdrawnByUserId`;
- `HelpRequestAnswer` with author relation, rich-text/plain-text body,
  close flag and immutable `createdAt`.
- Migration `0028_help_request_open_default` sets the database default for new
  help requests to `OPEN`.

Older enum values remain valid for existing rows:

- `NIEUW`;
- `IN_BEHANDELING`;
- `VERVOLGACTIE_GEPLAND`;
- `AFGESLOTEN`;
- `GEANNULEERD`.

Persistence rules:

- new requests are created as `OPEN`;
- representative edits/withdrawals are allowed only before first handling;
- manager answers append records instead of mutating previous answers;
- closing requires an answer with `closesRequest = true`;
- follow-up selection keeps using `followUpType` and `linkedInterventionId`.

---
