# Coaching Flow

This document describes the complete functional workflow of the Coaching module.

The purpose of this document is to describe the intended business process independently from the technical implementation.

It does not describe React routes, components, database models or API endpoints.

---

# Scope

This document covers the lifecycle of a coaching session:

1. Planning a coaching
2. Opening an existing coaching
3. Executing the coaching
4. Saving an incomplete coaching
5. Submitting the coaching for approval
6. Review and approval by the coaching target
7. Final completion and historical use

Related documents:

- `Navigation.md` describes where users can navigate from.
- `Begeleidingen.md` describes the Begeleidingen overview page.
- `Dashboard.md` describes the Dashboard widgets and entry points.
- `Planning.md` describes the calendar behaviour.
- `TODO.md` tracks open implementation points.

---

# Workflow Principles

The Coaching module contains a single coaching workflow.

A coaching may be opened from multiple locations inside MExT FieldForce, but the same coaching form and business logic are always used.

Business workflows must never be duplicated.

## Core Principles

- One coaching record.
- One coaching form.
- One lifecycle.
- Multiple entry points.
- Permission-driven access.
- No separate duplicate forms per page.
- No hidden business logic.
- Status determines what can be viewed, edited or approved.
- A coaching target can be a Vertegenwoordiger or a Verkoopleider when the user's effective permissions allow it.

---

# Roles Used in the Coaching Flow

The Coaching flow uses the following roles.

## Vertegenwoordiger

Field sales representative.

Scope:

- own coachings only
- own action points only
- own approval tasks

## Verkoopleider

Team-level coach / sales leader.

Scope:

- own team only

Main coaching actions:

- plan coachings for representatives in own team
- execute coachings for representatives in own team
- edit planned coachings for own team
- submit coachings for representative approval

Additional rule:

- A Verkoopleider can also be the target of a coaching by a user above Verkoopleider level.

## Country Manager

Country-level management role.

Scope:

- assigned country scope

Main coaching actions:

- view coachings within assigned country scope
- view preparation and reports
- plan and execute coachings on Verkoopleiders within assigned country scope when configured for this role
- no coaching form editing for representative coachings unless explicitly granted by permissions

## Sales Manager

Sales Manager is a separate application role.

A Sales Manager is positioned above the Verkoopleider level and can have access to one or more countries.

Scope:

- assigned country or countries
- teams and users within assigned countries

Main coaching actions:

- view coachings within assigned country scope
- view preparation and reports
- plan and execute coachings on Verkoopleiders within assigned country scope when configured for this role
- no coaching form editing for representative coachings unless explicitly granted by permissions

Business rules:

- Sales Manager is not the same as Verkoopleider.
- Sales Manager is not the same as Country Manager.
- Sales Manager access must respect role configuration and user-level overrides.
- Sales Manager access must respect explicitly assigned country rights; without country rights, no country-scoped Coaching data is visible.

## Admin

Administrative role with access to assigned countries.

Scope:

- assigned countries
- teams and users within assigned countries

Main coaching actions:

- view coachings within assigned scope
- plan and execute coachings on Verkoopleiders within assigned scope when configured for this role
- no coaching form editing for representative coachings unless explicitly granted by permissions

## Super Admin

Global administrator.

Scope:

- all countries
- all teams
- all users

Main coaching actions:

- can open and manage coachings with the same functional access as a Verkoopleider
- can plan and execute coachings on Verkoopleiders across all countries and teams
- can see all coachings

---

# Flow 1 – Planning a Coaching

## Objective

Allow a coach to schedule a new coaching session.

---

## Preconditions

- User is authenticated using Microsoft Entra ID.
- Automatic login is preferred whenever possible.
- Separate application credentials should be avoided.
- User has permission to create coachings.
- User can only select coaching targets within the effective visibility scope.
- Allowed coaching targets are Vertegenwoordigers and, when effective permissions and scope allow it, Verkoopleiders.

---

## Step 1 – Dashboard

The Dashboard is the primary starting point.

The Dashboard displays:

- today's coachings
- pending coachings
- pending action points
- approval items
- other relevant information

The primary action is:

**Nieuwe begeleiding** / **New Coaching**

Business rule:

- This action is not visible for representatives.
- Visibility is permission-driven and may depend on role configuration and user-level overrides.

---

## Step 2 – Schedule Coaching

The scheduling wizard opens.

The coach selects:

- date
- start time
- end time

The coach decides whether the representative should be informed in advance.

Current implementation:

- The checkbox exists.

Required behaviour:

- If enabled, the representative may see the planned coaching before execution.
- If disabled, the representative must not see the planned coaching before it is submitted for approval.

Open implementation note:

- The full notification workflow still needs to be implemented.

---

## Step 3 – Target Person Selection

The coach selects the person who will be coached.

Selection hierarchy:

Country  
→ Team  
→ Person

Allowed target roles:

- Vertegenwoordiger
- Verkoopleider, when the user is functionally above the Verkoopleider and the effective permissions allow it

Visibility depends on permissions and scope.

### Verkoopleider

- Own team only.
- Can select representatives in own team.
- Cannot select another Verkoopleider as coaching target unless explicitly allowed.

### Country Manager

- Assigned country scope.
- Must be able to select Verkoopleiders within assigned country scope when the role has coaching creation/execution permission.

### Sales Manager

- One or more assigned countries.
- Must be able to select Verkoopleiders within assigned country scope when the role has coaching creation/execution permission.

### Admin

- Assigned countries.
- Must be able to select Verkoopleiders within assigned country scope when the role has coaching creation/execution permission.

### Super Admin

- All countries.
- Must be able to select Verkoopleiders as coaching target across all countries and teams.

Business rules:

- Users must never be able to select a person outside their effective permission scope.
- Verkoopleiders can be coached by users above Verkoopleider level.
- A Verkoopleider is both a possible coach and a possible coaching target.
- A Vertegenwoordiger must never be able to plan coachings.
- If the user has access to only one country, the interface may omit redundant country selection or grouping where appropriate.

---

## Step 4 – Focus Areas

The coach selects one or more focus areas.

Business rules:

- Minimum: one focus area.
- Maximum: all available focus areas.
- Selected focus areas determine which evaluation criteria appear during the coaching execution.
- The coaching form dynamically adapts to the selected focus areas.

---

## Step 5 – Preparation

The previous coaching and relevant preparation information are displayed.

Available information:

- previous Performance Circle
- previous scores
- previous action points
- preparation history where available

Available actions:

- view preparation information
- export previous Performance Circle or previous coaching information to PDF where supported

Purpose:

- Allow the coach to prepare before starting the new coaching.
- Ensure the new coaching is based on historical performance and previous follow-up.

---

## Step 6 – Confirmation

A summary is displayed.

The coach confirms the planned coaching.

Result:

- The coaching is created.
- The coaching receives the status `Planned`.

Automatic actions:

- visible in Dashboard where applicable
- visible in Planning
- visible in Begeleidingen overview
- synchronized to Outlook Calendar for the coach

Future behaviour:

- If representative notification is enabled, the representative should receive or see the notification according to the final notification workflow.

---

# Flow 2 – Opening an Existing Coaching

## Objective

Allow users to open an existing coaching from any valid entry point without duplicating workflow logic.

---

## Entry Points

A coaching can be opened from multiple functional locations.

### Dashboard

Possible dashboard entry points:

- planned coachings
- attention required
- upcoming moments
- approval items where applicable

Target:

- Coaching Form or report/view mode depending on status and permission.

### Planning

A coaching can be opened from the Planning calendar.

Target:

- Coaching Form or preparation/view mode depending on status and permission.

Business rule:

- Planning displays the coaching as a calendar item.
- Planning does not own the coaching workflow.

### Begeleidingen

A coaching can be opened from the Begeleidingen module.

Examples:

- Begeleidingen van vandaag
- Toekomstige begeleidingen
- Uitgevoerde begeleidingen
- Wachtend op akkoord
- Onvolledige begeleidingen

Target:

- Coaching Form, preparation screen or report mode depending on status and permission.

### Mijn Team

A coaching can be opened from the representative profile.

Path:

Mijn Team  
→ Representative Profile / Fiche  
→ Coaching  
→ Coaching Form or report mode

---

## Business Rule

Regardless of the entry point:

- the same coaching record is opened
- the same coaching form is used
- the same business logic applies
- the same lifecycle status applies
- the same permissions apply

There is only one coaching workflow.

---

# Flow 3 – Executing a Coaching

## Objective

Allow the coach to execute a planned coaching session.

---

## Preconditions

- Coaching exists.
- Coaching is within the user's edit scope.
- Coaching status allows editing.
- User has permission to execute the coaching.

Typical users with execution rights:

- Verkoopleider for representatives in own team
- Sales Manager for Verkoopleiders within assigned country scope, when configured
- Country Manager for Verkoopleiders within assigned country scope, when configured
- Admin for Verkoopleiders within assigned country scope, when configured
- Super Admin for all allowed coaching targets

Management users such as Country Manager, Sales Manager and Admin normally open representative coachings in view/preparation mode only unless permissions explicitly allow editing.

Required exception:

- A user above Verkoopleider level must be able to plan and execute a coaching on a Verkoopleider within the user's effective country and permission scope.

---

## Coaching Form

The coaching form contains three logical sections:

1. General
2. Customer Visits / Afspraken
3. Action Points / Actiepunten

---

## Section 1 – General

Purpose:

- Capture general information related to the coaching.
- Evaluate general points.
- Evaluate personality or behavioural aspects.

Contains:

### General Information

General information about the coaching.

### General Evaluation

Evaluation of generic coaching criteria.

### Personality

Evaluation of behavioural and personal competences.

---

## Section 2 – Customer Visits / Afspraken

A coaching consists of one or more customer visits.

Every visit is evaluated separately.

The coach may add as many visits as required.

Each visit contains general information:

- customer number
- customer name
- location
- start time
- end time

Each visit contains evaluation criteria:

- only criteria belonging to the selected focus areas are displayed
- scoring is entered per applicable criterion

Business rule:

- The coaching dynamically adapts itself based on the selected focus areas.
- Different coachings may therefore show different evaluation criteria.

---

## Section 3 – Action Points / Actiepunten

Every coaching must contain at least one action point.

Each action point contains:

- title
- priority
- target date, optional
- Tips & Tricks, WYSIWYG field

Purpose:

- Support continuous improvement after the coaching.
- Convert observations into concrete follow-up actions.

Business rule:

- A coaching cannot be submitted for approval without at least one action point.

---

# Flow 4 – Saving an Incomplete Coaching

## Objective

Allow the coach to stop and continue later without losing entered information.

---

## Behaviour

If the coaching form is saved before all mandatory information is completed, the coaching receives the status:

`Incomplete`

Characteristics:

- partially completed
- can be reopened later
- remains editable
- not yet sent to the representative for approval
- not considered completed

Business rules:

- Incomplete coachings remain visible where relevant for follow-up.
- Incomplete coachings must not be treated as historical completed coachings.
- Incomplete coachings must not be used as final performance comparison unless explicitly defined otherwise.

---

# Flow 5 – Submitting for Representative Approval

## Objective

Allow the coach to submit a completed coaching to the representative for approval.

---

## Preconditions

The coaching can only be submitted for approval when all mandatory requirements are met.

Minimum requirements:

- at least one focus area
- at least one customer visit
- at least one action point
- all mandatory scoring and required fields completed

---

## Behaviour

When the coach submits the coaching for approval, the coaching receives the status:

`Pending Approval` / `Wachten op akkoord`

Representative actions:

- read coaching
- review scores
- review action points
- approve coaching

Business rules:

- The coaching becomes read-only when submitted for approval.
- No modifications are allowed while the coaching is in `Pending Approval`.
- If changes are required, the coach must first withdraw the `Pending Approval` status.
- After withdrawal, the coaching becomes editable again for authorised users.
- After modifications, the coaching must again be submitted for approval.
- A coaching is not completed until the representative has approved it.

---

# Flow 6 – Representative Review and Approval

## Coaching Target Approval

The person who was coached must review and approve the coaching.

For most coachings, this will be the Vertegenwoordiger.

When the coaching target is a Verkoopleider, the Verkoopleider must be able to review and approve the coaching in the same approval lifecycle.

Business rules:

- Approval belongs to the coached person.
- The approval lifecycle must not assume that the coached person is always a Vertegenwoordiger.
- A Verkoopleider who is being coached must have approval access for own coaching once it reaches `Pending Approval`.

---

## Objective

Allow the representative to review and approve the coaching.

---

## Representative Visibility

Representative visibility depends on the planning notification and lifecycle status.

### Announced Coaching

If the representative notification checkbox was enabled during planning:

- the representative may see the planned coaching before execution
- the coaching may appear in today's or future coachings where relevant

### Surprise Coaching

If the representative notification checkbox was not enabled during planning:

- the representative must not see the planned coaching before execution
- the representative only sees the coaching once it reaches at least `Pending Approval`

---

## Representative Access Rules

- The representative only sees own coachings.
- The representative cannot open unfinished coachings.
- The representative can open a coaching from `Pending Approval` onwards.
- The representative can review the coaching but cannot edit the coaching form.
- Approval by the representative is required before the coaching is considered completed.

---

# Flow 7 – Completed Coaching

## Objective

Finalize the coaching after representative approval.

---

## Behaviour

When the representative approves the coaching, the coaching receives the status:

`Completed`

Characteristics:

- locked for normal editing
- included in coaching history
- included in reporting
- available for future comparison
- used for Performance Circle calculations
- available as historical coaching dossier or report

Business rules:

- Completed coachings are part of the official coaching history.
- Completed coachings may be used as comparison points in future coachings.
- Completed coachings should remain read-only unless a specific administrative correction process is later defined.

---

# Coaching Lifecycle

A coaching progresses through the following lifecycle states.

---

## Status: Planned

The coaching has been scheduled.

Characteristics:

- visible in Dashboard where applicable
- visible in Planning
- visible in Begeleidingen overview
- synchronized to Outlook
- not yet started

Allowed actions depend on role and permission.

---

## Status: In Progress

The coach has opened the coaching and started completing the form.

Characteristics:

- form is being completed
- information can still be modified by authorised users
- visits can be added or removed
- action points can be added or edited

---

## Status: Incomplete

The coaching has been saved before completion.

Characteristics:

- partially completed
- can be reopened
- remains editable for authorised users
- not yet submitted to the representative
- not yet completed

---

## Status: Pending Approval / Wachten op akkoord

The coach has completed the coaching and submitted it to the representative.

Characteristics:

- representative must review it
- coaching is read-only
- no modifications allowed
- approval still required

Allowed representative actions:

- read coaching
- review scores
- review action points
- approve coaching

Business rule:

- If modifications are needed, Pending Approval must first be withdrawn.

---

## Status: Completed

The representative has approved the coaching.

Characteristics:

- locked
- included in history
- included in reporting
- used for future comparisons
- used for Performance Circle calculations

---

# Status Transition Overview

```text
Planned
   ↓
In Progress
   ↓
Incomplete  ← save before completion
   ↓
In Progress ← reopen and continue
   ↓
Pending Approval / Wachten op akkoord
   ↓
Completed
```

Exception:

```text
Pending Approval
   ↓ withdraw approval request
In Progress or Incomplete
   ↓ modify
Pending Approval
```

---

# Role-Based Flow Summary

## Vertegenwoordiger

Can:

- see own coachings according to visibility rules
- review coachings from `Pending Approval` onwards
- approve coachings

Cannot:

- see surprise coachings before `Pending Approval`
- open unfinished coachings
- edit coaching forms
- create coachings

---

## Verkoopleider

Can:

- plan coachings for representatives in own team
- execute coachings for representatives in own team
- edit planned and in-progress coachings for own team
- submit coachings for approval
- withdraw `Pending Approval` when changes are needed
- resubmit for approval
- review and approve own coaching when the Verkoopleider is the coaching target

Cannot:

- access coachings outside own team unless additional permissions explicitly allow it
- plan coachings on another Verkoopleider unless explicitly allowed

---

## Country Manager

Can:

- view coachings within assigned country scope
- view preparation data
- view historical reports
- plan and execute coachings on Verkoopleiders within assigned country scope when configured

Cannot by default:

- fill in representative coaching forms
- edit representative coaching planning details
- change focus areas for representative coachings
- change representative for representative coachings

---

## Sales Manager

Can:

- view coachings within assigned country scope
- view coachings across one or more assigned countries
- view preparation data
- view historical reports
- plan and execute coachings on Verkoopleiders within assigned country scope when configured

Cannot by default:

- fill in representative coaching forms
- edit representative coaching planning details
- change focus areas for representative coachings
- change representative for representative coachings

---

## Admin

Can:

- view coachings within assigned country scope
- view preparation data
- view historical reports
- plan and execute coachings on Verkoopleiders within assigned country scope when configured

Cannot by default:

- fill in representative coaching forms
- edit representative coaching planning details
- change focus areas for representative coachings
- change representative for representative coachings

---

## Super Admin

Can:

- see all coachings
- open coachings with Verkoopleider-level access
- plan and execute coachings on Verkoopleiders across all countries and teams
- manage coachings across all countries and teams

---

# Global Business Rules

- Every coaching must contain at least one focus area.
- Every coaching must contain at least one customer visit.
- Every coaching must contain at least one action point.
- Evaluation criteria are determined by the selected focus areas.
- A coaching may be opened from multiple entry points.
- There is only one coaching workflow.
- There is only one coaching form.
- Planning displays coachings but does not own the coaching workflow.
- Dashboard, Planning, Begeleidingen and Mijn Team may open the same coaching.
- Business logic must never be duplicated across entry points.
- A coaching becomes read-only after being submitted for approval.
- Pending Approval must first be withdrawn before modifications are allowed.
- A coaching is only considered completed after representative approval.
- Completed coachings become part of historical reporting.
- Completed coachings are used for future comparison and Performance Circle calculations.
- Representatives only see planned coachings before execution when notification was enabled during planning.
- Representatives must not see surprise coachings before Pending Approval.
- Country Manager, Sales Manager and Admin have view/preparation access by default, not edit access.
- Super Admin can open coachings with Verkoopleider-level access.
- Verkoopleiders can be coaching targets when the coach is functionally above Verkoopleider level and has the required permission.
- The coaching target approval lifecycle must support Verkoopleiders as coached persons.

---

# AI Implementation Rules

When implementing or modifying Coaching flows:

- do not create duplicate coaching forms
- do not create separate workflow logic per entry point
- always preserve lifecycle status rules
- always check role permissions and user-level overrides
- always respect representative visibility rules
- always preserve the Pending Approval lock
- never allow modifications while status is Pending Approval
- require withdrawal before editing a submitted coaching
- never mark a coaching completed without representative approval
- never include undefined workflows based on assumptions
- never assume the coached person is always a Vertegenwoordiger
- support Verkoopleider as coaching target where required by permissions
- update related documentation when the flow changes
