# Dashboard

## Scope

This document describes the functional behaviour of the Coaching Dashboard.

It describes:

- purpose of the dashboard
- visible dashboard actions and widgets
- navigation targets
- permission and visibility principles
- known open implementation points

It does not describe technical routes, React components, database models or API endpoints.

---

## Purpose

The Dashboard is the primary landing page of the Coaching module.

It gives users an overview of:

- today's priorities
- planned coachings
- open action points
- coachings waiting for approval
- upcoming activities
- team status
- management indicators, where applicable

The Dashboard should minimise the number of clicks required to start the daily work.

Business principle:

- The Dashboard is an entry point.
- The Dashboard must not duplicate the business logic of the modules it links to.
- Clicking dashboard items should open the correct underlying workflow or overview.

---

## Primary Users

The Dashboard is available for every authenticated user.

The exact information shown depends on:

- role configuration
- user-level overrides
- country scope
- team scope
- module permissions

Navigation visibility is permission-driven.

---

## Main Action

### Nieuwe begeleiding

Purpose:

Starts the workflow to create and schedule a new coaching.

Target:

- Coaching planning flow

Reference:

- FLOW.md → Flow 1 – Planning a Coaching
- Navigation.md → Dashboard Navigation → Nieuwe begeleiding

Default visibility:

Visible for users who are allowed to create coachings, including:

- Verkoopleider
- Country Manager
- Sales Manager
- Admin
- Super Admin

Not visible for:

- Vertegenwoordiger

Business rule:

A representative must not be able to create a new coaching from the Dashboard.

---

# Dashboard Widgets

## Vandaag vraagt aandacht

Purpose:

Display the operational items that require attention today.

Expected behaviour:

The widget should contain two sections:

- Uit te voeren
- Uitgevoerd

It should automatically display every activity scheduled for the current day.

Examples of items that may appear:

- coachings planned for today
- contact moments planned for today
- retrainings planned for today
- sales trainings planned for today
- support requests planned for today

Current implemented behaviour:

- The Dashboard displays a dedicated **Aandacht vereist** card.
- The card is split into:
  - Uit te voeren
  - Uitgevoerd
- Items are loaded from the same visible workflow state used by Planning and Begeleidingen.
- Begeleidingen, Contactmomenten, Retrainingen, Salestrainingen and Hulpaanvragen are shown when they already exist as visible today-items in the application.
- `Wachten op akkoord` is shown under **Uitgevoerd** because it represents an executed coaching submitted for approval.
- Undefined module workflows are not implemented from the Dashboard.

TODO reference:

- TODO.md → Dashboard → Aandacht vereist

---

## Geplande begeleidingen

Purpose:

Displays the number of planned coachings that have not yet been executed.

Target:

- List of planned, not yet executed coachings

Navigation:

Selecting this tile opens the overview of all coachings that have been scheduled but not yet executed.

Reference:

- Navigation.md → Dashboard Navigation → Geplande begeleidingen

---

## Open actiepunten

Purpose:

Displays action points that are still open.

Target:

- Action point overview

The list must support grouping or filtering by:

- country
- team
- individual representative

Reference:

- Navigation.md → Dashboard Navigation → Open actiepunten
- Actiepunten.md

---

## Verslagen wachtend op akkoord

Purpose:

Displays coaching reports that are waiting for representative approval.

Target:

- Approval overview

The overview must support grouping or filtering by:

- country
- team
- individual representative

Business rule:

Overdue approval requests must also be included.

Reference:

- Navigation.md → Dashboard Navigation → Verslagen wachtend op akkoord
- FLOW.md → Coaching Lifecycle → Pending Approval

---

## Aandacht vereist

Purpose:

Displays or opens items requiring follow-up.

Target:

- Attention overview

This includes:

- items scheduled for today
- overdue coachings waiting for approval
- coachings that were started but not completed

Business rule:

This widget should provide a daily operational overview of everything requiring action.

Current implemented behaviour:

- Today-items are shown directly on the Dashboard in **Uit te voeren** and **Uitgevoerd** sections.
- Clicking a row opens the existing related workflow when an implemented target exists and the user is allowed to open it.
- Representative surprise-coaching visibility remains governed by the shared coaching visibility rules.

Reference:

- Navigation.md → Dashboard Navigation → Aandacht vereist
- TODO.md → Dashboard → Aandacht vereist

---

## Eerstvolgende momenten

Purpose:

Displays future scheduled moments.

Sorting:

- nearest date first

Expected behaviour:

Selecting an item should open the related object when applicable.

Examples:

- coaching
- contact moment
- retraining
- sales training

Business rule:

The Dashboard only links to the related object. It must not implement separate workflow logic for these activity types.

Reference:

- Navigation.md → Dashboard Navigation → Eerstvolgende momenten

---

## Team in beeld

Purpose:

Displays visible team members and their status.

Target:

- Team overview / representative overview

Expected behaviour:

Team members are visually marked based on status.

Business rules:

- If a user has an open issue requiring attention, the visual status should indicate this.
- If a representative has an overdue approval request, the representative should be marked red.
- The representative role badge should indicate how the representative is currently scoring.
- The initials badge should indicate whether action is expected from the current user.

Reference:

- Navigation.md → Dashboard Navigation → Team in beeld
- MijnTeam.md

---

## Team Heatmap

Purpose:

Provides a management overview of coaching activity and risks.

Default visibility:

Visible for management users when effective permissions allow it.

Typically visible for:

- Sales Manager
- Country Manager
- Admin
- Super Admin

Not visible by default for:

- Vertegenwoordiger
- Verkoopleider

Business rule:

This widget is a management widget and must not be shown to users without management dashboard permissions.

---

## Coaching Trends

Purpose:

Displays coaching trends within the selected scope.

Default visibility:

Visible for management users when effective permissions allow it.

Typically visible for:

- Sales Manager
- Country Manager
- Admin
- Super Admin

Not visible by default for:

- Vertegenwoordiger
- Verkoopleider

Business rule:

Trend data must respect the user's country and team visibility scope.

---

## Management Alerts

Purpose:

Highlights exceptional situations requiring management intervention.

Default visibility:

Visible for management users when effective permissions allow it.

Typically visible for:

- Sales Manager
- Country Manager
- Admin
- Super Admin

Not visible by default for:

- Vertegenwoordiger
- Verkoopleider

Business rule:

Management alerts must only include items within the user's effective permission scope.

---

## Actiehistoriek

Purpose:

Actiehistoriek is no longer part of the operational Dashboard.

Target:

- Beheer -> Log

Current dashboard behaviour:

- the Dashboard does not render the Actiehistoriek card
- no empty Actiehistoriek placeholder is shown

Current implemented behaviour in Beheer -> Log:

- the existing ActivityHistoryCard/table/data source is reused
- filtering by date, team and representative remains available
- pagination is available
- 15 items are shown per page
- existing filters remain active while navigating pages
- direct route and API reads require effective `menu.coaching.log`

Architecture note:

Action history is not part of the operational dashboard workflow.
It belongs in the administrative logging section.

Reference:

- Navigation.md -> Beheer -> Log
- TODO.md -> Dashboard -> Actiehistoriek

---

# Visibility Summary

Dashboard widgets may be visible or hidden depending on the effective permission model.

Effective visibility is determined by:

- role permissions
- user-level overrides
- module activation
- country scope
- team scope

General principles:

- Representatives see only their own relevant coaching information.
- Representatives do not see the **Nieuwe begeleiding** action.
- Representatives and Verkoopleiders do not see management widgets by default.
- Management widgets are intended for users with management scope.
- Every widget must respect the user's country, team and user visibility scope.

---

# Related Documents

- Navigation.md
- FLOW.md
- TODO.md
- MijnTeam.md
- Begeleidingen.md
- Actiepunten.md
- Planning.md

---

# AI Implementation Notes

When changing the Dashboard:

- Do not duplicate business workflows inside the Dashboard.
- Dashboard elements must route to existing overviews or forms.
- Respect role configuration and user-level overrides.
- Respect country and team scope.
- Keep management widgets separate from operational user widgets.
- Do not show the **Nieuwe begeleiding** action to representatives.
- Keep TODO items in TODO.md and not as hidden assumptions in code.
- If a dashboard tile opens a coaching, it must open the existing Coaching Form.
