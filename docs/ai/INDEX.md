# MExT FieldForce AI Knowledge Base

## Purpose

This file routes AI coding agents to the smallest relevant documentation set.

It is not a business source of truth.

Always read the root `AGENTS.md` first.

Then use this index to locate the document that owns the affected topic.

---

# Core Documents

## Project vision and roadmap

Read:

- `00_PROJECT.md`

Use for:

- business purpose;
- platform scope;
- roadmap;
- ERP direction;
- target users and devices.

## Architecture

Read:

- `01_ARCHITECTURE.md`

Use for:

- platform and domain boundaries;
- shared versus module-owned concepts;
- documentation ownership;
- integration boundaries.

## Database

Read:

- `02_DATABASE.md`
- relevant technical database documentation under `docs/technical`

Use only when the task affects:

- Prisma;
- persistent entities;
- relations;
- migrations;
- database constraints;
- data ownership;
- business calculations stored in data.

## Roles and permissions

Read:

- `03_ROLES.md`

Use when the task affects:

- role behaviour;
- module activation;
- role permissions;
- user overrides;
- country, team or user scope;
- who may create, view, edit, approve or manage data.

## UI

Read:

- `04_UI_GUIDELINES.md`

Use when the task affects:

- visual patterns;
- layout;
- responsiveness;
- status colours;
- cards, tables, badges or dialogs;
- tablet usability.

## Development process

Read:

- `05_DEVELOPMENT_STANDARDS.md`

Use when the task requires:

- implementation process;
- risk classification;
- Definition of Done;
- validation strategy;
- error handling;
- documentation ownership.

Do not reread the entire file for every trivial task when the relevant rules are already clear from `AGENTS.md`.

## Deployment

Read:

- `06_DEPLOYMENT.md`
- relevant deployment documentation under `docs/technical`

Use only for:

- VPS;
- Plesk;
- Node production startup;
- environment variables;
- production migrations;
- deployment failures.

## Known issues

Read:

- `07_KNOWN_ISSUES.md`

Read only the matching subsystem or failure.

Do not load resolved or unrelated issues as standard context.

---

# Coaching Domain

Start with:

- `modules/Coaching/README.md`

Permanent Coaching decisions:

- `modules/Coaching/DECISIONS.md`

## Workflow and lifecycle

Read:

- `modules/Coaching/FLOW.md`
- the relevant functional-area document
- `03_ROLES.md` when access differs by role or scope
- `02_DATABASE.md` when persistence changes

## Navigation or Planning

Read:

- `modules/Coaching/Navigation.md`
- `modules/Coaching/Planning.md`
- the document for the underlying item type

Planning displays business objects but does not own their workflows.

## Dashboard

Read:

- `modules/Coaching/Dashboard.md`

Add:

- `Navigation.md` when dashboard links or entry points change;
- `03_ROLES.md` when widget visibility or scope changes;
- the relevant item-type document when new workflow data is shown.

## Begeleidingen

Read:

- `modules/Coaching/Begeleidingen.md`

Add:

- `FLOW.md` for lifecycle or approval changes;
- `03_ROLES.md` for access or scope;
- `02_DATABASE.md` for persistence;
- `Planning.md` when scheduling or calendar behaviour changes.

## Mijn Team

Read:

- `modules/Coaching/MijnTeam.md`

Add:

- `03_ROLES.md` for included roles and scope;
- `04_UI_GUIDELINES.md` for visual indicators;
- the relevant module document for fiche content.

## Actiepunten

Read:

- `modules/Coaching/Actiepunten.md`

Add:

- `FLOW.md` when action points are created from a coaching;
- `03_ROLES.md` for management scope;
- `02_DATABASE.md` when action entities or lifecycle states change.

## Contactmomenten

Status: `DEFINED`

Read:

- `modules/Coaching/Contactmomenten.md`

Add:

- `Planning.md` for scheduling;
- `03_ROLES.md` for scope;
- `Actiepunten.md` when a user action point is created;
- database documentation when report, photos or links change.

## Hulpaanvragen

Status: `DEFINED`

Read:

- `modules/Coaching/Hulpaanvragen.md`

Add:

- the target follow-up module when converting a request into a planned action;
- `03_ROLES.md` for escalation scope;
- `Planning.md` when follow-up is scheduled;
- database documentation for status or relation changes.

## Retrainingen

Status: `UNDEFINED`

Read:

- `modules/Coaching/Retrainingen.md`

Do not invent the workflow.

## Salestrainingen

Status: `UNDEFINED`

Read:

- `modules/Coaching/Salestrainingen.md`

Do not invent the workflow.

## Rapportage

Status: `UNDEFINED`

Read:

- `modules/Coaching/Rapportage.md`

Do not invent reporting definitions, formulas or access.

---

# Active Work and History

## Active backlog

Read:

- `modules/Coaching/TODO.md`

Only read the relevant open section.

## Completed implementation history

Read only when historical implementation evidence is required:

- `modules/Coaching/history/COMPLETED_2026-Q3.md`

Completed history is not standard implementation context.

---

# Context Rules

Do not automatically combine every document listed for a module.

Select only what the task actually touches.

Examples:

- a text correction in one screen does not require database or deployment documentation;
- a permission bug does require roles, scope helpers and relevant tests;
- a new Prisma relation does require database rules and the owning business document;
- a deployment failure does not require the complete Coaching documentation set.
