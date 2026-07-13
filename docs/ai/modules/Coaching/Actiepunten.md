# Actiepunten

## Status

Functional area status: `PARTIALLY_DEFINED`

The overview and management of scoped Action Point definitions are defined.

The complete operational close, approve, reopen and reassign lifecycle is not yet defined.

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
- users and their concrete Action Points;
- open and closed presentation based on current available fields;
- search;
- type or scope badges.

Representatives see only own visible Action Points.

Management users see only records inside effective scope.

---

# Current Limitations

Not yet fully defined:

- who closes an Action Point;
- whether closure needs approval;
- whether a closed point may reopen;
- reassignment rules;
- final required statuses;
- evidence or comment requirements;
- overdue escalation.

Do not invent these rules.

Until a close workflow is approved, existing active, validity and concrete workflow status fields determine current presentation.

---

# Products

Linked products reuse existing product entities.

Do not create duplicate product records from Action Point management.

---

# Validation

Relevant tests may include:

- Action Point overview;
- Action Point targets;
- data access;
- menu rights;
- Coaching action persistence.
