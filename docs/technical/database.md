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

## Action point management

Scoped action points for the Actiepunten module reuse `ActionDefinition`.

Related tables:

- `ActionDefinition`: global, country, team or user scoped action point definition.
- `action_point_target_types`: seeded target-level configuration for Global, Country, Team and User.
- `action_point_products`: many-to-many link between `ActionDefinition` and existing `Product`.
- `ActionTargetOverride`: optional scoped target override for an action definition.
- `CoachingAction` and legacy `ActionPoint`: concrete workflow-origin action points, kept separate from scoped definitions.

Rules:

- Do not create a second standalone action-point definition table.
- Product links must reference existing `Product` rows.
- Active, in-date `ActionDefinition` records are counted as open scoped action points.
- Concrete workflow action points continue to use their workflow status for open/closed reporting.

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

`Team` is the organisational team record. The assigned primary Verkoopleider is optional:

- `Team.primaryLeaderId` is nullable.
- When it is `NULL`, the team is displayed as having no assigned Verkoopleider.
- Primary leadership join rows in `TeamLeader` are removed when no Verkoopleider is assigned.
- Existing teams with a Verkoopleider keep their relation during migration.
- Field users may remain assigned through `User.teamId` even when the team has no primary leader.
