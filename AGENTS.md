# AGENTS.md

# MExT FieldForce — AI Development Rules

## Purpose

This file contains the mandatory repository-wide rules for AI coding agents.

Detailed knowledge belongs in `docs/ai` and `docs/technical`. Do not add screen requirements, temporary defects, backlog items or completed-task history here.

---

# 1. Instruction Resolution

Apply instructions in this order:

1. Platform and safety instructions
2. This `AGENTS.md`
3. The current explicit user request
4. The document that owns the affected topic
5. Existing code and tests

`docs/ai/INDEX.md` is a router, not a business source of truth.

When an explicit request changes documented behaviour, update the code, tests and owning document together. Do not preserve an outdated rule merely because it was documented first.

When code and documentation conflict, determine which reflects the latest approved behaviour. Do not silently choose between material conflicts; report unresolved inconsistencies.

Do not invent missing business behaviour.

---

# 2. Context Selection

Read this file completely. Then use `docs/ai/INDEX.md` to identify the smallest relevant documentation set.

Do not automatically read:

- all files under `docs/ai`;
- all Coaching documents;
- the complete `TODO.md`;
- the complete `07_KNOWN_ISSUES.md`;
- unrelated database or deployment documentation.

Read a TODO or known-issue section only when it matches the task. Broaden context only when the change crosses modules, permissions, lifecycles, shared data, navigation or integrations.

Search narrowly before opening large files or logs.

---

# 3. Change Discipline

Make the smallest maintainable change that fully solves the request.

Prefer existing:

- components and UI patterns;
- services and helpers;
- data entities and relations;
- permission and scope logic;
- workflows and lifecycle handling;
- translations;
- targeted tests.

Avoid unrelated refactoring, speculative abstractions, unnecessary dependencies, broken contracts and parallel sources of truth.

Multiple pages may open the same business object, but must reuse the same record, workflow, lifecycle, permission checks and update path.

---

# 4. Repository Exploration

Start with the narrowest relevant search:

1. Locate the route, component, helper, model, status or permission key.
2. Inspect the smallest relevant section and nearby callers.
3. Inspect related tests.
4. Expand only when required.

Scope or cap commands with potentially large output. Prefer byte caps where supported. Narrow a command before increasing its output.

Avoid unbounded recursive listings, broad searches, full large-file dumps, full logs, full diffs and generated or minified output.

---

# 5. Worktree and Git Safety

Preserve changes you did not make.

Never use destructive commands such as:

- `git reset --hard`
- `git checkout --`
- `git clean -fd`

unless explicitly requested.

Do not discard unrelated uncommitted work.

Do not automatically create a branch, commit, merge, push or deploy. Perform Git write actions only when explicitly requested or approved.

---

# 6. Code and Architecture

Follow the frameworks, versions and conventions already present in `package.json`, the Prisma schema, the codebase and architecture documentation.

Use TypeScript strict typing, Prisma for persistent data, existing Tailwind/shared UI patterns, clear domain naming, simple control flow and explicit error handling.

Avoid:

- `any` without reason;
- inline CSS when an existing pattern applies;
- hardcoded user-facing text;
- hardcoded permissions;
- hidden business calculations;
- comments that only narrate obvious code.

Business calculations must be explicit, reproducible, documented and testable.

---

# 7. Permissions and Scope

MExT FieldForce is permission-driven and scope-driven.

Effective access may depend on role configuration, module activation, user overrides, country scope, team scope, user scope, lifecycle status and workflow rules.

Role behaviour is owned by `docs/ai/03_ROLES.md`. Never infer complete access from a role name alone.

For every protected action:

- validate access server-side;
- restrict queries to effective scope;
- apply least privilege;
- preserve lifecycle locks.

Client-side visibility is not security.

New or changed navigation requires role defaults, user overrides, direct route enforcement, API enforcement, translations and documentation.

---

# 8. Database and Prisma

The Prisma schema and migrations are the database source of truth.

When persistent data changes:

1. Inspect existing models and relations.
2. Confirm the concept is not already stored.
3. Update the schema and create a migration when required.
4. Verify MariaDB/MySQL compatibility.
5. Validate affected queries, permissions and tests.
6. Update owning documentation.

Never manually alter the production schema, duplicate business data unnecessarily, add parallel status fields without a plan or hide schema constraints behind undocumented conventions.

Report pre-existing Prisma or environment failures separately from introduced defects.

---

# 9. UI, Languages and Encoding

Preserve the existing tablet-first, touch-friendly and compact MExT visual language. Reuse existing headers, cards, tables, badges, buttons, dialogs and empty states.

Do not introduce a new visual style unless explicitly requested.

All user-facing text must use the translation system and support Dutch, French and German.

Preserve UTF-8 characters such as `é`, `è`, `ë`, `ç`, `à`, `ü`, `ö`, `ä` and `ß`. Do not convert translated content to ASCII.

---

# 10. Workflows and Lifecycles

Before changing a status, inspect existing variants, visibility, permission locks, notifications, reporting, history and tests.

Do not add a status merely to avoid normalising existing status handling.

Approval belongs to the responsible or coached person defined by the workflow. Do not assume this is always a Representative.

Use the owning module document to determine whether a workflow is `DEFINED`, `PARTIALLY_DEFINED` or `UNDEFINED`. Implement only documented behaviour.

---

# 11. Validation

Match validation to risk and blast radius. Use existing scripts from `package.json`.

For source changes, run the relevant targeted test, `npm run typecheck` and lint where practical.

For permission or scope changes, include relevant permission, menu, data-access and visibility tests.

For workflow, lifecycle or notification changes, include relevant feature tests.

For Prisma, routing, shared configuration or release-level changes, perform broader checks and a production build where practical.

Do not run every test or a full build automatically for trivial changes. Never claim a check passed when it was not run.

When a known environment issue blocks validation, do not repeat the same command indefinitely. Run the best available alternative and report the exact limitation.

---

# 12. Documentation

Update the document that owns the changed topic:

- project vision → `00_PROJECT.md`
- architecture → `01_ARCHITECTURE.md`
- database → `02_DATABASE.md`
- roles and scope → `03_ROLES.md`
- UI → `04_UI_GUIDELINES.md`
- development process → `05_DEVELOPMENT_STANDARDS.md`
- active defects → `07_KNOWN_ISSUES.md`
- module behaviour → relevant module document
- stable decisions → `DECISIONS.md`
- open work → `TODO.md`
- completed work → `history/`

Avoid duplicating full rules across files. Use cross-references.

---

# 13. Local Development Server

Do not start, stop, restart or repeatedly probe the local development server during normal coding tasks.

The user manages it through `keep-fieldforce-dev.ps1`.

Do not spend time on `npm run dev`, repeated port checks, browser launch checks, alternate ports, Node restarts or browser-based visual verification unless explicitly requested.

Allowed validation includes targeted tests, typecheck, lint, relevant Prisma checks and a justified production build.

Deployment and Plesk troubleshooting enter scope only when explicitly requested.

---

# 14. Completion Report

Report:

1. What changed
2. Important files changed
3. Validation performed
4. Documentation updated
5. Remaining risks or unverified behaviour

Keep the summary factual. Do not claim browser, environment or production validation that was not performed.
