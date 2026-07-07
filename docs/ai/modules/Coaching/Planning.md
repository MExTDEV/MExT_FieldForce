# Planning

## Purpose

Planning is the calendar view used by the Coaching module.

Its purpose is to show scheduled coaching-related activities in time order and allow users to open the correct related workflow from the calendar.

Planning is not the owner of the underlying business objects.

It displays scheduled items and routes the user to the correct form or view.

---

## Scope

This document describes the functional behaviour of Planning within the Coaching module.

It does not describe:

- technical routes
- React components
- database models
- calendar implementation details
- Outlook API implementation

---

## Core Principle

Planning is a shared calendar surface.

It may contain different activity types, but the calendar itself must not duplicate the business logic of those activity types.

Each item shown in Planning must open the correct source workflow.

Example:

- a coaching item opens the Coaching Form
- a contact moment item opens the Contact Moment Form
- a retraining item should eventually open a Retraining Form

---

## Main Users

Planning can be used by all roles that have effective permission to access it.

Visibility is determined by:

- role configuration
- user-level overrides
- country scope
- team scope
- individual user scope
- item-specific visibility rules

---

## Role-Based Scope

### Vertegenwoordiger

A representative only sees Planning items that apply to the representative.

For planned coachings, the same visibility logic applies as in Begeleidingen:

- announced coachings may be visible before execution
- surprise coachings must not be visible before they are submitted for approval

A representative must not be able to open unfinished coaching forms.

---

### Verkoopleider

A Verkoopleider sees Planning items for own team.

For a coaching item:

- clicking a coaching planned for today opens the Coaching Form
- clicking a future coaching opens the planning/preparation flow when editing is allowed

---

### Country Manager

A Country Manager sees Planning items within the assigned country scope.

A Country Manager may open coaching items in view/preparation mode only unless explicitly granted additional rights.

---

### Sales Manager

Sales Manager is a separate application role.

A Sales Manager can have access to one or more countries.

A Sales Manager sees Planning items within the assigned country scope.

A Sales Manager may open coaching items in view/preparation mode only unless explicitly granted additional rights.

---

### Admin

An Admin sees Planning items within the assigned country scope.

An Admin may open coaching items in view/preparation mode only unless explicitly granted additional rights.

---

### Super Admin

A Super Admin sees all Planning items.

For coaching items, a Super Admin can open the item with Verkoopleider-level access.

---

## Planning Item Types

Planning currently supports or intends to support the following Coaching-related item types.

---

### Begeleiding

Target:

- Coaching Form

Description:

A coaching item opens the form used to execute, review or manage the coaching.

The same Coaching Form is also opened from:

- Dashboard
- Begeleidingen
- Mijn Team

Business rule:

There is only one Coaching Form. Planning must route to that form and must not implement a separate coaching workflow.

---

### Contactmoment

Target:

- Contact Moment Form

Description:

A contact moment item opens the form used to register or complete a contact moment.

Current status:

- workflow still under business discussion

---

### Retraining

Target:

- Retraining Form

Current status:

- exact form behaviour still needs to be defined
- workflow still under business discussion

Expected behaviour:

- clicking a retraining item should open a dedicated input form

---

### Salestraining

Target:

- Sales Training Form

Current status:

- exact form behaviour still needs to be defined
- workflow still under business discussion

Expected behaviour:

- clicking a sales training item should open a dedicated input form

---

### Hulpaanvraag

Target:

- Support Request Form

Current status:

- exact form behaviour still needs to be defined
- workflow still under business discussion

Expected behaviour:

- clicking a support request item should open a dedicated input or follow-up form

---

## Not Currently Supported

There are currently no other Planning item types within the Coaching module.

Unknown or undefined item types should not be added until the workflow has been defined with the business.

---

## Coaching Planning Relationship

When a new coaching is scheduled through the New Coaching flow, the coaching must become visible in Planning for users who are allowed to see it.

The scheduled coaching contains:

- representative
- coach
- date
- start time
- end time
- selected focus areas
- notification setting for the representative

The Planning item must link back to the existing coaching record.

---

## Outlook Relationship

When a coaching is planned, it is also synchronised to the coach's Outlook calendar.

Planning and Outlook must refer to the same scheduled coaching moment.

Business rule:

- Planning is the in-application calendar view.
- Outlook is the external calendar representation.
- The coaching record remains the source of truth for coaching-specific data.
- A FieldForce-created item that is synchronised to Outlook remains a FieldForce Planning item.
- Existing Outlook appointments are external calendar items and must not visually take priority over FieldForce business items.

---

## Planning Order

Planning items are ordered deterministically inside the current date or day grouping.

Sort order:

1. Date / day grouping.
2. Source priority:
   - FieldForce-created business items first.
   - External Outlook/calendar appointments second.
3. Start time ascending within the same source group.
4. End time ascending as tie-breaker.
5. Stable deterministic tie-breaker by item type and id.

FieldForce-created items include existing business objects such as:

- Begeleiding
- Contactmoment
- Retraining
- Salestraining
- Hulpaanvraag

This ordering is display-only. It must not create duplicate Outlook items, change Outlook ownership or move workflow ownership into Planning.

---

## Day and Week Layout

In day and week views, Planning items must be positioned against the visible time grid.

Layout rules:

- `top` is based on the item's start time within the day column.
- `height` is based on the actual duration between start and end time.
- The pixels-per-minute calculation must match the hour-row height used by the grid.
- Very short items may use a minimum readable height, but longer items must remain visibly taller.
- Overlapping items in the same day column must be distributed into lanes so they do not fully cover each other.
- FieldForce items keep visual priority over Outlook-only items when timing is equal or overlapping.

Month view may continue to show compact item summaries and does not need duration-based item height.

---

## Opening Items From Planning

Clicking a Planning item must open the related object.

### Begeleiding

Opens:

- Coaching Form

Depending on status and permissions, this may open as:

- input form
- planning/preparation flow
- preparation/view mode
- read-only report mode

---

### Contactmoment

Opens:

- Contact Moment Form

Final behaviour still requires business confirmation.

---

### Retraining

Expected to open:

- Retraining Form

Final behaviour still requires business confirmation.

---

### Salestraining

Expected to open:

- Sales Training Form

Final behaviour still requires business confirmation.

---

### Hulpaanvraag

Expected to open:

- Support Request Form

Final behaviour still requires business confirmation.

---

## Navigation Rules

- Planning displays scheduled items.
- Planning does not own the underlying business workflow.
- Each item must open the correct related form or view.
- The same coaching opened from Planning must be the same coaching opened from Dashboard, Begeleidingen or Mijn Team.
- Planning must preserve permissions, lifecycle status and visibility rules.
- Planning must not create duplicate forms or duplicate business logic.
- Planning visibility must be based on effective permissions.
- Item visibility must respect role scope, country scope, team scope and user-level overrides.

---

## Business Rules

- Planning may show different activity types.
- Adding a new Planning item type requires a clear target form.
- Unknown or undefined item types must not be implemented based on assumptions.
- A coaching item in Planning must always link to the existing coaching record.
- Representatives must not see surprise coachings before they are allowed to see them.
- Representatives must not be able to open unfinished coaching forms.
- Management users may open items only according to their effective permissions.
- Super Admin can access all Planning items.

---

## Related Documentation

- FLOW.md
- Navigation.md
- Begeleidingen.md
- Dashboard.md
- MijnTeam.md
- TODO.md

---

## Open Implementation Notes

The following points are intentionally not fully defined yet:

- Contactmoment workflow
- Retraining workflow
- Salestraining workflow
- Hulpaanvraag workflow
- exact Planning filters
- exact Planning views, such as day/week/month
- exact Outlook synchronisation behaviour for updates and cancellations

AI assistants must not invent these behaviours.

If a feature depends on one of these undefined topics, the business requirement must be clarified first.
