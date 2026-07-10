# Coaching Navigation

This document describes the functional navigation within the Coaching module of MExT FieldForce.

It describes how users move through the module. It does not describe technical routes, React components, database models or API endpoints.

Navigation visibility is permission-driven and depends on:

- role configuration
- user-level overrides

This document describes possible navigation paths. Actual visibility is determined by the effective permission model.

---

# Navigation Visibility

Menu items are not hardcoded per role.

Each main navigation item must be configurable through role management.

A user-level override can overrule the role configuration.

Business rules:

- Role permissions define default visibility of navigation items.
- User-level permissions can override role permissions.
- A navigation item must only be visible when the effective permission allows it.
- Adding a new main navigation item requires a corresponding permission setting in role management.
- Adding a new main navigation item must also support user-level override.

AI implementation rule:

When adding or changing navigation, always check:

- role permission configuration
- user-level override configuration
- menu rendering logic
- related page access guards
- documentation

---

# Roles Used in Navigation

The Coaching module uses the following relevant roles.

## Vertegenwoordiger

Field sales representative.

Scope:

- own data only

## Verkoopleider

Team-level sales leader.

Scope:

- own team only

## Country Manager

Country-level manager.

Scope:

- assigned country scope

## Sales Manager

Sales Manager is a separate application role.

A Sales Manager is positioned above the Verkoopleider team level.

A Sales Manager can have access to one or more countries.

Scope:

- one or more assigned countries
- teams and users within assigned countries

Business rules:

- Sales Manager is not the same as Verkoopleider.
- Sales Manager is not the same as Country Manager.
- Sales Manager access must respect role configuration and user-level overrides.

## Admin

Administrative role with access to assigned countries.

Scope:

- assigned countries
- teams and users within assigned countries

## Super Admin

Global administrator.

Scope:

- all countries
- all teams
- all users

## Service Operator

Operational field role.

Scope:

- still needs to be defined further where relevant

---

# Main Coaching Navigation Items

The Coaching module may contain the following functional navigation areas.

Visibility is controlled through permissions.

- Dashboard
- Mijn Team
- Planning
- Begeleidingen
- Actiepunten
- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage

Some functional areas are not yet fully defined. Undefined modules must not be implemented based on assumptions.

---

# Dashboard Navigation

The Dashboard is the primary entry point of the Coaching module.

Dashboard elements may be visible or hidden depending on the user's effective permissions.

This section describes where dashboard elements navigate to when visible.

---

## Nieuwe begeleiding

Target:

- Coaching planning flow

Description:

Starts the workflow to create and schedule a new coaching.

Reference:

- FLOW.md → Flow 1 – Planning a Coaching

Business rule:

- This action is not visible for representatives.

---

## Geplande begeleidingen

Target:

- List of planned, not yet executed coachings

Description:

Opens an overview of all coachings that have been scheduled but not yet executed.

---

## Open actiepunten

Target:

- Action point overview

Description:

Opens a list of all open action points.

The list must support grouping or filtering by:

- country
- team
- individual representative

---

## Verslagen wachtend op akkoord

Target:

- Approval overview

Description:

Opens a list of all coaching reports that are waiting for representative approval.

The list must support grouping or filtering by:

- country
- team
- individual representative

The list must also include overdue approval requests.

---

## Aandacht vereist

Target:

- Attention overview

Description:

Opens or displays items that require action.

This includes:

- items scheduled for today
- overdue coachings waiting for approval
- coachings that were started but not completed

Purpose:

Provide a daily operational overview of everything that requires follow-up.

Current implemented behaviour:

- The dashboard splits this area into two sections:
  - Uit te voeren
  - Uitgevoerd
- Visible FieldForce items planned for today are displayed.
- Clicking an item opens the existing source workflow where that workflow is implemented and available to the current user.
- Undefined module workflows are not invented from this Dashboard entry point.

---

## Eerstvolgende momenten

Target:

- Future activity overview

Description:

Displays all future scheduled moments.

Sorting:

- nearest date first

Selecting an item should open the related object when applicable.

Examples:

- coaching
- contact moment
- retraining
- sales training

---

## Team in beeld

Target:

- Team overview / representative overview

Description:

Displays all visible team members.

Team members are visually marked based on status.

Business rules:

- If a user has an open issue requiring attention, the visual status should indicate this.
- If a representative has an overdue approval request, the representative should be marked red.
- The representative role badge should indicate how the representative is currently scoring.
- The initials badge should indicate whether action is expected from the current user.

Purpose:

Allow coaches and management users to immediately see which team members require attention.

---

## Actiehistoriek

Target:

- Beheer -> Log

Description:

Displays a history of actions performed by users in the administrative logging section.

This is no longer a Dashboard widget.

Current dashboard behaviour:

- the operational Dashboard does not show Actiehistoriek

Architecture note:

Action history is not part of the operational dashboard workflow.

It belongs in Beheer -> Log.

Current implemented behaviour:

- Pagination is available.
- 15 items are shown per page.
- Existing filters remain active while navigating pages.
- Visibility and direct access require effective `menu.coaching.log`.
- Super Admin and Admin have default access.
- Other roles require an explicit user-level override.

---

# Header ToDo Notification

The global header contains a compact ToDo bell.

Purpose:

- show whether the active user has personal visible open ToDo's;
- provide a compact dropdown with the same visible daily workflow items used by Dashboard `Aandacht vereist` and `/taken-vandaag`;
- add approval ToDo's for visible Begeleidingen that are waiting for the coached person's approval.

Business rules:

- The bell must not own or duplicate workflow logic.
- The bell uses existing visible workflow data after effective permission, module, country, team and user-scope filtering, and then narrows it to items personally assigned to or directly linked to the active user.
- The red bell state and count may only be based on personal items visible to the active user.
- Super Admins, management users and Verkoopleiders must not see header ToDo's for other users through their broader scope.
- Hidden surprise coachings must not be revealed through bell colour, count or dropdown content.
- `Wachten op akkoord` / `verzonden_ter_akkoord` counts as an approval ToDo for the header bell only for the coached person while the existing approval data still indicates that approval is needed.
- In-app approval notifications use the existing `Approval` record as source of truth; `Approval.openedAt` is the read marker for the coached person.
- The header may poll for current-user notifications and show a toast/ping, but it must still open the existing Begeleiding detail route and must not create a second approval workflow.
- Clicking a ToDo row opens the existing source route or detail flow, such as the Begeleiding form/detail route through the shared coaching open helper.
- Undefined workflows for Contactmomenten, Retrainingen, Salestrainingen and Hulpaanvragen must not be expanded from the header.

---

# Beheer Navigation

Beheer contains administrative and configuration screens.

Visibility is controlled by effective menu permissions. The same effective permission must be used for:

- sidebar visibility
- app-switcher visibility
- direct route access
- related API reads where the data is administrative

## Log

Route:

- Beheer -> Log

Permission:

- `menu.coaching.log`

Purpose:

- show Actiehistoriek for the user's allowed scope

Default visibility:

- Super Admin
- Admin

Business rules:

- Sales Manager, Country Manager, Verkoopleider and Vertegenwoordiger do not have default log access.
- User-level overrides can explicitly enable or disable log access.
- Direct `/beheer/log` access must be blocked when effective `menu.coaching.log` is false.
- `/api/activity-history` reads must require the same effective log permission.
- The log reuses the existing Actiehistoriek table, filters and pagination.

---

# Opening an Existing Coaching

A planned or existing coaching can be opened from multiple functional locations.

The entry point may differ, but the result must always be the same:

- the same coaching record
- the same coaching form
- the same business logic
- the same permissions
- the same lifecycle status

---

## Entry Points

### Dashboard

A coaching can be opened from Dashboard widgets such as:

- Geplande begeleidingen
- Aandacht vereist
- Eerstvolgende momenten

Target:

- Coaching Form

---

### Planning

A coaching can be opened from the Planning calendar.

Target:

- Coaching Form

Business rule:

Planning displays the coaching as a calendar item, but does not own the coaching workflow.

---

### Begeleidingen

A coaching can be opened from the Begeleidingen module.

Examples:

- Begeleidingen van vandaag
- Geplande begeleidingen
- Historiek
- Wachtend op akkoord
- Onvolledige begeleidingen

Target:

- Coaching Form

---

### Mijn Team

A coaching can be opened from the representative profile.

Path:

Mijn Team  
→ Representative Profile  
→ Coaching  
→ Coaching Form

Target:

- Coaching Form

---

## Business Rule

There is only one coaching form.

Multiple pages may link to a coaching, but no page may implement its own separate coaching workflow.

The Coaching Form is the single source of truth for viewing, editing, completing and approving a coaching.

---

## AI Implementation Rule

When adding a new entry point to an existing coaching:

- do not create a duplicate form
- do not duplicate coaching business logic
- route the user to the existing Coaching Form
- preserve the current coaching status
- preserve permissions
- preserve approval and locking rules

---

# Planning Navigation

Planning is the calendar view used by the Coaching module.

Planning can display multiple types of coaching-related activities.

Planning itself does not own the underlying business workflow.

It only displays scheduled items and opens the correct related form.

---

## Planning Item Types

### Begeleiding

Target:

- Coaching Form

Description:

Opens the form used to execute or review the coaching.

Business rule:

The coaching form is the same form that can also be opened from:

- Dashboard
- Begeleidingen
- Mijn Team

---

### Contactmoment

Target:

- Contact Moment Form

Description:

Opens the form used to register or complete a contact moment.

Current status:

- Workflow still under business discussion.

---

### Retraining

Target:

- Retraining Form

Current status:

- Exact form behaviour still needs to be defined.
- Workflow still under business discussion.

Expected behaviour:

- Clicking a retraining item should open a dedicated input form.

---

### Salestraining

Target:

- Sales Training Form

Current status:

- Exact form behaviour still needs to be defined.
- Workflow still under business discussion.

Expected behaviour:

- Clicking a sales training item should open a dedicated input form.

---

### Hulpaanvraag

Target:

- Support Request Form

Current status:

- Exact form behaviour still needs to be defined.
- Workflow still under business discussion.

Expected behaviour:

- Clicking a support request item should open a dedicated input or follow-up form.

---

## Not Currently Supported

There are currently no other Planning item types within the Coaching module.

---

## Business Rules

- Planning may show different activity types.
- Each Planning item must open the correct related form.
- Planning must not duplicate the business logic of the related module.
- Adding a new Planning item type requires a clear target form.
- Unknown or undefined item types should not be added until their workflow is defined.

---

# Mijn Team Navigation

## Purpose

Mijn Team provides access to field employees within the user's allowed scope.

The page groups people by:

Country  
→ Team  
→ Person

The purpose is to give coaches and management users a quick overview of the people they are allowed to follow up.

---

## Included People

Mijn Team contains field employees.

Current intended roles:

- Vertegenwoordiger
- Verkoopleider
- Service Operator

Open implementation note:

- The exact inclusion rules still need to be specified further.

---

## Sorting and Grouping

People are grouped by:

1. Country
2. Team
3. Person

Business rule:

Within each team, the Verkoopleider must be shown first.

Other team members are listed below.

---

## Visibility Rules

Mijn Team is not visible for representatives.

Visibility depends on the user's role and effective permissions.

### Vertegenwoordiger

- Does not see the Mijn Team main menu item.

### Verkoopleider

- Sees only own team.

### Country Manager

- Sees only the country or countries for which access has been granted.

### Sales Manager

- Sees all countries for which access has been granted.

### Admin

- Sees all countries for which access has been granted.

### Super Admin

- Sees everything.

---

## Main Navigation

### Fiche

Each person row contains a **Fiche** action.

Target:

- Employee / Representative profile page

Description:

Opens the profile page of the selected field employee.

The fiche is the central place to view details about the employee and related coaching information.

Open implementation note:

- The fiche must be filtered based on active modules.
- Only information from active modules should be displayed.

---

## Visual Status Rules

The row should visually communicate the status of the person.

Current behaviour:

- If a visible coaching is planned for the person today or in the future, the row is highlighted light blue.
- If a visible coaching is planned, a `Begeleiding gepland` badge is shown on the row.
- Surprise coachings that are hidden for the representative do not create an indirect visual indicator.

Planned behaviour:

- If the person has a bad score, the row should be highlighted light red.

The score threshold between bad and good must be configurable.

Expected configuration location:

- Beheer
- Instellingen

---

## Business Rules

- Mijn Team must respect role permissions and user-level overrides.
- Representatives must never see the Mijn Team main menu item.
- Verkoopleiders may only see their own team.
- Country Managers only see people within their authorised country scope.
- Sales Managers only see people within their authorised country scope.
- Admin users only see people within their authorised country scope.
- Super Admin users see all countries, teams and people.
- Clicking **Fiche** opens the profile page of the selected person.
- The list must remain grouped by country and team.
- The team leader must appear first within each team.

---

# Begeleidingen Navigation

## Purpose

The Begeleidingen page is the central overview for coaching sessions.

It allows users to view coachings based on date, status and user visibility scope.

The page is accessed through the main navigation item:

Begeleidingen

---

## Page Sections

When the Begeleidingen main menu item is opened, coachings are shown in the following order.

---

### Begeleidingen van vandaag

Contains coachings planned for the current day.

Sorting:

- by start time

Navigation:

- clicking a coaching opens the coaching input form when the user has edit rights
- clicking a coaching opens the preparation/view mode when the user only has view rights

Current behaviour:

- keep this section visible when there are no coachings planned for today
- show the existing empty state in the section body

---

### Toekomstige begeleidingen

Contains coachings planned for a future date.

Sorting:

- date and time ascending

Navigation for every role except Representatives:

- opens the same planning/preparation screen used when the coaching was created
- allows changing:
  - representative
  - date
  - start time
  - end time
  - selected focus areas / criteria
- allows viewing preparation information:
  - previous Performance Circle
  - previous scores
  - previous action points
  - other preparation data

Navigation for Representatives:

- unfinished coachings cannot be opened
- coaching forms can never be filled in or modified
- lifecycle visibility rules continue to determine when review is possible

Current behaviour:

- keep this section visible when there are no future coachings planned
- show the existing empty state in the section body

---

### Uitgevoerde begeleidingen

Contains historical coachings.

Sorting:

- newest first

Navigation:

- clicking **Bekijk verslag** opens the coaching report / coaching dossier
- completed or submitted coachings are opened in read-only mode unless the lifecycle status allows changes

Current behaviour:

- keep this section visible when there are no historical coachings
- show the existing empty state in the section body

---

## Search and Filters

The page contains:

- search field
- status filter
- period filter

Purpose:

Allow users to quickly find coachings within their allowed scope.

---

# Begeleidingen Visibility and Permission Rules

Most of these rules still need to be implemented or verified.

---

## Vertegenwoordiger

A representative only sees own coachings.

### Planned Coachings

A representative may see planned coachings only when the coach explicitly enabled notification during planning.

Business rules:

- If "representative must be informed" was enabled during planning, the representative can see the coaching in:
  - Begeleidingen van vandaag
  - Toekomstige begeleidingen

- If "representative must be informed" was not enabled, the representative must not see the planned coaching.

### Coachings Waiting for Approval

A representative can see a coaching once it has at least the status:

- Pending Approval / Wachten op akkoord

Business rules:

- Representatives cannot open unfinished coachings.
- Representatives can only open coachings for review/approval once the coaching has been submitted for approval.

---

## Verkoopleider

A Verkoopleider sees coachings for people in own team.

Sections visible:

- Begeleidingen van vandaag
- Toekomstige begeleidingen
- Uitgevoerde begeleidingen

Navigation rules:

### Today

Clicking a coaching planned for today opens the coaching input form.

### Future

Clicking a future coaching opens the planning/preparation screen.

The Verkoopleider may modify:

- representative
- date
- start time
- end time
- selected focus areas / criteria

The Verkoopleider may also view preparation information:

- previous Performance Circle
- previous scores
- previous action points
- preparation history

### History

Historical coachings open the coaching report / dossier.

---

## Country Manager

A Country Manager sees coachings within the assigned country scope.

The overview is grouped by:

- country
- team
- user

If the Country Manager only has access to one country, the country grouping should be omitted.

In that case, show only:

- team
- user

Navigation rules:

- today and future coachings open in editable planning/execution mode within scope
- coaching form editing is allowed
- planning modifications are allowed within scope
- historical coachings open in read-only report mode

---

## Sales Manager

A Sales Manager sees coachings within the assigned country scope.

A Sales Manager can have access to one or more countries.

The overview is grouped by:

- country
- team
- user

If the Sales Manager only has access to one country, the country grouping should be omitted.

In that case, show only:

- team
- user

Navigation rules:

- today and future coachings open in editable planning/execution mode within scope
- coaching form editing is allowed
- planning modifications are allowed within scope
- historical coachings open in read-only report mode

---

## Admin

An Admin sees coachings within the assigned country scope.

The overview is grouped by:

- country
- team
- user

If the Admin only has access to one country, the country grouping should be omitted.

In that case, show only:

- team
- user

Navigation rules:

- today and future coachings open in editable planning/execution mode within scope
- coaching form editing is allowed
- planning modifications are allowed within scope
- historical coachings open in read-only report mode

---

## Super Admin

A Super Admin sees all coachings.

The overview is grouped by:

- country
- team
- user

Country grouping is always kept for Super Admin.

Navigation rules:

- can open coachings with the same access level as a Verkoopleider
- can open today coachings in the coaching input form
- can open future coachings in the planning/preparation screen
- can open historical coachings in report mode

---

# Begeleidingen Business Rules

- Begeleidingen is the central overview page for coaching sessions.
- The page must respect role permissions and user-level overrides.
- The page must respect country and team scope.
- Representatives only see own coachings.
- Representatives only see planned coachings when notification was enabled during planning.
- Representatives never open unfinished coachings.
- Representatives only open coachings once they are submitted for approval.
- Every role except Representative can open and edit visible coachings within its effective scope.
- This includes Verkoopleider, Sales Manager, Country Manager, Admin, Group Manager, Service Operator and Super Admin.
- Country, team and user scope continue to restrict which coachings can be edited.
- Pending Approval, Completed and other locked lifecycle states remain read-only for every role.
- Representatives can review but never edit a coaching form.
- If a Country Manager, Sales Manager or Admin only has access to one country, country grouping should be hidden to reduce visual noise.
- Super Admins always keep country grouping.
- Today, future and historical sections remain visible when empty.
- Empty country/team/user subgroups are not shown.

---

# Actiepunten Navigation

## Purpose

The Actiepunten page is the central overview for all action points within the Coaching module.

It must show action points that apply globally, by country, by team and by individual user.

The page is accessed through the main navigation item:

Actiepunten

---

## Current Status

The Actiepunten page has a first functional read-only overview.

Current implemented behaviour:

- open / to-do action points are shown in two tabs:
  - Actiepunten
  - Gebruikers
- for the Vertegenwoordiger role, only the Actiepunten view is shown; the Gebruikers tab is hidden.
- both tabs have a search field
- the Actiepunten tab groups visible open action points in collapsible scope groups:
  - Globaal
  - Land
  - Team
  - Persoonlijk
- the Gebruikers tab shows the same visible open action points grouped per visible user
- each item displays a Globaal, Land, Team or Persoonlijk badge
- visible data is filtered by active module state, effective permissions and role/country/team/user scope
- concrete workflow action points from visible coaching-related workflows are shown as personal/user-scoped items
- no create, edit, close, approval, expiry or reassignment workflow is implemented from this page

The detailed business process must still be discussed with the business.

---

## Action Point Types

The page must support the following action point types.

### Global

Applies to all relevant users.

### Country

Applies to users within a specific country.

### Team

Applies to users within a specific team.

### Personal

Applies to one specific user.

---

## Page Tabs

Action points are shown in two main tabs.

### Actiepunten

Contains active action points that still require follow-up.

### Gebruikers

Contains active action points grouped per visible user.

---

## Visual Indicators

Each action point must show a badge indicating its type.

Badge types:

- Globaal
- Land
- Team
- Persoonlijk

Purpose:

The user must immediately understand why the action point is visible and to whom it applies.

---

## Navigation

### Click Action Point

Target:

- No separate action workflow yet

Description:

The current overview is read-only. Clicking an action point must not create a new edit, close, approval, expiry or reassignment workflow.

Exact detail behaviour still needs to be defined with the business.

---

## Visibility Rules

### Vertegenwoordiger

A representative only sees own action points.

This includes:

- global action points when the module and permission allow it
- personal action points assigned to the representative

Representatives do not see team, country or personal action points of others from this overview.

Representatives also do not see the Gebruikers tab or user-grouped management view on the Actiepunten page.

---

### Verkoopleider

A Verkoopleider sees all action points that apply to:

- own country
- own team
- users in own team

---

### Country Manager

A Country Manager sees all action points that apply to the countries, teams and users within the assigned country scope.

---

### Sales Manager

A Sales Manager sees all action points that apply to the countries, teams and users within the assigned country scope.

A Sales Manager can have access to one or more countries.

---

### Admin

An Admin sees all action points that apply to the countries, teams and users within the assigned country scope.

---

### Super Admin

A Super Admin sees all action points.

---

## Business Rules

- Action points can exist at multiple scope levels:
  - global
  - country
  - team
  - individual user
- Action points must be divided into:
  - open
  - closed
- Each action point must clearly show its type.
- Users must only see action points that apply to their effective permission scope.
- The current overview is read-only.
- Detail and business action workflows remain undefined.
- The detailed action point workflow still needs to be defined with the business.

---

# Modules Not Yet Functionally Defined

The following Coaching-related modules exist as intended functional areas, but their detailed workflows are not yet defined.

They must not be implemented based on assumptions.

---

## Contactmomenten

Current status:

- Workflow still under business discussion.

Navigation rule:

- Do not define final navigation behaviour until the business workflow is confirmed.

---

## Retrainingen

Current status:

- Workflow still under business discussion.

Navigation rule:

- Do not define final navigation behaviour until the business workflow is confirmed.

Expected direction:

- A planned retraining item should eventually open a dedicated input form.

---

## Salestrainingen

Current status:

- Workflow still under business discussion.

Navigation rule:

- Do not define final navigation behaviour until the business workflow is confirmed.

Expected direction:

- A planned sales training item should eventually open a dedicated input form.

---

## Hulpaanvragen

Current status:

- Workflow still under business discussion.

Navigation rule:

- Do not define final navigation behaviour until the business workflow is confirmed.

Expected direction:

- A support request should eventually open a dedicated input or follow-up form.

---

## Rapportage

Current status:

- Reporting requirements still need to be defined further.
- The existing smart-coaching management insight widgets **Coaching Trends** and **Management Alerts** are shown on the Rapportering overview.
- These widgets reuse the existing dashboard/reporting data sources and do not introduce a new reporting workflow.

Navigation rule:

- Do not define final reporting navigation until reporting scope, filters and target users are confirmed.

---

# AI Rule for Undefined Workflows

If a module workflow is marked as not yet defined, AI assistants must not invent:

- screens
- statuses
- fields
- permissions
- approval flows
- calculations
- navigation behaviour

Instead, the missing business requirement must be clarified first.

---

# Cross-Module Navigation Rules

These rules apply to all navigation inside the Coaching module.

- Navigation must respect effective permissions.
- Navigation must respect country, team and user scope.
- Navigation must not duplicate business workflows.
- Multiple pages may open the same object.
- When multiple pages open the same object, they must open the same form or view mode.
- Planning displays objects but does not own their workflows.
- Dashboard displays operational entry points but does not own their workflows.
- Begeleidingen is the central overview for coaching sessions.
- Mijn Team is the central people overview for field employees.
- Actiepunten is the central overview for follow-up actions.
- Undefined workflows must not be implemented based on assumptions.
