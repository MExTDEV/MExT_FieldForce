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
- dynamisch beheerbare evaluatievragen via `Beheer > Vragen tussentijdse evaluatie`;
- multi-scope koppelingen per vraag via `StarterEvaluationQuestionScopeLink`;
- unieke databasebeperking op `representativeId + moment` voor automatische evaluaties;
- manuele startflow via de overzichtspagina voor leidinggevende en administratieve rollen;
- duplicate guard op actieve evaluaties met dezelfde vertegenwoordiger en evaluatiedatum;
- auditlogactie `starterEvaluation.manualStart`;
- KPI-vlag `includeInStarterEvaluations`;
- centrale milestoneberekening in `lib/starter-evaluations.ts`;
- idempotente servergeneratie in `lib/server/starter-evaluations.ts`;
- initiele idempotente seed voor rubrieken en vragen gebaseerd op de oude ODS-evaluatieformulieren;
- Plesk-geschikt commando:

```powershell
npm run starter-evaluations:generate
```

Aanbevolen schema: dagelijks voor de werkdag, Europe/Brussels.

## Visibility And Scope

De module gebruikt bestaande module- en menuactivatie. Evaluaties worden alleen gegenereerd wanneer de module actief is.

Manuele aanmaak is toegestaan voor `SALES_LEADER`, `COUNTRY_MANAGER`, `SALES_MANAGER`, `GROUP_MANAGER`, `ADMIN` en `SUPER_ADMIN`, binnen hun bestaande team- of landenscope. `REPRESENTATIVE` mag nooit zelf een tussentijdse evaluatie starten. De frontend verbergt de knop, maar de API valideert dezelfde scope opnieuw server-side.

De vraagconfiguratie ondersteunt cumulatieve scope:

- Global;
- Country;
- Team;
- User.

Een nieuwe evaluatie bevat alle actieve vragen die via globale, land-, team- en gebruikerskoppelingen op de geëvalueerde vertegenwoordiger van toepassing zijn. Wanneer dezelfde vraag via meerdere koppelingen matcht, wordt ze slechts één keer gesnapshot. Bij aanmaak wordt de effectieve formulierstructuur gesnapshot.

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

- volledige invul- en detail-UI op `/tussentijdse-evaluaties/[id]`;
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
