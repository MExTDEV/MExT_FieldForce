# Coaching TODO

## Purpose

This file contains only active open work and unresolved business decisions.

Completed implementation history belongs in:

- `history/COMPLETED_2026-Q3.md`

Priority:

- High: correctness, security or blocking workflow;
- Medium: required completeness or usability;
- Low: refinement.

---

# Completed 2026-07-13

## Historical score comparison in Begeleiding execution

Status: `Implemented`

Implemented:

- score comparison selector above the execution score area;
- eligible previous Begeleidingen filtered server-side by same coached person, visibility scope, non-cancelled historical status, past date and saved scores;
- read-only historical score columns and textual differences next to current editable scores;
- Performance Circle comparison using the selected historical Begeleiding as dashed previous line;
- Dutch, French and German translations;
- regression script `scripts/test-coaching-historical-comparison.ts`.

Remaining technical debt:

- current appointment score rows still use the persisted category/criterion label as comparison key because the existing appointment score model does not store a stable criterion id.

## Actiepunten sluiten

Status: `Implemented`

Implemented:

- concrete Action Points can be closed with `AFGEROND`, `closedAt` and `closedByUserId`;
- `ActionPointAssignment` stores per-user close state for shared assignments;
- default `actionPointsClose` permission for Verkoopleider, Country Manager, Group Manager, Admin and Super Admin;
- server-side permission and scope checks;
- auditlogging and best-effort in-app notification;
- overview close confirmation, immediate open/closed count update and NL/FR/DE strings;
- regression script `npm run test:action-point-close`.

Remaining technical debt:

- approval, reopen, reassignment, evidence and overdue escalation flows remain business decisions.

---

# High Priority

## Contactmomenten afronden

Status: `Partially implemented`

Reference:

- `Contactmomenten.md`
- root `TODO.md` item `TODO-003`

Open:

- Outlook/Graph-sync external validation with real Microsoft tokens;
- production upload-root acceptance, backup inclusion and restore evidence;
- browser/tablet acceptance for private upload, download, gallery and PDF
  export through the externally managed development/staging environment.

Implemented locally:

- private photo API and immutable shared-gallery behaviour;
- PDF export from the final snapshot through `lib/contact-moment-pdf.ts`;
- regression scripts `npm run test:contact-moments`,
  `npm run test:contact-moment-filters`, `npm run test:contact-moment-pdf`
  and `npm run test:outlook-sync`.
- migration `0029_contact_moment_private_photos` was applied on the checked
  `MExT_FieldForce` database on 2026-07-13 and `npm run db:migrate:status`
  reported the schema up to date.

## Hulpaanvragen afronden

Status: `Partially implemented`

Reference:

- `Hulpaanvragen.md`
- root `TODO.md` item `TODO-004`

Open:

- follow-up links to Contactmoment, Retraining and Salestraining only after those workflows are definitively described;
- extra tests for cancelled wizard without synthetic Begeleiding, hidden follow-up detail leaks and managers outside scope.

## Normalise approval status handling

Status: `Open`

Problem:

- multiple approval-like technical statuses exist.

Required:

- inventory status use;
- define compatibility mapping;
- centralise shared helpers;
- update visibility, notifications, approval buttons and reporting;
- migration plan when legacy data requires it;
- regression tests.

## Complete Group Manager definition

Status: `Business decision required`

Required:

- default country scope;
- global scope behaviour;
- module defaults;
- Coaching create, edit and approval rights;
- management configuration rights;
- relationship to Sales Manager, Admin and Super Admin.

## Complete Service Operator Coaching definition

Status: `Business decision required`

Required:

- inclusion in Mijn Team;
- visible fiche content;
- Coaching target behaviour;
- Contactmoment and Hulpaanvraag behaviour;
- Action Point behaviour.

---

# Medium Priority

## Define Retrainingen

Status: `Business decision required`

Reference:

- `Retrainingen.md`

## Define Salestrainingen

Status: `Business decision required`

Reference:

- `Salestrainingen.md`

## Define Rapportage

Status: `Business decision required`

Reference:

- `Rapportage.md`

## Define remaining Action Point operational lifecycle

Status: `Business decision required`

Required:

- approval;
- reopen;
- reassignment;
- evidence or comments;
- overdue handling.

## Define score threshold configuration

Status: `Business decision required`

Required:

- default good/bad threshold;
- scope of configuration;
- use in Mijn Team visual indicators;
- use in reporting.

## Verify KPI production migration

Status: `Technical verification required`

Required:

- approved migration status;
- configuration seed;
- KPI tests;
- production schema verification.

---

# Low Priority

## Archive completed TODO history regularly

Status: `Ongoing maintenance`

Move completed implementation details into quarterly history documents.

Keep only a short reference in the active TODO when useful.

## Review duplicated documentation

Status: `Ongoing maintenance`

Remove repeated complete role, lifecycle and validation sections from non-owning documents.

Use cross-references.
