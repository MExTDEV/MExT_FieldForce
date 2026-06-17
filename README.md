# MExT FieldForce

**Grow. Coach. Perform.**

Tablet-first klikbaar prototype voor sales coaching, interventies, actiepunten, hulpaanvragen en KPI-opvolging in België, Nederland en Duitsland.

## Stack

- Next.js 15, React 19 en TypeScript
- Tailwind CSS
- PostgreSQL en Prisma ORM
- Mock sessie met centrale rollen- en rechtenhelper
- PWA-manifest, service-workerbasis en lokale conceptopslag
- Vertaalbestanden voor Nederlands, Frans en Duits

## Installatie

Vereisten:

- Node.js 20 of recenter
- PostgreSQL 15 of recenter

```bash
npm install
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open daarna `http://localhost:3000/dashboard`.

`npm run dev` gebruikt bewust de standaard Webpack-compiler van Next.js 15.5.19.
Gebruik voor dit project niet de optionele `--turbo` of `--turbopack` flags.
Development schrijft naar `.next-dev`; productiebuilds gebruiken `.next`. Zo kunnen
beide compilers elkaars gegenereerde chunks niet vervangen.

## Database

Pas `DATABASE_URL` in `.env` aan voor de lokale PostgreSQL-database:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mext_coaching?schema=public"
```

Het schema bevat gebruikers, teams, extra teamleiders, niveaus, KPI-definities en snapshots, interventies, kapstokfasen en criteria, scores, actiepunten, reflecties, goedkeuringen, hulpaanvragen, productanalyse en auditlogs.

De seed maakt onder andere:

- 30 vertegenwoordigers in BE, 20 in NL en 35 in DE
- 3 verkoopleiders in BE, 3 in NL en 4 in DE
- 5 country management users per land
- 10 group users en 1 super admin
- alle gevraagde teams, niveaus, KPI's, kapstokfasen en criteria
- KPI-snapshots voor elke vertegenwoordiger
- voorbeeldinterventies, hulpaanvragen en actiepunten

De seed is herhaalbaar, maar verwijdert eerst de bestaande applicatiedata.

## Development login

De gebruikerskaart rechtsboven is een mock user switcher. Klik erop om te wisselen tussen:

- Vertegenwoordiger
- Verkoopleider
- Country Manager
- Group Manager
- Admin
- Super Admin

De zichtbare vertegenwoordigers en beheeropties passen zich direct aan de gekozen rol, het land en het team aan. De laatste mockgebruiker wordt in `localStorage` bewaard.

## Rechten

De centrale helper staat in `lib/permissions.ts`. UI-filtering is al actief voor vertegenwoordigers, teamscope, landscope en systeembeheer.

Voor productie moeten dezelfde controles verplicht op de serverlaag worden toegepast in route handlers, server actions en databasequeries. Client-side zichtbaarheid is nooit voldoende als beveiligingsgrens.

## Microsoft Entra ID

De gebruiker heeft al een nullable `entraId` en `.env.example` bevat de vereiste Entra-variabelen. Een volgende fase kan Auth.js toevoegen met de Microsoft Entra ID-provider en de databasegebruiker op `entraId` of e-mail koppelen.

De mock sessie is bewust los gehouden van de permissiehelper, zodat de authenticatiebron later kan worden vervangen zonder alle schermen te herschrijven.

## PWA en offline

Aanwezig:

- `public/manifest.webmanifest`
- basis service worker in `public/sw.js`
- lokale autosave van de begeleidingswizard
- centrale storage keys en helpers in `lib/storage.ts`

Nog niet aanwezig:

- IndexedDB-opslag
- versleutelde lokale data
- background sync en retrybeleid
- conflictresolutie
- offline databasequery-cache

De service worker registreert alleen in productie om caching tijdens lokale ontwikkeling voorspelbaar te houden.

## Meertaligheid

De vertaalbestanden staan in:

- `locales/nl.json`
- `locales/fr.json`
- `locales/de.json`

Navigatie, centrale acties en statussen lopen via de vertaalhelper. De taalwisselaar werkt direct. Nieuwe schermtekst moet in een volgende iteratie volledig naar de woordenboeken worden overgezet.

## Beschikbare routes

Alle gevraagde routes zijn bereikbaar. De kernroutes bevatten werkende prototype-inhoud:

- dashboard
- vertegenwoordigerslijst en detail met tabs
- planning
- interventielijsten
- zesstaps begeleidingswizard
- hulpaanvragen
- actiepunten met statusupdates
- rapportering
- gebruikers-, teams-, KPI- en kapstokbeheer

Rollen en instellingen zijn voorbereid als beheeroppervlak en kunnen in een volgende iteratie met echte CRUD-acties worden verbonden.

## Kende beperkingen

- De UI gebruikt momenteel centrale mockdata en schrijft nog niet naar PostgreSQL.
- Auth.js en Microsoft Entra ID zijn nog niet geïnstalleerd of geconfigureerd.
- Formulieren gebruiken lokale state; alleen het begeleidingsconcept heeft lokale autosave.
- De rapporten en grafieken zijn representatieve prototypevisualisaties.
- Volledige accessibility-, browser- en offline-tests horen bij de volgende productiefase.

## Volgende technische stappen

1. Auth.js met Microsoft Entra ID integreren en mock login achter een development flag plaatsen.
2. Prisma repository/servicefuncties toevoegen met server-side scopefilters.
3. Server actions of route handlers voor interventies, scores, reflecties en actiepunten bouwen.
4. Zod-validatie, optimistic updates en uniforme foutafhandeling toevoegen.
5. IndexedDB, mutation queue en conflictresolutie voor offline gebruik implementeren.
6. Audit logging op alle mutaties afdwingen.
7. Integratie- en end-to-endtests voor elke rol en hoofdworkflow toevoegen.
