# Coaching Navigation

## Purpose

This document defines Coaching entry points and routing principles.

Navigation never owns the underlying business workflow.

---

# Core Rule

Opening the same business object from different pages must reuse:

- the same record;
- the same permission logic;
- the same lifecycle;
- the same form or report;
- the same update path.

---

# Main Coaching Areas

- Dashboard
- Mijn Team
- Planning
- Begeleidingen
- Actiepunten
- Contactmomenten
- Retrainingen
- Salestrainingen
- Hulpaanvragen
- Tussentijdse evaluaties
- Rapportage
- Beheer

Visibility is controlled by module activation and effective permissions.

---

# Dashboard Entry Points

Dashboard may open:

- today's Begeleiding;
- pending approval;
- open Action Point;
- planned Contactmoment;
- Hulpaanvraag requiring attention;
- due Tussentijdse evaluatie;
- other defined workflow items.

Dashboard links route to the owning object.

---

# Planning Entry Points

Planning displays scheduled items.

Supported conceptual item types include:

- Begeleiding;
- Contactmoment;
- Retraining;
- Salestraining;
- Hulpaanvraag follow-up.

Only defined workflows receive create, open or edit behaviour.

Undefined item types may be shown only when existing data and routing are already documented.

---

# Begeleidingen Entry Points

Begeleidingen may open:

- today's record in execution mode;
- future record in planning or preparation mode;
- incomplete record in editable mode;
- Pending Approval record in read-only or approval mode;
- Completed record in report mode.

Mode depends on lifecycle and effective permission.

---

# Mijn Team Entry Points

A permitted user may open an employee fiche.

The fiche may link to visible:

- Begeleidingen;
- Action Points;
- Contactmomenten;
- Hulpaanvragen where appropriate;
- Performance Circle;
- KPI information;
- timeline items.

Each item routes to the owning module.

---

# Notifications

A notification deep link must open only a record the recipient is allowed to access.

Clicking an approval notification opens the existing Begeleiding route and updates the notification read marker.

---

# Management Navigation

Beheer subitems require explicit permission keys.

Examples include:

- Teams;
- Roles;
- KPI;
- Coaching framework and criteria;
- Settings;
- Log;
- Import/export.

Direct routes and APIs must enforce the same permission as the menu.

---

# Undefined Areas

Do not create navigation behaviour for:

- Retrainingen;
- Salestrainingen;
- Rapportage;

until their module documents define it.

A placeholder menu permission does not prove that the workflow is defined.
