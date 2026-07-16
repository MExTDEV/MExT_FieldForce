# Volledige integratie-audit SalesApp → FieldForce SalesDay

**Auditdatum:** 15 juli 2026

**Besluiten verwerkt:** 16 juli 2026

**Doel:** beslissen of en hoe de lokale SalesApp veilig als SalesDay-module in FieldForce kan worden geïntegreerd

**Karakter:** read-only audit; dit document voert geen integratie, migratie of configuratiewijziging uit

**Canonieke vervolgbesluiten:** `docs/ai/modules/Salesday/DECISIONS.md`

**Uitvoerbaar plan:** `docs/ai/modules/Salesday/IMPLEMENTATION-PLAN.md`

## 1. Executive summary

De SalesApp bevat een brede, visueel bruikbare functionele verkenning van een toekomstige SalesDay-ervaring: dagvoorbereiding, agenda, klant- en afspraakdetail, verkoopregistratie, voorraad, bevoorrading, verbruiksgoederen, kas, rapportering, PST, Service en beheer. De applicatie is echter geen productieklare bronmodule. De hoofdapplicatie is één grote client-side React-state-machine met mockdata, een gesimuleerde login, vrijwel geen serverlaag, geen eigen persistente database, geen afdwingbare scope en geen audittrail. Mutaties zoals afspraakafsluiting, stockontvangst, verkoop en kasblokkering bestaan alleen in browsergeheugen.

FieldForce heeft daarentegen al de vereiste platformfundamenten: NextAuth, gebruikers en teams, effectieve rechten met overrides, land- en teamscope, Prisma/MySQL, server-side API-beveiliging, auditing, private bestandsopslag, meertaligheid en een bestaande lokale Contract-implementatie. SalesApp wordt daarom niet letterlijk samengevoegd. Het juiste traject is een gecontroleerde herimplementatie van het goedgekeurde SalesDay-gedrag boven op FieldForce-primitieven, met SalesApp als functionele en gedeeltelijk visuele referentie.

De audit en de beslissingsronde leiden tot **GO WITH CONDITIONS**:

1. de eerste productieactivering bevat de volledige goedgekeurde operationele scope, inclusief offline mutaties; ontwikkeling gebeurt wel via intern afgeschermde mijlpalen;
2. het ERP — nu BC/NAV, later Odoo — is na bevestigde synchronisatie de finale bedrijfsbron; FieldForce is invoer-, offline-, presentatie-, scope- en commandlaag met een technische replica;
3. FieldForce-commands zijn duurzaam en idempotent en krijgen bij de goedgekeurde klant-/afspraakconflicten voorrang; geen command wordt stil verloren;
4. elke route, API, bootstrapset, filedownload en offline dataset krijgt server-side recht- en scopecontrole; management is operationeel read-only;
5. klantdata wordt centraal gedeeld door SalesDay en Contract; artikelen/prijzen komen uit het ERP; er komt geen tweede Contractcalculator;
6. Shared Inventory, verkoopdocumenten, handtekening, documentnummerreeksen, kasblokkering en één volledige offline werkdag behoren tot de eerste productiebelofte;
7. productie blijft geblokkeerd zolang de werkelijke ERP-interface, end-to-end reconciliatie en alle productiepoorten niet bewezen zijn;
8. prototypecode wordt alleen selectief vertaald naar kleine server/client-componenten; de grote `SalesApp.tsx` en `AppointmentDetailView.tsx` worden niet gekopieerd.

De businessbeslissingen zijn inmiddels genomen en vastgelegd in `docs/ai/modules/Salesday/DECISIONS.md`. De aanbevolen eerstvolgende stap is implementatiemijlpaal 0 uit `IMPLEMENTATION-PLAN.md`: provider-neutrale ERP-contracten, Contract-baseline, gedeeld relatie-/artikelmigratieontwerp, sync/idempotency en testbaseline. Er worden geen BC/NAV-endpoints verzonnen zolang de echte interface onbekend is.

## 2. Repositories, branches en herkomst

Voor deze audit zijn de remote refs expliciet opgehaald. De vergelijking hieronder is dus gebaseerd op de toestand van `origin/main` op 15 juli 2026, niet alleen op een oudere lokale tracking-ref.

| Werkboom | Branch | Remote | HEAD | Afwijking van `origin/main` |
|---|---|---|---|---|
| `C:\Users\jand\Documents\Codex\FieldForce` | `main` | `https://github.com/MExTDEV/MExT_FieldForce.git` | `d03c854` — *Clarify Microsoft Graph profile photo token diagnostics* | 0 ahead / 0 behind |
| `C:\Users\jand\Documents\Codex\SalesApp` | `main` | `https://github.com/MExTDEV/Sales-App.git` | `02fe20a` — *Add service day and stock acceptance flows* | 0 ahead / 0 behind |
| `C:\Users\jand\Documents\Codex\SalesApp\mext-stock-flow-codex` | `main` | `https://github.com/MExTDEV/mext-stock-flow.git` | `81e8e30` — *Validatie negatieven & komma's* | 0 ahead / 0 behind |

De map `mext-stock-flow-codex` is een afzonderlijke Git-repository die in de buitenste SalesApp-repository als volledig untracked verschijnt. Ze is technisch en functioneel geen onderdeel van de getrackte SalesApp-code. De audit behandelt ze daarom als een bijkomende referentie voor materiaal-/stockprocessen, niet als code die automatisch mee migreert.

## 3. Lokale wijzigingen die niet op GitHub staan

### 3.1 FieldForce

De FieldForce-werkboom bevat reeds bestaande, niet-gepubliceerde Contract-werkzaamheden. De audit heeft die bestanden alleen gelezen en niet aangepast:

- gewijzigde platformbestanden rond navigatie, rechten, types, gebruikersbeheer, vertalingen, `package.json` en `prisma/schema.prisma`;
- nieuwe routes onder `app/contract/` en `app/api/contract/`;
- nieuwe componenten onder `components/contract/`;
- nieuwe servercode onder `lib/contract/`;
- Contract-migraties `0036_contract_calculation`, `0037_remove_contract_margin` en `0038_contract_letter_documents`;
- Contract-import-, berekenings- en documenttests;
- `docs/contract-calculation.md`.

Deze lokale implementatie is materieel voor de integratiebeslissing: Contract is in FieldForce al veel verder dan de gelijknamige SalesApp-prototypefuncties. Een SalesDay-integratie moet daarop aansluiten en mag deze werkboom niet overschrijven, hernummeren of dupliceren.

### 3.2 SalesApp

De buitenste SalesApp-repository had vóór de audit uitsluitend de untracked map `mext-stock-flow-codex/`. Build en typecheck wijzigden tijdelijk gegenereerde bestanden; die validatiechurn is exact naar `HEAD` hersteld. De eindstatus van de buitenste repository is opnieuw alleen:

```text
?? mext-stock-flow-codex/
```

De geneste stockrepository heeft twee lokale afwijkingen:

- `src/routeTree.gen.ts` bevat lokaal gewijzigde gegenereerde importpaden;
- `package-lock.json` is lokaal untracked, terwijl de repository Bun gebruikt.

Deze wijzigingen zijn geen betrouwbare bron voor migratie. De routeboom moet in zijn eigen repository opnieuw worden gegenereerd; het lockfile-beleid moet daar apart worden beslist.

## 4. Architectuur van SalesApp

### 4.1 Getrackte hoofdapplicatie

De hoofdapplicatie bevat circa 107 relevante bronbestanden: 2 pagina's, ongeveer 60 componenten, mockdata, domeintypes, helpers en 3 locale-bestanden. Er zijn geen API-routes, server actions, Prisma-schema's, authenticatie-adapters of geautomatiseerde tests.

De architectuur is een prototype-architectuur:

- `app/page.tsx` en `app/pst/page.tsx` renderen dezelfde client-app;
- `components/sales/SalesApp.tsx` beheert login, rol, land, taal, actieve view en bijna alle bedrijfsdata via `useState`;
- navigatie wordt uit `window.location` en queryparameters afgeleid, niet uit beveiligde Next.js-routes;
- gebruikers, afspraken, stock, verkoop, kas, PST en Service komen uit statische mockbestanden;
- “opslaan” muteert lokaal state; na refresh is de wijziging weg;
- de login is een UI-simulatie en verleent geen server-side identiteit;
- scope wordt client-side afgeleid uit rolstrings en land, zonder database of afdwingbare queryfilters;
- `localStorage` wordt alleen gebruikt voor taal en een gesimuleerde Peppol-cache;
- foto's, handtekeningen en ontwerpbestanden gebruiken data- of object-URL's, zonder duurzame opslag;
- datum- en getalformattering gebruikt op meerdere plaatsen vast `nl-BE` of `en-CA` in plaats van de actieve taal/zone.

De grootste onderhoudsrisico's zijn de monolithische bestanden `SalesApp.tsx`, `AppointmentDetailView.tsx` en `ServicePlanningView.tsx`. De nested componentpaden rond afspraakdetail en SalesWizard zijn veelal alleen re-exports; zij vormen nog geen echte modulair gescheiden implementatie.

### 4.2 Geneste `mext-stock-flow`-applicatie

Deze applicatie gebruikt TanStack Start/Vite, Cloudflare, Supabase, React Query, i18next en een afzonderlijk database-/RLS-model. Ze bevat circa 106 bronbestanden, 18 routes, 11 Supabase-migraties en 2 edge functions.

Functioneel beheert ze materialen, personen, uitgifte, teruggave, bewegingen, te ontvangen materialen, rapporten en beheerreferenties. Dit is vooral een asset-toewijzingsproces. Het is niet automatisch hetzelfde als verkoopbare artikelvoorraad per vertegenwoordiger.

De app toont nuttige procespatronen, maar ook een belangrijk risico: bij uitgifte en teruggave worden statuswijziging en bewegingsregistratie in afzonderlijke operaties uitgevoerd. Zonder één database-transactie kan een status veranderen zonder corresponderende beweging of omgekeerd. Daarom mag dit geen technisch sjabloon voor FieldForce-stockboekingen zijn.

## 5. Architectuur van FieldForce

FieldForce is een modulaire Next.js-applicatie met Prisma/MySQL en een gedeelde platformlaag. De onderzochte bronset bevat circa 398 relevante bestanden, waaronder 61 API-routes, 42 migratiemappen, serverhelpers, scripts en modulecomponenten.

De herbruikbare platformfundamenten zijn:

- NextAuth met credentials en Microsoft Entra;
- `User`, `Team`, `Role`, landtoegang, rolrechten en gebruikersoverrides;
- effectieve server-side scopes voor eigen gebruiker, team, land en groep;
- centrale app-shell, navigatie, moduleconfiguratie en vertalingen;
- Prisma als persistente bron van waarheid;
- uniforme API-foutafhandeling en request-ID's;
- generieke `AuditLog` en domeinspecifieke histories;
- private opslagpatronen voor foto's en gegenereerde documenten;
- bestaande Coaching- en lokale Contract-domeinen.

SalesDay, PST en Service bestaan momenteel grotendeels als navigatie- en placeholderconcepten. De links `/salesday/mijn-voorbereiding`, `/salesday/mijn-agenda`, `/salesday/mijn-team` en `/salesday/mijn-voorraad` worden door de generieke catch-all weergegeven.

Er is een relevante toegangsafwijking:

- `canAccessSalesday` sluit `REPRESENTATIVE` expliciet uit;
- de representatieve roltemplate kent geen SalesDay-menupermissions toe;
- `canAccessPST` hergebruikt deze SalesDay-regel;
- de generieke placeholderroute controleert alleen authenticatie en geen SalesDay-domeinrecht.

Het resultaat is tegelijk te restrictief en te ruim: een vertegenwoordiger ziet zijn bedoelde SalesDay niet, terwijl een rechtstreeks geopende placeholder-URL niet via een SalesDay-specifieke serverguard wordt afgedwongen. Dit moet vóór echte data-exposure worden opgelost.

## 6. Volledige functionele inventaris van SalesApp

Statuslegenda:

- **UI-prototype:** zichtbaar en interactief, maar uitsluitend lokale/mockstate;
- **gedeeltelijk:** enkele regels of persistentie bestaan, maar geen veilige end-to-end flow;
- **referentie:** ontwerp-/typecode zonder betrouwbare actieve flow;
- **niet aanwezig:** ontbrekende productiecapaciteit.

| Domein / functie | Huidige implementatie | Status | Belangrijkste tekortkoming |
|---|---|---|---|
| Login en sessie | `LoginPanel` met lokale gebruiker/rol | UI-prototype | Geen echte authenticatie of sessie |
| App-shell en navigatie | Eigen sidebar en view-state | UI-prototype | Dupliceert FieldForce-shell; geen routeguards |
| Dashboard | Tegels voor voorbereiding, agenda, stock, bevoorrading, verbruik, kas en sync | UI-prototype | KPI's deels hardcoded; acties lokaal |
| Mijn info | Profiel, team, taal, dagsales, kas en sync | UI-prototype | Wijzigingsverzoek wordt niet verzonden |
| Mijn voorbereiding — lijst | Volgende werkdag, route, afspraken en voorbereidingsstatus | UI-prototype | Alleen weekendlogica; geen bron- of scopecontrole |
| Voorbereidingsdetail — contact | Klant- en contactoverzicht | UI-prototype | Mockdata; geen centrale relatie |
| Voorbereidingsdetail — locaties/dragers | Status, vervaldatum, opportuniteit en detail | UI-prototype | Geen canoniek model of servermutatie |
| Voorbereidingsdetail — offertes | Documentlijst en previewmodal | UI-prototype | Mock-URL's; geen private bestandsautorisatie |
| Voorbereidingsdetail — opmerkingen | Belangrijke voorbereidingsnotities | UI-prototype | Alleen lokale state |
| Voorbereidingsdetail — verkoophistoriek | Document- en artikelanalyse | UI-prototype | Statische historie; geen ERP-adapter |
| Voorbereidingsdetail — documenten | PDF-/beeldpreview | UI-prototype | Geen veilige opslag/downloadroute |
| Automatische artikelvoorbereiding | Zoek/filter, aankoopfrequentie en vervalinschatting | referentie | Berekeningsregels niet als servercontract vastgelegd |
| Voorbereidingsbeheer | Extra artikelen per land/team/gebruiker | UI-prototype | Client-side beheer en timestamps |
| Agenda | Groepen huidig/afgesloten/geen tijd; statusacties | UI-prototype | Geen serverstatus, lifecycle of timezonebeleid |
| Afspraak dupliceren | Formulier en lokale kopie | UI-prototype | Geen idempotentie, conflict- of scopecontrole |
| Afspraakdetail — bezoekverslag | Formulier en lokaal opslaan | UI-prototype | Geen duurzaam verslag of audit |
| Afspraakdetail — klantenfiche | Identiteit, contacten, adressen, boekhouding, commercieel | UI-prototype | Dupliceert toekomstig centrale relatie; Peppolcheck gesimuleerd |
| Afspraakdetail — locaties/dragers | CRUD-achtige interacties | UI-prototype | Referentiële controles gebruiken mockdocumenten |
| Afspraakdetail — offertes/historiek/documenten | Tabellen, filters en previews | UI-prototype | Geen bronintegratie of file-ACL |
| Afspraakdetail — referenties | Lokale referentielijst | UI-prototype | Geen model of serverrechten |
| Afspraakdetail — leads | Lokale leadregistratie | UI-prototype | Geen workflow, toewijzing of notificatie |
| Afspraakdetail — opvolging | Lokale opvolgactie | UI-prototype | Geen planning-/taakrelatie |
| Afspraak afsluiten/status wijzigen | Lokale status en timestamp | UI-prototype | Geen lifecyclelock, audit of concurrentiecontrole |
| Sales wizard — productverkoop | Artikelkeuze, aantallen en lokale stockaftrek | UI-prototype | Geen transactie, prijsbron, order of audit |
| Sales wizard — contract | Plaatsaanduiding/“logic inactive” | niet aanwezig | FieldForce Contract is de aangewezen eigenaar |
| Sales wizard — combinatie | Product + contractconcept | referentie | Geen zakelijke of technische flow |
| Mijn team | Dag/land/teamfilters, vertegenwoordigerdetails | UI-prototype | Leiderfilter is landbreed in plaats van teamgebonden |
| Mijn voorraad | Zoeken, filteren, detail en overdrachtaanvraag | UI-prototype | Geen centrale voorraad of movement ledger |
| Bevoorrading ontvangen | Volledig/deels, foto, handtekening, ontvangstbewijs | gedeeltelijk | Alleen lokale idempotentiesimulatie; geen DB-transactie |
| Verbruiksgoederen | Mijn stock, magazijn, catalogus, aanvraag/goedkeuring/verzending/ontvangst | UI-prototype | Alle rollen en statusmutaties client-side |
| Voorraadhistoriek | Bewegingenoverzicht | UI-prototype | Statische historie |
| Kasblad | Storting en overzicht | UI-prototype | Geen kasboek, serverberekening of afsluitcontrole |
| Kasblokkering | Vertegenwoordiger blokkeren/vrijgeven bij openstaande kas | UI-prototype | Alleen lokale state; autorisatie op rolstring |
| Rapporten | Omzet/KPI-tabellen en grafieken | UI-prototype | Vaste voorbeeldperiode en mockwaarden |
| Sync | Pending/conflictenteller en knop | UI-prototype | Geen queue, opslag, retry of conflictresolutie |
| PST dashboard | Project-/trackingoverzicht | UI-prototype | Mockadapters; geen FieldForce-scope |
| PST segmenten en prospecten | Segmentdetails, prospects, statussen | UI-prototype | Geen persistente workflow |
| PST routes en optimalisatie | Routeweergave en optimalisatie-UI | UI-prototype | Geen route-engine of serveropslag |
| PST kaart en bezoeken | Interactieve kaart, markers, bezoekacties | UI-prototype | Client-only; externe tegels en geen offlinecachebeleid |
| PST goedkeuringen | Lijst en beperkte knopstatus | gedeeltelijk | Goedkeuractie ontbreekt |
| PST vertegenwoordigers/planning/kwaliteit | Overzichten en filters | UI-prototype | Mockdata en onvolledige rechten |
| PST project/hostess/export/audit-types | Domeintypes voor bredere procesketen | referentie | Niet als volledige actieve UI/API aanwezig |
| Service Mijn Dag | Route, Leafletkaart en werkorderdetail | UI-prototype | Mockroute; geen offline kaart-/opslagbeleid |
| Service planning/interventies | Planning, detail en lokale bewerkingen | UI-prototype | Geen serverstatus of dispatchconcurrentie |
| Service werkorders | Materiaal, ondertekening en sluiten | UI-prototype | Geen voorraadtransactie of duurzaam document |
| Service assets/onderhoud/contracten | Overzichten en enkele lokale acties | gedeeltelijk | Diverse editknoppen zijn placeholders |
| Gebruikersbeheer | CRUD, foto's, rollen en rechten | UI-prototype | Dupliceert bestaand FieldForce-beheer |
| Technische tabellen | Read-only technische data | UI-prototype | Dupliceert/schaduwt centraal beheer |
| Design uploads | Object-URL-preview | UI-prototype | Geen opslag, validatie of lifecycle |
| Contract admin/calculator | Versies, upload en simulatie uit mockdata | UI-prototype | Dupliceert bestaande FieldForce Contract-implementatie |
| Stock-subapp — materialen | Materiaal CRUD, status en details in Supabase | functioneel maar apart | Assetmodel is niet gelijk aan SalesDay-artikelstock |
| Stock-subapp — personen | Persoonsuitrusting en offboarding-PDF | functioneel maar apart | Hoort eerder bij Service/Beheer dan SalesDay |
| Stock-subapp — uitgifte/teruggave | Status plus movement insert | gedeeltelijk | Geen gegarandeerde één-transactieboeking |
| Stock-subapp — ontvangst/rapporten/beheer | Routes, CSV en referentiebeheer | functioneel maar apart | Andere stack, database en rechtenbron |

Productiecapaciteiten die in SalesApp volledig ontbreken zijn onder meer: echte auth, effectieve server-scope, databasepersistentie, transacties, schema-migraties, API-contracten, servervalidatie, idempotency keys, outbox/retry, private file ACL's, auditgaranties, monitoring en geautomatiseerde regressietests.

## 7. Mapping naar SalesDay, PST, Contract, Service en Beheer

| SalesApp-capaciteit | Doelmodule | Beslissing | Reden |
|---|---|---|---|
| Dashboard, Mijn info-samenvatting | SalesDay / gedeelde profielroute | **HERBOUWEN** | Data en rechten moeten uit FieldForce komen |
| Mijn voorbereiding, voorbereidingdetail | SalesDay | **HERBOUWEN; UI-PATROON HERGEBRUIKEN** | Kern van SalesDay, maar huidige implementatie is mock/client-only |
| Agenda en afspraakdetail | SalesDay | **HERBOUWEN** | Vereist serverlifecycle, scope en centrale relaties |
| Bezoekverslag, leads, opvolging, referenties | SalesDay → ERP | **HERBOUWEN IN EERSTE PRODUCTIEBELofte** | FieldForce legt vast; ERP beheert latere externe status |
| Productverkoop | SalesDay + centrale order/artikelservices | **HERBOUWEN IN EERSTE PRODUCTIEBELofte** | Order, Order-Reeds-Geleverd en Factuur, offline en idempotent |
| Mijn team | SalesDay, met gedeelde scopehelpers | **HERBOUWEN** | Visueel bruikbaar; huidige landbrede leiderscope is fout |
| Artikelstock en bevoorrading | Gedeelde Inventory-domain | **HERBOUWEN IN EERSTE PRODUCTIEBELofte** | ERP centraal/transit; FieldForce vertegenwoordiger/voertuig tot ERP-ack |
| Verbruiksgoederen | Gedeelde Inventory → ERP | **HERBOUWEN IN EERSTE PRODUCTIEBELofte** | FieldForce dient definitieve aanvraag in; ERP keurt/verwerkt |
| Kasblad en blokkering | SalesDay + ERP-confirmatie | **HERBOUWEN IN EERSTE PRODUCTIEBELofte** | Eerste werkdag vereist bevestigd saldo nul |
| Rapporten | Reporting | **HERBOUWEN BOVEN CANONIEKE DATA** | Geen lokale KPI-formules als tweede waarheid |
| Sync | Platform | **HERBOUWEN ALS EERSTE FUNDAMENT** | Volledige offline werkdag, duurzame commands en dag −1-blokkering |
| PST views en types | PST | **VERPLAATSEN/HERBOUWEN IN PST** | Eigen lifecycle, rechten en route-engine |
| Contractcalculator/-admin | Contract | **VERWIJDEREN UIT MIGRATIESCOPE** | FieldForce Contract is reeds de eigenaar |
| Contractstart vanuit afspraak | SalesDay → Contract | **INTEGREREN VIA CONTEXTLINK** | Eén calculator en één documentflow |
| Service Mijn Dag/planning/werkorders/assets | Service | **VERPLAATSEN/HERBOUWEN IN SERVICE** | Geen SalesDay-verantwoordelijkheid |
| Gebruikers- en rollenbeheer | Beheer | **NIET KOPIËREN** | FieldForce heeft centrale gebruikers/rechten |
| Technische tabellen/design | Beheer | **BESTAAND FIELDForce HERGEBRUIKEN / NIET KOPIËREN** | Alleen expliciet ontbrekende referentiedata in centraal Beheer toevoegen |
| Geneste materiaalapp | Service/Inventory/Beheer | **PROCESREFERENTIE** | Asset tracking is niet hetzelfde als verkoopvoorraad |

## 8. Overlap en duplicaten

### 8.1 Directe duplicaten die niet mogen worden overgenomen

- SalesApp-login, user switcher, app-shell, sidebar en rolstrings versus FieldForce-auth, app-shell en effectieve rechten;
- SalesApp-gebruikersbeheer versus bestaande FieldForce-gebruikers-, team-, rol- en overridefunctionaliteit;
- SalesApp-Contract admin/calculator versus de lokale FieldForce `Contract*`-modellen, routes, import, berekening en documenten;
- SalesApp-i18nhelper en locales versus de FieldForce-vertalingslaag;
- SalesApp-syncscherm versus een nog te bouwen gedeelde platformqueue;
- SalesApp mockklanten en ContractCustomer versus één toekomstige centrale business relation;
- SalesApp product/stocktypes, FieldForce `Product` en `ContractArticle` versus één expliciet artikelmastermodel;
- SalesApp audittypes en stockhistoriek versus FieldForce `AuditLog` plus toekomstige domeinledgers.

### 8.2 Bruikbare overlap

- tabletvriendelijke voorbereidings- en agendakaarten;
- groepering van afspraken in actief, afgesloten en zonder tijd;
- presentatie van contact, locatie, verkoophistoriek en documenten;
- gedeelde datum-/routehelpers na herschrijven en testen;
- gedeeltelijke ontvangst als functioneel procesvoorbeeld;
- offline-indicatoren als UX-concept;
- PST- en Service-schermen als input voor hun eigen moduledocumentatie.

### 8.3 Gevaarlijke schijnbare overlap

`Product` in FieldForce is momenteel een compact Coaching-concept, terwijl `ContractArticle` een verkoopartikel met prijs, kost, eenheid, btw, meertalige omschrijving en externe bron is. Deze tabellen mogen niet ondoordacht worden samengevoegd. Eerst moet worden vastgesteld of Coaching “product” een productfamilie, gespreksonderwerp of werkelijk SKU-artikel betekent.

Ook `ContractCustomer` is op dit moment contractgericht. Een tweede `SalesDayCustomer` zou duplicaten en uiteenlopende adressen/externe ID's creëren. De juiste richting is een gecontroleerde generalisatie naar een gedeelde `BusinessRelation`, met behoud van Contract-compatibiliteit.

## 9. Mapping van datamodellen

| SalesApp-concept | Bestaand FieldForce-concept | Voorgestelde behandeling |
|---|---|---|
| User, role, country, team | `User`, `Role`, `UserCountryAccess`, `Team`, permissiontabellen | Volledig hergebruiken; SalesApp-types verwijderen uit integratie |
| SalesApp permissions | `Permission`, `RolePermission`, `UserPermission` | Nieuwe SalesDay-keys toevoegen, geen rolstringchecks |
| Customer / Prospect | `ContractCustomer` bestaat lokaal | Generaliseren naar `BusinessRelation`; type `CUSTOMER`/`PROSPECT` of lifecycle |
| Contact | Niet als gedeeld relationeel model | `BusinessContact` onder centrale relatie |
| Address | Niet als gedeeld relationeel model | `BusinessAddress` met type, geldigheid en extern ID |
| ExternalReference | Diverse losse externe velden | `BusinessRelationExternalReference`, uniek per systeem/type/id |
| Appointment | Geen productie-SalesDay-model | Nieuw `SalesAppointment` met eigenaar, team, land, relatie, lifecycle en externe sleutel |
| Appointment status history | `AuditLog` is generiek | Nieuw `SalesAppointmentStatusEvent`; audit aanvullend, niet vervangend |
| Preparation notes | Geen SalesDay-model | Nieuw `SalesPreparationNote` in de afspraak-/dagmijlpaal |
| Visit report | Coaching reports zijn ander domein | Nieuw `SalesVisitReport` plus versie/status; geen Coaching-tabel hergebruiken |
| Lead | Geen gedeeld leadmodel | Nieuw `SalesLead` met eigenaar, relatie, bronafspraak en status |
| Follow-up | Geen generiek taakmodel | Nieuw `SalesFollowUp`; later koppeling met planning/notificaties |
| Reference | Geen SalesDay-reference | Nieuw `SalesReference` of expliciet als relationele referentie na businessbeslissing |
| Location / sublocation / carrier | Geen centraal model | Alleen toevoegen indien dit fysieke klantobjecten zijn; hiërarchisch relationeel modelleren |
| Product catalog | `Product` en lokaal `ContractArticle` | Canonieke artikelbeslissing; waarschijnlijk `Article` vanuit `ContractArticle` generaliseren |
| Prices/cost/VAT/unit | `ContractArticle` bevat reeds veel velden | Land-/valuta-/geldigheidsafhankelijke prijsregels apart modelleren |
| Sales documents/history | Geen SalesDay-tabellen | Volledige ERP-replica/cache volgens scope en freshness; ERP blijft master |
| Sales order | Geen generiek ordermodel | Pending command + immutable snapshot voor Order, Order-Reeds-Geleverd en Factuur |
| Contract calculation | Lokale `ContractCalculation` en lijnen | Hergebruiken; optionele koppeling naar relatie en afspraak |
| Contract document | `ContractGeneratedDocument` | Hergebruiken; private download en audit behouden |
| Stock item/balance | Geen verkoopstockmodel | Shared Inventory-location, immutable movement en ERP balance-replica in eerste release |
| Stock movement | `AuditLog` is onvoldoende | Nieuw immutable `StockMovement`; unieke mutation-/source-key |
| Replenishment/receipt | Geen SalesDay-model | Transit, ontvangst, lijnen, afwijking en verplicht bewijs in eerste release |
| Consumables request | Geen model | Aparte Inventory-domain; niet mengen met artikelverkoop zonder besluit |
| Cash sheet/deposit | Geen model | ERP cashreplica, stortingsbevestiging en eerste-werkdagblokkering in eerste release |
| Sync queue/conflict | Alleen browserdrafthelper | Platformmodellen of betrouwbare externe queue, niet domeinspecifiek kopiëren |
| Files/signatures | Contract-storagepatroon bestaat | Metadata in DB, bytes privé in storage; nooit data-URL als bron van waarheid |
| Audit | `AuditLog` en domeinhistories | Hergebruiken, maar kritieke ledgers transactioneel vastleggen |
| Module activation | `AppModule` is Coaching-georiënteerd; menupermissions bestaan | Featureflag plus SalesDay-modulecode expliciet ontwerpen |

Belangrijke modelregel: een ERP-kopie is niet automatisch de bron van waarheid. Elk lokaal model krijgt één van drie rollen: **canonical**, **read cache** of **command/outbox**. Die rol moet in schema en moduledocumentatie worden vastgelegd.

## 10. Voorgestelde Prisma-modellen

Dit is een doelontwerp, geen voorstel om alle modellen in één migratie toe te voegen.

### 10.1 Gedeelde relationele kern

`BusinessRelation`

- `id`, `type`, `status`, `displayName`, `legalName`, `vatNumber`, `language`, `countryId`;
- `ownerId`, `teamId` voor FieldForce-scope;
- `active`, `createdAt`, `updatedAt`;
- migratiepad vanuit `ContractCustomer`, niet ernaast.

`BusinessRelationExternalReference`

- `relationId`, `system` (`NAV140`, `BUSINESS_CENTRAL`, `ODOO`, ...), `entityType`, `externalId`;
- unieke index op `(system, entityType, externalId)`;
- geen verspreide vrije `externalCustomerId`-velden meer.

`BusinessContact` en `BusinessAddress`

- onder `BusinessRelation` met type, primaire vlag, geldigheid, bron en externe referentie;
- soft-deactivation in plaats van destructief verwijderen wanneer historie ernaar verwijst.

### 10.2 SalesDay-kern

`SalesAppointment`

- `id`, `externalSystem`, `externalId`, `relationId`, `representativeId`, `teamId`, `countryId`;
- `startsAt`, `endsAt`, `timeZone`, `status`, `statusChangedAt`, `sourceVersion`;
- `createdAt`, `updatedAt`, optionele optimistic-lock `version`;
- unieke externe sleutel en indices op vertegenwoordiger/datum, team/datum, land/datum;
- statusenum pas definitief maken na normalisatie van `planned`, `completed`, `no_time`, `cancelled`, `customer_absent` en `rescheduled`.

`SalesAppointmentStatusEvent`

- immutable event met `fromStatus`, `toStatus`, actor, reden, timestamp en idempotency key;
- in dezelfde transactie als de actuele status.

De eerste productiebelofte vereist `SalesPreparationNote`, `SalesVisitReport`, `SalesLeadReplica`, `SalesFollowUpReplica`, `SalesReferenceReplica`, dagafsluiting en klantlocatie-/dragerobjecten. Ze worden niet tegelijk toegevoegd, maar in de intern afgeschermde mijlpalen waarin ze werkelijk gebruikt en getest worden.

### 10.3 Artikelkern

Voorkeursrichting: generaliseer lokaal `ContractArticle` naar `Article` en laat Contract hiernaar verwijzen.

- `Article`: nummer, stamnummer, meertalige omschrijvingen, basisunit, actief, bronmetadata;
- `ArticleExternalReference`: externe sleutels per bronsysteem;
- `ArticleCountryConfiguration`: land, verkoopbaarheid, btw, eventueel standaardunit;
- `ArticlePrice`: land, valuta, prijstype, bedrag, geldig-van/tot, bronversie;
- `ArticleCost`: alleen indien Contract-calculatie deze lokaal moet cachen en autorisatie dit toelaat.

Het bestaande `Product` blijft onaangeroerd tot beslist is of het een Coaching-productfamilie of een echte SKU representeert.

### 10.4 Voorraad en kas — latere fasen

- `StockLocation`: magazijn, voertuig, vertegenwoordiger of klantlocatie;
- `StockMovement`: immutable, artikel, hoeveelheid, unit, van/naar, reden, bron, actor, business timestamp, server timestamp en unieke idempotency key;
- `StockBalance`: optionele transactioneel bijgewerkte projectie met versieveld; nooit zonder ledger;
- `StockTransfer`, `StockTransferLine`, `StockReceipt`, `StockReceiptLine`, `StockEvidence`;
- `CashSheet`, `CashEntry`, `CashDeposit`, `CashCloseEvent` met valuta en immutable boekingen.

Hoeveelheden en bedragen gebruiken Prisma `Decimal` met expliciete schaal; geld wordt niet met JavaScript floating point berekend.

### 10.5 Integratie en betrouwbaarheid

- `ExternalSyncCursor` voor incrementele bronlezing;
- `IntegrationRun` met start/einde/status/aantallen/foutreferentie;
- `IntegrationOutbox` voor betrouwbare uitgaande commands;
- `IdempotencyRecord` alleen als unieke sleutels niet logisch op domeinrecords kunnen staan.

Kritieke mutatie, ledgerrecord en outboxevent moeten in één Prisma-transactie worden geschreven. De huidige fail-soft `writeAuditLog` blijft nuttig voor observatie, maar mag niet de enige registratie van stock of kas zijn.

## 11. Rechten- en scopematrix

Voorgestelde permission keys:

- `menu.salesday.enabled`;
- `menu.salesday.dashboard`, `menu.salesday.preparation`, `menu.salesday.agenda`, `menu.salesday.team`, `menu.salesday.stock`;
- actiekeys `salesday.appointments.read`, `salesday.appointments.write`, `salesday.visitReports.write`, `salesday.sales.write`, `salesday.stock.read`, `salesday.stock.receive`, `salesday.cash.write`, `salesday.manage`.

Menupermission en actiepermission zijn bewust gescheiden. Een zichtbare route verleent geen mutatierecht.

| Actor | Eigen afspraken/voorbereiding | Team | Land | Operationele mutaties | Beheer |
|---|---|---|---|---|---|
| Representative | Ja | Nee | Nee | Volledig voor eigen dag en toegestane klant/stock | Nee |
| Sales Leader / Verkoopleider | Scoped team lezen | Alleen eigen effectieve team(s) | Nee | Geen; management read-only | Nee |
| Sales Manager | Scoped management lezen | Teams binnen toegewezen scope | Toegewezen land(en) | Geen; management read-only | Alleen expliciet recht |
| Country Manager | Scoped management lezen | Teams binnen toegewezen land(en) | Toegewezen land(en) | Geen; management read-only | Alleen expliciet recht |
| Group Manager | Scoped management lezen | Toegewezen groepsscope | Toegewezen landen | Geen; management read-only | Alleen expliciet recht |
| Admin | Volgens effectieve land-/teamscope | Volgens effectieve scope | Toegewezen land(en) | Geen handelingen namens Representative | Ja met aparte permission |
| Super Admin | Alle lezen | Alle | Alle | Geen handelingen namens Representative | Ja met aparte permission |

Serverregels:

1. elke page loader en API gebruikt een SalesDay-accesshelper;
2. queries bevatten de effectieve scope; records worden niet eerst breed geladen en daarna client-side gefilterd;
3. een `representativeId`, `teamId` of `countryId` uit queryparameters kan scope alleen vernauwen;
4. directe URL-toegang wordt met dezelfde regels als navigatie afgedwongen;
5. de huidige rolgebaseerde `canAccessSalesday` wordt niet als eindoplossing behouden;
6. `canAccessPST` wordt losgekoppeld van SalesDay, omdat PST een eigen module en permissionmatrix heeft;
7. lifecyclelocks worden later in de serverservice afgedwongen, niet alleen door disabled knoppen.

## 12. Routeplan

### 12.1 SalesDay-routes

| Route | Doel | Fase |
|---|---|---|
| `/salesday` | Dashboard en entrypoint | 1 |
| `/salesday/mijn-voorbereiding` | Voorbereidingslijst | 1 |
| `/salesday/mijn-voorbereiding/[appointmentId]` | Voorbereidingdetail en voorbereidingsstatus/notities | Eerste productie |
| `/salesday/mijn-agenda` | Agenda, afspraakuitvoering en verplichte dagafsluiting | Eerste productie |
| `/salesday/afspraken/[appointmentId]` | Volledig afspraakdetail binnen eigen dag/scope | Eerste productie |
| `/salesday/mijn-team` | Read-only teamoverzicht bij teamscope | Eerste productie |
| `/salesday/verkoop/*` | Order, Order-Reeds-Geleverd en Factuur | Eerste productie |
| `/inventory/mijn-voorraad` | Voorraadoverzicht | Eerste productie |
| `/inventory/bevoorrading` | Transit en ontvangst | Eerste productie |
| `/inventory/verbruiksgoederen` | Definitieve ERP-order-aanvraag | Eerste productie |
| `/salesday/kas` | Kasblad en blokkeerstatus | Eerste productie |
| `/reporting` | Power BI-link en later eventuele embedding | Lage prioriteit |
| `/beheer/salesday/*` | Redenen en parameters | Eerste productie, expliciet beheerrecht |

De huidige catch-all placeholders worden voor geïmplementeerde routes vervangen door echte routebestanden. Niet-geïmplementeerde links blijven disabled of expliciet “nog niet beschikbaar”; zij mogen niet naar een generieke, alleen-authenticated placeholder met toekomstige data wijzen.

### 12.2 Modulair eigenaarschap

- `/contract/*` blijft eigenaar van calculator, klantbrief en contractdocument;
- `/pst/*` krijgt later eigen routeguards en modulecode;
- `/service/*` blijft buiten SalesDay;
- `/beheer/*` blijft eigenaar van gebruikers, rollen, technische referenties en moduleconfiguratie;
- een SalesDay-afspraak kan naar Contract navigeren met een server-gevalideerde context, maar rendert geen tweede calculator.

## 13. API- en server-actionplan

FieldForce gebruikt al route handlers en serverhelpers. Voor SalesDay wordt dezelfde stijl aanbevolen; browsercomponenten praten niet rechtstreeks met Prisma of externe ERP's.

### 13.1 Basislees-API's

| Endpoint | Uitvoer | Scope |
|---|---|---|
| `GET /api/salesday/dashboard?date=` | Dagtotalen, waarschuwingen en navigatietellers | Effectieve gebruikersscope |
| `GET /api/salesday/preparations?date=&representativeId=` | Afspraken met voorbereidingsstatus | Eigen/team/land, server-side |
| `GET /api/salesday/preparations/[appointmentId]` | Relatie, contact, locaties, historie, documentenmetadata | Recordscope + bronautorisatie |
| `GET /api/salesday/appointments?from=&to=&status=&representativeId=` | Agendaresultaat | Effectieve scope |
| `GET /api/salesday/appointments/[appointmentId]` | Read-only afspraakdetail | Recordscope |
| `GET /api/salesday/team?date=&teamId=` | Teamdagoverzicht | Alleen effectieve teamscope |

Elke endpoint gebruikt Zod- of bestaande requestvalidatie, `handleApi`, request-ID, een compacte response-DTO en vaste paginering/limieten. Externe bronfouten worden vertaald naar een stabiel FieldForce-foutcontract zonder credentials of ruwe payloads te lekken.

### 13.2 Serverlagen

```text
route handler
  → requireSalesDayAccess(permission)
  → resolveEffectiveSalesDayScope(user)
  → SalesDay service (business/lifecycle policy)
  → repository of external adapter
  → mapper naar stabiele SalesDay DTO
```

De UI importeert geen SalesApp-mocktypes. DTO's zijn smal, versieerbaar en onderscheiden `null`, onbekend, niet beschikbaar en niet toegestaan.

### 13.3 Mutatie-API's in de eerste productiebelofte

`POST`/`PATCH`-routes voor klant, afspraak, dagafsluiting, bezoekverslag, lead, opvolging, referentie, verkoop, ontvangst, dragerstock en kas eisen:

- specifieke actiepermission;
- server-side scope en lifecyclecheck;
- `Idempotency-Key` of unieke client mutation ID;
- database-transactie;
- expliciet concurrencybeleid;
- domeinevent/ledger en audit;
- gevalideerde bestandstokens in plaats van vrije paden of data-URL's;
- retrygedrag dat geen dubbele verkoop, stockbeweging of kasboeking kan maken.

Server actions bieden hier geen veiligheidsvoordeel boven de bestaande API-conventie en zouden een tweede patroon introduceren. Gebruik ze alleen als FieldForce daar later platformbreed voor kiest.

## 14. Centrale artikelstructuur

### 14.1 Huidige toestand

Er zijn drie verschillende begrippen die nu gemakkelijk met elkaar verward worden:

1. SalesApp `Product`/catalogusitems voor verkoop en stock;
2. FieldForce `Product`, momenteel een klein Coaching-model met naam, sortering en actief-vlag;
3. lokaal FieldForce `ContractArticle`, met artikelnummer, stamnummer, NL/FR/DE-omschrijvingen, prijs, kost, unit, btw, externe bron en syncmetadata.

Een extra SalesDay-artikeltabel zou prijs-, omschrijvings- en activatiestatus laten divergeren. De meest logische basis is daarom `ContractArticle` te generaliseren tot een gedeeld `Article`-model. Dat gebeurt alleen met een gecontroleerde migratie en compatibiliteitslaag voor de lokale Contract-code.

### 14.2 Doelstructuur

```text
Article
 ├─ ArticleExternalReference (NAV/BC/Odoo/...)
 ├─ ArticleCountryConfiguration (actief, verkoopbaar, btw, unit)
 ├─ ArticlePrice (land, valuta, type, geldigheidsperiode)
 ├─ ArticleCost (beperkt zichtbaar, geldigheidsperiode)
 ├─ ContractCalculationLine snapshot
 ├─ SalesOrderLine snapshot
 └─ StockMovement
```

De transactielijnen bewaren snapshots van nummer, omschrijving, unit, prijs, btw en eventueel kost. Zo blijft een historische berekening of bestelling reproduceerbaar wanneer het masterartikel later wijzigt.

### 14.3 Import en broneigenaarschap

- de artikelbron is expliciet één ERP/masterdata-interface;
- import is idempotent op externe sleutel, niet op omschrijving;
- de import deactiveert ontbrekende artikelen alleen volgens een afgesproken volledige/incrementele bronsemantiek;
- importresultaten worden geregistreerd in `IntegrationRun` met aantallen en foutreferenties;
- handmatige FieldForce-overrides zijn aparte velden met eigenaar en geldigheid, geen stille overschrijving van brondata;
- prijs- en kostzichtbaarheid krijgen aparte rechten;
- Contract en SalesDay lezen dezelfde artikelservice, maar krijgen verschillende DTO's.

### 14.4 Besluitpunt rond `Product`

Vóór hernoemen of koppelen moet worden vastgesteld wat Coaching `Product` functioneel betekent. Indien dit een gespreksonderwerp/productfamilie is, wordt het concept expliciet zo benoemd en eventueel aan meerdere ERP-artikelrecords gekoppeld. Indien het werkelijk een SKU is, kan het gecontroleerd in de artikelreplica opgaan. Deze beslissing is een schema-/migratiepoort voor verkoop en Inventory.

## 15. Integratie met Contract

FieldForce Contract is de enige eigenaar van:

- artikelimport voor contractcalculatie zolang de centrale artikelmigratie niet klaar is;
- contractmodellen en voorwaarden;
- berekening, afronding en validatie;
- calculatielijnen en snapshots;
- klantbriefsjablonen;
- PDF-generatie, opslag en download;
- ondertekenings- en documentstatussen;
- Contract-rapportering en beheerrechten.

SalesDay biedt uitsluitend een ingang vanuit een afspraak of relatie:

1. gebruiker kiest “Contract opstellen” in een SalesDay-afspraak;
2. server controleert SalesDay-recordscope én `contract.open`;
3. FieldForce navigeert naar `/contract/new` met een korte, server-resolved contexttoken;
4. Contract haalt relatie, land, vertegenwoordiger en optioneel afspraak-ID server-side op;
5. Contract berekent en bewaart met zijn eigen services;
6. de afspraak toont daarna alleen geautoriseerde contractstatus/links.

Geen klantnaam, prijs of rechtencontext mag als vertrouwde vrije queryparameter worden doorgegeven. Een contexttoken of databasekoppeling verwijst naar interne IDs; de doelroute valideert opnieuw.

Voorgestelde evolutie:

- `ContractCustomer` gecontroleerd migreren naar `BusinessRelation` of een tijdelijke één-op-één-relatie gebruiken;
- `ContractCalculation` koppelen aan `businessRelationId` en optioneel `salesAppointmentId`;
- bij artikelgeneralisatie `ContractCalculationLine` snapshots behouden;
- SalesDay toont geen bewerkbare kopie van contractgegevens;
- ondertekening blijft private Contract-data; alleen status en geautoriseerde documentlink komen terug.

De lokale Contract-tests zijn regressiepoorten voor elke centrale relatie- of artikelwijziging.

## 16. Voorraad- en kasarchitectuur

### 16.1 Voorraad

De juiste kern is een immutable movement ledger. Een “voorraad = getal op gebruiker” is onvoldoende voor overdracht, retour, gedeeltelijke ontvangst, correctie, verkoop en offline retry.

Voorbeeld gedeeltelijke ontvangst:

```text
één Prisma-transactie
  1. lock/versiecontrole transfer en open lijnen
  2. maak StockReceipt met unieke mutation key
  3. maak StockReceiptLine(s)
  4. maak movement(s): transit → voertuig/vertegenwoordiger
  5. update afgeleide balance/projectie
  6. update ontvangen/resthoeveelheid en transferstatus
  7. schrijf domeinevent/outbox en kritieke auditdata
```

Een herhaalde request met dezelfde sleutel retourneert hetzelfde resultaat. Een request met dezelfde sleutel maar andere payload wordt geweigerd. Negatieve stock is standaard verboden, tenzij een expliciete correctiepermission en reden bestaat.

Nog te scheiden voorraadsoorten:

- verkoopbare artikelen bij vertegenwoordiger/voertuig;
- centraal of landmagazijn;
- verbruiksgoederen;
- herbruikbare assets/materialen uit de geneste stockapp;
- klantlocatie-/dragerstock.

Ze kunnen één ledger-engine delen, maar krijgen niet automatisch dezelfde lifecycle, ownership of permissions.

### 16.2 Verkoop en stock

Een verkooprequest bevat geen door de client vertrouwde prijs of saldo. De server:

- laadt artikel, actieve prijs, unit en btw;
- controleert afspraak, relatie en vertegenwoordigerscope;
- valideert hoeveelheid en afronding;
- maakt order/levering en stockmovement transactioneel of stuurt een idempotent ERP-command;
- bewaart snapshots;
- registreert externe synchronisatiestatus zonder de verkoop dubbel uit te voeren.

Welke partij het ordernummer uitgeeft — FieldForce of ERP — is een open architectuurbesluit.

### 16.3 Kas

Kas is een financieel ledger, geen muteerbaar totaal. Minimaal nodig:

- blad per gebruiker, valuta en boekingsperiode;
- immutable entries met bronverkoop/betaling/storting/correctie;
- serverberekend openstaand bedrag;
- sluiting met actor en timestamp;
- storting met bewijs en functiescheiding;
- blokkering als afgeleide serverpolicy, niet als clientboolean;
- correcties als tegenboeking, niet door oude entries te overschrijven.

De precieze drempel, wie mag deblokkeren en welk bewijs vereist is, moeten Finance/Operations vastleggen voordat fase 5 start.

## 17. Offline- en syncarchitectuur

SalesApp simuleert offlinegedrag met tellers en lokale React-state. Dat is niet voldoende voor productie. De doelgroep werkt wel in omstandigheden met wisselende connectiviteit; offline moet daarom bewust per use case worden ontworpen.

### 17.1 Eerste productiebelofte

- volledige offline mutaties voor één volledige werkdag;
- PWA op persoonlijk, via MDM beheerd Android-toestel;
- versleutelde scoped dataset met volledige vereiste historie;
- afspraakgebonden zichtbaarheid, ook wanneer data technisch lokaal aanwezig is;
- verplichte online sessievernieuwing en sync vóór de volgende werkdag;
- doorlopende versleutelde autosave van concepten;
- biometrie/PIN na toestelvergrendeling of slaapstand;
- duurzame idempotente queue, retry, dependency ordering en zichtbare syncstatus;
- dag −1-commands blokkeren de volgende dag, behalve bij centraal geaudite noodmodus.

### 17.2 Offline writes en queue

Een toekomstig platformmechanisme gebruikt IndexedDB of een gelijkwaardige duurzame clientstore, niet `localStorage` voor payloads. Elk queue-item bevat:

- stabiele client mutation ID;
- aangemaakte tijd en user/sessionbinding;
- endpoint/commandtype en gevalideerde payloadversie;
- afhankelijke object-/temp-ID's;
- status `PENDING`, `SENDING`, `ACKNOWLEDGED`, `FAILED` of `CONFLICT`;
- retrycount, laatste foutcategorie en serverresultaat.

De server blijft de autoriteit. Bij sync controleert hij opnieuw rechten, scope en lifecycle. Een verlopen recht maakt een offline actie niet alsnog geldig.

### 17.3 Conflictbeleid

- additive ledgers gebruiken idempotente append, geen last-write-wins;
- afspraakvelden gebruiken versie/ETag en tonen een expliciet conflict;
- serverstatussen zoals gesloten, geannuleerd of reeds ontvangen blokkeren incompatibele lokale acties;
- files uploaden via resumable/tokenized proces en koppelen pas na succesvolle hash/scan;
- queue-items worden niet stil verwijderd; gebruiker ziet herstelpad;
- uitloggen verwijdert of versleutelt usergebonden lokale data volgens privacybeleid.

## 18. Internationalisering

FieldForce ondersteunt Nederlands, Frans en Duits. Alle nieuwe SalesDay-teksten moeten in de bestaande locale-bestanden terechtkomen. SalesApp-locales zijn inhoudelijke bron, maar worden niet rechtstreeks als tweede i18n-systeem gekopieerd.

Vereisten:

- keys onder een consistente `salesday.*`-namespace;
- geen hardcoded Nederlandse labels, confirmteksten, statusnamen of foutmeldingen;
- status-enums mappen naar vertaalsleutels; gelokaliseerde labels worden nooit opgeslagen;
- datum-, tijd-, getal-, valuta- en eenheidformattering gebruikt actieve locale en expliciete timezone;
- businessdatum en timestamp blijven verschillende types;
- routes en database-enums blijven taalneutraal;
- ontbrekende-key- en paritytest voor NL/FR/DE;
- speciale tekens blijven UTF-8.

De scan vond geen algemene mojibake, maar wel inhoudelijke taalvermenging, bijvoorbeeld een Duitse tekst in `locales/fr.json`, en veel directe `nl-BE`/`en-CA`-formattering. Deze inhoud moet tijdens portering handmatig worden opgeschoond; blind kopiëren zou bestaande inconsistenties importeren.

## 19. Bestandsopslag: foto's, documenten en handtekeningen

SalesApp gebruikt onder meer `URL.createObjectURL`, inline SVG-data, base64-handtekeningen en mockdocument-URL's. Object-URL's bestaan alleen in de huidige browsertab en base64 in een record schaalt slecht. Geen van beide is een productieopslagstrategie.

Doelpatroon:

1. browser vraagt een uploadtoken/slot aan voor een specifiek domeinobject en bestandstype;
2. server valideert permission, scope, MIME, grootte en quota;
3. bytes gaan naar private opslag onder een gegenereerde storage key buiten `public`;
4. DB bewaart metadata, checksum, eigenaar, classificatie en status;
5. scan/validatie wordt afgerond voordat het bestand “beschikbaar” is;
6. download loopt via geautoriseerde route of kortlevende signed URL;
7. audit registreert upload, koppeling, download van gevoelige documenten en verwijdering;
8. retentie en legal hold volgen domeinbeleid.

Foto's voor ontvangstbewijs horen aan `StockEvidence`; afspraakdocumenten aan een generieke private `Document`/attachmentrelation of een expliciete SalesDay-documentkoppeling. Contractdocumenten blijven bij `ContractGeneratedDocument`.

Handtekeningen vereisen een afzonderlijk juridisch besluit. Minimaal worden afbeelding/vector, ondertekenaar, ondertekenmoment, documenthash, intentie/consent, authenticatiecontext en bewijsversie immutable vastgelegd. Alleen een base64-krabbel zonder documenthash is geen betrouwbaar bewijs.

## 20. Audit logging

`AuditLog` in FieldForce is een bruikbare gedeelde observatielaag. De huidige helper kan auditfouten echter opvangen om de hoofdactie niet te blokkeren. Voor kritieke processen is dat onvoldoende als enige historie.

Gebruik drie niveaus:

1. **domeinhistorie/ledger, transactioneel verplicht:** afspraakstatus, stockmovement, kasentry, contractstatus;
2. **auditlog:** wie heeft gelezen, gewijzigd, geïmporteerd, geëxporteerd of een bestand geopend;
3. **operationele telemetry:** request-ID, integratierun, latency, retry en technische fout zonder gevoelige payload.

Elke auditentry bevat waar relevant actor, effectieve rol/scope, actie, objecttype/ID, land/team, request-ID, timestamp, bron, resultaat en een geminimaliseerde change summary. Wachtwoorden, tokens, volledige documentinhoud, handtekeningbytes en onnodige persoonsgegevens worden niet gelogd.

Voor bulkimport wordt één runrecord plus geaggregeerde aantallen vastgelegd; individuele foutdetails staan in beveiligde, beperkt bewaarde output. Voor read-auditing wordt een risicogebaseerde keuze gemaakt: contractdocumenten, exports en gevoelige klantbestanden wel; iedere normale lijstweergave niet noodzakelijk.

## 21. Technische conflicten en incompatibiliteiten

| Onderwerp | SalesApp | FieldForce | Gevolg / maatregel |
|---|---|---|---|
| Next.js | geïnstalleerd 16.2.4, manifest `latest` | 15.5.19 | Geen packagecopy; code herschrijven naar FieldForce-versie |
| React | 19.2.5 | 19.2.7 | Klein verschil, maar geen lockfilemenging |
| TypeScript | 6.0.3 | 5.9.3 | SalesApp-code kan nieuwere types aannemen; typecheck per geporteerde slice |
| Tailwind | 4.2.4 | 3.4.19 | Utility-/configverschillen; FieldForce-stijl volgen |
| Lucide | 1.17.0 | 0.468.0 | Icon-namen/API's controleren; geen dependency-upgrade zonder noodzaak |
| Routing | 2 pagina's + client view parser | echte App Router-routes/API's | Nieuwe FieldForce-routes, geen `window.location`-router |
| Auth | gesimuleerd | NextAuth + DB | Volledig vervangen door FieldForce-auth |
| Data | mocks/React-state | Prisma/MySQL + serverhelpers | Geen mockstate als productiebron |
| Rechten | rolstrings/clientfilters | effective permissions en scope | Alle checks herschrijven |
| i18n | eigen helper, deels hardcoded | FieldForce locale/provider | Keys migreren en pariteit testen |
| Maps | Leaflet/OSM in SalesApp | geen vastgelegde SalesDay-mapstack | Licentie, privacy, tiles, offline en CSP beslissen |
| Stock-subapp | TanStack/Supabase/Cloudflare | Next.js/Prisma/MySQL | Alleen processen bestuderen; niet runtime-integreren |
| Bestanden | object-/data-URL | private serveropslagpatroon | Upload/download herschrijven |
| Audit | types/mockhistorie | generieke AuditLog | Domeinledgers aanvullen |
| Buildscope | buitenste tsconfig neemt untracked nested repo mee | strikte FieldForce-build | SalesApp-bronrepo eerst structureren of selectief overnemen |

SalesApp's buitenste `npm run typecheck` en build falen omdat `tsconfig` ook de untracked geneste TanStack/Supabase-repository compileert. Daardoor verwijst `@/*` naar de verkeerde root en ontstaan ontbrekende modules, dubbele React-types en omgevingstypefouten (`ImportMeta`, Deno, enzovoort). Dit is een bestaande repositorygrensfout en bevestigt dat een directorycopy ongeschikt is.

Er zijn bovendien semantische conflicten:

- rolnaam `admin` in SalesApp is geen vervanging voor effectieve FieldForce-permissions;
- SalesApp-leiderfilter is landbreed, terwijl FieldForce team-/landtoewijzing afdwingt;
- tijdloze afspraken en ISO-datumhelpers kunnen door UTC-conversie een dag verschuiven;
- `toLocaleDateString("en-CA")` als datumgenerator is locale-afhankelijk en geen domeindatumtype;
- Peppolresultaten zijn gesimuleerd en client-gecachet;
- stockontvangst-ID's afgeleid uit hoeveelheid zijn geen robuuste mutation IDs;
- lokale prijs, omzet en stockaftrek gebruiken browserstate en missen decimal-/concurrentieregels.

## 22. Veiligheids- en regressierisico's

| Risico | Impact | Kans zonder maatregel | Beheersing |
|---|---|---|---|
| Directe URL omzeilt modulepermission | Hoog: datalek | Hoog | Echte routeguards en API-scope vóór data |
| Representative krijgt geen SalesDay of te brede teamdata | Hoog | Hoog | Nieuwe permissionmatrix + tests per rol/override |
| Tweede klantbron naast ContractCustomer | Hoog: divergerende contracten/afspraken | Hoog | Centrale `BusinessRelation`-beslissing |
| Tweede artikel-/prijsbron | Hoog: verkeerde prijs/marge | Hoog | Canonieke artikelservice en snapshots |
| Contractprototype overschrijft lokale Contract-code | Hoog | Middel | Contract expliciet buiten portscope; regressietests |
| Stock dubbel of niet geboekt bij retry | Kritiek | Hoog | Idempotency, transactie, ledger, concurrencytests |
| Kasbedrag manipuleerbaar in browser | Kritiek | Hoog | Serverledger, permissions, functiescheiding |
| Offline actie na ingetrokken recht | Hoog | Middel | Revalidatie op server bij sync |
| Persoons-/klantdata in onversleutelde browsercache | Hoog | Middel | Dataminimalisatie, TTL, userbinding, wissen/versleutelen |
| Private files via publieke URL | Hoog | Middel | Private storage + geautoriseerde download |
| Base64-handtekening zonder bewijscontext | Hoog | Hoog | Documenthash, signercontext, immutable bewijsmodel |
| ERP downtime blokkeert hele dag | Hoog | Middel | Read cache, duidelijke freshness, circuit/retrybeleid |
| UTC/locale verschuift afspraakdag | Middel/hoog | Hoog | `date` versus `instant`, expliciete Europe/Brussels/landzone |
| Grote componentcopy wordt ontestbaar | Hoog | Hoog | Vertical slices, kleine components, server DTO's |
| Prisma-migratie raakt lokale Contract-tabellen | Hoog | Middel | Rehearsal op kopie, backfill, compatibiliteitsvenster, rollback |
| Bestaande buildwaarschuwing maskeert nieuwe fouten | Middel | Middel | Baseline vastleggen, zero-new-warning policy |

De grootste regressiezone is niet de UI, maar gedeelde modellen en permissions. Met name het generaliseren van `ContractCustomer`/`ContractArticle` raakt lokale, nog niet gepubliceerde Contract-code. Dat werk mag alleen gebeuren wanneer die implementatie stabiel is gebaselineerd en de betrokken Contract-tests groen blijven.

## 23. Teststrategie en uitgevoerde controles

### 23.1 Tijdens deze audit uitgevoerd

**SalesApp hoofdrepository**

- `npm run typecheck`: **mislukt** door de onbedoeld meegecompileerde, untracked geneste TanStack/Supabase-repository;
- `npm run build`: compileerstap slaagt, TypeScript-stap **mislukt om dezelfde repositorygrens-/aliasfout**;
- geen geautomatiseerde tests aanwezig;
- door de checks gewijzigde gegenereerde bestanden zijn naar `HEAD` hersteld.

**FieldForce**

- `npm run typecheck`: **geslaagd**;
- `npm run lint`: **geslaagd met 1 bestaande warning**: ontbrekende `useEffect`-dependency `user.role` in `components/workspace-pages.tsx`;
- `npm run build`: **geblokkeerd vóór Next build** door bestaande Windows Prisma DLL-lock (`EPERM` bij `query_engine-windows.dll.node`);
- `npx next build`: **geslaagd**, inclusief routegeneratie; dezelfde bestaande lintwarning;
- module-, menu-rights-, role-permission-save-, data-access-, auth-session-, login-history-, coaching-db-, contract-calculation-, contract-import- en contract-lettertests: **geslaagd**;
- API-persistencetest: **mislukt** met 401 omdat de test geen geauthenticeerde sessie aanlevert;
- database-verificatietest: **mislukt** omdat verwachte STEP9-fixturedata ontbreekt.

De twee laatste mislukkingen zijn bestaande fixture-/testharnasvoorwaarden, geen gevolg van deze documentatie-audit. Ze moeten vóór integratiewerk als baseline worden gecorrigeerd of formeel geïsoleerd, zodat nieuwe fouten niet tussen bekende rode checks verdwijnen.

### 23.2 Vereiste tests per integratielaag

**Permission en scope**

- matrix per rol, actieve/inactieve roleconfig en user override;
- own/team/country/group queries;
- directe URL, menuvisibility en API moeten dezelfde uitkomst geven;
- IDOR-tests met afspraak-ID buiten scope;
- representative ziet eigen data maar nooit willekeurig team-/landresultaat.

**Repository/adapters**

- contracttests voor externe payloadmapping, nulls, onbekende enumwaarden en paginering;
- timezone/daggrenzen, zomer-/wintertijd en afspraken zonder tijd;
- bronfout, timeout, gedeeltelijke data en stale cache;
- unieke externe IDs en deduplicatie.

**UI**

- loading, empty, partial, stale, denied en error states;
- NL/FR/DE keypariteit en relevante snapshots;
- tabletbreakpoints, touch targets, keyboard/focus en screenreaderlabels;
- alle mutatieknoppen volgen permission, lifecycle, offline en pending-state en veroorzaken nooit schijnopslag.

**Datamigratie**

- migratierehearsal op productie-achtige kopie;
- backfill-aantallen, unique constraints, orphandetectie en rollbackscript;
- Contract-calculaties en documenten blijven aan dezelfde relatie/artikelsnapshot gekoppeld.

**Latere transacties**

- dubbele submit, retry na timeout en tegengestelde gelijktijdige stockmutaties;
- partiële ontvangst, overontvangst, negatieve stock en correctie;
- kasafsluiting versus nieuwe entry;
- offline queue replay na ingetrokken permission;
- bestandstype/grootte, malwarestatus, cross-user download en documenthash.

**Release**

- typecheck, lint zonder nieuwe warnings, gerichte tests en production build;
- migratiestatus en backup/restore-rehearsal indien schema wijzigt;
- featureflag off/on en rollback zonder dataverlies;
- observatie van error rate, adapterlatency, denied requests en dataversheid.

## 24. Interne implementatiemijlpalen 0–6

| Mijlpaal | Inhoud | Schrijfgedrag | Exitcriteria |
|---|---|---|---|
| 0 — contracten en baseline | Provider-neutrale ERP-contracten, Contract-baseline, gedeelde relatie-/artikelrichting, schema- en testontwerp | Geen productiegedrag | Geen verzonnen ERP-interface; migratie- en testbaseline gereviewd |
| 1 — sync/offline/platform | Replica, inbox/outbox, idempotency, devicebinding, encrypted store, flags, dag −1-blokkering en noodmodus | Mockcommands achter niet-productieflag | Fault-injection toont geen commandverlies; flags zijn server-side sluitend |
| 2 — klant en dagwerking | Centrale klant, afspraken, voorbereiding, agenda, bezoek, leads/opvolging/referenties en dagafsluiting | Volledige eigen dagmutaties | Scope, lifecycle, één offline werkdag en Contract-compatibiliteit bewezen |
| 3 — verkoopdocumenten | Order, Order-Reeds-Geleverd, Factuur, nummerreeksen, handtekening, PDF/print en Contractlink | Financiële/stockcommands | Exact één ERP-document per command; snapshots en bewijs reproduceerbaar |
| 4 — Shared Inventory | Transit, vertegenwoordigersstock, ontvangst, bewijs, afwijking, verbruik en dragerstock | Transactionele movements/commands | Reconciliatie sluit; geen dubbele of onverklaarde stock |
| 5 — kas | Betalingswijzen, cashreplica, eerste-werkdagblokkering en automatische ERP-deblokkering | Cashcommands/replica | Geen route/API-omzeiling; alleen ERP/backoffice-confirmatie deblokkeert |
| 6 — productiegate | Operationele KPI, Power BI-link, echte ERP-adapter, alle landen UAT, runbooks en rollback | Echte testtenant-roundtrips | Alle mandatory gates groen; geen mockadapter/data in productie |

De mijlpalen zijn interne bouw- en testgrenzen. De eerste productieactivering gebeurt pas nadat mijlpalen 1 tot en met 5 volledig klaar zijn en mijlpaal 6 de productiepoort heeft gesloten. PST en Service volgen afzonderlijke module-roadmaps; bestaande Contract- en Beheerfunctionaliteit wordt hergebruikt.

## 25. Exacte eerste productiebelofte

### 25.1 Scope

De eerste productieactivering levert:

- volledige één-werkdag-offline PWA op persoonlijk MDM-beheerd Android-toestel;
- provider-neutrale ERP-replica, duurzame commandqueue, idempotency, reconciliation, dag −1-blokkering en noodmodus;
- gedeelde centrale klant/prospect/contact/adresdata voor SalesDay en Contract;
- klantwijziging, VAT-modulo-97 en VIES/Peppol-normalisatie;
- voorbereiding van de volgende werkdag vanaf een per-landtijdstip, standaard 16:30;
- agenda van vandaag, bindende contactcentervolgorde, eigen afspraak voor vandaag en verplichte dagafsluiting;
- bezoekverslag, addendum, lead, opvolging, referentie, documenten en foto's;
- complete commerciële/financiële ERP-historie binnen afspraakgebonden scope;
- Order, Order-Reeds-Geleverd en Factuur met snapshots, reserved nummers, handtekening/uitzondering, offline PDF en Android-printing;
- bestaand Contract openen met gevalideerde klant-/afspraakcontext;
- Shared Inventory met transit, persoonlijke/voertuigstock, gedeeltelijke ontvangst, bewijs, afwijking/quarantaine, verbruiksgoederen en klantdragerstock;
- cashblad en blokkering wanneer het saldo op de eerste effectieve werkdag niet nul is;
- management read-only binnen effectieve scope;
- NL/FR/DE, operationele KPI's en een lage-prioriteit Power BI-link;
- globale, land-, team- en userfeatureflags.

Uitdrukkelijk buiten scope: PST- en Service-implementatie, tweede Contractcalculator, tweede gebruikers-/rollenbeheer, Representative-to-Representative-stocktransfer, klantretour, eigen persoonlijke stockcorrectie, FieldForce-goedkeuring van verbruiksgoederen en Power BI-embedding.

### 25.2 Mappen en routes

Het exacte route-, component-, server-, integration-, sync- en deviceplan staat in `docs/ai/modules/Salesday/IMPLEMENTATION-PLAN.md`. Hoofdgrenzen zijn:

```text
app/salesday/                  # dagwerking, afspraak, verkoop, kas
app/inventory/                 # voorraad, bevoorrading, verbruiksgoederen
app/beheer/salesday/           # redenen en parameters
app/api/salesday/              # scoped reads en commands
app/api/inventory/             # shared Inventory
app/api/sync/                  # bootstrap, command, status, noodmodus
components/salesday/
components/inventory/
lib/server/integrations/sales-erp/
lib/server/sync/
lib/device/
```

Alleen bestanden van de actieve interne mijlpaal worden aangemaakt; geen lege placeholderboom.

### 25.3 Componenten: hergebruik, herschrijven en verwerpen

**Als visuele/functionele referentie gebruiken, maar herschrijven:**

- `components/dashboard/DashboardView.tsx` voor tegelgroepering;
- `components/preparation/MyPreparationView.tsx` voor dag- en afsprakenpresentatie;
- `components/preparation/PreparationDetailView.tsx` voor tabinhoud, opgesplitst in kleine permission-/lifecyclebewuste componenten;
- `components/agenda/SalesAgendaView.tsx` voor statusgroepen;
- presentatiedelen van `components/appointment/AppointmentDetailView.tsx`;
- `components/team/MyTeamView.tsx` alleen voor compacte presentatie, niet voor zijn scopelogica;
- pure route-/datumhelpers uitsluitend na timezone- en unit tests.

**Niet kopiëren:**

- `components/sales/SalesApp.tsx`;
- SalesApp-login/sidebar/app-shell;
- mockdata en client user/role switching;
- lokale mutatiehandlers, `window.location`-router en `localStorage`-businessstate;
- client-only SalesWizard-, stock-, kas- en syncmutaties; PST, Service, Contract-admin en user-managementcode;
- geneste Supabase-runtime, schema, RLS en gegenereerde routeboom.

FieldForce-kaarten, headers, tabellen, badges, buttons, skeletons en empty states hebben voorrang op gelijkende SalesApp-componenten.

### 25.4 API's, services en bronadapter

Reads en commands doorlopen dezelfde vaste grens:

```text
route handler
  → server-side featureflag + permission
  → effectieve scope/lifecycle
  → SalesDay of Inventory service
  → replica + transactionele outbox
  → provider-neutrale ERP-port
  → acknowledgement/event + reconciliation
```

De development mockadapter is deterministisch en niet-productie. Productie weigert mockadapter en mockseed. De echte BC/NAV-adapter wordt pas gebouwd wanneer interface, credentials, events en idempotencycontracten bekend zijn.

### 25.5 Prisma-modelgroepen

Modellen worden per interne mijlpaal toegevoegd en zijn replica-, pending-command-, evidence- of reconciliationdata; het ERP blijft de finale bron. Benodigde groepen:

- gedeelde `BusinessRelation`, contacts, addresses, external references en validationstate;
- appointment replica, preparation, outcome, visit report/addendum, lead/follow-up/reference en day closure;
- article/price replica, sales-document snapshots, reserved numbers en signature evidence;
- Shared Inventory locations, movements, balances, replenishment/receipt/evidence/discrepancy, consumables en dragerstock;
- cash balance/entries/deposit acknowledgement en blockstate;
- integration inbox/outbox/attempt/conflict/cursor/run en device/checkpoint/emergency incident.

Het exacte model- en transactieontwerp staat in `IMPLEMENTATION-PLAN.md` en wordt niet in één speculatieve migratie toegevoegd.

Voor `ContractCustomer` geldt:

- optie A, aanbevolen wanneer Contract stabiel is: gecontroleerde migratie naar `BusinessRelation` vóór de eerste pilot;
- optie B, tijdelijke compatibiliteit: ContractCustomer krijgt een unieke één-op-één-koppeling naar `BusinessRelation`;
- verboden optie: een onafhankelijke SalesDay-klant naast ContractCustomer zonder match-/migratieplan.

### 25.6 Permissions en featureflags

SalesDay en Shared Inventory krijgen gescheiden menu-, read-, own-write-, management- en integrationpermissions. Representatives krijgen de eigen operationele dagacties. Verkoopleider en andere managementrollen zien hun effectieve scope read-only en handelen nooit namens een Representative. Beheer, magazijn, monitoring en noodmodus zijn afzonderlijke permissions.

Serverflags gelden globaal, per land, team en gebruiker en blokkeren navigatie, pages, API's, bootstrapdata en background writes. `NEXT_PUBLIC_*` alleen is niet voldoende.

### 25.7 Vertalingen

- alle zichtbare teksten onder `salesday.*` in `locales/nl.json`, `fr.json`, `de.json`;
- vertalingen voor navigatie, statussen, freshness, lege toestand, ontbrekende brondata, fout en denied;
- localeformatters voor datum/tijd/valuta;
- geen Engelse rolnamen of Nederlandse statussen in de DTO;
- paritytest verhindert ontbrekende keys.

### 25.8 Tests

Minimale eerste-productiesuite:

- `scripts/test-salesday-permissions.ts`: alle rollen, overrides, moduleflag en directe API;
- `scripts/test-salesday-scope.ts`: own/team/country/group plus buiten-scope-ID;
- repository-/adaptertests met vaste contractfixtures;
- mappertests voor status, nulls, onbekende bronwaarden, timezone en `no_time`;
- route tests voor 200/400/401/403/404/429/502 waar relevant;
- offline fault-injection, duplicate/retry/dependency/reconciliation en device-recovery;
- documentnummer, prijs-/lijnsnapshot, handtekening, PDF en print;
- Inventory partial/excess/damaged receipt, quarantine, carrier en expiry;
- cash eerste-werkdagblokkering en uitsluitend automatische ERP-deblokkering;
- componenttests voor loading/empty/stale/denied/error/pending/conflict en ontbrekende optionele velden;
- NL/FR/DE keypariteit;
- bestaande module/menu/data-access/Contract-tests;
- typecheck, lint zonder nieuwe warnings en production build.

Testfixtures gebruiken geen productiepersoonsdata en vereisen geen handmatige bestaande DB-records. De huidige 401 API-persistencetest en STEP9-fixtureafhankelijkheid worden vooraf hersteld of duidelijk buiten de SalesDay-gate geplaatst.

### 25.9 Acceptatiecriteria

De eerste productieactivering is pas klaar wanneer:

1. een vertegenwoordiger uitsluitend eigen afspraken en voorbereiding ziet;
2. een leider uitsluitend effectieve teamdata ziet;
3. land-/groep-/adminscope exact de bestaande FieldForce-regels volgt;
4. menu, page en API dezelfde toegang geven/weigeren;
5. alle goedgekeurde mutaties één werkdag offline werken en geen command verliezen of verdubbelen;
6. dag −1-sync de volgende dag blokkeert en noodmodus centraal/audited werkt;
7. verkoopdocument, reserved nummer, handtekening, stock en ERP-ack exact reconciliëren;
8. cash-, Inventory-, customer- en appointmentconflicten de goedgekeurde regels volgen;
9. bronmoment, pending, conflict, fout en stale toestand zichtbaar zijn;
10. NL/FR/DE volledig zijn;
11. Contract, Coaching, auth, gebruikersbeheer en bestaande navigatie regressievrij blijven;
12. flags alle entrypoints, data en writes blokkeren;
13. typecheck, lint, productiebuild en alle gerichte suites slagen, behoudens vooraf formeel vastgelegde omgevingsbeperking;
14. owning docs, TODO/history en runbooks de werkelijke toestand beschrijven;
15. alle landen de vaste UAT-scenario's uitvoeren met Representative, Verkoopleider, backoffice/magazijn en Admin/Super Admin;
16. de echte ERP-testtenant ieder event/commandtype end-to-end bevestigt;
17. productie geen mockadapter of mockdata kan activeren.

### 25.10 Rollback

Operationele rollback schakelt eerst land/team/user of globaal uit en stopt nieuwe commands. Pending commands, nummergebruik, handtekeningen, stock en kasbewijs blijven intact en worden gecontroleerd gereconcilieerd; rollback mag geen zakelijke transactie wissen.

Applicatierollback:

- vorige release terugzetten via normale deploymentprocedure;
- adapterwrites gecontroleerd stoppen en eventreads/cursors veilig parkeren;
- pending acknowledgements en ERP-commands reconciliëren vóór heractivatie;
- adaptercredentials intrekken indien nodig.

Databaserollback:

- schemawijzigingen worden vooraf als forward-compatible expand/backfill/switch/contract uitgevoerd;
- de eerste release verwijdert geen oude Contract-kolommen in dezelfde release waarin nieuwe relaties worden geïntroduceerd;
- bij terugval blijven nieuwe cachetabellen ongebruikt maar intact; geen destructieve down-migratie onder tijdsdruk;
- dataverwijdering volgt pas na aparte reconciliatie en goedkeuring.

## 26. Open beslissingen

De functionele bron-, scope-, offline-, document-, Inventory-, kas-, module- en rolloutbeslissingen zijn beantwoord en staan in `docs/ai/modules/Salesday/DECISIONS.md`.

Alleen deze externe/technische punten blijven open en krijgen vóór productie een eigenaar en deadline:

1. exacte BC/NAV API, middleware, authenticatie, eventdelivery en reconciliatie;
2. timing en interface van de latere Odoo-adapter;
3. VIES/Peppol service-eigenaarschap, credentials en normalisatiecontract;
4. ERP-mechanisme voor gereserveerde offline documentnummerblokken;
5. ERP-ondersteuning voor alle commands, acknowledgements en FieldForce-conflictprioriteit;
6. ERP-documentgeneratie/-verzending en terugmelding van verzendstatus;
7. definitieve Android-printerhardware en directe SDK; Epson WF-110 is alleen huidige referentie;
8. juridische/Finance/DPO-bewaartermijnen en bewijsvereisten;
9. productie-MDM-policy en remote-wipe-rehearsal;
10. optionele Power BI-embedding, licensing, SSO en row-level security; een beveiligde link volstaat eerst;
11. technische keuze of `ContractCustomer` direct migreert of tijdelijk één-op-één aan `BusinessRelation` koppelt;
12. semantiek van Coaching `Product` vóór koppeling aan de ERP-artikelreplica.

## 27. Eindadvies: GO WITH CONDITIONS

### Besluit

**GO WITH CONDITIONS** voor de volledige goedgekeurde SalesDay- en Shared Inventory-functionaliteit als native FieldForce-modules, inclusief één volledige offline werkdag. De productiebelofte is volledig; de bouw blijft intern gefaseerd en featureflagged.

**Geen GO** voor:

- het kopiëren van de volledige SalesApp-directory;
- het samenvoegen van packagebestanden of runtimes;
- het in productie brengen van de huidige client-side mutaties;
- het hergebruiken van de geneste Supabase-stockapp als FieldForce-database;
- een tweede klant-, artikel-, auth-, rechten-, Contract- of auditbron.

### Verplichte voorwaarden

1. de echte ERP-interface wordt geleverd en alle reads, events, commands, acknowledgements en reconciliation zijn end-to-end bewezen;
2. ERP blijft de finale bedrijfsbron; FieldForce bewaart alleen de vereiste replica, drafts, commands, evidence en audit/reconciliationdata;
3. SalesDay krijgt eigen server-side permissions/scope; Representatives muteren alleen hun eigen dag en management blijft read-only;
4. echte routes en API's vervangen de alleen-authenticated placeholders voordat data beschikbaar komt;
5. Contract blijft de enige calculator/documenteigenaar en zijn lokale regressietests blijven groen;
6. centrale relationele en artikelmodellen worden zonder duplicatie en via forward-compatible migraties ingevoerd;
7. de volledige eerste release is NL/FR/DE, één werkdag offline, server-side featureflagged en getest op persoonlijke MDM-beheerde Android-tablets;
8. SalesApp-code wordt selectief herschreven naar FieldForce-versies/patronen; grote monolieten, mocks en client-auth worden niet gekopieerd;
9. bekende testharnasproblemen krijgen een verklaarde baseline, zodat de SalesDay-gate betrouwbaar is;
10. geen klant-, afspraak-, document-, stock-, kas- of offline write gaat live vóór transactie-, idempotentie-, audit-, reconciliatie- en conflictcriteria bewezen zijn;
11. private files, handtekeningen, reserved nummers en print-/documentbewijs volgen het goedgekeurde opslag-, bewijs- en retentiebeleid;
12. alle landen slagen in dezelfde UAT met Representative, Verkoopleider, backoffice/magazijn en Admin/Super Admin;
13. productie kan mockadapter en mockseed niet activeren;
14. dag −1-blokkering, ERP-noodmodus, rollback en device recovery zijn gerepeteerd.

### Eerstvolgende stap

Start mijlpaal 0 uit `docs/ai/modules/Salesday/IMPLEMENTATION-PLAN.md`: baseline de lokale Contract-werkboom, leg de provider-neutrale ERP-port en fixtures vast, ontwerp de gedeelde relation-/artikelmigratie, idempotente inbox/outbox en serverflags, en herstel of isoleer de twee bekende rode testharnaschecks. Daarna kan mijlpaal 1 de sync/offlinefundering implementeren met de mockadapter. Geen productiecode mag een fictief BC/NAV-endpoint of mockfallback veronderstellen.
