# SalesApp bronaudit voor modulaire FieldForce

**Bronrepository:** `MExTDEV/Sales-App`  
**Geauditeerde ref:** `main`  
**Broncommit:** `02fe20abc96d4510d7bc1b55f406569896728177`  
**Doelrepository:** `MExTDEV/MExT_FieldForce`  
**Architectuurbranch:** `refactor/modular-fieldforce-architecture`

## Belangrijkste vaststelling

SalesApp is een werkende monolithische Next.js/React-app met een centrale `components/sales/SalesApp.tsx` en een centrale `AppView`-unieset. De functionaliteit is dus niet op zichzelf opgesplitst in zelfstandige technische modules. Een 1-op-1-integratie betekent daarom functionele pariteit behouden, niet de bestaande monolithische router één-op-één kopiëren.

## Functionele broninventaris

### Sales

De bron bevat onder meer:

- dashboard en persoonlijke informatie;
- voorbereiding en voorbereidingsdetail;
- agenda;
- teamoverzicht;
- afspraakdetail met voorbereiding, klantfiche, documenten, opvolging, leads, locaties, offertes, opmerkingen en verkoophistoriek;
- rapportering;
- cash sheet.

### Voorraad

De bron bevat:

- voorraadweergave;
- replenishments;
- verbruiksartikelen;
- voorraadgeschiedenis;
- koppelingen met klantlocaties, sublocaties, dragers, loten en vervaldata.

### Service

De bron bevat:

- service dashboard / mijn dag;
- interventies;
- serviceplanning;
- werkbonnen;
- onderhoud;
- servicecontracten;
- assets.

### PST

De bron bevat:

- PST-dashboard;
- segmenten;
- routes;
- prospectie;
- kaarten;
- goedkeuringen;
- vertegenwoordigers;
- PST-planning;
- kwaliteit.

### Contract

De bron bevat:

- contract calculator;
- contract- en servicegerelateerde gegevens;
- commerciële toegangsgegevens en prijs-/contractcontext.

## Technische bronankers

- `types/sales.ts`: domeintypes, `AppView`, rollen, permissies en commerciële gegevens.
- `components/layout/navigation.ts`: navigatiegroepen en rol-/permissiefilters.
- `components/sales/SalesApp.tsx`: centrale viewselectie en rendering.
- `components/appointment/`: afspraakdetail en deelviews.
- `components/stock/`: voorraad- en replenishmentflows.
- `components/service/`: serviceflows.
- `components/pst/`: PST-flows.
- `components/cash-sheet/`: cash-sheet.
- `components/admin/`: beheer en contract calculator.

## Doelmapping naar FieldForce

| SalesApp-functie | FieldForce-module | Integratie |
| --- | --- | --- |
| dashboard, agenda, afspraak, klantcontext | Sales | Coaching-events, users/teams |
| voorraad, replenishment, consumables, history | Inventory | Sales, Service, Contract |
| interventies, planning, work orders, assets | Service | Inventory, Contract, Planning |
| prospectie, routes, PST-planning, kwaliteit | PST | Sales, users/teams |
| calculator, entitlement, prijs-/contractcontext | Contract | Sales, Service |
| gebruikers, teams, landen, rechten, audit, notificaties | Platform | alle modules |
| begeleidingen, scores, actiepunten, reflecties | Coaching | alleen via expliciete platform-/eventcontracten |

## Migratieregels

1. Bestaande Coaching-runtime blijft op zijn huidige paden staan totdat een aparte migratie per slice bewezen is.
2. Nieuwe modulecode importeert geen interne code uit een andere module.
3. Cross-module communicatie loopt via `modules/contracts/index.ts`.
4. SalesApp-schermen worden per capability gemigreerd; de centrale `AppView` wordt niet als monolithisch geheel overgenomen.
5. Elke gemigreerde slice krijgt een parity-test en een handmatige UAT-check.
6. Geen databasewijzigingen zolang de functionele mapping en ownership niet zijn goedgekeurd.

## Eerstvolgende implementatieslice

De eerste echte slice wordt **Sales → afspraak/agenda + klantcontext**, omdat die de meeste verbindingen heeft met Planning, Inventory, Contract en Coaching. Voorraad, Service en PST blijven in deze fase alleen contractueel gekoppeld.
