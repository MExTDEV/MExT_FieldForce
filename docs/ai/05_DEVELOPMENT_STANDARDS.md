# Development Standards

This document defines the development standards for MExT FieldForce.

It applies to every change made by a developer or AI assistant.

The purpose of this document is to keep the application stable, consistent, maintainable and aligned with the business requirements.

---

# Scope

This document describes how work must be executed.

It does not describe:

- business vision
- module workflows
- database schema details
- technical deployment instructions

Related documents:

- `AGENTS.md`
- `docs/ai/INDEX.md`
- `docs/ai/00_PROJECT.md`
- `docs/ai/01_ARCHITECTURE.md`
- `docs/ai/02_DATABASE.md`
- `docs/ai/03_ROLES.md`
- `docs/ai/04_UI_GUIDELINES.md`
- `docs/ai/modules/Coaching/README.md`
- `docs/technical/database-development-policy.md`
- `docs/technical/vps-deployment.md`

---

# Core Design Principles

The following principles define how MExT FieldForce should evolve.

Every new feature, improvement or refactoring must respect these principles.

---

## 1. Business Request First

Artificial Intelligence is encouraged to analyse every request critically and propose improvements.

However, the requested functionality must always be implemented first.

Suggestions should complement the original request, never replace it.

Business rule:

- The AI may advise.
- The AI must not change the scope of the original request without explicit approval.

---

## 2. Consistent User Experience

The visual identity of MExT FieldForce is part of the product.

New functionality must seamlessly integrate into the existing user experience.

Never introduce:

- a different visual language
- a different navigation style
- a different interaction pattern
- inconsistent buttons
- inconsistent cards
- inconsistent colours
- inconsistent status indicators

Reference:

- `docs/ai/04_UI_GUIDELINES.md`

---

## 3. Single Source of Truth

Before creating new data structures, always verify whether equivalent information already exists.

Reuse existing entities whenever possible.

Duplicate business data should be avoided.

Business rule:

- Do not store the same business concept twice.
- Do not create duplicate workflow states.
- Do not duplicate calculations.
- Do not create local alternatives for existing permission logic.

---

## 4. Transparent Business Logic

Business calculations must never become "magic".

Every calculation must be:

- understandable
- traceable
- documented
- reproducible

Hidden assumptions should be avoided.

Whenever complex calculations are introduced, they must be documented.

Examples:

- score calculations
- Performance Circle calculations
- KPI calculations
- status thresholds
- visual score indicators
- overdue calculations

---

## 5. Security First

Permissions must never be broadened without an explicit functional request.

New functionality must respect the existing security model.

Access rights should always follow the principle of least privilege.

Business rule:

- Never grant additional rights implicitly.
- Never make a menu item visible without checking effective permissions.
- Never bypass role or user-level overrides.
- Never expose data outside the user's allowed country, team or user scope.

Reference:

- `docs/ai/03_ROLES.md`

---

## 6. Customer First Development

The application exists to help its users perform their work with the least possible effort.

Whenever multiple solutions are technically possible, the preferred solution is the one that:

- requires the fewest user actions
- is the easiest to understand
- reduces administrative work
- increases productivity
- feels intuitive to first-time users

Technical elegance should never come at the expense of usability.

---

## 7. Think Beyond the Request

Developers and AI assistants are encouraged to identify opportunities for improvement.

Ideas that simplify workflows, reduce administrative effort or improve the user experience should be proposed.

However, such improvements must never delay or replace the requested functionality unless explicitly approved.

---

# Mandatory Impact Analysis

Before implementing any change, analyse the impact on the complete application.

Always identify:

- Which functional module is affected?
- Which page or workflow is affected?
- Which user roles are affected?
- Which permissions are affected?
- Which lifecycle states are affected?
- Which database entities are affected?
- Which API endpoints are affected?
- Which related modules could be impacted?
- Which documentation requires updating?

Never implement changes without understanding their impact on the rest of the application.

---

# AI Implementation Process

For every coding task, the AI assistant must follow this sequence.

## Step 1 - Read Context

Read the relevant documentation before modifying code.

Minimum:

- `AGENTS.md`
- `docs/ai/INDEX.md`

For Coaching tasks:

- `docs/ai/modules/Coaching/README.md`
- relevant screen document
- `docs/ai/modules/Coaching/FLOW.md` when workflow is involved
- `docs/ai/modules/Coaching/Navigation.md` when navigation is involved
- `docs/ai/modules/Coaching/TODO.md` when working from backlog items

---

## Step 2 - Confirm Scope

Identify the exact requested change.

Do not expand the task unless explicitly asked.

If an improvement is useful but outside scope, document it separately or propose it after the requested work.

---

## Step 3 - Analyse Existing Implementation

Before adding new code:

- check whether a component already exists
- check whether a workflow already exists
- check whether a database field already exists
- check whether permission logic already exists
- check whether a calculation already exists
- check whether a route or page already exists

Reuse before creating.

---

## Step 4 - Implement

Implementation must respect:

- existing architecture
- existing UI patterns
- existing permission model
- existing lifecycle states
- existing database conventions
- existing module documentation

---

## Step 5 - Validate

After implementation, validate:

- visual correctness
- functional correctness
- permissions
- data visibility
- calculations
- navigation
- build quality
- documentation updates

---

# Definition of Done

A feature is not considered complete when the code compiles.

Every requested change must pass the following validation stages before it is considered finished.

---

## Stage 1 - Functional Implementation

The requested functionality has been implemented according to the specification.

The original request must always be fulfilled.

---

## Stage 2 - Visual Validation

The implementation is visually reviewed.

Verification includes:

- correct layout
- consistent spacing
- responsive behaviour
- correct colours
- existing MExT look-and-feel
- tablet usability
- no visual regressions on existing screens

Visual issues must be corrected before continuing.

---

## Stage 3 - Functional Validation

The feature is tested in the application.

Verification includes:

- expected behaviour
- navigation
- permissions
- calculations
- error handling
- integration with existing functionality
- lifecycle state behaviour
- role-based and scope-based visibility

Any functional issue must be corrected before release.

---

## Stage 4 - Documentation Validation

Documentation must be updated when the change affects:

- architecture
- database
- roles
- permissions
- navigation
- workflow
- UI rules
- module behaviour
- TODO status

Relevant documentation must be updated before the task is considered finished.

---

## Stage 5 - Integration

Once approved:

- merge into the main branch;
- push to Git;
- verify documentation when applicable.

Local devserver startup, restart and browser validation are not part of AI completion unless explicitly requested.

The local devserver is managed externally using:

```text
keep-fieldforce-dev.ps1
```

A feature is only considered complete after passing all validation stages that are relevant to the requested scope.

---

# Git Workflow

Current practical workflow:

1. Implement the requested change.
2. Perform visual validation.
3. Perform functional validation.
4. Correct issues.
5. Merge into `main`.
6. Push to Git.

Current limitation:

- Feature branches are not yet part of the standard workflow.

Future improvement:

- Introduce a simple feature-branch workflow when the project is ready for it.

Business rule:

- Do not change the Git workflow without explicit approval.
- Do not create complex branching rules unless requested.

---

# Build and Quality Checks

Every completed development task should leave the project in a buildable state.

Whenever possible, run:

```bash
npm run lint
npm run build
```

If the task modifies Prisma or database access, also verify Prisma generation and migrations according to the database policy.

If a build or lint command fails:

- investigate the failure
- fix introduced errors
- do not ignore build errors
- document remaining unrelated errors if they already existed

---

# Database and Prisma Standards

The application uses Prisma on MariaDB.

Reference:

- `docs/ai/02_DATABASE.md`
- `docs/technical/database.md`
- `docs/technical/database-development-policy.md`

Rules:

- Do not manually modify the production schema.
- Use Prisma schema changes for model changes.
- Create migrations when the data model changes.
- Never introduce duplicate business data.
- Never add fields without checking whether the data already exists.
- Never add calculations without documenting them.
- Respect MariaDB compatibility.
- Respect existing naming conventions.

When database changes are required:

1. Update Prisma schema.
2. Create migration.
3. Verify migration.
4. Update database documentation if needed.
5. Verify the application still builds.

---

# Permission Standards

All navigation and data visibility must be permission-driven.

Visibility is based on:

- role configuration
- user-level overrides
- country scope
- team scope
- user scope
- lifecycle status

Rules:

- Never hardcode menu visibility by role when effective permissions exist.
- New main menu items must be configurable through role management.
- New main menu items must support user-level overrides.
- Data queries must respect the user's effective scope.
- Representatives must never see data outside their allowed personal scope.
- Verkoopleiders must only see their own team unless explicitly granted broader rights.
- Sales Managers must be treated as a separate role and may have access to one or more countries.
- Country Managers and Admins are country-scoped.
- Super Admins can see everything.

Reference:

- `docs/ai/03_ROLES.md`

---

# UI Standards

All UI changes must preserve the existing MExT FieldForce look-and-feel.

Reference:

- `docs/ai/04_UI_GUIDELINES.md`

Rules:

- Tablet-first.
- Responsive.
- Touch-friendly.
- Minimal clicks.
- High information density without clutter.
- No unnecessary new UI patterns.
- No new visual style without explicit approval.
- Use existing cards, buttons, badges and tables where possible.
- Use status colours consistently.
- Keep management dashboards readable and compact.

---

# Workflow Standards

Business workflows must never be duplicated.

Multiple pages may open the same workflow, but the workflow itself must exist only once.

Example:

A coaching can be opened from:

- Dashboard
- Planning
- Begeleidingen
- Mijn Team

But all entry points must open the same Coaching Form and use the same business logic.

Rules:

- Do not create duplicate forms for the same business object.
- Do not duplicate lifecycle logic.
- Do not duplicate approval logic.
- Do not duplicate permission checks.
- Do not create parallel workflows unless explicitly requested.

---

# Coaching-Specific Standards

The Coaching module is currently the primary development focus.

Reference:

- `docs/ai/modules/Coaching/README.md`
- `docs/ai/modules/Coaching/FLOW.md`
- `docs/ai/modules/Coaching/Navigation.md`
- `docs/ai/modules/Coaching/TODO.md`

Rules:

- A coaching must have one single workflow.
- A coaching must have one single form.
- A coaching must respect lifecycle status.
- `Wachten op akkoord` / `Pending Approval` is read-only.
- If changes are required after submission, `Wachten op akkoord` must first be withdrawn.
- Completed coachings are locked for normal editing.
- Representative visibility depends on the "representative must be informed" planning checkbox and lifecycle status.
- Action points must not be implemented based on assumptions while the business workflow is not fully defined.
- Undefined modules must not receive invented workflows.

---

# Documentation Standards

Documentation must remain useful for AI assistants and humans.

Rules:

- Keep documents concise.
- Avoid duplicating full content across multiple files.
- Use cross-references instead of repeating large sections.
- Update the document that owns the topic.
- Keep TODO items in TODO files or clearly labelled TODO sections.
- Mark undecided business logic explicitly.
- Do not invent missing requirements.

When a change affects documentation, update the relevant file:

- project vision → `00_PROJECT.md`
- architecture → `01_ARCHITECTURE.md`
- database → `02_DATABASE.md`
- roles / permissions → `03_ROLES.md`
- UI → `04_UI_GUIDELINES.md`
- development process → `05_DEVELOPMENT_STANDARDS.md`
- Coaching workflow → `modules/Coaching/FLOW.md`
- Coaching navigation → `modules/Coaching/Navigation.md`
- Coaching screen behaviour → relevant Coaching screen document
- open implementation work → `modules/Coaching/TODO.md`

---

# Undefined Requirements

If a workflow, permission, calculation or screen behaviour is not defined, do not invent it.

Instead:

- mark it as undefined
- ask for clarification
- add it to TODO if appropriate

This applies especially to:

- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage
- detailed Action Point workflow

---

# Local Development Server

The local development server is not managed by AI assistants.

The devserver is kept alive externally using:

```text
keep-fieldforce-dev.ps1
```

AI assistants must not start, stop, restart or repeatedly check the local devserver during normal development tasks.

AI assistants must not spend time or credits on:

- `npm run dev`
- local devserver startup
- local devserver restart
- browser launch checks
- repeated port 3000 checks
- visual browser validation unless explicitly requested

Allowed validation:

- `npm run lint`
- `npm run build`
- relevant automated tests if available
- Prisma generation or migration checks when database work is explicitly in scope

Manual browser validation is performed by the user unless explicitly requested.

If the local devserver is not running, the user handles this outside Codex using the PowerShell watchdog script.

Production deployment or Plesk troubleshooting may require separate validation, but only when explicitly requested.

Reference:

- `docs/ai/06_DEPLOYMENT.md`
- `docs/technical/vps-deployment.md`

---

# Error Handling Standards

User-facing errors must be understandable.

Rules:

- Do not expose technical stack traces to end users.
- Show clear messages when an action cannot be completed.
- Validate required fields before submission.
- Explain permission-related denials in user-friendly language.
- Log technical details where appropriate.

---

# Management Import/Export Standards

Bulk management import/export is a high-risk administrative workflow.

Rules:

- Keep import/export under the existing management UI; do not create a separate landing page.
- Use CSV unless an approved Excel/XLSX pattern already exists for the same workflow.
- Exports may include inactive records when the actor is a Super Admin.
- Imports must validate and preview before commit.
- Imports must report created, updated, skipped and error counts.
- Imports must show row-level validation errors.
- Imports must reuse existing save and validation logic wherever possible.
- Imports must not create dependent records implicitly unless the business explicitly asks for that behaviour.
- Server-side access must require `SUPER_ADMIN` and the explicit import/export permission.
- Audit logs for imports must contain actor, topic and counts only; do not store complete CSV contents or personal-data dumps.

---

# Performance Standards

Field users often work on tablets with 5G connectivity.

Rules:

- Avoid unnecessary network calls.
- Avoid loading large datasets when filters or pagination are appropriate.
- Use pagination for long tables.
- Keep Dashboard and Planning fast.
- Avoid recalculating expensive statistics unnecessarily.
- Do not block common workflows with slow management widgets.

---

# Final AI Checklist

Before marking a task as complete, verify:

- Was the original request implemented?
- Was the scope not expanded without approval?
- Were existing components reused where possible?
- Were permissions checked?
- Was data visibility checked?
- Were lifecycle rules respected?
- Was the UI consistent?
- Was build/lint checked where possible?
- Was documentation updated?
- Was local devserver management avoided unless explicitly requested?
- Are any remaining open points documented?
