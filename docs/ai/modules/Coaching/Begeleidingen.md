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

When prior notification is enabled, the coached person receives an in-app
notification and a best-effort FieldForce e-mail for the planned Begeleiding.
The recipient is resolved server-side from the selected target user.

## Incomplete

Authorised user:

- reopens the existing editable form.

## Pending Approval

Coached person:

- receives the approval task and a best-effort FieldForce e-mail;
- replies to that e-mail reach the user who submitted the Begeleiding for approval;
- first opens the required reflection-question step;
- can only open approval/read mode after all three WYSIWYG answers are validly saved.

The three approval reflection answers are stored on the existing Approval
record. The coached person may edit them until akkoord or niet-akkoord is
submitted. After final submission they are read-only. The report content,
scores and approval actions remain blocked for the coached person while the
required answers are incomplete; this is enforced both in the UI and
server-side.

Managers and other authorised viewers see a read-only section "Reflectie van de
vertegenwoordiger" in the Begeleiding report. If the answers are missing or
partially present, the section shows the available answers and clearly marks
missing answers as not filled in.

When the coached person confirms approval, the responsible coach/leader and the
user who submitted the Begeleiding for approval are notified through the
existing in-app notification channel and receive a best-effort FieldForce
e-mail. The recipient is resolved server-side from the Begeleiding record,
preferring the assigned owner/coach and the approval submitter, and falling back
to the original initiator. The coached person who signs must not receive this
confirmation notification.

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

# Data Refresh After Planning

The Begeleidingen overview is rendered from the shared `WorkflowProvider`
state. The provider loads visible workflow data through `/api/workflows` with
`cache: "no-store"` and keeps the result in local React state. FieldForce does
not use React Query, SWR, cache tags or a separate Begeleidingen query key for
this overview.

After a Begeleiding is planned, the planning wizard must wait until
`/api/workflows/coaching` confirms that the FieldForce record was saved. The API
returns the persisted workflow patch, including Outlook sync status when
available. The provider then merges that patch into the existing workflow state
by Begeleiding id before navigation back to `/begeleidingen`.

This merge is the cache/state invalidation mechanism for the current user:

- the created Begeleiding is inserted or replaced by id;
- duplicate rows are removed through shared workflow deduplication;
- existing section sort rules still determine whether the row appears under
  today, future or completed records;
- scope and lifecycle visibility are recalculated from the same
  `visibleInterventions` logic used after a full reload;
- Outlook sync failures update the sync status but do not remove or roll back
  the valid FieldForce record.

No broad application cache clear is required. Cross-user realtime refresh is not
introduced by this workflow; other open sessions see the new record after their
normal data refresh unless a future shared realtime data mechanism is added.

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

# Historical Score Comparison

During execution, the score area of the Begeleiding form contains a comparison selector above the representative score sections.

The selector:

- is labelled as a comparison with a previous Begeleiding;
- lists only earlier Begeleidingen for the same coached person;
- excludes the current record, cancelled records, deleted records, future records and records without saved score data;
- sorts eligible records newest first;
- defaults to the newest eligible previous record;
- includes a no-comparison option that hides historical scores.

Historical score data is read-only. Changing the comparison must not change, overwrite or save the current Begeleiding form values.

Score rows show:

- the historical score when the selected previous Begeleiding contains a matching score;
- the current editable score according to the existing lifecycle and permission rules;
- a textual difference, using positive, negative, equal or missing-score states.

Criteria are matched through the stored score key built from the historical category/focus and criterion label. Where stable criterion identifiers are available in the stored score source, the existing score persistence remains authoritative; deleted or inactive criteria must not make historical records unreadable. Historical criteria that no longer exist in the current form are ignored for current input layout.

The Performance Circle in the execution score area uses the current unsaved form state as the current line and the selected previous Begeleiding as a dashed historical line with a legend. The selector updates the score tables and Performance Circle together.

Access to historical comparison data is enforced server-side through the same authenticated user, `moduleVisitRecord` permission and effective Coaching visibility/scope rules used for opening Begeleiding details. Manipulating a historical Begeleiding id must not expose data outside the actor's permitted scope.

---

# Reports and PDF

Completed records may be opened as a report and exported using the existing PDF flow.

The report must use the same underlying record and current criteria data.

When the Begeleiding was sent for representative approval, the professional PDF includes the representative's stored reflection answers when an approval record with answers is available.

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
