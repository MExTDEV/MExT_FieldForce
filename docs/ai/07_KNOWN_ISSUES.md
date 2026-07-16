# Known Issues

## Purpose

This document contains active defects, recurring technical risks and unresolved implementation limitations.

It does not contain:

- completed feature history;
- normal development principles;
- future business requirements;
- resolved issues that no longer require verification.

Use the Coaching TODO for planned work and module documents for undefined business behaviour.

---

# Status Legend

## Confirmed Open

The issue is reproducible or known to remain unresolved.

## Recurring Risk

The issue may recur because of the environment or architecture.

## Historical / Verify

The issue occurred previously. Verify only when working in the affected area.

---

# Development Environment

## Windows Prisma query-engine file lock

Status: `Recurring Risk`

Symptoms:

- `prisma generate` or the `prebuild` step may fail because the Windows query-engine file is locked;
- `npm run build` may stop before Next.js compilation.

Rules:

- determine whether the failure occurs before or during Next.js build;
- do not report the application build as a code failure when only Prisma generation is blocked;
- use an approved alternative such as existing generated client types or `prisma generate --no-engine` when appropriate;
- do not repeatedly rerun the same blocked command;
- report the limitation.

Latest verification:

- 2026-07-13: `npm run db:generate` failed before Prisma Client generation with
  `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`.
- `npm run build` was not repeated because `prebuild` would rerun the same
  blocked `prisma generate` step before Next.js compilation.
- `npm run typecheck` passed with the existing generated client.
- 2026-07-13 after applying `0029_contact_moment_private_photos`: the same
  `npm run db:generate` rename-lock recurred. Build remains unverified for the
  same local environment reason.
- 2026-07-13 follow-up: the lock holder was the FieldForce `next dev --port
  3000` process tree. After user-approved stop of that devserver, `npm run
  db:generate` and `npm run build` both succeeded. This remains a recurring
  local-development risk whenever the devserver has the Prisma engine loaded.

## Local development server

Status: `Externally Managed`

The local development server is managed by the user through:

- `keep-fieldforce-dev.ps1`

AI coding agents must not:

- start;
- stop;
- restart;
- repeatedly probe;
- change ports during normal work.

This rule overrides old historical notes that asked an AI to verify or restart port 3000.

---

# Test Harness

## API persistence script has no authenticated session

Status: `Confirmed Open`

`npm run test:api-persistence` calls protected API routes without establishing an authenticated test session. It currently fails first on `/api/representatives` with `Aanmelden is vereist.`

Required direction:

- keep the production API authentication requirement intact;
- make the harness create a supported authenticated test context;
- keep this script outside source-only release gates until that harness setup is deterministic.

Latest verification: reproduced on 2026-07-16 during the SalesDay Milestone 0 baseline.

## Database verification script depends on absent STEP9 fixtures

Status: `Confirmed Open`

`npm run test:db-verification` expects at least two STEP9 runs with four interventions each. A normal developer database is not guaranteed to contain that scenario, so the script currently fails its fixture-count assertion.

Required direction:

- provide deterministic test seeding or a dedicated prepared integration database;
- do not insert hidden fixtures into an arbitrary developer or production-like database;
- keep the script outside source-only release gates until setup and teardown are explicit.

Latest verification: reproduced on 2026-07-16 during the SalesDay Milestone 0 baseline.

---

# Coaching Lifecycle

## Multiple approval-like technical statuses

Status: `Confirmed Open`

The code and schema contain multiple approval-related status variants, including concepts corresponding to:

- `WACHT_OP_AKKOORD`;
- `VERZONDEN_TER_AKKOORD`;
- approved/finalised states.

Risk:

- filters, notifications, visibility and approval buttons may treat variants differently.

Required direction:

- document the functional lifecycle;
- map technical legacy statuses explicitly;
- normalise shared status helpers before removing or migrating a legacy status;
- do not add another status variant as a workaround.

## Pending Approval and Completed locks

Status: `Ongoing Rule`

Pending Approval and Completed records are read-only for normal editing.

Changes require the documented lifecycle transition first.

This is a rule, not an unresolved bug.

---

# Notifications

## Browser autoplay restrictions

Status: `Recurring Risk`

Browsers may block the notification sound until the user has interacted with the application.

Required behaviour:

- the visual notification remains available;
- audio failure must not break the notification workflow;
- do not repeatedly play the same unread notification;
- respect reduced-motion and browser restrictions.

## Notification trigger coverage

Status: `Confirmed Open`

Implemented:

- approval request notifications for Begeleidingen.

Not fully defined or implemented:

- generic todo notifications;
- generic message notifications;
- final planning-time notification behaviour for every intervention type.

Do not assume that the reusable notification foundation means all triggers exist.

---

# KPI Management

## KPI code is globally unique

Status: `Known Design Limitation`

The current KPI natural key uses a globally unique code.

Risk:

- the same code cannot be independently created per country without a schema change.

Do not work around this using hidden derived codes or duplicate tables.

A composite natural key requires an approved migration and updated upsert logic.

## KPI migration and configuration seed

Status: `Verify Before Release`

When KPI management schema changes are pending:

- run the approved migration;
- run the configuration seed;
- verify relevant KPI management tests.

Do not assume local code completion means the production schema is updated.

---

# Rich Text Editors

## WYSIWYG cursor reset

Status: `Historical / Verify`

A controlled WYSIWYG editor previously reset cursor position while typing.

When modifying shared rich-text behaviour, verify:

- stable cursor position;
- no reset on every keystroke;
- no content loss;
- correct read-only mode after sharing or lifecycle lock.

---

# Plesk and Production Runtime

## Historical Plesk startup instability

Status: `Historical / Verify`

Production has previously experienced:

- process startup failures;
- 504 responses;
- Node/Plesk configuration issues;
- missing environment variables;
- memory or process problems.

Only investigate this when deployment or production runtime is in scope.

Follow deployment documentation and do not change startup configuration without evidence.

---

# Open Role Definition

## Group Manager

Status: `Confirmed Documentation Gap`

The technical role exists, but its complete business defaults and scope are not yet defined.

Do not treat Group Manager as equivalent to Super Admin.

Use explicit effective permissions until the business definition is completed.

## Service Operator Coaching behaviour

Status: `Confirmed Documentation Gap`

Service Operator may be included as a field employee, but complete Coaching actions are not defined.

Do not invent Coaching creation, approval or management permissions.

---

# Removed Historical Issues

The following are no longer active known issues and belong in implementation history:

- Sales Manager role creation;
- action history location under Beheer → Log;
- basic Actiepunten management implementation;
- optional team leader support;
- basic approval notification implementation;
- role-based Coaching edit consistency fix;
- Country Manager Begeleidingen default and direct API enforcement;
- fiche module filtering implementation.

Reintroduce an item only if a new reproducible defect is found.
