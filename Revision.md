# FieldForce — Revision

## Documentinformatie

- Laatste update: 22 juli 2026
- Uitgevoerde door: Codex
- Repository: `C:\Users\jand\Documents\Codex\FieldForce`
- Branch: `main`
- Commit: `87d2250fb9cacc66e7df039ef5a97622d83c5341`
- Audit gestart: 18 juli 2026
- Audit afgerond: 18 juli 2026
- Applicatieversie: `0.1.0`
- Databasecontext: Prisma 6.9.0 met MariaDB/MySQL; uitsluitend schema- en codeanalyse, geen muterende databaseacties
- Geteste omgeving: Lokale repository; codeanalyse, veilige statische/technische controles en beperkte read-only UI-controle op de bestaande lokale sessie
- Niet-beschikbare onderdelen: Volledige authenticated UI-matrix per rol, echte Microsoft Entra-tenant, Outlook/Graph, SMTP-aflevering, productieomgeving, representatieve productiedata en fysieke desktop/tablet/mobiele apparaten

## Wijziging 22 juli 2026 — Veilige gebruikersimpersonatie

- **Module:** gedeeld platform / authenticatie / gebruikersbeheer / audit.
- **Locatie:** gebruikersfiche, applicatieshell, Beheer > Log en `/api/impersonation/*`.
- **Type wijziging:** FUNCTIONEEL, RECHTEN, SECURITY, DATABASE, API, E-MAIL, NOTIFICATIE, I18N en TEST.
- **Functionele impact:** bevoegde gebruikers kunnen een toegelaten actieve gebruiker tijdelijk als effectieve context gebruiken en via de permanente waarschuwing direct terugkeren. Historiek is filterbaar op periode, actor, doel, land, team, status en reden.
- **Technische impact:** de gedeelde authenticatiecontext resolveert een databasegebonden effectieve gebruiker zonder Auth.js of Entra-identiteit te vervangen. Start, stop, timeout, rechtenintrekking, targetdeactivatie en logout zijn centraal afgehandeld.
- **Beveiligingsimpact:** `users.impersonate` en `audit.impersonation.read` gebruiken de bestaande rolrechten en overrides. De centrale policy blokkeert self-targeting, inactieve gebruikers, hogere beveiligingsniveaus en doelen buiten land/team/user-scope. Persoonlijke notificaties kunnen tijdens impersonation niet als gelezen worden gemarkeerd.
- **Auditimpact:** sessies en geweigerde pogingen hebben een apart eventledger; mutatie-audit bewaart real actor, effective user, impersonation session, IP en user-agent waar beschikbaar. MAIL TEST blijft alle echte ontvangers blokkeren en vermeldt beide identiteiten.
- **Databasewijzigingen:** Prisma-modellen `ImpersonationSession` en `ImpersonationEvent`, aanvullende `AuditLog`-velden en migratie `0056_user_impersonation`.
- **Uitgevoerde tests:** `npx prisma validate`, `npm run typecheck`, gerichte ESLint, `npm run test:impersonation`, `npm run test:mail-service`, `npm run test:menu-rights` en `npm run test:auth-session` geslaagd. Prisma Client generation werd geprobeerd maar de bestaande Windows dev-server hield `query_engine-windows.dll.node` vergrendeld (`EPERM`); de server is conform repositoryregels niet gestopt.
- **Niet uitgevoerd:** geen browsermatige rolmatrix, geen echte mailaflevering, geen database-migratie op de lokale of productie-MariaDB en geen productiebuild.

## Legenda

### Prioriteit

- P0 — Kritiek
- P1 — Hoog
- P2 — Normaal
- P3 — Laag
- P4 — Idee of optimalisatie

### Type

- BUG
- FUNCTIONEEL
- VISUEEL
- UX
- RECHTEN
- SECURITY
- DATA
- PERFORMANCE
- TECHNISCH
- DATABASE
- API
- E-MAIL
- NOTIFICATIE
- PDF
- I18N
- ACCESSIBILITY
- DOCUMENTATIE
- TEST
- ONDERZOEK
- CLEANUP
- IDEE

### Status

- Nieuw
- Te analyseren
- Bevestigd
- Niet reproduceerbaar
- Geblokkeerd
- Klaar voor uitvoering
- Uitgevoerd
- Gevalideerd
- Niet uitvoeren

## Managementsamenvatting

De onderzochte FieldForce-versie is **niet productierijp als één integraal platform**. De codebasis bevat veel degelijk uitgewerkte bouwstenen en de uitgevoerde typecheck, lint, Prisma-validatie en zeventien gerichte tests zijn geslaagd. De audit identificeert echter 54 afzonderlijke bevindingen: 1 P0, 27 P1, 23 P2, 2 P3 en 1 P4. De grootste risico's zitten niet in syntaxis of losse unitcontracten, maar in end-to-endautorisatie, scopeconsistentie, data-/bestandstransacties, auditbetrouwbaarheid, onvoltooide productie-integraties en verschillen tussen wat navigatie/documentatie belooft en wat gebruikers werkelijk kunnen uitvoeren.

SalesDay en Inventory mogen niet worden geactiveerd in productie zolang geen echte ERP-adapter en volledige externe acceptatie bestaan. Inventory heeft bovendien nog geen functionele eigen UI. Contractondertekening gebruikt de geactiveerde DOCX-inhoud niet in de gegenereerde PDF en het Linux-downloadpad is fout. In Coaching en beheer bestaan meerdere server-side rechtenlekken of configuratie-omzeilingen. Group Manager wordt technisch op verschillende plaatsen als globaal behandeld, in strijd met de centrale rolregel. Planning presenteert ontbrekende datums/tijden als exacte afspraken. Tussentijdse evaluaties delen antwoordsets tussen rollen voordat de HR-zichtbaarheidsregel is beslist.

De aanbevolen aanpak is: eerst productiegates en datalekrisico's sluiten; daarna centrale route-/capability-/scope- en commandtransactiearchitectuur invoeren; vervolgens Contract, Inventory, KPI-ingestie en background/outboxflows afmaken; ten slotte toegankelijkheid, i18n, documentatie en onderhoudbaarheid consolideren. P2/P3/P4 mogen niet blind vóór P0/P1 worden uitgevoerd wanneer zij van dezelfde architectuur afhangen.

## Kritieke bevindingen

| Bevinding | Kernrisico | Directe managementbeslissing |
|---|---|---|
| REV-0051 (P0) | Alleen mock-ERP; SalesDay/Inventory zijn niet productieactiveerbaar | Productiegate gesloten houden en real-adapter/UAT financieren |
| REV-0002 / REV-0003 / REV-0044 | Group Manager en multi-country scope lekken of verschillen per domein | Eén centrale organisatiescope goedkeuren; least privilege tot besluit |
| REV-0004 / REV-0005 / REV-0038 | Workflow-API's koppelen modules en kunnen specifieke rechten omzeilen | Mutaties/readmodellen per capability fail-closed maken |
| REV-0008 | Service worker kan dashboard-HTML als API-/bestandsresponse teruggeven | PWA-cachebeleid vóór productie corrigeren en logouttesten uitvoeren |
| REV-0009 / REV-0020 | Credential-login is onbeperkt en accountprovisioning is onvolledig | Authstrategie en rate-limit/activatieflow beslissen |
| REV-0012 / REV-0017 | Businessopslag, notificatie en audit kunnen uiteenlopen; audit kan verkeerde actor krijgen | Transactionele audit/outbox en expliciete systeemactor invoeren |
| REV-0029 | Evaluator- en vertegenwoordigerantwoorden worden voortijdig onderling gedeeld | HR-visibilitymatrix beslissen; cross-role read voorlopig blokkeren |
| REV-0035 | Planning toont verzonnen tijdstippen/datums als echte afspraken | Fallback verwijderen en 'nog in te plannen' expliciet modelleren |
| REV-0042 / REV-0025 | Hard delete wist historie/audit of faalt op nieuwere domeinrelaties | Retentie-/anonimiseerbeleid vastleggen; hard delete blokkeren |
| REV-0046 | KPI/prestatiebeelden hebben geen productiebron voor actuele resultaten | KPI-bron, formule, ingestie en freshness per indicator vastleggen |
| REV-0050 / REV-0015 / REV-0018 | Contract-PDF wijkt af van template, faalt op Linux of wordt niet atomair ondertekend | Ondertekening niet vrijgeven vóór renderer/opslag/concurrency-UAT |
| REV-0055 | Inventory heeft backend en menu maar alleen placeholder-UI | Niet zichtbaar maken tot volledige UI en end-to-end-UAT bestaan |

## Algemene patronen en structurele problemen

- **Client-side navigatie als pseudo-beveiligingslaag:** directe pagina's controleren vaak alleen authenticatie; echte menurechten en routekeuze zitten in een monolithische clientcomponent.
- **Parallelle scope-implementaties:** Group Manager, countryAccess, team- en recordscope worden per domein opnieuw gecodeerd en geven daardoor verschillende uitkomsten.
- **Samengestelde workflows zonder samengesteld autorisatiecontract:** één payload of provider bevat meerdere domeinen, maar controleert slechts het primaire routetype.
- **Niet-atomische grenzen:** database, filesystem, notificatie, mail, audit en externe sync worden na elkaar uitgevoerd zonder durable command/outbox- of compensatiecontract.
- **Fail-open operationele neveneffecten:** audit/mailfouten worden vaak alleen gelogd; andere neveneffectfouten kunnen na een geslaagde commit alsnog een 500 geven.
- **Implementatie vóór goedgekeurd businesscontract:** trainingen, starterevaluatiezichtbaarheid, PST en Service lopen vooruit op een volledige owning specificatie.
- **Professionele UI maskeert ontbrekende of fictieve data:** loaders worden lege states, SalesDay-storing wordt 'niet actief' en Planning verzint afspraakposities.
- **Productiegates zijn extern of niet bewaakt:** ERP-adapter, starterevaluatiescheduler, KPI-ingestie, SMTP/Graph-retries en observability ontbreken of hangen van handmatige hostingconfiguratie af.
- **Documentatie en code drijven uit elkaar:** README, lege businessdocs, Contractscope en PWA-status geven tegenstrijdige signalen.
- **Grote gedeelde client- en providerlaag:** iedere route betaalt voor meerdere domeinen; fouten en bundels lekken over modulegrenzen.

## Auditdekking

| Module | Onderdelen | Code onderzocht | UI onderzocht | Rechten onderzocht | Status | Opmerkingen |
|---|---|---:|---:|---:|---|---|
| Algemene applicatiestructuur | Shell, layout, navigatie, algemene componenten, states | Ja | Ja | Ja | Afgerond | Desktop/tablet/mobiel op bestaande localhost; geen server herstart |
| Authenticatie en sessies | Auth.js, credentials, Entra, sessies, login/logout | Ja | Beperkt | Ja | Afgerond | Bestaande sessie gebruikt; geen brute force of externe Entra-login uitgevoerd |
| Dashboard | Rolwidgets, aandachtspunten, historie, links | Ja | Ja | Ja | Afgerond | Super Admin-UI; lagere rollen via code/tests |
| Planning | Kalender, items, filters, plannen/wijzigen | Ja | Ja | Ja | Afgerond | Outlook read-only in bestaande sessie; geen afspraken gewijzigd |
| Begeleidingen | Overzicht, wizard, approval, reflectie, PDF | Ja | Ja | Ja | Afgerond | Overzicht live; mutaties/approval niet uitgevoerd |
| Voorbereiding klantenbezoeken | Coaching- en SalesDayvoorbereiding, klantdata, referentie | Ja | Beperkt | Ja | Afgerond | ERP-externe werking geblokkeerd; code/tests beoordeeld |
| Contactmomenten | Planning, verslag, foto's, status, PDF | Ja | Beperkt | Ja | Afgerond | Uploads niet muterend getest |
| Hulpaanvragen | Aanmaak, antwoord, follow-up, historie | Ja | Beperkt | Ja | Afgerond | Geen notificaties of mails verstuurd |
| Actiepunten | Overzicht, lifecycle, scopes, historie | Ja | Beperkt | Ja | Afgerond | Lifecycle- en visibilitytests geslaagd |
| Tussentijdse evaluaties | Automatisch/manueel, vragen, KPI, approval | Ja | Beperkt | Ja | Afgerond | Job/answers niet gemuteerd; cross-role response in code bevestigd |
| Retrainingen en salestrainingen | Planning, lifecycle, koppelingen | Ja | Beperkt | Ja | Afgerond | Functioneel ongedefinieerd; geen records gemaakt |
| Mijn Team | Groepering, scopes, fichetoegang | Ja | Beperkt | Ja | Afgerond | Scopecode/tests; geen aparte rolaccounts beschikbaar |
| Gebruikersprofiel | Header, tabs, contactgegevens, data | Ja | Beperkt | Ja | Afgerond | Geen externe profielfoto opgehaald of gewijzigd |
| Prestatiecirkel en scoretabellen | Berekening, vergelijking, rendering | Ja | Ja | Ja | Afgerond | Productie-ingestie ontbreekt; pure tests geslaagd |
| Beheer — Gebruikers | CRUD, rollen, teams, synchronisatie | Ja | Beperkt | Ja | Afgerond | Geen muterende beheeractie uitgevoerd |
| Beheer — Rollen en rechten | Matrix, overrides, scope, directe toegang | Ja | Beperkt | Ja | Afgerond | Menu-rechtentest geslaagd; servercapabilities afzonderlijk beoordeeld |
| Beheer — Teams, landen en organisatie | Structuur, verplaatsing, historie | Ja | Beperkt | Ja | Afgerond | Mutaties alleen codeanalyse |
| Beheer — KPI's, kapstok en criteria | Niveaus, overerving, historie | Ja | Beperkt | Ja | Afgerond | Geen import/delete uitgevoerd |
| Beheer — Parameters | Instellingen, feature flags, mailtest | Ja | Beperkt | Ja | Afgerond | Geen instelling opgeslagen |
| E-mailfunctionaliteit | Centrale service, templates, testmodus | Ja | N.v.t. | Ja | Afgerond | Mock/testservice; geen echte mail verzonden |
| Notificaties | Bel, teller, links, lifecycle, polling | Ja | Ja | Ja | Afgerond | Bestaande read-state en pure tests; geen notificationwrite |
| PDF's, exports en afdrukken | Coaching, contact, contract, SalesDay | Ja | Beperkt | Ja | Afgerond | Veilige PDF-test; gegenereerd testbestand verwijderd |
| Meertaligheid | NL, FR, DE, hardcoded tekst, UTF-8 | Ja | Beperkt | N.v.t. | Afgerond | Woordenboeken elk 928 keys; geen volledige drietalige handtest |
| Responsiviteit en toegankelijkheid | Desktop, tablet, mobiel, toetsenbord, ARIA | Ja | Ja | N.v.t. | Afgerond | 1280×800, 768×1024 en 390×844; geen echte screenreader/fysiek device |
| Database en Prisma | Modellen, relaties, indexen, migraties | Ja | N.v.t. | Ja | Afgerond | Schema valid; geen migratie/seed/databasewrite |
| API-routes en server-side acties | Auth, validatie, scope, transacties | Ja | N.v.t. | Ja | Afgerond | 112 routebestanden geïnventariseerd |
| Achtergrondtaken en synchronisaties | Jobs, foto's, reminders, Graph, ERP | Ja | N.v.t. | Ja | Afgerond | Externe/muterende workers niet uitgevoerd |
| Service worker en PWA | Cache, update, offline, gevoelige data | Ja | Beperkt | Ja | Afgerond | Code/shelltests; productie-SW niet op devserver geregistreerd |
| Logging, historiek en audittrail | Actor, waarden, processen, privacy | Ja | Beperkt | Ja | Afgerond | Geen productie-logplatform beschikbaar |
| Documentatie en onderhoudbaarheid | README, AI-docs, TODO, technische docs | Ja | N.v.t. | N.v.t. | Afgerond | Owning docs en conflicten gericht gelezen |
| SalesDay | Dagplanning, klanten, afspraken, sync, offline | Ja | Ja | Ja | Afgerond | Live disabled/errorstate; mutaties en real ERP geblokkeerd |
| Inventory | Balansen, tellingen, aanvulling, instellingen | Ja | Ja | Ja | Afgerond | Backendtest geslaagd; live routes zijn placeholders |
| Contracten | Berekening, import, brief, modellen, documenten | Ja | Ja | Ja | Afgerond | Dashboard live; geen import/ondertekening; code/tests beoordeeld |

## Inventaris

### Applicatieroutes en pagina's

De applicatielaag bevat **123 bestanden** onder `app`, met vijf pagina-entrypoints:

| Entrypoint | Functie |
|---|---|
| `app/page.tsx` | Rootlanding en initiële doorsturing |
| `app/[...slug]/page.tsx` | Generieke FieldForce-workspace en het grootste deel van de functionele routes |
| `app/contract/[[...segments]]/page.tsx` | Contractmodule met eigen routeboom |
| `app/begeleidingen/nieuw/page.tsx` | Aparte instap voor het begeleidingstraject |
| `app/login/page.tsx` | Aanmeldscherm |

De generieke catch-all beperkt het aantal fysieke pagina-entrypoints, maar verplaatst routekeuze, schermcompositie en een deel van de toegangslogica naar `components/workspace-pages.tsx`. Hierdoor is de functionele route-inventaris groter dan de fysieke page-inventaris en is centrale server-side routeautorisatie noodzakelijk; zie REV-0001 en REV-0022.

### API-routes en server-side acties

Er zijn **112 `route.ts`-bestanden**. De grootste routefamilies zijn:

| Routefamilie | Aantal routebestanden | Hoofdonderwerp |
|---|---:|---|
| `salesday` | 42 | Dagplanning, afspraken, sync, cache, klanten, bijlagen en Inventory-koppelingen |
| `workflows` | 16 | Begeleidingen, evaluaties, retrainingen en lifecyclemutaties |
| `contract` | 12 | Berekeningen, import, modellen, brief, ondertekening en documenten |
| `inventory` | 9 | Balansen, tellingen, aanvulling en instellingen |
| `management` | 5 | Rollen, rechten, teams en beheerconfiguratie |
| `users` | 4 | Gebruikersbeheer en provisioning |
| `auth` | 3 | Login, logout en sessiecontext |
| `starter-evaluations` | 3 | Starterevaluatie, antwoorden en workflow |
| `notifications` | 3 | Meldingen, status en opvolging |
| Overige routefamilies | 15 | Help, configuratie, criteria, modules, historiek, team, performance en integraties |

Authenticatie, effectieve scope, moduleactivatie en lifecyclevalidatie zijn niet overal via één afdwingingslaag georganiseerd. De relevante kruispunten zijn vastgelegd in REV-0004 t/m REV-0007, REV-0037, REV-0038 en REV-0048.

### Prisma-modellen, enums en statussen

`prisma/schema.prisma` omvat circa **3.627 regels**, **129 modellen** en **74 enums**. De repository bevat **59 migratiemapjes**. De schema-audit omvatte onder meer:

- gebruikers, rollen, overrides, landen, teams en organisatiescope;
- coachingworkflows, deelnemers, evaluaties, actiepunten, audit- en notificatierecords;
- contactmomenten, klantcontext en bijlagen;
- SalesDay-, afspraak-, sync- en Inventory-entiteiten;
- contractberekeningen, modellen, importbatches en gegenereerde documenten;
- statusvelden, unieke sleutels, `onDelete`-gedrag, indexen en bestandsverwijzingen.

`npx prisma validate` slaagde. De voornaamste inhoudelijke risico's zitten niet in syntactische schemageldigheid, maar in parallelle statusrepresentaties, harde deletes, transactieranden en verschillen tussen relationele data en bestanden; zie REV-0014, REV-0018, REV-0025, REV-0026, REV-0033 en REV-0042.

### Rollen, rechten en scopehelpers

De implementatie en documentatie kennen **acht rolprofielen**, aangevuld met moduleactivatie, menurechten, gebruikersoverrides en land-/team-/gebruikersscope. De centrale catalogi bevatten **100 FieldForce-permissionkeys** en **50 menu-permissionkeys**.

Gecontroleerde lagen:

- rolstandaarden en expliciete gebruikersoverrides;
- module- en menuactivatie;
- land-, team- en gebruikersscope;
- server-side API-controles en querybegrenzing;
- client-side zichtbaarheid en directe routeafdwinging;
- lifecyclelocks en uitzonderingen voor Group Manager, Coach en beheerrollen.

De belangrijkste structurele bevinding is dat effectieve toegang over meerdere helpers en routefamilies is verspreid. Een rolnaam alleen is terecht onvoldoende, maar niet iedere route gebruikt dezelfde samengestelde beslissing. Zie vooral REV-0001 t/m REV-0006, REV-0023, REV-0037, REV-0038 en REV-0044.

### E-mail, notificatie, PDF, export, import en achtergrondtaken

| Onderdeel | Gecontroleerde implementatie | Belangrijkste grens of bevinding |
|---|---|---|
| E-mail | SMTP-service, templates en aanroepers | Geen duurzame outbox/retry; REV-0053 |
| Notificaties | Persistente notificaties en workflowtriggers | Hoofdactie en neveneffect niet atomisch; REV-0012 |
| PDF/DOCX | Begeleidingsrapport, contactrapport, contractbrief en opslag | Linux-pad, concurrency en ongebruikte template; REV-0015, REV-0018, REV-0050 |
| Import | Contract-/Excelinvoer en bestandsvalidatie | Upload- en foutgrenzen gericht beoordeeld |
| Export/afdruk | Rapport- en documentroutes | Veilige PDF-test uitgevoerd; geen productie-exportdata gebruikt |
| Microsoft Graph/Outlook | Planning- en agendakoppeling | Timeout/paginering en externe afhankelijkheid; REV-0036 |
| ERP | SalesDay- en Inventory-adapters | Alleen mockadapter operationeel; REV-0051 en REV-0055 |
| Achtergrondtaken | Starterevaluaties, herinneringen en sync | Externe scheduler vereist; REV-0052 |

Externe systemen zijn niet aangeroepen en muterende jobs zijn niet uitgevoerd. De audit beoordeelt hier codepaden, contracttests, configuratiegrenzen en foutafhandeling.

### Vertalingen, configuratie en feature flags

De drie locale-bestanden voor Nederlands, Frans en Duits bevatten elk **928 keys** en zijn onderling key-compleet. Gecontroleerd zijn onder meer HTML-taalinstelling, hardcoded gebruikerscopy, statuslabels, foutmeldingen, moduleconfiguratie en disabled/errorstates.

De keydekking is sterk, maar garandeert niet dat iedere runtimewaarde vertaald of semantisch juist wordt weergegeven. Belangrijkste afwijkingen staan in REV-0013, REV-0028, REV-0043, REV-0045 en REV-0048. Productiefeatureflags en externe secrets zijn om veiligheidsredenen niet gewijzigd of volledig operationeel getest.

## Bevindingen per module

### 1. Algemene applicatiestructuur

#### 1.1 Navigatie

#### REV-0001 — Directe paginaroutes controleren alleen authenticatie en geen module- of menurecht

- **Module:** Algemene applicatiestructuur
- **Submodule:** Navigatie en directe routebeveiliging
- **Scherm/pagina:** Alle pagina's onder de generieke catch-allroute
- **Route:** `/[...slug]`, onder meer `/beheer/rollen`, `/salesday`, `/rapportering`
- **Component/bestand:** `app/[...slug]/page.tsx`, `components/workspace-pages.tsx`
- **Functie/API/model:** `CatchAllPage`, `requirePageAuthentication`, `WorkspacePage`
- **Type:** RECHTEN / SECURITY
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle aangemelde rollen
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

De servercomponent van de generieke paginaroute controleert uitsluitend of er een geldige sessie is. Module-, menu- en sectierechten worden pas in de clientcomponent bepaald. Een aangemelde gebruiker zonder recht krijgt daardoor een geldige serverrespons en de clientbundel voor de route; pas daarna verschijnt eventueel een client-side melding dat toegang ontbreekt.

**Verwachte of gewenste situatie**

Elke directe route moet vóór rendering server-side hetzelfde effectieve module-, menu-, rol- en scoperecht afdwingen als de navigatie en achterliggende API. Een onbevoegde route geeft een consistente 403-ervaring of veilige redirect zonder het beschermde scherm te hydrateren.

**Waarom dit een probleem is**

Client-side zichtbaarheid is geen beveiligingsgrens. De huidige opzet maakt rechten afhankelijk van correcte clientlogica, vergroot de kans op verschillen tussen menu, pagina en API en onthult route- en schermmetadata aan iedere aangemelde gebruiker.

**Stappen om vast te stellen of te reproduceren**

1. Meld aan met een gebruiker zonder recht op een bestaande module of beheersectie.
2. Open de verborgen route rechtstreeks in de adresbalk.
3. Observeer in de bron dat `CatchAllPage` alleen `requirePageAuthentication` uitvoert en vervolgens altijd `WorkspacePage` rendert.

**Technische vaststelling**

`app/[...slug]/page.tsx` bouwt het pad op, roept `requirePageAuthentication` aan en geeft de segmenten zonder verdere autorisatie door. De fijnmazige beslissing zit in de grote clientcomponent `WorkspacePage`.

**Bewijs**

- Bestand: `app/[...slug]/page.tsx`
- Regel of codeblok: regels 1-11, met name `await requirePageAuthentication(...)` gevolgd door `return <WorkspacePage ... />`
- Route: alle catch-allroutes
- Scherm: de algemene shell is op localhost gecontroleerd; een afzonderlijke lage-rechtenaccount was niet beschikbaar
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/03_ROLES.md` vereist directe route- en server-side afdwinging

**Voorgestelde aanpassing**

Maak een centrale server-side routecatalogus die routepatronen koppelt aan domein, modulecode, menurecht en optioneel beheerrecht. Laat de catch-allpagina de actor en actieve modules laden en vóór rendering een 403-pagina, `notFound` of veilige redirect toepassen. Hergebruik dezelfde catalogus in app-switcher, shell en tests.

**Acceptatiecriteria**

- [ ] Elke bestaande route heeft een expliciet server-side toegangscontract.
- [ ] Een gebruiker zonder module- of menurecht ontvangt geen beschermde pagina-inhoud of clientstate.
- [ ] Menu, directe route en API geven voor alle rollen dezelfde toegangsuitkomst.
- [ ] Geautomatiseerde tests dekken minimaal één toegestane en één geweigerde route per domein.

**Risico bij niet aanpassen**

Nieuwe pagina's kunnen onbedoeld alleen visueel verborgen worden, waardoor route- en API-beveiliging uit elkaar lopen en gevoelige metadata of toekomstige serverdata bereikbaar kan worden.

**Afhankelijkheden**

- Centrale route- en rechtenmatrix
- Besluit over uniforme 403- versus 404-ervaring

**Gerelateerde bevindingen**

- REV-0002
- REV-0004
- REV-0005

#### REV-0011 — Rootlayout hydrateert alle domeinproviders op iedere route

- **Module:** Algemene applicatiestructuur
- **Submodule:** Layout, dataladen en domeinisolatie
- **Scherm/pagina:** Alle pagina's, inclusief login en Coaching-schermen
- **Route:** Globaal
- **Component/bestand:** `app/layout.tsx`, `components/*-provider.tsx`, `components/salesday/feature-provider.tsx`
- **Functie/API/model:** `RootLayout`, `WorkflowProvider`, `PerformanceProvider`, `SalesDayFeatureProvider`
- **Type:** PERFORMANCE / TECHNISCH / API
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle gebruikers
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

De rootlayout nestelt sessie, SalesDay-feature/device, modules, vertegenwoordigers, configuratie, performance, persoonlijke criteria, workflows en notificaties rond iedere pagina. Na authenticatie starten daardoor ook op een puur Coaching- of Contractscherm meerdere domeinvreemde API-requests. Tijdens de localhostcontrole logde een Coaching-scherm herhaaldelijk een fout van `/api/salesday/features`.

**Verwachte of gewenste situatie**

Globaal horen alleen providers te staan die werkelijk op iedere route nodig zijn. Zware of domeinspecifieke datasets moeten op domeinlayout- of schermniveau worden geladen, met caching/deduplicatie en een foutgrens die het actieve domein niet beïnvloedt.

**Waarom dit een probleem is**

De starttijd en databasebelasting groeien met alle modules tegelijk. Een storing of ontbrekende configuratie in SalesDay veroorzaakt fouten op Coaching, terwijl login en eenvoudige beheerpagina's onnodig grote datasets laden. Dit bemoeilijkt foutisolatie en schaalbaarheid.

**Stappen om vast te stellen of te reproduceren**

1. Open `/begeleidingen` in een aangemelde sessie.
2. Inspecteer de browserconsole en netwerkactiviteit.
3. Observeer dat de SalesDay-featureprovider wordt uitgevoerd en bij een fout op een Coaching-route logt.
4. Vergelijk dit met de providerboom in `app/layout.tsx`.

**Technische vaststelling**

`RootLayout` monteert alle providers onvoorwaardelijk. `WorkflowProvider`, `PerformanceProvider` en `SalesDayFeatureProvider` starten elk een eigen fetch zodra de sessie beschikbaar is, ongeacht het actieve routegebied.

**Bewijs**

- Bestand: `app/layout.tsx`, `components/workflow-provider.tsx`, `components/performance-provider.tsx`, `components/salesday/feature-provider.tsx`
- Regel of codeblok: providerboom rond regels 40-61; workflowfetch rond regel 157; SalesDay-featurefetch rond regel 52
- Route: `/begeleidingen`
- Scherm: Begeleidingenoverzicht laadde inhoud, maar met domeinvreemde consolefout
- Log: `[salesday/features] Error: De SalesDay-activatie kon niet worden geladen.`
- Query: `/api/workflows`, `/api/performance`, `/api/salesday/features` en andere providerrequests worden globaal gestart
- Gerelateerde documentatie: `docs/ai/01_ARCHITECTURE.md`, `docs/ai/modules/Salesday/README.md`

**Voorgestelde aanpassing**

Splits de shell in een minimale globale sessie/shelllaag en domeinlayouts voor Coaching, SalesDay, Inventory en Contract. Laad datasets via servercomponenten of routegebonden queryproviders. Dedupliceer gedeelde gebruikers/configuratiecalls en zorg dat een domeinfout alleen binnen dat domein zichtbaar wordt.

**Acceptatiecriteria**

- [ ] Een Coaching-route doet geen SalesDay-feature- of device-request.
- [ ] Login laadt geen beschermde domeindatasets vóór succesvolle authenticatie.
- [ ] Elke domeinprovider is alleen gemonteerd waar minimaal één consument aanwezig is.
- [ ] Meetbare requestaantallen en laadtijd zijn vóór en na de wijziging vastgelegd.

**Risico bij niet aanpassen**

Toenemende modules maken elke pagina trager en fragieler; een fout in één domein blijft gebruikers in andere domeinen beïnvloeden en verhoogt onnodig API- en databaseverkeer.

**Afhankelijkheden**

- Route-/domeinlayoutstrategie
- Herziening van gedeelde hooks en cachebeleid

**Gerelateerde bevindingen**

- REV-0004
- REV-0022

#### 1.2 Layout

#### 1.3 Algemene componenten

#### REV-0022 — Eén clientcomponent bevat vrijwel de volledige Coaching- en beheerwerkruimte

- **Module:** Algemene applicatiestructuur
- **Submodule:** Componentarchitectuur en bundelgrenzen
- **Scherm/pagina:** Dashboard, Coaching, profielen, rapportage en beheer
- **Route:** Meeste generieke catch-allroutes
- **Component/bestand:** `components/workspace-pages.tsx`, `components/configuration-management.tsx`, `components/user-management.tsx`
- **Functie/API/model:** `WorkspacePage` en tientallen lokaal gedefinieerde paginafuncties
- **Type:** TECHNISCH / PERFORMANCE / TESTBAARHEID
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle gebruikers
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse

**Huidige situatie**

`workspace-pages.tsx` telt circa 5.869 regels en ongeveer 296 kB broncode. Het is een clientcomponent dat routes, starterevaluaties, profielen, rapportage, Begeleidingenlijsten, statusmapping en beheerdispatch combineert en veel secties statisch importeert. Ook configuratie- en gebruikersbeheer zijn respectievelijk circa 2.864 en 2.049 regels. Domein- en routegrenzen zijn daardoor geen duidelijke laad-, fout- of testgrenzen.

**Verwachte of gewenste situatie**

Pagina's en domeinen horen eigen routecomponenten/layouts te hebben met server-side data/autorisatie, gerichte clientislands en lazy boundaries. Gedeelde businesslogica blijft in geteste services, niet in één centrale UI-file.

**Waarom dit een probleem is**

Elke wijziging heeft een grote regressie- en mergeblast radius. Statische imports vergroten de clientbundel en een fout in één domein kan compilatie/hydratatie van andere schermen beïnvloeden. Review en gerichte testdekking worden onnodig moeilijk.

**Stappen om vast te stellen of te reproduceren**

1. Meet regels en bytes van de drie componenten.
2. Volg `WorkspacePage`-routebranches en de statische imports bovenaan.
3. Bouw/analyseer per route de clientchunks en observeer gedeelde code uit ongerelateerde schermen.

**Technische vaststelling**

Routekeuze gebeurt grotendeels na hydratatie in één `"use client"`-bestand. Hierdoor kan Next.js minder natuurlijke route-/servercomponentgrenzen benutten en blijft autorisatie gekoppeld aan dezelfde clientdispatch.

**Bewijs**

- Bestand: `components/workspace-pages.tsx`, `components/configuration-management.tsx`, `components/user-management.tsx`
- Regel of codeblok: volledige bestanden; route-dispatch rond workspace regels 200-280
- Route: generieke werkruimteroutes
- Scherm: meerdere routes op localhost gecontroleerd
- Log: domeinvreemde SalesDay-fout op Coaching bevestigt de brede koppeling
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/01_ARCHITECTURE.md`, `docs/ai/05_DEVELOPMENT_STANDARDS.md`

**Voorgestelde aanpassing**

Splits incrementeel langs bestaande route-/domeingrenzen: eerst server-side routecatalogus, daarna layouts en per pagina een klein entrycomponent. Verplaats pure mappers/calculaties naar geteste modules en meet chunks vóór/na elke stap.

**Acceptatiecriteria**

- [ ] Elk hoofddomein heeft een eigen layout en fout-/laadgrens.
- [ ] Beschermde data en routeautorisatie gebeuren vóór clienthydratatie.
- [ ] Een route laadt geen code voor ongerelateerde beheer-/domeinschermen.
- [ ] Pure berekeningen zijn buiten React componenten getest.
- [ ] Bundelgrootte en regressiedekking zijn meetbaar verbeterd.

**Risico bij niet aanpassen**

Ontwikkelsnelheid, reviewkwaliteit en runtimeprestaties verslechteren verder naarmate nieuwe modules worden toegevoegd.

**Afhankelijkheden**

- REV-0001 voor server-side routecatalogus
- REV-0011 voor provideropsplitsing

**Gerelateerde bevindingen**

- REV-0001
- REV-0011
- REV-0032

#### REV-0034 — Onbekende of onbevoegde routes hebben geen echte 404/403-pagina

- **Module:** Algemene applicatiestructuur
- **Submodule:** Routefouten en statuscodes
- **Scherm/pagina:** Onbekende route en geweigerde pagina
- **Route:** Generieke catch-all
- **Component/bestand:** `app/[...slug]/page.tsx`, `components/workspace-pages.tsx`, `app/error.tsx`
- **Functie/API/model:** fallback `PlaceholderWorkspace`
- **Type:** UX / SECURITY / API
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle gebruikers
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

Er is geen `app/not-found.tsx`, `forbidden.tsx` of uniforme 403-component. De generieke catch-all accepteert ieder slugpad en de clientdispatch eindigt voor onbekende paden in een geloofwaardige 'Pagina in voorbereiding'-placeholder. Een niet-bestaande URL kan daardoor HTTP 200 opleveren; toegangsweigering gebruikt verspreide `EmptyState`-teksten zonder consistente status.

**Verwachte of gewenste situatie**

Onbekende routes moeten server-side 404 geven. Bestaande maar onbevoegde routes moeten een consistente, niet-lekkende 403/404-keuze volgen met juiste HTTP-semantiek, herstelactie en vertaling.

**Waarom dit een probleem is**

Gebruikers en monitoring kunnen een typfout niet onderscheiden van geplande functionaliteit. Crawlers, support en securitytests zien valse successen en routeautorisatie wordt nog meer een clientpresentatiekwestie.

**Stappen om vast te stellen of te reproduceren**

1. Open een willekeurige aangemelde URL zoals `/bestaat-niet-xyz`.
2. Observeer de placeholder in plaats van een 404.
3. Zoek onder `app` naar `not-found`/forbidden; alleen error boundaries bestaan.

**Technische vaststelling**

De catch-allservercomponent valideert geen routecatalogus. De clientcomponent kent een generieke fallback en Next.js krijgt daardoor geen `notFound()`-signaal.

**Bewijs**

- Bestand: `app/[...slug]/page.tsx`, `components/workspace-pages.tsx`, `app/error.tsx`
- Regel of codeblok: catch-all regels 1-11 en laatste fallback in `WorkspacePage`
- Route: willekeurig onbekend pad
- Scherm: Inventory-onbekende dispatch liet dezelfde placeholder zien
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/04_UI_GUIDELINES.md`

**Voorgestelde aanpassing**

Gebruik de centrale routecatalogus server-side en roep `notFound()` aan voor onbekende routes. Voeg vertaalde not-found/forbiddenpagina's toe en kies één beleid voor gevoelige resources. Test statuscode én zichtbare inhoud.

**Acceptatiecriteria**

- [ ] Iedere onbekende URL retourneert HTTP 404.
- [ ] Bestaande onbevoegde routes volgen de gedocumenteerde 403/404-policy.
- [ ] Placeholders bestaan alleen voor expliciet geregistreerde roadmaproutes.
- [ ] Foutpagina's zijn NL/FR/DE, keyboardtoegankelijk en bieden veilige navigatie.
- [ ] Routecontracttests controleren status en inhoud.

**Risico bij niet aanpassen**

Monitoring rapporteert valse successen en gebruikers/securityreviewers kunnen routebestaan en autorisatie niet betrouwbaar interpreteren.

**Afhankelijkheden**

- Routecatalogus uit REV-0001
- UX-besluit over 403 versus 404

**Gerelateerde bevindingen**

- REV-0001
- REV-0045

#### REV-0027 — Rich-textsanitatie en editors zijn handgemaakt en onderling verschillend

- **Module:** Algemene applicatiestructuur
- **Submodule:** Rich text en HTML-rendering
- **Scherm/pagina:** Coaching, Contactmomenten, Hulpaanvragen, starterevaluaties en configuratie
- **Route:** Meerdere
- **Component/bestand:** `lib/rich-text.ts`, `components/rich-text-editor.tsx`, `components/contact-help-workflows.tsx`, `components/configuration-management.tsx`, `components/workspace-pages.tsx`
- **Functie/API/model:** `sanitizeRichText`, lokale contentEditable-editors, `document.execCommand`
- **Type:** SECURITY / TECHNISCH / UX
- **Prioriteit:** P3
- **Status:** Te onderzoeken
- **Zekerheid:** Bevestigde architectuurrisico; geen concrete XSS-bypass aangetoond
- **Rollen:** Alle rich-textauteurs en lezers
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse

**Huidige situatie**

De centrale sanitizer gebruikt regexvervanging en een eigen allowlist. De huidige basis blokkeert bekende script-/iframe-/eventattributen en normaliseert links, maar HTML-parsing met regex blijft kwetsbaar voor parserafwijkingen en vraagt voortdurende securitykennis. Daarnaast bestaan meerdere lokale `contentEditable`-editors; sommige saniteren pas bij blur, de configuratie-editor geeft ruwe `innerHTML` door. Alle gebruiken het deprecated `document.execCommand`.

**Verwachte of gewenste situatie**

Eén bewezen, actief onderhouden sanitizer met expliciete server-side policy hoort alle opslag en rendering te beschermen. Eén toegankelijke editor levert een begrensd, getest formaat en dezelfde normalisatie in elke module.

**Waarom dit een probleem is**

Verschillende invoer- en sanitize-momenten maken het moeilijk te bewijzen dat opgeslagen HTML overal veilig en consistent is. Browserparser-edgecases, nieuwe tags/protocollen of editorwijzigingen kunnen regressies introduceren.

**Stappen om vast te stellen of te reproduceren**

1. Inventariseer alle `contentEditable`, `innerHTML` en `dangerouslySetInnerHTML`-plaatsen.
2. Vergelijk wanneer elke editor `sanitizeRichText` toepast.
3. Voer een sanitizerfuzzset uit met malformed HTML, entities, namespaces, protocollen en geneste tags.
4. Controleer serveropslag én rendering, niet alleen de editorpreview.

**Technische vaststelling**

`sanitizeRichText` parseert tags met regex en reconstrueert een subset. Renderer saniteert opnieuw, maar configuratie en lokale editors hebben afwijkende flows. Geen gespecialiseerde HTML-parser/sanitizerdependency is aanwezig.

**Bewijs**

- Bestand: `lib/rich-text.ts`, genoemde editorcomponenten
- Regel of codeblok: sanitizer regels 1-42; `document.execCommand` onder meer workspace 3565, contact-help 1165 en configuration 2814
- Route: meerdere rich-textflows
- Scherm: niet met aanvalspayloads gemuteerd
- Log: niet van toepassing
- Query: serverworkflows saniteren meerdere velden bij persistence
- Gerelateerde documentatie: `docs/ai/05_DEVELOPMENT_STANDARDS.md`

**Voorgestelde aanpassing**

Laat een securityreview/fuzzsuite de huidige policy toetsen en migreer zo nodig naar een servercompatibele, parsergebaseerde sanitizer. Centraliseer editor, opslagformaat, limieten en plain-textconversie; sanitize altijd server-side vóór opslag en defensief bij rendering.

**Acceptatiecriteria**

- [ ] Eén sanitizerpolicy geldt voor alle rich-textvelden.
- [ ] Server-side opslag vertrouwt nooit op client blur/input.
- [ ] Een uitgebreide XSS/malformed-HTML-corpus passeert in Node en browsers.
- [ ] Links, entities, lijsten en meertalige tekst behouden de bedoelde inhoud.
- [ ] De gedeelde editor is keyboard- en screenreadertoegankelijk zonder deprecated commando's.

**Risico bij niet aanpassen**

Een toekomstige parser- of editorregressie kan opgeslagen XSS, inconsistente HTML of verloren inhoud veroorzaken.

**Afhankelijkheden**

- Securitykeuze voor sanitizer/editor
- Migratiebehandeling van bestaande opgeslagen HTML

**Gerelateerde bevindingen**

- REV-0007
- REV-0022
- REV-0049

#### REV-0045 — PST en Service worden als navigeerbare applicaties aangeboden zonder businessspecificatie of functionaliteit

- **Module:** Algemene applicatiestructuur
- **Submodule:** Applicatieswitcher en roadmaproutes
- **Scherm/pagina:** PST en Service
- **Route:** `/pst/*`, `/service/*`
- **Component/bestand:** `lib/app-switcher.ts`, `components/workspace-pages.tsx`, `docs/business/PST` niet aanwezig en lege businessdocumenten
- **Functie/API/model:** `appDefinitions`, `PlaceholderWorkspace`
- **Type:** FUNCTIONEEL / UX / DOCUMENTATIE
- **Prioriteit:** P2
- **Status:** Beslissing vereist
- **Zekerheid:** Bevestigd
- **Rollen:** Rollen die via configuratie toegang krijgen
- **Land/teamcontext:** Globaal
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

De app-switcher definieert PST met vijf routes en Service met drie routes, elk beschreven als 'Tijdelijke route'. De generieke werkruimte toont alleen dat de module later wordt geïntegreerd. Er is geen uitgewerkte businessbron voor beide domeinen; `docs/business/Service.md` is leeg en een PST-businessdocument ontbreekt. Toch kunnen module-/menurechten de links zichtbaar maken.

**Verwachte of gewenste situatie**

Niet-geïmplementeerde applicaties blijven server-side niet beschikbaar in productie, of worden expliciet als niet-interactieve roadmapcommunicatie buiten operationele navigatie getoond. Implementatie start pas na een owning specificatie.

**Waarom dit een probleem is**

Gebruikers zien functies waarvoor rechten en routes bestaan maar geen taak kan worden uitgevoerd. Dat geeft foutieve releaseverwachtingen en maakt 404/placeholdersemantiek onduidelijk.

**Stappen om vast te stellen of te reproduceren**

1. Activeer PST of Service voor een testscope.
2. Open hun menu-items.
3. Observeer dat alle routes dezelfde placeholder tonen.
4. Zoek owning businessdocumentatie; die is leeg of afwezig.

**Technische vaststelling**

`appDefinitions` maakt concrete navigatieitems. `WorkspacePage` dispatcht PST en Service rechtstreeks naar `PlaceholderWorkspace` zonder functionele sectiecomponent.

**Bewijs**

- Bestand: `lib/app-switcher.ts`, `components/workspace-pages.tsx`, `docs/business/Service.md`
- Regel of codeblok: app-switcher rond regels 360-405; workspace dispatch rond regels 240-250
- Route: `/pst/*`, `/service/*`
- Scherm: codepad bevestigd; modules niet geactiveerd in localhostsession
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/00_PROJECT.md`, lege `docs/business/*`

**Voorgestelde aanpassing**

Maak beschikbaarheid afhankelijk van een server-side releaseflag die standaard false is en verwijder operationele menu-items tot specificatie, rights matrix, API en kernflow zijn geaccepteerd. Documenteer roadmap buiten de taaknavigatie.

**Acceptatiecriteria**

- [ ] Productiegebruikers kunnen geen placeholderapp activeren of openen.
- [ ] Iedere toekomstige app heeft een eigenaar en goedgekeurde businessspecificatie.
- [ ] Menu, directe route en API worden samen vrijgegeven.
- [ ] Roadmapcommunicatie is duidelijk onderscheiden van werkende functionaliteit.

**Risico bij niet aanpassen**

Onvoltooide modules worden als productfunctie geïnterpreteerd en verhogen support- en acceptatierisico.

**Afhankelijkheden**

- Product-/roadmapbesluit PST en Service
- Routecatalogus en releaseflags

**Gerelateerde bevindingen**

- REV-0034
- REV-0030

### 2. Authenticatie en gebruikerssessies

#### REV-0009 — Credential-login heeft geen begrenzing van mislukte aanmeldpogingen

- **Module:** Authenticatie en gebruikerssessies
- **Submodule:** Lokale credential-authenticatie
- **Scherm/pagina:** Aanmeldscherm
- **Route:** `/login`, NextAuth credentials-callback
- **Component/bestand:** `auth.ts`, `lib/server/password.ts`, `app/login/page.tsx`
- **Functie/API/model:** `Credentials.authorize`, `verifyPassword`
- **Type:** SECURITY / LOGGING
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle gebruikers met lokale credentials
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse

**Huidige situatie**

De credentials-provider zoekt bij elke poging een gebruiker op en voert voor een bestaande actieve gebruiker een scrypt-verificatie uit. Er is geen rate limiting per IP/account, progressieve vertraging, tijdelijke accountvergrendeling, CAPTCHA-drempel of registratie van mislukte pogingen. Alleen geslaagde sessieactiviteit krijgt een auditpad.

**Verwachte of gewenste situatie**

Een publiek aanmeldpunt moet online gokpogingen begrenzen zonder accountenumeratie te introduceren. Mislukte pogingen horen veilig en privacybewust meetbaar te zijn, met uniforme foutmeldingen en een beheersbaar herstelpad.

**Waarom dit een probleem is**

Een aanvaller kan onbeperkt wachtwoorden proberen tegen bekende of geraden e-mailadressen. Scrypt verhoogt de kost per poging, maar is geen vervanging voor server-side misbruikbeperking en kan bij grote aantallen bovendien CPU-capaciteit uitputten.

**Stappen om vast te stellen of te reproduceren**

1. Inspecteer de credentials-`authorize`-functie in `auth.ts`.
2. Volg opeenvolgende ongeldige wachtwoordpogingen voor hetzelfde account.
3. Stel vast dat geen teller, blokkade of vertraging wordt geraadpleegd of opgeslagen.

**Technische vaststelling**

`authorize` normaliseert e-mail en wachtwoord, leest `passwordHash` en roept `verifyPassword` aan. De code bevat geen mislukte-loginmodel of rate-limitservice; de repositoryzoektocht levert alleen sessieactiviteit voor geldige sessies op.

**Bewijs**

- Bestand: `auth.ts`, `lib/server/password.ts`, `app/api/auth/activity/route.ts`
- Regel of codeblok: `auth.ts` regels 38-70; scryptverificatie in `password.ts`
- Route: `/login`
- Scherm: niet met herhaalde pogingen belast om ongewenste authenticatiebelasting te vermijden
- Log: geen mislukte-loginregistratie gevonden
- Query: per poging een gebruikerslookup; geen rate-limitquery
- Gerelateerde documentatie: `docs/technical/ENTRA_AUTH.md`, `docs/ai/05_DEVELOPMENT_STANDARDS.md`

**Voorgestelde aanpassing**

Voeg een gedeelde rate limiter toe op een combinatie van gehashte accountidentifier en betrouwbare clientbron, met korte en langere vensters, generieke antwoorden en begrensde auditmetadata. Leg unlock, monitoring, reverse-proxyvertrouwen en Entra-versus-local gedrag vast.

**Acceptatiecriteria**

- [ ] Herhaalde mislukte pogingen worden aantoonbaar vertraagd of tijdelijk geweigerd.
- [ ] Bestaande en niet-bestaande accounts geven hetzelfde externe foutgedrag.
- [ ] Logs bevatten geen wachtwoord, hash of onnodig volledig IP-adres.
- [ ] Een legitieme gebruiker heeft een gedocumenteerd herstel- of unlockpad.
- [ ] Tests dekken vensterverloop, parallelle pogingen en meerdere applicatie-instances.

**Risico bij niet aanpassen**

Credential stuffing, brute force en CPU-uitputting blijven mogelijk op het publieke aanmeldpunt.

**Afhankelijkheden**

- Gedeelde opslag voor rate-limitstatus in een multi-instanceomgeving
- Securitybesluit over bewaartermijn en unlockbeleid

**Gerelateerde bevindingen**

- REV-0020
- REV-0041

#### REV-0020 — Nieuw aangemaakte credentialgebruikers hebben geen bruikbaar wachtwoordproces

- **Module:** Authenticatie en gebruikerssessies
- **Submodule:** Accountprovisioning en wachtwoordbeheer
- **Scherm/pagina:** Beheer — Gebruikers en aanmeldscherm
- **Route:** `/beheer/gebruikers`, `/login`
- **Component/bestand:** `components/user-management.tsx`, `lib/server/users.ts`, `scripts/set-user-password.ts`, `package.json`
- **Functie/API/model:** `createManagedUserInDatabase`, `Credentials.authorize`, `auth:set-password`
- **Type:** FUNCTIONEEL / UX / SECURITY
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Admin, Super Admin en nieuw aangemaakte gebruikers
- **Land/teamcontext:** Alle landen
- **Omgeving:** Codeanalyse

**Huidige situatie**

Het beheerscherm kan een gebruiker aanmaken, maar de createflow vult geen `passwordHash`. Er is geen uitnodigingsmail, eenmalige activatielink, wachtwoord-instellen-scherm, resetflow of beheeractie. Alleen een operatorscript met omgevingsvariabelen kan buiten de UI een hash instellen. Een lokale gebruiker zonder Microsoft-identiteit kan daardoor niet aanmelden totdat iemand handmatig servertoegang gebruikt.

**Verwachte of gewenste situatie**

De gekozen authenticatiestrategie moet per gebruiker expliciet zijn. Voor lokale credentials hoort een veilige, verlopen eenmalige activatie/resetflow te bestaan; als uitsluitend Entra bedoeld is, mag de UI geen onbruikbaar lokaal account suggereren.

**Waarom dit een probleem is**

Accountaanmaak lijkt succesvol maar levert geen zelfstandig bruikbaar account op. Handmatige wachtwoordprovisioning is foutgevoelig, slecht auditeerbaar en stimuleert onveilige overdracht van wachtwoorden.

**Stappen om vast te stellen of te reproduceren**

1. Maak in codeanalyse een gebruiker via `createManagedUserInDatabase`.
2. Controleer `userDataFromManagedUser` en het Prismaresultaat op `passwordHash`.
3. Volg daarna de credential-loginvoorwaarde in `auth.ts`; zonder hash wordt altijd geweigerd.
4. Zoek in UI en API naar uitnodigen, activeren of resetten; alleen het CLI-script bestaat.

**Technische vaststelling**

`User.passwordHash` is optioneel en wordt niet door gebruikersbeheer geschreven. `Credentials.authorize` vereist een niet-lege hash. `package.json` exposeert `auth:set-password`, maar dit is geen eindgebruikers- of beheersworkflow.

**Bewijs**

- Bestand: `lib/server/users.ts`, `auth.ts`, `scripts/set-user-password.ts`, `package.json`
- Regel of codeblok: usercreate rond regels 34-60; loginvoorwaarden rond `auth.ts` regels 44-68; scriptentry `auth:set-password`
- Route: `/beheer/gebruikers`, `/login`
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: `prisma.user.create` zonder `passwordHash`
- Gerelateerde documentatie: `docs/technical/ENTRA_AUTH.md`

**Voorgestelde aanpassing**

Beslis eerst of lokale credentials productiefunctionaliteit zijn. Implementeer zo ja een gehashte, eenmalige, kortlevende activatietokenflow met generieke antwoorden, intrekking, audit en forced password set; voeg daarna reset en beheerbare deactivatie toe. Toon de authenticatiemethode en activatiestatus in gebruikersbeheer.

**Acceptatiecriteria**

- [ ] Iedere aangemaakte gebruiker heeft een expliciete authenticatiemethode en zichtbare activatiestatus.
- [ ] Een lokale gebruiker kan zonder serveroperator veilig activeren en later resetten.
- [ ] Tokens zijn eenmalig, verlopen, alleen gehasht opgeslagen en worden na gebruik ingetrokken.
- [ ] Geen beheerder hoeft een eindgebruikerswachtwoord te kennen of te versturen.
- [ ] Entra-only accounts krijgen geen misleidende credentialflow.

**Risico bij niet aanpassen**

Nieuwe accounts blijven onbruikbaar of worden via ad-hoc, moeilijk auditeerbare wachtwoordoverdracht geactiveerd.

**Afhankelijkheden**

- Besluit over Entra-only versus hybride authenticatie
- Mailconfiguratie en veilige publieke basis-URL

**Gerelateerde bevindingen**

- REV-0009
- REV-0021

### 3. Dashboard

#### REV-0046 — KPI- en prestatiebeelden hebben geen productiepad voor actuele resultaatdata

- **Module:** Dashboard
- **Submodule:** KPI-resultaten en prestatiecirkel
- **Scherm/pagina:** Dashboard, Mijn Team-fiche, Prestatiecirkel en rapportage
- **Route:** `/dashboard`, `/mijn-team`, performance-API
- **Component/bestand:** `lib/server/performance.ts`, `prisma/seed.ts`, `app/api/performance/route.ts`
- **Functie/API/model:** `loadMonthlyKpiSnapshots`, `KpiSnapshot`
- **Type:** FUNCTIONEEL / DATA / INTEGRATIE
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Vertegenwoordiger en managementrollen
- **Land/teamcontext:** Gebruiker, team en land
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

Dashboard en prestatiecomponenten lezen maandresultaten uit `KpiSnapshot`. In de hele runtimecode is geen import-, synchronisatie-, berekenings- of beheerflow gevonden die zulke snapshots aanmaakt of actualiseert. Alleen `prisma/seed.ts` schrijft vaste waarden met bronnen `seed-demo` en `config-seed`. In een productieomgeving zonder demoseed blijven de beelden dus leeg of tonen zij handmatig/oud aanwezige data zonder freshnesssignaal.

**Verwachte of gewenste situatie**

Voor iedere KPI moet de bron, formule, meetperiode, importfrequentie, reconciliatie, verantwoordelijke en zichtbaar tijdstip van laatste succesvolle update vastliggen. Productiedata hoort via een idempotent, controleerbaar pad te worden ingelezen of berekend.

**Waarom dit een probleem is**

Prestatiecijfers sturen coaching, actiepunten en managementbeslissingen. Een professioneel ogende grafiek zonder betrouwbare actuele bron kan meer schade veroorzaken dan een expliciet niet-beschikbare indicator.

**Stappen om vast te stellen of te reproduceren**

1. Zoek alle schrijfacties op `KpiSnapshot` buiten tests en seeds.
2. Stel vast dat runtimecode alleen leest.
3. Start met een productieachtige database zonder demosnapshots en open dashboard/prestatiecirkel.
4. Controleer dat geen updateactie, brondatum of datakwaliteitsmelding beschikbaar is.

**Technische vaststelling**

`loadMonthlyKpiSnapshots` doet uitsluitend `findMany` en normalisatie. De enige `create`/`upsert`-hits staan in `prisma/seed.ts`; het datamodel bevat wel `source`, maar geen actuele ingestieservice of job in de repository.

**Bewijs**

- Bestand: `lib/server/performance.ts`, `prisma/seed.ts`, `app/api/performance/route.ts`
- Regel of codeblok: performance reads rond regels 365-433; seedwrites rond regels 300-325 en 800-850
- Route: `/api/performance`
- Scherm: dashboard op localhost gecontroleerd; bronactualisatie niet uitgevoerd
- Log: geen KPI-importjob gevonden
- Query: alleen runtime `KpiSnapshot.findMany`; writes uitsluitend in seed
- Gerelateerde documentatie: `docs/ai/02_DATABASE.md` vereist gedocumenteerde formules en brondata; `docs/ai/modules/Coaching/Rapportage.md`

**Voorgestelde aanpassing**

Ontwerp per KPI een versieerbaar sourcecontract en een idempotente ingestie-/berekeningsjob met periodeafsluiting, correcties, lineage en monitoring. Toon bron, periode en laatste succesvolle update in UI/export en voorkom dat demo-/configseedwaarden in productie als actuele cijfers gelden.

**Acceptatiecriteria**

- [ ] Iedere actieve KPI heeft een goedgekeurde bron en reproduceerbare formule.
- [ ] Productiesnapshots worden buiten seed via een idempotent pad aangemaakt.
- [ ] UI en export tonen meetperiode, bron/freshness en een duidelijke stale/ontbreekt-status.
- [ ] Reconciliatie en correcties bewaren historische herleidbaarheid.
- [ ] Tests dekken lege bron, dubbele import, correctie en te late data.

**Risico bij niet aanpassen**

Management en coaches kunnen sturen op lege, verouderde of fictieve prestatiecijfers.

**Afhankelijkheden**

- Besluit over ERP/BI/bronsystemen per KPI
- Scheduling, monitoring en datakwaliteitsbeheer

**Gerelateerde bevindingen**

- REV-0014
- REV-0041

### 4. Planning

#### REV-0035 — Planning presenteert verzonnen datums en tijdstippen als echte afspraken

- **Module:** Planning
- **Submodule:** Kalendernormalisatie
- **Scherm/pagina:** Dag-, week- en maandkalender
- **Route:** `/planning`
- **Component/bestand:** `components/planning-calendar.tsx`
- **Functie/API/model:** `parseDate`, `deterministicHour`, `hourFromTime`, `events`
- **Type:** FUNCTIONEEL / DATA / UX
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle rollen met Planning
- **Land/teamcontext:** Persoonlijke en zichtbare teamplanning
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

Wanneer een record geen geldige datum heeft, valt `parseDate` terug op de datum waarop de module is geladen. Wanneer een starttijd ontbreekt, berekent `deterministicHour` uit het record-id een schijnbaar echt uur tussen 08:00 en 16:59. Retrainingen, salestrainingen en hulpaanvragen krijgen altijd zo'n afgeleid uur; ontbrekende eindtijden krijgen standaard één uur duur. De kalender markeert deze waarden niet als onbekend of benaderd.

**Verwachte of gewenste situatie**

Planning mag alleen opgeslagen of uitdrukkelijk afgeleide businesswaarden als een afspraakpositie tonen. Records zonder datum/tijd horen in een aparte 'nog in te plannen'-zone, als all-day/onbepaald gemarkeerd, of volgens een gedocumenteerde regel te worden geweigerd.

**Waarom dit een probleem is**

Een medewerker kan een willekeurig geplaatst item aanzien voor een echte afspraak en daarop reizen, klanten informeren of andere bezoeken plannen. Bij een ongeldige datum verschuift een oud of defect record zelfs ongemerkt naar vandaag.

**Stappen om vast te stellen of te reproduceren**

1. Neem een zichtbaar workflowrecord zonder `startTime` of met een niet-herkende datum.
2. Open `/planning` en zoek het item.
3. Observeer dat het op een exact uur en eventueel vandaag staat zonder waarschuwing.
4. Wijzig alleen het record-id in een testfixture en zie dat het weergegeven uur verandert.

**Technische vaststelling**

De eventmappers gebruiken herhaaldelijk `hourFromTime(...) ?? deterministicHour(item.id)`. Trainingen en hulpaanvragen roepen direct `deterministicHour` aan. `parseDate` retourneert bij iedere onbekende invoer `new Date(REFERENCE_DATE)`.

**Bewijs**

- Bestand: `components/planning-calendar.tsx`
- Regel of codeblok: regels 107-143, 167-174 en 287-390
- Route: `/planning`
- Scherm: kalenderweergave op localhost gecontroleerd; geen data gemuteerd
- Log: niet van toepassing
- Query: workflowstate levert datum-/tijdvelden; client verzint ontbrekende presentatiewaarden
- Gerelateerde documentatie: `docs/ai/modules/Coaching/Planning.md`

**Voorgestelde aanpassing**

Maak datum en tijd expliciete genormaliseerde kalendercontracts. Sla onbekende waarden niet stilzwijgend om, maar retourneer een typed validatieresultaat en toon onvolledige items apart met een duidelijke status. Blokkeer waar de workflow een tijd verplicht stelt al bij invoer.

**Acceptatiecriteria**

- [ ] Geen kalenderitem krijgt een datum of tijd uit zijn id of uit een stille fallback.
- [ ] Onvolledige records zijn herkenbaar en kunnen niet als exacte afspraak worden gelezen.
- [ ] Ongeldige datums produceren een zichtbare datakwaliteitsmelding en telemetry.
- [ ] Tests dekken ontbrekende, ongeldige en geldige datum-/tijdcombinaties.
- [ ] De owning workflowdocumenten leggen vast welke velden verplicht zijn.

**Risico bij niet aanpassen**

Gebruikers nemen operationele beslissingen op basis van fictieve afspraken en defecte data blijft verborgen.

**Afhankelijkheden**

- Businessbesluit over ongetimede workflowitems
- Runtimevalidatie uit REV-0007

**Gerelateerde bevindingen**

- REV-0036
- REV-0014

#### REV-0036 — Outlook-kalender kan onbeperkt blijven laden en kapt resultaten na 250 af

- **Module:** Planning
- **Submodule:** Microsoft Graph-integratie
- **Scherm/pagina:** Planning
- **Route:** `/planning`, `GET /api/outlook/events`
- **Component/bestand:** `components/planning-calendar.tsx`, `lib/server/microsoft-graph.ts`
- **Functie/API/model:** `listOutlookCalendarEvents`, `graphRequest`
- **Type:** INTEGRATIE / FUNCTIONEEL / UX / PERFORMANCE
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Gebruikers met Microsoft-agendatoegang
- **Land/teamcontext:** Persoonlijk
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

De client gebruikt wel een `AbortController` bij routewissel, maar heeft geen tijdslimiet. De serverfetch naar Graph heeft evenmin een timeout. Op localhost bleef 'Outlook-agenda laden…' langer dan dertien seconden staan. Daarnaast vraagt de server maximaal 250 kalenderitems en verwerkt hij geen `@odata.nextLink`, zodat drukke perioden stilzwijgend onvolledig zijn.

**Verwachte of gewenste situatie**

Externe calls moeten een begrensde responstijd, gecontroleerde retry en duidelijke degraded state hebben. Alle pagina's van een ondersteunde periode worden opgehaald of de UI meldt expliciet dat resultaten begrensd zijn.

**Waarom dit een probleem is**

Een trage Graph-call kan serverresources en de laadstatus onbegrensd vasthouden. Afgekapt resultaat kan dubbele boekingen veroorzaken omdat bestaande Outlook-afspraken ontbreken zonder waarschuwing.

**Stappen om vast te stellen of te reproduceren**

1. Open `/planning` met een Microsoft-sessie terwijl Graph traag of onbereikbaar is.
2. Observeer de blijvende laadmelding zonder time-outmelding.
3. Gebruik een testagenda met meer dan 250 events binnen het gevraagde bereik.
4. Stel vast dat alleen `payload.value` van de eerste response wordt gemapt.

**Technische vaststelling**

`graphRequest` roept `fetch` zonder `signal` of deadline aan. `listOutlookCalendarEvents` zet `$top` op 250 en typeert de response alleen als `{ value: GraphEvent[] }`; een vervolglink wordt niet gelezen.

**Bewijs**

- Bestand: `lib/server/microsoft-graph.ts`, `components/planning-calendar.tsx`
- Regel of codeblok: Graphlijst regels 75-102; fetch rond regels 323-344; clienteffect rond regels 260-283
- Route: `/planning`, `/api/outlook/events`
- Scherm: laadmelding bleef tijdens de localhostcontrole zichtbaar
- Log: geen afgeronde Graph-response in de gecontroleerde periode
- Query: Microsoft Graph `/me/calendarView` met `$top=250`
- Gerelateerde documentatie: `docs/technical/ENTRA_AUTH.md`, `docs/ai/modules/Coaching/Planning.md`

**Voorgestelde aanpassing**

Voeg een server-side deadline toe met `AbortSignal.timeout` of een samengestelde controller, classificeer timeoutfouten en toon FieldForce-data direct met een afzonderlijke Outlook-waarschuwing. Volg `@odata.nextLink` met een maximaal paginabudget en log/communiceer truncatie.

**Acceptatiecriteria**

- [ ] Een Graph-call eindigt binnen een gedocumenteerde maximale tijd.
- [ ] FieldForce-planning blijft bruikbaar tijdens Outlook-storing.
- [ ] Meer dan 250 events worden gepagineerd of zichtbaar als onvolledig gemarkeerd.
- [ ] Retries zijn begrensd en respecteren 429/`Retry-After`.
- [ ] Integratietests dekken timeout, 401, 429, 5xx en meerdere pagina's.

**Risico bij niet aanpassen**

Gebruikers zien een eindeloze laadstatus of onvolledige agenda en kunnen afspraken missen of dubbel plannen.

**Afhankelijkheden**

- Microsoft Graph-fout- en retrybeleid
- Observability voor externe afhankelijkheden

**Gerelateerde bevindingen**

- REV-0035
- REV-0046

### 5. Begeleidingen

#### 5.1 Overzicht begeleidingen

#### REV-0016 — Begeleidingen toont vóór hydratatie een geloofwaardig maar fout leeg resultaat

- **Module:** Begeleidingen
- **Submodule:** Overzicht en initiële datastatus
- **Scherm/pagina:** Begeleidingenoverzicht
- **Route:** `/begeleidingen`
- **Component/bestand:** `components/workflow-provider.tsx`, `components/workspace-pages.tsx`
- **Functie/API/model:** `WorkflowProvider`, `InterventionList`, `hydrated`
- **Type:** UX / FUNCTIONEEL / DATA
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle rollen met zicht op begeleidingen
- **Land/teamcontext:** Eigen of effectieve scope
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

De workflowprovider start met lege arrays en houdt intern bij of serverstate is gehydrateerd. Het overzicht gebruikt die `hydrated`-status niet voor de resultaatweergave. Tijdens de browsercontrole verscheen daardoor circa tien seconden lang '0' en 'nog geen begeleidingen'; daarna sprong hetzelfde scherm naar tien echte records.

**Verwachte of gewenste situatie**

Zolang de eerste fetch loopt moet het scherm een duidelijke loading/skeleton-status tonen. Een lege staat mag pas verschijnen na een geslaagde, geautoriseerde response met daadwerkelijk nul records; een fout hoort een aparte herstelbare foutstatus te zijn.

**Waarom dit een probleem is**

De tijdelijke boodschap is semantisch onjuist en kan gebruikers laten besluiten dat dossiers ontbreken, opnieuw records laten aanmaken of het scherm verlaten. Trage verbindingen vergroten de kans.

**Stappen om vast te stellen of te reproduceren**

1. Open `/begeleidingen` na een harde navigatie of met vertraagd netwerk.
2. Observeer teller en lege-state vóór afronding van `/api/workflows`.
3. Wacht op de response en zie dat echte records dezelfde lege melding vervangen.

**Technische vaststelling**

De providerinitialisatie bevat lege collecties en een afzonderlijke `hydrated`-boolean. De lijstfilters draaien onmiddellijk op die lege state en renderen het normale nulresultaat.

**Bewijs**

- Bestand: `components/workflow-provider.tsx`, `components/workspace-pages.tsx`
- Regel of codeblok: initiële state/fetch rond providerregels 120-180; overzicht gebruikt zichtbare collecties zonder initiële loading guard
- Route: `/begeleidingen`
- Scherm: eerst 0/lege historie, later 10 records in dezelfde localhostsessie
- Log: tegelijkertijd liep de workflowrequest
- Query: `GET /api/workflows`
- Gerelateerde documentatie: `docs/ai/modules/Coaching/Begeleidingen.md`, `docs/ai/04_UI_GUIDELINES.md`

**Voorgestelde aanpassing**

Maak de providerstatus een discriminated union (`idle/loading/success-empty/success-data/error`) en laat iedere consumer die expliciet afhandelen. Bewaar eventueel laatst geldige data tijdens refetch en koppel fouten aan een retryactie.

**Acceptatiecriteria**

- [ ] De lege staat verschijnt uitsluitend na een succesvolle response met nul records.
- [ ] Initiële laad-, refetch- en foutstatus zijn visueel en semantisch verschillend.
- [ ] Bestaande data verdwijnt niet naar een lege staat tijdens achtergrondverversing.
- [ ] Een componenttest simuleert trage, lege, gevulde en mislukte responses.

**Risico bij niet aanpassen**

Gebruikers interpreteren netwerkvertraging of een API-fout als ontbrekende businessdata.

**Afhankelijkheden**

- Provideropsplitsing uit REV-0011
- Uniform async-statepatroon

**Gerelateerde bevindingen**

- REV-0011
- REV-0013

#### 5.2 Nieuwe begeleiding plannen

#### 5.3 Stap 1 — Algemene gegevens

#### 5.4 Stap 2 — Voorbereiding

#### 5.5 Stap 3 — Evaluatie algemene punten

#### 5.6 Stap 4 — Evaluatie persoonlijkheid

#### 5.7 Stap 5 — Afspraken

#### 5.8 Stap 6 — Actiepunten

#### 5.9 Afsluiten en versturen

#### 5.10 Voor-akkoordflow

#### 5.11 PDF begeleiding

### 6. Voorbereiding van klantenbezoeken

### 7. Contactmomenten

#### REV-0026 — Contactfotobestanden en databasewijzigingen zijn niet atomair

- **Module:** Contactmomenten
- **Submodule:** Foto-upload en verwijderen
- **Scherm/pagina:** Contactmomentdetail
- **Route:** Contactmomentfoto-upload- en delete-API
- **Component/bestand:** `lib/server/contact-moment-photos.ts`, bijbehorende API-routes
- **Functie/API/model:** opslag, `photosJson`-update en bestandsverwijdering
- **Type:** DATA / BUG / API
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Gebruikers die contactmomenten mogen wijzigen
- **Land/teamcontext:** Recordscope
- **Omgeving:** Codeanalyse

**Huidige situatie**

Bij upload wordt een bestand eerst fysiek geschreven en daarna wordt `photosJson` in de database bijgewerkt. Bij meerdere bestanden gebeurt dit herhaaldelijk. Een databasefout laat het bestand achter zonder referentie en kan een batch gedeeltelijk uitvoeren. Bij verwijderen wordt eerst de database aangepast en daarna `unlink` uitgevoerd; een bestandssysteemfout laat een ongerefereerd bestand achter en kan toch als requestfout eindigen.

**Verwachte of gewenste situatie**

Bestandsmetadata en businessrecord moeten een herstelbaar consistent lifecyclecontract hebben. Een mislukte operatie mag geen stille orphan, gedeeltelijke batch of misleidende fout na succesvolle businessmutatie achterlaten.

**Waarom dit een probleem is**

Orphanbestanden verbruiken opslag en kunnen persoonsgegevens langer bewaren dan het record aangeeft. Gedeeltelijke batchresultaten zijn voor de gebruiker onduidelijk en bemoeilijken herstel en audit.

**Stappen om vast te stellen of te reproduceren**

1. Simuleer na succesvolle `writeFile` een databasefout bij de foto-metadataupdate.
2. Controleer dat het bestand blijft bestaan zonder geldige recordreferentie.
3. Simuleer bij delete een `unlink`-fout na de DB-update.
4. Controleer dat de response faalt terwijl de foto al uit de recordstate verdwenen is.

**Technische vaststelling**

Filesystem en MariaDB kunnen niet in één transactie deelnemen. De huidige volgorde heeft geen compensatie, staging/commitprotocol, outbox of periodieke orphan-reconciliatie.

**Bewijs**

- Bestand: `lib/server/contact-moment-photos.ts`
- Regel of codeblok: schrijfbestand gevolgd door workflow/DB-update; delete-update gevolgd door `rm`/`unlink`
- Route: contactmomentfoto-upload en -delete
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: afzonderlijke DB-update buiten bestandsschrijfoperatie
- Gerelateerde documentatie: `docs/ai/modules/Coaching/Contactmomenten.md`, `docs/ai/01_ARCHITECTURE.md`

**Voorgestelde aanpassing**

Gebruik een staged bestandsstatus met database-ID, schrijf naar tijdelijk pad, commit metadata, finaliseer idempotent en plan compensatie/reconciliatie voor elke faalfase. Geef multi-upload per bestand een expliciet resultaat en maak delete asynchroon/idempotent waar nodig.

**Acceptatiecriteria**

- [ ] Iedere faalfase heeft een getest compensatie- of retrypad.
- [ ] Een gedeeltelijke multi-upload retourneert per bestand de werkelijke status.
- [ ] Orphanbestanden zijn detecteerbaar en veilig opruimbaar met bewaartermijn.
- [ ] Delete is idempotent wanneer bestand of record al ontbreekt.
- [ ] Audit bevat record-id, bestands-id en resultaat zonder gevoelige inhoud.

**Risico bij niet aanpassen**

Persoonsgebonden foto's blijven ongerefereerd opgeslagen en gebruikers krijgen inconsistente resultaten bij storingen.

**Afhankelijkheden**

- Opslaglifecycle en retentiebeleid
- Achtergrondreconciliatie

**Gerelateerde bevindingen**

- REV-0018
- REV-0041

### 8. Hulpaanvragen

#### REV-0038 — Hulpaanvraagroute kan Contactmomenten en ongedefinieerde trainingen schrijven zonder hun eigen recht

- **Module:** Hulpaanvragen
- **Submodule:** Opvolgactie na antwoord
- **Scherm/pagina:** Hulpaanvraag behandelen
- **Route:** `POST /api/workflows/help-requests`
- **Component/bestand:** `app/api/workflows/help-requests/route.ts`, `app/api/workflows/persist-route.ts`, `lib/workflow-engine.ts`
- **Functie/API/model:** `persistWorkflowPatch`, `handleHelpRequest`, `requireWorkflowPermission`
- **Type:** RECHTEN / SECURITY / FUNCTIONEEL
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Rollen die hulpaanvragen mogen behandelen
- **Land/teamcontext:** Vertegenwoordiger- en teamscope
- **Omgeving:** Codeanalyse

**Huidige situatie**

De hulpaanvraagroute selecteert naast `helpRequests` ook `interventions`, `contactMoments`, `retrainings` en `salesTrainings` uit de request. De algemene permissioncheck wordt slechts met routenaam `help-requests` uitgevoerd. Alleen meegeleverde Begeleidingen krijgen daarna nog een generieke createcheck; Contactmomenten en beide trainingssoorten krijgen niet hun eigen module-/menurecht of trainingsrolcheck.

**Verwachte of gewenste situatie**

Een samengestelde opvolgactie moet iedere deelmutatie afzonderlijk autoriseren en atomair uitvoeren. Is de gekozen vervolgmodule uitgeschakeld, ongedefinieerd of niet toegestaan, dan moet de hele actie vóór opslag worden geweigerd.

**Waarom dit een probleem is**

Een directe client kan de hulpaanvraagendpoint gebruiken als alternatieve schrijfruimte voor records die via hun eigen endpoint verboden zijn. De ingebouwde vervolgkeuze maakt bovendien ongedefinieerde trainingsworkflows productief bereikbaar.

**Stappen om vast te stellen of te reproduceren**

1. Gebruik een testactor met Hulpaanvragenrecht maar zonder Contactmoment- of trainingsrecht.
2. Verstuur naar de hulpaanvraagroute een payload met een hulpaanvraag plus `contactMoments`, `retrainings` of `salesTrainings`.
3. Volg de route: de selector laat de arrays door en `requireWorkflowPermission` evalueert alleen `help-requests`.

**Technische vaststelling**

`help-requests/route.ts` kopieert vijf patchdelen. `persistWorkflowPatch` roept slechts één routegebaseerde permissioncheck aan. De speciale vervolgvalidatie controleert alleen de gekoppelde begeleiding uitgebreid.

**Bewijs**

- Bestand: `app/api/workflows/help-requests/route.ts`, `app/api/workflows/persist-route.ts`, `lib/workflow-engine.ts`
- Regel of codeblok: route regels 3-11; centrale checks regels 47-84; follow-upcreatie rond workflow-engine regels 478-548
- Route: `POST /api/workflows/help-requests`
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: samengestelde patch wordt na één permissioncheck persistent opgeslagen
- Gerelateerde documentatie: `docs/ai/modules/Coaching/Hulpaanvragen.md`, `Retrainingen.md`, `Salestrainingen.md`

**Voorgestelde aanpassing**

Valideer een getypeerd follow-upcommand server-side en leid de deelmutaties af in plaats van clientgegenereerde volledige records te vertrouwen. Roep voor elk gevolg dezelfde capability- en lifecyclepolicy aan als op het eigen endpoint en commit bron plus gevolg in één transactie.

**Acceptatiecriteria**

- [ ] Iedere vervolgsoort controleert eigen module, permission, scope en workflowstatus.
- [ ] Clientpayload kan geen extra recordsoort buiten de gekozen follow-up invoegen.
- [ ] Ongedefinieerde trainingen zijn niet kiesbaar of schrijfbaar.
- [ ] Bronhulpaanvraag en toegestaan gevolg slagen of rollen samen terug.
- [ ] Negatieve API-tests dekken alle vijf patchsoorten.

**Risico bij niet aanpassen**

Gebruikers kunnen module- en trainingsrechten via een alternatieve endpoint omzeilen en niet-goedgekeurde records creëren.

**Afhankelijkheden**

- Capabilitycontracten uit REV-0005
- Businessbesluit uit REV-0006

**Gerelateerde bevindingen**

- REV-0005
- REV-0006
- REV-0012

### 9. Actiepunten

### 10. Tussentijdse evaluaties

#### REV-0052 — Automatische starterevaluaties zijn afhankelijk van een niet-afgedwongen externe scheduler

- **Module:** Tussentijdse evaluaties
- **Submodule:** Automatische generatie
- **Scherm/pagina:** Overzicht tussentijdse evaluaties
- **Route:** `/tussentijdse-evaluaties`
- **Component/bestand:** `lib/server/starter-evaluations.ts`, `scripts/generate-starter-evaluations.ts`, `package.json`
- **Functie/API/model:** `generateDueStarterEvaluations`, `starter-evaluations:generate`
- **Type:** FUNCTIONEEL / ACHTERGRONDTAAK / DEPLOYMENT
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Starters, verkoopleiders en beheerders
- **Land/teamcontext:** Alle landen en teams
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

De generator is idempotent en als CLI-script beschikbaar, maar niets in de applicatie plant hem in of controleert of hij recent is uitgevoerd. De owning documentatie adviseert alleen een dagelijkse Plesk-schedule. Zonder die externe configuratie ontstaan evaluaties op zes weken, drie maanden en vijf maanden niet, terwijl het scherm de functie als automatisch presenteert.

**Verwachte of gewenste situatie**

De deployment moet een expliciet geconfigureerde, bewaakte en alarmerende scheduler bevatten, of de applicatie moet een veilige jobrunner gebruiken. Beheer moet de laatste run, volgende run, aantallen, fouten en achterstand kunnen zien.

**Waarom dit een probleem is**

Een vergeten of stilgevallen scheduled task veroorzaakt stille businessuitval. De unieke constraint voorkomt duplicaten, maar garandeert niet dat de job ooit draait of dat per-userfouten worden opgevolgd.

**Stappen om vast te stellen of te reproduceren**

1. Installeer de applicatie zonder extra Plesk-scheduled task.
2. Laat een starter een milestone passeren.
3. Open het overzicht; geen applicatiepad start de generator.
4. Zoek `generateDueStarterEvaluations`; alleen het CLI-script roept de functie aan.

**Technische vaststelling**

De generator exporteert een samenvatting, maar schrijft geen jobrunrecord of heartbeat. Er is geen cronconfiguratie in de repository en geen health/readinesscontrole op de laatste succesvolle uitvoering.

**Bewijs**

- Bestand: `lib/server/starter-evaluations.ts`, `scripts/generate-starter-evaluations.ts`, `package.json`
- Regel of codeblok: generator rond regels 115-170; script bevat één functiecall; package-entry `starter-evaluations:generate`
- Route: geen schedulerroute aanwezig
- Scherm: niet tijdversnellend getest
- Log: alleen console/CLI-resultaat voorzien
- Query: generator schrijft evaluaties, maar geen jobheartbeat
- Gerelateerde documentatie: `docs/ai/modules/Coaching/TussentijdseEvaluaties.md` beveelt Plesk dagelijks aan

**Voorgestelde aanpassing**

Neem schedulerconfiguratie op in de deploymentrunbook en voeg een `JobRun`- of specifieke heartbeatregistratie toe met lock, start/einde, resultaat en per-userfout. Laat health/operationeel dashboard waarschuwen bij achterstand en maak catch-up expliciet idempotent.

**Acceptatiecriteria**

- [ ] Elke productieomgeving heeft aantoonbaar een dagelijkse job in de juiste tijdzone.
- [ ] Gelijktijdige runners kunnen geen dubbele of conflicterende generatie veroorzaken.
- [ ] Laatste succes, fouten en achterstallige milestones zijn zichtbaar en alarmeerbaar.
- [ ] Een gemiste dag wordt bij de volgende run ingehaald.
- [ ] Deploymentacceptatie controleert scheduler en heartbeat.

**Risico bij niet aanpassen**

Verplichte starterevaluaties worden ongemerkt te laat of helemaal niet aangemaakt.

**Afhankelijkheden**

- Productiejobrunner/Plesk-configuratie
- Monitoring en operationeel eigenaarschap

**Gerelateerde bevindingen**

- REV-0029
- REV-0032

#### REV-0029 — Tussentijdse evaluatie toont antwoordsets van beide rollen vóór een gedefinieerde vrijgaveregel

- **Module:** Tussentijdse evaluaties
- **Submodule:** Antwoordzichtbaarheid en voorbereiding
- **Scherm/pagina:** Detail/invulformulier tussentijdse evaluatie
- **Route:** `GET /api/starter-evaluations/[id]`, `/tussentijdse-evaluaties/[id]`
- **Component/bestand:** `app/api/starter-evaluations/[id]/route.ts`, `components/workspace-pages.tsx`
- **Functie/API/model:** GET-detail, `answersByQuestion`, `StarterEvaluationAnswer`
- **Type:** RECHTEN / FUNCTIONEEL / DATA
- **Prioriteit:** P1
- **Status:** Beslissing vereist
- **Zekerheid:** Bevestigd gedrag; gewenste vrijgaveregel is expliciet ongedefinieerd
- **Rollen:** Vertegenwoordiger en evaluator/leidinggevende
- **Land/teamcontext:** Eigen evaluatie of effectieve managementscope
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

De detail-GET laat zowel de eigen vertegenwoordiger als een scoped evaluator toe. Daarna leest hij alle `StarterEvaluationAnswer`-records en voegt per vraag zowel `REPRESENTATIVE`- als `EVALUATOR`-waarden toe aan dezelfde response. Er is geen filter op aanvragende rol, status, voorbereiding, gespreksdatum of expliciet deelmoment. De owning documentatie noemt server-side antwoordzichtbaarheid per rol en gespreksdatum nog als open item.

**Verwachte of gewenste situatie**

Business/HR moet bepalen welke antwoorden tijdens individuele voorbereiding privé zijn, wanneer ze gedeeld worden, wie gezamenlijke velden mag zien/wijzigen en hoe niet-akkoord/approval werkt. Tot dat besluit hoort least privilege te gelden en mag de API geen antwoordset van de andere rol vrijgeven.

**Waarom dit een probleem is**

Een vertegenwoordiger kan evaluatorscores of -opmerkingen lezen voordat deze bedoeld zijn te bespreken; omgekeerd kan een evaluator privévoorbereiding van de vertegenwoordiger vroeg zien. Dat beïnvloedt de onafhankelijkheid en vertrouwelijkheid van een HR-/coachingsgesprek.

**Stappen om vast te stellen of te reproduceren**

1. Vul in een geïsoleerde test voor één vraag afzonderlijke Representative- en Evaluatorantwoorden in.
2. Roep de detail-GET aan als vertegenwoordiger.
3. Inspecteer `question.answers`; beide rolsleutels zijn aanwezig.
4. Herhaal als evaluator en vergelijk dezelfde responsevorm.

**Technische vaststelling**

De GET bouwt `answersByQuestion` zonder actorfilter en retourneert de volledige map. Alleen de POST beperkt via `canAnswerStarterQuestion` welke actor een veld mag schrijven; read visibility is breder dan write capability.

**Bewijs**

- Bestand: `app/api/starter-evaluations/[id]/route.ts`, `docs/ai/modules/Coaching/TussentijdseEvaluaties.md`
- Regel of codeblok: GET access rond regels 39-59; alle answers lezen/mappen rond regels 72-111; open item 'server-side antwoordzichtbaarheid per rol en gespreksdatum'
- Route: `GET /api/starter-evaluations/[id]`
- Scherm: niet met echte evaluatiegegevens getest
- Log: niet van toepassing
- Query: onbegrensde `starterEvaluationAnswer.findMany({ where: { evaluationId } })`
- Gerelateerde documentatie: genoemde owning module met status `PARTIALLY_DEFINED`

**Voorgestelde aanpassing**

Blokkeer cross-role read voorlopig. Leg daarna met HR/business een antwoordvisibilitymatrix per assignee, actor, status en tijdstip vast. Pas queryselectie server-side toe, voorkom cachelekken en voeg expliciete share/revealtransities en audit toe.

**Acceptatiecriteria**

- [ ] Zonder goedgekeurde sharetransitie ontvangt geen rol antwoorden van de andere rol.
- [ ] Visibility is server-side per vraag/assignee/status afgedwongen.
- [ ] Shared fields en separate fields hebben ondubbelzinnige semantiek.
- [ ] Reveal/share is geaudit en na statuslock niet stil terug te draaien.
- [ ] Negatieve API-tests vergelijken Representative, evaluator en buiten-scope actor vóór en na delen.

**Risico bij niet aanpassen**

Vertrouwelijke voorbereidings- en beoordelingsinformatie wordt voortijdig gedeeld en kan gesprekken of personeelsbeslissingen beïnvloeden.

**Afhankelijkheden**

- HR/businessbesluit over evaluatieworkflow
- Definitieve status-/approvalflow

**Gerelateerde bevindingen**

- REV-0006
- REV-0014
- REV-0052

### 11. Retrainingen en salestrainingen

### 12. Mijn Team

### 13. Gebruikersprofiel

### 14. Prestatiecirkel en scoretabellen

### 15. Beheer — Gebruikers

#### REV-0021 — Gebruikersmutaties kunnen gedeeltelijk worden opgeslagen

- **Module:** Beheer — Gebruikers
- **Submodule:** Aanmaken en wijzigen
- **Scherm/pagina:** Gebruikersbeheer
- **Route:** Management gebruikers-API
- **Component/bestand:** `lib/server/users.ts`
- **Functie/API/model:** `createManagedUserInDatabase`, `updateManagedUserInDatabase`
- **Type:** DATA / BUG / API
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Admin en Super Admin
- **Land/teamcontext:** Land, team en extra landtoegang
- **Omgeving:** Codeanalyse

**Huidige situatie**

De normale createflow maakt eerst de gebruiker, schrijft daarna niveauhistorie, vervangt vervolgens country access en pas daarna permission overrides. De updateflow wijzigt eveneens eerst het hoofdrecord en voert de nevenupdates los uit. Alleen de speciale combinatie 'nieuwe Sales Leader met nieuw team' gebruikt één Prisma-transactie.

**Verwachte of gewenste situatie**

Een beheeractie die als één save wordt aangeboden moet volledig slagen of volledig terugrollen. Dit omvat gebruiker, teamrelatie, country access, permission overrides en verplichte historiek.

**Waarom dit een probleem is**

Een fout in een latere stap kan een gebruiker zonder bedoelde rechten/scope achterlaten terwijl de API faalt. Een herhaalde create botst daarna op het al opgeslagen e-mailadres; bij update kan een tussenstaat tijdelijk te veel of te weinig toegang geven.

**Stappen om vast te stellen of te reproduceren**

1. Laat `replaceUserPermissions` falen na een geldige usercreate of update.
2. Controleer het hoofdrecord en de reeds geschreven country access/historie.
3. Observeer dat de request faalt maar eerdere wijzigingen niet zijn teruggerold.

**Technische vaststelling**

De betrokken `prisma.user.create`/`update` en helpercalls staan sequentieel buiten `$transaction`. Het bestaande `createSalesLeaderWithTeam` toont dat dezelfde repository reeds een transactiestructuur voor samengestelde usermutaties heeft.

**Bewijs**

- Bestand: `lib/server/users.ts`
- Regel of codeblok: create regels 31-63; update regels 129-164; transactionele uitzondering regels 65-122
- Route: gebruikersbeheer-POST/PATCH
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: meerdere afzonderlijke Prisma-mutaties
- Gerelateerde documentatie: `docs/ai/03_ROLES.md`, `docs/ai/02_DATABASE.md`

**Voorgestelde aanpassing**

Bereken en valideer alle doelscope/rechten vooraf en voer hoofdrecord, access, overrides en verplichte historie binnen één interactieve Prisma-transactie uit. Laat helpers een transaction client accepteren en schrijf externe neveneffecten pas na commit via een outbox.

**Acceptatiecriteria**

- [ ] Een fout in eender welke submutatie laat geen gewijzigde userstate achter.
- [ ] Create en update gebruiken hetzelfde transactionele patroon.
- [ ] Unieke conflicten en validatiefouten ontstaan vóór onnodige nevenmutaties.
- [ ] Foutinjectietests dekken iedere transactiestap.
- [ ] De uiteindelijke response is gebaseerd op de committed state.

**Risico bij niet aanpassen**

Gedeeltelijke accounts kunnen onbruikbaar zijn of verkeerde toegang krijgen en zijn lastig handmatig te herstellen.

**Afhankelijkheden**

- Transaction-clientvarianten van access- en permissionhelpers
- Audit/outboxbeleid

**Gerelateerde bevindingen**

- REV-0020
- REV-0023

#### REV-0023 — Gebruikersbeheer negeert de configureerbare gebruikersrechten bij servermutaties

- **Module:** Beheer — Gebruikers
- **Submodule:** Effectieve capabilities
- **Scherm/pagina:** Gebruikersbeheer en avatarbeheer
- **Route:** Management gebruikers- en avatar-API's
- **Component/bestand:** `lib/user-management.ts`, `lib/management-access.ts`, `lib/server/users.ts`, `lib/server/user-avatar.ts`
- **Functie/API/model:** `userManagementCapabilities`, `prepareManagedUserSave`
- **Type:** RECHTEN / SECURITY / BUG
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Admin, Sales Leader, Sales Manager, Country Manager, Group Manager, Service Operator
- **Land/teamcontext:** Gebruiker, team en land
- **Omgeving:** Codeanalyse

**Huidige situatie**

De rechten `usersView`, `usersCreate`, `usersEdit`, `usersDeactivate`, `usersRolesEdit` en `usersPermissionsEdit` bestaan in rolconfiguratie. Alleen toegang tot het beheeronderdeel gebruikt `usersView`. De daadwerkelijke capabilities worden daarna uitsluitend uit de rolnaam en targetscope opgebouwd. Een expliciete deny voor een Admin verhindert create/edit/deactivate niet; een expliciete grant aan een andere rol verleent de bedoelde actie niet.

**Verwachte of gewenste situatie**

Iedere serveractie moet zowel het relevante effectieve permissionbit als targetscope, rolhiërarchie en protected-rolebeperkingen controleren. Een user override moet dezelfde betekenis hebben in menu, pagina en API.

**Waarom dit een probleem is**

Het beheerscherm communiceert configureerbare fijnmazige rechten die technisch geen betrouwbare autorisatie vormen. Dit kan leiden tot onbevoegde account-, rol- of scopewijzigingen ondanks een expliciete beheerdeny.

**Stappen om vast te stellen of te reproduceren**

1. Geef een Admin `usersEdit=false` of `usersDeactivate=false`.
2. Verstuur via de gebruikers-API een wijziging op een gebruiker in hetzelfde land.
3. Volg `userManagementCapabilities`; de Admin-branch retourneert de capability op basis van rol/scope zonder het permissionbit te lezen.

**Technische vaststelling**

`userManagementCapabilities` bevat rolbranches maar geen `hasPermission`/effective-permissioncontrole. `prepareManagedUserSave` en avatarmutaties vertrouwen rechtstreeks op dit resultaat.

**Bewijs**

- Bestand: `lib/user-management.ts`, `lib/management-access.ts`, `lib/server/user-avatar.ts`
- Regel of codeblok: permissiondefinities regels 52-62; capabilities regels 524-611; managementmenu vereist alleen `usersView`
- Route: beheer gebruikers- en avatarmutaties
- Scherm: niet met afzonderlijke lage-rechtenaccounts getest
- Log: niet van toepassing
- Query: mutatie volgt de rolgebaseerde capability
- Gerelateerde documentatie: `docs/ai/03_ROLES.md`

**Voorgestelde aanpassing**

Maak per actie een centrale capability die `effectivePermissions`, module/menu, actor-targetscope en rolhiërarchie combineert. Gebruik dezelfde functies voor knoppen en serverroutes, maar behandel uitsluitend de serveruitkomst als gezaghebbend.

**Acceptatiecriteria**

- [ ] Elk van de zes gebruikersrechten is gekoppeld aan de bedoelde serveractie.
- [ ] Een expliciete deny blokkeert de API ook als de rol normaal toegang heeft.
- [ ] Een grant werkt alleen binnen de gedocumenteerde scope en rolhiërarchie.
- [ ] Super Admin-bescherming en zelf-deactivatiebeperkingen blijven expliciet getest.
- [ ] Een matrix-test vergelijkt UI, directe API en targetscope.

**Risico bij niet aanpassen**

Beheerders kunnen accounts en rechten wijzigen in strijd met expliciet ingetrokken permissies.

**Afhankelijkheden**

- Definitieve permissionsemantiek per rol
- Centrale effectieve-scopeoplossing uit REV-0002 en REV-0003

**Gerelateerde bevindingen**

- REV-0001
- REV-0003
- REV-0021

### 16. Beheer — Rollen en rechten

#### REV-0002 — Group Manager krijgt technisch ongefilterde globale toegang

- **Module:** Beheer — Rollen en rechten
- **Submodule:** Effectieve land-, team- en gebruikersscope
- **Scherm/pagina:** Alle scopegevoelige Coaching-, SalesDay-, Inventory-, Contract- en beheerweergaven
- **Route:** Meerdere routes en API's
- **Component/bestand:** `lib/server/authenticated-user.ts`, `lib/permissions.ts`, `lib/data-access.ts`, `lib/server/coaching-visibility.ts`, `lib/contract/access.ts`, `lib/server/my-team.ts`
- **Functie/API/model:** `actorCountryWhere`, `actorCanAccessCountry`, `requireRepresentativeScope`, `buildCoachingVisibilityFilter`
- **Type:** RECHTEN / SECURITY / DATA
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Group Manager
- **Land/teamcontext:** Land, team en gebruiker
- **Omgeving:** Codeanalyse

**Huidige situatie**

Veel centrale en domeinspecifieke scopehelpers behandelen `GROUP_MANAGER` hetzelfde als `SUPER_ADMIN`: de countryfilter wordt `{}`, landcontrole retourneert altijd `true` en representatieve scopecontroles worden overgeslagen. Daardoor krijgt iedere Group Manager technisch alle landen en teams, ook als slechts een expliciete groep of enkele landen zijn toegewezen.

**Verwachte of gewenste situatie**

Group Manager-toegang moet uitsluitend voortkomen uit expliciete permissies plus de toegewezen group/country/team-scope. Alleen Super Admin mag zonder aanvullende toewijzing globaal zijn. Zolang de Group Manager-businessdefinitie onvolledig is, moet least privilege gelden.

**Waarom dit een probleem is**

Dit is een horizontale datalekmogelijkheid over landen en teams heen. De afwijking zit in gedeelde helpers en beïnvloedt daardoor dossiers, medewerkers, contracten, klant-/verkoopdata en managementinformatie tegelijk.

**Stappen om vast te stellen of te reproduceren**

1. Configureer een Group Manager met slechts één toegewezen land.
2. Vraag gegevens op uit een ander land via Mijn Team, Coaching, Contract of een SalesDay-management-API.
3. Observeer dat centrale helpers de rol vóór de opgeslagen toewijzingen globaal toelaten.

**Technische vaststelling**

`actorCountryWhere` retourneert voor `GROUP_MANAGER` en `SUPER_ADMIN` zonder onderscheid `{}`. `actorCanAccessCountry` retourneert voor beide rollen altijd `true`. Dezelfde rolcombinatie komt terug in coaching-, contract-, data-access- en Mijn Team-filters.

**Bewijs**

- Bestand: `lib/server/authenticated-user.ts`, `lib/server/coaching-visibility.ts`, `lib/contract/access.ts`, `lib/data-access.ts`, `lib/server/my-team.ts`
- Regel of codeblok: onder meer `authenticated-user.ts` regels 19-31 en 88-93; `coaching-visibility.ts` regels 19 en 102; `contract/access.ts` regels 21 en 42
- Route: alle consumers van deze helpers
- Scherm: niet met een afzonderlijke Group Manager-account getest
- Log: niet van toepassing
- Query: Prismafilters worden voor Group Manager leeg of onbeperkt
- Gerelateerde documentatie: `docs/ai/03_ROLES.md` regels 206-230 en SalesDay-beslissing 4.2

**Voorgestelde aanpassing**

Introduceer één `EffectiveScope`-object dat expliciete landen, teams, gebruiker, global-bit en bron van de toewijzing bevat. Verwijder `GROUP_MANAGER` uit alle automatische globale bypasses. Laat elk domein dezelfde querybouwers gebruiken en migreer de bestaande rolchecks met een deny-by-default-regressiesuite.

**Acceptatiecriteria**

- [ ] Een Group Manager ziet uitsluitend expliciet toegewezen landen/groepen en onderliggende teams.
- [ ] Zonder toewijzing is de effectieve operationele scope leeg.
- [ ] Alleen Super Admin kan een impliciete globale scope krijgen.
- [ ] Coaching, SalesDay, Inventory, Contract, Mijn Team, bestanden en exports gebruiken dezelfde effectieve scope.
- [ ] Negatieve API-tests bewijzen dat een gemanipuleerd land-, team- of record-id geen scope verbreedt.

**Risico bij niet aanpassen**

Een Group Manager kan persoonsgegevens, prestatiegegevens en commerciële data buiten de bedoelde organisatiegrens lezen of beïnvloeden, met privacy-, vertrouwelijkheids- en auditrisico.

**Afhankelijkheden**

- Definitieve Group Manager-organisatiestructuur
- Datamodel voor expliciete groepstoewijzing indien landen alleen onvoldoende zijn

**Gerelateerde bevindingen**

- REV-0001
- REV-0003
- REV-0004

#### REV-0003 — Meervoudige landtoewijzingen worden per module verschillend toegepast

- **Module:** Beheer — Rollen en rechten
- **Submodule:** CountryAccess en scopeconsistentie
- **Scherm/pagina:** Mijn Team, Coaching, Contract, SalesDay-management en rapportage
- **Route:** Meerdere routes en API's
- **Component/bestand:** `lib/server/authenticated-user.ts`, `lib/server/coaching-visibility.ts`, `lib/server/my-team.ts`, `lib/contract/access.ts`
- **Functie/API/model:** `actorCountryWhere`, `actorCanAccessCountry`, `buildCoachingVisibilityFilter`, `countryWhereForActor`
- **Type:** RECHTEN / DATA / BUG
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Sales Manager, Country Manager, Admin en Group Manager
- **Land/teamcontext:** Meerdere landen
- **Omgeving:** Codeanalyse

**Huidige situatie**

De aangemelde gebruiker bevat `countryAccess`, maar de centrale helpers benutten die lijst niet voor alle betrokken rollen. `actorCountryWhere` gebruikt extra landen voor Sales Manager en Admin, terwijl Country Manager alleen op `user.country` uitkomt. Andere domeinhelpers bouwen opnieuw eigen rolregels; Mijn Team en Coaching wijken daarbij af van Contract.

**Verwachte of gewenste situatie**

Alle modules moeten één berekende lijst van toegestane landen en teams gebruiken. Dezelfde actor en dezelfde toewijzingen moeten voor menu, pagina, API, export, PDF en download altijd hetzelfde resultaat geven.

**Waarom dit een probleem is**

De gebruiker kan in het ene scherm legitieme data missen en in een ander scherm te veel zien. Dit maakt rechten moeilijk uitlegbaar, ondermijnt tests en veroorzaakt foutieve managementrapporten of recordselecties.

**Stappen om vast te stellen of te reproduceren**

1. Geef een Country Manager of Admin toegang tot twee landen terwijl het primaire `country` één land blijft.
2. Vergelijk Mijn Team, Coaching en Contractresultaten.
3. Observeer dat helpers verschillende rol- en countryAccess-combinaties gebruiken.

**Technische vaststelling**

De repository bevat meerdere parallelle scopebouwers. `actorCountryWhere`, `actorCanAccessCountry`, `buildCoachingVisibilityFilter`, Contract access en Mijn Team hebben elk afzonderlijke rolbranches en behandelen `countryAccess` niet identiek.

**Bewijs**

- Bestand: `lib/server/authenticated-user.ts`, `lib/server/coaching-visibility.ts`, `lib/server/my-team.ts`, `lib/contract/access.ts`
- Regel of codeblok: `authenticated-user.ts` regels 19-42; `coaching-visibility.ts` regels 15-25; `my-team.ts` regels 60-78; `contract/access.ts` regels 17-52
- Route: module-overstijgend
- Scherm: niet met meerdere specifieke accounts getest
- Log: niet van toepassing
- Query: afwijkende Prisma `where`-constructies per domein
- Gerelateerde documentatie: `docs/ai/03_ROLES.md` regels 34-44, 166-180, 184-202 en 235-250

**Voorgestelde aanpassing**

Centraliseer scopeberekening in een getypeerde servermodule en laat domeinen alleen nog een domeinrecord naar die scope vertalen. Leg per rol vast of primaire en extra landen samen gelden. Verwijder lokale rolarrays zodra regressietests de gedeelde helper dekken.

**Acceptatiecriteria**

- [ ] De effectieve landenlijst is voor een actor op één plaats berekend.
- [ ] Country Manager, Sales Manager, Admin en Group Manager volgen gedocumenteerde toewijzingen identiek in alle modules.
- [ ] PDF's, exports en bestandsdownloads gebruiken dezelfde scope als de schermquery.
- [ ] Een matrix-test vergelijkt menu, pagina en API voor enkelvoudige, meervoudige en lege toewijzingen.

**Risico bij niet aanpassen**

Onvoorspelbare over- of ondertoegang kan leiden tot datalekken, ontbrekende dossiers, onvolledige rapportage en gebruikers die rechten via een alternatieve module omzeilen.

**Afhankelijkheden**

- Vastgelegde rolmatrix en semantiek van `UserCountryAccess`
- REV-0002 voor Group Manager

**Gerelateerde bevindingen**

- REV-0002
- REV-0004

### 17. Beheer — Teams, landen en organisatiestructuur

#### REV-0037 — Een zichtbaar Teams-menu volstaat als schrijfrecht voor organisatiestructuur

- **Module:** Beheer — Teams, landen en organisatiestructuur
- **Submodule:** Teammutaties
- **Scherm/pagina:** Teambeheer
- **Route:** `POST /api/management` en teamroutes
- **Component/bestand:** `app/api/management/route.ts`, `lib/server/management.ts`, `lib/management-access.ts`
- **Functie/API/model:** `saveTeam`, `archiveTeam`, management section access
- **Type:** RECHTEN / SECURITY / DATA
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Iedere rol met `menu.coaching.teams`
- **Land/teamcontext:** Land en team
- **Omgeving:** Codeanalyse

**Huidige situatie**

De managementroute gebruikt toegang tot de sectie Teams als poort voor zowel lezen als schrijven. `saveTeam` controleert daarna landscope, maar geen afzonderlijk technisch-tabellen- of teambeheersrecht. Een gebruiker aan wie het menu voor raadpleging wordt toegekend, kan daardoor ook teamnaam, primaire leider, landrelatie of archivering muteren voor zover de brede landscope dit toelaat.

**Verwachte of gewenste situatie**

Lees-, create-, update-, leiderstoewijzings- en archiveercapabilities moeten afzonderlijk en server-side gedefinieerd zijn. Een menurecht bepaalt navigatie, niet automatisch businessmutatie.

**Waarom dit een probleem is**

Teams bepalen de zichtbaarheid en verantwoordelijkheid van medewerkers en workflows. Onbedoelde teammutaties kunnen daardoor onmiddellijk toegang, rapportage, goedkeuringen en notificaties beïnvloeden.

**Stappen om vast te stellen of te reproduceren**

1. Geef een niet-beherende testrol alleen `menu.coaching.teams` binnen een land.
2. Verstuur een geldige team-save naar de managementroute.
3. Observeer dat na sectietoegang alleen `assertCountryScope` de mutatie begrenst.

**Technische vaststelling**

De route dispatcht `saveTeam`/`archiveTeam` vanuit de algemene managementsectie. Deze helpers valideren records en land, maar roepen geen actie-specifieke permissioncheck aan.

**Bewijs**

- Bestand: `app/api/management/route.ts`, `lib/server/management.ts`, `lib/management-access.ts`
- Regel of codeblok: route dispatch rond regels 150-185; `saveTeam` rond regels 865-941; section descriptor voor teams
- Route: `/api/management`, `/api/management/teams`
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: team upsert/leaderwijziging na alleen scopecheck
- Gerelateerde documentatie: `docs/ai/03_ROLES.md`

**Voorgestelde aanpassing**

Definieer expliciete `teamsView`, `teamsCreate`, `teamsEdit`, `teamsAssignLeader` en `teamsArchive` capabilities of een kleiner goedgekeurd model. Controleer deze in iedere mutatiehelper naast scope en lifecycle, en migreer menuconfiguratie zonder bestaande gebruikers ongemerkt meer rechten te geven.

**Acceptatiecriteria**

- [ ] Alleen zichtrecht kan nooit een teammutatie uitvoeren.
- [ ] Leiderstoewijzing controleert actor-, targetuser- en teamscope.
- [ ] Landwijziging en archivering hebben expliciete, geteste capabilities.
- [ ] Directe API-tests dekken grants, denies en gemanipuleerde ids.
- [ ] Historiek registreert voor/na-waarden van organisatiestructuurmutaties.

**Risico bij niet aanpassen**

Een verkeerd geconfigureerd menurecht kan de organisatiestructuur en daardoor brede datatoegang wijzigen.

**Afhankelijkheden**

- Rolmatrix voor teambeheer
- Auditvereisten voor organisatiestructuur

**Gerelateerde bevindingen**

- REV-0001
- REV-0023
- REV-0041

### 18. Beheer — KPI's, kapstok en criteria

### 19. Beheer — Parameters

### 20. E-mailfunctionaliteit

#### REV-0053 — Workflowmail heeft geen duurzame afleverstatus of retrymechanisme

- **Module:** E-mailfunctionaliteit
- **Submodule:** Transactionele workflowmails
- **Scherm/pagina:** Begeleidingen, Hulpaanvragen en Contactmomenten
- **Route:** Workflow-POST-routes
- **Component/bestand:** `app/api/workflows/persist-route.ts`, `lib/server/mail-service.ts`
- **Functie/API/model:** `sendWorkflowMailSafely`, `sendWorkflowEventMail`
- **Type:** E-MAIL / INTEGRATIE / LOGGING
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle afzenders en ontvangers van workflowmail
- **Land/teamcontext:** Recordscope
- **Omgeving:** Codeanalyse; geen echte mail verzonden

**Huidige situatie**

Na businessopslag probeert de route mail synchroon te versturen. `sendWorkflowMailSafely` vangt iedere fout af en schrijft alleen een consoleregel. Er is geen durable outbox, afleverstatus op het domeinevent, retry, dead-letterlijst of beheerzicht. De API retourneert toch succes en de gebruiker kan niet zien dat de bedoelde mail nooit vertrok.

**Verwachte of gewenste situatie**

Als mail onderdeel is van de afgesproken communicatie, moet het event duurzaam worden vastgelegd en asynchroon/idempotent worden afgeleverd met status, retry en beheerbare foutafhandeling. Is mail bewust best effort, dan moet de UI dat tonen en een alternatief notificatiepad garanderen.

**Waarom dit een probleem is**

Een tijdelijke SMTP-storing kan akkoordverzoeken of hulpaanvraagupdates permanent verloren laten gaan. Alleen consolelogging is onvoldoende voor operationele opvolging en bewijs.

**Stappen om vast te stellen of te reproduceren**

1. Simuleer een SMTP-fout tijdens een workflowmutatie.
2. Observeer dat de businessmutatie behouden blijft en de API succes retourneert.
3. Herstel SMTP en stel vast dat geen opgeslagen pending mail automatisch wordt hernomen.

**Technische vaststelling**

De helper bevat `try/catch` rond `sendWorkflowEventMail` en doet bij catch uitsluitend `console.error`. Eventkeys worden wel samengesteld voor idempotentiecontext, maar er bestaat geen persistente mailoutbox in deze flow.

**Bewijs**

- Bestand: `app/api/workflows/persist-route.ts`, `lib/server/mail-service.ts`
- Regel of codeblok: mailhelper rond regels 430-436; mailcalls na notificationcreate
- Route: workflowmutaties
- Scherm: niet met echte SMTP getest conform veilige auditbeperking
- Log: enige foutregistratie is `[mail] Workflowmail kon niet worden verzonden.`
- Query: geen transactionele outboxwrite
- Gerelateerde documentatie: `docs/technical/MAIL_SETTINGS.md`, Coaching-workflowdocumenten

**Voorgestelde aanpassing**

Schrijf een genormaliseerd mail/outboxevent in dezelfde transactie als de businessactie, verwerk het door een bewaakte worker en sla status, pogingen en laatste veilige foutcode op. Gebruik de bestaande eventkey als idempotentiesleutel en bied beheerders retry/cancel zonder inhoudlek.

**Acceptatiecriteria**

- [ ] Ieder verplicht mailevent is vóór businesscommit duurzaam geregistreerd.
- [ ] Tijdelijke SMTP-fouten worden begrensd opnieuw geprobeerd.
- [ ] Permanente fouten zijn zichtbaar met recipient, eventtype en veilige foutclassificatie.
- [ ] Dubbele verwerking verstuurt niet dubbel.
- [ ] UI maakt onderscheid tussen businessopslag, in-appmelding en mailaflevering.

**Risico bij niet aanpassen**

Belangrijke communicatie verdwijnt zonder herstel, melding aan gebruiker of betrouwbare audittrail.

**Afhankelijkheden**

- Achtergrondworker en scheduler
- Retentie- en privacybeleid voor mailmetadata

**Gerelateerde bevindingen**

- REV-0012
- REV-0041

### 21. Notificaties

#### REV-0012 — Workflowopslag kan slagen terwijl notificatie, audit of response faalt

- **Module:** Notificaties
- **Submodule:** Consistentie met workflowmutaties
- **Scherm/pagina:** Begeleidingen, Contactmomenten en Hulpaanvragen
- **Route:** `POST /api/workflows/*`
- **Component/bestand:** `app/api/workflows/persist-route.ts`, `lib/server/workflows.ts`, `lib/server/audit.ts`
- **Functie/API/model:** `saveWorkflowPatchToDatabase`, `createWorkflowInAppNotifications`, `writeAuditLogs`
- **Type:** DATA / API / NOTIFICATIE / LOGGING
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle workflowgebruikers
- **Land/teamcontext:** Recordscope
- **Omgeving:** Codeanalyse

**Huidige situatie**

De workflowpatch wordt eerst in een Prisma-transactie gecommit. Daarna worden in-appnotificaties, wijzigingslogs en auditlogs uitgevoerd. Notificatiefouten worden niet opgevangen en kunnen dus een 500-response veroorzaken nadat het dossier al gewijzigd is. Auditfouten worden juist stil ingeslikt. Een clientretry kan daardoor dezelfde businessactie opnieuw aanbieden terwijl de eerste al is opgeslagen.

**Verwachte of gewenste situatie**

Businessmutatie, verplichte audit en notificatie-intent moeten één consistent commitcontract hebben. Externe aflevering mag asynchroon zijn, maar de outbox/intentie moet atomair en idempotent met het domeinevent worden opgeslagen.

**Waarom dit een probleem is**

De gebruiker krijgt mogelijk 'opslaan mislukt' bij een succesvolle wijziging. Dit kan dubbele vervolgacties, verschillende notificatiestatussen en ontbrekende audit veroorzaken; precies bij lifecycleovergangen is dat risicovol.

**Stappen om vast te stellen of te reproduceren**

1. Injecteer een fout in `createInAppNotification` na een geldige workflowcommit.
2. Observeer een foutresponse.
3. Lees het businessrecord opnieuw en stel vast dat de mutatie wel bestaat.
4. Herhaal de request en vergelijk dubbele/verschillende neveneffecten.

**Technische vaststelling**

In `persistWorkflowPatch` staat `await saveWorkflowPatchToDatabase(patch)` vóór `createWorkflowInAppNotifications` en auditcalls. Deze stappen delen geen transaction client of outboxrecord.

**Bewijs**

- Bestand: `app/api/workflows/persist-route.ts`, `lib/server/workflows.ts`, `lib/server/audit.ts`
- Regel of codeblok: persist-route regels 89-95; datatransactie in workflows rond regels 438-448
- Route: alle workflow-POST-routes
- Scherm: niet muterend getest
- Log: foutpaden alleen via console
- Query: gescheiden business-, notificatie- en auditmutaties
- Gerelateerde documentatie: `docs/ai/01_ARCHITECTURE.md`, workflowmodule-documenten

**Voorgestelde aanpassing**

Introduceer een domeincommand-id/idempotency key en schrijf businessdata, vereiste audit en notification/mail-outboxevents in één transactie. Laat workers neveneffecten herneembaar verwerken en retourneer de committed commandstatus bij retries.

**Acceptatiecriteria**

- [ ] Een responsefout na commit leidt niet tot onbekende commandstatus.
- [ ] Verplichte audit en neveneffectintenties committen atomair met de workflow.
- [ ] Dezelfde command-id veroorzaakt geen dubbele businessactie of notificatie.
- [ ] Foutinjectietests dekken elke grens vóór, tijdens en na commit.
- [ ] De UI kan pending/failed neveneffecten zichtbaar opvolgen.

**Risico bij niet aanpassen**

Workflowstate, gebruikersfeedback, notificaties en audittrail kunnen aantoonbaar uit elkaar lopen.

**Afhankelijkheden**

- Outbox/workerinfrastructuur
- Idempotencycontract aan de API-grens

**Gerelateerde bevindingen**

- REV-0007
- REV-0017
- REV-0053

### 22. PDF's, exports en afdrukken

### 23. Meertaligheid

#### REV-0028 — Taalkeuze wijzigt niet de documenttaal en grote schermdelen blijven hardcoded Nederlands

- **Module:** Meertaligheid
- **Submodule:** Runtime-i18n en semantische taal
- **Scherm/pagina:** Shell, login, Planning, Begeleidingen, beheer, foutpagina's en diverse dialogs
- **Route:** Globaal
- **Component/bestand:** `app/layout.tsx`, `app/global-error.tsx`, `components/planning-calendar.tsx`, `components/workspace-pages.tsx`, beheercomponenten
- **Functie/API/model:** `<html lang>`, user language, translation provider
- **Type:** I18N / ACCESSIBILITY / UX
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle gebruikers, vooral Frans- en Duitstaligen
- **Land/teamcontext:** BE, NL en DE
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

De drie locale-JSON-bestanden hebben wel exact dezelfde 928 keys, maar veel zichtbare tekst staat rechtstreeks in componenten. Voorbeelden zijn kalenderlabels, filters, Begeleidingenkoppen, beheer- en deletedialogs en foutteksten. Zowel rootlayout als globale foutpagina zetten altijd `<html lang="nl">`, ook wanneer de gebruiker Frans of Duits heeft gekozen.

**Verwachte of gewenste situatie**

Alle gebruikersgerichte tekst, aria-labels en documentmetadata moeten via dezelfde NL/FR/DE-vertalingslaag lopen. De effectieve documenttaal moet de gebruikerskeuze volgen en vóór of bij eerste render correct zijn.

**Waarom dit een probleem is**

Frans- en Duitstaligen krijgen gemengde schermen. Screenreaders gebruiken door `lang=nl` Nederlandse uitspraakregels voor Franse/Duitse tekst; fout- en beheerflows zijn juist de momenten waarop duidelijkheid essentieel is.

**Stappen om vast te stellen of te reproduceren**

1. Kies een gebruiker met taal FR of DE.
2. Open Planning, Begeleidingen en beheer-/foutdialogs.
3. Observeer Nederlandse hardcoded labels tussen vertaalde onderdelen.
4. Inspecteer het `lang`-attribuut; dit blijft `nl`.

**Technische vaststelling**

`app/layout.tsx` en `app/global-error.tsx` coderen `lang="nl"`. De grote workspace- en planningcomponenten bevatten vele Nederlandse literals buiten `t(...)`.

**Bewijs**

- Bestand: `app/layout.tsx`, `app/global-error.tsx`, `components/planning-calendar.tsx`, `components/workspace-pages.tsx`
- Regel of codeblok: layout regel 39; planninglabels en Begeleidingenfilters rond workspace regels 4240-4290
- Route: globaal
- Scherm: localhostsessie in NL gecontroleerd; FR/DE-account niet beschikbaar
- Log: niet van toepassing
- Query: locale-keyvergelijking gaf NL=FR=DE=928 zonder sleutelverschil; probleem zit in bypassende literals
- Gerelateerde documentatie: `docs/ai/04_UI_GUIDELINES.md`, AGENTS.md sectie 9

**Voorgestelde aanpassing**

Maak een inventaris van user-facing literals met lintregel, migreer per component naar getypeerde keys en laat serverlayout de effectieve taal uit veilige sessie/cookie bepalen. Vertaal ook statussen, aria-labels, API-gebruikersmeldingen en PDF/mailtemplates.

**Acceptatiecriteria**

- [ ] Alle zichtbare en toegankelijke labels bestaan in NL, FR en DE.
- [ ] `<html lang>` volgt de effectieve gebruikerstaal, inclusief foutpagina's.
- [ ] Geen ruwe enum of Nederlandse fallback verschijnt in FR/DE.
- [ ] Een statische controle blokkeert nieuwe ongeautoriseerde UI-literals.
- [ ] Kernflows zijn handmatig en geautomatiseerd in drie talen gecontroleerd.

**Risico bij niet aanpassen**

De meertalige belofte blijft onvolledig en gebruikers met assistieve technologie krijgen fout uitgesproken of onbegrijpelijke interfaces.

**Afhankelijkheden**

- Server-side taalresolutie
- Vertaalproces en review door moedertaalsprekers

**Gerelateerde bevindingen**

- REV-0024
- REV-0043

### 24. Responsiviteit en toegankelijkheid

#### REV-0024 — Kernbediening bevat naamloze formuliervelden en icon-only knoppen

- **Module:** Responsiviteit en toegankelijkheid
- **Submodule:** Accessible names en formulierlabels
- **Scherm/pagina:** Mobiele shell en Begeleidingenoverzicht
- **Route:** Globale mobiele navigatie, `/begeleidingen`
- **Component/bestand:** `components/app-shell.tsx`, `components/workspace-pages.tsx`
- **Functie/API/model:** mobiele menu-open/sluitknoppen, zoek- en filtervelden
- **Type:** ACCESSIBILITY / UX
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle gebruikers
- **Land/teamcontext:** Niet van toepassing
- **Omgeving:** Codeanalyse en localhost op 390×844

**Huidige situatie**

De mobiele menu-openknop en de zichtbare X-sluitknop hebben alleen een icoon en geen `aria-label` of zichtbare tekst. In Begeleidingen heeft het zoekveld alleen placeholder 'Zoeken…' en hebben beide filters geen label of `aria-label`. De omhullende `label` rond zoeken bevat geen tekstuele naam.

**Verwachte of gewenste situatie**

Elke interactieve control heeft een unieke, programmatisch bepaalbare naam die doel en filterdimensie beschrijft. Placeholder en pictogram mogen niet de enige naambron zijn.

**Waarom dit een probleem is**

Screenreadergebruikers horen generieke 'button', 'edit text' of onduidelijke selectwaarden en kunnen navigatie of filters niet betrouwbaar bedienen. Voice control kan de controls evenmin eenduidig aanspreken.

**Stappen om vast te stellen of te reproduceren**

1. Open op mobiele breedte en inspecteer de menu-open- en X-knop in de accessibility tree.
2. Navigeer naar `/begeleidingen`.
3. Tab door zoekveld en beide selects met een screenreader.
4. Observeer dat doel/dimensie niet als toegankelijk label is gekoppeld.

**Technische vaststelling**

De betrokken buttons renderen alleen `Menu`/`X`. De Begeleidingenmarkup gebruikt een placeholder en twee kale `<select className="field">`-elementen.

**Bewijs**

- Bestand: `components/app-shell.tsx`, `components/workspace-pages.tsx`
- Regel of codeblok: shell rond regels 341-356; Begeleidingenfilters rond regels 4247-4249
- Route: globaal en `/begeleidingen`
- Scherm: mobiele layout op 390×844 visueel gecontroleerd zonder horizontale overflow
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/04_UI_GUIDELINES.md`

**Voorgestelde aanpassing**

Voeg vertaalde `aria-labels` toe aan icon-only controls en echte labels aan zoek/selectvelden. Maak een gedeelde iconbutton- en filterfieldcomponent die een naam compile-time vereist en voeg axe/accessibility assertions toe.

**Acceptatiecriteria**

- [ ] Iedere icon-only knop heeft een vertaalde accessible name.
- [ ] Ieder formuliercontrol heeft een gekoppeld zichtbaar label of gelijkwaardig toegankelijk label.
- [ ] Labels onderscheiden statusfilter en periodefilter.
- [ ] Keyboard- en screenreadernavigatie van shell en filters is getest.
- [ ] 390×844 en 768×1024 blijven zonder horizontale overflow werken.

**Risico bij niet aanpassen**

Essentiële navigatie en filtering blijven voor toetsenbord-, screenreader- en spraakgebruikers onduidelijk.

**Afhankelijkheden**

- I18n-migratie uit REV-0028
- Toegankelijkheidstesttooling

**Gerelateerde bevindingen**

- REV-0028
- REV-0049

#### REV-0049 — Dialogs missen focusbeheersing, Escape-afhandeling en focusherstel

- **Module:** Responsiviteit en toegankelijkheid
- **Submodule:** Modale dialogs
- **Scherm/pagina:** Gebruikersbeheer, configuratiebeheer en instellingen
- **Route:** Beheerroutes
- **Component/bestand:** `components/user-management.tsx`, `components/configuration-management.tsx`, `components/settings-management.tsx`
- **Functie/API/model:** lokale `Modal`, `DeleteUserDialog`, `NewTeamDialog`
- **Type:** ACCESSIBILITY / UX
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Beheerrollen
- **Land/teamcontext:** Niet van toepassing
- **Omgeving:** Codeanalyse

**Huidige situatie**

De dialogs gebruiken meestal correct `role="dialog"` en `aria-modal="true"`, en sommige velden krijgen `autoFocus`. Er is echter geen gedeelde focus trap, Escape-handler of herstel van focus naar de opener. Tab kan naar de achterliggende pagina lopen; sluiten via overlay/knop verliest de logische positie. Meerdere lokale modalimplementaties verschillen onderling.

**Verwachte of gewenste situatie**

Een modale dialog verplaatst focus bij openen, houdt toetsenbordfocus binnen de modal, sluit met Escape tenzij een kritieke save dat verhindert en herstelt focus naar de opener. Achtergrondinhoud is inert.

**Waarom dit een probleem is**

Toetsenbord- en screenreadergebruikers kunnen achter de visuele overlay terechtkomen, context verliezen of een destructieve dialoog moeilijk verlaten. Inconsistentie vergroot de regressiekans.

**Stappen om vast te stellen of te reproduceren**

1. Open een beheer- of deletedialog met toetsenbord.
2. Druk herhaaldelijk Tab/Shift+Tab en observeer focus buiten de modal.
3. Druk Escape; veel dialogs blijven open.
4. Sluit en controleer waar focus terechtkomt.

**Technische vaststelling**

De lokale modalcomponenten renderen overlays en ARIA-attributen maar bevatten geen keydown/focustrap/opener-ref. Alleen app-switchermenu's hebben een losse Escape-listener.

**Bewijs**

- Bestand: `components/user-management.tsx`, `components/configuration-management.tsx`, `components/settings-management.tsx`
- Regel of codeblok: userdialogs rond regels 1810-1950; configuratie `Modal` rond regels 2750-2805
- Route: beheer
- Scherm: niet destructief interactief getest; markup/code bevestigd
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/04_UI_GUIDELINES.md`

**Voorgestelde aanpassing**

Vervang lokale overlays door één geteste dialogprimitive die initial focus, trap, inert background, Escape, titel/beschrijving en focusrestore afdwingt. Laat kritieke busy-state expliciet bepalen of sluiten mag.

**Acceptatiecriteria**

- [ ] Tab en Shift+Tab blijven binnen iedere open modal.
- [ ] Escape sluit veilige dialogs en respecteert expliciete busy-blokkade.
- [ ] Sluiten herstelt focus naar de opener.
- [ ] Achtergrondcontrols zijn niet bereikbaar voor assistieve technologie.
- [ ] Geautomatiseerde keyboardtests dekken create, edit en delete.

**Risico bij niet aanpassen**

Beheerflows blijven ontoegankelijk en foutgevoelig voor gebruikers zonder muis.

**Afhankelijkheden**

- Keuze/hergebruik van een toegankelijke dialogprimitive
- I18n voor titels en labels

**Gerelateerde bevindingen**

- REV-0024
- REV-0028

### 25. Database en Prisma

#### REV-0014 — Parallelle statuswoorden worden zonder runtimevalidatie tussen domein en database gecast

- **Module:** Database en Prisma
- **Submodule:** Workflowstatusmodel
- **Scherm/pagina:** Begeleidingen, Contactmomenten, trainingen, Actiepunten en statussbadges
- **Route:** Workflow-API's
- **Component/bestand:** `prisma/schema.prisma`, `lib/server/workflows.ts`, `components/ui.tsx`
- **Functie/API/model:** `InterventionStatus`, `toInterventionStatus`, `from*Status`
- **Type:** DATA / FUNCTIONEEL / TECHNISCH
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle workflowgebruikers
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse

**Huidige situatie**

`InterventionStatus` bevat overlappende eind- en tussenstatussen zoals `GEFINALISEERD`, `AFGESLOTEN`, `GESLOTEN`, `VOLTOOID`, meerdere akkoord-/wachtvarianten en legacywaarden. Clienttypes gebruiken lowercase strings. Conversie gebeurt vaak met `status.toUpperCase() as DbInterventionStatus` of lowercase casts, zonder runtime membershipcontrole. Hulpaanvragen hebben daarnaast expliciete legacyaliasmapping.

**Verwachte of gewenste situatie**

Elke workflow heeft een gedocumenteerde canonieke state machine. Legacywaarden worden bij read/migratie expliciet genormaliseerd; API's accepteren alleen geldige transities en geen willekeurige stringcasts.

**Waarom dit een probleem is**

Overlappende semantiek leidt tot verschillende filters voor 'historisch', locks, badges, rapportage en notificaties. Ongeldige input faalt pas in Prisma of wordt door losse mappings verschillend geïnterpreteerd.

**Stappen om vast te stellen of te reproduceren**

1. Vergelijk de Prisma-enum met clientstatusunions en owning workflowdocumenten.
2. Volg `toInterventionStatus` voor een willekeurige string.
3. Vergelijk statussets in historie-, lock-, notificatie- en badgecode.

**Technische vaststelling**

De converter valideert alleen casing via een TypeScript-cast. De database-enum bundelt statussen van meerdere interventiontypes; mapping en toegestane transities zijn verspreid.

**Bewijs**

- Bestand: `prisma/schema.prisma`, `lib/server/workflows.ts`, `components/ui.tsx`
- Regel of codeblok: schema enum regels 53-68; converter rond workflows regels 1261-1295
- Route: workflowmutaties en reads
- Scherm: meerdere statusbadges op Begeleidingen gezien
- Log: niet van toepassing
- Query: Prisma enum valideert pas bij write
- Gerelateerde documentatie: `docs/ai/modules/Coaching/FLOW.md` en module-owning documenten

**Voorgestelde aanpassing**

Maak per workflow een exhaustieve statusadapter en transitiematrix met runtime-schema. Classificeer bestaande records, migreer of label legacywaarden en centraliseer helpers voor actief/historisch/locked/notification.

**Acceptatiecriteria**

- [ ] Iedere status heeft één betekenis per workflowtype.
- [ ] Runtimeparsing weigert onbekende status vóór databasewerk.
- [ ] Historie, locks, notificaties, rapportage en badges gebruiken dezelfde statusclassificatie.
- [ ] Alle bestaande databasewaarden zijn gemigreerd of expliciet als legacy behandeld.
- [ ] Exhaustieve tests falen bij een nieuw enumlid zonder mapping.

**Risico bij niet aanpassen**

Records kunnen in verkeerde secties, locks of rapporten terechtkomen en lifecyclechecks drijven verder uit elkaar.

**Afhankelijkheden**

- Businessbesluiten voor ongedefinieerde workflows
- Datamigratie en backward compatibility

**Gerelateerde bevindingen**

- REV-0006
- REV-0035
- REV-0043

#### REV-0042 — Hard delete wist officiële historie en zelfs de auditsporen zonder vastgesteld retentiebeleid

- **Module:** Database en Prisma
- **Submodule:** Retentie, anonimiseren en bewijs
- **Scherm/pagina:** Permanente delete van gebruiker, team, KPI, kapstok en criterium
- **Route:** Management delete-API's
- **Component/bestand:** `lib/server/permanent-delete.ts`, beheercomponenten
- **Functie/API/model:** `permanentlyDeleteUser`, `permanentlyDeleteKpi`, `permanentlyDeleteFocus`
- **Type:** DATA / SECURITY / FUNCTIONEEL
- **Prioriteit:** P1
- **Status:** Beslissing vereist
- **Zekerheid:** Bevestigd gedrag; gewenst retentiebeleid ongedefinieerd
- **Rollen:** Super Admin
- **Land/teamcontext:** Globaal
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

De functies verwijderen scores, interventies, hulpaanvragen, actiepunten, KPI-snapshots en bij userdelete expliciet diens `AuditLog`-records. De UI meldt dat alle historie definitief verdwijnt. Er is geen repositorybreed juridisch/businessretentie- en anonimiseringsbeleid gevonden dat bepaalt welke coaching-, HR-, commerciële, financiële of auditgegevens vernietigd mogen worden.

**Verwachte of gewenste situatie**

De organisatie moet per datatype bewaartermijn, legal hold, verwijdergrond, anonimiseringsmethode en bevoegde actor goedkeuren. Officiële historie en audit horen niet door een generieke beheeractie ongeregistreerd te verdwijnen.

**Waarom dit een probleem is**

Hard delete kan arbeids-/coachingbewijs, KPI-herkomst en auditbewijs vernietigen. Anderzijds kan onbegrensd bewaren privacyregels schenden; zonder beleid is geen van beide betrouwbaar.

**Stappen om vast te stellen of te reproduceren**

1. Lees de deletehelpers en inventariseer alle `deleteMany`-calls.
2. Controleer dat userdelete de eigen auditlogs wist.
3. Zoek een eigenaar/retentiematrix in business/technical docs; die ontbreekt of is leeg.

**Technische vaststelling**

Deletes lopen transactioneel, maar er is geen tombstone, legal-holdcheck, geanonimiseerde actor snapshot of afzonderlijk onveranderlijk deletion auditrecord binnen dezelfde transactie.

**Bewijs**

- Bestand: `lib/server/permanent-delete.ts`, `components/user-management.tsx`
- Regel of codeblok: userdelete regels 52-85; KPI/focus/criteriondelete regels 117-176
- Route: permanente beheerdelete
- Scherm: deleteconfirmatietekst in gebruikersbeheer gelezen; geen delete uitgevoerd
- Log: de te verwijderen auditlogs verdwijnen mee
- Query: meerdere harde deletes
- Gerelateerde documentatie: `docs/business/*` is leeg; `docs/ai/02_DATABASE.md`

**Voorgestelde aanpassing**

Schakel hard delete standaard uit tot een goedgekeurde retentiematrix bestaat. Implementeer waar passend deactiveren/pseudonimiseren met immutable business- en actor snapshots, legal hold en een afzonderlijk streng beschermd deletionevent.

**Acceptatiecriteria**

- [ ] Elk datatype heeft eigenaar, bewaartermijn en verwijder-/anonimiseerregel.
- [ ] Legal hold blokkeert destructie.
- [ ] Auditbewijs kan niet door dezelfde actie worden uitgewist.
- [ ] UI toont vooraf scope, gevolgen en herstelbaarheid.
- [ ] Privacy, HR/legal en security hebben het beleid goedgekeurd.

**Risico bij niet aanpassen**

Essentiële historie kan onherstelbaar verdwijnen of persoonsgegevens worden zonder geldige termijn bewaard.

**Afhankelijkheden**

- Juridisch/HR/privacybesluit
- Datamodel voor pseudonieme actor- en recordsnapshots

**Gerelateerde bevindingen**

- REV-0017
- REV-0025

#### REV-0025 — Permanente userdelete is niet verenigbaar met SalesDay- en Inventory-relaties

- **Module:** Database en Prisma
- **Submodule:** Referentiële integriteit bij gebruikersverwijdering
- **Scherm/pagina:** Beheer — Gebruiker permanent verwijderen
- **Route:** user-delete-API
- **Component/bestand:** `lib/server/permanent-delete.ts`, `prisma/schema.prisma`, `components/user-management.tsx`
- **Functie/API/model:** `permanentlyDeleteUser`, `User`-relaties met `onDelete: Restrict`
- **Type:** BUG / DATA / DATABASE
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Super Admin en te verwijderen gebruikers
- **Land/teamcontext:** Alle landen en domeinen
- **Omgeving:** Codeanalyse

**Huidige situatie**

De deletefunctie ruimt handmatig vooral Coachingrecords, persoonlijke criteria, hulpaanvragen, actiepunten en auditlogs op en roept daarna `tx.user.delete` aan. Het nieuwere schema bevat vele verplichte gebruikersrelaties met `onDelete: Restrict`, onder meer SalesAppointment, documenten, cash, voorraadontvangsten/-tellingen, bezoekverslagen, ERP-commands en device-control. Deze records worden niet behandeld. Zodra een gebruiker zulke historie heeft, faalt de userdelete en rolt de hele transactie terug, terwijl de UI belooft dat gebruiker en alle historie worden verwijderd.

**Verwachte of gewenste situatie**

Het accountlifecyclebeleid moet alle domeinen omvatten. Normaal hoort operationele historie behouden en de gebruiker geanonimiseerd/gedeactiveerd te worden; een uitzonderlijke hard delete vereist een vooraf berekende dependencyanalyse en juridisch goedgekeurd beleid.

**Waarom dit een probleem is**

De beheeractie werkt precies niet voor operationeel gebruikte accounts en haar belofte is technisch onjuist. Pogingen kunnen supportincidenten veroorzaken en verleiden tot handmatige database-ingrepen.

**Stappen om vast te stellen of te reproduceren**

1. Maak in een geïsoleerde testdatabase een gebruiker met bijvoorbeeld een `SalesAppointment` of `InventoryReceipt` als actor.
2. Roep `permanentlyDeleteUser` aan met correcte bevestiging.
3. Observeer de foreign-keyrestrictie op `tx.user.delete`.
4. Vergelijk de opgeschoonde modellen in de functie met alle `User`-relaties in het schema.

**Technische vaststelling**

De helper kent alleen het oudere Coachingdeel. Vanaf schemaregels circa 2230 bestaan veel `User`-foreign keys met `Restrict`; er is geen dynamische preflight of domeinbrede dependencyservice.

**Bewijs**

- Bestand: `lib/server/permanent-delete.ts`, `prisma/schema.prisma`, `components/user-management.tsx`
- Regel of codeblok: deletehelper regels 12-91; Restrict-relaties onder meer rond schema 2233, 2566, 2669, 2891, 3013, 3055 en 3533
- Route: permanente userdelete
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: `tx.user.delete` na onvolledige handmatige cleanup
- Gerelateerde documentatie: `docs/ai/02_DATABASE.md`, SalesDay- en Inventory-mijlpaaldocumenten

**Voorgestelde aanpassing**

Stop de huidige hard-deleteactie voor gebruikers met operationele historie. Ontwerp een domeinbreed deactivate/anonymize-retentieproces met immutable actor snapshot waar nodig. Voeg voor eventuele wettelijke delete een read-only preflight toe die alle relaties rapporteert en laat elk nieuw model expliciet lifecyclebeleid declareren.

**Acceptatiecriteria**

- [ ] De UI belooft alleen gedrag dat voor alle domeinrelaties is geïmplementeerd.
- [ ] Operationele en financiële historie blijft volgens goedgekeurd retentiebeleid herleidbaar zonder onnodige persoonsgegevens.
- [ ] Een preflight toont alle blockers vóór een mutatie start.
- [ ] Schemaregressietests detecteren nieuwe User-relaties zonder delete-/anonimiseerbeleid.
- [ ] Geen productiebeheerder hoeft foreign keys handmatig te omzeilen.

**Risico bij niet aanpassen**

Verwijderingen falen voor actieve gebruikers of leiden tot risicovolle handmatige opschoning van operationele data.

**Afhankelijkheden**

- Retentie- en anonimiseringsbesluit uit REV-0042
- Domeineigenaars SalesDay, Inventory, Contract en Coaching

**Gerelateerde bevindingen**

- REV-0021
- REV-0042

#### REV-0033 — Migratienummers zijn meervoudig gebruikt en migratie 0050/0051 dupliceert dezelfde reparatie

- **Module:** Database en Prisma
- **Submodule:** Migratievolgorde en releasebeheer
- **Scherm/pagina:** Niet van toepassing
- **Route:** Deployment `prisma migrate deploy`
- **Component/bestand:** `prisma/migrations/*`
- **Functie/API/model:** Prisma migration history
- **Type:** DATABASE / DEPLOYMENT / TECHNISCH
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Technisch beheer
- **Land/teamcontext:** Alle omgevingen
- **Omgeving:** Repositoryanalyse; geen migratie uitgevoerd

**Huidige situatie**

De migratiemap bevat twee onafhankelijke directories met prefix `0036`, twee met `0037` en twee met `0038`. Daarnaast bestaan `0050_coaching_clear_legacy_default_nvt` en `0051_coaching_clear_legacy_default_nvt` met dezelfde naam/doelindicatie. Prisma ordent op volledige directorynaam, maar menselijke runbooks, scripts en incidentcommunicatie verwijzen geregeld alleen naar het nummer.

**Verwachte of gewenste situatie**

Iedere release-/migratie-identificatie moet uniek, monotone en ondubbelzinnig zijn. Dubbele reparaties moeten inhoudelijk vergeleken en als bewuste opvolger of historische duplicatie gedocumenteerd worden.

**Waarom dit een probleem is**

Bij databaseincidenten kan 'migratie 0037' naar twee verschillende wijzigingen verwijzen. Handmatige resolve/runbookstappen en auditbewijs worden foutgevoelig; dubbele SQL kan onbedoeld tweemaal draaien.

**Stappen om vast te stellen of te reproduceren**

1. Sorteer de directories onder `prisma/migrations`.
2. Observeer dubbele numerieke prefixes 0036, 0037 en 0038 en de herhaalde reparatienaam 0050/0051.
3. Vergelijk verwijzingen in documentatie/scripts die een nummer zonder volledige naam gebruiken.

**Technische vaststelling**

De directories zijn reeds deel van de migratiehistorie en mogen niet lichtvaardig hernoemd worden. Het probleem vraagt daarom documentatie, inhoudsvergelijking en een toekomstige unieke naming policy, niet een ad-hoc rename.

**Bewijs**

- Bestand: `prisma/migrations`
- Regel of codeblok: directorynamen `0036_contract_calculation`, `0036_starter_evaluation_question_schema_repair`, overeenkomstige 0037/0038-paren en 0050/0051 repair
- Route: deployment
- Scherm: niet van toepassing
- Log: niet van toepassing
- Query: geen migratie uitgevoerd volgens auditbeperking
- Gerelateerde documentatie: `docs/ai/02_DATABASE.md`, `docs/ai/06_DEPLOYMENT.md`

**Voorgestelde aanpassing**

Maak een migratiematrix met volledige directorynaam, checksum, doel, afhankelijkheid en uitgerolde omgevingen. Vergelijk 0050/0051 inhoudelijk. Leg voor nieuwe migraties een timestamp of centraal toegewezen uniek volgnummer vast en gebruik in scripts altijd de volledige id.

**Acceptatiecriteria**

- [ ] Iedere bestaande dubbelprefix is ondubbelzinnig gedocumenteerd.
- [ ] 0050 en 0051 zijn inhoudelijk vergeleken en de reden voor beide is vastgelegd.
- [ ] Nieuwe migraties kunnen geen bestaand id/prefix hergebruiken.
- [ ] Deploymentrunbooks noemen volledige migratienamen.
- [ ] Een repositorycheck faalt op toekomstige duplicate identifiers.

**Risico bij niet aanpassen**

Database-uitrol, herstel en incidentanalyse blijven vatbaar voor selectie van de verkeerde migratie.

**Afhankelijkheden**

- Controle van reeds toegepaste `_prisma_migrations` per omgeving
- Release-/migratienamingbesluit

**Gerelateerde bevindingen**

- REV-0032
- REV-0030

### 26. API-routes en server-side acties

#### REV-0004 — Gedeelde workflow-GET koppelt alle workflowmodules aan Begeleidingen

- **Module:** API-routes en server-side acties
- **Submodule:** Workflowstate lezen en module-isolatie
- **Scherm/pagina:** Begeleidingen, Contactmomenten, Hulpaanvragen, Retrainingen en Salestrainingen
- **Route:** `GET /api/workflows`
- **Component/bestand:** `app/api/workflows/route.ts`, `lib/server/workflows.ts`, `lib/data-access.ts`
- **Functie/API/model:** `GET`, `loadWorkflowStateFromDatabase`, `getVisibleWorkflowState`
- **Type:** RECHTEN / SECURITY / API / PERFORMANCE
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle workflowgebruikers
- **Land/teamcontext:** Gebruiker, team en land
- **Omgeving:** Codeanalyse

**Huidige situatie**

De ene GET-route levert Begeleidingen, Contactmomenten, Hulpaanvragen, Retrainingen en Salestrainingen samen. Alleen toegang tot de module `BEGELEIDINGEN` bepaalt of de interventiequery zichtbaar is. Er is geen afzonderlijke activatie- of menurechtcontrole per meegeleverde workflowsoort. Een gebruiker met Contactmoment- of Hulpaanvraagrecht maar zonder Begeleidingen krijgt daardoor geen bruikbare state; omgekeerd kan een gebruiker met Begeleidingenrecht state van uitgeschakelde workflowmodules ontvangen als de latere gebruikersfilter die records zichtbaar acht.

**Verwachte of gewenste situatie**

Iedere workflowmodule moet server-side haar eigen moduleactivatie, permissie en scope afdwingen. Een samengestelde endpoint is alleen acceptabel als elk deel onafhankelijk gefilterd en expliciet aangevraagd wordt; bij voorkeur bestaan gerichte endpoints met beperkte payloads.

**Waarom dit een probleem is**

Moduledeactivatie en menurechten zijn niet betrouwbaar als databescherming. De route overfetches bovendien alle workflowsoorten en alle hulpaanvragen, waardoor responstijd, geheugen en privacy-impact toenemen.

**Stappen om vast te stellen of te reproduceren**

1. Geef een testgebruiker toegang tot Begeleidingen maar schakel Hulpaanvragen of Contactmomenten uit.
2. Roep `GET /api/workflows` aan.
3. Controleer dat de server alleen `BEGELEIDINGEN` voor de primaire interventiefilter beoordeelt en de samengestelde state retourneert.
4. Herhaal met alleen Contactmomentrecht zonder Begeleidingen en vergelijk het resultaat.

**Technische vaststelling**

`app/api/workflows/route.ts` gebruikt `canAccessCoachingModuleNavigation(actor, "BEGELEIDINGEN")` voor de gehele route. `loadWorkflowStateFromDatabase` doet vervolgens één brede `intervention.findMany` en een onbegrensde `helpRequest.findMany`; `getVisibleWorkflowState` filtert op recordscope, niet op de afzonderlijke moduleactivaties.

**Bewijs**

- Bestand: `app/api/workflows/route.ts`, `lib/server/workflows.ts`, `lib/data-access.ts`
- Regel of codeblok: route regels 12-20; workflows rond regels 54-91
- Route: `GET /api/workflows?actorId=...`
- Scherm: workflowproviders worden globaal geladen; afzonderlijke rechtenaccounts waren niet beschikbaar
- Log: niet van toepassing
- Query: brede `prisma.intervention.findMany` en `prisma.helpRequest.findMany`
- Gerelateerde documentatie: `docs/ai/03_ROLES.md`, modulebestanden onder `docs/ai/modules/Coaching/`

**Voorgestelde aanpassing**

Splits de read-API per workflowsoort of voeg een getypeerde `include`-selectie toe die alleen door server-side toegestane modules kan worden gevuld. Pas per subset moduleactivatie, menurecht, recordrecht en effectieve scope toe vóór de databasequery. Voeg paginering toe voor historie en hulpaanvragen.

**Acceptatiecriteria**

- [ ] Een uitgeschakelde workflowmodule levert nul records, ook via een andere module-endpoint.
- [ ] Contactmomenten en Hulpaanvragen werken onafhankelijk van Begeleidingen wanneer hun eigen rechten dat toestaan.
- [ ] De databasequery haalt alleen aangevraagde en geautoriseerde recordtypes op.
- [ ] Negatieve tests dekken elke combinatie van module aan/uit en menu toegestaan/geweigerd.
- [ ] Historische collecties zijn begrensd of gepagineerd.

**Risico bij niet aanpassen**

Gebruikers kunnen data van uitgeschakelde modules ontvangen of geldige functies verliezen door een ongerelateerd recht; groeiende historie maakt elke pagina zwaarder.

**Afhankelijkheden**

- Provideropsplitsing uit REV-0011
- Definitieve workflowmodulematrix

**Gerelateerde bevindingen**

- REV-0001
- REV-0005
- REV-0006
- REV-0011

#### REV-0005 — Workflowmutaties controleren niet consequent het eigen module- en menurecht

- **Module:** API-routes en server-side acties
- **Submodule:** Autorisatie van workflowmutaties
- **Scherm/pagina:** Nieuwe Contactmomenten, Hulpaanvragen, Retrainingen en Salestrainingen
- **Route:** `POST /api/workflows/*`
- **Component/bestand:** `app/api/workflows/persist-route.ts`
- **Functie/API/model:** `persistWorkflowRoute`, `requireWorkflowPermission`, `canCreateHelpWorkflow`
- **Type:** RECHTEN / SECURITY / API
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Vertegenwoordiger, Verkoopleider, Sales Manager, Country Manager, Group Manager, Admin en Super Admin
- **Land/teamcontext:** Gebruiker, team en land
- **Omgeving:** Codeanalyse

**Huidige situatie**

De centrale schrijfroute gebruikt per routenaam verschillende hardcoded checks. Contactmomenten vereisen generiek `canCreateIntervention`, niet het eigen module-/menurecht. Voor Hulpaanvragen worden vrijwel alle bekende rollen automatisch toegelaten en wordt `help-request:create` alleen voor rollen buiten die lijst gecontroleerd. Retrainingen en Salestrainingen gebruiken uitsluitend een rolarray. De actieve module en het specifieke menurecht worden niet uniform afgedwongen.

**Verwachte of gewenste situatie**

Elke mutatie moet server-side een expliciet capabilitycontract toepassen: actieve module, relevante rolpermission/useroverride, recordactie, lifecyclelock en effectieve scope. Hardcoded rolarrays mogen een configureerbare permission niet omzeilen.

**Waarom dit een probleem is**

Een gebruiker kan via een directe POST een functie uitvoeren die in menu of rolconfiguratie is uitgezet. Dit ondermijnt het beheermodel en maakt user overrides schijnbaar maar niet werkelijk effectief.

**Stappen om vast te stellen of te reproduceren**

1. Trek voor een testrol het specifieke Hulpaanvraag-, Contactmoment- of trainingsrecht in.
2. Verstuur met dezelfde aangemelde sessie een geldige patch rechtstreeks naar de betreffende POST-route.
3. Observeer dat `requireWorkflowPermission` voor meerdere routes alleen naar rol of een generiek interventierecht kijkt.

**Technische vaststelling**

`requireWorkflowPermission` bevat route-specifieke uitzonderingen: generieke `canCreateIntervention`, `canCreateHelpWorkflow` met een brede rolarray, en `requireRole` voor trainingen. Er is geen gedeelde controle op `canAccessCoachingModuleNavigation` of op de eigen modulecode.

**Bewijs**

- Bestand: `app/api/workflows/persist-route.ts`
- Regel of codeblok: regels 690-724
- Route: `POST /api/workflows/contact-moments`, `/help-requests`, `/retrainings`, `/sales-trainings`
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: mutatie volgt na de genoemde autorisatiecheck
- Gerelateerde documentatie: `docs/ai/03_ROLES.md` en de afzonderlijke Coaching-modulebestanden

**Voorgestelde aanpassing**

Definieer per workflowactie één server-side permission descriptor met modulecode, permissionkey, toegestane actor-subjectrelatie en statusovergangen. Laat zowel route als UI deze descriptor gebruiken en voeg directe API-negatieftests toe voor rolgrant, user-deny, module-uit en buiten-scope record.

**Acceptatiecriteria**

- [ ] Iedere workflow-POST weigert wanneer de eigen module inactief is.
- [ ] Een expliciete user-deny kan geen hardcoded rolarray omzeilen.
- [ ] De permissionkey is per create/update/close/approve-actie aantoonbaar.
- [ ] Lifecycle- en scopecontroles worden na capabilitycontrole server-side uitgevoerd.
- [ ] De tests roepen de API rechtstreeks aan en vertrouwen niet op verborgen knoppen.

**Risico bij niet aanpassen**

Onbevoegde workflowmutaties kunnen dossiers, communicatie, notificaties en auditgeschiedenis beïnvloeden ondanks beheerinstellingen die de actie ogenschijnlijk blokkeren.

**Afhankelijkheden**

- Eenduidige permissionnamen per workflowactie
- REV-0002 en REV-0003 voor effectieve scope

**Gerelateerde bevindingen**

- REV-0001
- REV-0004
- REV-0006

#### REV-0006 — Ongedefinieerde trainingsworkflows zijn al productief schrijfbaar

- **Module:** API-routes en server-side acties
- **Submodule:** Retrainingen en Salestrainingen
- **Scherm/pagina:** Nieuwe retraining en nieuwe salestraining
- **Route:** `/retrainingen`, `/sales-trainingen`, `POST /api/workflows/retrainings`, `POST /api/workflows/sales-trainings`
- **Component/bestand:** `components/training-workflow.tsx`, `app/api/workflows/persist-route.ts`, `lib/workflow-engine.ts`
- **Functie/API/model:** `TrainingWorkflowPage`, `requireWorkflowPermission`, `saveRetraining`, `saveSalesTraining`
- **Type:** FUNCTIONEEL / RECHTEN / DATA
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Meerdere operationele en managementrollen
- **Land/teamcontext:** Team en land
- **Omgeving:** Codeanalyse

**Huidige situatie**

Retrainingen en Salestrainingen hebben routes, UI, databasepersistentie en schrijfautorisatie. De actuele owning documentatie markeert beide complete workflows echter als `UNDEFINED` en waarschuwt dat ontbrekend businessgedrag niet mag worden uitgevonden. Toch kunnen brede rolsets records aanmaken en wijzigen.

**Verwachte of gewenste situatie**

Een ongedefinieerde workflow mag niet als normale productiefunctie schrijfbaar zijn. Tot businessstatussen, eigenaarschap, deelnemers, locks, notificaties, rapportage en rechten zijn goedgekeurd, hoort de functie achter een server-side ontwikkel/featureflag of volledig read-only te blijven.

**Waarom dit een probleem is**

De applicatie creëert duurzame businessdata volgens niet-goedgekeurde regels. Latere normalisatie kan bestaande trainingen onjuist classificeren, verkeerde personen informeren of historie onbruikbaar maken.

**Stappen om vast te stellen of te reproduceren**

1. Open de trainingsroutes met een rol uit de hardcoded toegestane lijst.
2. Vergelijk de beschikbare create/save-logica met `Retrainingen.md` en `Salestrainingen.md`.
3. Stel vast dat de code mutaties ondersteunt terwijl de documentatie de workflow als ongedefinieerd markeert.

**Technische vaststelling**

De generieke trainingscomponent en workflow-engine modelleren invoer en status. De persistence-route staat Representatieve en managementrollen toe. Er is geen server-side flag die de ongedefinieerde productiestatus afdwingt.

**Bewijs**

- Bestand: `app/api/workflows/persist-route.ts`, `components/training-workflow.tsx`, `lib/workflow-engine.ts`
- Regel of codeblok: permissionblok rond regels 704-715 en trainingspersistentiestromen
- Route: `/retrainingen`, `/sales-trainingen`
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: trainingdetails en deelnemers worden persistent opgeslagen
- Gerelateerde documentatie: `docs/ai/modules/Coaching/Retrainingen.md`, `docs/ai/modules/Coaching/Salestrainingen.md`

**Voorgestelde aanpassing**

Laat productiestatus fail-closed totdat de businessdocumenten `DEFINED` zijn en een besluit alle lifecyclepunten invult. Inventariseer bestaande records als prototype/testdata, bepaal migratie of opschoning apart en activeer later via een expliciete module- en serverfeaturegate.

**Acceptatiecriteria**

- [ ] In productie is geen trainingsmutatie mogelijk zolang de owning workflow `UNDEFINED` is.
- [ ] Alle statussen, locks, deelnemersrechten, notificaties en rapportage-effecten zijn vooraf gedocumenteerd.
- [ ] Bestaande records zijn geïnventariseerd en krijgen een goedgekeurde migratiebehandeling.
- [ ] Positieve en negatieve lifecycle- en rechten-tests bestaan vóór activatie.

**Risico bij niet aanpassen**

Niet-goedgekeurde businesshandelingen worden als officiële historie opgeslagen en kunnen arbeids-, privacy- of rapportagegevolgen hebben.

**Afhankelijkheden**

- Businessbesluiten van module-eigenaar
- Featureflag- en releasebeleid

**Gerelateerde bevindingen**

- REV-0005
- REV-0014
- REV-0029

#### REV-0007 — Workflowpatches hebben geen runtime-schema aan de API-grens

- **Module:** API-routes en server-side acties
- **Submodule:** Invoervalidatie en contracten
- **Scherm/pagina:** Alle workflowformulieren
- **Route:** `POST /api/workflows/*`
- **Component/bestand:** `app/api/workflows/persist-route.ts`
- **Functie/API/model:** `persistWorkflowRoute`, `WorkflowPersistencePatch`
- **Type:** API / SECURITY / DATA / TECHNISCH
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle workflowgebruikers
- **Land/teamcontext:** Niet van toepassing
- **Omgeving:** Codeanalyse

**Huidige situatie**

De route cast `await request.json()` rechtstreeks naar `WorkflowPersistencePatch`. TypeScripttypes bestaan alleen tijdens compilatie en valideren geen HTTP-payload. Latere code bevat wel losse businesschecks en overschrijft bepaalde actorvelden, maar objectvorm, onbekende velden, stringlengtes, arrays, enumwaarden en geneste limieten worden niet centraal en volledig aan de grens gevalideerd.

**Verwachte of gewenste situatie**

Elke API accepteert alleen een versieerbaar runtime-schema met strikte objecten, begrensde tekst/arrays, geldige enums en route-specifieke velden. Onbekende of ongeldige input geeft een consistente 400 zonder databasewerk, mail of notificaties.

**Waarom dit een probleem is**

Gemanipuleerde of beschadigde clients kunnen onverwachte branches, databasefouten, zeer grote payloads of gedeeltelijk gevalideerde data veroorzaken. De losse validaties zijn moeilijk volledig te testen en drijven per workflow uit elkaar.

**Stappen om vast te stellen of te reproduceren**

1. Verstuur een workflowpatch met verkeerde types, onbekende properties, zeer grote arrays of een ongeldige status.
2. Observeer dat de route de payload compile-time cast en pas later faalt of delen verwerkt.
3. Vergelijk met een expliciet runtime-schema; dat ontbreekt in de route.

**Technische vaststelling**

Rond regel 50 staat `(await request.json()) as WorkflowPersistencePatch`. De `selectPatch`-wrappers beperken top-level delen, maar vormen geen runtimevalidatie van de geneste objecten.

**Bewijs**

- Bestand: `app/api/workflows/persist-route.ts`
- Regel of codeblok: regels 47-55
- Route: alle workflow-POST-routes
- Scherm: niet van toepassing
- Log: niet gemanipuleerd getest om datawijziging te vermijden
- Query: validatie vindt niet volledig vóór de persistenceflow plaats
- Gerelateerde documentatie: `docs/ai/05_DEVELOPMENT_STANDARDS.md`

**Voorgestelde aanpassing**

Definieer per route een strict runtime-schema en een gedeeld schema voor herbruikbare identifiers, datums, rich text, status en paginering. Valideer vóór autorisatie-afhankelijke recordreads waar mogelijk, geef veldgerichte 400-errors en leg maximale bodygrootte op aan proxy en applicatie.

**Acceptatiecriteria**

- [ ] Iedere workflow-POST parseert een strict runtime-schema.
- [ ] Onbekende velden, ongeldige enums en verkeerde geneste types worden met 400 geweigerd.
- [ ] Teksten, arrays en totale bodygrootte hebben gedocumenteerde maxima.
- [ ] Fuzz-/contracttests bewijzen dat ongeldige input geen DB-, mail- of notificatieactie start.

**Risico bij niet aanpassen**

Onverwachte payloads kunnen 500-fouten, resource-uitputting of inconsistente persistente workflowdata veroorzaken.

**Afhankelijkheden**

- Keuze van runtime-schemabibliotheek of bestaande validatorstandaard
- Routeversiebeleid

**Gerelateerde bevindingen**

- REV-0005
- REV-0010

#### REV-0047 — Applicatieresponses hebben geen Content Security Policy en HSTS is niet in repositorybeheer zichtbaar

- **Module:** API-routes en server-side acties
- **Submodule:** HTTP security headers
- **Scherm/pagina:** Globaal
- **Route:** Alle routes
- **Component/bestand:** `next.config.ts`
- **Functie/API/model:** `headers()`
- **Type:** SECURITY / DEPLOYMENT
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** CSP-afwezigheid bevestigd; HSTS kan extern op proxy bestaan en is daar niet geverifieerd
- **Rollen:** Alle gebruikers
- **Land/teamcontext:** Globaal
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

Next configureert `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy en een strenge Permissions-Policy. Een Content-Security-Policy ontbreekt. HSTS, COOP/CORP en een gedocumenteerde reverse-proxyheaderverantwoordelijkheid zijn niet in de repositoryconfiguratie zichtbaar. De applicatie verwerkt rich text, afbeeldingen, PDF en externe auth, waardoor een passende policy expliciet ontworpen moet worden.

**Verwachte of gewenste situatie**

Productie heeft een geteste CSP met minimaal script/style/img/connect/frame/base/form/object-beperkingen, nonce/hashstrategie en reporting. TLS/HSTS en andere headers zijn aantoonbaar door app of proxy beheerd zonder duplicatieconflict.

**Waarom dit een probleem is**

Zonder CSP ontbreekt een belangrijke tweede verdedigingslaag tegen XSS en ongewenste resourceconnecties. Onduidelijk proxy-eigenaarschap maakt beveiliging omgevingsafhankelijk.

**Stappen om vast te stellen of te reproduceren**

1. Lees `next.config.ts` en productie-deploymentdocumentatie.
2. Inspecteer responseheaders in een productieachtige omgeving.
3. Stel vast dat CSP in de app ontbreekt en verifieer afzonderlijk of proxy HSTS toevoegt.

**Technische vaststelling**

De `headers()`-array bevat vier headers en geen CSP/HSTS. Een nonce vereist afstemming met Next.js rendering, Auth.js, inline styles en toegestane data/blob images.

**Bewijs**

- Bestand: `next.config.ts`
- Regel of codeblok: globale headerlijst rond regels 24-38
- Route: globaal
- Scherm: localhostheaders niet als productie-evidence gebruikt
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/06_DEPLOYMENT.md`

**Voorgestelde aanpassing**

Begin CSP in report-only, inventariseer legitieme bronnen en migreer naar enforce met nonces/hashes. Leg in deployment vast welke laag HSTS/TLS/COOP/CORP bezit en voeg een productieheadersmoke-test toe.

**Acceptatiecriteria**

- [ ] Productie retourneert een geteste, afdwingende CSP.
- [ ] Geen `unsafe-eval`; `unsafe-inline` is verwijderd of strikt gemotiveerd/begrensd.
- [ ] Auth, PDF, uploads, rich text en PWA werken onder de policy.
- [ ] HSTS is aantoonbaar actief op de publieke HTTPS-host met correct rolloutbeleid.
- [ ] Headers worden automatisch in productieconfiguratie gecontroleerd.

**Risico bij niet aanpassen**

Een XSS- of resource-injectiefout heeft meer impact en securityheaders kunnen per omgeving onbedoeld ontbreken.

**Afhankelijkheden**

- Reverse-proxy/Pleskconfiguratie
- CSP-compatibiliteit van Next.js en gebruikte libraries

**Gerelateerde bevindingen**

- REV-0027
- REV-0032

#### REV-0048 — Enkele download- en avatar-API's sturen interne foutmeldingen rechtstreeks naar de client

- **Module:** API-routes en server-side acties
- **Submodule:** Foutafhandeling en informatielek
- **Scherm/pagina:** Contractdownload, avatar en contactfoto's
- **Route:** Onder meer `/api/contract/documents/[id]/download`, `/api/users/[id]/avatar`
- **Component/bestand:** genoemde routebestanden, `lib/server/api.ts`
- **Functie/API/model:** lokale `try/catch`-responses buiten `handleApi`
- **Type:** SECURITY / API / UX
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Aangemelde gebruikers binnen routebereik
- **Land/teamcontext:** Recordscope
- **Omgeving:** Codeanalyse

**Huidige situatie**

De centrale `handleApi` verbergt onverwachte error details in productie en geeft een request-id. Meerdere routes omzeilen dit patroon en retourneren voor iedere `Error` direct `error.message`, ook bij filesystem-, Prisma- of libraryfouten. Zulke meldingen kunnen paden, constraintnamen of interne implementatiedetails bevatten en missen soms correlation-id.

**Verwachte of gewenste situatie**

Alle routes gebruiken dezelfde veilige errornormalisatie: alleen expliciete `ApiRequestError`-meldingen naar de client, onverwachte details uitsluitend in geredigeerde serverlogs met request-id.

**Waarom dit een probleem is**

Interne details helpen aanvallers de opslag-/databasestructuur te verkennen en geven eindgebruikers onbegrijpelijke fouten. Afwijkende handlers bemoeilijken support en monitoring.

**Stappen om vast te stellen of te reproduceren**

1. Simuleer in een test een filesystem- of Prisma-error in een lokale catch-route.
2. Observeer dat `error.message` in JSON verschijnt.
3. Vergelijk met `handleApi`, dat in productie een fallback plus request-id gebruikt.

**Technische vaststelling**

Routezoektocht vindt directe message-responses in contractdownload, useravatar, contactfoto's en import/export. Niet elke route classificeert `ApiRequestError` versus onverwachte error correct.

**Bewijs**

- Bestand: `app/api/contract/documents/[id]/download/route.ts`, `app/api/users/[id]/avatar/route.ts`, contactfoto-routes, `lib/server/api.ts`
- Regel of codeblok: contractdownload rond regels 20-29; avatar catches rond regels 25-33 en 55-64
- Route: genoemde endpoints
- Scherm: fout niet kunstmatig veroorzaakt
- Log: centrale wrapper heeft request-id; lokale routes niet uniform
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/05_DEVELOPMENT_STANDARDS.md`

**Voorgestelde aanpassing**

Breid de centrale wrapper uit voor JSON, streams/downloads en created responses. Map bekende domainerrors expliciet en redigeer onverwachte errors. Voeg een lint-/routecontractcheck toe voor directe `error.message`-responses.

**Acceptatiecriteria**

- [ ] Onverwachte errors lekken geen path, SQL, stack of librarydetail.
- [ ] Iedere foutresponse bevat een traceerbare request-id.
- [ ] Expliciete 400/401/403/404 behouden veilige gebruikersmelding.
- [ ] Download-/streamroutes gebruiken dezelfde normalisatie.
- [ ] Tests injecteren filesystem-, Prisma- en validatiefouten.

**Risico bij niet aanpassen**

Interne infrastructuurdetails kunnen uitlekken en fouten zijn niet uniform te ondersteunen.

**Afhankelijkheden**

- Gestructureerde logging uit REV-0041
- Centrale responsehelper voor streams

**Gerelateerde bevindingen**

- REV-0041
- REV-0015

### 27. Achtergrondtaken en synchronisaties

### 28. Service worker en PWA

#### REV-0031 — README beschrijft de PWA/offline-architectuur als niet geïmplementeerd terwijl productiecode bestaat

- **Module:** Service worker en PWA
- **Submodule:** Technische documentatie
- **Scherm/pagina:** PWA-installatie en offline SalesDay
- **Route:** Service worker en SalesDay
- **Component/bestand:** `README.md`, `public/sw.js`, `lib/device/*`, `docs/ai/modules/Salesday/*`
- **Functie/API/model:** IndexedDB device store, sync queue, service worker
- **Type:** DOCUMENTATIE / PWA / TECHNISCH
- **Prioriteit:** P3
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Ontwikkelaars, testers en technisch beheer
- **Land/teamcontext:** Globaal
- **Omgeving:** Repositoryanalyse

**Huidige situatie**

De root-README noemt IndexedDB-opslag en mutation queue nog als ontbrekende vervolgstappen en presenteert FieldForce hoofdzakelijk als klikbaar prototype. De repository bevat inmiddels een service worker, encrypted device store, draft store, sync queue/runtime, device security en uitgebreide SalesDay-mijlpaaldocumentatie/tests. Tegelijkertijd heeft die echte service worker een kritieke fallbackbevinding (REV-0008). De primaire introductie leidt reviewers dus naar een verouderd risicobeeld.

**Verwachte of gewenste situatie**

README geeft de huidige architectuur en productiestatus op hoofdlijnen correct weer en linkt naar de owning documenten. Implemented, behind flag, externally blocked en not implemented moeten duidelijk onderscheiden zijn.

**Waarom dit een probleem is**

Ontwikkelaars kunnen bestaande offline-infrastructuur dupliceren of security-/logoutvereisten missen. Testers kunnen belangrijke PWA-risico's overslaan omdat de README suggereert dat de functie nog niet bestaat.

**Stappen om vast te stellen of te reproduceren**

1. Lees README-secties over status en vervolgstappen.
2. Inventariseer `public/sw.js`, `lib/device` en SalesDay-testscriptentries.
3. Vergelijk de claims over IndexedDB/mutation queue met de huidige code en mijlpaaldocs.

**Technische vaststelling**

README-regels rond 122 en 169 zetten offline-opslag nog op de roadmap. SalesDay-mijlpalen documenteren reeds encrypted IndexedDB, runtime queue en PWA-shell.

**Bewijs**

- Bestand: `README.md`, `public/sw.js`, `lib/device/*`, SalesDay-mijlpaaldocumenten
- Regel of codeblok: README regels 5, 122, 142-169
- Route: PWA/SalesDay
- Scherm: service-workerproductiecache niet runtime-geregistreerd op devserver
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/modules/Salesday/README.md`

**Voorgestelde aanpassing**

Herschrijf README als actuele ingang: productstatus per domein, architectuur, veilige start/checks en links naar owning docs. Laat details uitsluitend in module-/technical docs en voeg een docreview toe aan releasecriteria.

**Acceptatiecriteria**

- [ ] README claimt geen reeds geïmplementeerde functie als toekomstwerk.
- [ ] Prototype, feature-flagged, extern geblokkeerd en production-ready zijn zichtbaar onderscheiden.
- [ ] PWA/offlinebeschrijving linkt naar actuele security- en logoutcontracts.
- [ ] Alle links bestaan.
- [ ] Releasecheck bevat documentatiefreshness.

**Risico bij niet aanpassen**

Onjuiste architectuurbeslissingen en onvolledige tests ontstaan door een verouderde primaire bron.

**Afhankelijkheden**

- Documentatie-eigenaarschap uit REV-0030
- PWA-fix uit REV-0008

**Gerelateerde bevindingen**

- REV-0008
- REV-0030

#### REV-0008 — Service worker retourneert dashboard-HTML voor mislukte API- en bestandsrequests

- **Module:** Service worker en PWA
- **Submodule:** Offline fallback en cache-isolatie
- **Scherm/pagina:** Alle pagina's en API-consumers in productie-PWA
- **Route:** Iedere GET-request binnen de service-worker-scope
- **Component/bestand:** `public/sw.js`, `components/service-worker-registration.tsx`
- **Functie/API/model:** `fetch` event handler, `APP_SHELL`
- **Type:** BUG / PWA / API / SECURITY
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle PWA-gebruikers
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse; service worker wordt bewust niet op localhost geregistreerd

**Huidige situatie**

De service worker onderschept iedere GET. Wanneer de netwerkrequest faalt en geen exacte cachematch bestaat, retourneert hij altijd de gecachte `/dashboard`-response. Dat geldt ook voor `/api/...`, afbeeldingen, PDF-downloads en onbekende routes. De client verwacht dan bijvoorbeeld JSON of een afbeelding maar ontvangt HTML met een succesvolle cache-response. De dashboardcache wordt alleen bij een service-workerversie gewist en niet expliciet bij uitloggen.

**Verwachte of gewenste situatie**

Fallbacks moeten requesttype- en bestemmingbewust zijn. Navigaties mogen naar een niet-gevoelige offlinepagina; API-calls moeten een echte netwerk/offlinestatus of getypeerde fout krijgen; bestanden en assets mogen alleen exact-match cachen. Uitloggen moet usergebonden caches en offline state volgens beleid verwijderen of onbruikbaar maken.

**Waarom dit een probleem is**

API-parsers krijgen HTML en tonen misleidende syntax- of sessiefouten. Bestandsdownloads kunnen dashboardinhoud opleveren. Offline- en authenticatieproblemen worden daardoor onvoorspelbaar en zijn moeilijk te diagnosticeren.

**Stappen om vast te stellen of te reproduceren**

1. Bouw/deploy de productie-PWA en laat de service worker registreren.
2. Open FieldForce aangemeld zodat de app-shell is gecachet.
3. Maak de verbinding offline en roep een niet-gecachete GET-API of PDF-route aan.
4. Observeer dat de catch-fallback `caches.match('/dashboard')` retourneert.

**Technische vaststelling**

De fetchhandler controleert alleen `request.method !== 'GET'`. `Request.destination`, `mode`, URL-pad, contenttype en authenticatiestatus worden niet gebruikt. De fallback is voor alle GET's identiek.

**Bewijs**

- Bestand: `public/sw.js`, `components/service-worker-registration.tsx`
- Regel of codeblok: `sw.js` regels 23-28; registratie alleen in productie rond regels 20-25
- Route: alle GET-routes
- Scherm: niet runtime-getest omdat localhost de worker terecht verwijdert
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `README.md` sectie PWA; `docs/ai/modules/Salesday/DECISIONS.md` sectie 10

**Voorgestelde aanpassing**

Gebruik afzonderlijke strategieën: network-only/no-fallback voor API en private downloads, cache-first voor versievaste publieke assets, network-first voor navigaties met een statische `/offline`-pagina. Cache geen aangemelde HTML zonder expliciet privacyontwerp. Voeg een logoutbericht aan de worker toe dat relevante Cache Storage wist en coördineer dit met de versleutelde SalesDay-store.

**Acceptatiecriteria**

- [ ] Een offline API-call ontvangt nooit HTML of een 200-dashboardfallback.
- [ ] Private PDF-, avatar- en fotorequests worden niet generiek uit de app-shellcache bediend.
- [ ] Alleen documentnavigaties mogen naar een expliciete offlinepagina vallen.
- [ ] Uitloggen verwijdert of cryptografisch vergrendelt alle usergebonden offline data en caches.
- [ ] Productie-PWA-tests dekken online, offline, relogin en userwissel.

**Risico bij niet aanpassen**

Gebruikers krijgen corrupte responses en misleidende foutmeldingen; op gedeelde toestellen kan oude shellstate na uitloggen blijven bestaan en support kan echte netwerkincidenten niet betrouwbaar herkennen.

**Afhankelijkheden**

- Vast offline- en retentiebeleid
- Productieachtige HTTPS-testomgeving

**Gerelateerde bevindingen**

- REV-0013
- REV-0031

### 29. Logging, historiek en audittrail

#### REV-0017 — Auditlogging is fail-open en kan een handeling aan een willekeurige beheerder toeschrijven

- **Module:** Logging, historiek en audittrail
- **Submodule:** Centrale audithelper
- **Scherm/pagina:** Beheerlog en alle consumers van algemene auditlogging
- **Route:** Meerdere mutatie-API's
- **Component/bestand:** `lib/server/audit.ts`
- **Functie/API/model:** `writeAuditLog`, `resolveAuditUserId`, `AuditLog`
- **Type:** LOGGING / SECURITY / DATA
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle actoren; Super Admin/Admin als fallbackslachtoffer
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse

**Huidige situatie**

Iedere fout tijdens actorresolutie of auditinsert wordt gevangen en alleen naar console geschreven; de businessactie gaat door. Als een opgegeven actor-id niet gevonden wordt, kiest `resolveAuditUserId` de eerste actieve Super Admin of Admin en schrijft de log onder diens user-id. Een systeemactie of defecte actorreferentie kan daardoor als handeling van een onbetrokken persoon verschijnen.

**Verwachte of gewenste situatie**

Auditrecords moeten de werkelijke actor of expliciete systeemidentiteit onveranderlijk vastleggen. Verplichte audit moet atomair met de businessactie committen; optionele telemetry mag nooit een andere menselijke actor verzinnen.

**Waarom dit een probleem is**

De audittrail kan zowel ontbreken als feitelijk onjuist zijn. Dat ondermijnt onderzoek, aansprakelijkheid en elk formeel bewijs rond rechten-, financiële of workflowmutaties.

**Stappen om vast te stellen of te reproduceren**

1. Roep een consumer aan met een niet-bestaande of ontbrekende actor-id.
2. Controleer welk `userId` het auditrecord krijgt.
3. Simuleer een auditinsertfout en observeer dat de helper resolveert zonder de businessflow te blokkeren.

**Technische vaststelling**

`writeAuditLog` omhult resolutie en create in een brede `try/catch`. `resolveAuditUserId` zoekt na mislukte actorlookup een actieve `SUPER_ADMIN`/`ADMIN`, gesorteerd op rol en createdAt.

**Bewijs**

- Bestand: `lib/server/audit.ts`
- Regel of codeblok: regels 12-27 en 37-55
- Route: alle algemene auditconsumers
- Scherm: beheerlog niet met mutaties getest
- Log: auditfouten krijgen alleen `[audit]` op console
- Query: fallback `prisma.user.findFirst` op beheerrollen
- Gerelateerde documentatie: `docs/ai/01_ARCHITECTURE.md`, `docs/ai/02_DATABASE.md`

**Voorgestelde aanpassing**

Verwijder menselijke fallbackattributie. Modelleer `actorUserId` optioneel plus `actorType`, service principal/job-id en immutable actor snapshot. Laat kritieke audit via transaction client schrijven en behandel failures volgens expliciete fail-closedpolicy.

**Acceptatiecriteria**

- [ ] Geen auditrecord wordt ooit aan een andere menselijke gebruiker toegeschreven.
- [ ] Systeem- en achtergrondacties hebben een eigen expliciete actoridentiteit.
- [ ] Kritieke mutaties committen niet zonder vereiste audit.
- [ ] Auditfouten zijn alarmeerbaar en bevatten een correlation-id.
- [ ] Tests dekken ontbrekende, gedeactiveerde, verwijderde en systeemactoren.

**Risico bij niet aanpassen**

De audittrail kan onschuldige beheerders als actor aanwijzen of essentiële gebeurtenissen stil missen.

**Afhankelijkheden**

- Auditdatamodel en actorretentie
- Transactionele command-/outboxarchitectuur

**Gerelateerde bevindingen**

- REV-0012
- REV-0041

#### REV-0041 — Operationele fouten bestaan hoofdzakelijk als niet-duurzame consolelogs

- **Module:** Logging, historiek en audittrail
- **Submodule:** Observability en correlatie
- **Scherm/pagina:** Globaal
- **Route:** API, achtergrondworkers en integraties
- **Component/bestand:** `lib/server/api.ts`, meerdere `console.error`-consumers
- **Functie/API/model:** `handleApi`, request-idgeneratie
- **Type:** LOGGING / TECHNISCH / DEPLOYMENT
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Technisch beheer
- **Land/teamcontext:** Alle omgevingen
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

De centrale API-wrapper maakt een lokale `req_<tijd>_<random>`-id en logt fouten met `console.error`. Veel background/integratiefouten doen hetzelfde, soms zonder request-id. In de repository is geen gestructureerde logtransport-, tracing-, metriek-, alerting- of retentieconfiguratie gevonden. De response-id helpt alleen zolang de consolelog beschikbaar en doorzoekbaar blijft.

**Verwachte of gewenste situatie**

Productie heeft gestructureerde logs met stabiele correlation-id over browser, API, database/outbox en externe integratie, plus metrics/alerts voor kernjobs en foutbudgetten. Gevoelige velden moeten centraal worden geredigeerd.

**Waarom dit een probleem is**

Intermitterende mail-, Graph-, ERP-, audit- of schedulerfouten zijn anders niet betrouwbaar terug te vinden of te correleren. Consolelogs kunnen bij procesrestart of hostingrotatie verdwijnen.

**Stappen om vast te stellen of te reproduceren**

1. Volg een workflowrequest dat een mail- of auditfout veroorzaakt.
2. Vergelijk de request-id met downstream logs.
3. Stel vast dat downstream helpers de id niet ontvangen en geen durable status opslaan.
4. Zoek repositoryconfiguratie voor logshipping/metrics/alerts; die ontbreekt.

**Technische vaststelling**

`handleApi` maakt per wrapper een id met tijd/random en gebruikt console. Er is geen AsyncLocalStorage/contextpropagatie of gestandaardiseerd structured loggercontract.

**Bewijs**

- Bestand: `lib/server/api.ts`, `app/api/workflows/persist-route.ts`, ERP-workerbestanden
- Regel of codeblok: API-wrapper regels 38-75; verspreide `console.error`-calls
- Route: globaal
- Scherm: niet van toepassing
- Log: alleen lokale consolepaden in code bevestigd
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/06_DEPLOYMENT.md`

**Voorgestelde aanpassing**

Introduceer een gestructureerde logger en request/job context, propagerende correlation-/command-id, centrale redactie en Plesk-geschikt logtransport. Voeg metrics en alerts toe voor authfails, 5xx, jobachterstand, outbox, Graph/ERP/SMTP en auditfails.

**Acceptatiecriteria**

- [ ] Eén correlation-id volgt een request en zijn neveneffecten end-to-end.
- [ ] Logs zijn gestructureerd, geredigeerd, duurzaam bewaard en doorzoekbaar.
- [ ] Kritieke integratie- en jobfouten hebben meetbare alerts.
- [ ] Retentie en toegang zijn privacy- en securitymatig vastgelegd.
- [ ] Een supportmedewerker kan een response request-id terugvinden na procesrestart.

**Risico bij niet aanpassen**

Productieproblemen blijven stil of niet reproduceerbaar en ontbrekende mail/data/audit wordt te laat ontdekt.

**Afhankelijkheden**

- Hosting/logplatform
- Privacy- en retentiebeleid

**Gerelateerde bevindingen**

- REV-0009
- REV-0017
- REV-0052
- REV-0053

### 30. Documentatie en onderhoudbaarheid

#### REV-0043 — Centrale statusbadge is Nederlandstalig, onvolledig en toont onbekende enums als ruwe code

- **Module:** Documentatie en onderhoudbaarheid
- **Submodule:** Gedeelde statuspresentatie
- **Scherm/pagina:** Alle lijsten en kaarten met `StatusBadge`
- **Route:** Meerdere
- **Component/bestand:** `components/ui.tsx`
- **Functie/API/model:** `statusLabels`, `statusStyles`, `StatusBadge`
- **Type:** I18N / UX / TECHNISCH
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle gebruikers
- **Land/teamcontext:** NL/FR/DE
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

De badge bevat een handgeschreven Nederlandse label- en kleurmap. Niet alle Prisma-/domeinstatussen zijn opgenomen. Voor een onbekende status toont hij `status.replaceAll("_", " ")` zonder vertaling of normalisatie en gebruikt hij de conceptkleur. Daardoor kan bijvoorbeeld een nieuw enumlid als technische lowercase code met verkeerde kleur verschijnen.

**Verwachte of gewenste situatie**

Statuslabels, kleuren en semantiek moeten exhaustief per workflowtype en taal worden gedefinieerd. Een ontbrekende mapping moet tijdens build/test zichtbaar falen, niet stil als technische fallback verschijnen.

**Waarom dit een probleem is**

Status is een kernsignaal voor lifecycle en prioriteit. Verkeerde kleur/tekst kan acties uitlokken of blokkades verbergen en maakt FR/DE-schermen onvolledig.

**Stappen om vast te stellen of te reproduceren**

1. Render een bestaand enumlid dat niet in `statusLabels` staat.
2. Observeer de ruwe underscorevervanging en conceptstijl.
3. Schakel taal naar FR/DE; labels blijven Nederlands.

**Technische vaststelling**

De component accepteert vrije `string`, maps zijn `Record<string,string>` en fallback maskeert ontbrekende exhaustiviteit.

**Bewijs**

- Bestand: `components/ui.tsx`, `prisma/schema.prisma`
- Regel of codeblok: statusmaps rond regels 20-88
- Route: meerdere
- Scherm: Begeleidingenbadges op localhost bekeken
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/04_UI_GUIDELINES.md`

**Voorgestelde aanpassing**

Gebruik getypeerde per-domein statuspresenters met vertaalkeys en exhaustieve mappings. Voeg een bewuste 'onbekend'-telemetrystatus toe voor onverwachte legacydata, niet als normale fallback.

**Acceptatiecriteria**

- [ ] Elk canoniek statuslid heeft label, stijl en semantische categorie.
- [ ] Labels bestaan in NL, FR en DE.
- [ ] Een nieuw enumlid breekt de exhaustiviteitstest.
- [ ] Legacy/onbekend is zichtbaar onderscheiden en gelogd.
- [ ] Kleur is niet de enige informatiedrager.

**Risico bij niet aanpassen**

Gebruikers zien technische of misleidende statusinformatie en nieuwe enumleden glippen onopgemerkt door.

**Afhankelijkheden**

- Statusnormalisatie uit REV-0014
- I18n uit REV-0028

**Gerelateerde bevindingen**

- REV-0014
- REV-0028

#### REV-0030 — Primaire documentatie is verouderd, bevat dode links en lege businessbronnen

- **Module:** Documentatie en onderhoudbaarheid
- **Submodule:** Bronnenhiërarchie en onboarding
- **Scherm/pagina:** Niet van toepassing
- **Route:** Niet van toepassing
- **Component/bestand:** `README.md`, `docs/business/*`, `docs/ai/INDEX.md`
- **Functie/API/model:** Documentatiebron van waarheid
- **Type:** DOCUMENTATIE / FUNCTIONEEL / TECHNISCH
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Productowner, ontwikkelaars, testers en beheer
- **Land/teamcontext:** Globaal
- **Omgeving:** Repositoryanalyse

**Huidige situatie**

README noemt het systeem een tablet-first klikbaar prototype, verwijst naar niet-bestaande `docs/database.md`, `docs/vps-deployment.md` en `docs/entra-authentication.md` en bevat meerdere achterhaalde route-/architectuurclaims. Alle zeven bestanden onder `docs/business` hebben lengte nul. De feitelijke regels staan verspreid onder `docs/ai` en `docs/technical`, met soms intern tegenstrijdige open-items.

**Verwachte of gewenste situatie**

De documenthiërarchie uit AGENTS/INDEX moet voor ieder domein een actuele eigenaar en bron opleveren. Businessbesluiten mogen niet leeg zijn en onboardinglinks moeten naar bestaande, actuele documenten wijzen.

**Waarom dit een probleem is**

Bij conflicten kan niet betrouwbaar worden vastgesteld wat goedgekeurd gedrag is. Nieuwe ontwikkelaars/tests volgen verouderde instructies; lege businessbronnen stimuleren het invullen van ontbrekende regels op basis van code.

**Stappen om vast te stellen of te reproduceren**

1. Controleer iedere README-link op bestaand doel.
2. Lees de metadata/lengte van `docs/business/*`.
3. Vergelijk README-statusclaims met huidige routes, Prisma en mijlpaaldocs.

**Technische vaststelling**

De genoemde bestanden bestaan niet op de vermelde paden; relevante docs staan onder andere namen/locaties. De businessbestanden zijn letterlijk 0 bytes.

**Bewijs**

- Bestand: `README.md`, `docs/business/Coaching.md`, `Contracten.md`, `KPI.md`, `Producten.md`, `Salesday.md`, `Service.md`, `Terminologie.md`
- Regel of codeblok: README onder meer regels 5, 72, 82, 109, 122 en 142-169
- Route: niet van toepassing
- Scherm: niet van toepassing
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `AGENTS.md`, `docs/ai/INDEX.md`

**Voorgestelde aanpassing**

Wijs per domein een owning business- en technical document toe, vul alleen goedgekeurde regels in en archiveer/vervang oude claims met links. Voeg een automatische linkcheck, lege-ownerdoccheck en periodieke ownerreview toe.

**Acceptatiecriteria**

- [ ] Iedere primaire link resolveert naar een bestaand document.
- [ ] Iedere actieve module heeft een niet-lege, goedgekeurde businessbron of expliciete `UNDEFINED`-status.
- [ ] README weerspiegelt actuele productstatus zonder detailduplicatie.
- [ ] Tegenstrijdige open/implemented-lijsten zijn opgeschoond.
- [ ] CI controleert links en verplichte documentstatus.

**Risico bij niet aanpassen**

Teams implementeren en accepteren verschillende interpretaties van dezelfde functionaliteit.

**Afhankelijkheden**

- Businessowners per domein
- CI uit REV-0032

**Gerelateerde bevindingen**

- REV-0006
- REV-0031
- REV-0045

#### REV-0032 — Er is geen repository-CI die typecheck, lint, tests, migraties en documentchecks afdwingt

- **Module:** Documentatie en onderhoudbaarheid
- **Submodule:** Continue integratie en kwaliteitsgate
- **Scherm/pagina:** Niet van toepassing
- **Route:** Pull-request/releaseproces
- **Component/bestand:** `package.json`, ontbrekende `.github/workflows`
- **Functie/API/model:** npm scripts en buildchecks
- **Type:** TEST / DEPLOYMENT / TECHNISCH
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd voor repository; mogelijk externe CI niet zichtbaar
- **Rollen:** Ontwikkelaars en releasebeheer
- **Land/teamcontext:** Alle omgevingen
- **Omgeving:** Repositoryanalyse

**Huidige situatie**

De repository heeft veel nuttige losse scripts, typecheck, lint en build, maar geen `.github/workflows` of andere versiebeheerde CI-pipeline. Daardoor is niet aantoonbaar dat een standaard set bij iedere wijziging draait. Een externe pipeline kan bestaan, maar is niet gedocumenteerd of reproduceerbaar vanuit de repository.

**Verwachte of gewenste situatie**

Iedere wijziging passeert een version-controlled, herhaalbare gate met dependency install, typecheck, lint, relevante unit/contracttests, Prisma validate/generate, migratiechecks, secret/securitychecks en build waar passend.

**Waarom dit een probleem is**

De grote hoeveelheid scripts biedt geen bescherming als niemand ze consistent uitvoert. Rechten-, migratie-, i18n-, doc- of bundelregressies kunnen ongezien main bereiken.

**Stappen om vast te stellen of te reproduceren**

1. Zoek `.github/workflows` en andere pipelineconfiguratie.
2. Stel vast dat deze niet in de repository staat.
3. Vergelijk het grote scriptsaanbod met een vastgelegd required-checkbeleid; dat ontbreekt.

**Technische vaststelling**

`package.json` bevat tientallen onafhankelijke `test:*`-entries maar geen overkoepelende test/gate en geen CI-configuratie. Database-afhankelijke scripts vereisen bovendien veilige expliciete scheiding.

**Bewijs**

- Bestand: `package.json`, repositoryroot
- Regel of codeblok: scriptsregels 7-125; `.github/workflows` ontbreekt
- Route: niet van toepassing
- Scherm: niet van toepassing
- Log: geen CI-resultaten beschikbaar
- Query: geen database-test automatisch uitgevoerd
- Gerelateerde documentatie: `docs/ai/05_DEVELOPMENT_STANDARDS.md`, `docs/ai/06_DEPLOYMENT.md`

**Voorgestelde aanpassing**

Maak een snelle PR-gate en zwaardere nightly/release-gate. Groepeer scripts per domein, isoleer database-integratietests op een naam-geguarded testdatabase en publiceer test-/coverage-/buildresultaten als required checks.

**Acceptatiecriteria**

- [ ] PR's vereisen geslaagde typecheck, lint en relevante snelle tests.
- [ ] Prisma schema/migratievolgorde en locale/documentchecks zijn automatisch.
- [ ] DB-tests kunnen technisch nooit de applicatiedatabase gebruiken.
- [ ] Releasegate bouwt productie en draait kritieke contract-/securitytests.
- [ ] Required checks en uitzonderingsproces zijn gedocumenteerd.

**Risico bij niet aanpassen**

Kritieke regressies blijven afhankelijk van handmatige discipline en wisselende lokale omgevingen.

**Afhankelijkheden**

- CI-platform en secrets
- Testclassificatie/snelheidsbudget

**Gerelateerde bevindingen**

- REV-0022
- REV-0030
- REV-0033

#### REV-0054 — `package.json` bevat een dubbele scriptsleutel die door JSON-parsing stil wordt overschreven

- **Module:** Documentatie en onderhoudbaarheid
- **Submodule:** npm scripts
- **Scherm/pagina:** Niet van toepassing
- **Route:** Lokale/CI-testuitvoering
- **Component/bestand:** `package.json`
- **Functie/API/model:** `test:salesday-attachments`
- **Type:** TECHNISCH / TEST
- **Prioriteit:** P4
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Ontwikkelaars en CI
- **Land/teamcontext:** Niet van toepassing
- **Omgeving:** Repositoryanalyse

**Huidige situatie**

De scriptsobjectliteral bevat `test:salesday-attachments` tweemaal. Beide waarden zijn momenteel gelijk, zodat het effect functioneel neutraal is, maar standaard JSON-parsers behouden alleen de laatste sleutel en verbergen toekomstige verschillen.

**Verwachte of gewenste situatie**

JSON-configuratie bevat unieke keys en een check die duplicaten afwijst vóór package tooling de eerste waarde verliest.

**Waarom dit een probleem is**

Een toekomstige wijziging aan slechts één kopie lijkt in review geldig maar wordt stil overschreven. Het is tevens een signaal dat standaard JSON-parsing geen duplicaatcontrole afdwingt.

**Stappen om vast te stellen of te reproduceren**

1. Zoek alle regels met `test:salesday-attachments`.
2. Observeer twee definities.
3. Parseer package.json en zie slechts één property in het resultaat.

**Technische vaststelling**

Dubbele objectkeys zijn syntactisch geaccepteerd door veel JSON-tooling, maar semantisch ambigu.

**Bewijs**

- Bestand: `package.json`
- Regel of codeblok: twee identieke `test:salesday-attachments`-entries
- Route: niet van toepassing
- Scherm: niet van toepassing
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: niet van toepassing

**Voorgestelde aanpassing**

Verwijder één duplicaat en voeg duplicate-keydetectie toe aan de configuratie-/CI-check.

**Acceptatiecriteria**

- [ ] De scriptsleutel komt exact eenmaal voor.
- [ ] JSON duplicate-keycontrole draait in CI.
- [ ] Het bedoelde attachmenttestscript blijft uitvoerbaar.

**Risico bij niet aanpassen**

Een latere scriptswijziging kan stil genegeerd worden.

**Afhankelijkheden**

- REV-0032

**Gerelateerde bevindingen**

- REV-0032

### 31. SalesDay

#### REV-0039 — SalesDay-bijlagen vertrouwen bestandstype volledig op client-MIME

- **Module:** SalesDay
- **Submodule:** Klant- en afspraakbijlagen
- **Scherm/pagina:** Bijlagen bij afspraak of klant
- **Route:** `/api/salesday/appointments/[id]/attachments`, `/api/salesday/customers/[id]/attachments`
- **Component/bestand:** routebestanden, `lib/server/salesday-attachments.ts`
- **Functie/API/model:** `stageSalesDayAttachment`, `allowedMimeTypes`
- **Type:** SECURITY / DATA / INTEGRATIE
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Vertegenwoordiger
- **Land/teamcontext:** Eigen werkdag en afspraakscope
- **Omgeving:** Codeanalyse

**Huidige situatie**

De server gebruikt `file.type` uit multipart als MIME, controleert alleen membership van een allowlist en slaat daarna bytes, MIME, naam en hash op voor ERP-submit. Er is geen magic-byte-/containercontrole, parservalidatie of malware-scan. Een willekeurig bestand kan dus als PDF, JPEG, DOCX of XLSX worden gelabeld. Bovendien maken de routes eerst `Buffer.from(await file.arrayBuffer())` en pas daarna controleert de service de limiet van 25 MB.

**Verwachte of gewenste situatie**

Uploads worden vóór volledige buffering op transportniveau begrensd, inhoudelijk herkend, voor containerformaten veilig gevalideerd en volgens securitybeleid gescand/quarantained vóór download of ERP-doorsturen.

**Waarom dit een probleem is**

Verkeerd gelabelde of kwaadaardige bestanden komen in FieldForceopslag en mogelijk in ERP/backoffice terecht. Hashing bewijst integriteit, niet veiligheid of correct formaat.

**Stappen om vast te stellen of te reproduceren**

1. Maak een tekstbestand en verstuur het met `Content-Type: application/pdf` en `.pdf`-naam.
2. Volg de route/service in een geïsoleerde test.
3. Stel vast dat alleen MIME-allowlist en bytegrootte worden gecontroleerd.

**Technische vaststelling**

`allowedMimeTypes` is een stringset; `stageSalesDayAttachment` inspecteert de bytes alleen voor lengte en SHA-256. De route materialiseert de volledige arraybuffer vóór de servicelimiet.

**Bewijs**

- Bestand: `lib/server/salesday-attachments.ts`, beide attachmentroutes
- Regel of codeblok: allowlist/validatie regels 13-43; route `Buffer.from(await file.arrayBuffer())`
- Route: genoemde attachmentendpoints
- Scherm: geen bestand geüpload
- Log: niet van toepassing
- Query: attachment/outbox zouden client-MIME opslaan
- Gerelateerde documentatie: SalesDay attachment-mijlpaal en ERP-contract

**Voorgestelde aanpassing**

Gebruik streaming/bodylimieten, detecteer echte bestandssignatures, valideer OOXML/ZIP veilig en zet uploads in quarantine totdat scan/validatie slaagt. Stuur naar ERP alleen een goedgekeurde inhoudscategorie en bewaar scanstatus.

**Acceptatiecriteria**

- [ ] Verkeerd gelabelde bytes worden vóór opslag/outbox geweigerd.
- [ ] Request kan geheugen niet boven gedocumenteerde limiet laten groeien.
- [ ] OOXML, PDF en afbeeldingen hebben formaat-/decompressielimieten.
- [ ] Malware-/quarantinebeleid is afgestemd met ERP/backoffice.
- [ ] Tests dekken spoofing, zip bomb, truncatie en maximumgrenzen.

**Risico bij niet aanpassen**

Kwaadaardige of fout gelabelde inhoud kan opslag, ERP en backofficegebruikers bereiken.

**Afhankelijkheden**

- Uploadgateway/scanner
- ERP-bijlagecontract

**Gerelateerde bevindingen**

- REV-0010
- REV-0051

#### REV-0051 — SalesDay en Inventory hebben alleen een mock-ERP-adapter en zijn daarom niet productieactiveerbaar

- **Module:** SalesDay
- **Submodule:** ERP-integratie en productiegate
- **Scherm/pagina:** Volledige SalesDay- en Inventoryscope
- **Route:** SalesDay/Inventory API's en workers
- **Component/bestand:** `lib/server/integrations/sales-erp/factory.ts`, `mock-adapter.ts`, `port.ts`
- **Functie/API/model:** `createSalesErpAdapter`, `SalesErpProvider`
- **Type:** INTEGRATIE / FUNCTIONEEL / DEPLOYMENT
- **Prioriteit:** P0
- **Status:** Geblokkeerd extern
- **Zekerheid:** Bevestigd
- **Rollen:** Vertegenwoordiger, management en backoffice
- **Land/teamcontext:** BE, NL en DE
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

De integratielaag bevat contracten, ledger, inbox/outbox en een deterministische mockadapter. De factory weigert de mockprovider terecht in productie en geeft voor elke andere provider 'No ... adapter has been configured'. Er is geen BC/NAV-, Odoo- of andere real-providerimplementatie in de repository. De documentatie verbiedt productieactivatie tot real-adapter, credentials, eventdelivery, idempotentie en reconciliatie end-to-end zijn aanvaard.

**Verwachte of gewenste situatie**

Voor productie moet een goedgekeurde real ERP-adapter alle verplichte read/write/eventcontracts implementeren, met echte testomgeving, credentials, rate/errorcontracten, replay/reconciliatie en ondertekend UAT-bewijs.

**Waarom dit een probleem is**

SalesDay en Inventory zijn ontworpen rond ERP als autoritatieve bron en bestemming. Zonder adapter kunnen klanten, afspraken, artikelen, documenten, stock en cash niet betrouwbaar operationeel synchroniseren; activeren zou een geïsoleerd schaduwsysteem creëren.

**Stappen om vast te stellen of te reproduceren**

1. Inventariseer implementaties van de ERP-port; alleen de mockadapter bestaat.
2. Configureer in een veilige testomgeving een niet-mockprovider.
3. Observeer de expliciete `ADAPTER_NOT_CONFIGURED`-fout.
4. Probeer mock met runtimeEnvironment productie; de factory weigert terecht.

**Technische vaststelling**

`factory.ts` kent uitsluitend de `mock`-branch en een foutbranch. De poortdocumentatie verwijst naar toekomstige BC/NAV/Odoovertaling; er is geen concrete adapterdirectory voor zo'n provider.

**Bewijs**

- Bestand: `lib/server/integrations/sales-erp/factory.ts`, `port.ts`, `mock-adapter.ts`
- Regel of codeblok: factory regels 7-28
- Route: alle ERP-afhankelijke SalesDay-/Inventoryflows
- Scherm: SalesDay toonde op localhost 'niet geactiveerd'; geen mutatie uitgevoerd
- Log: feature-APIfout in lokale console; geen real-adapterlog
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/ai/modules/Salesday/DECISIONS.md` secties 2.1 en 13; production-readinessmijlpaal

**Voorgestelde aanpassing**

Behoud de productieguard. Maak de real adapter als afzonderlijk getest pakket volgens de bestaande port, leg providerfoutmapping en credentials vast en voer contract-, integratie-, replay-, conflict-, volume-, security- en UAT-tests uit tegen de echte acceptatieomgeving.

**Acceptatiecriteria**

- [ ] Een echte provider implementeert ieder verplicht portcontract.
- [ ] Inbox, outbox, acknowledgements, idempotentie en reconciliatie werken end-to-end.
- [ ] Geen productiepad kan op mockdata terugvallen.
- [ ] Credentials, rotatie, netwerk en monitoring zijn operationeel goedgekeurd.
- [ ] Volledige SalesDay- én Inventory-UAT is ondertekend vóór featureactivatie.

**Risico bij niet aanpassen**

Productieactivatie is onmogelijk zonder dat commerciële, voorraad- en financiële data onsamenhangend of verloren raakt.

**Afhankelijkheden**

- Extern ERP-team, sandbox en credentials
- Definitieve providerkeuze en contracten

**Gerelateerde bevindingen**

- REV-0013
- REV-0055

#### REV-0013 — SalesDay-configuratiefout wordt als gewone deactivatie getoond

- **Module:** SalesDay
- **Submodule:** Featuregate en operationele foutstate
- **Scherm/pagina:** Alle SalesDay-schermen
- **Route:** `/salesday/*`, `GET /api/salesday/features`
- **Component/bestand:** `components/salesday/feature-provider.tsx`, `components/workspace-pages.tsx`
- **Functie/API/model:** `SalesDayFeatureProvider.loadAccess`, `WorkspacePage`
- **Type:** BUG / UX / API
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Alle SalesDay-rollen
- **Land/teamcontext:** Globaal en toegewezen scope
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

Bij een fout van `/api/salesday/features` zet de provider alle features op disabled en bewaart hij wel een fouttekst. `WorkspacePage` controleert na `loading` echter alleen `isEnabled('SALESDAY')` en negeert `error`. In de gecontroleerde sessie faalde de feature-API; de console toonde de fout, terwijl het scherm uitsluitend zei: “SalesDay niet geactiveerd ... neem contact op met de backoffice”.

**Verwachte of gewenste situatie**

Een technisch laad-, schema-, database- of netwerkprobleem moet een aparte herstelbare foutstate tonen met request-id/retry en operationele instructie. Alleen een succesvol geladen featurebeslissing met `enabled=false` mag de normale deactivatiemelding geven.

**Waarom dit een probleem is**

Een storing wordt als bewuste configuratie voorgesteld. Gebruikers en backoffice zoeken daardoor in rechten/flags terwijl de oorzaak technisch is, en de volledige operationele SalesDay kan zonder correcte incidentmelding geblokkeerd worden.

**Stappen om vast te stellen of te reproduceren**

1. Laat `GET /api/salesday/features` een 500- of netwerkfout geven.
2. Open `/salesday`.
3. Observeer de consolefout en vergelijk die met de zichtbare melding “SalesDay niet geactiveerd”.

**Technische vaststelling**

De catch in `feature-provider.tsx` stelt `access=disabledAccess` en `error=...`. In `workspace-pages.tsx` worden `loading` en `isEnabled` gelezen, maar `salesDayFeatures.error` niet.

**Bewijs**

- Bestand: `components/salesday/feature-provider.tsx`, `components/workspace-pages.tsx`
- Regel of codeblok: provider regels 48-76; workspace regels 221-229
- Route: `/salesday`
- Scherm: “SalesDay niet geactiveerd”
- Log: `[salesday/features] Error: De SalesDay-activatie kon niet worden geladen.`
- Query: `GET /api/salesday/features?actorId=...`
- Gerelateerde documentatie: `docs/ai/modules/Salesday/README.md`, `MILESTONE-6-PRODUCTION-READINESS.md`

**Voorgestelde aanpassing**

Maak de providerstatus een discriminated union (`loading`, `loaded-enabled`, `loaded-disabled`, `error`). Render bij `error` een eigen vertaalde incidentstate met retry, veilige request-id en supportpad. Laat device-runtime pas initialiseren bij `loaded-enabled`.

**Acceptatiecriteria**

- [ ] Een API- of netwerkfout kan nooit als “niet geactiveerd” worden weergegeven.
- [ ] De gebruiker kan de featureconfiguratie opnieuw laden zonder volledige pagina-refresh.
- [ ] De foutstate bevat geen gevoelige technische details maar wel een traceerbare request-id.
- [ ] Tests dekken enabled, disabled, 401/403, 500, ongeldige JSON en offline.

**Risico bij niet aanpassen**

Een productie-incident blokkeert het verkoopproces met een verkeerde diagnose, verlengt hersteltijd en kan ertoe leiden dat men rechten of flags onnodig wijzigt.

**Afhankelijkheden**

- Gestandaardiseerde API-foutpayload
- Vertalingen NL/FR/DE

**Gerelateerde bevindingen**

- REV-0008
- REV-0011

### 32. Inventory

#### REV-0055 — Inventory heeft API's en navigatie maar geen functionele Inventory-UI

- **Module:** Inventory
- **Submodule:** Gebruikerswerkruimte
- **Scherm/pagina:** Mijn voorraad, Bevoorrading en Verbruiksgoederen
- **Route:** `/inventory/mijn-voorraad`, `/inventory/bevoorrading`, `/inventory/verbruiksgoederen`
- **Component/bestand:** `lib/app-switcher.ts`, `components/workspace-pages.tsx`, `components/salesday/salesday-workspace.tsx`
- **Functie/API/model:** Inventory route dispatch en `PlaceholderWorkspace`
- **Type:** FUNCTIONEEL / UX / INTEGRATIE
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Vertegenwoordiger en Inventory-management
- **Land/teamcontext:** Gebruiker, voertuig, klantlocatie en land
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

De app-switcher biedt Inventory als afzonderlijk domein met drie concrete menu-items en de repository bevat uitgebreide Inventory-API's en serverlogica. Er is echter geen `app/inventory`-route of Inventory-workspacecomponent. De generieke catch-all kent geen Inventorydispatch en toont daarom voor de menu-URL's alleen 'Pagina in voorbereiding'. Een beperkte stocksummary bestaat uitsluitend in de SalesDay-workspace en is geen vervanging voor de drie Inventoryflows.

**Verwachte of gewenste situatie**

Een beschikbaar menu-item moet een functioneel scherm bieden dat het goedgekeurde backendcontract gebruikt, of server-side niet beschikbaar zijn totdat de slice volledig is. Voorraad, ontvangstbewijs en verbruiksgoederen hebben eigen responsive, offline- en foutflows nodig.

**Waarom dit een probleem is**

Gebruikers krijgen toegang tot een professioneel beschreven module die niets kan uitvoeren. De uitgebreide backend kan daardoor niet via de bedoelde UI worden geaccepteerd en rechten-/lifecyclefouten blijven onontdekt.

**Stappen om vast te stellen of te reproduceren**

1. Open Inventory via de app-switcher.
2. Navigeer naar `/inventory/mijn-voorraad`, `/inventory/bevoorrading` of `/inventory/verbruiksgoederen`.
3. Observeer de generieke placeholdertekst.
4. Vergelijk de route-inventaris met aanwezige `/api/inventory/*`-routes.

**Technische vaststelling**

`app/contract` heeft een eigen optionele catch-all, Inventory niet. `WorkspacePage` dispatcht SalesDay, PST, Contractplaceholder en Service, maar geen `segments[0] === "inventory"` naar een echte component.

**Bewijs**

- Bestand: `lib/app-switcher.ts`, `components/workspace-pages.tsx`, route-inventaris onder `app`
- Regel of codeblok: Inventorymenu regels 347-358; route dispatch rond workspace regels 220-260 zonder Inventorybranch
- Route: `/inventory/mijn-voorraad`
- Scherm: localhost toonde uitsluitend 'Pagina in voorbereiding'
- Log: niet van toepassing
- Query: geen mutaties uitgevoerd
- Gerelateerde documentatie: `docs/ai/modules/Salesday/MILESTONE-4-SHARED-INVENTORY.md`, `docs/ai/02_DATABASE.md`

**Voorgestelde aanpassing**

Markeer Inventory server-side unavailable totdat een eigen domeinlayout/workspace de drie flows volledig implementeert. Hergebruik de bestaande API-/typeservices, maar voeg per flow loading/empty/error/offline/conflict, rechten, bewijs en mobiele scanning/invoer toe met acceptatietests.

**Acceptatiecriteria**

- [ ] Geen Inventorymenu is zichtbaar als de bijbehorende UI-slice niet functioneel is.
- [ ] De drie routes hebben echte schermen en geen generieke placeholder.
- [ ] UI gebruikt de bestaande server-side scope- en lifecyclechecks.
- [ ] Representative- en managementread-onlygedrag zijn getest.
- [ ] Android/PWA offline-, ontvangst- en conflict-UAT is uitgevoerd.

**Risico bij niet aanpassen**

Inventory is voor eindgebruikers feitelijk onbruikbaar en kan niet als voltooide releasefunctionaliteit gelden.

**Afhankelijkheden**

- Real ERP-adapter uit REV-0051
- Definitieve Inventory-UX en offline-UAT

**Gerelateerde bevindingen**

- REV-0001
- REV-0051

### 33. Contracten

#### REV-0044 — Contractdocumentatie en code geven Group Manager alle landen in strijd met de centrale rolregel

- **Module:** Contracten
- **Submodule:** Datascope en documentconflict
- **Scherm/pagina:** Alle contractklanten, berekeningen en downloads
- **Route:** `/contract/*`, `/api/contract/*`
- **Component/bestand:** `docs/contract-calculation.md`, `docs/ai/03_ROLES.md`, `lib/contract/access.ts`
- **Functie/API/model:** `contractOwnerWhere`, contractscope
- **Type:** RECHTEN / DOCUMENTATIE / SECURITY
- **Prioriteit:** P1
- **Status:** Beslissing vereist
- **Zekerheid:** Conflict bevestigd
- **Rollen:** Group Manager
- **Land/teamcontext:** Alle landen versus expliciet toegewezen scope
- **Omgeving:** Code- en documentatieanalyse

**Huidige situatie**

Het Contractdocument zegt expliciet `GROUP_MANAGER` en Super Admin: alle contractdata. `lib/contract/access.ts` implementeert dezelfde globale bypass. De centrale, hoger gerouteerde rolbron zegt dat Group Manager onvolledig gedefinieerd is, niet automatisch Super Admin mag zijn en alleen expliciet toegewezen scope mag gebruiken. Er is geen Contractspecifiek goedgekeurd besluit dat deze uitzondering motiveert.

**Verwachte of gewenste situatie**

Tot een expliciet businessbesluit anders bepaalt, volgt Contract de centrale least-privilegescope: alleen toegewezen groep/landen. Een domeinuitzondering moet in rolbron én Contractdoc met reden en tests staan.

**Waarom dit een probleem is**

De huidige code geeft een Group Manager toegang tot klant-, prijs-, contract- en ondertekende documentdata van alle landen. Dat is een concreet commercieel en privacyrisico.

**Stappen om vast te stellen of te reproduceren**

1. Configureer een Group Manager met één land/groep.
2. Vraag contractoverzicht of document uit een ander land op.
3. Observeer dat de contractscope `{}` retourneert.
4. Vergelijk beide owning documenten.

**Technische vaststelling**

`contractOwnerWhere` en gerelateerde toeganghelpers returnen voor `SUPER_ADMIN || GROUP_MANAGER` een leeg filter. Dit is niet gekoppeld aan `countryAccess` of group assignment.

**Bewijs**

- Bestand: `lib/contract/access.ts`, `docs/contract-calculation.md`, `docs/ai/03_ROLES.md`
- Regel of codeblok: access regels 17-44; Contractdoc scopeparagraaf; rolbron sectie Group Manager
- Route: Contractoverzicht, berekeningen en downloads
- Scherm: niet met Group Manager-account getest
- Log: niet van toepassing
- Query: leeg Prismafilter voor Group Manager
- Gerelateerde documentatie: genoemde twee conflicterende bronnen

**Voorgestelde aanpassing**

Laat productowner/security het conflict beslissen. Pas daarna code, beide docs en matrixtests samen aan; bij uitblijven van besluit verwijder de globale bypass en gebruik centrale effective scope.

**Acceptatiecriteria**

- [ ] Eén expliciete bron bepaalt Group Manager-Contractscope.
- [ ] Zonder globale toewijzing ziet de rol geen ander land.
- [ ] Download en PDF volgen exact dezelfde scope als scherm/API.
- [ ] Tests dekken enkel land, meerdere landen, lege en globale toewijzing.
- [ ] Code en beide documenten zijn na besluit gelijk.

**Risico bij niet aanpassen**

Group Managers kunnen ondertekende contract- en klantdata buiten hun organisatiebereik lezen.

**Afhankelijkheden**

- Definitieve Group Manager-definitie
- Centrale scope-engine uit REV-0002/REV-0003

**Gerelateerde bevindingen**

- REV-0002
- REV-0003
- REV-0015

#### REV-0050 — De geactiveerde DOCX-contractbrief wordt niet gebruikt om de ondertekende PDF te renderen

- **Module:** Contracten
- **Submodule:** Contractbrief-template en PDF-generatie
- **Scherm/pagina:** Contractbeheer en ondertekenen
- **Route:** template-upload/-activate en `POST /api/contract/calculations/[id]/sign`
- **Component/bestand:** `lib/contract/letter.ts`, `components/contract/contract-workspace.tsx`
- **Functie/API/model:** `validateContractLetterTemplate`, `generateAndSignContractLetter`, `renderSignedContractLetterPdf`
- **Type:** FUNCTIONEEL / PDF / DATA
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Contractbeheerder en verkoper
- **Land/teamcontext:** NL/FR/DE klanttaal
- **Omgeving:** Codeanalyse en localhost

**Huidige situatie**

Een DOCX wordt opgeslagen, gevalideerd op parameters en geactiveerd. Bij ondertekening wordt het actieve template-record opgezocht en aan het document gekoppeld, maar de opgeslagen DOCX-bytes of documentinhoud worden niet aan de renderer doorgegeven. `renderSignedContractLetterPdf` bouwt met jsPDF een vaste MExT-pagina met hardcoded volgorde, producttabel, prijzen en handtekening. Tekst, logo's, opmaak, headers/footers en parameterposities uit de geactiveerde template verschijnen dus niet in de PDF.

**Verwachte of gewenste situatie**

De geactiveerde taaltemplate moet de officiële contractbriefinhoud en layout daadwerkelijk bepalen, met gecontroleerde parametervervanging, productlijst en handtekening op de aangewezen plaatsen en een onveranderlijke templateversie in het bewijs.

**Waarom dit een probleem is**

Beheer kan een juridisch/commercieel goedgekeurde brief activeren terwijl klanten een andere, vaste systeembrief ondertekenen. Templatevalidatie geeft daardoor schijnzekerheid en de gekoppelde template-id bewijst niet wat visueel is getekend.

**Stappen om vast te stellen of te reproduceren**

1. Upload een geldige DOCX met herkenbare unieke tekst en afwijkende layout.
2. Activeer de template en onderteken een conceptberekening in een geïsoleerde test.
3. Open de PDF en stel vast dat unieke tekst/layout ontbreekt.
4. Volg de code: `renderSignedContractLetterPdf` ontvangt alleen calculation, placeholder snapshot en signatureData.

**Technische vaststelling**

De templatequery levert het record voor id/language/versionbinding, maar `renderSignedContractLetterPdf` leest geen `sourceContent`. De renderer tekent alle elementen zelf met vaste coördinaten en labels.

**Bewijs**

- Bestand: `lib/contract/letter.ts`
- Regel of codeblok: templatequery en rendercall rond regels 198-214; vaste jsPDF-renderer rond regels 415-493
- Route: contract ondertekenen
- Scherm: Contractdashboard op localhost gecontroleerd; geen contract gemuteerd of ondertekend
- Log: niet van toepassing
- Query: actieve template wordt gelezen, inhoud niet gebruikt door renderer
- Gerelateerde documentatie: `docs/ai/modules/Contract/README.md` en parametercontract

**Voorgestelde aanpassing**

Kies en documenteer een betrouwbare DOCX→PDF-pipeline die template-inhoud, stijlen, afbeeldingen, headers/footers en page breaks behoudt, of vervang DOCX door een expliciet ondersteund templateformaat. Render eerst een preview en hash zowel bronversie als definitieve PDF; laat legal/commercial elke taalvariant accepteren.

**Acceptatiecriteria**

- [ ] Unieke templatebody, branding en layout verschijnen aantoonbaar in de PDF.
- [ ] Alle parameters worden op hun templatepositie ingevuld of als fout geweigerd.
- [ ] Productlijst en handtekening volgen de gevalideerde placeholders.
- [ ] De getekende PDF is cryptografisch gekoppeld aan exacte templatebytes en snapshot.
- [ ] Golden-file/visuele tests dekken NL, FR, DE, lange waarden en meerdere pagina's.

**Risico bij niet aanpassen**

Klanten ondertekenen een document dat niet overeenkomt met de door beheer geactiveerde en mogelijk juridisch goedgekeurde brief.

**Afhankelijkheden**

- Template-engine en betrouwbare Office/PDF-rendering
- Juridische goedkeuring van drie taalvarianten

**Gerelateerde bevindingen**

- REV-0015
- REV-0018
- REV-0040

#### REV-0040 — Handtekeningdata is onbegrensd en slechts op een tekstprefix gevalideerd

- **Module:** Contracten
- **Submodule:** Digitale handtekeninginvoer
- **Scherm/pagina:** Contract ondertekenen
- **Route:** `POST /api/contract/calculations/[id]/sign`
- **Component/bestand:** `app/api/contract/calculations/[id]/sign/route.ts`, `lib/contract/letter.ts`
- **Functie/API/model:** `generateAndSignContractLetter`, `signatureData`
- **Type:** SECURITY / DATA / PERFORMANCE
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Contractverkoper
- **Land/teamcontext:** Recordscope
- **Omgeving:** Codeanalyse

**Huidige situatie**

De API cast de JSON-body en accepteert `signatureData` wanneer de string begint met `data:image/png;base64,`. Er is geen maximale body/signaturegrootte, base64decodering met formaatcontrole, PNG magic/header/dimensiecontrole of beperking op pixel-/decompressiekost. De volledige data-URL gaat naar jsPDF én wordt als LongText op de berekening opgeslagen.

**Verwachte of gewenste situatie**

Handtekeningen moeten een klein, strikt gevalideerd rasterformaat en maximumafmetingen hebben. De server decodeert begrensd, controleert echte PNG-structuur/dimensies, normaliseert de afbeelding en slaat alleen de noodzakelijke bewijsrepresentatie op.

**Waarom dit een probleem is**

Een gemanipuleerde client kan zeer grote strings of ongeldige imagepayloads aanbieden, met geheugen-, CPU-, database- en PDF-renderproblemen. Een prefix bewijst niet dat de inhoud een geldige handtekeningafbeelding is.

**Stappen om vast te stellen of te reproduceren**

1. Verstuur in een geïsoleerde test een zeer grote string met de geldige prefix.
2. Verstuur base64 van willekeurige bytes met dezelfde prefix.
3. Observeer dat de applicatiegrens dit niet vooraf begrenst of inhoudelijk valideert.

**Technische vaststelling**

De signroute gebruikt een TypeScript-cast zonder runtime-schema. `generateAndSignContractLetter` gebruikt alleen `startsWith` voordat de string aan de renderer en database wordt doorgegeven.

**Bewijs**

- Bestand: `app/api/contract/calculations/[id]/sign/route.ts`, `lib/contract/letter.ts`
- Regel of codeblok: route body rond regel 12; prefixcheck rond regels 208-210; persistente `signatureData`
- Route: signendpoint
- Scherm: niet muterend getest
- Log: niet van toepassing
- Query: LongText-write in ContractCalculation
- Gerelateerde documentatie: Contractmodule-documentatie

**Voorgestelde aanpassing**

Leg request- en veldlimieten op vóór volledige parsing waar mogelijk. Decodeer strict base64, valideer PNG-signature/chunks/dimensies, herencodeer naar een klein vastgesteld canvas en sla hash plus genormaliseerde bytes of beveiligd bestand op.

**Acceptatiecriteria**

- [ ] Totale request- en handtekeninggrootte hebben geteste maxima.
- [ ] Ongeldige base64, niet-PNG en excessieve dimensies worden met 400 geweigerd.
- [ ] Renderer ontvangt alleen genormaliseerde veilige bytes.
- [ ] Database bewaart geen onbegrensde ruwe clientdata.
- [ ] Fuzz- en resource-tests bewijzen begrensd geheugen-/CPU-gebruik.

**Risico bij niet aanpassen**

De signendpoint kan worden misbruikt voor resource-uitputting of vervuilde bewijsdata.

**Afhankelijkheden**

- Runtime-schema- en uploadlimietstandaard
- Besluit over handtekeningbewijsopslag

**Gerelateerde bevindingen**

- REV-0007
- REV-0010
- REV-0050

#### REV-0010 — Uploadroutes bufferen bestanden vóór server-side groottegrens

- **Module:** Contracten en SalesDay
- **Submodule:** Import, templates en bijlagen
- **Scherm/pagina:** Contractimport, Contract-briefbeheer, afspraak- en klantbijlagen
- **Route:** `POST /api/contract/import/preview`, `POST /api/contract/letter/templates`, `POST /api/salesday/*/attachments`
- **Component/bestand:** genoemde routebestanden, `lib/contract/letter.ts`, `lib/server/salesday-attachments.ts`
- **Functie/API/model:** `File.arrayBuffer`, `uploadContractLetterTemplate`, `stageSalesDayAttachment`
- **Type:** SECURITY / PERFORMANCE / API
- **Prioriteit:** P2
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Bevoegde uploaders
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse

**Huidige situatie**

Meerdere multipart-routes roepen `request.formData()` en vervolgens `file.arrayBuffer()` aan voordat de domeinservice de limiet van 8, 15 of 25 MB controleert. Een geauthenticeerde gebruiker kan daardoor een veel groter bestand volledig door parser en servergeheugen laten opnemen; de latere `buffer.length`-controle komt te laat om die allocatie te voorkomen.

**Verwachte of gewenste situatie**

De reverse proxy én applicatielaag moeten de totale requestgrootte en bestandsgrootte vóór volledige buffering begrenzen. Grote bestanden moeten gestreamd of onmiddellijk met 413 geweigerd worden.

**Waarom dit een probleem is**

Gelijktijdige grote uploads kunnen geheugenpieken, processcrashes of trage responses veroorzaken. De zichtbare domeinlimiet geeft een vals gevoel dat de transportlaag dezelfde bescherming biedt.

**Stappen om vast te stellen of te reproduceren**

1. Maak als bevoegde gebruiker een multipartrequest met een bestand ruim boven de gedocumenteerde limiet.
2. Volg de routecode.
3. Observeer dat `arrayBuffer()` wordt uitgevoerd vóór de service `buffer.length` of `bytes.length` beoordeelt.

**Technische vaststelling**

De contractroutes zetten het bestand direct om naar `Buffer`. De SalesDay-attachmentroutes doen hetzelfde en geven daarna pas `bytes` aan `stageSalesDayAttachment`, waar `MAX_ATTACHMENT_BYTES` wordt gecontroleerd.

**Bewijs**

- Bestand: `app/api/contract/import/preview/route.ts`, `app/api/contract/letter/templates/route.ts`, `app/api/salesday/appointments/[appointmentId]/attachments/route.ts`, `app/api/salesday/customers/[relationId]/attachments/route.ts`
- Regel of codeblok: contract preview regel 12; letter templates regel 26; SalesDay attachmentroutes regels 21-23
- Route: genoemde POST-routes
- Scherm: niet met grote uploads getest om lokale resources en data niet te beïnvloeden
- Log: niet van toepassing
- Query: niet van toepassing
- Gerelateerde documentatie: `docs/contract-calculation.md`, SalesDay-beslissing sectie 11

**Voorgestelde aanpassing**

Configureer Plesk/proxy bodylimieten per routegroep en voeg een streaming multipartparser of platformlimiet toe. Controleer `Content-Length` defensief, maar vertrouw er niet uitsluitend op. Geef 413 met een vertaalde maximumgrootte en meet actieve uploadconcurrency.

**Acceptatiecriteria**

- [ ] Een te grote request wordt vóór volledige in-memory buffering geweigerd.
- [ ] Proxy- en applicatielimieten zijn gedocumenteerd en op elkaar afgestemd.
- [ ] 413-responses zijn consistent en vertaald.
- [ ] Loadtests tonen begrensd geheugen bij gelijktijdige grensgevallen.

**Risico bij niet aanpassen**

Een bevoegde of gekaapte account kan de Node-processen door geheugenuitputting verstoren; legitieme gebruikers kunnen de app onbedoeld laten vastlopen met een groot bestand.

**Afhankelijkheden**

- Plesk/nginx-configuratie
- Keuze streaming multipartoplossing

**Gerelateerde bevindingen**

- REV-0007
- REV-0018

#### REV-0015 — Contract-PDF wordt op Linux via een ongeldig opslagpad teruggelezen

- **Module:** Contracten
- **Submodule:** Ondertekende contractbrief en download
- **Scherm/pagina:** Contract ondertekenen en gegenereerd document downloaden
- **Route:** `POST /api/contract/calculations/[id]/sign`, `GET /api/contract/documents/[id]/download`
- **Component/bestand:** `lib/contract/letter.ts`
- **Functie/API/model:** `storeContractLetterPdf`, `storagePathFromKey`, `readStoredContractLetterPdf`
- **Type:** BUG / PDF / TECHNISCH
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Contractgebruikers
- **Land/teamcontext:** Globaal
- **Omgeving:** Codeanalyse; effect geldt op Linux/Plesk

**Huidige situatie**

Opslaan bouwt een platformcorrect pad met directorysegmenten en bewaart een key met `/`. Teruglezen vervangt die `/` altijd door `\\` voordat `path.resolve` wordt aangeroepen. Op Linux is een backslash geen directoryseparator maar een gewoon teken. Daardoor wijst de download naar één foutieve bestandsnaam onder de uploadroot in plaats van naar `contract-letters/<calculation>/<file>`.

**Verwachte of gewenste situatie**

Een storage key moet platformneutraal blijven en bij teruglezen in gevalideerde segmenten worden gesplitst. Hetzelfde opgeslagen document moet op Windows en Linux byte-identiek downloadbaar zijn.

**Waarom dit een probleem is**

Ondertekening kan succesvol lijken en metadata opslaan, maar het immutable PDF-document is op de waarschijnlijke productie-OS daarna niet te openen. Dit raakt klantbewijs en contracthistorie.

**Stappen om vast te stellen of te reproduceren**

1. Onderteken een contract op een Linux-runtime.
2. Laat de opslagkey `contract-letters/<id>/<bestand>` opslaan.
3. Open de downloadroute.
4. Observeer dat `storagePathFromKey` backslashes in de Linux-padnaam gebruikt en `readFile` het bestand niet vindt.

**Technische vaststelling**

`storagePathFromKey` gebruikt `resolve(uploadRoot(), storageKey.replaceAll('/', '\\'))`. `path.resolve` interpreteert de geproduceerde backslashes alleen op Windows als separators.

**Bewijs**

- Bestand: `lib/contract/letter.ts`
- Regel of codeblok: regels 518-524
- Route: `/api/contract/documents/[id]/download`
- Scherm: niet op Linux runtime uitgevoerd
- Log: verwachte filesystem-not-found; geen productielog beschikbaar
- Query: `ContractGeneratedDocument.signedPdfStorageKey`
- Gerelateerde documentatie: `docs/contract-calculation.md`, `docs/technical/vps-deployment.md`

**Voorgestelde aanpassing**

Parse storage keys met een vaste POSIX-conventie, valideer elk segment en gebruik `resolve(root, ...segments)`. Verifieer containment met `relative(root, fullPath)` in plaats van alleen `startsWith`. Voeg een migratie-/compatibiliteitslezer toe als reeds opgeslagen keys afwijkende separators bevatten.

**Acceptatiecriteria**

- [ ] Dezelfde key werkt op Windows en Linux.
- [ ] Een roundtriptest schrijft en leest exact dezelfde PDF-bytes.
- [ ] Traversal-, absolute-pad- en prefixverwarringscases worden geweigerd.
- [ ] Bestaande documentkeys zijn geïnventariseerd en zo nodig gemigreerd.

**Risico bij niet aanpassen**

Ondertekende contractbewijzen zijn in productie niet downloadbaar, terwijl het dossier wel als `SIGNED` staat en gebruikers kunnen aannemen dat het bewijs veilig is opgeslagen.

**Afhankelijkheden**

- Bevestiging productie-OS en uploadroot
- Inventaris van bestaande gegenereerde documenten

**Gerelateerde bevindingen**

- REV-0018

#### REV-0018 — Concurrent contractondertekenen kan orphanbestanden en foutieve retries opleveren

- **Module:** Contracten
- **Submodule:** Ondertekening, documentversie en bestandsconsistentie
- **Scherm/pagina:** Contractberekening ondertekenen
- **Route:** `POST /api/contract/calculations/[id]/sign`
- **Component/bestand:** `lib/contract/letter.ts`, `prisma/schema.prisma`
- **Functie/API/model:** `generateAndSignContractLetter`, `storeContractLetterPdf`, `ContractGeneratedDocument`
- **Type:** DATA / BUG / PDF / DATABASE
- **Prioriteit:** P1
- **Status:** Nieuw
- **Zekerheid:** Bevestigd
- **Rollen:** Contractgebruikers
- **Land/teamcontext:** Gebruiker en teamscope
- **Omgeving:** Codeanalyse

**Huidige situatie**

De functie leest `DRAFT` en de hoogste documentversie buiten de transactie, rendert en schrijft de PDF naar disk, en start pas daarna een databasetransactie. Twee gelijktijdige requests kunnen beide versie 1 berekenen en elk een bestand schrijven. Eén DB-transactie faalt vervolgens op `@@unique([calculationId, documentVersion])`; het bijbehorende bestand wordt niet verwijderd. Ook bij andere transactiefouten blijft het vooraf geschreven bestand achter. De API kan daarnaast na een opgeslagen hoofdactie falen in latere niet-atomische stappen.

**Verwachte of gewenste situatie**

Ondertekenen moet idempotent en concurrency-safe zijn. Er mag exact één immutable document bij één geslaagde ondertekening ontstaan; een mislukte request laat geen metadata- of bestandsrest achter en een retry meldt de bestaande succesvolle uitkomst.

**Waarom dit een probleem is**

Dubbelklikken, time-outs of gelijktijdige tabs kunnen orphanbestanden, 500-responses en onduidelijk bewijs opleveren. Bestandsbackups groeien met niet-gerefereerde klantdocumenten.

**Stappen om vast te stellen of te reproduceren**

1. Verstuur twee ondertekenrequests voor dezelfde `DRAFT`-berekening vrijwel gelijktijdig.
2. Beide requests lezen dezelfde status en hoogste versie.
3. Beide schrijven een willekeurig benoemd PDF-bestand.
4. Eén insert faalt op de unieke documentversie; controleer dat de filecatch/cleanup ontbreekt.

**Technische vaststelling**

Statuscheck, versiebepaling en `writeFile` staan vóór `prisma.$transaction`. De update gebruikt alleen `where: { id }` en geen conditionele `status: DRAFT`. Rond de transactie staat geen cleanup van `stored`.

**Bewijs**

- Bestand: `lib/contract/letter.ts`, `prisma/schema.prisma`
- Regel of codeblok: letter regels 181-252 en 506-516; schema `ContractGeneratedDocument @@unique([calculationId, documentVersion])`
- Route: onderteken-POST
- Scherm: niet muterend/concurrent uitgevoerd
- Log: niet van toepassing
- Query: afzonderlijke read, filesystemwrite en latere Prisma-transactie
- Gerelateerde documentatie: `docs/contract-calculation.md` noemt documenten immutable en niet overschrijfbaar

**Voorgestelde aanpassing**

Voer een conditionele statusclaim of serializable lock uit voordat rendering start, gebruik een idempotencykey per ondertekenactie en reserveer de documentversie transactioneel. Schrijf eerst naar een tijdelijke file en commit die met rename na succesvolle metadata, of registreer staging en ruim gegarandeerd op bij rollback. Voeg een reconciliatiejob toe voor bestaande orphanbestanden.

**Acceptatiecriteria**

- [ ] Twee identieke gelijktijdige requests leveren één document en één consistente uitkomst.
- [ ] Een DB-fout laat geen blijvend bestand zonder metadata achter.
- [ ] Een filesystemfout laat berekening en documentstatus ongewijzigd.
- [ ] Retries zijn idempotent en genereren geen extra handtekeningversie.
- [ ] Reconciliatie kan orphanbestanden veilig rapporteren en opruimen na goedkeuring.

**Risico bij niet aanpassen**

Het juridische/operationele contractbewijs kan dubbel, incompleet of niet traceerbaar worden en private documenten kunnen buiten databasebeheer op disk achterblijven.

**Afhankelijkheden**

- Filesystem-transaction/stagingstrategie
- Idempotencycontract voor clientmutaties

**Gerelateerde bevindingen**

- REV-0010
- REV-0015
- REV-0017

## Index per prioriteit

### P0

- REV-0051 — SalesDay en Inventory hebben alleen een mock-ERP-adapter.

### P1

- REV-0001, REV-0002, REV-0003, REV-0004, REV-0005, REV-0006, REV-0008, REV-0009
- REV-0012, REV-0013, REV-0015, REV-0017, REV-0018
- REV-0020, REV-0021, REV-0023, REV-0025, REV-0029
- REV-0032, REV-0035, REV-0037, REV-0038
- REV-0042, REV-0044, REV-0046
- REV-0050, REV-0055

### P2

- REV-0007, REV-0010, REV-0011, REV-0014, REV-0016
- REV-0022, REV-0024, REV-0026, REV-0028
- REV-0030, REV-0033, REV-0034, REV-0036, REV-0039
- REV-0040, REV-0041, REV-0043, REV-0045, REV-0047, REV-0048, REV-0049
- REV-0052, REV-0053

### P3

- REV-0027, REV-0031

### P4

- REV-0054

## Index per type

Types overlappen: één bevinding kan in meerdere rijen staan.

| Type | Aantal | Bevindingen |
|---|---:|---|
| SECURITY | 21 | REV-0001, 0002, 0004, 0005, 0007–0010, 0017, 0020, 0023, 0027, 0034, 0037–0040, 0042, 0044, 0047, 0048 |
| DATA | 20 | REV-0002, 0003, 0006, 0007, 0012, 0014, 0016–0018, 0021, 0025, 0026, 0029, 0035, 0037, 0039, 0040, 0042, 0046, 0050 |
| FUNCTIONEEL | 16 | REV-0006, 0014, 0016, 0020, 0029, 0030, 0035, 0036, 0038, 0042, 0045, 0046, 0050–0052, 0055 |
| UX | 14 | REV-0013, 0016, 0020, 0024, 0027, 0028, 0034–0036, 0043, 0045, 0048, 0049, 0055 |
| TECHNISCH | 13 | REV-0007, 0011, 0014, 0015, 0022, 0027, 0030–0033, 0041, 0043, 0054 |
| API | 12 | REV-0004, 0005, 0007, 0008, 0010–0013, 0021, 0026, 0034, 0048 |
| RECHTEN | 11 | REV-0001–0006, 0023, 0029, 0037, 0038, 0044 |
| BUG | 9 | REV-0003, 0008, 0013, 0015, 0018, 0021, 0023, 0025, 0026 |
| PERFORMANCE | 6 | REV-0004, 0010, 0011, 0022, 0036, 0040 |
| DEPLOYMENT | 6 | REV-0032, 0033, 0041, 0047, 0051, 0052 |
| INTEGRATIE | 6 | REV-0036, 0039, 0046, 0051, 0053, 0055 |
| LOGGING | 5 | REV-0009, 0012, 0017, 0041, 0053 |
| DOCUMENTATIE | 4 | REV-0030, 0031, 0044, 0045 |
| ACCESSIBILITY | 3 | REV-0024, 0028, 0049 |
| DATABASE | 3 | REV-0018, 0025, 0033 |
| PDF | 3 | REV-0015, 0018, 0050 |
| I18N | 2 | REV-0028, 0043 |
| PWA | 2 | REV-0008, 0031 |
| TEST | 2 | REV-0032, 0054 |
| ACHTERGRONDTAAK / E-MAIL / NOTIFICATIE / TESTBAARHEID | 1 elk | REV-0052 / REV-0053 / REV-0012 / REV-0022 |

## Index per module

| Module | Aantal | Bevindingen |
|---|---:|---|
| Algemene applicatiestructuur | 6 | REV-0001, 0011, 0022, 0027, 0034, 0045 |
| API en workflowbasis | 6 | REV-0004–0007, 0047, 0048 |
| Contracten | 5 | REV-0015, 0018, 0040, 0044, 0050 |
| Database en datalifecycle | 4 | REV-0014, 0025, 0033, 0042 |
| Documentatie en onderhoudbaarheid | 4 | REV-0030, 0032, 0043, 0054 |
| SalesDay | 3 | REV-0013, 0039, 0051 |
| Authenticatie | 2 | REV-0009, 0020 |
| Beheer — gebruikers | 2 | REV-0021, 0023 |
| Beheer — rollen en scope | 2 | REV-0002, 0003 |
| Logging en audit | 2 | REV-0017, 0041 |
| Planning | 2 | REV-0035, 0036 |
| PWA | 2 | REV-0008, 0031 |
| Responsiviteit en toegankelijkheid | 2 | REV-0024, 0049 |
| Starter-/tussentijdse evaluaties | 2 | REV-0029, 0052 |
| Begeleidingen | 1 | REV-0016 |
| Contactmomenten | 1 | REV-0026 |
| Dashboard | 1 | REV-0046 |
| E-mail | 1 | REV-0053 |
| Help | 1 | REV-0038 |
| Inventory | 1 | REV-0055 |
| Meertaligheid | 1 | REV-0028 |
| Mijn Team / teambeheer | 1 | REV-0037 |
| Notificaties | 1 | REV-0012 |
| Uploadbasis Contracten/SalesDay | 1 | REV-0010 |

## Overkoepelende verbeteringsvoorstellen

1. **Maak autorisatie één platformvoorziening.** Introduceer een centrale route- en actiecatalogus die moduleactivatie, menu-, domein- en lifecyclerecht plus effectieve scope server-side combineert. Laat UI en tests hetzelfde contract consumeren.
2. **Standaardiseer workflowmutaties.** Gebruik gedeelde runtime-schema's, conditionele statusupdates, idempotencykeys en expliciete transactiegrenzen voor hoofdactie, audit, notificatie en filemetadata.
3. **Behandel bestanden als beheerde domeindata.** Voeg grootte- en magic-bytecontrole, staging, atomaire commit/cleanup, padcontainment, retentie en reconciliatie toe.
4. **Splits de clientmonoliet per domein.** Houd routering en shell centraal, maar verplaats schermstate en queries naar module-eigen containers met gerichte tests en foutgrenzen.
5. **Borg asynchrone processen.** Gebruik een duurzame outbox/queue met retries, dead-letterstatus, idempotency en operationele metrics voor mail, notificaties, evaluaties en synchronisatie.
6. **Maak productie-integraties expliciet activeerbaar.** Blokkeer SalesDay/Inventory zonder bewezen ERP-adapter; voeg healthchecks, contracttests en een gecontroleerde go-livechecklist toe.
7. **Voer een release quality gate in.** CI moet minimaal typecheck, lint, Prisma-validatie en relevante contract-/permissiontests uitvoeren, met migrationsanity en optioneel build/veiligheidsscans.
8. **Maak observability en privacy operationeel.** Structurele logs, correlation IDs, foutclassificatie, auditactor, redactie van gevoelige data en alerts moeten buiten `console` beschikbaar zijn.

## Mogelijke quick wins

- Verwijder de dubbele `scripts`-sleutel in `package.json` en laat een manifesttest dit bewaken (REV-0054).
- Stel `<html lang>` dynamisch in en vertaal technische statuslabels centraal (REV-0028, REV-0043).
- Geef onbekende routes, ontbrekende modules en geweigerde toegang aparte 404-/403-states (REV-0034).
- Vervang raw serverfouten door stabiele foutcodes plus vertaalde gebruikersmeldingen (REV-0048).
- Corrigeer het platformneutrale contract-storagepad en voeg een Windows/Linux-roundtriptest toe (REV-0015).
- Werk PWA-README, lege verwijzingen en modulelabels bij (REV-0030, REV-0031).
- Maak SalesDay-configuratiefouten visueel verschillend van bewust uitgeschakelde functionaliteit (REV-0013).
- Voeg modal-focusretour, gekoppelde labels en minimale keyboardtests toe (REV-0024, REV-0049).

## Mogelijke grotere herwerkingen

- Centrale authorization policy engine en routecatalogus (REV-0001 t/m REV-0006, REV-0023, REV-0037, REV-0038, REV-0044).
- Workflowcommandlaag met schema's, idempotency, transactionele audit/outbox en consistente lifecyclelocks (REV-0007, REV-0012, REV-0017, REV-0018, REV-0021).
- Opsplitsing van `WorkspacePage` en globale providers per functioneel domein (REV-0011, REV-0022).
- Beheerde file-store voor uploads, handtekeningen en rapporten, inclusief staging en reconciliatie (REV-0010, REV-0015, REV-0018, REV-0026, REV-0039, REV-0040).
- Volwaardige productie-adapters en gebruikersflow voor SalesDay/Inventory (REV-0051, REV-0055).
- Duurzame job- en communicatielaag voor scheduler, mail en notificaties (REV-0012, REV-0052, REV-0053).
- Datagovernance voor soft delete, wettelijke historie, auditretentie en herstel (REV-0025, REV-0042).

## Security- en datarisico's

| Risicogebied | Impact | Kernbevindingen | Eerste beheersmaatregel |
|---|---|---|---|
| Autorisatie en scope | Onbevoegde scherm-, data- of mutatietoegang | REV-0001–0006, REV-0023, REV-0037, REV-0038, REV-0044 | Centrale server-side policy en denial-tests per rol/scope |
| Authenticatie en accounts | Brute force, verkeerd uitgegeven credentials | REV-0009, REV-0020 | Rate limit, lockout/audit en gecontroleerde eerste aanmelding |
| Bestanden en documenten | Geheugenuitputting, typebypass, orphan- of onleesbare documenten | REV-0010, REV-0015, REV-0018, REV-0026, REV-0039, REV-0040 | Streaming limieten, contentinspectie en transactionele file-store |
| Historie en audit | Onjuiste actor, verloren bewijs, ontraceerbare deletes | REV-0012, REV-0017, REV-0025, REV-0042 | Actor-context verplichten, soft delete en vastgesteld retentiebeleid |
| Browserbeveiliging | XSS-impact en transportbeleid onvoldoende begrensd | REV-0008, REV-0027, REV-0047 | CSP, geharde sanitizer, routeveilige PWA-cache en proxyverificatie |
| Externe integraties | Onvolledige data, time-outs of niet-productieve modules | REV-0036, REV-0046, REV-0051–0053, REV-0055 | Healthchecks, paging/timeouts, duurzame retries en go-live gate |

## Inconsistenties tussen modules

- **Rechten:** workflow-, Help-, Contract- en teamroutes construeren effectieve toegang niet op dezelfde manier; dezelfde rol/override kan per module anders uitpakken.
- **Statussen:** API, Prisma en UI normaliseren lifecyclewaarden met lokale casts of labels, waardoor locks en badges kunnen divergeren.
- **Bestanden:** Contracten, contactmomenten en SalesDay gebruiken verschillende limieten, validatie en cleanupstrategieën.
- **Foutstates:** SalesDay maakt configuratiefout gelijk aan disabled, terwijl andere modules raw errors of lege data tonen.
- **Asynchrone neveneffecten:** notificatie, mail, audit en scheduler hebben verschillende retry- en atomiciteitsgaranties.
- **Navigatie:** werkende domeinen, ongedefinieerde trainingsflows en lege PST/Service-apps worden in dezelfde app-switcher gepresenteerd.
- **Scope:** de algemene rolregel voor Group Manager botst met de contractimplementatie en met globale beheerhelpers.

## Inconsistenties tussen documentatie en implementatie

- De centrale roldocumentatie begrenst Group Manager, terwijl Contractdocumentatie en code globale landtoegang geven (REV-0044).
- Trainings- en retraininggedrag is als ongedefinieerd/partieel beschreven, maar muterende routes zijn reeds bruikbaar (REV-0006).
- De PWA-README beschrijft niet meer de actuele service-workerstrategie (REV-0031).
- PST en Service staan als applicaties in navigatie/configuratie zonder owning businessspecificatie of implementatie (REV-0045).
- De beheerde DOCX-template suggereert templategestuurde contractgeneratie, maar de renderer gebruikt hardcoded documentopbouw (REV-0050).
- Starterevaluaties veronderstellen geplande uitvoering, maar de repository borgt geen schedulerconfiguratie (REV-0052).
- Enkele documentverwijzingen zijn leeg, verouderd of verwijzen niet naar een bestaand eigenaar-document (REV-0030).

## Niet-geteste of geblokkeerde onderdelen

- Een beperkte read-only UI-controle is uitgevoerd met de bestaande lokale sessie; een volledige matrix van acht rollen, useroverrides, landen, teams en lifecyclevarianten was niet beschikbaar.
- Microsoft Entra-, Graph/Outlook-, SMTP- en productie-ERP-integraties vereisen externe configuratie of zouden externe effecten veroorzaken en zijn daarom niet live aangeroepen.
- Muterende database-, seed-, import-, synchronisatie-, mail-, notificatie-, onderteken- en lifecycle-acties zijn niet uitgevoerd.
- De mock-ERP-contracttests zijn geslaagd, maar bewijzen geen echte ERP-connectiviteit of productiedata-ingestie.
- Productieproxy, CSP/HSTS, filesystemrechten, scheduler en monitoring konden alleen via repositoryconfiguratie worden beoordeeld.
- Fysieke Windows-tablet-, iPad-, Android-, mobiele en screenreadertests waren niet beschikbaar; responsive viewports zijn wel read-only gecontroleerd.
- Geen production build uitgevoerd: typecheck, lint, Prisma en gerichte tests gaven voor deze documentaudit voldoende dekking zonder de door de gebruiker beheerde devomgeving te verstoren.

## Functionele beslissingen die nog nodig zijn

| Beslissing | Bevinding | Vereiste eigenaar |
|---|---|---|
| Welke trainingsmutaties en vrijgavestappen zijn goedgekeurd? | REV-0006 | Product owner Coaching/Training |
| Wanneer mogen Coach en Representative elkaars antwoordset zien? | REV-0029 | Product owner en privacyverantwoordelijke |
| Welk retentie-, anonimiseer- en deletebeleid geldt voor officiële historie en audit? | REV-0042 | Business owner, DPO en operations |
| Heeft Group Manager contractueel globale of begrensde landtoegang? | REV-0044 | Product owner en security owner |
| Worden PST en Service echte modules, placeholders zonder route, of verwijderd? | REV-0045 | Product owner/platform owner |
| Welke rich-textvelden zijn toegestaan en welke sanitizerpolicy is normatief? | REV-0027 | Security en UX/inhoudseigenaar |

## Aanbevolen uitvoeringsvolgorde

1. **Directe containment:** blokkeer productieactivatie zonder ERP (REV-0051), herstel directe route/API-autorisatie en sluit Help-/team-/workflowbypasses.
2. **Account- en dataveiligheid:** voeg loginbescherming toe, corrigeer provisioning, auditactor en verwijdergedrag; neem de businessbeslissingen over scope, zichtbaarheid en retentie.
3. **Documentintegriteit:** herstel Linux-download, ondertekenconcurrency, uploadlimieten, bestandstypecontrole en file/DB-reconciliatie.
4. **Workflowbetrouwbaarheid:** standaardiseer runtimevalidatie, lifecycleclaims, idempotency, notificatie/audit en gebruikersmutaties.
5. **Releaseborging:** voeg CI, structurele logging, securityheaders en duurzame scheduler/mail/outbox toe.
6. **Functionele go-live:** implementeer echte ERP-/KPI-ingestie, Inventory-UI en templategestuurde contractbrief; voer integratie-UAT uit.
7. **Onderhoud en UX:** splits de clientmonoliet, verbeter foutstates, i18n, toegankelijkheid, documentatie en PWA-gedrag.
8. **Hercontrole:** herhaal permissionmatrix, concurrency-/failuretests, drie talen, responsive devices, productieproxy en externe integraties voordat vrijgave wordt goedgekeurd.

## Uitgevoerde technische controles

| Controle | Commando/methode | Resultaat | Datum |
|---|---|---|---|
| Repositorystatus | `git status --short` | Bestaande gebruikerswijzigingen geïdentificeerd en behouden; auditbestanden staan los daarvan | 18 juli 2026 |
| Route-inventaris | Gerichte `rg --files`- en routeclassificatie | 123 appbestanden, 5 page-entrypoints en 112 API-routebestanden | 18 juli 2026 |
| Code-inventaris | Gerichte telling per kernmap | 38 component-, 157 lib-, 101 script- en 3 localebestanden | 18 juli 2026 |
| Datamodel | Prisma-schema en migratie-inventaris | 129 modellen, 74 enums en 59 migratiemapjes; risico's afzonderlijk vastgelegd | 18 juli 2026 |
| TypeScript | `npx tsc --noEmit --incremental false` | Geslaagd | 18 juli 2026 |
| Lint | `npm run lint` | Geslaagd | 18 juli 2026 |
| Prisma | `npx prisma validate` | Geslaagd | 18 juli 2026 |
| Workflow en planning | `test:workflow`, `test:planning-items`, `test:action-point-close` | Alle geslaagd | 18 juli 2026 |
| Rechten en zichtbaarheid | `test:data-access`, `test:coaching-visibility`, `test:menu-rights` | Alle geslaagd; dekken niet de volledige live rolmatrix | 18 juli 2026 |
| Notificatie en mail | `test:notifications`, `test:mail-service` | Geslaagd; geen externe aflevering uitgevoerd | 18 juli 2026 |
| Contracten en PDF | `test:contract-letter`, `test:pdf-report` | Geslaagd; tijdelijk PDF-testbestand gecontroleerd verwijderd | 18 juli 2026 |
| SalesDay en Inventory | `test:sales-erp-contracts`, `test:inventory-shared`, `test:salesday-pwa-shell`, `test:salesday-attachments` | Alle geslaagd; alleen mock-/contractgedrag | 18 juli 2026 |
| Contact, Help en starterevaluaties | `test:contact-moments`, `test:help-requests`, `test:starter-evaluations` | Alle geslaagd | 18 juli 2026 |
| UI-read-only | Bestaande lokale sessie op 1280×800, 768×1024 en 390×844 | Shell, navigatie, disabled/errorstates en responsive basis gecontroleerd; geen volledige rol- of device-UAT | 18 juli 2026 |

## Statistieken

- Totaal aantal bevindingen: **54**
- P0: **1**
- P1: **27**
- P2: **23**
- P3: **2**
- P4: **1**
- Status Nieuw: **48**
- Status Beslissing vereist: **4**
- Status Te onderzoeken: **1**
- Status Geblokkeerd extern: **1**
- Bugs: **9**
- Functionele wijzigingen: **16**
- Visuele wijzigingen: **0** als afzonderlijk type; **14** UX-bevindingen en **3** accessibility-bevindingen
- Rechtenproblemen: **11**
- Securityproblemen: **21**
- Dataproblemen: **20**
- Technische verbeteringen: **13**

> De typetellingen overlappen omdat bevindingen meerdere classificaties kunnen hebben. Prioriteits- en statustellingen zijn wederzijds exclusief en tellen beide exact op tot 54.
