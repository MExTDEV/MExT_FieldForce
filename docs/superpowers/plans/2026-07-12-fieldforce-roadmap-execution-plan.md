# FieldForce roadmap execution plan

Date: 2026-07-12
Spec: `docs/superpowers/specs/2026-07-12-fieldforce-roadmap-execution-design.md`
Target roadmap: `ROADMAP-260711.md`

## Constraints

- Do not start, stop, restart, or inspect the local devserver.
- Do not invent undefined business rules.
- Preserve the dirty worktree and do not revert unrelated changes.
- Use existing permissions, translations, workflow helpers, APIs, and components.
- Update documentation and TODO status when an item is resolved or blocked.

## Phase 1 - Create the executable roadmap

1. Read the active TODO sources:
   - `docs/ai/modules/Coaching/TODO.md`
   - `TODO-extra.md`
   - affected Coaching module docs
   - `docs/ai/07_KNOWN_ISSUES.md`
2. Create `ROADMAP-260711.md` with:
   - source summary
   - status legend
   - roadmap item register
   - work-package order
   - execution log format
   - `Nog uit te voeren na deze roadmap-run`
3. Map all `TODO-extra.md` critical items to stable `RM-xxx` IDs.
4. Add Coaching TODO partial/open items that are not already covered.
5. Mark clearly which items are executable, blocked, or externally verifiable.

## Phase 2 - Inventory and foundation verification

1. Check current scripts and package surface.
2. Inspect relevant database migration/schema state for current roadmap items.
3. Inspect permission and i18n helper surfaces for current roadmap items.
4. Run focused low-risk verification where useful:
   - targeted tests for existing completed foundations
   - `npm run typecheck` if the targeted tests do not already reveal blocking compile errors
5. Update roadmap execution logs with findings.

## Phase 3 - Execute defined/high-priority item clusters

For each executable item:

1. Read affected code and docs.
2. Identify exact behavior gap.
3. Add or update a focused test first when changing behavior.
4. Implement the smallest change that satisfies documented behavior.
5. Run the targeted test for that item.
6. Update affected docs and TODO/roadmap entries.

Priority clusters:

1. Notification/mail foundations if the existing code has enough generic models/helpers to extend without inventing a hidden workflow.
2. Hulpaanvragen i18n, visibility, and wizard-link verification.
3. Contactmomenten i18n, filters, visibility, and snapshot/locking verification.
4. Criteria/Kapstok scope-management completeness that is defined by current docs.
5. Professional/Expert lifecycle pieces only where current docs and code define exact transitions.
6. Lint warning cleanup where it is mechanical and low risk.

## Phase 4 - Block undefined or external items explicitly

For every item that cannot be fully executed:

1. Record `Geblokkeerd` or `Extern te valideren`.
2. State the missing business decision, environment access, production credential, manual browser/tablet validation, or deployment condition.
3. Add it to `Nog uit te voeren na deze roadmap-run`.
4. Avoid speculative code.

Expected blocked/external categories:

- Retrainingen and Salestrainingen workflow definition.
- Rapportage product requirements and fixed expected datasets.
- Action-point detail lifecycle decisions.
- Production Outlook/Graph behavior validation.
- Production Entra ID/session validation.
- Database migration status on the target environment.
- Browser/tablet visual acceptance.

## Phase 5 - Final verification

1. Run targeted tests for every item changed in this run.
2. Run `npm run lint` if earlier targeted verification is green enough.
3. Run `npm run build` when feasible, recording known Prisma engine-lock or environment blockers.
4. Ensure `ROADMAP-260711.md` has:
   - every item status updated
   - execution logs
   - final remaining-work list
5. Summarize modified files, tests run, blockers, and next tasks.
