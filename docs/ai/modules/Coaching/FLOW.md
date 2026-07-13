# Begeleiding Flow

## Status

Workflow status: `DEFINED`

## Purpose

This document owns the functional lifecycle of a Begeleiding.

It does not own React routes, Prisma implementation or shared role definitions.

---

# Core Rules

- One Begeleiding record.
- One Begeleiding form.
- One lifecycle.
- Multiple entry points.
- Permission-driven access.
- Scope-driven visibility.
- Lifecycle-driven editability.
- Approval belongs to the coached person.
- Completed records form official history.

---

# Participants

## Coach

The authorised user who plans and executes the Begeleiding.

Possible roles depend on effective permissions and scope.

## Coached person

The person being coached.

Currently supported target roles:

- Representative;
- Verkoopleider when the coach is functionally above that level and has permission.

The coached person owns the approval task.

---

# Lifecycle Overview

```text
Planned
  ↓
In Progress
  ↓
Incomplete ← save before completion
  ↓
In Progress ← reopen
  ↓
Pending Approval
  ↓
Completed
```

Withdrawal path:

```text
Pending Approval
  ↓ withdraw request
In Progress or Incomplete
  ↓ update and resubmit
Pending Approval
```

Cancelled and legacy technical statuses may exist in the schema.

Shared status helpers must map them to the documented functional behaviour.

---

# 1. Planning

## Preconditions

- authenticated user;
- permission to create a Begeleiding;
- target person inside effective scope;
- valid date and time;
- at least one required focus area where applicable.

## Planner inputs

- target person;
- date;
- start time;
- end time;
- whether the target person is informed in advance;
- focus areas or criteria required by the current form.

## Target selection

Selection is permission-scoped before it is displayed.

A planner must never select a person outside effective scope.

Management users may select Verkoopleiders when the role and permission allow coaching users at that level.

## Result

The Begeleiding is created as Planned and appears in the relevant:

- Dashboard;
- Planning;
- Begeleidingen overview;
- Outlook calendar integration where configured.

Visibility for the coached Representative depends on the prior-notification choice.

---

# 2. Preparation

Preparation may show:

- previous Begeleiding;
- previous scores;
- previous Performance Circle;
- previous Action Points;
- customer or appointment preparation data;
- relevant history.

Preparation does not create a second Begeleiding record.

Future Begeleidingen open in planning or preparation mode.

---

# 3. Execution

## Preconditions

- record exists;
- effective permission allows execution;
- record lies inside effective scope;
- lifecycle is editable.

Representatives cannot fill or modify the form.

Other roles may edit only within effective scope and permissions.

## Form content

The form may include:

- general information;
- general evaluation;
- personality or behavioural evaluation;
- one or more customer visits;
- criteria selected through focus areas;
- observations;
- Action Points.

The exact active criteria come from the current scoped configuration.

---

# 4. Saving Incomplete

A partially completed Begeleiding may be saved as Incomplete.

Characteristics:

- remains editable by authorised users;
- may be reopened;
- is not an official completed result;
- is not yet submitted for approval;
- must not be treated as final history or reporting input.

---

# 5. Submitting for Approval

## Preconditions

All mandatory form requirements must be satisfied.

The current form and validation rules determine mandatory content.

## Result

The Begeleiding enters Pending Approval.

Consequences:

- the coached person receives the approval task;
- the coached person receives a best-effort FieldForce e-mail after the workflow transaction succeeds;
- the e-mail uses the FieldForce sender and replies to the user who submitted the Begeleiding for approval;
- an approval notification is created using the existing Approval source of truth;
- the record becomes read-only;
- no normal edits are allowed;
- the record appears in the relevant approval and attention views.

## Withdrawal

An authorised coach may withdraw the approval request when changes are required.

Withdrawal must:

- restore an editable lifecycle;
- preserve auditability;
- require resubmission after changes.

---

# 6. Approval by Coached Person

The approval task belongs to the coached person.

Examples:

- a coached Representative approves own Begeleiding;
- a coached Verkoopleider approves own Begeleiding.

The approval workflow must not check only for Representative role.

The coached person may:

- read the report;
- review scores;
- review Action Points;
- approve according to the current approval flow.

The coached person does not edit the Coaching form.

---

# 7. Completion

After approval, the Begeleiding becomes Completed.

Completed characteristics:

- locked for normal editing;
- included in official history;
- eligible for reporting;
- eligible for future comparison;
- available to Performance Circle or score history according to configuration;
- available as report or PDF.

A future administrative correction flow must be separately defined.

Do not silently unlock Completed records.

---

# Visibility Rules

## Announced Begeleiding

When prior notification was enabled:

- the coached Representative may see the planned item before execution;
- the item may appear in relevant future or today views.

## Surprise Begeleiding

When prior notification was disabled:

- the coached Representative does not see the planned item before the defined approval stage;
- the item becomes visible when the lifecycle reaches Pending Approval.

Management visibility remains controlled by effective scope.

---

# Entry Points

A Begeleiding may be opened from:

- Dashboard;
- Planning;
- Begeleidingen;
- Mijn Team;
- approval notification;
- direct permitted route.

Every entry point opens the same record and shared logic.

---

# Notifications

Implemented:

- approval-request notification after submission;
- approval-request e-mail to the coached person, with Reply-To set to the submitting user's stored e-mail address;
- unread/read handling using the existing Approval record;
- visual notification;
- sound attempt subject to browser restrictions.

Not automatically implied:

- a planning-time notification for every intervention type;
- generic todo or message notifications.

---

# Action Points

Action Points created inside a Begeleiding are linked to the coached person.

They reuse the shared Action Point model.

The complete Action Point close, approve, reopen and reassign lifecycle remains owned by `Actiepunten.md` and is not fully defined.

---

# Technical Status Normalisation

The schema may contain several technical status variants.

Before changing status logic:

- inspect all shared helpers;
- inspect visibility filters;
- inspect notifications;
- inspect history and reporting;
- inspect legacy data;
- add migration or compatibility handling where required.

Do not add a new variant to bypass an existing inconsistency.
