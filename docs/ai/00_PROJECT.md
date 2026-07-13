# MExT FieldForce Project

## Mission

MExT FieldForce is the central digital workplace for M.Ex.T. field employees.

The platform started as a digital Coaching solution and is evolving into one integrated environment for field-related planning, coaching, sales, service, contracts, reporting and future operational workflows.

The goal is not to reproduce paper or legacy software screens. Each workflow should reduce administration, remove duplicate entry and improve follow-up.

---

# Current Development Focus

The current priority is the Coaching domain.

The Coaching domain includes:

- Dashboard;
- Mijn Team;
- Planning;
- Begeleidingen;
- Actiepunten;
- Contactmomenten;
- Hulpaanvragen;
- future Retrainingen;
- future Salestrainingen;
- future Rapportage.

New development should prioritise correct completion of Coaching unless another domain is explicitly requested.

---

# Product Principles

Every feature should support one or more of these objectives:

- fewer user actions;
- less manual administration;
- less duplicate data;
- reliable permissions and scope;
- faster preparation and execution;
- clear follow-up;
- measurable performance insight;
- a consistent multilingual user experience.

Business processes drive the software.

The software should not force the business to preserve an inefficient legacy process without a clear reason.

---

# Target Users

MExT FieldForce serves approximately 100 to 115 active users across:

- Belgium;
- the Netherlands;
- Germany;
- cross-country management.

Primary users are non-technical field employees and their managers.

The platform must remain:

- tablet-first;
- touch-friendly;
- responsive;
- platform-independent;
- efficient over mobile connectivity;
- suitable for temporary connectivity interruptions.

Current devices are mainly Windows tablets.

The application must not depend on Windows-only behaviour because future device choices may include Android tablets or iPads.

---

# Languages and Countries

Supported countries:

- Belgium;
- the Netherlands;
- Germany.

Supported application languages:

- Dutch;
- French;
- German.

Every user-facing workflow must remain translation-ready and UTF-8 safe.

---

# Platform Scope

MExT FieldForce is intended to consolidate field-related tools into one platform with:

- one login;
- one security model;
- one permission system;
- one consistent user experience;
- shared planning concepts;
- shared reporting foundations;
- reusable integrations.

Functional domains may evolve independently, but must use shared platform concepts instead of creating local alternatives.

---

# Authentication and Microsoft 365

Microsoft Entra ID is the preferred authentication method.

Microsoft 365 integration may include:

- authentication;
- Outlook calendar synchronisation;
- notifications or related user context where explicitly defined.

Do not introduce a separate authentication platform without an approved requirement.

---

# ERP and Data Integration Direction

## Transitional environment

M.Ex.T. currently uses an on-premises Business Central/NAV 140 environment as an operational data source.

FieldForce may read Business Central data for:

- customer information;
- appointments;
- sales history;
- products;
- reporting;
- preparation data.

Initial integration is read-oriented. Write scenarios require separate approval and design.

## Future ERP direction

M.Ex.T. plans to migrate from the current Business Central environment to Odoo.

Planned ERP go-live:

- 1 January 2028.

Therefore:

- Business Central integrations should be designed as maintainable transition integrations;
- new FieldForce business logic must not become unnecessarily coupled to Business Central-specific structures;
- integration boundaries should allow future replacement by Odoo APIs or synchronisation processes;
- Odoo is the intended future primary ERP/CRM integration direction.

The exact Odoo integration architecture is not yet defined and must not be invented.

---

# Offline Direction

Offline capability remains a long-term objective.

Do not assume that every current workflow must already work offline.

When designing new functionality:

- avoid unnecessary network traffic;
- avoid hidden dependence on Windows;
- keep data ownership explicit;
- keep future synchronisation possible;
- do not implement an offline architecture without an approved design.

---

# Functional Ownership

Business behaviour is defined by M.Ex.T. management and operational stakeholders.

Internal IT owns the technical design and may propose improvements, but must not silently change approved business scope.

An AI coding agent may identify a better option, but the requested functionality remains the primary scope unless explicitly changed.

---

# Product Statement

MExT FieldForce is the digital workplace for M.Ex.T. field employees.

Internal statement:

> Jouw digitale MExT flexplek.
