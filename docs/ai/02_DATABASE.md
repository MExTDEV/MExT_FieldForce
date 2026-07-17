# 02_DATABASE.md

# Database Architecture

This document describes the database principles for MExT FieldForce from an AI-development perspective.

It does not replace the detailed technical database documentation.

For the full data model, see:

- `docs/technical/database.md`

For database development and migration rules, see:

- `docs/technical/database-development-policy.md`

For MariaDB migration planning, see:

- `docs/technical/mariadb-migration-roadmap.md`

---

# Database Stack

MExT FieldForce uses:

- Prisma ORM
- MariaDB / MySQL
- UTF-8 / `utf8mb4` for all application text

Prisma is the source of truth for application-level database access.

Database changes must be made through the Prisma schema and migration workflow.

Direct manual schema changes in production are not allowed unless explicitly documented as an exceptional recovery action.

All names and free text must preserve Dutch, French and German characters end to end. Imports must not silently convert Windows-1252, ISO-8859-1 or already damaged text into stored business data. Use the UTF-8 diagnostic script before repairing stored text, and only repair `U+FFFD` records when the intended value is known from a reliable source.

---

# Database Design Principles

## Single Source of Truth

Before adding a new table, field or relation, always verify whether the data already exists elsewhere.

Duplicate business data must be avoided.

If the same business concept already exists, reuse or extend the existing entity instead of creating a parallel structure.

Examples:

- Do not create a second user table.
- Do not duplicate country or team data.
- Do not create a separate representative entity if the existing user model already represents representatives.
- Do not store calculated values unless there is a documented reason.

---

## Transparent Business Logic

Business calculations must be documented.

No hidden or unknown calculations are allowed.

If a score, status, KPI or Performance Circle value is calculated, the formula and source data must be documented.

Calculation logic should be traceable from input data to displayed result.

---

## Permission-Aware Data Access

Database queries must always respect the effective permission model.

Visibility depends on:

- role configuration
- user-level overrides
- assigned country scope
- assigned team scope
- lifecycle status of the record

The UI must never be the only security layer.

Server-side data access must also enforce permissions.

---

## Lifecycle-Aware Data Access

Some records are visible or editable depending on their lifecycle status.

For Coaching, lifecycle states include:

- Planned
- In Progress
- Incomplete
- Pending Approval / Wachten op akkoord
- Completed

Business rules:

- Planned surprise coachings must not be visible to representatives unless notification was enabled.
- Pending Approval coachings are read-only until the status is withdrawn.
- Completed coachings are locked for normal editing.
- Historical coachings are included in reporting and future comparisons.

---

# Core Data Domains

The application is modular.

Each module owns its own business workflow, but shared entities must be reused.

## Shared Entities

Expected shared entities include:

- User
- Role
- Permission
- Country
- Team
- Module
- User module overrides
- Role module permissions
- Login/session metadata

`User.avatarUrl` stores either an external avatar URL or the authenticated
application avatar route for a locally stored user photo. User photos are stored
below `FIELD_FORCE_UPLOAD_ROOT/user-avatars/`. Microsoft Entra profile photos
are synchronised server-side through the shared avatar route; metadata is stored
on `User` with `profilePhotoStorageKey`, `profilePhotoMimeType`,
`profilePhotoHash`, `profilePhotoSyncedAt`, `profilePhotoSyncStatus` and
`profilePhotoSyncError`. Synchronisation runs are tracked in
`ProfilePhotoSyncRun`.

Representative users also have a separate `representativeLevel` value. This is
stored on `User`, not as a separate role. Changes are auditable through
`RepresentativeLevelHistory`.

These entities are shared across modules and should not be duplicated inside individual modules.

---

## Team Leadership

Teams are organisational entities.

Business rules:

- A Team may exist without an assigned Verkoopleider.
- `Team.primaryLeaderId` is optional and must remain nullable in the database.
- Missing team leadership must be stored as `null`, not as a dummy user, fake Verkoopleider or empty-string workaround.
- Representatives and other field users may still be assigned to a Team that has no Verkoopleider.
- Assigning or removing the Team Verkoopleider must not broaden Verkoopleider visibility; ordinary Verkoopleiders remain scoped to their own `User.teamId`.

---

## Coaching Domain

The Coaching module currently has development priority.

Important Coaching-related business entities include:

- Coaching
- Coaching lifecycle status
- Coach
- Representative
- Focus Area
- Evaluation Criteria
- Customer Visit
- Score
- Performance Circle
- Action Point
- Coaching Report / Dossier
- Approval status
- Outlook synchronisation metadata
- peer-coaching planning metadata for Professional/Expert representatives
- notification and e-mail delivery deduplication metadata
- central holiday calendar for country-specific working-day deadlines

The coached person's mandatory reflection before approval is stored on the
existing `Approval` record. The current architecture has one `Approval` source
of truth per Begeleiding (`interventionId` is unique), so no separate approval
round entity is introduced until the business defines versioned approval
rounds. The stored fields are sanitized WYSIWYG HTML answers plus completion
metadata (`reflectionCompletedAt`, `reflectionCompletedByUserId`). Existing
completed Begeleidingen remain backwards compatible because the fields are
nullable and only pending approval actions require them.

The exact technical model must be verified in `docs/technical/database.md` and the Prisma schema.

Migration `0023_representative_levels_peer_coaching` adds the foundation for:

- representative levels and level history;
- Professional/Expert representatives as assigned coaching executors;
- team/country deviation flags and deviation reason;
- three pre-notification settings for coached representative and team leaders;
- actual start and deadline timestamps;
- administrative closing and copy relation metadata;
- action-point review status before activation;
- central `Holiday` records per country;
- global `MAIL_TEST` application setting;
- notification/e-mail deduplication through `NotificationDelivery`.

`MAIL_TEST` is managed through `Beheer -> Instellingen`. A missing setting is
treated as active, which is the safe default. The test recipient is stored as
`MAIL_TEST_RECIPIENT` with `helpdesk@mext.be` as safe fallback when no value has
been configured yet. Disabling `MAIL_TEST` requires the exact confirmation
`PRODUCTIE`; every change stores the actor on `AppSetting` and is also recorded
in `AuditLog`.

---

# Coaching Data Rules

## Coaching

A Coaching represents one planned or executed coaching session.

A Coaching may be opened from multiple locations, but there must be only one coaching record and one coaching workflow.

Entry points include:

- Dashboard
- Planning
- Begeleidingen
- Mijn Team

Business rule:

Multiple pages may link to the same Coaching, but no page may create a duplicate Coaching workflow or duplicate Coaching data.

---

## Focus Areas

Every Coaching must contain at least one focus area.

Selected focus areas determine which evaluation criteria appear during execution.

Minimum:

- one focus area

Maximum:

- all available focus areas

---

## Customer Visits

A Coaching contains one or more customer visits.

Every visit is scored separately.

Each visit contains at least:

- customer number
- customer name
- location
- start time
- end time
- evaluation criteria based on selected focus areas

Business rule:

A Coaching must contain at least one customer visit before it can be completed.

---

## KPI Management

KPI definitions reuse the existing `KpiDefinition` table as the source of truth.

Related configuration tables:

- `kpi_categories`: seeded KPI categories such as Sales, Visits, Orders, Turnover, Coaching, Service and Custom.
- `kpi_types`: seeded KPI value types such as Number, Percentage, Currency, Boolean and Score.
- `kpi_target_types`: seeded target scopes Global, Country, Team, User and Role.
- `kpi_targets`: period-specific target values for a KPI and scope.
- `KpiTargetOverride`: legacy non-periodic target overrides kept for compatibility.

Rules:

- Do not create a second standalone KPI definition table.
- `KpiDefinition.targetValue` remains the default target when no more specific period target exists.
- Effective target priority is User, Team, Country, Role, Global/default.
- Active period targets must not overlap for the same KPI and scope.
- `counts_for_reporting` controls report inclusion.
- `counts_for_performance_circle` controls Performance Circle inclusion.
- KPI definitions and targets must always be filtered by role, country, team and user scope.

---

## Configurable Criteria and Snapshots

Configurable Coaching criteria use a shared scope model.

Criterion sources:

- KPI criteria remain in `KpiDefinition`.
- Kapstok criteria remain in `CoachingCriterion`.
- General evaluation, personality and other general coaching score questions use `ConfigurableCriterion`.

Scope links:

- `CriterionScopeLink` stores the applicable scope and concrete target.
- Supported scopes are `GLOBAL`, `COUNTRY`, `TEAM` and `USER`.
- A criterion may have multiple scope links.
- Each scope link has its own `sortOrder`.
- Duplicate exact criterion/scope/target links are blocked.

Selection:

- Applicable criteria are selected based only on the coached user.
- Global, country, team and user links are cumulative.
- The same criterion is deduplicated by stable criterion key.
- If multiple applicable links exist for the same criterion, display uses the most specific link: User, Team, Country, Global.

Snapshots:

- `CoachingCriterionSnapshot` stores the immutable criteria snapshot for a coaching.
- Snapshots are created for new coachings when the coaching is persisted.
- Later changes to criterion text, scope links, sort order, country or team do not change existing snapshots.
- Existing historical coachings and scores are preserved.

Preparation references:

- migration `0041_coaching_preparation_reference` adds nullable
  `Intervention.preparationReferenceCoachingId` as a self-relation to the
  selected completed Begeleiding;
- `ON DELETE SET NULL` preserves the planned record when a referenced record is
  administratively removed;
- existing records require no backfill and resolve the newest eligible
  completed Begeleiding at read time;
- the write path verifies same coached person, completed lifecycle, past date
  and effective actor scope before accepting the relation;
- preparation score tables read stored `Score.category`, `Score.label`,
  `Score.comment`, `CoachingAppointmentScore.sortOrder` and
  `CoachingCriterionSnapshot.sortOrder`; current configuration is not used to
  rewrite historical output.

---

## Action Points

Every completed Coaching must contain at least one action point.

Each action point contains:

- title
- priority
- optional target date
- Tips & Tricks WYSIWYG content

Scoped action point definitions also exist independently of a coaching:

- global
- country
- team
- individual user

Technical model:

- `ActionDefinition` is the source of truth for scoped action point definitions.
- `ActionPointTargetType` stores the allowed target levels.
- `ActionDefinitionProduct` links action definitions to existing `Product` records.
- `ActionTargetOverride` stores optional scoped target overrides.
- `CoachingAction` and legacy `ActionPoint` remain concrete workflow-origin action points.
- `ActionDefinition.tipsAndTricks` and concrete action point `description` /
  `tipsAndTricks` fields store sanitized HTML as the canonical rich-text
  action point description format.

Rules:

- Do not duplicate scoped action definitions in a second table.
- Active, in-date `ActionDefinition` records are considered open scoped action-point definitions.
- Inactive or expired definitions remain visible to authorised management users.
- Concrete `ActionPoint` rows and `ActionPointAssignment` rows store close status
  and metadata with `AFGEROND`, `closedAt` and `closedByUserId`.
- Closing an action point must update only the concrete assignment or legacy
  single-user action point, never the underlying scoped `ActionDefinition`.
- Approval, reassignment and automatic per-user task generation workflows are
  not yet defined.

---

## Approval

A Coaching is not considered completed until the representative has approved it.

When a Coaching reaches Pending Approval / Wachten op akkoord:

- the Coaching becomes read-only
- no modifications are allowed
- the coach must first withdraw the Pending Approval status before editing
- after editing, the Coaching must again be submitted for approval

---

# Role and Permission Data

Menu visibility and functional access are not hardcoded by role alone.

The application uses effective permissions.

Effective permissions are determined by:

1. role configuration
2. user-level override
3. assigned country scope
4. assigned team scope
5. module activation
6. record lifecycle status

Business rule:

Adding a new main navigation item requires corresponding role permission configuration and user-level override support.

## Role Configuration

The application roles themselves are fixed enum values.

Role-level metadata that must be configurable at runtime is stored separately in
`RoleConfiguration`.

Current fields:

- `role`: the fixed application role identifier.
- `active`: whether the role can be newly assigned.

Business rules:

- Missing role configuration records are treated as active for backwards compatibility.
- Existing role configuration records default to active.
- Inactive roles remain visible for management and keep existing users unchanged.
- Inactive roles must not be assigned to new users or to users who do not already have the role.
- Existing users with an inactive role can still be loaded and saved for other safe profile changes.


Role and user permission storage:

- `RolePermission` is the persistent runtime default for a role.
- Configuration seeding creates missing role grants and does not overwrite saved business configuration.
- `UserPermission` contains only explicit deviations from the user's current role defaults.
- Missing `UserPermission` rows mean inheritance from `RolePermission`.
- Migration `0021_normalize_user_permission_overrides` removes historical user rows that duplicated their role defaults while preserving real deviations.
- Role updates remove obsolete inherited snapshots and keep explicit user overrides intact.
---

# Sales Manager Role

Sales Manager is a separate application role.

It is not the same as:

- Verkoopleider
- Country Manager

A Sales Manager is positioned above the Verkoopleider level and can have access to one or more countries.

Database and permission models must support this role explicitly.

---

# Data Scope Rules

## Representative

A Representative sees only own data.

In Coaching:

- sees own coachings
- sees planned coachings only when notification was enabled during planning
- does not see surprise coachings before Pending Approval
- can review and approve coachings from Pending Approval onward

---

## Verkoopleider

A Verkoopleider sees own team.

In Coaching:

- can plan coachings for own team members
- can execute coachings for own team members
- can edit planned future coachings for own team

---

## Sales Manager

A Sales Manager sees data within assigned country scope.

A Sales Manager can have access to one or more countries.

Implementation note:

- The primary `User.country` remains available for default user context.
- Additional Sales Manager country rights are stored as assigned country-scope records.
- A Sales Manager with no assigned country-scope records must not receive global data visibility.

---

## Country Manager

A Country Manager sees data within assigned country scope.

---

## Admin

An Admin sees data within assigned country scope.

---

## Super Admin

A Super Admin sees all data.

---

# Migration Rules

Database schema changes must follow the documented migration process.

Required process:

1. Check whether existing data structures can be reused.
2. Update Prisma schema.
3. Create a migration.
4. Verify migration locally.
5. Verify generated Prisma Client.
6. Update database documentation.
7. Validate application build.
8. Deploy migration only through the approved deployment process.

For detailed rules, see:

- `docs/technical/database-development-policy.md`

---

# AI Implementation Rules

AI assistants must follow these rules when working on database-related changes.

- Read this document before changing data structures.
- Check `docs/technical/database.md` before adding new entities.
- Check the Prisma schema before proposing schema changes.
- Never create duplicate business data.
- Never invent calculations.
- Never broaden permissions without explicit request.
- Never change production schema manually.
- Always document new business fields.
- Always update related documentation when the database changes.
- Always consider role scope and lifecycle status in queries.

---

# Out of Scope

This document does not contain the full Prisma schema.

This document does not contain SQL migration scripts.

This document does not replace detailed technical database documentation.

Use this document as the AI-facing database architecture guide.

---

# SalesDay ERP integration ledger

Migration `0040_sales_erp_integration_ledger` additively defines:

- `ErpInboxMessage` for provider/message deduplication and atomic event application;
- `ErpOutboxCommand` for idempotent FieldForce commands, actor/device context, retries and acknowledgements;
- `ErpOutboxDependency` for ordered command chains;
- `ErpReplicaCheckpoint` for provider/stream/scope cursors;
- `ErpReconciliationIncident` for deduplicated operational failures.

Critical rules:

- local business mutation and outbox insert share one Prisma transaction;
- inbox domain mutation and applied marker share one Prisma transaction;
- workers use expiring leases and compare-and-set updates;
- terminal records are retained, not deleted as part of retry handling;
- provider/message ID and provider/idempotency key are database-unique;
- replay authorization is server-side and mandatory;
- migration `0040` is currently pending on the configured external database.

The guarded database test requires a separate `SALES_ERP_LEDGER_TEST_DATABASE_URL` whose database name contains `test`. It must never use the normal application database.

## SalesDay device registration

Migration `0042_salesday_device_registration` additively defines `DeviceRegistration` for the server-side identity and lifecycle of a Representative's personal SalesDay device.

Critical rules:

- `deviceId` is opaque, application-generated and globally unique;
- a device ID never changes owner and a revoked device ID is never reactivated;
- `activeUserKey` is equal to the owner ID only while active and is `NULL` after revocation; its unique constraint enforces at most one active device per user while retaining history;
- revocation retains actor, timestamp and reason;
- device replacement requires a new device identity after controlled revocation;
- the record stores no raw offline encryption key;
- migration `0042` is not deployed to the configured production database.

## SalesDay device security

Migration `0043_salesday_device_security` additively defines the key lifecycle, session binding and remote-control ledger.

Critical rules:

- only a SHA-256 key fingerprint is stored; raw offline encryption keys remain on the device as non-exportable `CryptoKey` values;
- provisioning challenges are device-, owner- and session-bound, short-lived and one-use;
- the device bearer token is returned once and only its SHA-256 hash is stored;
- `UserLoginSession.deviceRegistrationId` allows remote logout/wipe to invalidate bound sessions server-side;
- control commands are durable and auditable, with at most one open device/type command through nullable unique `pendingKey`;
- a wipe revokes registration and key immediately, while the device token remains accepted only by acknowledgement until its revocation timestamp is set;
- the revoked token hash is retained for idempotent acknowledgement retry and is never accepted by normal authenticated APIs;
- migration `0043` is not deployed to the configured production database.

## SalesDay day gate and emergency mode

Migration `0044_salesday_day_gate_emergency` additively defines `SalesDayEmergencyMode` and the `salesday.emergencyMode.manage` permission.

Critical rules:

- nullable unique `activeKey` permits only one open central emergency window while retaining expired/deactivated history;
- every window stores incident reason, explicit start/end and activating actor;
- an early stop stores timestamp, actor and mandatory reason;
- activation/deactivation and their `AuditLog` row share one serializable transaction;
- the permission defaults to `SUPER_ADMIN` and remains distinct from ordinary SalesDay/device management;
- day −1 evidence continues to come from dated `ErpOutboxCommand` rows and the encrypted device queue; emergency mode does not delete or accept commands;
- migration `0044` is not deployed to the configured production database.
## SalesDay feature controls

Migration `0045_salesday_feature_controls` additively defines `SalesDayFeatureFlag` and the `salesday.settings.manage` and `salesday.integration.monitor` permissions.

Critical rules:

- `scopeKey` is the unique deterministic identity for a feature/scope/target combination;
- global, country, team and user records remain explicit and default disabled;
- target rows reference existing `Team` or `User` records and retain the last updating actor;
- runtime provider, mock-seed and notification-type configuration reuses server-only `AppSetting` key `salesday.runtime.v1`;
- flag/runtime mutation and `AuditLog` creation share one transaction;
- migration `0045` contains no activation rows, runtime seed or business data and is not deployed to the configured production database.

## SalesDay shared business relations

Migration `0046_salesday_business_relations` additively defines the shared customer/prospect root used by SalesDay and Contract.

Critical rules:

- `BusinessRelation` is the canonical customer/prospect identity; SalesDay must not add a separate customer truth;
- contacts, addresses, billing validation and provider-scoped external links are normalized child records;
- external identity is unique by `(provider, externalId)` and never guessed from an unknown legacy source;
- `ContractCustomer.businessRelationId` is an optional unique compatibility bridge;
- existing Contract rows are backfilled without rewriting calculations, letters or signed evidence;
- new Contract customers create their shared relation and compatibility projection in one transaction;
- a pending explicit FieldForce edit is preserved when a competing ERP event arrives;
- migration `0046` is not deployed to the configured production database.

## SalesDay customer operations

Migration `0047_salesday_customer_operations` additively defines `SalesAppointment` and `BusinessRelationChange`.

- `SalesAppointment` provides the server-enforced link between a Representative, the local business date and the customer dossier;
- `BusinessRelationChange` stores old/proposed customer values, validation evidence, device/actor context and the correlated ERP command;
- customer writes, Contract projection updates, audit evidence and the ordered ERP outbox command share a serializable transaction;
- no destructive statement or production seed is present;
- migration `0047` is not deployed to the configured production database.

## SalesDay appointment operations

Migration `0048_salesday_appointment_operations` additively extends `SalesAppointment` with native status, local revision and pending FieldForce-write priority.

- `SalesAppointmentChange` correlates actor/device evidence and old/proposed values with one ERP command;
- `SalesAppointmentOutcomeReason` caches the multilingual, active and country-scoped ERP reason configuration;
- own appointment writes and outcomes are persisted with audit and outbox state in a serializable transaction;
- no destructive statement or production seed is present;
- migration `0048` is not deployed to the configured production database.

# Contactmomenten

Contactmomenten gebruiken het bestaande `Intervention`-model met
`Intervention.type = CONTACTMOMENT`.

Migratie `0026_contact_moment_execution_contract` voegt de uitvoeringsvelden toe
op `ContactMomentDetail`:

- planning- en notifyvelden blijven op `Intervention`;
- onderwerp, type, locatie en interne notitie staan op `ContactMomentDetail`;
- rich-text verslag staat in `reportHtml`;
- definitieve snapshot staat in `finalSnapshot`;
- delen wordt vastgelegd met `sharedAt` en `sharedById`;
- annuleren/niet-uitvoeren wordt vastgelegd met `closedReason`, `closedAt`,
  `closedById` en `previousStatus`;
- `NIET_UITGEVOERD` is toegevoegd aan `InterventionStatus`.

Definitieve snapshots mogen niet worden aangepast door latere wijzigingen aan
actiepunten of gebruikersdata.

---

# Hulpaanvragen

Hulpaanvragen gebruiken het bestaande `HelpRequest`-model als bronrecord.

Migratie `0027_help_request_handling_contract` voegt de behandelingsvelden toe:

- nieuwe canonieke statussen `OPEN`, `BEGELEIDING`, `CONTACTMOMENT`,
  `RETRAINING`, `SALESTRAINING`, `GESLOTEN` en `INGETROKKEN`;
- `responsibleUserId` als server-side bepaalde verantwoordelijke manager;
- `descriptionHtml` en `descriptionText` voor gesaneerde rich-text inhoud en
  zoekbare platte tekst;
- `firstHandledAt` en `firstHandledByUserId` voor de eerste behandeling;
- `withdrawnAt` en `withdrawnByUserId` voor intrekking door de aanvrager;
- het nieuwe `HelpRequestAnswer`-model voor immutable antwoorden.
- Migratie `0028_help_request_open_default` zet de database-default voor nieuwe
  hulpaanvragen op `OPEN`.

Legacy statussen blijven bestaan voor historische records:

- `NIEUW`;
- `VERVOLGACTIE_GEPLAND`;
- `AFGESLOTEN`;
- `GEANNULEERD`.

Regels:

- Een vertegenwoordiger maakt alleen een eigen hulpaanvraag aan.
- De verantwoordelijke wordt niet door de gebruiker gekozen maar uit team- en
  scopegegevens afgeleid.
- Antwoorden worden toegevoegd als afzonderlijke `HelpRequestAnswer`-records en
  mogen niet achteraf worden overschreven.
- Sluiten vereist een antwoord met `closesRequest = true`.
- Gekoppelde opvolging blijft via de bestaande workflowvelden
  `followUpType` en `linkedInterventionId` lopen.

---
