# Contractcalculatie

## Doel

Contractcalculatie is een zelfstandige FieldForce-applicatie binnen dezelfde Next.js-shell, authenticatie, rollen, datascope, auditlogging en Prisma/MySQL-database.

De module migreert de aangeleverde Lovable-contracttool naar native FieldForce-code zonder Supabase-runtime, iframe, tweede login of apart rollenmodel.

## Routes

- `/contract`
- `/contract/new`
- `/contract/calculations`
- `/contract/customers`
- `/contract/reporting`
- `/contract/manage`

De API-routes staan onder `/api/contract/*`.

## Rechten en scope

Moduletoegang gebruikt de bestaande permissions:

- `menu.contract.enabled`
- `menu.contract.open`

Contractbeheer gebruikt centrale permissions:

- `contractArticlesManage`
- `contractImportsManage`
- `contractModelsManage`

Beheer is beperkt tot `ADMIN` en `SUPER_ADMIN`.

Datascope wordt server-side afgedwongen:

- `REPRESENTATIVE`: eigen klanten en berekeningen.
- `SALES_LEADER`: eigen data en teamdata.
- `SALES_MANAGER` en `ADMIN`: toegewezen landen, met fallback naar eigen land.
- `COUNTRY_MANAGER`: eigen land.
- `GROUP_MANAGER` en `SUPER_ADMIN`: alle contractdata.

## Datamodel

Nieuwe Prisma-modellen:

- `ContractArticle`
- `ContractCustomer`
- `ContractModelVersion`
- `ContractTermRule`
- `ContractCalculation`
- `ContractCalculationLine`
- `ContractImportRun`
- `ContractLetterTemplate`
- `ContractGeneratedDocument`

Geldvelden gebruiken Prisma `Decimal`. Berekeningen en regels bewaren snapshots van prijzen, omschrijvingen, klanttaal, looptijd, korting en modelversie.

## Berekening

De centrale engine staat in `lib/contract/calculation-engine.ts`.

Formules:

- `lineAmount = quantity * unitPrice`
- `subtotal = sum(lineAmount)`
- `3 jaar = subtotal * 0.65`
- `5 jaar = subtotal * 0.60`
- `lineCost = quantity * unitCost`
- `totalCost = sum(lineCost)`

Bedragen worden afgerond op 2 decimalen. De serverberekening is de bron van waarheid.

## Excel-import

De adapter `MEXT_ALL_IN_2026_V1` staat in `lib/contract/importer/`.

De adapter valideert:

- OOXML/ZIP-signatuur;
- werkblad `Input`;
- verborgen werkblad `Template`;
- werkblad `Legende`;
- tabel `MExTBE_Item`;
- vereiste kolommen;
- unieke artikelnummers;
- niet-negatieve prijzen;
- ondersteunde `Total Amount`-formule.

VBA wordt niet uitgevoerd. Een onbekende formule of structuur blokkeert import.

## Initiële import

Gebruik na migratie:

```powershell
npm run contract:import-catalog -- "C:\pad\naar\Contractberkening_Tool_09062026_NL (1).xlsm"
```

Het script is idempotent op SHA-256/modelversie en verwijdert geen bestaande businessdata.

## PDF en handtekening

De client genereert nog een interne berekenings-PDF via de bestaande `jspdf`-dependency.

Klantgerichte ondertekening gebruikt een actieve Contract-brief per klanttaal. Zonder actieve template voor `nl`, `fr` of `de` wordt ondertekening geblokkeerd. De ondertekende contractbrief wordt server-side als PDF gegenereerd, onder `FIELD_FORCE_UPLOAD_ROOT` bewaard, en via `ContractGeneratedDocument` immutable aan de berekening gekoppeld.

De klantgerichte contractbrief toont geen kostprijs en geen marge. `TOTALEKOST` bestaat als interne templateparameter, maar margeparameters zijn bewust niet beschikbaar omdat marge niet van toepassing is op deze contractberekening.

Er is geen goedkeuringsflow, e-mailflow of ERP-koppeling in deze fase.

## Contract-brief

Beheer staat onder `/contract/manage` en bevat de sectie `Contract-brief`.

Templates:

- zijn versieerbaar per taal;
- accepteren alleen `.docx`;
- blokkeren `.docm`, macrobestanden, onbekende parameters en foutief geplaatste structurele parameters;
- bewaren checksum, broninhoud, validatieresultaat, uploader en activatiegegevens;
- laten maximaal één actieve versie per taal toe via transacties;
- verwijderen oude versies niet.

Ondersteunde parameters staan centraal in `lib/contract/letter.ts`. Belangrijkste structurele regels:

- `[PRODUCTLIST]` moet alleen in een eigen paragraaf staan;
- `[PRODUCTLIST]` wordt in de gegenereerde PDF een producttabel met artikelnummer, omschrijving en aantal;
- productdata komt uit `ContractCalculationLine`-snapshots;
- `[HANDTEKENING]` mag alleen als eigen paragraaf gebruikt worden.

Documenten:

- bewaren templateversie en parametersnapshot;
- krijgen een oplopende documentversie per berekening;
- worden niet overschreven;
- worden beveiligd gedownload via `/api/contract/documents/[id]/download`;
- volgen dezelfde Contractcalculatie-scope als de berekening.

## Checklist All-In

Deze eerste versie structureert artikelregels en snapshots zodat een Checklist All-In op basis van geselecteerde artikelen kan worden uitgebreid. Bezoekadressen, dragers en verdeling per drager worden niet verzonnen omdat de huidige Lovable-flow die data niet verzamelt.

## Tests

Nieuwe scripts:

- `npm run test:contract-calculation`
- `npm run test:contract-import`
- `npm run test:contract-letter`

Regressiecommando's:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Bekende beperkingen

- Er is geen NAV/Odoo-koppeling.
- Er is geen managementgoedkeuringsflow.
- Er is geen centrale PDF-opslag of e-mailverzending.
- FR/DE artikelomschrijvingen vallen bij de initiële import terug op Nederlands totdat officiële vertalingen beschikbaar zijn.
