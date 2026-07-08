# Begeleidingen

## Purpose

The Begeleidingen page is the central overview for coaching sessions within the Coaching module.

It allows users to find, open, review and follow up coachings based on:

- date
- status
- representative
- team
- country scope
- user permissions

The page must support the daily operational work of coaches while also giving management users a controlled overview of coachings within their authorised scope.

---

## Scope

This document describes the functional behaviour of the Begeleidingen page.

It does not describe:

- technical routes
- React components
- database models
- API endpoints

Related documents:

- `FLOW.md` describes the coaching lifecycle and business process.
- `Navigation.md` describes how users navigate to and from Begeleidingen.
- `TODO.md` contains open implementation points.

---

## Main Entry Point

The page is opened through the main navigation item:

**Begeleidingen**

Visibility of this menu item is permission-driven.

Navigation visibility depends on:

- role configuration
- user-level overrides
- effective country/team/user scope

---

## Page Sections

When the Begeleidingen page is opened, coachings are shown in the following order.

---

### 1. Begeleidingen van vandaag

Contains coachings planned for the current day.

Sorting:

- start time ascending

Primary purpose:

- allow coaches to immediately start or continue today's coachings

Navigation behaviour:

- users with edit rights open the coaching input form
- users with view-only rights open preparation/view mode

Current behaviour:

- keep this main section visible when there are no coachings planned for today
- show the existing empty state in the section body

---

### 2. Toekomstige begeleidingen

Contains coachings planned for a future date.

Sorting:

- date ascending
- start time ascending

Primary purpose:

- allow upcoming coachings to be reviewed and, when permitted, adjusted before execution

Navigation behaviour:

For Verkoopleiders and Super Admins:

- opens the same planning/preparation screen used when the coaching was created
- allows changing:
  - representative
  - date
  - start time
  - end time
  - selected focus areas / criteria
- allows viewing preparation information:
  - previous Performance Circle
  - previous scores
  - previous action points
  - other preparation data

For Country Managers, Sales Managers and Admins:

- opens preparation/view mode only
- no form editing
- no planning changes

Current behaviour:

- keep this main section visible when there are no future coachings planned
- show the existing empty state in the section body

---

### 3. Uitgevoerde begeleidingen

Contains historical coachings.

Sorting:

- newest first

Primary purpose:

- allow users to consult completed or previously executed coachings
- allow follow-up through reports, scores and history

Navigation behaviour:

- clicking **Bekijk verslag** opens the coaching report / coaching dossier
- completed coachings open in read-only report mode
- submitted coachings remain locked unless the lifecycle status allows changes

Current behaviour:

- keep this main section visible when there are no historical coachings
- show the existing empty state in the section body

---

## Search and Filters

The page supports searching and filtering coachings within the user's allowed scope.

Available controls:

- search field
- status filter
- period filter

Purpose:

- quickly find coachings without navigating through all countries, teams or users
- reduce administrative search time
- support management users with larger visibility scopes

---

## Opening Modes

The same coaching can be opened in different modes depending on:

- lifecycle status
- user's role
- user's permission scope
- whether the user has edit or view-only rights

---

### Coaching Input Form

Used when a coaching can be executed or edited.

Typical users:

- Verkoopleider for coachings within own team
- Super Admin

Typical usage:

- today's coaching
- incomplete coaching
- coaching that was withdrawn from approval and returned to editable status

---

### Planning / Preparation Edit Mode

Used for future coachings that may still be adjusted before execution.

Typical users:

- Verkoopleider for own team
- Super Admin

Editable items:

- representative
- date
- start time
- end time
- focus areas / criteria

Viewable preparation information:

- previous Performance Circle
- previous scores
- previous action points
- preparation history

---

### Preparation / View Mode

Used when a user may inspect a coaching but may not edit it.

Typical users:

- Country Manager
- Sales Manager
- Admin

Restrictions:

- cannot fill in the coaching form
- cannot modify planning details
- cannot change focus areas
- cannot change representative

---

### Report / Dossier Mode

Used for historical or completed coachings.

Typical usage:

- view completed coaching report
- review coaching history
- inspect scores and action points

Normal behaviour:

- read-only

---

### Representative Approval Mode

Used when a coaching is waiting for representative approval.

Typical user:

- Representative

Representative can:

- read the coaching
- review scores
- review action points
- approve the coaching

Representative cannot:

- open unfinished coachings
- edit coachings
- see surprise coachings before they are submitted for approval

---

## Visibility and Permission Rules

Permission rules for Begeleidingen are role-based and scope-based.

They must also respect user-level overrides.

---

### Vertegenwoordiger

A representative only sees own coachings.

#### Planned coachings

A representative may see planned coachings only when the coach explicitly enabled the notification option during planning.

Business rules:

- if **representative must be informed** was enabled during planning, the representative can see the coaching in:
  - Begeleidingen van vandaag
  - Toekomstige begeleidingen
- if **representative must be informed** was not enabled, the representative must not see the planned coaching

#### Coachings waiting for approval

A representative can see a coaching once it has at least the status:

- Pending Approval / Wachten op akkoord

Business rules:

- representatives cannot open unfinished coachings
- representatives can only open coachings for review/approval once submitted for approval

---

### Verkoopleider

A Verkoopleider sees coachings for people in own team.

Visible sections:

- Begeleidingen van vandaag
- Toekomstige begeleidingen
- Uitgevoerde begeleidingen

Navigation rules:

#### Today

Clicking a coaching planned for today opens the coaching input form.

#### Future

Clicking a future coaching opens the planning/preparation screen.

The Verkoopleider may modify:

- representative
- date
- start time
- end time
- selected focus areas / criteria

The Verkoopleider may also view preparation information:

- previous Performance Circle
- previous scores
- previous action points
- preparation history

#### History

Historical coachings open the coaching report / dossier.

---

### Country Manager

A Country Manager sees coachings within the assigned country scope.

The overview is grouped by:

- country
- team
- user

If the Country Manager only has access to one country, the country grouping should be omitted.

In that case, show only:

- team
- user

Navigation rules:

- today and future coachings open in preparation/view mode
- no editing of the coaching form
- no planning modifications
- historical coachings open in read-only report mode

---

### Sales Manager

Sales Manager is a separate application role.

A Sales Manager is positioned above the Verkoopleider level and can have access to one or more countries.

A Sales Manager sees coachings within the assigned country scope.

The overview is grouped by:

- country
- team
- user

If the Sales Manager only has access to one country, the country grouping should be omitted.

In that case, show only:

- team
- user

Navigation rules:

- today and future coachings open in preparation/view mode
- no editing of the coaching form
- no planning modifications
- historical coachings open in read-only report mode

Business rules:

- Sales Manager is not the same as Verkoopleider
- Sales Manager is not the same as Country Manager
- Sales Manager access must always be based on assigned country scope

---

### Admin

An Admin sees coachings within the assigned country scope.

The overview is grouped by:

- country
- team
- user

If the Admin only has access to one country, the country grouping should be omitted.

In that case, show only:

- team
- user

Navigation rules:

- today and future coachings open in preparation/view mode
- no editing of the coaching form
- no planning modifications
- historical coachings open in read-only report mode

---

### Super Admin

A Super Admin sees all coachings.

The overview is grouped by:

- country
- team
- user

Navigation rules:

- can open coachings with Verkoopleider-level access
- can open today's coachings in the coaching input form
- can open future coachings in the planning/preparation screen
- can open historical coachings in report mode

---

## Representative Notification Logic

The planning flow contains a checkbox that determines whether the representative is informed about the planned coaching.

This checkbox is critical for visibility.

Business rules:

### Notification enabled

If enabled:

- representative sees the coaching before execution
- coaching appears in today's or future sections when relevant

### Notification disabled

If disabled:

- representative must not see the planned coaching
- representative only sees the coaching once it reaches **Wachten op akkoord**

Purpose:

- support announced coachings
- support surprise coachings

---

## Grouping by Scope

For users with broader visibility, coachings are grouped by scope after the existing visibility and permission filtering.

Default grouping:

- country
- team
- user

If a management user has access to only one country:

- hide country grouping
- show only team and user

Super Admin always keeps country grouping, even when the visible data currently contains only one country.

Purpose:

- keep the page compact
- avoid redundant grouping
- reduce visual noise

Applies to:

- Country Manager
- Sales Manager
- Admin
- Super Admin

Does not apply to:

- Verkoopleider
- Vertegenwoordiger

Empty subgroups are not shown. The main Today, Future and History sections remain visible even when they have no rows.

---

## Business Rules

- Begeleidingen is the central overview page for coaching sessions.
- The page must respect role permissions.
- The page must respect user-level overrides.
- The page must respect country and team scope.
- Representatives only see own coachings.
- Representatives only see planned coachings when notification was enabled during planning.
- Representatives must never see surprise coachings before submission for approval.
- Representatives never open unfinished coachings.
- Representatives only open coachings once they are submitted for approval.
- Verkoopleiders can open and edit coachings for their own team.
- Country Managers can view coachings within assigned country scope but cannot edit them.
- Sales Managers can view coachings within assigned country scope but cannot edit them.
- Admins can view coachings within assigned country scope but cannot edit them.
- Super Admins can open coachings with Verkoopleider-level access.
- If a Country Manager, Sales Manager or Admin only has access to one country, country grouping should be hidden.
- Super Admins always keep country grouping.
- Today, future and historical sections remain visible when empty.
- Empty country/team/user subgroups are not shown.
- There is only one coaching form.
- Begeleidingen must never implement a duplicate coaching workflow.

---

## Open Implementation Notes

The following implementation points are tracked in `TODO.md`:

- Score-Based Visual Indicator
- action-point and undefined module follow-ups
- future business clarifications that are explicitly still open
