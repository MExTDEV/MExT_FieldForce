# Coaching Dashboard

## Status

Functional area status: `DEFINED`

## Purpose

The Dashboard gives the active user a concise view of personal work, required attention and permitted management insight.

It is not the source of truth for underlying workflows.

---

# Today Requires Attention

The Dashboard shows today's relevant items in two sections:

- Uit te voeren;
- Uitgevoerd.

The data source must reuse shared visibility and workflow logic used by Planning and the relevant modules.

Do not create a separate dashboard-only workflow dataset.

---

# Personal ToDos

Personal attention items may include:

- a Begeleiding to execute;
- a Begeleiding awaiting the coached person's approval;
- an open personal Action Point;
- a defined Contactmoment;
- a Hulpaanvraag requiring action when the user is responsible.

The header notification bell and Dashboard must not expose records outside the active user's permitted scope.

---

# Management Insight

Management widgets are shown only when:

- the module is active;
- the effective permission allows it;
- the user has sufficient scope.

Examples may include:

- Coaching priorities;
- team indicators;
- KPI summaries;
- action-point counts;
- trends.

Do not calculate management data for unauthorised users and hide it only in the client.

---

# Action History

Operational Dashboard does not own administrative action history.

Action history belongs under:

- Beheer → Log.

Direct route and API access use the same effective log permission.

---

# Empty States

Keep the Dashboard understandable when no items exist.

Do not hide a required section in a way that suggests data failed to load.

Do not show artificial explanatory text where the approved design expects an empty value.

---

# Links

Dashboard links open the owning workflow:

- Begeleiding → existing Begeleiding route;
- Action Point → existing Action Point route;
- Contactmoment → Contactmoment route;
- Hulpaanvraag → Hulpaanvraag route.

Do not duplicate forms in Dashboard components.

---

# Validation

Relevant tests may include:

- dashboard attention;
- planning items;
- Coaching visibility;
- header todos;
- data access;
- menu rights.
