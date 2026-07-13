# Coaching Completed Work — 2026 Q3

## Purpose

This document stores completed implementation history moved out of the active TODO.

It is not standard context for new tasks.

---

# Contactmomenten en Hulpaanvragen

## Contactmomentformulier initialiseert de vertegenwoordiger na asynchroon laden

- de eerste toegankelijke vertegenwoordiger wordt nu ook in de formulierstatus
  vastgelegd wanneer de vertegenwoordigerslijst pas na de eerste render beschikbaar
  komt;
- een bestaande handmatige selectie blijft behouden;
- de gerichte Contactmomenten-regressietest dekt deze initialisatie.

## Contactmomenten/Hulpaanvragen i18n-sweep

Completed: 12 July 2026, 22:03:19 +02:00

Implemented:

- fixed Contactmomenten and Hulpaanvragen UI copy moved to the shared translation system;
- Dutch, French and German keys added for overview, detail, form, photo, follow-up and error text;
- theme and follow-up labels display translated text while preserving stored workflow values;
- locale-specific date formatting added for these flows;
- static regression test added for Contactmomenten/Hulpaanvragen translation coverage;
- Contactmoment photo SQL query syntax corrected for the escaped `User` table name.

Validation:

- `npm run test:contact-help-i18n`;
- `npm run test:contact-moments`;
- `npm run test:help-requests`;
- `npm run typecheck`;
- `npm run lint`.

# Teams and Roles

## Country Manager Begeleidingen default aligned

Completed: 13 July 2026

Implemented:

- enabled `moduleVisitRecord` in the Country Manager role template;
- added migration `0030_country_manager_coaching_permission` for persisted role
  defaults and stale user snapshots;
- enforced the same permission in menu, direct route, workflow payload, detail,
  mutation and transition paths;
- retained Country Manager country scope and explicit user-level restrictions;
- deployed the migration to `MExT_FieldForce` and verified the stored role
  grant.

Validation:

- `npm run test:country-manager-coaching-access`;
- `npm run test:menu-rights`;
- `npm run test:coaching-visibility`;
- `npm run test:data-access`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run db:migrate:status`.

## Teams may exist without an assigned Verkoopleider

Completed: 8 July 2026

Implemented:

- optional primary team leader relation;
- null-safe team and Mijn Team behaviour;
- management visibility without broadening ordinary Verkoopleider access;
- user deletion no longer blocked by mandatory replacement leader;
- targeted team, menu and data-access tests.

## Teams grouped per country

Completed: 9 July 2026

Implemented:

- country grouping;
- collapsible country sections;
- compact team presentation;
- logical BE, NL, DE ordering;
- visibility of teams without assigned leader.

## Sales Manager role foundation

Completed before 10 July 2026

Implemented:

- distinct technical role;
- assigned country access;
- role and user permission integration;
- management visibility;
- ability to coach Representatives and Verkoopleiders inside scope.

Further role creation is not an active TODO. Only specific defects or policy changes should be tracked.

## Non-Representative Coaching edit consistency

Completed: 10 July 2026

Implemented:

- non-Representative roles may edit visible unlocked Coaching forms;
- shared client and server role rule;
- country, team and user scope preserved;
- Pending Approval and Completed remain locked.

---

# Notifications

## Header ToDo bell

Completed: 8 July 2026

Implemented:

- personal attention items;
- approval items for the coached person;
- surprise Coaching protection;
- shared workflow visibility;
- translated labels.

## Approval notifications

Completed: 9 July 2026

Implemented:

- persistent approval notification using the existing Approval record;
- polling;
- visual toast;
- sound attempt;
- notification read marker;
- deep link to existing Begeleiding;
- deduplication during browser session.

Remaining generic notification types belong in active TODO only when approved.

---

# Dashboard and Navigation

## Today requires attention

Completed: 8 July 2026

Implemented:

- Uit te voeren;
- Uitgevoerd;
- shared visibility data;
- separation from Coaching priorities.

## Action history moved to Beheer → Log

Completed: 8 July 2026

Implemented:

- removed from operational Dashboard;
- dedicated management permission;
- direct route and API enforcement;
- preserved filters and pagination.

---

# Mijn Team

## Fiche content respects active modules

Completed: 8 July 2026

Implemented:

- module-based sections;
- permission-based tabs;
- scoped timeline;
- user override support;
- relevant visibility tests.

## Planned Begeleiding indicator

Completed during July 2026

Implemented:

- planned status indicator in Mijn Team.

Score threshold colouring remains an open business decision.

---

# Action Points

## Scoped Action Point management

Completed: 8 July 2026

Implemented:

- Global, Country, Team and User scope;
- management create and update flow;
- active/inactive behaviour;
- linked products;
- scoped overview;
- user grouping;
- permission enforcement;
- Dashboard count integration;
- workflow-created personal Action Points.

Operational closure, approval, reopening and reassignment remain undefined.

## Coaching Action Point persistence fixes

Completed: 8–9 July 2026

Implemented:

- persistence when completing a Begeleiding;
- Representative visibility;
- fallback and scope corrections.

---

# KPI Management

## Expanded KPI management

Completed: 8 July 2026

Implemented:

- default and period targets;
- scope priorities;
- conflict detection;
- reporting and Performance Circle inclusion flags;
- management permissions;
- targeted KPI tests.

Production migration and seed verification remain a release task.

---

# Validation Notes

Several completed tasks encountered the known Windows Prisma query-engine file lock during full `npm run build`.

Where recorded:

- targeted tests passed;
- typecheck and lint passed;
- `npx next build` passed using the existing generated client.

Browser-based visual validation remained outside Codex because the local development server is externally managed.
