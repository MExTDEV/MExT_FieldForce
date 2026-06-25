# MExT FieldForce

**Grow. Coach. Perform.**

Tablet-first klikbaar prototype voor sales coaching, interventies, actiepunten, hulpaanvragen en KPI-opvolging in België, Nederland en Duitsland.

## Stack

- Next.js 15, React 19 en TypeScript
- Tailwind CSS
- MariaDB/MySQL en Prisma ORM
- Databasegestuurde gebruikerssessie met optionele development/staging user switcher
- PWA-manifest, service-workerbasis en lokale conceptopslag
- Vertaalbestanden voor Nederlands, Frans en Duits

## Installatie

Vereisten:

- Node.js 20 of recenter
- MariaDB 10.6+ of MySQL 8+

```bash
npm install
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed:config
npm run dev
```

Open daarna `http://localhost:3000/dashboard`.

`npm run dev` gebruikt bewust de standaard Webpack-compiler van Next.js 15.5.19.
Gebruik voor dit project niet de optionele `--turbo` of `--turbopack` flags.
Development schrijft naar `.next-dev`; productiebuilds gebruiken `.next`. Zo kunnen
beide compilers elkaars gegenereerde chunks niet vervangen.

## Database

Pas `DATABASE_URL` in `.env` aan voor de lokale MariaDB/MySQL-database:

```env
DATABASE_URL="mysql://mext_user:replace-with-password@127.0.0.1:3306/mext_fieldforce"
SEED_ALLOW_DESTRUCTIVE="false"
```

Het schema bevat gebruikers, teams, extra teamleiders, rollen/rechten, modules, niveaus, KPI-definities en snapshots, interventies, kapstokfasen en vaste/persoonlijke criteria, scores, dossiers, afspraken, actiepunten, reflecties, goedkeuringen, hulpaanvragen, productanalyse en auditlogs.

De veilige configuratie-seed gebruikt upserts en verwijdert geen bestaande businessdata:

```bash
npm run db:seed:config
```

De development demo-seed is destructief en alleen bedoeld voor lokale ontwikkeling:

```bash
SEED_ALLOW_DESTRUCTIVE=true npm run db:seed:dev
```

De demo-seed maakt onder andere:

- 30 vertegenwoordigers in BE, 20 in NL en 35 in DE
- 3 verkoopleiders in BE, 3 in NL en 4 in DE
- 5 country management users per land
- 10 group users en 1 super admin
- alle gevraagde teams, niveaus, KPI's, kapstokfasen en criteria
- KPI-snapshots voor elke vertegenwoordiger
- voorbeeldinterventies, hulpaanvragen en actiepunten

Meer details staan in `docs/database.md`.

## VPS deployment

```bash
npm run deploy:prepare
npm run start:production
```

De volledige Plesk-procedure, environmentvariabelen, wachtwoordrotatie,
health monitoring en rollback staan in `docs/vps-deployment.md`.

## Development login

De gebruikerskaart rechtsboven kan in development en private staging als demo
user switcher worden gebruikt. In publieke productie staat deze standaard uit.

- Vertegenwoordiger
- Verkoopleider
- Country Manager
- Group Manager
- Admin
- Super Admin

In development/demo passen de zichtbare vertegenwoordigers en beheeropties zich direct aan de gekozen rol, het land en het team aan. De laatste demogebruiker wordt alleen in deze modus in `localStorage` bewaard.

## Rechten

De centrale helper staat in `lib/permissions.ts`. De API-routes valideren de aangemelde databasegebruiker en passen rollen, rechten en vertegenwoordigerscope server-side toe. UI-filtering blijft aanvullend actief voor een rustige gebruikerservaring.

## Authenticatie

Auth.js ondersteunt altijd database-login met e-mailadres en een veilig
gehasht wachtwoord. Microsoft Entra ID is een optionele tweede loginmethode.
Productie gebruikt `NEXT_PUBLIC_AUTH_MODE="credentials"`; de lokale demomodus
blijft beschikbaar met `NEXT_PUBLIC_AUTH_MODE="demo"`.

Bij de eerste geldige aanmelding wordt een bestaande actieve databasegebruiker op e-mailadres gevonden en aan de onveranderlijke Entra object-ID gekoppeld. De app maakt niet automatisch nieuwe gebruikers aan. Zie `docs/entra-authentication.md` voor registratie, redirect-URL's en configuratie.

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

- De centrale bedrijfsdata, workflows, rollen en rechten gebruiken MariaDB/MySQL.
- Auth.js en de Entra-koppeling zijn geïmplementeerd; een echte tenantregistratie en secrets zijn nog nodig om de productie-login te activeren.
- Formulieren gebruiken lokale state; alleen het begeleidingsconcept heeft lokale autosave.
- De rapporten en grafieken zijn representatieve prototypevisualisaties.
- Volledige accessibility-, browser-, autorisatie- en offline-tests horen bij de volgende productiefase.

## Volgende technische stappen

1. De Entra-appregistratie invullen en aanmeldingen voor alle rollen aanvaardingstesten.
2. Server-side autorisatietests voor elke rol en hoofdworkflow toevoegen.
3. Zod-validatie en optimistic updates verder uniformeren.
4. IndexedDB, mutation queue en conflictresolutie voor offline gebruik implementeren.
5. Accessibility- en browserregressietests automatiseren.
