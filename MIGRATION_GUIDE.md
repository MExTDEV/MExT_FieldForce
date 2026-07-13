# NEW documentation set

This folder contains proposed replacements and additions for the MExT FieldForce AI documentation.

## Placement

Copy every file from this `NEW` folder to the same relative location in the repository root.

Examples:

- `NEW/AGENTS.md` → `/AGENTS.md`
- `NEW/docs/ai/INDEX.md` → `/docs/ai/INDEX.md`
- `NEW/docs/ai/modules/Coaching/Contactmomenten.md` → `/docs/ai/modules/Coaching/Contactmomenten.md`

Review the changes before copying them over. This set does not modify the repository automatically.

## Main structural changes

1. `AGENTS.md` is reduced to stable repository-wide operating rules.
2. `docs/ai/INDEX.md` becomes the only documentation router.
3. Business rules stay in the document that owns the relevant topic.
4. Completed implementation history is separated from the active Coaching backlog.
5. Contactmomenten and Hulpaanvragen are marked as functionally defined.
6. Retrainingen, Salestrainingen and Rapportage remain explicitly undefined.
7. Group Manager and Service Operator are documented as partially defined roles instead of being silently omitted.
8. Validation is risk-based and uses the existing targeted test scripts.
9. The local development server remains externally managed and must not be started or probed by coding agents.
10. Business Central is documented as a transitional integration; Odoo is the intended future ERP platform for the planned 1 January 2028 go-live.

## Files included

### Repository root

- `AGENTS.md`

### Core AI documentation

- `docs/ai/INDEX.md`
- `docs/ai/00_PROJECT.md`
- `docs/ai/01_ARCHITECTURE.md`
- `docs/ai/03_ROLES.md`
- `docs/ai/05_DEVELOPMENT_STANDARDS.md`
- `docs/ai/07_KNOWN_ISSUES.md`

### Coaching documentation

- `docs/ai/modules/Coaching/README.md`
- `docs/ai/modules/Coaching/DECISIONS.md`
- `docs/ai/modules/Coaching/FLOW.md`
- `docs/ai/modules/Coaching/Navigation.md`
- `docs/ai/modules/Coaching/Dashboard.md`
- `docs/ai/modules/Coaching/Begeleidingen.md`
- `docs/ai/modules/Coaching/MijnTeam.md`
- `docs/ai/modules/Coaching/Actiepunten.md`
- `docs/ai/modules/Coaching/Planning.md`
- `docs/ai/modules/Coaching/Contactmomenten.md`
- `docs/ai/modules/Coaching/Hulpaanvragen.md`
- `docs/ai/modules/Coaching/Retrainingen.md`
- `docs/ai/modules/Coaching/Salestrainingen.md`
- `docs/ai/modules/Coaching/Rapportage.md`
- `docs/ai/modules/Coaching/TODO.md`
- `docs/ai/modules/Coaching/history/COMPLETED_2026-Q3.md`

## Documents intentionally not replaced

The following documents were not rewritten because the investigation did not reveal a material root-level conflict that requires a full replacement:

- `docs/ai/02_DATABASE.md`
- `docs/ai/04_UI_GUIDELINES.md`
- `docs/ai/06_DEPLOYMENT.md`
- technical documentation under `docs/technical`

They should still be reviewed when an implementation changes their owned subject.
