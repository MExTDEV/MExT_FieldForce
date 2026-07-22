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
- must complete the required approval reflection questions for own coaching before viewing the submitted report and before akkoord or niet-akkoord can be submitted;
- may create a Hulpaanvraag;
- may view shared Contactmoment reports related to own user.

Restrictions:

- does not create or edit Coaching forms;
- does not edit another user's approval reflection answers;
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
- views representative approval reflection answers read-only for visible Begeleidingen;
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

Permission resolution always grants every registered permission to `SUPER_ADMIN`; role grants or user-level permission overrides cannot disable Super Admin access.

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

# SalesDay Role Behaviour

SalesDay business behaviour is owned by `modules/Salesday/DECISIONS.md`.

`Sales Leader` and `Verkoopleider` are the same role and reuse the Coaching team relation.

## Representative

A Representative may perform the complete approved SalesDay operation only for the own working day and effective scope, including:

- preparation and own appointment execution;
- an own additional appointment for today;
- appointment-gated customer access and customer maintenance;
- sales documents, visit report, lead, follow-up and reference;
- own replenishment receipt and consumables request;
- own day closure and cash process.

Customer search for creating today's appointment is limited to the effective customer/team scope. Full customer details remain appointment-gated.

## Management

SalesDay management access is read-only:

- Verkoopleider: effective team(s);
- Sales Manager and Country Manager: teams in assigned countries;
- Group Manager: explicitly assigned group/countries;
- Admin: effective assigned country/team scope;
- Super Admin: all scope.

These roles do not create or edit a Representative's appointments, customers, sales, stock, visit reports, cash or day closure on the Representative's behalf.

Beheer, warehouse, integration monitoring and emergency-mode actions require separate explicit permissions. Admin or Super Admin status does not itself create an ordinary operational action on behalf of a Representative.

The weekly SalesDay cash block has no Admin or Super Admin manual bypass. The normal unblock path is an ERP/backoffice replicated cash-balance confirmation with exact zero balance.

Personal SalesDay device registration is limited to the Representative for the own user. Device revocation requires the explicit `salesday.manage` permission and effective country scope. This permission defaults to Super Admin only; it remains configurable through the existing role grants and user overrides. It does not permit acting in the Representative's operational workflow.

Activating or stopping ERP-outage emergency mode requires the separate `salesday.emergencyMode.manage` permission. It defaults to Super Admin only and does not grant any ordinary Representative action. Every activation and early stop requires a reason and is audited.

Managing global/country/team/user activation, the server-owned ERP runtime or the SalesDay Power BI link requires `salesday.settings.manage`. Reading technical integration incidents and production-readiness state requires `salesday.integration.monitor`. Both default to Super Admin only, remain configurable through role grants and user overrides, and do not grant Representative operational actions.

Representatives receive SalesDay preparation, agenda, stock and cash menu rights. Menu visibility follows those rights; effective page and API use still requires the server-resolved global and country/team/user activation. Representatives never receive SalesDay Mijn Team by default.

The controlled live-system seed activates SalesDay/Inventory for every active user so each role can exercise its existing permitted view. It creates own operational SalesDay fixtures only for Representatives; management, Admin and Super Admin continue to see seeded Representative data through the read-only scope above. Test data never grants Representative actions to another role.

Shared Inventory uses separate permissions from SalesDay management:

- `inventory.balance.readOwn` permits the Representative to read own Representative/vehicle stock;
- `inventory.receipts.acceptOwn` permits receiving own replenishments with mandatory signature/photo evidence;
- `inventory.consumables.requestOwn` permits creating an ERP consumables request, not approving or cancelling it;
- `inventory.carriers.writeOwnAppointment` permits create/edit/archive/count of customer carriers only for appointment-gated customers on the own working day;
- `inventory.manage` permits Beheer settings and reasons. It does not allow acting as a Representative in the daily operational flow.

The Inventory main menu uses `menu.inventory.enabled`, `menu.inventory.myStock`, `menu.inventory.replenishments` and `menu.inventory.consumables`. Representative defaults include the own operational Inventory permissions. Admin receives `inventory.manage`; Super Admin receives all permissions.

## Enforcement

Navigation, direct page access, APIs, file downloads, offline bootstrap data and background command processing must enforce the same effective SalesDay scope.

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

`Beheer -> Instellingen` is split into:

- `Mail` at `/beheer/instellingen/mail`;
- `Profiel` at `/beheer/instellingen/profiel`.

Both use the existing `menu.coaching.settings` permission. `Mail` owns SMTP, sender and MAIL TEST settings. `Profiel` owns Microsoft account/profile-photo synchronization. The legacy `/beheer/instellingen` route redirects to `Mail`.

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
