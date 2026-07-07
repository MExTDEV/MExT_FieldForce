# AGENTS.md

# MExT FieldForce - AI Development Guide

## Purpose

This document defines the mandatory development rules for every AI assistant working on the MExT FieldForce project.

Every AI must read this document before analysing or modifying the codebase.

This file is the root instruction document. Detailed project knowledge is stored in `docs/ai`.

If this file and a more detailed document appear to conflict, apply this order:

1. `AGENTS.md`
2. `docs/ai/INDEX.md`
3. `docs/ai/05_DEVELOPMENT_STANDARDS.md`
4. Module-specific documentation
5. Technical documentation in `docs/technical`

Never make assumptions when documentation exists.

---

# Project Overview

MExT FieldForce is an enterprise field coaching and sales platform used by M.Ex.T.

The application supports multiple countries, teams, roles and permission scopes.

Primary goals:

- Digital coaching
- Sales planning
- Performance monitoring
- KPI tracking
- Contract management
- Service management
- Reporting
- Microsoft 365 integration
- Business Central integration

Current development focus:

- Coaching module

Future modules:

- Salesday
- Contract
- Service
- PST
- Offline sales mode

---

# Mandatory Reading Order

Before implementing changes, read the documentation that matches the task.

Always start with:

1. `docs/ai/INDEX.md`
2. `docs/ai/00_PROJECT.md`
3. `docs/ai/01_ARCHITECTURE.md`
4. `docs/ai/05_DEVELOPMENT_STANDARDS.md`

For Coaching-related work, also read:

1. `docs/ai/modules/Coaching/README.md`
2. `docs/ai/modules/Coaching/Navigation.md`
3. `docs/ai/modules/Coaching/FLOW.md`
4. The affected screen document:
   - `Dashboard.md`
   - `Begeleidingen.md`
   - `MijnTeam.md`
   - `Actiepunten.md`
   - `Planning.md`
5. `docs/ai/modules/Coaching/TODO.md`
6. `docs/ai/07_KNOWN_ISSUES.md`

For database work, also read:

- `docs/ai/02_DATABASE.md`
- `docs/technical/database.md`
- `docs/technical/database-development-policy.md`

For deployment work, also read:

- `docs/ai/06_DEPLOYMENT.md`
- `docs/technical/vps-deployment.md`

---

# Technology Stack

Frontend:

- Next.js
- React
- TypeScript
- TailwindCSS
- shadcn/ui

Backend:

- Next.js
- Prisma ORM

Database:

- MariaDB / MySQL

Authentication:

- Microsoft Entra ID

Hosting:

- VPS
- Plesk
- Node.js

---

# General Principles

Always extend existing functionality whenever possible.

Never duplicate components.

Never duplicate business logic.

Never duplicate business workflows.

Keep components reusable.

Keep files small and maintainable.

Always preserve the existing design language.

Always respect the existing permission model.

Multiple pages may open the same workflow, but the workflow itself must exist only once.

---

# Coding Standards

Use:

- TypeScript strict mode
- Prisma ORM
- TailwindCSS
- shadcn/ui components
- Existing shared components where available

Avoid:

- inline CSS
- duplicated code
- unnecessary dependencies
- breaking existing APIs
- hardcoded user-facing text
- hardcoded permissions
- hardcoded business calculations

---

# Database Standards

The database is managed through Prisma.

Whenever the data model changes:

- update Prisma schema
- create a migration
- verify the migration
- update database documentation
- never manually modify the production schema
- never duplicate business data when an existing entity can be reused

Business calculations must be transparent and documented.

Unknown or undocumented calculations must not be implemented.

---

# Roles and Permissions

The application contains role-based and user-overridable permissions.

Permissions must never be hardcoded.

Navigation visibility is permission-driven.

Role configuration defines default access.

User-level overrides may overrule role defaults.

Official roles include:

- Vertegenwoordiger
- Verkoopleider
- Sales Manager
- Country Manager
- Admin
- Super Admin

Important:

- Sales Manager is a separate role.
- Sales Manager is not the same as Verkoopleider.
- Sales Manager is not the same as Country Manager.
- Sales Manager sits above Verkoopleider and can have access to one or more countries.

When adding a new main navigation item, also update:

- role permission configuration
- user-level override configuration
- menu rendering logic
- documentation

See:

- `docs/ai/03_ROLES.md`

---

# UI Principles

Tablet first.

Responsive.

Professional.

Consistent.

Minimal clicks.

High information density.

Fast navigation.

Never introduce a new visual style.

Never change the MExT look-and-feel unless explicitly requested.

Use existing layout patterns, cards, badges, tables, buttons and navigation structures.

See:

- `docs/ai/04_UI_GUIDELINES.md`

---

# Multi-Language

The application supports multiple languages.

Every new UI element must support translation.

Never hardcode user-facing text.

New labels, warnings, buttons, statuses and messages must be translation-ready.

---

# Security

Never expose secrets.

Never expose connection strings.

Never bypass authentication.

Always validate permissions.

Always validate country, team and user scope.

Apply least privilege.

Never broaden access without an explicit request.

---

# Build Quality

Every completed task must leave the project in a buildable state.

Whenever possible, run:

- `npm run lint`
- `npm run build`

Resolve introduced errors.

Do not leave TypeScript, lint or build errors behind.

---

# Documentation

Update documentation when changes affect:

- architecture
- database
- permissions
- navigation
- workflows
- UI rules
- deployment
- module behaviour
- known issues
- TODO items

For Coaching changes, update the affected module document under:

- `docs/ai/modules/Coaching/`

---

# Impact Analysis

Before implementing any change, analyse the impact on the complete application.

Always identify:

- Which functional module is affected?
- Which page or workflow is affected?
- Which user roles are affected?
- Which permission rules are affected?
- Which database entities are affected?
- Which APIs are affected?
- Which related modules could be impacted?
- Which documentation requires updating?
- Whether this change affects navigation, reporting, Planning or Outlook synchronisation.

Never implement changes without understanding their impact on the rest of the application.

---

# AI Behaviour

Before implementing:

1. Understand the request.
2. Read the relevant documentation.
3. Analyse impact.
4. Reuse existing components and business logic.
5. Preserve architecture.
6. Preserve naming conventions.
7. Preserve styling.
8. Preserve permissions.
9. Preserve database integrity.
10. Identify required documentation updates.

After implementing:

- verify visual result
- verify functional result
- verify permissions
- verify database impact
- verify translations
- verify build
- update documentation
- update TODO or Known Issues when relevant

---

# Undefined Requirements

If a module, flow, field, status, permission or calculation is marked as undefined or still under business discussion, do not invent it.

Ask for clarification or document the missing requirement.

This applies especially to:

- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage
- Action point detail workflow
- future offline sales mode

---

# Coaching-Specific Rules

The Coaching module currently has priority.

There is only one coaching workflow.

There is only one coaching form.

A coaching may be opened from multiple entry points:

- Dashboard
- Planning
- Begeleidingen
- Mijn Team

The entry point may differ, but the same coaching record, form, lifecycle and permissions must be used.

Do not duplicate the coaching form or coaching business logic.

Respect lifecycle status:

- Planned
- In Progress
- Incomplete
- Pending Approval / Wachten op akkoord
- Completed

When a coaching is in `Pending Approval / Wachten op akkoord`, it is read-only.

Changes are only allowed after withdrawing the pending approval status.

A coaching is only completed after representative approval.

---

# Git and Integration Workflow

Unless a different workflow is explicitly requested, use the current simple workflow:

1. Implement requested change.
2. Validate visually.
3. Validate functionality.
4. Run build/lint where possible.
5. Merge with main.
6. Push to Git.
7. Verify application startup.

Do not introduce a branch-based workflow unless explicitly requested.

---

# Deployment and Webserver Check

After changes that affect runtime behaviour, verify that the application starts correctly.

The local development webserver must run on port 3000 unless explicitly changed.

If the app does not run on port 3000:

- identify the issue
- stop conflicting processes if needed
- restart the webserver
- verify that the app is reachable

See:

- `docs/ai/06_DEPLOYMENT.md`

---

# Source of Truth

The following documents define the project:

1. `AGENTS.md`
2. `docs/ai/INDEX.md`
3. `docs/ai/00_PROJECT.md`
4. `docs/ai/01_ARCHITECTURE.md`
5. `docs/ai/02_DATABASE.md`
6. `docs/ai/03_ROLES.md`
7. `docs/ai/04_UI_GUIDELINES.md`
8. `docs/ai/05_DEVELOPMENT_STANDARDS.md`
9. `docs/ai/modules/Coaching/README.md`
10. Technical documentation in `docs/technical`

Never make assumptions when documentation exists.

Never ignore explicit business rules in the AI Knowledge Base.
