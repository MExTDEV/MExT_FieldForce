# MExT FieldForce Architecture

## Purpose

This document defines the functional architecture and documentation ownership of MExT FieldForce.

Implementation details belong in the codebase or technical documentation.

---

# Architecture Principle

MExT FieldForce is one modular platform.

Shared platform concepts must not be duplicated inside individual domains.

The architecture is organised into four levels:

1. Platform
2. Domain
3. Functional area
4. Workflow

---

# 1. Platform Layer

The platform layer owns application-wide concepts:

- authentication;
- users;
- teams;
- roles;
- permissions;
- module activation;
- user-level overrides;
- country and team scope;
- languages;
- navigation;
- shared layout;
- audit and session foundations;
- shared notification foundations;
- shared Planning presentation.

A domain must reuse these concepts.

It must not create a private role system, local permission model or alternative navigation source.

---

# 2. Domain Layer

A domain is a major business area.

Current and planned domains include:

- Coaching;
- Salesday;
- Contract;
- Service;
- PST;
- Reporting;
- Administration.

Each domain owns its business objects, workflows and functional documentation.

Domain documentation is stored under:

```text
docs/ai/modules/<Domain>/
```

Coaching is the first fully documented domain and is currently the development priority.

---

# 3. Functional Area Layer

A functional area is a user-facing part of a domain.

Current Coaching functional areas:

- Dashboard;
- Mijn Team;
- Planning;
- Begeleidingen;
- Actiepunten;
- Contactmomenten;
- Hulpaanvragen;
- Retrainingen;
- Salestrainingen;
- Rapportage.

Functional status must be explicit:

- `DEFINED`: business behaviour is sufficiently defined for implementation;
- `PARTIALLY_DEFINED`: only documented behaviour may be implemented;
- `UNDEFINED`: workflow, status, fields or permissions must not be invented.

---

# 4. Workflow Layer

A workflow describes how a business object moves from creation to completion.

Workflow ownership belongs to the underlying business object.

Examples:

- Begeleiding owns its coaching lifecycle;
- Contactmoment owns report creation and sharing;
- Hulpaanvraag owns request processing and follow-up selection;
- Planning only displays scheduled items and opens the owning workflow.

Multiple entry points may open the same record, but they must not duplicate:

- forms;
- status logic;
- permissions;
- calculations;
- approval;
- persistence.

---

# Shared Planning Principle

Planning is a shared calendar presentation.

Planning may display:

- Begeleidingen;
- Contactmomenten;
- Retrainingen;
- Salestrainingen;
- follow-up created from Hulpaanvragen;
- Outlook or external calendar items where configured.

Planning does not own the underlying workflow.

Opening a Planning item must route to the relevant business object.

---

# Shared Permission Principle

Access is determined through shared effective permission and scope logic.

A functional area must not build an isolated role comparison when shared permission helpers exist.

Server-side access and queries must enforce the same effective scope as client navigation.

---

# Shared Data Principle

Business data must have one source of truth.

Before creating an entity, field or relation, verify whether the concept already exists.

Do not duplicate:

- people;
- teams;
- country access;
- action points;
- workflow status;
- approvals;
- notifications;
- KPI definitions;
- products;
- external identifiers.

---

# Integration Boundaries

External integrations must be isolated behind clear interfaces.

Important integrations:

- Microsoft Entra ID;
- Outlook/Microsoft 365;
- Business Central as a transitional source;
- future Odoo integration;
- PDF generation;
- future external reporting or notification services.

Business workflows must not depend directly on one external provider when a reusable integration boundary is practical.

Microsoft profile-photo synchronization belongs to the management profile boundary (`Beheer -> Instellingen -> Profiel`). It uses Microsoft Graph through the server-side profile-photo sync service and must not expose tokens, client secrets or raw Graph responses to the frontend.

---

# Documentation Ownership

Use one owning document per topic.

- project mission and roadmap → `00_PROJECT.md`
- architecture → `01_ARCHITECTURE.md`
- database principles → `02_DATABASE.md`
- roles and scope → `03_ROLES.md`
- UI rules → `04_UI_GUIDELINES.md`
- implementation process → `05_DEVELOPMENT_STANDARDS.md`
- active defects → `07_KNOWN_ISSUES.md`
- domain overview → domain `README.md`
- permanent domain decisions → domain `DECISIONS.md`
- workflow → `FLOW.md` or the owning functional document
- screen behaviour → the relevant screen document
- open work → `TODO.md`
- completed work → `history/`

Avoid repeating complete rules in several documents.

---

# Current Coaching Documentation Map

```text
docs/ai/modules/Coaching/
├── README.md
├── DECISIONS.md
├── FLOW.md
├── Navigation.md
├── Dashboard.md
├── Begeleidingen.md
├── MijnTeam.md
├── Actiepunten.md
├── Planning.md
├── Contactmomenten.md
├── Hulpaanvragen.md
├── Retrainingen.md
├── Salestrainingen.md
├── Rapportage.md
├── TODO.md
└── history/
    └── COMPLETED_2026-Q3.md
```
