# Roles and Permission Model

This document describes the functional role model for MExT FieldForce, with the current focus on the Coaching module.

The purpose of this document is to define who can see, open, create, edit or approve information.

This document does not describe technical implementation, database tables or UI components.

---

# Core Principle

MExT FieldForce uses permission-driven access.

Access must not be hardcoded only by role name.

Effective access is determined by:

1. role configuration
2. country scope
3. team scope
4. user-level overrides
5. module activation
6. specific business rules

Business rule:

A user may only see or use functionality when the effective permission model allows it.

---

# Permission Configuration

## Role Permissions

Each role defines the default access rights for a user.

Role permissions determine default visibility for:

- main menu items
- dashboard widgets
- functional modules
- actions
- management screens
- reporting

Role permissions are persistent runtime configuration. The `Permission` basis
table must contain every configurable permission key that appears in role
management. Configuration seeding may create missing permission rows, but must
never overwrite rights saved through role management.

Saving a role may only persist the permissions that actually changed. It must
not rewrite the complete permission matrix on every save, because that makes
role management slow and risks transaction timeouts against the remote database.

## Role Active Status

Roles are fixed system roles, but each role has a configurable active status.

Business rules:

- All existing roles are active by default.
- Inactive roles remain visible in role management.
- Inactive roles keep their configured permissions visible for review.
- Making a role inactive must not remove or change the role of existing users.
- Inactive roles must not be assignable to new users or to users who do not already have that role.
- Existing users with an inactive role must remain editable for other safe profile changes.

## User-Level Overrides

A user-level override can overrule the default role configuration.

Business rules:

- Role permissions define the default configuration.
- User overrides can enable or disable access for an individual user.
- Effective permissions are calculated from role permissions plus user-level overrides.
- New main menu items must always support role configuration and user-level override.
- `UserPermission` stores only explicit deviations from the current role defaults.
- Absence of a user permission row means that the user inherits the role value.
- Changing a role permission applies to every user who has no explicit override for that permission.


---

# Scope Model

Access is not only role-based. It is also scope-based.

The main scopes are:

- own user
- own team
- assigned country
- multiple assigned countries
- all countries

A user's role can also determine whether the user is allowed to act as a coach, a coaching target or both.

Business rule:

When showing lists, dashboards or reports, the system must always filter data to the user's effective scope.

---

# Roles

## Vertegenwoordiger

A Vertegenwoordiger is a field sales representative.

### Vertegenwoordigersniveau

Every user with role `REPRESENTATIVE` has a separate representative level:

- Starter
- Sales Executive
- Professional
- Expert

This level is not a role and must not be used as a replacement for the role model.
New representatives start as Starter. Existing representatives are backfilled to
Sales Executive by migration `0023_representative_levels_peer_coaching`.
Level changes are logged in representative-level history with old value, new
value, actor and timestamp.

Active Professional and Expert representatives may be selected as executor for a
coaching of another representative when planned by Group Manager, Sales Manager,
Country Manager, Admin or Super Admin. They may not create, plan, reschedule,
cancel or change the date/time of coachings themselves. Self-coaching is never
allowed.

Primary scope:

- own data only

Main purpose:

- review own coachings
- approve completed coaching reports
- follow up own action points

General rules:

- Does not see the main menu item Mijn Team.
- Only sees own coachings.
- Only sees own action points.
- Does not create coachings.
- Does not edit coaching forms created by a coach.
- Can only approve a coaching once it has been submitted for approval.
- Professional and Expert representatives can only execute coachings where they
  were explicitly assigned as executor by an authorised planner.

Coaching visibility rules:

- If the representative was notified during planning, the planned coaching may be visible before execution.
- If the representative was not notified during planning, the planned coaching must remain hidden.
- Surprise coachings become visible only from status Wachten op akkoord / Pending Approval onwards.
- The representative may not open unfinished coachings.

---

## Verkoopleider

A Verkoopleider is the direct sales manager of a team.

A Verkoopleider can also be the target of a coaching by a user who is functionally above Verkoopleider level.

A Team can temporarily exist without an assigned Verkoopleider. This does not create additional visibility for ordinary Verkoopleiders; they still see only the team linked to their own user record.

Primary scope:

- own team

Main purpose:

- plan coachings for representatives in own team
- execute coachings for representatives in own team
- be coached by higher-level users
- create action points
- follow up team members
- view team coaching history

General rules:

- Sees only own team in Mijn Team.
- Can plan coachings for representatives in own team.
- Can open today's coachings in the coaching input form.
- Can open future coachings in planning/preparation mode.
- Can edit future coachings within own team when lifecycle status allows it.
- Can modify representative, date, time and focus areas for future coachings when allowed.
- Can view previous scores, previous Performance Circle and previous action points as preparation.
- Can review and approve own coaching when the Verkoopleider is the coaching target.
- Cannot plan coachings on another Verkoopleider unless explicitly allowed.

Coaching rules:

- Can submit a completed coaching to the representative for approval.
- Once a coaching is submitted for approval, the coaching becomes read-only.
- To make changes after submission, the Verkoopleider must withdraw the Wachten op akkoord / Pending Approval status first.

---

## Sales Manager

Sales Manager is a separate application role.

A Sales Manager is positioned above the Verkoopleider level.

Primary scope:

- one or more assigned countries

Main purpose:

- management follow-up across one or more countries
- view teams, representatives and coaching activity within assigned countries
- plan and execute coachings on representatives and Verkoopleiders within assigned country scope
- monitor action points, risks and reports

Business rules:

- Sales Manager is not the same as Verkoopleider.
- Sales Manager is not the same as Country Manager.
- Sales Manager can have access to one or more countries.
- Sales Manager country scope is stored separately from the primary user country.
- A Sales Manager without assigned country rights must not see country-scoped Coaching data.
- Sales Manager sees teams and users within assigned countries.
- Sales Manager permissions must be configurable through role management.
- Sales Manager permissions must support user-level overrides.

Coaching navigation rules:

- Can view coachings within assigned country scope.
- Can view today's coachings, future coachings and historical coachings.
- Can fill in and modify visible coaching forms within assigned country scope.
- Can modify future coaching planning within assigned country scope.
- Can plan and execute coachings on representatives and Verkoopleiders within assigned country scope.
- Lifecycle locks such as Pending Approval and Completed remain read-only for every role.

Grouping rules:

- If access covers multiple countries, group by country, team and user.
- If access covers one country, omit country grouping and show team and user.

---

## Country Manager

A Country Manager is responsible for one country.

Primary scope:

- assigned country

Main purpose:

- country-level coaching follow-up
- view teams and representatives within own country
- plan and execute coachings on representatives and Verkoopleiders within assigned country scope
- monitor risks, action points and reports

General rules:

- Sees only the assigned country or countries for which access has been granted.
- Sees teams and users within assigned country scope.
- Can view coachings within assigned country scope.
- Can view today's coachings, future coachings and historical coachings.
- Can fill in and modify visible coaching forms within assigned country scope.
- Can modify future coaching planning within assigned country scope.
- Can plan and execute coachings on representatives and Verkoopleiders within assigned country scope.
- Lifecycle locks such as Pending Approval and Completed remain read-only for every role.

Grouping rules:

- If access covers one country, country grouping should be omitted.
- Show team and user grouping instead.

---

## Admin

An Admin manages operational configuration within assigned countries.

Primary scope:

- assigned country or countries

Main purpose:

- manage users within assigned scope
- manage teams within assigned scope
- manage configuration within assigned scope
- view coaching data within assigned scope
- plan and execute coachings on representatives and Verkoopleiders within assigned scope

General rules:

- Sees data within assigned country scope.
- Can view coachings within assigned country scope.
- Can fill in and modify visible coaching forms within assigned country scope.
- Can modify future coaching planning within assigned country scope.
- Can plan and execute coachings on representatives and Verkoopleiders within assigned scope.
- Lifecycle locks such as Pending Approval and Completed remain read-only for every role.
- Cannot grant Admin or Super Admin rights unless explicitly allowed by Super Admin policy.

Configuration rules:

- Can manage users within assigned countries when permission allows it.
- Can promote or demote users within allowed role boundaries when permission allows it.
- Must respect role configuration and user-level overrides.

---

## Super Admin

A Super Admin has full system access.

Primary scope:

- all countries
- all teams
- all users

Main purpose:

- full application administration
- global configuration
- cross-country visibility
- troubleshooting
- override and correction when required

General rules:

- Sees everything.
- Can open coachings with the same access level as a Verkoopleider.
- Can plan and execute coachings on Verkoopleiders across all countries and teams.
- Can open today's coachings in the coaching input form.
- Can open future coachings in planning/preparation mode.
- Can open historical coachings in report mode.
- Can manage roles, modules, users and settings.

Business rule:

Super Admin access must still preserve lifecycle rules unless an explicit administrative override is implemented.

Example:

- Pending Approval remains read-only unless the status is withdrawn first.

---

## Service Operator

A Service Operator is a field employee role that can appear in operational field lists such as Mijn Team.

Current status:

- Inclusion in Mijn Team is intended but still requires further specification.

Known rules:

- Service Operator is considered a field employee for Mijn Team unless business rules later define otherwise.
- Exact Coaching permissions for Service Operator are not yet fully defined.

AI rule:

Do not invent Service Operator coaching workflows or permissions.

---

# Main Menu Visibility

Main menu visibility is permission-driven.

Business rules:

- Menu items are not hardcoded per role.
- Each main menu item must be configurable through role management.
- User-level overrides can overrule role defaults.
- Representatives must not see Mijn Team.
- New main menu items require role permission configuration and user-level override support.
- Beheer subitems also require explicit menu permission keys and user-level override support.

---

# Coaching-Specific Access Rules

## Dashboard

The Dashboard is available for authenticated users.

Dashboard content depends on effective permissions.

Management widgets such as Team Heatmap, Coaching Trends and Management Alerts are intended for management users only.

## Beheer -> Log

Actiehistoriek is administrative logging and belongs under Beheer -> Log.

Permission:

- `menu.coaching.log`

Default visibility:

- Super Admin
- Admin

Business rules:

- Sales Manager, Country Manager, Verkoopleider and Vertegenwoordiger have no default log access.
- User-level overrides can enable or disable log access for a specific user.
- Direct route access and `/api/activity-history` reads must use the same effective log permission.

## Beheer -> Import/export

Management import/export is a Super Admin-only technical function.

Permission:

- `technicalImportExport`

Default visibility:

- Super Admin only

Business rules:

- The permission flag must remain visible in role management under technical management.
- Client-side visibility requires both role `SUPER_ADMIN` and effective `technicalImportExport`.
- Server-side API access must always require role `SUPER_ADMIN`, even if the permission flag is misconfigured for another role.
- Import/export covers users, teams, KPI definitions and the global coaching framework/kapstok.
- Imports must use validation/preview first and may only be committed after confirmation.
- Imports must not create dependent business records implicitly, such as missing teams during user import.
- Import audit logs may store topic and counts, but must not dump full personal CSV data.

## Beheer -> Instellingen

Global application settings are protected by the effective management
permission:

- `menu.coaching.settings`

Default visibility is Super Admin only. Role configuration and user-level
overrides remain authoritative. Direct API reads and updates must apply the
same effective permission as the page.

`MAIL TEST` is a global safety setting. It defaults to active and routes
connected mail flows to the configured test recipient. The default fallback is
`helpdesk@mext.be` when no recipient has been saved yet. Disabling production
protection requires the exact confirmation `PRODUCTIE`. Changes to the active
state and test recipient are audited.

## Nieuwe begeleiding

Visible when the user has permission to create coachings.

Typically visible for:

- Verkoopleider
- Sales Manager if explicitly allowed
- Country Manager if explicitly allowed
- Admin if explicitly allowed
- Super Admin

Not visible for:

- Vertegenwoordiger

Business rule:

The button must be controlled by permissions, not by hardcoded role checks.

---

## Mijn Team

Visibility rules:

- Vertegenwoordiger: not visible
- Verkoopleider: own team only
- Sales Manager: assigned country scope
- Country Manager: assigned country scope
- Admin: assigned country scope
- Super Admin: all countries

Mijn Team includes field employees.

Teams without an assigned Verkoopleider remain visible to Country Manager, Sales Manager, Admin and Super Admin users when the team falls inside their existing country or global scope.

Current intended roles:

- Vertegenwoordiger
- Verkoopleider
- Service Operator

Open point:

The exact inclusion rules still need to be specified.

---

## Begeleidingen

### Vertegenwoordiger

- only own coachings
- planned coachings only visible when notification was enabled
- surprise coachings hidden until Wachten op akkoord / Pending Approval
- cannot open unfinished coachings
- can open coachings for approval from Wachten op akkoord onwards
- cannot fill in or modify coaching forms

### Verkoopleider

- own team
- can open today's coachings in input form for representatives in own team
- can open future coachings in planning/preparation mode
- can edit future coachings when allowed by lifecycle
- can view historical coachings
- can be the target of a coaching by higher-level users

### Sales Manager

- assigned country scope
- can fill in and modify visible coaching forms and planning details
- can plan and execute coachings on representatives and Verkoopleiders within assigned country scope
- grouped by country, team and user when multiple countries
- country grouping hidden when only one country is available

### Country Manager

- assigned country scope
- can fill in and modify visible coaching forms and planning details
- can plan and execute coachings on representatives and Verkoopleiders within assigned country scope
- grouped by country, team and user when multiple countries
- country grouping hidden when only one country is available

### Admin

- assigned country scope
- can fill in and modify visible coaching forms and planning details
- can plan and execute coachings on representatives and Verkoopleiders within assigned country scope
- grouped by country, team and user when multiple countries
- country grouping hidden when only one country is available

### Super Admin

- all coachings
- can open coachings like a Verkoopleider
- can plan and execute coachings on representatives and Verkoopleiders across all countries and teams
- grouped by country, team and user
- country grouping is always visible

---

## Planning

Planning shows scheduled items.

Planning does not own the underlying business workflow.

Visibility is based on the user's effective scope.

Current Coaching-related item types:

- Begeleiding
- Contactmoment
- Retraining
- Salestraining
- Hulpaanvraag

Defined support workflow:

- Hulpaanvragen: representatives may create and withdraw their own untreated requests; manager-level roles in scope may answer, close or select one primary follow-up.

Undefined workflows:

- Contactmomenten
- Retrainingen
- Salestrainingen

AI rule:

Do not define missing workflows based on assumptions.

---

## Actiepunten

Action points exist at multiple scope levels:

- global
- country
- team
- individual user

Access to the Actiepunten overview also requires:

- active `ACTIEPUNTEN` module configuration
- effective `modulePreparation`
- effective `menu.coaching.actionPoints`

Action point creation and management are separate configurable permissions:

- `actionPointsCreate`
- `actionPointsManage`

Visibility rules:

### Vertegenwoordiger

- own action points only
- sees only the Actiepunten view on the Actiepunten page, not the Gebruikers tab
- cannot create or manage scoped action definitions

### Verkoopleider

- action points for own country, own team and users in own team
- can create personal action definitions for active representatives in own team when `actionPointsCreate` is effective
- can manage own-created personal action definitions in own team when `actionPointsManage` is effective
- cannot create or manage global, country or team action definitions

### Sales Manager

- action points within assigned country scope
- can create and manage country, team and personal action definitions within assigned countries
- cannot create or manage global action definitions by default

### Country Manager

- action points within assigned country scope
- can create and manage country, team and personal action definitions within assigned countries
- cannot create or manage global action definitions by default

### Admin

- action points within assigned country scope
- can create and manage global action definitions
- can create and manage country, team and personal action definitions within effective country scope

### Super Admin

- all action points
- can create and manage all action point scopes

### Group Manager

- all action points
- can create and manage all action point scopes

Open point:

Completion, approval, reopening and reassignment workflow still need business clarification.

---

## KPI Management

KPI management is controlled by dedicated permissions:

- `kpisView`
- `kpisCreate`
- `kpisManage`
- `kpiTargetsManage`
- `kpiCategoriesManage`

Access to `Beheer -> KPI's` also requires:

- effective `menu.coaching.kpis`
- effective `kpisView`

Visibility and management rules:

### Vertegenwoordiger

- can see applicable KPI data in user-facing KPI/reporting contexts when `kpisView` is effective
- cannot open KPI management by default
- cannot create or manage KPI definitions or targets

### Verkoopleider

- can view KPI management for applicable global, country, role and own-team KPI definitions when explicitly allowed by menu permissions
- cannot create or manage KPI definitions or targets by default

### Sales Manager

- can create and manage KPI definitions and targets within assigned country scope when effective permissions allow it
- cannot create global KPI definitions or global target values by default

### Country Manager

- can create and manage KPI definitions and targets within assigned country scope when effective permissions allow it
- cannot create global KPI definitions or global target values by default

### Admin

- can create and manage KPI definitions and targets within effective country scope
- can manage KPI categories by default

### Super Admin / Group Manager

- can view all KPI definitions and targets
- can create and manage all KPI scopes, including global definitions and target values

Target priority:

User-specific targets override team targets, team targets override country targets, country targets override role targets, and role targets override global/default values.

---

## Configurable Criteria Scope Management

Configurable criteria and score questions use the same cumulative scope levels:

- Global
- Country
- Team
- User

Business rules:

- Group Manager and Super Admin may create, change, remove and sort global criterion scope links.
- Sales Manager, Country Manager and Admin may view global criteria but must not change global links or deactivate globally scoped criteria.
- Sales Manager, Country Manager, Admin, Group Manager and Super Admin may manage country, team and user links only inside their existing country/team/user scope.
- Scope selection must always be checked server-side; hiding UI controls is not sufficient.
- Criterion selection for a coaching is based on the coached user, not on planner, executor or editor.
- The User scope may target every user who can be coached, not only representatives.

---

# Coaching Verkoopleiders

Verkoopleiders can be coaching targets.

This means the system must support coachings where the person being coached has the role:

- Verkoopleider

Business rules:

- A Verkoopleider is not only a coach; a Verkoopleider can also be coached.
- A user who is functionally above a Verkoopleider must be able to plan and execute coachings on Verkoopleiders within the user's effective scope.
- The selection flow for a new coaching must allow Verkoopleiders as possible coaching targets when permissions allow it.
- The approval lifecycle must work for Verkoopleiders as coached persons.
- The system must not assume that the coached person is always a Vertegenwoordiger.

Roles expected to support coaching Verkoopleiders, subject to permissions and scope:

- Sales Manager
- Country Manager
- Admin
- Super Admin

Scope rules:

- Sales Manager: assigned country or countries.
- Country Manager: assigned country scope.
- Admin: assigned country scope when explicitly configured.
- Super Admin: all countries and teams.

Restrictions:

- A regular Verkoopleider may only plan and execute coachings for representatives in own team unless explicitly allowed otherwise.
- A Vertegenwoordiger may not plan coachings.
- User-level overrides must be respected.

---

# Lifecycle-Based Permissions

Coaching access also depends on lifecycle status.

## Planned

- editable by authorised coach roles
- visible according to notification and scope rules

## In Progress

- editable by the coach while completing the form

## Incomplete

- editable by the coach
- not yet visible for representative unless business rule allows it

## Pending Approval / Wachten op akkoord

- read-only
- representative can review and approve
- no modifications allowed
- modifications require withdrawing the Pending Approval status first

## Completed / Afgewerkt

- locked
- visible in history
- included in reporting
- used for future comparisons and Performance Circle calculations

---

# AI Implementation Rules

AI assistants must follow these rules when implementing role or permission changes.

- Do not hardcode permissions when configuration exists.
- Do not assume that role name alone determines access.
- Always check role configuration and user-level overrides.
- Always apply country, team and user scope.
- Never give users broader access than explicitly requested.
- Never make planned surprise coachings visible to representatives.
- Never allow representatives to open unfinished coachings.
- Never allow modification of a coaching in Pending Approval unless the status is withdrawn first.
- Do not invent workflows for undefined modules.
- When adding a new menu item, also add permission configuration and user-level override support.
- Do not assume that the coached person is always a Vertegenwoordiger.
- Support Verkoopleiders as coaching targets where permissions allow it.
- When changing visibility, update this document and the relevant module documentation.
