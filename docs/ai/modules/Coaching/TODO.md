# Coaching TODO

This document tracks open implementation points, clarifications and follow-up items for the Coaching module.

Priority levels:

- High: required for correct functional behaviour or security.
- Medium: required for usability, maintainability or completeness.
- Low: improvement or refinement.

---

# Dashboard

## Aandacht vereist

Priority: High

Required changes:

- Build two sections:
  - Uit te voeren
  - Uitgevoerd
- Display all items planned for today.

Current issue:

- Items planned for today are currently not displayed.

Purpose:

- Give the user a reliable daily overview of everything that needs attention today.

---

## Actiehistoriek

Priority: Medium

Status: Completed on 2026-07-07

Implemented changes:

- Pagination has been added to the table.
- The Dashboard shows 15 action history items per page.
- Existing filters are preserved while navigating between pages.

Future:

- Move Actiehistoriek to Beheer -> Log when the administrative logging section is defined.

Architecture note:

- Action history should eventually move to Beheer → Log.
- It does not belong on the operational dashboard long term.

---

# Mijn Team

## Included Roles

Priority: Medium

Required clarification:

- Define exactly which roles are considered field employees for Mijn Team.

Current intended roles:

- Vertegenwoordiger
- Verkoopleider
- Service Operator

Open question:

- Confirm whether other operational roles should also appear here.

---

## Fiche Filtering

Priority: High

Required change:

- The employee fiche must be filtered based on active modules.

Business rule:

- Only information from active modules should be displayed.

Example:

- If a module is disabled for the user or role, related sections should not appear on the fiche.

---

## Planned Coaching Visual Indicator

Priority: Medium

Required changes:

- If a coaching is planned for a person, highlight the row in light blue.
- Add a badge to the row indicating that a coaching is planned.

Purpose:

- Make planned follow-up immediately visible from Mijn Team.

---

## Score-Based Visual Indicator

Priority: Medium

Required changes:

- If a representative has a bad score, highlight the row in light red.

Configuration requirement:

- The threshold between bad and good score must be configurable in Beheer → Instellingen.

Open question:

- Define the default threshold value.

---

# Begeleidingen

## Begeleiding op Verkoopleider kunnen inplannen

Priority: High

Current issue:

- Het inplannen van een begeleiding op een Verkoopleider werkt momenteel niet.

Required change:

- Een gebruiker die functioneel boven een Verkoopleider staat, moet een begeleiding kunnen inplannen op die Verkoopleider.
- Die gebruiker moet de begeleiding op de Verkoopleider ook kunnen uitvoeren.
- Verkoopleiders moeten dus ook als mogelijk begeleidingsdoelwit kunnen worden geselecteerd, niet enkel Vertegenwoordigers.

Business rules:

- Een Verkoopleider is niet enkel coach, maar kan zelf ook gecoacht worden.
- Rollen boven Verkoopleider moeten Verkoopleiders kunnen selecteren als begeleidingsdoelwit binnen hun toegestane land- en rechten-scope.
- De bestaande rechtenstructuur, landenscope en user-level overrides moeten gerespecteerd worden.
- Een gewone Verkoopleider mag enkel vertegenwoordigers van zijn eigen team begeleiden, tenzij expliciet anders toegestaan.
- Een Vertegenwoordiger mag geen begeleidingen inplannen.

Affected roles:

- Sales Manager
- Country Manager
- Admin
- Super Admin

Required checks:

- Nieuwe begeleiding inplannen
- Selectie van land
- Selectie van team
- Selectie van Verkoopleider als begeleidingsdoelwit
- Begeleiding tonen in Dashboard, Planning en Begeleidingen waar van toepassing
- Begeleidingsformulier openen
- Begeleiding uitvoeren
- Begeleiding opslaan
- Begeleiding op status Wachten op akkoord zetten
- Rechten en scope respecteren

Documentation impact:

- Update `docs/ai/modules/Coaching/FLOW.md`.
- Update `docs/ai/03_ROLES.md`.
- Update `docs/ai/modules/Coaching/Navigation.md` if navigation or selection behaviour changes.

---

## Empty Sections

Priority: Medium

Required changes:

- Hide "Begeleidingen van vandaag" when there are no coachings planned for today.
- Hide "Toekomstige begeleidingen" when there are no future coachings.
- Hide "Uitgevoerde begeleidingen" when there are no historical coachings.

Purpose:

- Avoid showing empty sections that add no value to the user.

---

## Role-Based Visibility

Priority: High

Current issue:

- Most permission rules for Begeleidingen still need to be implemented or verified.

Required rules:

Additional required rule:

- Users with a role above Verkoopleider must be able to plan and execute coachings on Verkoopleiders within their effective country and permission scope.

### Vertegenwoordiger

- Only sees own coachings.
- Sees planned coachings only when "representative must be informed" was enabled during planning.
- Does not see surprise coachings before they are submitted for approval.
- Cannot open unfinished coachings.
- Can open coachings from status "Wachten op akkoord" onwards.

### Verkoopleider

- Sees coachings for own team.
- Can open today's coachings in the coaching input form.
- Can open future coachings in planning/preparation mode.
- Can modify future coachings:
  - representative
  - date
  - start time
  - end time
  - focus areas / criteria
- Can view preparation data:
  - previous Performance Circle
  - previous scores
  - previous action points
  - preparation history

### Country Manager

- Sees coachings within assigned country scope.
- Can view today, future and historical coachings.
- Cannot edit coaching forms.
- Cannot modify planning.

### Sales Manager

- Sees coachings within assigned country scope.
- Can have access to one or more countries.
- Can view today, future and historical coachings.
- Cannot edit coaching forms.
- Cannot modify planning.

### Admin

- Sees coachings within assigned country scope.
- Can view today, future and historical coachings.
- Cannot edit coaching forms.
- Cannot modify planning.

### Super Admin

- Sees all coachings.
- Can open coachings like a Verkoopleider.

---

## Grouping by Scope

Priority: Medium

Required behaviour:

- Country Manager, Sales Manager, Admin and Super Admin see coachings grouped by:
  - country
  - team
  - user

- If the user has access to only one country, hide the country grouping and show:
  - team
  - user

Purpose:

- Keep the page compact and avoid redundant grouping.

---

## Representative Notification Logic

Priority: High

Required change:

- Implement the functional behaviour behind the planning checkbox:
  - "Representative must be informed"

Business rules:

- If enabled:
  - representative sees the coaching before execution
  - coaching appears in today/future sections when relevant

- If disabled:
  - representative must not see the planned coaching
  - representative only sees the coaching once it reaches "Wachten op akkoord"

Purpose:

- Support both announced and surprise coachings.

---

## Future Coaching Edit Mode

Priority: High

Required change:

- When a Verkoopleider or Super Admin opens a future coaching, open the planning/preparation screen.

The user must be able to modify:

- representative
- date
- start time
- end time
- focus areas / criteria

The user must also be able to view:

- previous Performance Circle
- previous scores
- previous action points
- preparation history

---

## Management View Mode

Priority: Medium

Required change:

- Country Managers, Sales Managers and Admins must open today and future coachings in view/preparation mode only.

They must not be able to:

- fill in the coaching form
- modify planning details
- change focus areas
- change representative

---

# Actiepunten

## Functional Implementation

Priority: High

Current status:

- The Actiepunten page exists visually.
- The functional implementation is not yet completed.

Required change:

- Build the functional action point overview.

The overview must show action points for:

- global scope
- country scope
- team scope
- individual user scope

---

## Sections

Priority: High

Required change:

- Show action points in two sections:
  - Open
  - Afgesloten

Purpose:

- Separate active follow-up from completed action points.

---

## Type Badges

Priority: Medium

Required change:

- Each action point must display a badge showing its type.

Required badges:

- Globaal
- Land
- Team
- Persoonlijk

Purpose:

- The user must immediately understand why the action point is visible and what scope it belongs to.

---

## Detail View

Priority: Medium

Required change:

- Clicking an action point must open the action point detail view.

Open question:

- The exact fields and actions in the detail view still need to be discussed with the business.

---

## Visibility Rules

Priority: High

Required change:

- Implement role-based and scope-based visibility.

### Vertegenwoordiger

- Only sees own action points.

### Verkoopleider

- Sees all action points that apply to:
  - own country
  - own team
  - users in own team

### Country Manager

- Sees all action points that apply to assigned countries, teams and users.

### Sales Manager

- Sees all action points that apply to assigned countries, teams and users.

### Admin

- Sees all action points that apply to assigned countries, teams and users.

### Super Admin

- Sees all action points.

---

## Business Alignment

Priority: High

Required action:

- Discuss the detailed action point workflow with the business.

Topics to define:

- who can create action points
- who can close action points
- whether action points require approval
- whether action points can expire
- whether action points can be reassigned
- whether action points can originate outside a coaching
- which fields are mandatory
- which statuses are required

---


# Planning

## FieldForce Items Must Appear Before Existing Calendar Appointments

Priority: High

Current issue:

- Items planned from within the FieldForce app are currently displayed after already existing appointments in the Planning menu item.

Required change:

- Items created in FieldForce and synced to the calendar must be shown before all other existing calendar appointments in Planning.

Business rule:

- FieldForce-created planning items are operationally leading inside the FieldForce Planning view.
- Synced external calendar appointments may still be shown, but they must not visually take priority over FieldForce-created items.

Affected item types:

- Begeleiding
- Contactmoment
- Retraining
- Salestraining
- Hulpaanvraag

Required checks:

- Planning day view
- Planning week view, if available
- Planning list view, if available
- Outlook-synced FieldForce items
- Existing Outlook appointments
- Sorting when FieldForce items and existing appointments have the same date or start time
- Role and scope visibility

Expected result:

- FieldForce-created items appear first.
- Existing calendar appointments appear after FieldForce-created items.
- The visual order remains stable after refresh or sync.
- No duplicate calendar items are created.

Important:

- Do not change the ownership of Planning items.
- Planning may display synced calendar appointments, but FieldForce business items must remain visually prioritised.
- Do not break Outlook synchronisation.

---
# Undefined Coaching Modules

Priority: High

The following modules still require business clarification before functional implementation:

- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Rapportage

Required action:

- Define the purpose of each module.
- Define who can use each module.
- Define what users can create, open, edit or close.
- Define statuses.
- Define permissions.
- Define whether items appear in Planning.
- Define whether items appear on Dashboard.
- Define whether items create action points.
- Define whether items are included in reporting.

AI rule:

- No implementation should be based on assumptions while these workflows are still undecided.

---

# Roles

## Sales Manager Role

Priority: High

Status: Completed on 2026-07-07

Required change:

- Add Sales Manager as a separate application role.

Position:

- Above Verkoopleider
- Country-scoped
- Can have access to one or more countries

Business rules:

- Sales Manager is not the same as Verkoopleider.
- Sales Manager is not the same as Country Manager.
- Sales Manager sees teams and users within assigned countries.
- Sales Manager permissions must be configurable through role management.
- Sales Manager permissions must support user-level overrides.

Required checks:

- Main menu visibility
- Mijn Team visibility
- Begeleidingen visibility
- Dashboard widgets
- Planning visibility
- Action point visibility
- Reporting visibility

Implemented:

- Added `SALES_MANAGER` as a distinct application role.
- Added separate country-scope storage for roles with multi-country access.
- Made Sales Manager available in user management with configurable role permissions and user-level overrides.
- Applied assigned-country scope to Coaching visibility, Mijn Team, coaching participant selection and action-point definitions.
- Kept Sales Manager separate from Admin and Super Admin; no technical management, role management or module management rights are granted by default.
- Added focused tests for menu visibility, Mijn Team scope and Coaching visibility.

Restpunten:

- Browser-based visual validation remains to be performed by the user through the externally managed local devserver.
- `prisma generate` may need to be rerun after the external devserver releases the Prisma engine file lock.

---

# General Permission System

## Role and User-Level Overrides

Priority: High

Required rule:

- Every main menu item must be configurable through role management.
- Every main menu item must support user-level overrides.

Business rules:

- Role permissions define default navigation visibility.
- User-level overrides can enable or disable access for a specific user.
- Effective permissions must always be used when rendering navigation.
- No new main menu item may be added without corresponding role and user override support.
