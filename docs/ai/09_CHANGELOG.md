# Changelog

This document records important functional, architectural and documentation decisions for the MExT FieldForce project.

It is not a technical Git commit log.

Use this file to document decisions that affect:

- functional behaviour
- module scope
- user roles
- permissions
- workflows
- architecture
- documentation structure
- AI development rules

---

# 2026-07-10 - Configureerbare criteria met cumulatieve scopes

## Scope foundation and snapshots

Decision:

- Add a generic criterion scope layer instead of building separate scope implementations for KPI's, Kapstok, general evaluation and personality questions.
- Keep existing source tables as source of truth: `KpiDefinition`, `CoachingCriterion` and the new `ConfigurableCriterion`.
- Store concrete scope links in `CriterionScopeLink` with independent sort order per link.
- Resolve applicable criteria from the coached user's current country, team and user id.
- Deduplicate by stable criterion key and display under the most specific applicable scope.
- Create immutable `CoachingCriterionSnapshot` rows for new coachings; do not recalculate existing coachings after later configuration changes.

Impact:

- Migration `0025_configurable_criterion_scopes` adds the new tables and backfills existing KPI, Kapstok, general evaluation and personality criteria.
- Existing historical coachings and scores are preserved.
- Backend selection and snapshot tests are covered by `npm run test:criterion-scopes`.
- Full management UI for editing multiple scope links remains open work.

---

# 2026-07-10 - Rollenbeheer opslagcorrectie

## Permission basis records

Decision:

- Role management must be able to save every configurable permission shown in `/beheer/rollen`.
- The `Permission` basis table is kept aligned with the role-management permission keys.
- Missing action point, KPI and Coaching menu permission rows are added through migration `0024_seed_missing_permission_basis_records`.
- Runtime management reads may create newly missing permission rows defensively, but must not overwrite saved role rights.
- Saving a role writes only the changed permissions and relevant user override cleanup, not the complete permission matrix.

Impact:

- Fixes the generic save error when a Super Admin adds an extra permission tick to a role such as Sales Manager.
- Reduces remote database transaction work during role save.

---

# 2026-07-10 - Vertegenwoordigersniveaus en Professional/Expert-uitvoering

## Peer coaching foundation

Decision:

- Add representative levels Starter, Sales Executive, Professional and Expert as
  a separate user attribute, not as application roles.
- Allow only active Professional and Expert representatives to be assigned as
  executor for a normal coaching of another representative.
- Keep Professional/Expert representatives unable to create, plan, reschedule,
  cancel or change coaching date/time themselves.
- Require a deviation reason for cross-team or cross-country execution.
- Store peer-coaching metadata on the existing `Intervention`; no second
  coaching module or type is introduced.
- Add safe MAIL TEST foundation with default enabled and central delivery
  logging/deduplication metadata.
- Add the permission-protected MAIL TEST control under `Beheer -> Instellingen`,
  including the current test recipient, server-side persistence, audit logging
  and an explicit `PRODUCTIE` confirmation before production mail is enabled.

Database impact:

- Migration `0023_representative_levels_peer_coaching` adds
  `User.representativeLevel`, `RepresentativeLevelHistory`, peer-coaching fields
  on `Intervention`, `CoachingAction.reviewStatus`, `Holiday`, `AppSetting` and
  `NotificationDelivery`.
- Existing representatives are backfilled to Sales Executive; new
  representatives default to Starter.
- Later scheduler jobs and complete transition UI still need to be wired on top
  of this foundation.

---

# 2026-07-10 - UTF-8 Text Integrity

## Encoding Chain

Decision:

- Treat names and business text as UTF-8 end to end across imports, Prisma, MariaDB and rendering.
- Keep MariaDB database, table and text-column defaults on `utf8mb4`; migration `0022_utf8_database_default_and_aurelie_repair` updates the database default to `utf8mb4_unicode_ci`.
- Reject invalid UTF-8 CSV uploads and CSV content that already contains replacement characters or common mojibake patterns.
- Add `npm run utf8:diagnose` for a repeatable database check covering connection character sets, table and column collations, suspicious stored values and the Aurélie/Milet record.
- Repair only the unambiguous `aurelie.milet@mext.be` record from `Aur�lie Milet` to `Aurélie Milet`.

Database impact:

- No new tables or columns were introduced.
- Existing text columns remain the source of truth.
- Stored data repair is intentionally limited to one identified user record.

---

# 2026-07-08 - Super Admin Management Import/Export

## Beheer CSV Import/Export

Decision:

- Add CSV import/export controls inside the existing Beheer screens for Gebruikers, Teams, KPI's and Kapstok.
- Keep access restricted to `SUPER_ADMIN` server-side and client-side.
- Use the existing `technicalImportExport` permission flag as the visible role-management switch.
- Require validation/preview before committing import data.
- Reuse existing save logic for users, teams, KPI definitions and kapstok records wherever possible.
- Write import audit logs with topic and counts only, without storing full CSV or personal-data dumps.

Database impact:

- No schema migration was introduced.
- Existing entities remain the source of truth: `User`, `Team`, `KpiDefinition`, `CoachingFocus` and `CoachingCriterion`.
- KPI import follows the current global uniqueness of `KpiDefinition.code`.

---

# 2026-07-07 - AI Knowledge Base Foundation

## Documentation Structure

The AI Knowledge Base was structured under:

```text
docs/ai/
```

The Coaching module documentation was structured under:

```text
docs/ai/modules/Coaching/
```

Decision:

- Keep AI documentation separate from technical and user documentation.
- Use AI documentation as the primary reference for Codex and other AI development tools.
- Do not duplicate full technical documentation when a technical source already exists.

---

## Root AI Instructions

A root-level `AGENTS.md` file was introduced.

Purpose:

- define how AI assistants must work inside the project;
- enforce project rules before code changes;
- reduce repeated prompt context;
- keep AI behaviour consistent across future sessions.

Decision:

- `AGENTS.md` remains in the project root.
- Detailed project knowledge remains in `docs/ai/`.

---

## Project Charter

`docs/ai/00_PROJECT.md` was created.

Purpose:

- describe why MExT FieldForce exists;
- define the product vision;
- describe the target users;
- define business objectives;
- document the long-term platform ambition.

Important decision:

MExT FieldForce started as a digital coaching platform but will evolve into the central digital workplace for field employees.

Internal product statement:

> Jouw digitale MExT flexplek.

---

## Architecture

`docs/ai/01_ARCHITECTURE.md` was created.

Decision:

- MExT FieldForce is modular.
- Coaching is the first fully documented and actively developed module.
- Other modules will follow the same architectural principles later.
- Planning is a shared display layer and does not own module workflows.
- Business workflows must not be duplicated.

---

## Database

`docs/ai/02_DATABASE.md` was created.

Decision:

- The application uses Prisma on top of MariaDB.
- The full technical datamodel remains in `docs/technical/database.md`.
- Migration rules remain in `docs/technical/database-development-policy.md`.
- AI documentation must not duplicate the full Prisma schema.
- Business data must follow the Single Source of Truth principle.

---

## Roles

`docs/ai/03_ROLES.md` was created.

Important decision:

Sales Manager is a separate application role.

Role hierarchy and scope:

- Vertegenwoordiger
- Verkoopleider
- Sales Manager
- Country Manager
- Admin
- Super Admin

Decision:

- Sales Manager is not the same as Verkoopleider.
- Sales Manager is not the same as Country Manager.
- Sales Manager can have access to one or more countries.
- Menu visibility is permission-driven through role configuration and user-level overrides.

---

## UI Guidelines

`docs/ai/04_UI_GUIDELINES.md` was created.

Decision:

- Preserve the existing MExT look-and-feel.
- Do not introduce unrelated visual styles.
- Use tablet-first design.
- Maintain compact, high-density, field-friendly screens.
- Primary actions should remain visually clear and consistent.

---

## Development Standards

`docs/ai/05_DEVELOPMENT_STANDARDS.md` was created.

Decision:

- Every change must pass functional, visual and integration validation.
- The requested functionality must be implemented first.
- AI may suggest improvements, but must not replace the original request.
- Build, lint, permissions, UI, database and documentation impact must be checked.
- After development, the application must be verified to run correctly on the expected port.

---

## Deployment

`docs/ai/06_DEPLOYMENT.md` was created.

Decision:

- AI deployment instructions remain high-level.
- Technical server details remain in `docs/technical/vps-deployment.md`.
- Secrets and environment values must never be documented in AI files.
- Webserver and port verification are part of the completion checklist.

---

## Known Issues

`docs/ai/07_KNOWN_ISSUES.md` was created.

Purpose:

- record recurring bugs;
- record known implementation gaps;
- prevent AI assistants from rediscovering the same issues repeatedly.

---

## Prompt Library

`docs/ai/08_PROMPT_LIBRARY.md` was created.

Purpose:

- standardise Codex prompts;
- reduce repeated prompt text;
- force Codex to read the correct documentation before changing code;
- make bugfix, UI, permission, database and deployment prompts reusable.

---

# 2026-07-07 – Coaching Module Documentation

## Coaching README

`docs/ai/modules/Coaching/README.md` was created.

Purpose:

- act as the entry point for all Coaching documentation;
- define which Coaching document to read for each task type.

---

## Coaching Flow

`docs/ai/modules/Coaching/FLOW.md` was created and refined.

Important decisions:

- There is one Coaching workflow.
- A coaching can be opened from multiple places.
- There is only one Coaching Form.
- Pending Approval / Wachten op akkoord is read-only.
- Changes after Pending Approval require withdrawing that status first.
- A coaching is completed only after representative approval.

---

## Coaching Navigation

`docs/ai/modules/Coaching/Navigation.md` was created.

Important decisions:

- Navigation describes functional paths, not technical routes.
- Menu visibility is permission-driven.
- A coaching can be opened from:
  - Dashboard
  - Planning
  - Begeleidingen
  - Mijn Team
- All entry points must open the same Coaching Form.

---

## Dashboard Documentation

`docs/ai/modules/Coaching/Dashboard.md` was created.

Important decisions:

- Dashboard is the primary landing page.
- Nieuwe begeleiding starts the planning flow.
- Actiehistoriek has moved from the Dashboard to Beheer -> Log.
- Today's attention must show all items requiring action.

---

## Begeleidingen Documentation

`docs/ai/modules/Coaching/Begeleidingen.md` was created.

Important decisions:

- Begeleidingen contains:
  - Begeleidingen van vandaag
  - Toekomstige begeleidingen
  - Uitgevoerde begeleidingen
- Empty sections should be hidden.
- Representatives only see planned coachings when notification was enabled.
- Surprise coachings only become visible to representatives from Pending Approval onward.

---

## Mijn Team Documentation

`docs/ai/modules/Coaching/MijnTeam.md` was created.

Important decisions:

- Mijn Team is hidden for representatives.
- Verkoopleiders see only own team.
- Sales Manager, Country Manager and Admin visibility depends on assigned scope.
- Super Admin sees all.
- Rows should later show visual indicators for planned coachings and score status.

---

## Actiepunten Documentation

`docs/ai/modules/Coaching/Actiepunten.md` was created.

Important decisions:

- The functional implementation is not yet completed.
- Action points must support:
  - global scope
  - country scope
  - team scope
  - individual user scope
- Action points must be divided into Open and Afgesloten.
- Detailed business workflow still needs to be confirmed.

---

## Planning Documentation

`docs/ai/modules/Coaching/Planning.md` was created.

Important decisions:

- Planning is a shared calendar view.
- Planning does not own underlying workflows.
- Begeleiding opens the Coaching Form.
- Contactmoment, Retraining, Salestraining and Hulpaanvraag workflows are not yet functionally defined.

---

# Rules for Future Changelog Entries

Add a new changelog entry when:

- a role is added or changed;
- a permission rule changes;
- a workflow changes;
- a module becomes functionally defined;
- a database model changes;
- an integration changes;
- a major UI principle changes;
- a document is added, removed or significantly restructured.

Do not use this file for small code-level changes.

Use Git history for technical commits.
