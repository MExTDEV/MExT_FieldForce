# Coaching Domain

## Status

Current development priority: `ACTIVE`

## Purpose

The Coaching domain supports planning, execution, documentation and follow-up of field coaching and related management interactions.

The domain must reduce administration, improve follow-up and create one reliable history for each field employee.

---

# Functional Areas

| Functional area | Status |
|---|---|
| Dashboard | DEFINED |
| Mijn Team | DEFINED |
| Planning | DEFINED as shared presentation |
| Begeleidingen | DEFINED |
| Actiepunten | PARTIALLY_DEFINED |
| Contactmomenten | DEFINED |
| Hulpaanvragen | DEFINED |
| Retrainingen | UNDEFINED |
| Salestrainingen | UNDEFINED |
| Rapportage | UNDEFINED |

`PARTIALLY_DEFINED` means only documented behaviour may be implemented.

`UNDEFINED` means screens, fields, statuses, permissions, calculations and workflows must not be invented.

---

# Core Principles

- One business object has one workflow.
- Multiple entry points reuse the same record and logic.
- Navigation is permission-driven.
- Data visibility respects country, team and user scope.
- Lifecycle controls editability.
- The coached or responsible person owns approval where the workflow requires approval.
- Contactmomenten do not require approval.
- Hulpaanvragen are requests for support, not a chat.
- Action points reuse shared action-point concepts.
- Planning displays items but does not own the workflow.
- Documentation must reflect the current approved business decisions.

---

# Core Business Objects

- Intervention;
- Begeleiding;
- Contactmoment;
- Hulpaanvraag;
- Action Point;
- Approval;
- Representative or coached person;
- Coach or responsible manager;
- Team;
- Performance Circle;
- KPI;
- Evaluation Criterion;
- Report;
- Photo attachment;
- Planning item.

Do not duplicate an existing business object because another page opens it.

---

# Documentation Map

## Permanent decisions

- `DECISIONS.md`

## Begeleiding lifecycle

- `FLOW.md`
- `Begeleidingen.md`

## Navigation and calendar

- `Navigation.md`
- `Planning.md`

## Screens and overviews

- `Dashboard.md`
- `MijnTeam.md`
- `Actiepunten.md`

## Defined intervention workflows

- `Contactmomenten.md`
- `Hulpaanvragen.md`

## Undefined areas

- `Retrainingen.md`
- `Salestrainingen.md`
- `Rapportage.md`

## Work tracking

- `TODO.md`
- `history/COMPLETED_2026-Q3.md`

---

# Role Reference

Role and scope behaviour is owned by:

- `docs/ai/03_ROLES.md`

Do not repeat complete role matrices in every Coaching document.

Each functional document should only describe workflow-specific access differences.

---

# Data and Technical Reference

For persistent changes, read:

- `docs/ai/02_DATABASE.md`
- relevant technical database documentation
- the Prisma schema
- existing migrations and data-access tests

The technical schema may contain legacy status variants. Functional documentation defines intended behaviour; migrations and shared helpers must map or normalise technical variants safely.

---

# Current Defined Workflows

## Begeleiding

A structured coaching workflow with:

- planning;
- preparation;
- execution;
- scoring;
- action points;
- approval by the coached person;
- completion and history.

## Contactmoment

A scheduled management interaction without the full Coaching score form.

It contains a report, optional photos and optional user action points.

The report is shared with the target person and then locked.

No approval is required.

## Hulpaanvraag

A Representative asks the responsible Verkoopleider for support.

The manager must process the request and provide or plan follow-up.

It is not a chat and cannot be closed as a simple rejection without a documented outcome.

---

# Current Undefined Workflows

The following require business decisions before implementation:

- Retrainingen;
- Salestrainingen;
- Rapportage definitions and formulas;
- complete Action Point completion, approval, reopening and reassignment lifecycle;
- complete Group Manager defaults;
- complete Service Operator Coaching behaviour.
