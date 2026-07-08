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

Prisma is the source of truth for application-level database access.

Database changes must be made through the Prisma schema and migration workflow.

Direct manual schema changes in production are not allowed unless explicitly documented as an exceptional recovery action.

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

The exact technical model must be verified in `docs/technical/database.md` and the Prisma schema.

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

## Action Points

Every completed Coaching must contain at least one action point.

Each action point contains:

- title
- priority
- optional target date
- Tips & Tricks WYSIWYG content

Action points may also exist independently at different scopes, depending on future implementation:

- global
- country
- team
- individual user

The exact standalone Action Point workflow still requires business confirmation.

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
