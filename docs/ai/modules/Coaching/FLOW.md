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

For the planner, the created record must become visible in the shared
WorkflowProvider state immediately after the FieldForce save succeeds. The
wizard must not navigate back to the Begeleidingen overview before the backend
has accepted the create request. Outlook synchronisation status may be returned
with the saved record, but Outlook failure must not block the valid FieldForce
record from appearing.

---

# 2. Preparation

Preparation may show:

- previous Begeleiding;
- previous scores;
- previous Performance Circle;
- previous Action Points;
- customer or appointment preparation data;
- relevant history.

For a newly planned Begeleiding, step 3 lets the authorised planner select one
fully completed earlier Begeleiding of the same coached person as the
preparation reference. The newest eligible record is selected by default. The
selection is stored on the new Begeleiding, survives reopening and falls back
to the newest eligible record only for legacy records without a stored
reference.

The selector excludes the current, planned, incomplete, cancelled, deleted,
future and other-person records. Both the read route and the save path enforce
the existing Coaching permission and effective scope. Historical circles,
criteria, labels, ordering, scores and comments use stored snapshot data rather
than current configuration.

The preparation PDF contains the selected reference and the newest fully
completed Begeleiding as separate chapters. When both ids are equal, one
combined chapter is rendered. Missing historical data never blocks planning or
causes export failure. Current open Action Points remain based on their live
status and do not change when an older reference is selected.

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
- the coached person must complete the three required WYSIWYG reflection questions before the report content and approval actions are unlocked;
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

- complete or update the required reflection answers while no final approval choice has been submitted;
- read the report only after all required reflection answers are validly stored;
- review scores;
- review Action Points;
- approve according to the current approval flow.

The coached person does not edit the Coaching form.

Reflection answers are stored on the existing `Approval` record because the
current data model has one approval source of truth per Begeleiding. The three
answers are WYSIWYG HTML fields, sanitized server-side and considered complete
only when all three contain meaningful plain text after HTML normalization.
Until completion, `/api/workflows` masks the report details for the coached
representative and the approval APIs reject akkoord and niet-akkoord submission.
Managers with normal Begeleiding visibility can see a read-only reflection
section; when answers are missing, the section explicitly states that the
representative has not completed the questions yet.

The existing automatic approval timing remains tied to the approval request.
Automatic approval must not create synthetic reflection answers; if automation
is later executed without representative input, audit history must show that no
representative reflection was supplied.

After approval is confirmed, the responsible coach/leader receives a
server-side generated in-app notification and a best-effort FieldForce e-mail.
The user who submitted the Begeleiding for approval also receives the
confirmation notification. Recipients are derived from the Begeleiding record,
preferring the assigned owner/coach and approval submitter, and falling back to
the original initiator. The signer is excluded from the confirmation recipients
and the notification event key is idempotent for the approval record.

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

When representative approval was requested, the stored representative reflection answers are part of the report/PDF output once they exist on the linked approval record.

A future administrative correction flow must be separately defined.

Do not silently unlock Completed records.

---

# Visibility Rules

## Announced Begeleiding

When prior notification was enabled:

- the coached Representative may see the planned item before execution;
- the coached Representative receives a server-side generated in-app notification and best-effort FieldForce e-mail for the planned Begeleiding;
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

- planning notification and e-mail for planned Begeleidingen when prior notification is enabled;
- approval-request notification after submission, explaining that the three reflection questions must be completed first;
- approval-request e-mail to the coached person, with Reply-To set to the submitting user's stored e-mail address and the same reflection-first instruction;
- unread/read handling using the existing Approval record;
- approval-confirmed notification and e-mail to the responsible coach/leader after successful signing;
- visual notification;
- sound attempt subject to browser restrictions.

Not automatically implied:

- a planning-time notification for every intervention type;
- generic todo or message notifications.

---

# Action Points

Action Points created inside a Begeleiding are linked to the coached person.

They reuse the shared Action Point model.

The Action Point close lifecycle remains owned by `Actiepunten.md`.
Closing a linked Action Point does not modify the Begeleiding lifecycle, scores,
approval lock, signed report or generated historical PDF.

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
