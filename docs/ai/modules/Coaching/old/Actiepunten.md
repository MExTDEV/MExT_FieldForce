# Actiepunten

## Purpose

The Actiepunten page is the central overview and management screen for action points within the Coaching module.

It shows every action point that applies to the current user, based on effective module, permission, country, team and user scope.

Action points can apply at four target levels:

- Globaal
- Land
- Team
- Persoonlijk / Gebruiker

The objective is to make follow-up visible, structured and actionable without duplicating the coaching action workflow.

---

## Current Status

The Actiepunten page has a functional scoped overview and management flow.

Implemented behaviour:

- visible open action points are shown in the **Actiepunten** tab.
- users with management scope also get a **Gebruikers** tab.
- the Vertegenwoordiger role only sees the Actiepunten tab.
- both tabs have search.
- open action points are grouped in collapsible scope groups:
  - Globaal
  - Land
  - Team
  - Persoonlijk
- users with action-point management rights also see non-active or out-of-validity action definitions.
- clicking an action point opens a detail modal.
- authorised users can create and edit `ActionDefinition` records.
- authorised users can set an action definition active or inactive.
- action definitions can be linked to active products.
- each action definition has a target type, valid-from date, optional valid-until date, optional numeric target, priority, active flag and rich-text description.
- the Dashboard open-action count includes active, in-date scoped action definitions plus concrete workflow action points.

Current data sources:

- `ActionDefinition` is the source for global, country, team and personal scoped action points.
- concrete coaching/workflow action points remain separate workflow data and are only shown in the overview as personal follow-up items.
- `ActionPointTargetType` stores the allowed target levels.
- `ActionDefinitionProduct` links action definitions to `Product`.
- legacy `ActionPoint` records and current `CoachingAction` records are normalised into the reporting action dataset for workflow-origin action points.
- `CoachingAction.reviewStatus` tracks peer-coaching action proposals:
  proposed, approved, rejected and active.

Compatibility note:

- When Prisma migration `0019_action_point_management` has not yet been applied on the active database, the Actiepunten read path falls back to legacy `ActionDefinition` fields.
- In that fallback mode, the target type is derived from `ActionDefinition.scope` and product links are returned empty.
- Creating or editing scoped action definitions still requires migration `0019_action_point_management`, because target type and product-link data cannot be stored safely before those tables and columns exist.

Open/closed split:

- `ActionDefinition` records are open when `active = true` and today's date is within `validFrom` / `validUntil`.
- inactive or expired definitions are visible only to users with management rights.
- workflow action points use their existing workflow status for the open/closed split.

---

## Navigation And Access

The page is accessed through the main navigation item **Actiepunten**.

The page is visible only when:

- the Actiepunten module is active.
- the user has effective `modulePreparation`.
- the user has effective `menu.coaching.actionPoints`.

Creating action definitions requires effective `actionPointsCreate`.

Managing existing action definitions requires effective `actionPointsManage` and scope access to the selected action point.

---

## Role Rules

### Vertegenwoordiger

A Vertegenwoordiger:

- sees global action points when the module and menu permissions allow it.
- sees own personal action points.
- does not see team or country action points.
- does not see personal action points of other users.
- does not see the Gebruikers tab.
- cannot create or manage action definitions.

### Verkoopleider

A Verkoopleider:

- sees country, team and personal action points that apply to own country/team scope.
- can create personal action definitions for active representatives in own team.
- can manage own-created personal action definitions for representatives in own team.
- cannot create or manage global, country or team action definitions.

### Sales Manager

A Sales Manager:

- sees action points within assigned country scope.
- can create and manage country, team and personal action definitions within assigned countries.
- cannot create or manage global action definitions by default.

Sales Manager is a separate role and must not be treated as Verkoopleider or Country Manager.

### Country Manager

A Country Manager:

- sees action points within assigned country scope.
- can create and manage country, team and personal action definitions within assigned countries.
- cannot create or manage global action definitions by default.

### Admin

An Admin:

- can create and manage global action definitions.
- can create and manage country, team and personal action definitions within effective country scope.

### Group Manager And Super Admin

Group Manager and Super Admin:

- see all action points.
- can create and manage all target levels.

---

## Detail And Edit Flow

Clicking an action point opens a detail modal with:

- source
- target type
- target label
- active/status badge
- priority
- validity period
- owner display when available
- optional numeric target
- linked products
- rich-text description

Management actions are available only for scoped `ActionDefinition` records and only when the current user may manage that record.

Concrete workflow action points can be opened for detail display, but their lifecycle remains owned by the originating workflow.

---

## Business Rules

- Action definitions may exist at global, country, team or user level.
- Product links are optional and reuse the existing `Product` entity.
- A target type is required and must match the selected scope.
- `validFrom` is required.
- `validUntil` is optional and must not be before `validFrom`.
- Rich text must be sanitised before storage.
- Users must only see and manage action points within their effective scope.
- Personal coaching-origin action points remain targeted by the coached user / representative, not by creator or owner.
- Creator and updater data may be used for audit and management restrictions.
- Inactive and expired definitions remain available for authorised management users.

---

## Still Undefined

The following workflow details are still not defined and must not be invented:

- close/completion workflow for scoped action definitions.
- reopening rules.
- reassignment rules.
- action-point history screen.
- whether scoped action definitions should create concrete per-user tasks automatically.

The action-point review workflow for coachings executed by a Professional/Expert
is now defined at data level:

- executor-created action points start as proposals;
- the planner must approve, adjust+approve or reject each proposal before the
  coached representative sees it;
- rejection requires a reason;
- approved action points become active only after final coaching approval;
- rejection and override reasons are internal and not visible to the coached
  representative by default.

---

## Related Documentation

- Navigation.md - Actiepunten navigation
- Dashboard.md - Dashboard action count
- FLOW.md - Coaching flow and concrete workflow action points
- TODO.md - Completed and remaining action-point items
