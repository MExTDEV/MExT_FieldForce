# Coaching Module

## Purpose

The Coaching module is the core module of MExT FieldForce.

Its purpose is to support, document and improve the coaching process between sales managers and field representatives.

Rather than digitising paper forms, the module redesigns the complete coaching workflow into a structured digital process.

The Coaching module is currently the primary development focus of the MExT FieldForce platform.

---

## Current Development Focus

The current priority is to complete the Coaching module before expanding the same level of documentation and functional refinement to Salesday, Contract, Service, PST or other future modules.

The Coaching module serves as the reference implementation for future MExT FieldForce modules.

Future modules should reuse the same architectural principles wherever possible:

- permission-driven navigation
- role-based visibility
- user-level overrides
- shared Planning concepts
- consistent MExT look-and-feel
- single source of truth for business workflows

---

## Objectives

The Coaching module has the following objectives:

- reduce administrative workload;
- improve coaching quality;
- standardise coaching across countries;
- track personal progress over time;
- automatically calculate coaching results;
- generate Performance Circles;
- create and monitor action points;
- build a complete coaching history;
- support reporting and KPI analysis;
- reduce duplicate data entry;
- make coaching follow-up more reliable.

---

## Target Users

The Coaching module is used by different user groups. Each group has different visibility, permissions and responsibilities.

Primary operational users:

- Verkoopleider
- Vertegenwoordiger

Management and oversight users:

- Country Manager
- Sales Manager
- Admin
- Super Admin

Additional operational users may exist depending on module configuration, such as Service Operator.

For detailed role and permission rules, see:

- `docs/ai/03_ROLES.md`
- `Navigation.md`
- `TODO.md`

---

## Role Notes

### Vertegenwoordiger

A representative mainly sees own information, own coachings and own action points.

Representatives do not see the `Mijn Team` main menu item.

A representative may only see a planned coaching before execution when the coach explicitly enabled the notification option during planning.

If that option was not enabled, the representative may only see the coaching once it reaches `Wachten op akkoord`.

---

### Verkoopleider

A Verkoopleider is responsible for the own team.

A Verkoopleider can plan, execute and follow up coachings for representatives within the own team.

---

### Country Manager

A Country Manager can view data within the assigned country scope.

The Country Manager has management visibility but does not normally fill in coaching forms or modify planned coachings.

---

### Sales Manager

Sales Manager is a separate application role.

A Sales Manager is positioned above the Verkoopleider level and can have access to one or more countries.

A Sales Manager is not the same as Verkoopleider and not the same as Country Manager.

Navigation and data visibility must be based on assigned country scope.

---

### Admin

An Admin can view and manage data within the assigned country scope, depending on configured permissions.

---

### Super Admin

A Super Admin can see all countries, teams and users.

For coaching access, the Super Admin can open items with the same operational access level as a Verkoopleider where needed.

---

## Functional Scope

The Coaching module currently contains the following functional areas:

- Dashboard
- Mijn Team
- Planning
- Begeleidingen
- Actiepunten
- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage

Not every functional area is fully defined or implemented yet.

The following modules are still under business discussion and must not be implemented based on assumptions:

- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage

For undefined modules, AI assistants must ask for clarification before inventing screens, statuses, fields, workflows or permissions.

---

## Core Business Objects

The Coaching module revolves around the following business objects:

- Coaching
- Representative / Vertegenwoordiger
- Coach / Verkoopleider
- Customer Visit / Afspraak
- Action Point / Actiepunt
- Performance Circle / Prestatiecirkel
- Evaluation Criteria
- Focus Area / Focusfase
- Coaching Report / Verslag

These objects are reused throughout the module and should not be duplicated.

---

## Core Workflow Summary

A coaching follows this functional lifecycle:

1. planned;
2. opened or started;
3. filled in through the coaching form;
4. saved as incomplete if not finished;
5. submitted for representative approval;
6. approved by the representative;
7. completed and included in history, reporting and future comparisons.

The detailed process is documented in:

- `FLOW.md`

Important rules:

- there is only one coaching workflow;
- there is only one coaching form;
- a coaching may be opened from multiple locations;
- multiple entry points must not create duplicate business logic;
- `Wachten op akkoord` is read-only;
- changes after `Wachten op akkoord` require withdrawing that status first.

---

## Main Navigation Summary

The Coaching module uses permission-driven navigation.

Menu visibility is determined by:

- role configuration;
- user-level overrides.

The main navigation concepts are documented in:

- `Navigation.md`

Important navigation rules:

- Dashboard is the primary entry point.
- Nieuwe begeleiding starts the coaching planning flow.
- Planning displays scheduled items but does not own the underlying workflows.
- Begeleidingen is the central overview of coaching sessions.
- Mijn Team provides access to visible field employees and their fiche.
- Actiepunten provides access to open and closed action points.
- A coaching can be opened from Dashboard, Planning, Begeleidingen and Mijn Team.
- Every entry point must open the same coaching form.

---

## Integrations

The Coaching module integrates with:

### Microsoft Entra ID

Used for authentication.

MExT Microsoft accounts are preferred over separate application credentials.

---

### Microsoft Outlook

Used for calendar synchronisation of planned coachings.

When a coaching is planned, it should appear in the coach's Outlook calendar.

---

### Planning

Planning is a shared calendar concept.

It displays scheduled items and opens the related form.

Planning itself does not own the underlying business objects.

---

### PDF Export

Used for coaching reports, preparation exports and historical documentation.

---

### Reporting

Used for coaching history, score evolution, Performance Circles and management insight.

Detailed reporting requirements are still under business discussion.

---

### Business Central

Future integration.

Business Central data may later support preparation, customer history, sales data, products and reporting.

---

## Design Principles

The Coaching module follows the general MExT FieldForce principles.

Most important principles:

- customer-first development;
- tablet-first user experience;
- one source of truth;
- minimal administration;
- high information density;
- fast navigation;
- consistent MExT look-and-feel;
- no duplicated business workflows;
- no hidden calculations;
- no permission expansion without explicit request.

---

## Documentation Index

Use the following documents depending on the task.

### Start here

- `README.md`  
  Overview of the Coaching module.

### Workflow changes

- `FLOW.md`  
  Complete business workflow and lifecycle of a coaching.

### Navigation changes

- `Navigation.md`  
  Functional navigation, entry points and permission-driven visibility.

### Dashboard changes

- `Dashboard.md`  
  Dashboard purpose, widgets, role visibility and dashboard-specific behaviour.

### Begeleidingen changes

- `Begeleidingen.md`  
  Central overview of coachings, sections, role visibility and open modes.

### Mijn Team changes

- `MijnTeam.md`  
  Team overview, grouping, employee fiche navigation and visual indicators.

### Actiepunten changes

- `Actiepunten.md`  
  Action point overview, types, open/closed sections and scope visibility.

### Planning changes

- `Planning.md`  
  Calendar behaviour and item-to-form navigation.

### Open work and backlog

- `TODO.md`  
  Open implementation items, missing business decisions and future corrections.

---

## AI Usage Instructions

When an AI assistant receives a task related to the Coaching module, it must first determine the type of task.

### If the task changes a workflow

Read:

1. `README.md`
2. `FLOW.md`
3. `Navigation.md`
4. the relevant screen document
5. `TODO.md`

---

### If the task changes a screen

Read:

1. `README.md`
2. the relevant screen document
3. `Navigation.md`
4. `TODO.md`

---

### If the task changes permissions

Read:

1. `README.md`
2. `Navigation.md`
3. `docs/ai/03_ROLES.md`
4. the relevant screen document
5. `TODO.md`

---

### If the task concerns an undefined module

Do not invent missing behaviour.

Ask for business clarification first.

Undefined modules currently include:

- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage

---

## Current Open Areas

The following areas are not yet fully defined or implemented:

- functional implementation of Actiepunten;
- detailed Contactmomenten workflow;
- detailed Retrainingen workflow;
- detailed Salestrainingen workflow;
- detailed Hulpaanvragen workflow;
- detailed Rapportage requirements;
- Sales Manager role creation and permission configuration;
- full representative notification logic for announced versus surprise coachings;
- exact action point detail workflow;
- score threshold configuration for visual indicators.

See:

- `TODO.md`

---

## Future Evolution

The Coaching module will remain the functional reference for future modules.

New modules should reuse its architecture, navigation principles, permission model and user experience wherever possible.

The long-term goal is to make MExT FieldForce the central digital workplace for all field employees.
