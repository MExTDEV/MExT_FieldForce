# Coaching TODO

This document tracks open implementation points, clarifications and follow-up items for the Coaching module.

Priority levels:

- High: required for correct functional behaviour or security.
- Medium: required for usability, maintainability or completeness.
- Low: improvement or refinement.

---

# Header / Notifications

## Header ToDo-bel

Priority: High

Status: Completed on 2026-07-08

Implemented changes:

- The application header now shows a compact ToDo notification bell next to the language and user controls.
- The bell reuses the existing visible workflow data used by Dashboard `Vandaag vraagt aandacht`, `/taken-vandaag`, Planning and Begeleidingen.
- No separate ToDo database, ToDo model or parallel source of truth was introduced.
- Open execution ToDo's come from the existing `Uit te voeren` split in the shared dashboard attention helper.
- Coachings with status `Wachten op akkoord` / `verzonden_ter_akkoord` are added as approval ToDo's for users who can already see the coaching through the existing workflow visibility rules.
- The count, red bell state and dropdown contents are based only on visible, module-enabled workflow items.
- Hidden surprise coachings do not trigger the red bell, count or dropdown for representatives.
- The dropdown opens existing item routes through the same `coachingOpenHref` logic for Begeleidingen; undefined module item routes are not expanded.
- Clicking a dropdown item closes the dropdown.
- The active bell uses a red filled icon with a small count badge and wiggles once per minute for about one second.
- The wiggle timer is cleaned up on unmount and respects `prefers-reduced-motion`.
- New header labels were added to the Dutch, French and German locale files.

Validation performed:

- `npm run test:header-todos`
- `npm run test:dashboard-attention`
- `npm run test:planning-items`
- `npm run test:coaching-visibility`
- `npm run test:menu-rights`
- `npm run test:data-access`
- `npm run typecheck`
- `npm run lint`
- `npm run build` reached `prisma generate` and was blocked by the known Windows Prisma query-engine file lock.
- `npx next build` completed successfully with the existing Prisma client.

Remaining checks or known limitations:

- Browser-based visual validation and port-3000 checks remain outside Codex according to `AGENTS.md`.
- The existing codebase currently contains both `wacht_op_akkoord` and `verzonden_ter_akkoord` as approval-like statuses; the header bell treats both as approval ToDo statuses without changing lifecycle names.
- The existing detail approval button is implemented for the current `verzonden_ter_akkoord` flow. Legacy `wacht_op_akkoord` items still open the existing Begeleiding detail/read flow and remain visible as approval ToDo's until the existing status/approval data changes.
- Contactmomenten, Hulpaanvragen, Retrainingen and Salestrainingen still keep their existing Planning/Dashboard routes only; no undefined workflow was expanded.

---

# Dashboard

## Aandacht vereist

Priority: High

Status: Completed on 2026-07-08

Implemented changes:

- Dashboard shows a dedicated **Vandaag vraagt aandacht** card directly below the page header with two sections:
  - Uit te voeren
  - Uitgevoerd
- The smart coaching risk panel is shown separately as **Coachingprioriteiten**, so an empty risk panel no longer hides or contradicts today's planned items.
- The card uses the same visible workflow data as Planning and Begeleidingen through the shared workflow visibility state.
- Today is determined with the existing local date helper.
- Begeleidingen use `plannedDate` and the existing coaching open/access helpers.
- Contactmomenten and Hulpaanvragen use their currently existing Planning date basis because no separate scheduled date field is defined yet.
- Retrainingen and Salestrainingen use their existing `date` field.
- `Wachten op akkoord` is treated as executed/submitted for this dashboard split because the lifecycle reaches that status after execution and submission for approval.
- The existing `/taken-vandaag` entry point uses the same two-section source.
- Undefined workflows were not implemented.

Validation performed:

- `npm run test:dashboard-attention`
- `npm run test:planning-items`
- `npm run test:coaching-visibility`
- `npm run typecheck`
- `npm run lint`
- `npm run build` reached `prisma generate` and was blocked by the known Windows Prisma query-engine file lock before Next.js compilation.
- `npx next build` completed successfully with the existing Prisma client.

Remaining checks or known limitations:

- Browser-based visual validation and port-3000 checks remain outside Codex according to `AGENTS.md`.
- Contactmomenten, Hulpaanvragen, Retrainingen and Salestrainingen still require business clarification for final create/open/edit workflows.
- Contactmomenten and Hulpaanvragen do not yet have a separate planned date field, so Dashboard follows the current Planning behaviour for those item types.

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

- Actiehistoriek has been moved from the operational Dashboard to `Beheer -> Log`.
- The Dashboard no longer renders the Actiehistoriek card or an empty placeholder for it.
- `Beheer -> Log` reuses the existing ActivityHistoryCard/table/data source.
- Pagination remains 15 action history items per page.
- Existing date, team and representative filters remain available and are preserved while navigating pages.
- Direct `/beheer/log` access and `/api/activity-history` reads require effective `menu.coaching.log`.
- Role defaults give Super Admin and Admin access to `Beheer -> Log`.
- Other roles have no default log access, but user-level overrides can explicitly enable or disable `menu.coaching.log`.

Architecture note:

- Action history is administrative logging and no longer belongs to the operational dashboard.

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

Status: Completed on 2026-07-08

Implemented changes:

- The employee fiche now derives tab and section visibility from a central fiche-visibility helper.
- Visibility combines active module configuration, effective user permissions, user-level overrides already present on the active session user, and representative scope.
- The overview hides module-bound blocks independently:
  - latest coaching / coaching open action follows Begeleidingen + `moduleVisitRecord`;
  - Performance Circle score follows Rapportering + `moduleReporting` + `performanceView`;
  - KPI cards follow Rapportering + `moduleReporting` + `performanceScoresView`;
  - action-point summary follows Actiepunten + `modulePreparation`.
- Timeline tabs only include item types from visible modules and use the existing visible workflow helpers.
- The Mijn Team client route and sidebar visibility now also respect the effective `moduleMyTeam` permission.
- Undefined workflows were not implemented or expanded.

Validation performed:

- `npm run test:fiche-visibility`
- `npm run test:data-access`
- `npm run test:menu-rights`
- `npm run test:coaching-visibility`
- `npm run typecheck`
- `npm run lint`
- `npm run build` reached `prisma generate` and was blocked by the known Windows Prisma query-engine file lock before Next.js compilation.
- `npx next build` completed successfully with the existing Prisma client.

Remaining checks or known limitations:

- Browser-based visual validation and port-3000 checks remain outside Codex according to `AGENTS.md`.
- The existing app-level Performance and Workflow providers still load their already backend-scoped datasets globally; no new section-specific fetches were added for hidden fiche sections.
- Contactmomenten, Hulpaanvragen, Retrainingen, Salestrainingen and Rapportage still require business clarification for final workflows.

---

## Planned Coaching Visual Indicator

Priority: Medium

Status: Completed on 2026-07-08

Implemented changes:

- Mijn Team rows now show a light-blue highlight and compact `Begeleiding gepland` badge when the active user can see a planned coaching for that person.
- The indicator is calculated server-side from visible `BEGELEIDING` records with status `GEPLAND`.
- Only planned coachings for today or a future date trigger the indicator.
- Executed/submitted statuses such as `Wachten op akkoord` do not trigger the planned indicator.
- The indicator respects active Begeleidingen module configuration and effective `moduleVisitRecord` permissions, including user-level overrides.
- Representative surprise coachings remain hidden: representatives only get an indicator for announced planned coachings that are visible through the shared coaching visibility rules.
- The implementation does not change coaching lifecycle, Planning, Outlook synchronisation or the coaching form workflow.

Validation performed:

- `npm run test:my-team-planned`
- `npm run test:coaching-visibility`
- `npm run test:fiche-visibility`
- `npm run test:menu-rights`
- `npm run test:data-access`
- `npm run typecheck`
- `npm run lint`
- `npm run build` reached `prisma generate` and was blocked by the known Windows Prisma query-engine file lock before Next.js compilation.
- `npx next build` completed successfully with the existing Prisma client.

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

Status: Completed on 2026-07-07

Implemented changes:

- Nieuwe begeleidingen gebruiken effectieve `intervention:create`-rechten voordat de targetselectie beschikbaar is.
- De targetselectie ondersteunt actieve Verkoopleiders naast Vertegenwoordigers binnen de bestaande land/team/scope-regels.
- Een gewone Verkoopleider blijft beperkt tot actieve Vertegenwoordigers van het eigen team.
- De workflow bewaart het geselecteerde begeleidingsdoelwit mee, zodat Verkoopleiders correct zichtbaar blijven in Dashboard, Planning en Begeleidingen.
- Uitvoeren, opslaan en ter akkoord versturen blijven permission- en lifecycle-driven; managementrollen zonder effectieve create/execute-permissie blijven read-only.
- Er is geen aparte formulierflow toegevoegd; de bestaande coaching form blijft de single source of truth.

Original issue:

- Het inplannen van een begeleiding op een Verkoopleider werkt momenteel niet.

Original required change:

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

Status: Not planned / Cancelled by business decision on 2026-07-08

Decision:

- Empty sections on the Begeleidingen page will remain visible.
- Do not hide `Begeleidingen van vandaag` when there are no coachings planned for today.
- Do not hide `Toekomstige begeleidingen` when there are no future coachings.
- Do not hide `Uitgevoerde begeleidingen` when there are no historical coachings.

Reason:

- Business decided that keeping the fixed section structure is preferred over a more compact page layout.

AI rule:

- Do not pick this item up as an implementation task unless the business decision changes again.

Original requested changes, kept for history:

- Hide `Begeleidingen van vandaag` when there are no coachings planned for today.
- Hide `Toekomstige begeleidingen` when there are no future coachings.
- Hide `Uitgevoerde begeleidingen` when there are no historical coachings.

Original purpose:

- Avoid showing empty sections that add no value to the user.

---

## Role-Based Visibility

Priority: High

Status: Completed on 2026-07-07

Implemented changes:

- Begeleidingen visibility now uses the shared coaching visibility helpers for list data.
- Representatives can see announced planned coachings, but cannot open unfinished coachings.
- Surprise coachings remain hidden for representatives until Wachten op akkoord / approval stage.
- Direct detail access uses a stricter open-detail access check than list visibility.
- Server-side coaching detail and mutation routes enforce the same visibility and manage rules.
- Country Manager, Sales Manager and Admin users can view representative coachings in scope but cannot edit them by default.
- Higher-level users with effective intervention rights can still plan and execute coachings on Verkoopleiders within scope.
- Super Admin and Group Manager keep global operational access.

Remaining checks or known limitations:

- Browser-based visual validation remains to be performed through the externally managed local devserver.
- Grouping by country/team/user is tracked separately under Grouping by Scope.

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

Status: Completed on 2026-07-08

Implemented changes:

- Begeleidingen keeps the existing Today, Future and History main sections visible, including their empty states.
- Country Manager, Sales Manager, Admin and Super Admin overview rows are grouped after the existing coaching visibility and scope filtering.
- Multi-country management users see:
  - country
  - team
  - user
- Management users with access to one country start directly at:
  - team
  - user
- Super Admin always keeps country -> team -> user grouping.
- Verkoopleider and Vertegenwoordiger keep the existing non-management card grid.
- Empty management subgroups are not rendered because groups are built only from visible coaching rows.
- Existing card actions, badges, Outlook status, future planning edit links and read-only management links were preserved.

Validation performed:

- `npm run test:coaching-groups`
- `npm run test:coaching-visibility`
- `npm run test:planning-items`
- `npm run test:dashboard-attention`
- `npm run test:my-team-planned`
- `npm run test:menu-rights`
- `npm run typecheck`
- `npm run lint`

Purpose:

- Keep the page compact and avoid redundant grouping.

---

## Representative Notification Logic

Priority: High

Status: Completed on 2026-07-07

Implemented changes:

- The existing "representative must be informed" planning value now controls representative list visibility.
- If enabled, the planned coaching appears in representative Dashboard, Planning and Begeleidingen data because those surfaces use the shared workflow visibility state.
- If disabled, the planned coaching stays hidden from the representative until Wachten op akkoord / approval stage.
- Direct detail access remains blocked for representatives while the coaching is unfinished, even when the planned coaching is announced.

Remaining checks or known limitations:

- No separate notification delivery channel was added; this task only implemented visibility behaviour behind the existing checkbox.

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

Status: Completed on 2026-07-07

Implemented changes:

- Future planned coachings open through the existing planning/preparation wizard for users who may edit that coaching.
- The wizard preserves the original representative, date, start time, end time, notification flag and selected focus areas when reopening a planned coaching.
- Begeleidingen and Planning links now route editable future coachings to the planning/preparation flow instead of the execution dossier.
- The wizard blocks direct edit-mode access when the coaching is not visible, not planned, or outside the user's edit scope.
- Existing preparation data in the planning/preparation screen remains available.

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

Status: Completed on 2026-07-07

Implemented changes:

- Country Manager, Sales Manager and Admin users open representative coachings in read-only preparation/detail mode by default.
- These users cannot save execution data, change focus areas, change representative/target or modify planning details for representative coachings through the UI or API.
- The exception for coachings on Verkoopleiders remains permission- and scope-driven.

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

Status: Completed on 2026-07-08

Implemented changes:

- The Actiepunten page is now a read-only overview.
- The screen has two tabs:
  - Actiepunten
  - Gebruikers
- Both tabs have a search field.
- The overview uses existing `ActionDefinition` data for global, country, team and user-scoped action points.
- The overview also shows concrete action points from visible workflow/reporting data, including action points created during coachings, contact moments, retrainings and sales trainings.
- Concrete workflow action points are displayed as personal/user-scoped items for the related representative.
- The Actiepunten tab shows open / to-do action points in collapsible scope groups:
  - Globaal
  - Land
  - Team
  - Persoonlijk
- The Gebruikers tab shows the same open / to-do action points grouped per visible user.
- Action point rows now use a compact list layout aligned with the Mijn Team list pattern.
- The page no longer exposes create, deactivate or target-override actions.
- Direct page access requires the active Actiepunten module and effective `modulePreparation` plus `menu.coaching.actionPoints` permissions.
- The action-definition APIs also enforce the active module and effective permissions before returning data.
- The action-definition API returns the same Dutch priority values that the UI uses for priority badges.
- No new data model, status, detail workflow, approval workflow, expiry workflow or reassignment workflow was added.

Validation performed:

- `npm run test:action-points-overview`
- `npm run typecheck`

Known limitations:

- The overview uses `active` as the current Open/Afgesloten split because no final close workflow or closedAt field has been defined yet.
- Concrete workflow action points use their existing workflow status for the Open/Afgesloten split.
- The visible screen currently focuses on open / to-do action points.
- The overview does not invent a separate detail or lifecycle workflow for action points.

---

## Sections

Priority: High

Status: Completed on 2026-07-08

Implemented changes:

- Show open / to-do action points in the Actiepunten tab.
- In the Actiepunten tab, group visible action points in collapsible scope groups:
  - Globaal
  - Land
  - Team
  - Persoonlijk
- Show the same open / to-do action points in the Gebruikers tab, grouped per visible user.
- Both tabs keep a compact empty state when they contain no visible action points.
- Open action points sort by validity end date first, then validity start date and id.
- The underlying closed split still sorts by update date first, then validity dates and id, but closed action history is not exposed as a separate screen workflow in this iteration.

Purpose:

- Make active follow-up searchable by action point and by user.

---

## Type Badges

Priority: Medium

Status: Completed on 2026-07-08

Implemented changes:

- Each visible action point displays a scope/type badge.

Implemented badges:

- Globaal
- Land
- Team
- Persoonlijk

Purpose:

- The user must immediately understand why the action point is visible and what scope it belongs to.

---

## Detail View

Priority: Medium

Status: Open / Not implemented in the read-only overview task

Required change:

- Clicking an action point must open the action point detail view.

Open question:

- The exact fields and actions in the detail view still need to be discussed with the business.

Current limitation:

- The first functional overview intentionally does not add click behaviour or business actions.

---

## Visibility Rules

Priority: High

Status: Completed on 2026-07-08

Implemented changes:

- Role-based and scope-based visibility is implemented in a shared action-point visibility helper.
- Server routes filter action definitions before returning data to the client.
- The sidebar, app switcher and direct `/actiepunten` route respect active module state, role defaults and user-level overrides.
- Country Manager role defaults now include `modulePreparation`, matching the documented requirement that Country Managers can follow up action points within country scope.
- Representative visibility is restricted to global action points and own personal action points; team and country action points are not exposed to representatives from this overview.

### Vertegenwoordiger

- Sees global action points when Actiepunten is active and allowed.
- Only sees own personal action points.
- Does not see team, country or personal action points of others.

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

Validation performed:

- `npm run test:action-points-overview`

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

Status: Completed on 2026-07-07

Implemented changes:

- Planning items now have an internal source classification:
  - `FIELD_FORCE`
  - `EXTERNAL_CALENDAR`
- Planning items now have a stable type classification for:
  - `COACHING`
  - `CONTACT_MOMENT`
  - `RETRAINING`
  - `SALES_TRAINING`
  - `HELP_REQUEST`
  - `OUTLOOK_APPOINTMENT`
- Planning sorting now uses one shared comparator:
  - date / day grouping first
  - FieldForce-created business items before external calendar items
  - start time ascending within the same source group
  - end time ascending as tie-breaker
  - item type and id as deterministic tie-breaker
- Planning day, week and month views use the same source-priority ordering.
- Outlook calendar items linked to existing FieldForce coachings are filtered by `outlookEventId` and `outlookICalUId` so synced FieldForce items are not duplicated as external appointments.
- Begeleiding items keep using the existing coaching open logic; no Planning-specific coaching form was added.
- Undefined module workflows were not implemented.

Validation performed:

- `npm run test:planning-items`
- `npm run test:coaching-visibility`
- `npm run typecheck`
- `npm run lint`
- `npm run build` reached Prisma generate and was blocked by the known Windows Prisma query-engine file lock before Next.js compilation.
- `npx next build` completed successfully with the existing Prisma client.

Remaining checks or known limitations:

- Browser-based visual validation and port-3000 checks remain outside Codex according to `AGENTS.md`.
- Contactmomenten, Retrainingen, Salestrainingen and Hulpaanvragen still require business clarification for their final create/open/edit workflows.

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

## Day and Week Agenda Items Must Use Actual Duration

Priority: High

Status: Completed on 2026-07-07

Implemented changes:

- Dag- en weekweergave gebruiken opnieuw tijdgebaseerde positionering.
- Elk item berekent `top` op basis van starttijd binnen de zichtbare dagkolom.
- Elk item berekent `height` op basis van de werkelijke duur tussen start- en eindtijd.
- Zeer korte afspraken krijgen alleen een minimale leesbare hoogte; langere afspraken blijven zichtbaar hoger.
- De berekening gebruikt dezelfde pixels-per-minuut als de uurgrid, zodat 08:00, 09:30 en langere blokken op de juiste verticale positie vallen.
- Overlappende items worden per dag in lanes verdeeld zodat ze niet volledig over elkaar vallen.
- FieldForce-items behouden prioriteit in overlapgroepen tegenover Outlook-only items.
- Maandweergave blijft de bestaande compacte lijstweergave gebruiken.

Validation performed:

- `npm run test:planning-items`
- `npm run typecheck`

Remaining checks or known limitations:

- Browser-based visual validation and port-3000 checks remain outside Codex according to `AGENTS.md`.

Original issue:

- Na de FieldForce-first sorteerwijziging kregen agenda-items in dag- en weekweergave een vaste uniforme hoogte, waardoor een afspraak van 1 uur even hoog werd getoond als een afspraak van meerdere uren.

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

Status: Completed on 2026-07-08

Implemented changes:

- Menu permission groups are now included in the same role and user-level permission configuration as the other FieldForce permissions.
- Main Coaching module routes use explicit effective menu permissions in addition to module activation.
- Undefined but registered Coaching module menu items now have explicit permission keys:
  - `menu.coaching.contacts`
  - `menu.coaching.retrainings`
  - `menu.coaching.trainings`
  - `menu.coaching.help`
- Beheer subitems now have explicit permission keys:
  - `menu.coaching.teams`
  - `menu.coaching.kpis`
  - `menu.coaching.framework`
  - `menu.coaching.settings`
  - `menu.coaching.log`
- Sidebar visibility, app-switcher visibility and direct route access use the same effective permission helpers.
- Direct Beheer routes are blocked when the user lacks the specific section permission.

Validation performed:

- `npm run test:menu-rights`
- `npm run test:management-log`

Required rule:

- Every main menu item must be configurable through role management.
- Every main menu item must support user-level overrides.

Business rules:

- Role permissions define default navigation visibility.
- User-level overrides can enable or disable access for a specific user.
- Effective permissions must always be used when rendering navigation.
- No new main menu item may be added without corresponding role and user override support.
