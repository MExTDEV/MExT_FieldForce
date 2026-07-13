# Development Standards

## Purpose

This document defines how MExT FieldForce changes are implemented, validated and documented.

Repository-wide mandatory rules remain in the root `AGENTS.md`.

---

# 1. Scope First

Implement the requested functionality.

Do not silently replace the request with a technically preferred alternative.

An improvement may be proposed, but it must not delay or replace the requested scope without approval.

Identify:

- requested behaviour;
- affected business object;
- affected page or API;
- roles and scope;
- lifecycle;
- persistence;
- translations;
- documentation ownership;
- validation risk.

Do not expand the task into unrelated cleanup.

---

# 2. Inspect Before Creating

Before adding code, check whether the project already contains:

- the component;
- the route;
- the form;
- the workflow;
- the entity or relation;
- the permission key;
- the scope helper;
- the translation;
- the calculation;
- the targeted test.

Reuse before creating.

Do not create parallel implementations of the same workflow.

---

# 3. Implementation Quality

Use:

- TypeScript strict typing;
- existing project naming;
- clear domain concepts;
- simple control flow;
- focused functions and components;
- existing UI components;
- shared permission and data-access helpers;
- Prisma for persistent data.

Avoid:

- unrelated refactors;
- speculative abstractions;
- wrapper functions that add no behaviour;
- hidden calculations;
- duplicate state;
- hardcoded user-facing text;
- client-only security;
- broad role checks when effective permissions exist.

---

# 4. Business Logic

Business logic must be:

- explicit;
- traceable;
- testable;
- documented in the owning module document.

When a rule is unclear:

- inspect existing behaviour and tests;
- inspect the owning documentation;
- do not invent a permanent workflow;
- record a true open business decision in TODO when needed.

Do not use TODO as a substitute for an available decision.

---

# 5. Permissions and Scope

Every protected read or write must validate:

- authentication;
- effective permission;
- module activation;
- country scope;
- team scope;
- user scope;
- lifecycle locks.

Client visibility is not access control.

Queries must not retrieve broader data and rely only on client filtering.

When adding navigation or management actions, update role defaults and user overrides.

---

# 6. Database Changes

When the data model changes:

1. inspect existing fields and relations;
2. update `schema.prisma`;
3. create a migration;
4. verify MariaDB compatibility;
5. validate Prisma generation where practical;
6. update affected queries and tests;
7. update database and module documentation.

Do not manually alter production tables.

Do not create duplicate business entities to avoid a proper relation or migration.

---

# 7. UI and Translation

UI changes must preserve:

- tablet-first use;
- touch targets;
- compact information density;
- existing cards, tables, badges and dialogs;
- existing status colours;
- minimal clicks.

All user-facing text must use locale files.

Update Dutch, French and German together unless the owning workflow explicitly supports another language set.

Preserve UTF-8.

---

# 8. Error Handling

User-facing errors must be understandable.

Do not expose:

- stack traces;
- secrets;
- connection strings;
- raw database errors;
- technical identifiers without need.

Validate required fields before persistence where practical.

Permission denials must be clear to the user and logged appropriately.

---

# 9. Validation by Risk

## Low risk

Examples:

- text correction;
- spacing;
- local empty state;
- small presentation-only condition.

Validation:

- focused inspection;
- targeted test when available;
- typecheck or lint when source changed.

A full build is normally unnecessary.

## Medium risk

Examples:

- component behaviour;
- form validation;
- filtering;
- local API behaviour;
- route links.

Validation:

- relevant targeted tests;
- `npm run typecheck`;
- lint;
- broader check only when the shared surface requires it.

## High risk

Examples:

- permissions;
- scope;
- lifecycle;
- approvals;
- shared navigation;
- notifications;
- shared data-access;
- business calculations.

Validation:

- targeted feature tests;
- permission and data-access tests;
- visibility tests;
- typecheck;
- lint;
- broader regression tests where shared behaviour changed.

## Database or release-level risk

Examples:

- Prisma schema;
- migrations;
- production startup;
- broad routing;
- release preparation.

Validation:

- Prisma or migration checks;
- relevant data-access tests;
- typecheck;
- lint;
- production build where practical;
- deployment checks only when deployment is in scope.

---

# 10. Existing Test Scripts

Use the existing scripts in `package.json` rather than creating ad hoc broad test commands.

Relevant categories include:

- workflow;
- dashboard attention;
- header todos;
- notifications;
- planning items;
- performance;
- PDF reports;
- personal criteria;
- modules;
- data access;
- fiche visibility;
- action-point overview and targets;
- Coaching visibility and persistence;
- menu rights;
- management log;
- import/export;
- authentication and sessions;
- KPI settings;
- team leader optionality;
- API persistence;
- database verification.

Choose the smallest set that covers the changed behaviour.

---

# 11. Known Environment Failures

A failed validation command must be classified:

- introduced by the current change;
- pre-existing code failure;
- known local environment issue;
- unavailable dependency or service.

Do not repeatedly run the same blocked command without changing the investigation.

Use the best available alternative and report the limitation.

The known Windows Prisma query-engine file lock may block full generation or `npm run build`. It is not proof that Next.js compilation failed.

---

# 12. Local Server

Normal coding completion does not include starting or probing the local development server.

The user manages it through `keep-fieldforce-dev.ps1`.

Manual browser validation is performed by the user unless explicitly requested and available.

---

# 13. Documentation

Update only the documents whose owned subject changed.

Do not duplicate full rules across files.

Use:

- `DECISIONS.md` for stable business decisions;
- `TODO.md` for open work;
- `07_KNOWN_ISSUES.md` for active defects and recurring technical risks;
- `history/` for completed implementation history.

A resolved issue should not remain labelled as confirmed open.

An implemented module should not remain labelled undefined.

---

# 14. Definition of Done

A task is complete when the relevant conditions are satisfied:

- requested behaviour implemented;
- scope not silently expanded;
- existing architecture reused;
- permissions and data scope correct;
- lifecycle correct;
- translations complete;
- persistent changes migrated correctly;
- relevant checks run;
- introduced defects resolved;
- documentation updated;
- remaining risk reported.

Git commit, merge, push and deployment are separate actions and require explicit approval.

---

# 15. Completion Report

Report:

- change summary;
- important files;
- tests and checks;
- documentation updates;
- remaining limitations.

Do not claim checks that were not performed.
