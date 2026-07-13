# Planning

## Status

Functional area status: `DEFINED AS SHARED PRESENTATION`

## Purpose

Planning presents scheduled FieldForce and external calendar items.

Planning does not own the business workflows behind those items.

---

# Item Types

Planning may display:

- Begeleiding;
- Contactmoment;
- Retraining;
- Salestraining;
- a scheduled follow-up resulting from Hulpaanvraag;
- Outlook or external calendar events.

Only defined workflows receive new create, edit and close behaviour.

---

# Opening Items

Each FieldForce item routes to its owning module.

Examples:

- Begeleiding → Begeleiding form or report according to lifecycle;
- Contactmoment → Contactmoment detail or report;
- Hulpaanvraag follow-up → the created follow-up object;
- external Outlook event → read-only external event behaviour as currently defined.

Do not create Planning-specific copies of forms.

---

# Visual Time Representation

Calendar item height and placement must reflect actual duration.

FieldForce-created items synchronised into the agenda should be presented with the defined priority over read-only external appointments where applicable.

Overlapping events must remain understandable.

---

# Visibility

Planning uses:

- active module configuration;
- effective permission;
- country, team and user scope;
- item-specific visibility;
- surprise Begeleiding rules.

A hidden surprise Begeleiding must not leak through Planning.

---

# Scheduling Rights

Scheduling follows the owning module's rights.

Planning itself does not grant create permission.

Examples:

- Begeleiding targets follow Coaching scope;
- Contactmoment targets follow Contactmoment scope;
- Hulpaanvraag follow-up is prefilled with the requester.

---

# Outlook Integration

FieldForce items may synchronise to Outlook when the integration is configured.

The FieldForce record remains the business source of truth.

Do not create duplicate FieldForce records when synchronisation retries.

When a Begeleiding is planned from FieldForce, the saved FieldForce record is
merged into the shared workflow state before the user returns to the
Begeleidingen overview. Outlook sync success or failure only updates the sync
status on that record; it does not determine whether the Begeleiding is visible
in Planning or Begeleidingen.

---

# Validation

Relevant tests may include:

- planning items;
- workflow;
- Coaching visibility;
- data access;
- menu rights.
