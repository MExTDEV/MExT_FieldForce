# Mijn Team

## Status

Functional area status: `DEFINED`

## Purpose

Mijn Team gives authorised users a scoped overview of field employees and access to an employee fiche.

---

# Visibility

Representative:

- does not see Mijn Team.

Verkoopleider:

- sees own team.

Sales Manager:

- sees users in assigned countries.

Country Manager:

- sees users in assigned country scope.

Admin:

- sees users in assigned country scope.

Super Admin:

- sees all users.

Group Manager and Service Operator behaviour follows explicit permissions and the role document.

---

# Included Field Roles

Current intended field roles:

- Representative;
- Verkoopleider;
- Service Operator.

The final inclusion of additional operational roles remains an open business decision.

Do not add management-only roles to field lists without approval.

---

# Teams Without a Verkoopleider

Teams without an assigned Verkoopleider remain visible to management users inside their effective country or global scope.

They do not become visible to unrelated ordinary Verkoopleiders.

---

# Employee Fiche

The fiche shows only content for:

- active modules;
- effective section permissions;
- visible target person;
- permitted lifecycle and scope.

Possible content:

- latest Begeleiding;
- Coaching history;
- Performance Circle;
- KPI;
- Action Points;
- Contactmomenten;
- relevant timeline items.

Disabled modules do not leave empty tabs or inaccessible links.

---

# Grouping and Search

Group according to available scope:

- country;
- team;
- employee.

Country grouping may be omitted when only one country is available.

Search filters only the already permission-scoped user list.

---

# Visual Indicators

Defined:

- planned Begeleiding indicator;
- compact field-employee presentation.

Open:

- configurable threshold between good and bad score;
- final score-based row colours.

Do not hardcode a score threshold before the business setting is defined.

---

# Validation

Relevant tests may include:

- fiche visibility;
- data access;
- menu rights;
- Coaching visibility;
- planned indicator;
- team leader optionality.
