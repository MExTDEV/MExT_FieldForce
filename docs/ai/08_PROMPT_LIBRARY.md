# Prompt Library

This document contains reusable prompt templates for AI-assisted development on MExT FieldForce.

The purpose of this file is to reduce repeated context in Codex prompts and to make development requests more consistent.

Use these prompts as starting points. Replace the placeholders before sending them to Codex.

---

# General Rules for Using These Prompts

Every Codex prompt should be specific, scoped and measurable.

Do not combine unrelated features in one prompt.

Prefer one focused task at a time.

Before asking Codex to modify code, always tell it which documentation to read.

---

# Standard Codex Preamble

Use this at the start of most Codex prompts.

```text
You are working on the MExT FieldForce project.

Before making changes, read:

- AGENTS.md
- docs/ai/INDEX.md
- docs/ai/01_ARCHITECTURE.md
- docs/ai/03_ROLES.md
- docs/ai/04_UI_GUIDELINES.md
- docs/ai/05_DEVELOPMENT_STANDARDS.md

If the task is related to Coaching, also read:

- docs/ai/modules/Coaching/README.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/FLOW.md
- docs/ai/modules/Coaching/TODO.md

Follow the existing architecture, permissions, UI style and naming conventions.

Do not duplicate workflows or business logic.

Do not invent undefined behaviour.

When a requirement is unclear, state what is unclear before implementing.

After the change:
- run the relevant checks where possible
- ensure the project remains buildable
- update documentation if behaviour, architecture, roles or database logic changed
```

---

# Prompt 1 - Small Bug Fix

Use when fixing one clear defect.

```text
TASK: Fix a small bug in MExT FieldForce.

Read the standard project documentation first.

Bug:
[Describe the bug clearly]

Expected behaviour:
[Describe exactly what should happen]

Current behaviour:
[Describe what happens now]

Scope:
- Only change files required to fix this bug.
- Do not refactor unrelated code.
- Do not change permissions unless explicitly required.
- Do not change the UI style except where needed to fix the bug.

Validation:
- Verify that the bug is fixed.
- Verify that no related workflow is broken.
- Run lint/build if possible.

After completion:
- Explain which files changed.
- Explain why the fix works.
```

---

# Prompt 2 - UI Change

Use when changing layout, visual hierarchy, spacing, colours or component behaviour.

```text
TASK: Apply a UI change in MExT FieldForce.

Read first:

- AGENTS.md
- docs/ai/04_UI_GUIDELINES.md
- docs/ai/05_DEVELOPMENT_STANDARDS.md

If this is in Coaching, also read:
- docs/ai/modules/Coaching/README.md
- docs/ai/modules/Coaching/Navigation.md

Requested UI change:
[Describe the UI change]

Screen:
[Name of screen]

Important constraints:
- Preserve the existing MExT look-and-feel.
- Do not introduce a new visual language.
- Keep the design tablet-first.
- Keep spacing compact and readable.
- Preserve permission-driven visibility.
- Do not remove existing functionality.

Validation:
- Check desktop/tablet layout.
- Check empty states.
- Check role-based visibility if relevant.
```

---

# Prompt 3 - Permission or Role Change

Use for role, visibility, menu or access-right changes.

```text
TASK: Implement or correct role-based permissions.

Read first:

- AGENTS.md
- docs/ai/03_ROLES.md
- docs/ai/01_ARCHITECTURE.md
- docs/ai/05_DEVELOPMENT_STANDARDS.md

If this is in Coaching, also read:
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/FLOW.md

Required permission change:
[Describe the change]

Roles involved:
[Vertegenwoordiger / Verkoopleider / Sales Manager / Country Manager / Admin / Super Admin]

Rules:
- Do not hardcode permissions if a permission model already exists.
- Main menu visibility must be permission-driven.
- Role configuration defines the default.
- User-level overrides can overrule role configuration.
- Do not grant broader access than requested.
- Verify country/team/user scope.

Validation:
- Test at least the affected roles.
- Confirm hidden items are not accessible by direct URL if applicable.
- Update docs/ai/03_ROLES.md if the role behaviour changes.
```

---

# Prompt 4 - Coaching Dashboard TODOs

Use for Dashboard items from the Coaching TODO.

```text
TASK: Work on Coaching Dashboard TODOs.

Read first:

- AGENTS.md
- docs/ai/modules/Coaching/README.md
- docs/ai/modules/Coaching/Dashboard.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/TODO.md
- docs/ai/04_UI_GUIDELINES.md

Specific TODO to implement:
[Copy the exact TODO item]

Rules:
- Keep Dashboard as the primary landing page.
- Do not move business logic into Dashboard if it belongs to another module.
- Dashboard widgets may link to existing workflows, but must not duplicate them.
- Respect permission-driven visibility.
- Preserve existing layout and MExT styling.

Validation:
- Verify the widget content.
- Verify navigation targets.
- Verify empty states.
- Verify role visibility.
```

---

# Prompt 5 - Begeleidingen Change

Use for changes to the Begeleidingen page or coaching overview.

```text
TASK: Modify the Coaching Begeleidingen page.

Read first:

- AGENTS.md
- docs/ai/modules/Coaching/README.md
- docs/ai/modules/Coaching/Begeleidingen.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/FLOW.md
- docs/ai/modules/Coaching/TODO.md
- docs/ai/03_ROLES.md

Requested change:
[Describe the requested change]

Business rules:
- Representatives only see own coachings.
- Representatives only see planned coachings when notification was enabled during planning.
- Surprise coachings must remain hidden from representatives until at least Pending Approval / Wachten op akkoord.
- Verkoopleiders see own team.
- Sales Managers see assigned country scope.
- Country Managers and Admins see assigned scope.
- Super Admin sees everything.
- Multiple entry points must open the same coaching form.

Validation:
- Verify sections: today, future, historical.
- Verify empty sections.
- Verify permissions per role.
- Verify correct open mode: edit, preparation/view or read-only.
```

---

# Prompt 6 - Mijn Team Change

Use for changes to My Team / Mijn Team.

```text
TASK: Modify the Coaching Mijn Team page.

Read first:

- AGENTS.md
- docs/ai/modules/Coaching/MijnTeam.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/TODO.md
- docs/ai/03_ROLES.md
- docs/ai/04_UI_GUIDELINES.md

Requested change:
[Describe the requested change]

Business rules:
- Representatives must not see Mijn Team.
- Verkoopleiders see own team only.
- Sales Managers see assigned country scope.
- Country Managers see assigned country scope.
- Admins see assigned country scope.
- Super Admin sees everything.
- People are grouped by country, team and person.
- Verkoopleider appears first within the team.
- The Fiche action opens the employee/representative profile.

Validation:
- Verify grouping.
- Verify scope.
- Verify visual indicators.
- Verify that disabled modules do not appear on the fiche where applicable.
```

---

# Prompt 7 - Actiepunten Change

Use for action point functionality.

```text
TASK: Modify or implement Coaching Actiepunten.

Read first:

- AGENTS.md
- docs/ai/modules/Coaching/Actiepunten.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/TODO.md
- docs/ai/03_ROLES.md

Requested change:
[Describe the requested change]

Known status:
The detailed Action Point workflow is not fully defined yet.

Rules:
- Do not invent missing business rules.
- If the required detail workflow is unclear, stop and list the open questions.
- Action points can exist at global, country, team and personal scope.
- Show Open and Afgesloten sections.
- Show badges: Globaal, Land, Team, Persoonlijk.
- Apply role and scope visibility.

Validation:
- Verify scope filtering.
- Verify open/closed sections.
- Verify type badges.
- Verify detail navigation.
```

---

# Prompt 8 - Planning Change

Use for Planning/calendar changes inside Coaching.

```text
TASK: Modify Coaching Planning behaviour.

Read first:

- AGENTS.md
- docs/ai/modules/Coaching/Planning.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/FLOW.md
- docs/ai/03_ROLES.md

Requested change:
[Describe the requested change]

Rules:
- Planning displays scheduled items but does not own their business workflow.
- Clicking Begeleiding opens the existing Coaching Form.
- Do not duplicate the Coaching Form.
- Contactmoment, Retraining, Salestraining and Hulpaanvraag workflows are not fully defined.
- Undefined planning item behaviour must not be invented.

Validation:
- Verify item display.
- Verify click target.
- Verify role visibility.
- Verify Outlook sync is not broken if relevant.
```

---

# Prompt 9 - Database Change

Use only when a database or Prisma change is required.

```text
TASK: Implement a database change.

Read first:

- AGENTS.md
- docs/ai/02_DATABASE.md
- docs/technical/database.md
- docs/technical/database-development-policy.md
- docs/ai/03_ROLES.md

Required data change:
[Describe the required change]

Rules:
- Check whether the data already exists before adding new fields or tables.
- Avoid duplicate business data.
- Use Prisma schema as the ORM source.
- Create a migration when the model changes.
- Do not manually change the production database schema.
- Document business calculations.
- Respect role and permission scope in all data access.

Validation:
- Verify migration.
- Verify Prisma client generation.
- Verify existing data compatibility.
- Update docs if the data model or business meaning changes.
```

---

# Prompt 10 - Undefined Requirement Clarification

Use when a topic is not yet defined and Codex should not invent behaviour.

```text
TASK: Analyse an undefined requirement without implementing it.

Read first:

- AGENTS.md
- docs/ai/INDEX.md
- docs/ai/05_DEVELOPMENT_STANDARDS.md

Requirement:
[Describe the unclear requirement]

Do not implement code.

Instead:
- identify missing business decisions
- list affected modules
- list affected roles
- list affected data entities
- list affected screens
- propose questions for the business
- propose a safe implementation plan after clarification

Output:
- clarification questions
- risk list
- recommended next steps
```

---

# Prompt 11 - Documentation Update

Use after a meaningful feature or architecture change.

```text
TASK: Update MExT FieldForce AI documentation.

Read first:

- AGENTS.md
- docs/ai/INDEX.md

Change that was implemented:
[Describe the change]

Update the relevant documentation only.

Possible files:
- docs/ai/01_ARCHITECTURE.md
- docs/ai/02_DATABASE.md
- docs/ai/03_ROLES.md
- docs/ai/04_UI_GUIDELINES.md
- docs/ai/05_DEVELOPMENT_STANDARDS.md
- docs/ai/06_DEPLOYMENT.md
- docs/ai/07_KNOWN_ISSUES.md
- docs/ai/modules/Coaching/README.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/FLOW.md
- docs/ai/modules/Coaching/TODO.md
- docs/ai/modules/Coaching/[screen].md

Rules:
- Do not duplicate information.
- Keep documents concise.
- If a rule belongs in another document, reference it instead of copying it.
- Preserve existing structure.
```

---

# Prompt 12 - Final Validation Before Merge

Use after Codex has completed a change.

```text
TASK: Validate the completed change before merge.

Read first:

- AGENTS.md
- docs/ai/05_DEVELOPMENT_STANDARDS.md
- docs/ai/07_KNOWN_ISSUES.md

Validate:

1. The original request was implemented.
2. No unrelated changes were introduced.
3. UI still matches the MExT look-and-feel.
4. Permissions are still correct.
5. Existing workflows are not duplicated.
6. Existing business logic is not duplicated.
7. Database changes, if any, are documented.
8. Translations/user-facing text are handled consistently.
9. Lint/build have been run where possible.
10. Documentation was updated where needed.
11. App can run locally.
12. Webserver runs on the expected port.

If everything is valid:
- merge with main if requested
- push to Git if requested

If not valid:
- list blocking issues first
- do not merge
```

---

# Prompt 13 - Webserver / Port 3000 Recovery

Use when Codex has stopped or broken the local dev server.

```text
TASK: Diagnose and recover the local MExT FieldForce development server.

Goal:
The application must run locally on port 3000.

Steps:
1. Check whether a process is already using port 3000.
2. If port 3000 is occupied by a stale process, identify it.
3. Stop only the stale or incorrect process.
4. Start the development server using the project scripts.
5. Confirm the application is reachable on port 3000.
6. If it starts on another port, explain why and correct it if possible.

Do not change application code unless required to fix a configuration issue.

Report:
- what was running
- what was stopped
- what command was used to restart
- which port is active
```

---

# Prompt 14 - Create a New Main Menu Item

Use when adding a new main navigation item.

```text
TASK: Add a new main menu item.

Read first:

- AGENTS.md
- docs/ai/01_ARCHITECTURE.md
- docs/ai/03_ROLES.md
- docs/ai/04_UI_GUIDELINES.md
- docs/ai/05_DEVELOPMENT_STANDARDS.md

New main menu item:
[Name]

Rules:
- Main menu visibility must be permission-driven.
- Add role-level configuration.
- Add user-level override configuration.
- Do not hardcode visibility by role only.
- Respect existing menu styling.
- Add icon consistent with existing MExT icons.
- Add documentation.

Validation:
- Verify visibility per role.
- Verify user override.
- Verify hidden users cannot navigate directly if access should be blocked.
```

---

# Prompt 15 - Add Sales Manager Role

Use when implementing the Sales Manager role.

```text
TASK: Add Sales Manager as a separate application role.

Read first:

- AGENTS.md
- docs/ai/03_ROLES.md
- docs/ai/01_ARCHITECTURE.md
- docs/ai/modules/Coaching/Navigation.md
- docs/ai/modules/Coaching/TODO.md

Business rules:
- Sales Manager is a separate role.
- Sales Manager is above Verkoopleider.
- Sales Manager can have access to one or more countries.
- Sales Manager is not the same as Country Manager.
- Sales Manager is not the same as Verkoopleider.
- Sales Manager sees teams and users within assigned country scope.
- Permissions must be configurable through role management.
- User-level overrides must be supported.

Required checks:
- Main menu visibility
- Dashboard widgets
- Mijn Team visibility
- Begeleidingen visibility
- Planning visibility
- Actiepunten visibility
- Rapportage visibility
```

---

# Prompt Selection Guide

Use this guide to choose the correct prompt.

Small defect:

- Prompt 1

UI-only change:

- Prompt 2

Role or visibility change:

- Prompt 3

Dashboard task:

- Prompt 4

Begeleidingen task:

- Prompt 5

Mijn Team task:

- Prompt 6

Actiepunten task:

- Prompt 7

Planning task:

- Prompt 8

Database change:

- Prompt 9

Unclear requirement:

- Prompt 10

Documentation update:

- Prompt 11

Before merge:

- Prompt 12

Server issue:

- Prompt 13

New menu item:

- Prompt 14

Sales Manager role:

- Prompt 15
