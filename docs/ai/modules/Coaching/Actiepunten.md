# Actiepunten

## Status

Functional area status: `PARTIALLY_DEFINED`

The overview and management of scoped Action Point definitions are defined.

The operational close lifecycle for concrete assigned Action Points is defined.
Approve, reopen and reassign lifecycles are not yet defined.

---

# Purpose

Actiepunten convert Coaching observations and management objectives into concrete follow-up for users.

---

# Definition Scope

Configured Action Point definitions may use:

- Global;
- Country;
- Team;
- User.

A definition contains:

- name;
- WYSIWYG description;
- target;
- from date;
- to date;
- optional linked products;
- active status;
- one or more allowed scope assignments where supported.

Global definitions apply to all users.

Country, Team and User definitions apply only to their assigned scope.

Effective user Action Points may combine all applicable definitions.

---

# Management Rights

Authorised management users may create and manage definitions within effective scope.

A Verkoopleider may manage user Action Points for permitted members of the own team.

Management access requires explicit permissions.

Inactive definitions remain reviewable by authorised management users.

---

# Workflow-Created Action Points

A Begeleiding may create a user Action Point for the coached person.

A Contactmoment may create a user Action Point for the target person.

These concrete items reuse the shared Action Point model and appear in personal follow-up.

---

# Overview

The overview may include:

- Action Points grouped by scope;
- an additional user subdivision inside scope/type groups;
- users and their concrete Action Points;
- open and closed presentation based on current available fields;
- search;
- type or scope badges.

Scope/type groups and their nested user groups are collapsible and are shown
expanded by default.

Representatives see only own visible Action Points.

Management users see only records inside effective scope.

---

# Operational Close Lifecycle

Closing an Action Point applies only to the concrete user assignment or legacy
single-user `ActionPoint` row.

It must not:

- deactivate or delete the underlying `ActionDefinition`;
- close the same definition for other users, teams or countries;
- change the linked Begeleiding, score, signed report or generated historical PDF.

Status values:

- open states use existing `OPEN`, `NIEUW` or `IN_UITVOERING` values;
- close uses existing `AFGEROND`.

Close metadata:

- `closedAt`;
- `closedByUserId`.

Permission:

- functional permission `actionPointsClose`;
- module/menu access to Actiepunten;
- effective organisational scope.

Default close permission is granted to:

- Verkoopleider (`SALES_LEADER`);
- Country Manager (`COUNTRY_MANAGER`);
- Group Manager (`GROUP_MANAGER`);
- Admin (`ADMIN`);
- Super Admin (`SUPER_ADMIN`).

Representatives do not close their own Action Points through this lifecycle.

Scope:

- Verkoopleider closes only concrete Action Points for representatives in the effective own-team scope;
- Country Manager and Admin close only inside assigned country scope;
- Group Manager closes only inside explicitly assigned country/organisational scope and is not treated as Super Admin;
- Super Admin may close all concrete assignments.

Double close requests are idempotent. Existing close metadata is preserved and
no second audit or notification is created.

Notifications:

- a best-effort in-app notification is sent to the target user through
  `NotificationDelivery`;
- notification failure must not roll back the saved close.

Auditlogging:

- `AuditLog` records `actionPoint.closed` with the action point id, assignment id
  where applicable, old status, new status, actor, target user and scope context.

Overviews, dashboards and badges count only open concrete Action Points as open.
Closed items remain available in the closed section where the user may view them.

Reopening is not implemented by this lifecycle.

---

# Current Limitations

Not yet fully defined:

- whether closure needs approval;
- whether a closed point may reopen;
- reassignment rules;
- evidence or comment requirements;
- overdue escalation.

Do not invent these rules.

---

# Products

Linked products reuse existing product entities.

Do not create duplicate product records from Action Point management.

---

# Rich Text

Action Point descriptions use sanitized HTML as the canonical rich-text format.

Canonical fields:

- `ActionDefinition.tipsAndTricks` for configured scoped Action Point definitions;
- concrete workflow action point `description` / `tipsAndTricks` for action points created from Begeleiding, Contactmoment, Retraining or Salestraining.

Rich-text content is sanitized on save and rendered defensively through the shared `RichTextRenderer` / `rich-text-content` path. Supported display tags are limited to the editor-supported semantic subset:

- paragraphs and line breaks;
- bold, italic, underline and strikethrough;
- unordered and ordered lists;
- headings;
- blockquotes;
- links using `http`, `https` or `mailto`;
- horizontal rules.

Dangerous tags, event handlers, inline scripts, unsafe URL schemes, uncontrolled styles and embedded external elements are stripped.

Compact overview previews use `richTextToPlainText` so raw tags are never shown. Full detail and coaching detail views use rich-text rendering. Empty editor markup such as `<p><br></p>` is treated as empty and does not show a fallback sentence in the description body.

The professional coaching PDF converts action point rich text to structured plain text with paragraphs, bullets, numbering and readable links. Inline styling such as bold inside a sentence is not fully reproduced in the compact jsPDF table; the title remains bold and unknown/unsupported tags are stripped without losing readable text.

---

# Validation

Relevant tests may include:

- Action Point overview;
- Action Point targets;
- data access;
- menu rights;
- Coaching action persistence;
- professional coaching PDF export.
