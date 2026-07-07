# MExT FieldForce Architecture

This document describes the functional architecture of MExT FieldForce for AI-assisted development.

It explains how the application is organised into domains, modules and shared workflows.

It does not describe React routes, database models, API endpoints or component implementation details. Those belong in technical documentation or module-specific files.

---

# Architecture Principle

MExT FieldForce is built as a modular platform.

Although the long-term goal is one integrated platform for all field-related tools, every functional domain must be designed and documented as a standalone business domain.

The first fully developed domain is **Coaching**.

Other domains will follow the same architectural principles later.

---

# Platform Vision

MExT FieldForce is intended to become the central digital workplace for M.Ex.T. field employees.

Internal product statement:

> Jouw digitale MExT flexplek.

The platform will eventually group multiple operational tools into one application.

Expected platform domains:

- Coaching
- Salesday
- Contract
- Service
- PST
- Reporting
- Administration

Current development focus:

- Coaching

All new architectural decisions must support the current Coaching implementation while keeping future domains possible.

---

# Architecture Layers

MExT FieldForce should be understood in four functional layers.

## 1. Platform Layer

The platform layer contains application-wide concepts.

Examples:

- authentication
- user management
- roles
- permissions
- menu visibility
- module activation
- language selection
- workspace context
- shared layout
- global navigation

These concepts are not owned by Coaching.

They are shared by the entire MExT FieldForce platform.

---

## 2. Domain Layer

A domain is a large business area inside MExT FieldForce.

Examples:

- Coaching
- Salesday
- Contract
- Service
- PST

Each domain must have its own documentation under:

```text
docs/ai/modules/<Domain>/
```

For example:

```text
docs/ai/modules/Coaching/
```

---

## 3. Module / Functional Area Layer

Inside each domain, functionality is divided into functional areas.

For Coaching, the functional areas are:

- Dashboard
- Navigation
- Planning
- Begeleidingen
- Mijn Team
- Actiepunten
- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage

Only functional areas that are defined by the business may be implemented.

Undefined workflows must not be invented by AI assistants.

---

## 4. Workflow Layer

A workflow describes how a business process moves from start to finish.

In Coaching, the most important workflow is the coaching lifecycle:

```text
Planning
→ Preparation
→ Execution
→ Incomplete / Pending Approval
→ Representative Approval
→ Completed
→ History / Reporting
```

Workflow documentation belongs in:

```text
docs/ai/modules/Coaching/FLOW.md
```

---

# Current Domain: Coaching

Coaching is currently the primary development focus of MExT FieldForce.

The Coaching domain supports the digitalisation of sales coaching between representatives and their managers.

The domain includes:

- planning coachings
- executing coaching forms
- scoring focus areas
- tracking customer visits
- creating action points
- generating reports
- following up approval by representatives
- building historical performance insight

Reference documentation:

```text
docs/ai/modules/Coaching/README.md
docs/ai/modules/Coaching/FLOW.md
docs/ai/modules/Coaching/Navigation.md
docs/ai/modules/Coaching/TODO.md
```

---

# Coaching Documentation Map

The Coaching module documentation is structured as follows.

```text
docs/ai/modules/Coaching/
├── README.md
├── FLOW.md
├── Navigation.md
├── Dashboard.md
├── Begeleidingen.md
├── MijnTeam.md
├── Actiepunten.md
├── Planning.md
└── TODO.md
```

## README.md

Purpose:

- entry point for the Coaching documentation
- explains what the Coaching module is
- lists related documents
- tells AI assistants which document to read for which task

## FLOW.md

Purpose:

- describes the complete coaching business workflow
- defines the coaching lifecycle
- explains status transitions
- defines core business rules

## Navigation.md

Purpose:

- describes how users navigate inside Coaching
- defines entry points to existing coachings
- explains which pages open which workflows
- describes permission-driven navigation

## Dashboard.md

Purpose:

- documents the Coaching dashboard
- explains widgets, actions and role-based visibility

## Begeleidingen.md

Purpose:

- documents the coaching overview page
- explains today, future and historical coachings
- describes how different roles can open coachings

## MijnTeam.md

Purpose:

- documents the team overview
- explains scope-based visibility
- describes navigation to employee fiches

## Actiepunten.md

Purpose:

- documents the intended action point overview
- marks which parts still need business clarification

## Planning.md

Purpose:

- documents Planning as a calendar view
- explains that Planning displays items but does not own the underlying workflows

## TODO.md

Purpose:

- contains open implementation tasks
- contains missing business clarifications
- contains known gaps between intended behaviour and current implementation

---

# Navigation Architecture

Navigation visibility is permission-driven.

Menu items are not hardcoded per role.

Visibility is determined by:

- role configuration
- user-level overrides
- module activation
- effective permission scope

Business rules:

- Each main navigation item must be configurable at role level.
- Each main navigation item must support user-level override.
- A user only sees navigation items allowed by the effective permission model.
- Adding a new main navigation item requires corresponding permission configuration.

Reference:

```text
docs/ai/modules/Coaching/Navigation.md
```

---

# Role Architecture

The application uses role-based access with scope-based visibility.

Current and intended roles:

- Vertegenwoordiger
- Verkoopleider
- Sales Manager
- Country Manager
- Admin
- Super Admin

Important distinction:

- Sales Manager is a separate application role.
- Sales Manager is positioned above Verkoopleider.
- Sales Manager can have rights to one or more countries.
- Sales Manager is not the same as Country Manager.
- Sales Manager is not the same as Verkoopleider.

Permissions must never be hardcoded directly in UI logic.

All visibility must follow the effective permission model.

Detailed role definitions belong in:

```text
docs/ai/03_ROLES.md
```

---

# Shared Planning Architecture

Planning is a shared calendar concept.

Planning may display items originating from different functional areas.

In the current Coaching scope, Planning can display:

- Begeleiding
- Contactmoment
- Retraining
- Salestraining
- Hulpaanvraag

Planning does not own these objects.

Planning only displays them and opens the correct related workflow.

Business rule:

- Clicking a Planning item must open the correct source form.
- Planning must not duplicate the business logic of the source module.

Reference:

```text
docs/ai/modules/Coaching/Planning.md
```

---

# Single Workflow Principle

A business workflow must exist only once.

Multiple pages may link to the same workflow, but no page may implement duplicate logic.

Example:

A coaching can be opened from:

- Dashboard
- Planning
- Begeleidingen
- Mijn Team

But every entry point must open the same coaching form and the same coaching record.

Business rule:

- Do not create separate coaching forms per entry point.
- Do not duplicate coaching business logic.
- Preserve status, permissions and approval rules regardless of entry point.

---

# Data Ownership Principle

Before creating new data structures, verify whether equivalent information already exists.

Business data should have one source of truth.

Examples:

- Planning displays a coaching but does not own the coaching.
- Dashboard displays action point counts but does not own action points.
- Mijn Team displays representative status but does not own scoring logic.
- Begeleidingen displays coaching history but does not own reporting logic.

Duplicate business data must be avoided.

---

# Integration Architecture

MExT FieldForce integrates with external systems where needed.

Current or intended integrations:

## Microsoft Entra ID

Used for authentication.

Separate application credentials should be avoided.

## Microsoft Outlook

Used for calendar synchronisation of planned coachings.

## PDF Export

Used for coaching reports and preparation exports.

## Business Central

Future source for commercial and customer-related data.

Business Central integration is part of the broader roadmap and must not be assumed unless explicitly specified.

---

# Undefined Functional Areas

Some Coaching-related areas exist as intended modules but are not yet fully defined.

These include:

- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage

AI assistants must not invent missing workflows, statuses, fields or calculations for these areas.

If a request touches one of these areas and the workflow is not documented, the missing business requirement must be clarified first.

Reference:

```text
docs/ai/modules/Coaching/Navigation.md
docs/ai/modules/Coaching/TODO.md
```

---

# Documentation Architecture

The AI documentation under `docs/ai` is the primary knowledge base for AI-assisted development.

Current structure:

```text
docs/ai/
├── INDEX.md
├── 00_PROJECT.md
├── 01_ARCHITECTURE.md
├── 02_DATABASE.md
├── 03_ROLES.md
├── 04_UI_GUIDELINES.md
├── 05_DEVELOPMENT_STANDARDS.md
└── modules/
    └── Coaching/
```

Related documentation outside `docs/ai` may exist under:

```text
docs/business/
docs/modules/
docs/technical/
docs/user/
```

AI assistants should use `docs/ai` as the primary entry point and follow references to other documentation only when needed.

---

# AI Reading Order

For Coaching tasks, AI assistants should read documentation in this order.

## General project task

1. AGENTS.md
2. docs/ai/INDEX.md
3. docs/ai/00_PROJECT.md
4. docs/ai/01_ARCHITECTURE.md

## Coaching task

1. AGENTS.md
2. docs/ai/modules/Coaching/README.md
3. docs/ai/modules/Coaching/FLOW.md
4. docs/ai/modules/Coaching/Navigation.md
5. relevant page document
6. docs/ai/modules/Coaching/TODO.md when implementing open items

## Permission or visibility task

1. docs/ai/03_ROLES.md
2. docs/ai/modules/Coaching/Navigation.md
3. relevant page document

## Database task

1. docs/ai/02_DATABASE.md
2. docs/technical/database.md
3. Prisma schema

## UI task

1. docs/ai/04_UI_GUIDELINES.md
2. relevant page document
3. existing UI implementation

---

# Architecture Rules for AI Assistants

- Do not duplicate business workflows.
- Do not create parallel forms for the same business object.
- Do not hardcode permissions.
- Do not introduce new menu items without permission configuration.
- Do not invent undefined module behaviour.
- Do not duplicate business data.
- Always preserve the existing look-and-feel.
- Always check whether the requested change affects role visibility.
- Always check whether the requested change affects documentation.

---

# Current Architecture Status

The platform architecture is modular and currently centred around Coaching.

Coaching has a documented foundation:

- module overview
- business flow
- navigation
- dashboard
- coaching overview
- team overview
- action points
- planning
- implementation TODOs

Future domains such as Salesday, Contract, Service and PST should follow the same documentation and architecture approach when they become active development priorities.
