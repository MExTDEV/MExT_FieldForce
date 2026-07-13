# FieldForce roadmap execution design

Date: 2026-07-12
Roadmap target: `ROADMAP-260711.md`
Scope: Coaching TODO inventory, TODO-extra inventory, roadmap creation, item-by-item execution

## Context

The root request refers to `TODO.md` and `TODO-extra.md`. No root `TODO.md` exists in the workspace. The user confirmed that `docs/ai/modules/Coaching/TODO.md` is the intended `TODO.md`.

The project rules in `AGENTS.md` apply first. The Coaching module has priority. Undefined workflows or calculations must not be invented, especially for Contactmomenten, Retrainingen, Salestrainingen, Hulpaanvragen, Rapportage, and action point detail workflow.

## Roadmap model

Create `ROADMAP-260711.md` as an executable roadmap register rather than a free-form wish list.

Each roadmap item must include:

- Stable ID in the `RM-xxx` format.
- Source reference, such as `docs/ai/modules/Coaching/TODO.md`, `TODO-extra.md`, affected module docs, or code observation.
- Status: `Open`, `In uitvoering`, `Afgewerkt`, `Geblokkeerd`, or `Extern te valideren`.
- Impact analysis: module, page/workflow, roles and permissions, database/API, i18n, documentation, tests, and related modules.
- Acceptance criteria.
- Execution log with date, changes, verification, documentation updates, and remaining work.

Already implemented items should be marked as done or to verify; they should not be rebuilt. Contradictory TODO statuses must be made explicit in the roadmap and resolved through verification, not silently overwritten.

## Work package order

Execute work in this order:

1. Inventory and documentation consistency.
2. Foundation: database/migrations/Prisma, permissions, i18n, existing test surface, lint/build baseline.
3. Coaching workflows: Begeleidingen, Planning, Mijn Team, Actiepunten, Hulpaanvragen, Contactmomenten.
4. Integrations and notifications: in-app notifications, email and mail-test router, Outlook/Graph.
5. Undefined modules and flows: Retrainingen, Salestrainingen, Rapportage, and action-point detail workflow.
6. Final documentation, TODO updates, targeted tests, lint, and build where feasible.

## Execution rules

Implementation must reuse existing components, APIs, permission helpers, translations, and workflow logic. There must remain one coaching workflow and one coaching form.

For each executable roadmap item:

- Inspect the relevant code and docs before editing.
- Add or update focused tests when behavior changes.
- Keep permissions configurable and scope-aware.
- Keep user-facing text translation-ready in NL/FR/DE.
- Update affected documentation and TODO status.
- Record what was verified.

For blocked or external items:

- Do not invent missing business rules.
- Record the missing decision, environment, credential, production validation, or manual check.
- Keep the item visible in the final remaining-work list.

## Remaining-work requirement

At the end of `ROADMAP-260711.md`, maintain a section named `Nog uit te voeren na deze roadmap-run`.

Each remaining item must be concrete and include:

- Roadmap ID.
- Task.
- Reason it remains open.
- Owner/type, such as `Businessbeslissing`, `Externe validatie`, `Productiekeuze`, `Handmatige tabletcheck`, or `Later implementeren`.

This section is required even when most executable items are completed.

## Verification policy

Do not start, stop, restart, or inspect the local development server. The user manages it through `keep-fieldforce-dev.ps1`.

Allowed verification includes:

- Targeted scripts from `package.json`.
- `npm run lint`.
- `npm run build`, when feasible.
- Code-level permission, i18n, database, and documentation checks.

Record any verification that cannot be performed and why.
