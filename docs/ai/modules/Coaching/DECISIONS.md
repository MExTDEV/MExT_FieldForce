# Coaching Decisions

## Purpose

This document records stable Coaching business decisions that should not be rediscovered in TODO history.

---

# Platform Decisions

## One source of truth

Each business object has one record, workflow and lifecycle.

Multiple entry points must reuse the same implementation.

## Permission-driven access

Navigation and data access use effective permissions and scope.

Client visibility never replaces server-side enforcement.

## Planning presentation

Planning displays scheduled business objects.

Planning does not own the underlying workflow.

## Multilingual behaviour

New user-facing Coaching functionality supports Dutch, French and German.

UTF-8 characters must remain intact.

---

# Begeleidingen

## One form and lifecycle

There is one Begeleiding form and one business lifecycle.

## Approval owner

Approval is performed by the coached person.

The coached person may be:

- a Representative;
- a Verkoopleider when a higher-level user performed the Begeleiding.

Do not assume approval always belongs to a Representative.

## Lifecycle lock

Pending Approval and Completed are read-only.

A change after submission requires the documented withdrawal transition first.

## Surprise visibility

When prior notification is disabled, the coached Representative does not see the planned Begeleiding before the documented approval stage.

## Management edit rule

Every non-Representative role may edit visible unlocked Begeleidingen only within effective scope and permissions.

---

# Teams and Roles

## Optional team leader

A team may exist without an assigned Verkoopleider.

This does not broaden ordinary Verkoopleider visibility.

## Sales Manager

Sales Manager is a separate role above Verkoopleider and may have one or more assigned countries.

## Group Manager

The technical role exists, but complete default behaviour remains to be defined.

Do not treat it as Super Admin automatically.

---

# Actiepunten

## Scope types

Configured Action Points may use:

- Global;
- Country;
- Team;
- User.

## Multiple assignments

A definition may be linked to multiple allowed countries, teams or users where the data model supports it.

## User action points from workflows

An action point created from a Begeleiding or Contactmoment for one person is a user-scoped action point.

## Open lifecycle decisions

Completion, approval, reopening and reassignment remain separate open business decisions.

Do not invent them.

---

# Contactmomenten

## Purpose

A Contactmoment is comparable to a Begeleiding without the complete scoring form.

## Planning

Planning follows the existing permission and scope structure.

The planner may choose whether the target person is informed in advance.

## Report

A report is written using WYSIWYG content and shared with the target person.

No approval is required.

## Locking

Once shared:

- the report is read-only;
- photos cannot be added or removed;
- ordinary users cannot alter the shared record.

## Photos and PDF

Photos are optional.

The report view displays photos as a gallery.

PDF export includes all linked photos.

## Action points

A Contactmoment may create a user-scoped Action Point.

---

# Hulpaanvragen

## Support obligation

A Representative who asks for help must receive support or a documented follow-up.

A request may not be closed as a simple rejection.

## No chat

A Hulpaanvraag is not a chat conversation.

The manager records a response or follow-up outcome without creating an ongoing message thread.

## Follow-up types

A manager may:

- plan a Begeleiding;
- plan a Contactmoment;
- plan a Retraining when that workflow exists;
- plan a Salestraining when that workflow exists;
- record another concrete response, such as including the topic in a future training or consulting colleagues.

## Prefilled requester

When a follow-up is planned from a Hulpaanvraag, the requester is automatically selected as the target person.

## Requester changes

The requester may edit or withdraw the request only while the responsible manager has not processed it.

The manager notification remains recorded.

## Visibility

The request is visible to:

- the requester;
- the responsible Verkoopleider;
- higher-level users with permission and effective scope.

## Notification choice

For the manager's response or planned follow-up, the manager may choose whether the requester is notified where the workflow offers that option.

---

# Development Server

The local development server is externally managed through `keep-fieldforce-dev.ps1`.

AI coding agents do not start, stop, restart or repeatedly probe it.
