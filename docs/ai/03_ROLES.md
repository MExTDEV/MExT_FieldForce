# Roles and Permission Model

## Purpose

This document defines functional role behaviour, visibility scope and permission principles for MExT FieldForce.

Technical enum names and permission storage belong in code and database documentation.

---

# Core Principle

Access is permission-driven and scope-driven.

Effective access may depend on:

1. active role configuration;
2. module activation;
3. user-level overrides;
4. country scope;
5. team scope;
6. user scope;
7. lifecycle status;
8. a specific workflow rule.

A role name alone never proves complete access.

Server-side access must enforce the same effective scope as navigation and UI actions.

---

# Scope Types

Supported scope concepts include:

- own user;
- own team;
- assigned country;
- multiple assigned countries;
- all countries.

Country access may be stored separately from a user's primary country.

A user without the required assigned scope must not see country-scoped records.

---

# Role Status

Roles are system roles.

Role management may mark roles active or inactive.

Rules:

- existing roles are active by default;
- an inactive role remains visible for review;
- deactivation does not remove the role from existing users;
- an inactive role is not assignable to a new user;
- existing users with an inactive role remain editable for safe profile changes;
- role permissions and user overrides remain visible.

---

# User-Level Overrides

Role configuration defines defaults.

A user-level override may explicitly enable or disable a permission for one user.

Managing a user's profile photo is treated as editing personal user data. The
upload API must enforce the same `canEditPersonal` scope as other personal user
fields, and stored avatar reads must remain scoped to effective user visibility.

New menu items and management actions must support:

- role default configuration;
- user-level override;
- direct route enforcement;
- server/API enforcement.

---

# Official Roles

The current technical role model contains:

- Vertegenwoordiger (`REPRESENTATIVE`);
- Verkoopleider (`SALES_LEADER`);
- Sales Manager (`SALES_MANAGER`);
- Service Operator (`SERVICE_OPERATOR`);
- Country Manager (`COUNTRY_MANAGER`);
- Group Manager (`GROUP_MANAGER`);
- Admin (`ADMIN`);
- Super Admin (`SUPER_ADMIN`).

Not every role has a fully defined Coaching workflow.

---

# Vertegenwoordiger

Status: `DEFINED`

Primary scope:

- own data.

Main Coaching behaviour:

- sees own visible coachings;
- sees own action points;
- may approve own coaching when the lifecycle requests approval;
- may create a Hulpaanvraag;
- may view shared Contactmoment reports related to own user.

Restrictions:

- does not create or edit Coaching forms;
- does not see surprise coachings before the defined lifecycle point;
- does not see `Mijn Team`;
- does not see data belonging to other users.

---

# Verkoopleider

Status: `DEFINED`

Primary scope:

- own team.

Main behaviour:

- plans and executes Begeleidingen for permitted team members;
- creates and follows team or user action points when allowed;
- closes concrete Action Points for permitted representatives when `actionPointsClose` is active;
- processes Hulpaanvragen from the own team;
- plans Contactmomenten for the own team;
- views team history and relevant preparation data.

A Verkoopleider may also be the target of a Begeleiding by a user above Verkoopleider level.

A team may exist without an assigned Verkoopleider. This does not create extra visibility for ordinary Verkoopleiders.

A Verkoopleider cannot act outside the effective team scope unless an explicit permission and scope rule allows it.

---

# Sales Manager

Status: `DEFINED`

Sales Manager is a separate role above Verkoopleider level.

It is not the same as:

- Verkoopleider;
- Country Manager;
- Admin.

Primary scope:

- one or more explicitly assigned countries.

Main behaviour within effective scope:

- views teams, users and Coaching data;
- plans and executes Begeleidingen for Representatives and Verkoopleiders;
- opens and edits visible unlocked Coaching forms;
- follows action points and management information;
- processes or oversees Hulpaanvragen;
- plans Contactmomenten;
- uses country grouping when multiple countries are available.

A Sales Manager without assigned country rights must not see country-scoped Coaching data.

---

# Country Manager

Status: `DEFINED`

Primary scope:

- assigned country or explicitly granted countries.

Main behaviour within effective scope:

- views teams and users;
- plans and executes Begeleidingen for Representatives and Verkoopleiders;
- opens and edits visible unlocked Coaching forms;
- follows action points, risks and reports when allowed;
- closes concrete Action Points within assigned country scope when `actionPointsClose` is active;
- processes or oversees Hulpaanvragen;
- plans Contactmomenten.

Country grouping may be omitted when only one country is available.

---

# Group Manager

Status: `PARTIALLY_DEFINED`

The technical role exists, but its complete functional scope is not yet documented.

Known intended use:

- group-level management;
- global or cross-country configuration where explicitly permitted;
- management of global Coaching criteria and configuration where the relevant permission allows it.
- closing concrete Action Points only within explicitly assigned scope when `actionPointsClose` is active.

Do not assume that Group Manager automatically has Super Admin access.

Until the business definition is completed:

- use explicit effective permissions;
- use explicitly assigned country or global scope;
- do not hardcode Group Manager as equivalent to Sales Manager, Admin or Super Admin;
- document any new Group Manager capability before implementation.

Open decision:

- exact default countries, modules, management rights and Coaching actions.

---

# Admin

Status: `DEFINED`

Primary scope:

- assigned country or countries.

Main behaviour within permissions:

- manages users and teams;
- manages operational configuration;
- views and edits visible unlocked Coaching records;
- plans and executes Begeleidingen for permitted Representatives and Verkoopleiders;
- manages Contactmomenten and Hulpaanvragen within scope;
- closes concrete Action Points within administrative scope when `actionPointsClose` is active;
- manages roles or permissions only within allowed boundaries.

An Admin cannot grant Admin or Super Admin rights unless an explicit Super Admin policy permits it.

---

# Super Admin

Status: `DEFINED`

Primary scope:

- all countries;
- all teams;
- all users.

Main behaviour:

- global configuration;
- full visibility;
- troubleshooting and correction;
- role, module and user management;
- planning and execution of Begeleidingen for permitted targets;
- management of global Coaching configuration.
- closing concrete Action Points globally when `actionPointsClose` is active.

Super Admin still respects business lifecycle locks unless an explicit administrative override exists.

Full visibility does not justify duplicating workflow logic.

---

# Service Operator

Status: `PARTIALLY_DEFINED`

Known behaviour:

- may be considered a field employee;
- may appear in `Mijn Team` when module and permission rules allow it.

Undefined:

- complete Coaching creation, execution, approval and action-point behaviour.

Do not invent Service Operator Coaching workflows.

---

# Main Menu and Direct Access

Main navigation is permission-driven.

Every new main menu item requires:

- a permission key;
- role defaults;
- user-level override support;
- client navigation enforcement;
- direct route enforcement;
- server/API enforcement;
- translations;
- documentation.

Representatives must not see `Mijn Team`.

Beheer subitems require explicit section permissions.

---

# Coaching Form Edit Rule

Only the coached person with a Representative role is prohibited from filling or modifying Coaching forms as an ordinary user.

Other roles may edit only when:

- the record is visible in their effective scope;
- the relevant permission allows it;
- the lifecycle is not locked.

Pending Approval and Completed remain read-only unless the documented workflow first changes the lifecycle.

---

# Hulpaanvragen Visibility

A Hulpaanvraag is visible to:

- the requester;
- the responsible Verkoopleider;
- higher-level users with the required permission and effective scope.

A request must not become a general chat.

A request may not be rejected without follow-up. It must receive a documented response or planned follow-up action.

---

# Contactmomenten Visibility

A Contactmoment may be planned by users who may plan within the target user's effective scope.

The resulting report is shared with the target person.

Once shared, the Contactmoment report is locked for normal editing.

No approval step is required.

---

# Open Role Decisions

The following require explicit business definition:

- complete Group Manager defaults and scope;
- complete Service Operator Coaching workflow;
- whether additional operational roles belong in `Mijn Team`.
