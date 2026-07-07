# Known Issues

This document lists known issues, recurring problems and open implementation risks for MExT FieldForce.

Purpose:

- Prevent AI assistants from repeatedly rediscovering the same problems.
- Make recurring issues visible before starting new development.
- Distinguish confirmed open issues from historical issues that must be rechecked.
- Avoid assumptions about whether a previous bug has already been fixed.

This document does not replace `TODO.md`.

Use:

- `TODO.md` for planned work and feature backlog.
- `KNOWN_ISSUES.md` for defects, recurring risks and things that regularly break.

---

# Status Legend

## Confirmed Open

The issue is known and still needs implementation or verification.

## Historical / Verify

The issue occurred before and may already be fixed.

Do not assume it is fixed without checking.

## Recurring Risk

The issue is not a single feature bug, but a recurring operational or architectural risk.

---

# Development / Runtime Issues

## Webserver not running on port 3000

Status:

Recurring Risk

Description:

After Codex changes, the local webserver has repeatedly not been running correctly on port 3000.

Expected behaviour:

- The development webserver must run on port 3000 unless explicitly changed.
- After changes, verify that the application is reachable.
- If the server is not running, restart it.
- If another port is used temporarily, document it clearly.

AI rule:

After code changes, always verify the dev server status before considering the task complete.

Related document:

- `docs/ai/06_DEPLOYMENT.md`

---

## Slow or unavailable local development server

Status:

Historical / Verify

Description:

The application has previously been reachable on a different port or has responded very slowly.

Expected behaviour:

- The application should be reachable on the expected development port.
- Performance should be acceptable for local validation.
- Port changes must not be left undocumented.

AI rule:

Do not assume the application is working because the build succeeded.

---

## Plesk / VPS deployment instability

Status:

Historical / Verify

Description:

The online environment has previously shown deployment/runtime issues such as application startup failures or server errors.

Expected behaviour:

- Production deployment must follow the deployment documentation.
- Node/Plesk startup configuration must not be changed without explicit need.
- Environment variables and startup commands must be verified when deployment fails.

Related documents:

- `docs/ai/06_DEPLOYMENT.md`
- `docs/technical/vps-deployment.md`

---

# Authentication and Sessions

## Microsoft login should be primary authentication method

Status:

Confirmed Open / Ongoing Principle

Description:

The application should use Microsoft Entra ID authentication.

Separate application login credentials should be avoided where possible.

Expected behaviour:

- First login may require “Aanmelden met Microsoft”.
- Later sessions should automatically recognise the user whenever possible.
- User identity and permissions must be derived from the authenticated account.

AI rule:

Do not introduce a separate login system unless explicitly requested.

---

## User sessions must remain reliable

Status:

Historical / Verify

Description:

There have previously been concerns that user sessions were not being stored or recognised correctly.

Expected behaviour:

- Users should remain authenticated when appropriate.
- Session handling must work consistently across roles.
- Permission checks must remain tied to the authenticated user.

AI rule:

When working on authentication, verify session persistence and permission resolution.

---

# Permissions and Roles

## Sales Manager role does not yet fully exist

Status:

Confirmed Open

Description:

Sales Manager is a separate application role.

It is positioned above Verkoopleider and can have access to one or more countries.

Expected behaviour:

- Sales Manager must be created as a distinct role.
- It must not be treated as Verkoopleider.
- It must not be treated as Country Manager.
- Access is country-scoped.
- Menu visibility and user-level overrides must support this role.

Related documents:

- `docs/ai/03_ROLES.md`
- `docs/ai/modules/Coaching/Navigation.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Menu visibility must be permission-driven

Status:

Confirmed Open / Ongoing Principle

Description:

Main menu items are enabled or disabled through role configuration, with user-level overrides.

Expected behaviour:

- Main menu visibility must not be hardcoded per role.
- Role configuration defines the default.
- User-level overrides can overrule the role.
- Adding a new main menu item requires permission settings in role management.

AI rule:

When adding a new menu item, also update:

- role permission configuration
- user override configuration
- menu rendering logic
- documentation

---

## Begeleidingen role visibility needs implementation and verification

Status:

Historical / Verify

Description:

Begeleidingen role visibility has been implemented in the shared client and server coaching access helpers. Browser-based visual verification and grouping by scope remain tracked in `docs/ai/modules/Coaching/TODO.md`.

Expected behaviour:

Representative:

- sees only own coachings
- sees planned coachings only when notification was enabled during planning
- does not see surprise coachings before they reach “Wachten op akkoord”
- cannot open unfinished coachings
- can open coachings from status “Wachten op akkoord” onwards

Verkoopleider:

- sees coachings for own team
- can open today coachings in the coaching input form
- can open future coachings in planning/preparation mode
- can modify future coachings within own team

Sales Manager:

- sees coachings within assigned country scope
- opens today/future coachings in view/preparation mode unless explicitly granted edit rights

Country Manager:

- sees coachings within assigned country scope
- opens today/future coachings in view/preparation mode only

Admin:

- sees coachings within assigned country scope
- opens today/future coachings in view/preparation mode only

Super Admin:

- sees all coachings
- can open coachings like a Verkoopleider

Related documents:

- `docs/ai/modules/Coaching/Begeleidingen.md`
- `docs/ai/modules/Coaching/TODO.md`

---

# Dashboard Issues

## “Vandaag vraagt aandacht” does not show planned items

Status:

Confirmed Open

Description:

The Dashboard should display items that require attention today, but planned items are currently not shown.

Expected behaviour:

The section should contain:

- Uit te voeren
- Uitgevoerd

It should automatically display every relevant item planned for today.

Related documents:

- `docs/ai/modules/Coaching/Dashboard.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Actiehistoriek probably belongs under Beheer → Log

Status:

Confirmed Open / Architectural Note

Description:

The Dashboard currently shows action history for management users.

Preferred future location:

- Beheer
- Log

Reason:

Action history is administrative logging and not part of the operational dashboard workflow.

Related documents:

- `docs/ai/modules/Coaching/Dashboard.md`
- `docs/ai/modules/Coaching/Navigation.md`
- `docs/ai/modules/Coaching/TODO.md`

---

# Mijn Team Issues

## Included roles need final specification

Status:

Confirmed Open

Description:

Mijn Team currently intends to show field employees.

Current intended roles:

- Vertegenwoordiger
- Verkoopleider
- Service Operator

Open question:

- Confirm whether other operational roles should also appear.

Related documents:

- `docs/ai/modules/Coaching/MijnTeam.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Fiche must be filtered by active modules

Status:

Confirmed Open

Description:

The employee fiche must show only information from active modules.

Expected behaviour:

- Disabled modules must not appear on the fiche.
- User and role permissions must be respected.
- Future modules must not appear until active and permissioned.

Related documents:

- `docs/ai/modules/Coaching/MijnTeam.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Visual indicators in Mijn Team are not complete

Status:

Confirmed Open

Description:

Mijn Team should visually communicate follow-up status.

Expected behaviour:

- planned coaching → light-blue row
- bad score → light-red row
- planned coaching → badge on row
- score threshold → configurable in Beheer → Instellingen

Open question:

- Default threshold between bad and good score must be defined.

Related documents:

- `docs/ai/modules/Coaching/MijnTeam.md`
- `docs/ai/modules/Coaching/TODO.md`

---

# Begeleidingen Issues

## Empty sections should be hidden

Status:

Confirmed Open

Description:

The Begeleidingen page should not show empty sections.

Expected behaviour:

Hide:

- Begeleidingen van vandaag when none exist
- Toekomstige begeleidingen when none exist
- Uitgevoerde begeleidingen when none exist

Related documents:

- `docs/ai/modules/Coaching/Begeleidingen.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Representative notification checkbox exists but workflow is incomplete

Status:

Historical / Verify

Description:

During coaching planning, the coach can choose whether the representative should be informed.

Current status:

- Checkbox exists.

Implemented behaviour:

If enabled:

- representative sees the coaching before execution
- coaching appears in today/future sections when relevant

If disabled:

- representative must not see the planned coaching
- representative only sees it once it reaches “Wachten op akkoord”

Related documents:

- `docs/ai/modules/Coaching/FLOW.md`
- `docs/ai/modules/Coaching/Begeleidingen.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Future coaching edit mode needs implementation

Status:

Historical / Verify

Description:

When a Verkoopleider or Super Admin opens a future coaching, Begeleidingen and Planning now route to the existing planning/preparation screen.

Expected editable fields:

- representative
- date
- start time
- end time
- focus areas / criteria

Expected preparation information:

- previous Performance Circle
- previous scores
- previous action points
- preparation history

Related documents:

- `docs/ai/modules/Coaching/Begeleidingen.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Management users must open coachings view-only

Status:

Historical / Verify

Description:

Country Managers, Sales Managers and Admins can view representative coachings within their scope, but cannot fill in or modify representative coachings by default. The API enforces the same manage rule.

Expected behaviour:

- today and future coachings open in preparation/view mode
- no form editing
- no planning modifications
- no changing representative
- no changing focus areas

Related documents:

- `docs/ai/modules/Coaching/Begeleidingen.md`
- `docs/ai/modules/Coaching/TODO.md`

---

# Coaching Form Issues

## WYSIWYG cursor jumps to beginning while typing action points

Status:

Historical / Verify

Description:

While filling in the WYSIWYG field for action point Tips & Tricks, the cursor previously jumped back to the beginning after each typed character.

Expected behaviour:

- Cursor position must remain stable while typing.
- Controlled editor state must not reset on every keystroke.
- Existing content must not be lost.

AI rule:

When modifying WYSIWYG fields, test typing behaviour.

---

## Coaching form lifecycle must remain locked after Pending Approval

Status:

Confirmed Open / Ongoing Rule

Description:

Once a coaching reaches “Wachten op akkoord”, it becomes read-only.

Expected behaviour:

- no modifications while in Pending Approval
- changes require withdrawing Pending Approval first
- after changes, the coaching must be submitted again for approval

Related documents:

- `docs/ai/modules/Coaching/FLOW.md`

---

# Actiepunten Issues

## Actiepunten page is not functionally implemented

Status:

Confirmed Open

Description:

The Actiepunten page exists visually, but functional implementation is not yet complete.

Expected behaviour:

- show global action points
- show country action points
- show team action points
- show personal action points
- split into Open and Afgesloten
- show type badges
- apply role and scope visibility
- clicking opens detail view

Related documents:

- `docs/ai/modules/Coaching/Actiepunten.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Detailed action point workflow still needs business definition

Status:

Confirmed Open

Open topics:

- who can create action points
- who can close action points
- whether action points require approval
- whether action points can expire
- whether action points can be reassigned
- whether action points can originate outside a coaching
- which fields are mandatory
- which statuses are required

AI rule:

Do not implement action point workflow assumptions before business definition is complete.

---

# Planning Issues

## Undefined planning item workflows

Status:

Confirmed Open

Description:

Some Planning item types exist conceptually but their workflows are not yet defined.

Undefined or partially defined:

- Retraining
- Salestraining
- Hulpaanvraag

Expected direction:

- each should eventually open a dedicated input or follow-up form

AI rule:

Do not invent form behaviour, statuses or fields.

Related documents:

- `docs/ai/modules/Coaching/Planning.md`
- `docs/ai/modules/Coaching/Navigation.md`

---

# Reporting and Undefined Modules

## Contactmomenten, Retrainingen, Salestrainingen, Hulpaanvragen and Rapportage require business clarification

Status:

Confirmed Open

Description:

These modules exist as intended functional areas, but detailed workflows are still under business discussion.

Required clarification:

- purpose
- users
- create/open/edit/close behaviour
- statuses
- permissions
- Planning visibility
- Dashboard visibility
- action point interaction
- reporting inclusion

AI rule:

Do not invent screens, fields, statuses, approval flows, calculations or navigation behaviour for these modules.

---

# Performance Circle and KPI Issues

## Performance Circle data visibility must be verified

Status:

Historical / Verify

Description:

There have previously been situations where the Performance Circle did not show all expected data.

Expected behaviour:

- all scored criteria should be reflected correctly
- current score and comparison score must be clearly displayed
- colours must follow the defined comparison logic:
  - better than comparison → green
  - worse than comparison → red
  - equal → neutral grey/blue

AI rule:

When modifying scoring or criteria, verify Performance Circle output.

---

## KPI value input must be available where required

Status:

Historical / Verify

Description:

There have previously been cases where KPI definitions were visible but no value or target could be entered.

Expected behaviour:

- KPI definitions should support entering required values
- target and actual values must be clearly distinguishable
- permissions must determine who can edit KPI values

AI rule:

When modifying KPI forms, verify both display and input behaviour.

---

# Documentation Issues

## Keep documentation synchronized with implementation

Status:

Recurring Risk

Description:

The AI Knowledge Base must remain aligned with the application.

Expected behaviour:

When changing functionality, update relevant documentation:

- module document
- FLOW.md if workflow changes
- Navigation.md if navigation changes
- TODO.md if backlog changes
- KNOWN_ISSUES.md if a known issue is resolved or discovered

AI rule:

A task is not complete if related documentation is outdated.

---

# Resolved Issues

## Actiehistoriek dashboard pagination

Date fixed:

2026-07-07

Description:

The Dashboard action history table now uses pagination with 15 items per page. Existing date, team and representative filters remain active while navigating pages.

Verification:

- `npm run lint`
- `npm run build`

Related documents:

- `docs/ai/modules/Coaching/Dashboard.md`
- `docs/ai/modules/Coaching/TODO.md`

When an issue is fixed, move it here with:

- date fixed
- short description
- verification method
- related commit if available
