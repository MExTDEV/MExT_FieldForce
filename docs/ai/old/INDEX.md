# MExT FieldForce AI Knowledge Base

This folder contains the AI-facing documentation for the MExT FieldForce project.

The purpose of this knowledge base is to help AI assistants understand the project before analysing or changing code.

This documentation describes the intended business behaviour, architecture, roles, UI principles and module workflows.

It does not replace the source code or the technical documentation, but it defines the functional and architectural context in which code changes must be made.

---

# Reading Order

AI assistants must read the documentation in the correct order.

## 1. Project Rules

Read first:

- `../../AGENTS.md`

Purpose:

Defines mandatory AI behaviour, development rules and implementation principles for the project.

---

## 2. Project Context

Read next:

- `00_PROJECT.md`

Purpose:

Explains why MExT FieldForce exists, what business problem it solves, who uses it and what the long-term product vision is.

---

## 3. Architecture

Read next:

- `01_ARCHITECTURE.md`

Purpose:

Explains the functional architecture of MExT FieldForce, the modular setup and the current focus on the Coaching domain.

---

## 4. Roles and Permissions

Read next:

- `03_ROLES.md`

Purpose:

Explains the official application roles, visibility scope and permission-driven navigation.

Important roles:

- Vertegenwoordiger
- Verkoopleider
- Sales Manager
- Country Manager
- Admin
- Super Admin

Important rule:

Sales Manager is a separate role and must not be treated as a synonym for Verkoopleider or Country Manager.

---

## 5. UI Guidelines

Read next:

- `04_UI_GUIDELINES.md`

Purpose:

Defines the MExT FieldForce look-and-feel, layout principles, visual status indicators, badges, buttons, cards, tables and tablet-first UI rules.

---

## 6. Development Standards

Read next:

- `05_DEVELOPMENT_STANDARDS.md`

Purpose:

Defines the development workflow, Definition of Done, quality expectations, business logic principles and validation requirements.

---

## 7. Database Guidelines

Read when a task touches data, Prisma, migrations, permissions or business entities:

- `02_DATABASE.md`

Purpose:

Defines AI-facing database rules, data ownership principles, single source of truth expectations and links to the detailed technical database documentation.

---

# Module Documentation

Modules are documented separately under:

- `modules/`

The current primary module is:

- `modules/Coaching/`

The Coaching module is the current development focus of MExT FieldForce.

---

# Coaching Documentation

When working on the Coaching module, start with:

- `modules/Coaching/README.md`

Then read the relevant supporting document depending on the task.

## Coaching Core Documents

- `modules/Coaching/README.md`
- `modules/Coaching/FLOW.md`
- `modules/Coaching/Navigation.md`
- `modules/Coaching/TODO.md`

## Coaching Screen Documents

- `modules/Coaching/Dashboard.md`
- `modules/Coaching/Begeleidingen.md`
- `modules/Coaching/MijnTeam.md`
- `modules/Coaching/Actiepunten.md`
- `modules/Coaching/Planning.md`

---

# When to Read Which Coaching Document

## Dashboard changes

Read:

1. `modules/Coaching/README.md`
2. `modules/Coaching/Dashboard.md`
3. `modules/Coaching/Navigation.md`
4. `modules/Coaching/TODO.md`
5. `03_ROLES.md`
6. `04_UI_GUIDELINES.md`

---

## Begeleidingen changes

Read:

1. `modules/Coaching/README.md`
2. `modules/Coaching/Begeleidingen.md`
3. `modules/Coaching/FLOW.md`
4. `modules/Coaching/Navigation.md`
5. `modules/Coaching/TODO.md`
6. `03_ROLES.md`
7. `02_DATABASE.md` if data or status logic is affected

---

## Mijn Team changes

Read:

1. `modules/Coaching/README.md`
2. `modules/Coaching/MijnTeam.md`
3. `modules/Coaching/Navigation.md`
4. `modules/Coaching/TODO.md`
5. `03_ROLES.md`
6. `04_UI_GUIDELINES.md`

---

## Actiepunten changes

Read:

1. `modules/Coaching/README.md`
2. `modules/Coaching/Actiepunten.md`
3. `modules/Coaching/FLOW.md`
4. `modules/Coaching/Navigation.md`
5. `modules/Coaching/TODO.md`
6. `03_ROLES.md`
7. `02_DATABASE.md` if action point storage or visibility is affected

---

## Planning changes

Read:

1. `modules/Coaching/README.md`
2. `modules/Coaching/Planning.md`
3. `modules/Coaching/Navigation.md`
4. `modules/Coaching/FLOW.md`
5. `03_ROLES.md`
6. `02_DATABASE.md` if scheduling, status or synchronisation data is affected

---

## Coaching workflow or lifecycle changes

Read:

1. `modules/Coaching/README.md`
2. `modules/Coaching/FLOW.md`
3. `modules/Coaching/Navigation.md`
4. `modules/Coaching/Begeleidingen.md`
5. `modules/Coaching/TODO.md`
6. `03_ROLES.md`
7. `02_DATABASE.md`

---

# External Technical Documentation

Detailed technical documentation is located under:

- `../technical/database.md`
- `../technical/database-development-policy.md`
- `../technical/entra-authentication.md`
- `../technical/mariadb-migration-roadmap.md`
- `../technical/vps-deployment.md`

Use these documents when a task requires technical details about:

- database structure
- Prisma and MariaDB
- migrations
- authentication
- Entra ID
- deployment
- VPS/Plesk

---

# Documentation Rules

## Do Not Guess

If a module, workflow, permission rule, calculation or status is not documented, do not invent it.

Ask for clarification or mark the requirement as undefined.

---

## Keep Documentation Updated

Update documentation whenever changes affect:

- architecture
- permissions
- role behaviour
- navigation
- lifecycle states
- database structure
- business calculations
- module workflows
- UI patterns

---

## Source of Truth

When documentation and assumptions conflict, documentation wins.

When documentation and code conflict, verify the intended behaviour before changing code.

When business behaviour is unclear, ask for clarification before implementation.

---

# Current Focus

The current development focus is:

- Coaching

Future modules such as Salesday, Contract, Service and PST will be documented later.

Do not apply Coaching-specific workflow assumptions to future modules unless explicitly documented.
