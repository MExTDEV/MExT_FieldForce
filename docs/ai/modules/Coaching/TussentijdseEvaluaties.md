# Tussentijdse Evaluaties

## Status

Functional area status: `PARTIALLY_DEFINED`

## Purpose

Tussentijdse evaluaties ondersteunt startersevaluaties voor actieve vertegenwoordigers met `representativeLevel = STARTER`.

De vaste evaluatiemomenten zijn:

- `MONTH_1_5`: zes kalenderweken na de officiele startdatum verkoopfunctie;
- `MONTH_3`: drie kalendermaanden na de officiele startdatum verkoopfunctie;
- `MONTH_5`: vijf kalendermaanden na de officiele startdatum verkoopfunctie.

De startdatum wordt opgeslagen op `User.starterStartDate`. Accountcreatie, eerste login en wijzigingsdatums mogen niet als fallback worden gebruikt.

## Current Implementation

Geimplementeerd:

- modulecode `TUSSENTIJDSE_EVALUATIES`;
- menu-permission `menu.coaching.starterEvaluations`;
- beheerbare startdatum verkoopfunctie in gebruikersbeheer;
- Prisma-tabellen voor evaluaties, vragen, rubrieken, snapshots, antwoorden en draftactiepunten;
- unieke databasebeperking op `representativeId + moment`;
- KPI-vlag `includeInStarterEvaluations`;
- centrale milestoneberekening in `lib/starter-evaluations.ts`;
- idempotente servergeneratie in `lib/server/starter-evaluations.ts`;
- initiele idempotente seed voor rubrieken en vragen zonder historische spreadsheetdata;
- Plesk-geschikt commando:

```powershell
npm run starter-evaluations:generate
```

Aanbevolen schema: dagelijks voor de werkdag, Europe/Brussels.

## Visibility And Scope

De module gebruikt bestaande module- en menuactivatie. Evaluaties worden alleen gegenereerd wanneer de module actief is.

De vraagconfiguratie ondersteunt scope:

- Global;
- Country;
- Team;
- User.

Bij meerdere toepasselijke scopes wint de meest specifieke vraagconfiguratie. Bij aanmaak wordt de effectieve formulierstructuur gesnapshot.

## Workflow Contract

De vastgelegde statussen zijn:

- `DUE`;
- `PREPARATION`;
- `READY_FOR_CONVERSATION`;
- `IN_PROGRESS`;
- `WAITING_FOR_APPROVAL`;
- `NOT_AGREED`;
- `APPROVED`;
- `CANCELLED`.

Statusovergangen, invulscherm, akkoordflow, PDF, Outlook-sync en actiepuntactivatie zijn nog niet volledig vrijgegeven in deze implementatiestap en mogen niet als afgedekt worden beschouwd.

## Open Items

- volledige invul- en detail-UI;
- server-side antwoordzichtbaarheid per rol en gespreksdatum;
- uitnodigen van vertegenwoordiger voor voorbereiding;
- e-mailflows via centrale mailservice;
- formele akkoord/niet-akkoordtransities;
- aanmaak van echte actiepunten na akkoord;
- definitieve PDF-snapshot;
- Outlook-afspraak sync;
- beheer-UI voor rubrieken en vragen;
- HR-recipient beheer;
- integratie van live KPI-resultaten en definitieve KPI-snapshots.
