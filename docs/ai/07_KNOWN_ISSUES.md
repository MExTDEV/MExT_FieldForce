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

Partially resolved on 2026-07-08 / Verify

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

## KPI import uses globally unique KPI code

Status:

Confirmed Open / Design Limitation

Description:

The management KPI import uses the existing `KpiDefinition.code` field as the natural key.
The current Prisma model defines `KpiDefinition.code` as globally unique.

Expected behaviour:

- KPI import can create or update global and country-scoped KPI definitions.
- It cannot create multiple KPI definitions with the same code for different countries without a schema change.
- Supporting `code + country` as a true composite natural key requires a reviewed Prisma migration and updates to existing KPI upsert logic.

AI rule:

Do not work around this by inventing derived codes or duplicate KPI tables.

---

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

Begeleidingen role visibility has been implemented in the shared client and server coaching access helpers. Grouping by country, team and user is implemented for Country Manager, Sales Manager, Admin and Super Admin after the existing visibility filtering. Browser-based visual verification remains outside Codex unless explicitly requested.

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

## Actiehistoriek probably belongs under Beheer -> Log

Status:

Resolved on 2026-07-08

Description:

The Dashboard no longer shows action history.

Current behaviour:

- Actiehistoriek is available under Beheer -> Log.
- Direct route and API reads require effective `menu.coaching.log`.
- The existing filters and 15-row pagination are preserved.

Reason:

Action history is administrative logging and not part of the operational dashboard workflow.

Verification:

- `npm run test:menu-rights`
- `npm run test:management-log`

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

Resolved on 2026-07-08

Description:

The employee fiche now shows module-bound information only when the module is active, the user has the effective section permission and the target representative is within scope.

Current behaviour:

- Disabled modules do not appear as fiche tabs or overview sections.
- User-level overrides already present on the active session user are respected by the fiche visibility helper.
- Timeline content is restricted to item types from visible module sections.
- Undefined module workflows were not expanded.

Verification:

- `npm run test:fiche-visibility`
- `npm run test:data-access`
- `npm run test:menu-rights`
- `npm run test:coaching-visibility`
- `npm run typecheck`
- `npm run lint`
- `npx next build`

Related documents:

- `docs/ai/modules/Coaching/MijnTeam.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Visual indicators in Mijn Team are partly complete

Status:

Confirmed Open

Description:

Mijn Team should visually communicate follow-up status. The planned coaching indicator has been implemented; score-based colouring still needs final configuration.

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

Not planned / Cancelled by business decision on 2026-07-08

Description:

The Begeleidingen page keeps its fixed Today, Future and History main sections visible, even when a section has no rows.

Current behaviour:

- Keep visible:

- Begeleidingen van vandaag when none exist
- Toekomstige begeleidingen when none exist
- Uitgevoerde begeleidingen when none exist

Empty country/team/user subgroups are not shown inside grouped management sections.

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

Resolved on 2026-07-08

Description:

The Actiepunten page now has a scoped overview and management flow based on existing scoped action definitions and concrete action points from visible coaching-related workflow/reporting data.

Current behaviour:

- show global action points
- show country action points
- show team action points
- show personal action points
- show open / to-do action points in two tabs: Actiepunten and Gebruikers
- provide a search field in both tabs
- group the Actiepunten tab in collapsible scope groups
- group the Gebruikers tab per visible user
- show type badges
- apply role and scope visibility
- show concrete workflow action points as personal/user-scoped items for the related representative
- direct page and API access require active Actiepunten module and effective permissions
- allow authorised users to create, edit, activate and deactivate scoped action definitions
- link scoped action definitions to existing active products
- count active, in-date scoped action definitions in the Dashboard open action point metric

Known limitations:

- Completion, approval, reopening and reassignment remain open because the detailed action-point lifecycle still needs business definition.
- Open/Afgesloten follows `active` plus validity dates for scoped action definitions and the existing workflow status for concrete workflow action points; no separate close workflow or `closedAt` field was introduced.
- Inactive or expired scoped definitions are visible only to management users.

Related documents:

- `docs/ai/modules/Coaching/Actiepunten.md`
- `docs/ai/modules/Coaching/TODO.md`

---

## Detailed action point workflow still needs business definition

Status:

Confirmed Open

Open topics:

- who can close action points
- whether action points require approval
- whether action points can be reassigned
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

Current behaviour:

- KPI management supports default target values, min/max values and period-specific target values.
- Period target conflicts are detected for the same KPI and scope.
- Actual KPI performance values still come from the existing snapshot/import flow and were not redefined.

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

## Dashboard vandaag vraagt aandacht planned items

Date fixed:

2026-07-07

Description:

The Dashboard **Vandaag vraagt aandacht** card now shows visible FieldForce items planned for today in two sections: **Uit te voeren** and **Uitgevoerd**. It is displayed directly below the page header; smart coaching risks are shown separately as **Coachingprioriteiten** so an empty risk panel no longer contradicts today's planned items.

Verification:

- `npm run test:dashboard-attention`
- `npm run test:planning-items`
- `npm run test:coaching-visibility`
- `npm run typecheck`
- `npm run lint`
- `npx next build`

Known limitations:

- Contactmomenten and Hulpaanvragen still follow the current Planning date basis because those workflows do not yet define a separate scheduled date field.
- `npm run build` is still blocked by the known Windows Prisma query-engine file lock during `prisma generate` when the engine is held by the local environment.
- Browser-based visual validation and port-3000 checks remain outside Codex according to `AGENTS.md`.

Related documents:

- `docs/ai/modules/Coaching/Dashboard.md`
- `docs/ai/modules/Coaching/TODO.md`

## Mijn Team planned coaching indicator

Date fixed:

2026-07-08

Description:

Mijn Team now highlights a row light blue and shows the compact `Begeleiding gepland` badge when the current user may see a planned Begeleiding for that person today or in the future. Hidden surprise coachings for representatives do not trigger an indirect indicator.

Verification:

- `npm run test:my-team-planned`
- `npm run test:coaching-visibility`
- `npm run test:fiche-visibility`
- `npm run test:menu-rights`
- `npm run test:data-access`
- `npm run typecheck`
- `npm run lint`
- `npx next build`

Known limitation:

- `npm run build` is still blocked by the known Windows Prisma query-engine file lock during `prisma generate` when the engine is held by the local environment.

Related documents:

- `docs/ai/modules/Coaching/MijnTeam.md`
- `docs/ai/modules/Coaching/TODO.md`

When an issue is fixed, move it here with:

- date fixed
- short description
- verification method
- related commit if available
