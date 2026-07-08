# Actiepunten

## Purpose

The Actiepunten page is the central overview for action points within the Coaching module.

It must show every action point that applies to the current user, based on the effective permission scope of that user.

Action points can apply at different levels:

- Globaal
- Land
- Team
- Persoonlijk

The objective of the page is to make follow-up visible, structured and actionable.

---

## Current Status

The Actiepunten page has a first functional read-only overview.

Implemented behaviour:

- visible action points are shown in two sections:
  - Open
  - Afgesloten
- each item displays a type badge:
  - Globaal
  - Land
  - Team
  - Persoonlijk
- visibility respects active module configuration, effective permissions, role defaults, user-level overrides and country/team/user scope.

Current data source:

- the overview uses existing `ActionDefinition` data for global, country, team and personal scoped action points.
- `active` is currently used for the Open/Afgesloten split because the final action-point close workflow and `closedAt` semantics are not defined yet.

The detailed business process still needs to be discussed with the business.

Until the business rules are confirmed, AI assistants must not invent missing workflow details.

---

## Main Navigation

The page is accessed through the main navigation item:

**Actiepunten**

When the user opens this menu item, the page displays all action points that apply to the user's effective permission scope.

The page is visible only when:

- the Actiepunten module is active
- the user has effective `modulePreparation`
- the user has effective `menu.coaching.actionPoints`

---

## Action Point Types

Each action point belongs to one scope type.

### Globaal

Applies to all relevant users.

### Land

Applies to users within a specific country.

### Team

Applies to users within a specific team.

### Persoonlijk

Applies to one specific user.

---

## Page Sections

Action points must be shown in two main sections.

### Open

Contains active action points that still require follow-up.

### Afgesloten

Contains completed or closed action points.

---

## Visual Indicators

Each action point must display a badge indicating its type.

Required badges:

- Globaal
- Land
- Team
- Persoonlijk

Purpose:

The user must immediately understand why the action point is visible and what scope it belongs to.

---

## Action Point Details

Clicking an action point does not currently open an edit or action workflow.

The detail view should eventually show all relevant information about the selected action point.

The exact detail view behaviour still needs to be defined with the business.

Open business questions:

- Which fields are shown in the detail view?
- Who can edit an action point?
- Who can close an action point?
- Can an action point be reopened?
- Can an action point be reassigned?
- Can an action point expire?
- Can an action point require approval?
- Can an action point originate outside a coaching?

---

## Visibility Rules

Action point visibility is permission-driven.

The page must respect:

- role configuration
- user-level overrides
- country scope
- team scope
- individual user scope

---

### Vertegenwoordiger

A Vertegenwoordiger only sees action points that apply to the representative.

This includes:

- global action points when the module and permission allow it
- personal action points assigned to the representative

A Vertegenwoordiger does not see:

- team action points
- country action points
- personal action points of other users

---

### Verkoopleider

A Verkoopleider sees action points that apply to:

- own country
- own team
- users in own team

A Verkoopleider does not automatically see action points outside own team.

---

### Country Manager

A Country Manager sees action points that apply to the assigned country scope.

This includes:

- country action points
- team action points within the assigned country
- personal action points for users within the assigned country

---

### Sales Manager

Sales Manager is a separate application role.

A Sales Manager is positioned above the Verkoopleider and can have access to one or more countries.

A Sales Manager sees action points that apply to the assigned country scope.

This includes:

- global action points, when applicable
- country action points for assigned countries
- team action points within assigned countries
- personal action points for users within assigned countries

Business rule:

Sales Manager is not the same as Verkoopleider and must not be treated as a team-level role.

---

### Admin

An Admin sees action points that apply to the assigned country scope.

This includes:

- country action points
- team action points within assigned countries
- personal action points for users within assigned countries

---

### Super Admin

A Super Admin sees all action points.

---

## Business Rules

- Action points can exist at multiple scope levels.
- Supported scope levels are:
  - global
  - country
  - team
  - individual user
- Action points must be divided into:
  - open
  - closed
- Each action point must clearly show its type.
- Users must only see action points that apply to their effective permission scope.
- The current overview is read-only.
- Clicking an action point does not create, edit, close, approve, expire or reassign it.
- The detailed action point workflow still needs to be defined with the business.

---

## AI Implementation Rules

AI assistants must not implement missing action point workflow details based on assumptions.

Before implementing functional changes, clarify:

- who can create action points
- who can edit action points
- who can close action points
- whether action points require approval
- whether action points can expire
- whether action points can be reassigned
- whether action points can originate outside a coaching
- which fields are mandatory
- which statuses are required

---

## Related Documentation

- Navigation.md — Actiepunten Navigation
- TODO.md — Actiepunten open implementation items
- FLOW.md — Coaching flow and action point creation during coaching
