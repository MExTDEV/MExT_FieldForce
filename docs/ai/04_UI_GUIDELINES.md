# UI Guidelines

This document defines the user interface and user experience guidelines for MExT FieldForce.

The purpose of this document is to help developers and AI assistants preserve the existing MExT FieldForce look-and-feel when creating or modifying screens.

This document describes functional UI principles. It does not define technical implementation details, CSS class names or component internals.

---

# Core UI Principles

MExT FieldForce is designed as a professional field application.

The interface must support users who work on the road, often on tablets, with limited time for administration.

Every UI decision must support the following principles:

- Customer first
- Tablet first
- Minimal administration
- High information density
- Fast navigation
- Clear hierarchy
- Consistent behaviour
- Permission-aware visibility
- No unnecessary visual noise

The application should feel calm, structured and efficient.

---

# Existing Look-and-Feel

New functionality must integrate with the existing MExT FieldForce visual identity.

Do not introduce a separate visual style for new modules or screens.

The current visual language consists of:

- dark blue left sidebar
- white content cards
- light grey / blue-grey page background
- rounded corners
- subtle borders
- soft shadows
- compact spacing
- clear section headings
- blue primary buttons
- pill badges for statuses and roles
- icon-supported navigation and cards

Business rule:

New screens must look like they belong to the same application.

---

# Colour Usage

## Primary Colour

The primary application colour is MExT blue.

Use existing theme tokens or existing application styles.

Do not hardcode new blue tones unless explicitly requested.

Primary blue is used for:

- primary buttons
- active navigation state
- key icons
- progress bars
- important links

---

## Sidebar

The left sidebar uses a dark blue background.

The active menu item is shown as a light / white active block.

Sidebar rules:

- keep icons consistent with existing MExT style
- keep labels short
- preserve spacing and alignment
- do not introduce oversized navigation elements
- sidebar scrolling must stay subtle and visually aligned with the theme

---

## Status Colours

Status colours must be used consistently.

### Positive / OK

Use green tones for:

- good score
- completed
- synchronised
- no urgent attention required

### Negative / Attention

Use red tones for:

- bad score
- overdue approval
- expired action
- urgent attention

### Neutral / Informational

Use grey, blue-grey or light blue tones for:

- planned
- neutral score
- informational badges
- inactive states

### Planned Coaching

When a person has a planned coaching, light blue may be used as a row highlight.

### Bad Score

When a representative has a bad score, light red may be used as a row highlight.

The threshold between good and bad score must be configurable in Beheer → Instellingen.

---

# Typography

Typography must remain consistent across the application.

Guidelines:

- use clear headings
- keep labels short
- avoid long paragraphs in operational screens
- use compact explanatory text only where it helps the user
- keep table labels readable on tablets

Page titles should be strong and clear.

Section subtitles should explain purpose briefly.

Avoid technical language in the UI.

---

# Layout

## Page Structure

A standard page should contain:

1. Page category / eyebrow label
2. Page title
3. Short description
4. Primary action, if applicable
5. Main content cards or tables

Example:

- Category: INTERVENTIES
- Title: Begeleidingen
- Description: Bereid coaching voor, scoor gericht en volg afspraken op.
- Primary action: Nieuwe begeleiding

---

## Cards

Cards are used to group related information.

Card rules:

- use white background
- use rounded corners
- use subtle border or shadow
- keep content compact
- avoid large empty cards
- hide empty sections where possible

If a card has no data and does not help the user, it should be hidden or replaced with a compact empty state.

---

## Empty States

Empty states should be useful but not dominant.

Good empty state:

- short sentence
- clear meaning
- no unnecessary illustration unless already part of the design language

Avoid showing multiple large empty sections on one page.

If a section has no data and is not useful at that moment, hide it.

---

# Navigation

Navigation must be permission-driven.

Menu visibility is determined by:

- role configuration
- user-level overrides

Do not hardcode navigation visibility by role.

Every new main menu item must have:

- role-level permission configuration
- user-level override support
- documentation update

Reference:

- docs/ai/03_ROLES.md
- docs/ai/modules/Coaching/Navigation.md

---

# Buttons

## Primary Buttons

Primary buttons are used for the main action on a page.

Examples:

- Nieuwe begeleiding
- Actiepunt

Rules:

- use MExT blue
- use clear label
- use icon when helpful
- place primary action consistently at top right where applicable
- avoid multiple competing primary buttons on the same screen

---

## Secondary Actions

Secondary actions should be visually less dominant.

Examples:

- Fiche
- Bekijk verslag
- Filters wissen

Rules:

- do not compete with the primary action
- keep labels short
- use consistent alignment

---

# Tables and Lists

Tables and lists must be compact and readable.

Rules:

- show most relevant information first
- avoid unnecessary columns
- support filters where lists can become long
- preserve sorting logic
- use badges for status where useful
- make row click behaviour predictable

For activity history or long log-style tables:

- use pagination
- default page size should be 15 rows where specified
- preserve filters while navigating pages when possible

---

# Badges

Badges are used to communicate status, role or type.

Examples:

- Vertegenwoordiger
- Verkoopleider
- Gepland
- Ter akkoord verzonden
- Gefinaliseerd
- Gesynchroniseerd
- Globaal
- Land
- Team
- Persoonlijk

Badge rules:

- use short labels
- colour must communicate meaning
- do not overload rows with too many badges
- badge meaning must be consistent across screens

---

# Forms

Forms must be easy to complete on a tablet.

Rules:

- group fields logically
- keep required fields clear
- minimise manual typing
- prefer selection lists where possible
- keep labels clear and business-oriented
- preserve entered data when navigating between steps
- use validation before final submission

For long forms, use logical sections or wizard steps.

---

# WYSIWYG Fields

WYSIWYG fields are used for richer text such as Tips & Tricks.

Rules:

- typing must be stable
- cursor position must not jump while typing
- formatting should be simple
- avoid unnecessary toolbar complexity
- preserve content when saving drafts

---

# Wizards

Wizards are used for guided workflows such as planning a coaching.

Wizard rules:

- each step must have a clear purpose
- show only relevant fields
- allow the user to go back when safe
- preserve data between steps
- show a summary before final confirmation
- avoid unnecessary steps

For Coaching Planning, the wizard follows the flow defined in:

- docs/ai/modules/Coaching/FLOW.md

---

# Dashboard Guidelines

The Dashboard is the operational start page.

It should show what requires attention and provide fast access to common workflows.

Dashboard rules:

- keep high-priority items visible near the top
- show primary action clearly
- avoid management-only information for operational users
- hide widgets the user has no permission to see
- avoid displaying large empty sections
- management widgets should not distract operational users

Reference:

- docs/ai/modules/Coaching/Dashboard.md

---

# Mijn Team Guidelines

Mijn Team should provide a compact overview of field employees within the user's scope.

Rules:

- group by country, team and person
- show the team leader first within each team
- use visual indicators for follow-up status
- keep the Fiche action consistent
- do not show Mijn Team to representatives
- apply permission scope strictly

Reference:

- docs/ai/modules/Coaching/MijnTeam.md

---

# Begeleidingen Guidelines

The Begeleidingen page should help users find and open coaching sessions quickly.

Rules:

- show sections in this order:
  - Begeleidingen van vandaag
  - Toekomstige begeleidingen
  - Uitgevoerde begeleidingen

- hide empty sections where possible
- respect status and role permissions
- representatives must not see surprise coachings before approval stage
- management users must open coachings view-only unless explicitly allowed
- Super Admin can open coachings with Verkoopleider-level access

Reference:

- docs/ai/modules/Coaching/Begeleidingen.md

---

# Planning Guidelines

Planning is a calendar view.

Planning displays scheduled items but does not own their workflows.

Rules:

- clicking an item opens the correct related form
- Planning must not duplicate business logic
- item types must be visually distinguishable
- unsupported or undefined item types must not be invented

Reference:

- docs/ai/modules/Coaching/Planning.md

---

# Actiepunten Guidelines

Actiepunten should make follow-up clear and actionable.

Rules:

- show Open and Afgesloten sections
- use badges for action point type:
  - Globaal
  - Land
  - Team
  - Persoonlijk

- respect visibility scope
- clicking an action point opens detail view
- do not invent workflow behaviour until business rules are confirmed

Reference:

- docs/ai/modules/Coaching/Actiepunten.md

---

# Responsive and Tablet Behaviour

The application is tablet-first.

Current devices:

- Windows tablets

Future target devices:

- Android tablets
- Apple iPads

Rules:

- avoid Windows-specific UI assumptions
- touch targets must be large enough
- tables must remain usable on tablets
- important actions must remain visible
- avoid hover-only interactions
- minimise horizontal scrolling
- keep forms usable with touch input

---

# Performance and Perceived Speed

Field users work through mobile 5G connections and sometimes in environments with weaker signal.

UI rules:

- avoid unnecessary loading
- avoid excessive network calls caused by UI actions
- use compact data views
- show useful loading states
- avoid blocking the user unnecessarily

---

# Accessibility and Readability

The UI must remain readable for non-technical users.

Rules:

- maintain sufficient contrast
- avoid tiny text for important information
- use clear labels
- do not rely only on colour to communicate important status
- combine colour with labels or icons where needed

---

# Language and Terminology

User-facing text must support the application's languages.

Supported languages:

- Dutch
- French
- German

Rules:

- do not hardcode user-facing text
- use consistent terminology
- keep operational terms aligned with MExT business language

Examples of preferred terminology:

- Begeleiding
- Actiepunt
- Prestatiecirkel
- Focusfase
- Vertegenwoordiger
- Verkoopleider
- Wachten op akkoord

---

# Icons

Icons should support recognition but never replace text where clarity is required.

Rules:

- use icons consistent with the existing MExT style
- avoid mixing icon styles
- do not introduce decorative icons without functional value
- keep icon size consistent with surrounding text

---

# Modals and Detail Views

Use modals or detail views when they reduce navigation complexity.

Rules:

- do not hide critical information too deeply
- avoid modal chains
- provide clear close/back behaviour
- keep detail views readable
- use full page views for complex editing workflows

---

# PDF and Export UI

Export actions should be clear and predictable.

Rules:

- label export actions clearly
- do not mix export and edit actions visually
- show export status where useful
- preserve the MExT professional styling in generated output

---

# AI Implementation Rules

Before changing UI, an AI assistant must check:

- existing screen documentation
- Navigation.md
- TODO.md
- role and permission rules
- whether the screen has management-only or representative-only behaviour

AI assistants must not:

- introduce a new visual style
- duplicate existing components unnecessarily
- hardcode colours where theme tokens exist
- hardcode permissions
- create separate workflows for the same business object
- add user-facing text without translation support
- invent behaviour for undefined modules

When a UI change affects navigation, permissions or business workflow, update the relevant documentation.

---

# Open UI Areas

The following UI areas still require future refinement:

- exact score threshold for good/bad visual status
- final UI for Contactmomenten
- final UI for Retrainingen
- final UI for Salestrainingen
- final UI for Hulpaanvragen
- final Reporting UI
- final action point detail view
- final administrative Log location for Actiehistoriek
