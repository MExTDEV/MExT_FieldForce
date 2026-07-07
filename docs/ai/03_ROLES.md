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

## User-Level Overrides

A user-level override can overrule the default role configuration.

Business rules:

- Role permissions define the default configuration.
- User overrides can enable or disable access for an individual user.
- Effective permissions are calculated from role permissions plus user-level overrides.
- New main menu items must always support role configuration and user-level override.

---

# Scope Model

Access is not only role-based. It is also scope-based.

The main scopes are:

- own user
- own team
- assigned country
- multiple assigned countries
- all countries

Business rule:

When showing lists, dashboards or reports, the system must always filter data to the user's effective scope.

---

# Roles

## Vertegenwoordiger

A Vertegenwoordiger is a field sales representative.

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

Coaching visibility rules:

- If the representative was notified during planning, the planned coaching may be visible before execution.
- If the representative was not notified during planning, the planned coaching must remain hidden.
- Surprise coachings become visible only from status Wachten op akkoord / Pending Approval onwards.
- The representative may not open unfinished coachings.

---

## Verkoopleider

A Verkoopleider is the direct sales manager of a team.

Primary scope:

- own team

Main purpose:

- plan coachings for representatives in own team
- execute coachings
- create action points
- follow up team members
- view team coaching history

General rules:

- Sees only own team in Mijn Team.
- Can plan coachings for own team members.
- Can open today's coachings in the coaching input form.
- Can open future coachings in planning/preparation mode.
- Can edit future coachings within own team when lifecycle status allows it.
- Can modify representative, date, time and focus areas for future coachings when allowed.
- Can view previous scores, previous Performance Circle and previous action points as preparation.

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
- monitor action points, risks and reports

Business rules:

- Sales Manager is not the same as Verkoopleider.
- Sales Manager is not the same as Country Manager.
- Sales Manager can have access to one or more countries.
- Sales Manager sees teams and users within assigned countries.
- Sales Manager permissions must be configurable through role management.
- Sales Manager permissions must support user-level overrides.

Coaching navigation rules:

- Can view coachings within assigned country scope.
- Can view today's coachings, future coachings and historical coachings.
- Opens today and future coachings in preparation/view mode unless explicitly granted edit rights.
- Does not fill in coaching forms by default.
- Does not modify planning by default.

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
- monitor risks, action points and reports

General rules:

- Sees only the assigned country or countries for which access has been granted.
- Sees teams and users within assigned country scope.
- Can view coachings within assigned country scope.
- Can view today's coachings, future coachings and historical coachings.
- Opens today and future coachings in preparation/view mode.
- Does not edit coaching forms by default.
- Does not modify planning by default.

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

General rules:

- Sees data within assigned country scope.
- Can view coachings within assigned country scope.
- Opens today and future coachings in preparation/view mode.
- Does not edit coaching forms by default.
- Does not modify planning by default.
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

---

# Coaching-Specific Access Rules

## Dashboard

The Dashboard is available for authenticated users.

Dashboard content depends on effective permissions.

Management widgets such as Team Heatmap, Coaching Trends, Management Alerts and Activity History are intended for management users only.

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

### Verkoopleider

- own team
- can open today's coachings in input form
- can open future coachings in planning/preparation mode
- can edit future coachings when allowed by lifecycle
- can view historical coachings

### Sales Manager

- assigned country scope
- view mode by default
- grouped by country, team and user when multiple countries
- country grouping hidden when only one country is available

### Country Manager

- assigned country scope
- view mode by default
- grouped by team and user when only one country is available

### Admin

- assigned country scope
- view mode by default

### Super Admin

- all coachings
- can open coachings like a Verkoopleider

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

Undefined workflows:

- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen

AI rule:

Do not define missing workflows based on assumptions.

---

## Actiepunten

Action points exist at multiple scope levels:

- global
- country
- team
- individual user

Visibility rules:

### Vertegenwoordiger

- own action points only

### Verkoopleider

- action points for own country, own team and users in own team

### Sales Manager

- action points within assigned country scope

### Country Manager

- action points within assigned country scope

### Admin

- action points within assigned country scope

### Super Admin

- all action points

Open point:

Detailed action point workflow still needs business clarification.

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
- When changing visibility, update this document and the relevant module documentation.
