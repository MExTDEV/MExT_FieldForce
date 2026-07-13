# Begeleidingen

## Status

Functional area status: `DEFINED`

## Purpose

Begeleidingen is the central overview for planned, active, approval and historical Coaching records.

The page does not create a second Coaching workflow.

---

# Main Sections

The overview may contain:

- Begeleidingen van vandaag;
- Toekomstige Begeleidingen;
- Onvolledige Begeleidingen;
- Wachten op akkoord;
- Uitgevoerde Begeleidingen.

Main sections may remain visible with an empty state.

Empty nested country, team or user groups are omitted.

---

# Open Mode

## Today

Authorised coach:

- opens the existing execution form when the lifecycle allows it.

Coached person:

- opens only when visibility and lifecycle allow it;
- never edits the form.

## Future

Authorised user:

- opens the existing planning or preparation flow;
- may edit date, time, target and focus information only within scope and lifecycle.

## Incomplete

Authorised user:

- reopens the existing editable form.

## Pending Approval

Coached person:

- receives the approval task and a best-effort FieldForce e-mail;
- replies to that e-mail reach the user who submitted the Begeleiding for approval;
- opens approval/read mode.

Other users:

- see read-only mode unless the approval request is withdrawn according to the workflow.

## Completed

Opens report/history mode.

---

# Scope and Grouping

Visibility follows effective permissions and scope.

Typical grouping:

- multiple countries → country, team, user;
- one country → team, user;
- Verkoopleider → own team;
- Representative → own visible records;
- Super Admin → all permitted records.

Do not hardcode grouping as access control.

---

# Coached Verkoopleider

A Verkoopleider may be the target of a Begeleiding.

The higher-level coach plans and executes the record.

The coached Verkoopleider receives the approval task.

---

# Surprise Begeleidingen

When prior notification is disabled:

- the coached Representative does not see the planned record;
- no personal todo or notification exposes it before the documented stage;
- it becomes visible at Pending Approval.

---

# Reports and PDF

Completed records may be opened as a report and exported using the existing PDF flow.

The report must use the same underlying record and current criteria data.

---

# Validation

Relevant tests may include:

- Coaching workflow;
- Coaching visibility;
- data access;
- menu rights;
- Coaching action persistence;
- PDF report;
- notifications.
