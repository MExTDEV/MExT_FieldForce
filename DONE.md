# DONE

Laatste update: 2026-07-13

Historiek van afgewerkte of aantoonbaar uitgevoerde taken. Actieve open punten staan in `TODO.md`.

## 2026-07-13 - FF-P1-002/004/005 releaseveiligheid en Contactmomenten

Uitgevoerd:

- Migraties `0021` tot en met `0029` gestaged voor Git-review.
- Backupbewijs bevestigd:
  `C:\Users\jand\AppData\Local\Temp\FieldForce-db-backups\FieldForce-MExT_FieldForce-20260712T135436Z.sql`, 610202 bytes, laatst geschreven op 2026-07-12 15:54:44.
- `npm run db:migrate:deploy` uitgevoerd; `0029_contact_moment_private_photos` is succesvol toegepast.
- `npm run db:migrate:status` daarna uitgevoerd; database schema is up-to-date.
- `npm run db:generate` na de migratie-deploy opnieuw geprobeerd; lokale Prisma query-engine rename-lock bleef eerst actief.
- Lock holder geïdentificeerd als de FieldForce devserver op poort 3000.
- Met expliciete toestemming van de eigenaar alleen de FieldForce devserverprocesketen gestopt.
- `npm run db:generate` daarna succesvol uitgevoerd.
- `npm run build` daarna succesvol uitgevoerd.
- Devserver niet opnieuw gestart; lokaal verder testen blijft user-managed via `keep-fieldforce-dev.ps1`.
- Eerste `npm run db:migrate:status` uitgevoerd tegen `MExT_FieldForce` op `vps-2486653.yourvps.io:3306`; daarbij was `0029_contact_moment_private_photos` nog pending.
- Contactmomenten-PDF-export toegevoegd via `lib/contact-moment-pdf.ts`.
- Contactmoment-detailpagina uitgebreid met PDF-download voor definitieve Contactmomenten.
- PDF-export laadt beschikbare private foto's via de bestaande Contactmoment-foto-API.
- `FIELD_FORCE_UPLOAD_ROOT` toegevoegd aan `.env.example`.
- Database-, deployment-, Contactmomenten-, Known Issues- en TODO-documentatie bijgewerkt.

Validatie:

- `npm run test:contact-moments` geslaagd.
- `npm run test:contact-moment-filters` geslaagd.
- `npm run test:contact-moment-pdf` geslaagd.
- `npm run test:outlook-sync` geslaagd.
- `npm run typecheck` geslaagd.
- `npm run db:generate` geslaagd na unlock.
- `npm run build` geslaagd na unlock.

Open:

- Echte Microsoft Graph create/update/delete-acceptatie vereist gedelegeerde Microsoft tokens in staging/productie.
- Uploadroot-backup en restore moeten operationeel bewezen worden.
- Browser/tablet upload-download-PDF-smoke blijft handmatige acceptatie via de extern beheerde devserver of staging.

## 2026-07-12 22:48:08 +02:00 - FF-P1-001 releasebasis dirty working tree

Uitgevoerd:

- Eerste TODO gekozen: `FF-P1-001 - Releasebasis en dirty working tree formaliseren`.
- Dirty working tree vastgelegd in `docs/technical/release-baseline-2026-07-12.md`.
- Wijzigingen gegroepeerd in reviewbatches voor documentatie, auth/sessies, Coaching-workflows, Contactmomentfoto's, beheer/mail/import, database/migraties, i18n, scripts/tests en archieven.
- Commit- en validatievolgorde vastgelegd zodat bestaande features niet als één grote wijzigingsset hoeven te worden gereviewd.
- `TODO.md` bijgewerkt: `FF-P1-001` staat nu op `Afgerond maar verificatie nodig` en verwijst naar de baseline.
- Er is geen functionele applicatiecode aangepast voor deze taak.

Validatie:

- `npm run typecheck` geslaagd.
- `npm run lint` geslaagd.
- `npm run test:modules` geslaagd.
- `npm run test:menu-rights` geslaagd.
- Devserver niet gestart.
- Geen migraties uitgevoerd.
- Geen seeds uitgevoerd.

Open:

- Owner-review per baselinebatch blijft nodig.
- `FF-P1-002` en `FF-P1-004` blijven de aanbevolen volgende releaseveiligheidstaken.

## 2026-07-12 22:03:19 +02:00 - Contactmomenten/Hulpaanvragen i18n-sweep

Uitgevoerd:

- Bestaande hardcoded UI-copy in `components/contact-help-workflows.tsx` vervangen door `translate(...)`-keys.
- Nieuwe Contactmomenten- en Hulpaanvragen-keys toegevoegd aan `locales/nl.json`, `locales/fr.json` en `locales/de.json`.
- Thema- en vervolgactie-labels tonen vertaald, terwijl bestaande opgeslagen workflowwaarden behouden blijven.
- Datumnotatie in deze flows afgestemd op de actieve taal.
- Gerichte i18n-regressietest toegevoegd: `npm run test:contact-help-i18n`.
- Contactmomenten-fotoquery syntax hersteld door de SQL-backticks rond `User` correct te escapen.
- Lint-exceptie toegevoegd voor private API-backed foto previews, omdat die niet via Next image optimization lopen.
- `TODO.md` en `docs/ai/modules/Coaching/TODO.md` bijgewerkt zodat de afgeronde i18n-restpunten niet open blijven staan.

Validatie:

- `npm run test:contact-help-i18n` geslaagd.
- `npm run test:contact-moments` geslaagd.
- `npm run test:help-requests` geslaagd.
- `npm run typecheck` geslaagd.
- `npm run lint` geslaagd zonder warnings.

## 2026-07-12 - Databasecontrole Actiepunten en KPI-beheer

Uitgevoerd:

- Actieve databaseomgeving vastgesteld via `.env`: MySQL host `vps-2486653.yourvps.io`, database `MExT_FieldForce`, `SEED_ALLOW_DESTRUCTIVE=false`.
- `.env.local` bevat geen `DATABASE_URL`.
- Migratiebestanden `0019_action_point_management` en `0020_kpi_management` inhoudelijk gecontroleerd: additieve tabellen/kolommen/indexen/FK's, geen destructieve `DROP`/`TRUNCATE`/reset.
- `npm run db:migrate:status` uitgevoerd: database schema up-to-date.
- Directe DB-check uitgevoerd: `0019_action_point_management` en `0020_kpi_management` stonden al uitgevoerd op 2026-07-10, zonder rollback/logfout.
- Verwachte tabellen en kolommen voor Actiepunten/KPI-beheer bestaan.
- Logische SQL-back-up gemaakt buiten Git:
  `C:\Users\jand\AppData\Local\Temp\FieldForce-db-backups\FieldForce-MExT_FieldForce-20260712T135436Z.sql`
- Back-up gevalideerd: 610202 bytes, 56 tabellen, schema-DDL en data-inserts.
- `npm run db:migrate:deploy` uitgevoerd: geen pending migrations.
- `npm run db:seed:config` twee keer uitgevoerd; beide keren zonder fouten.
- Seed-idempotentie gecontroleerd: geen dubbele codes in action target types, KPI categories/types/target types of KPI definitions.
- Actiepunten en KPI technische/functionele tests uitgevoerd.

Validatie:

- `npx prisma validate` geslaagd.
- `npm run db:migrate:status` geslaagd, schema up-to-date.
- `npm run test:action-points-overview` geslaagd.
- `npm run test:action-point-targets` geslaagd.
- `npm run test:kpi-settings` geslaagd.
- `npm run test:menu-rights` geslaagd.
- `npm run test:management-import-export` geslaagd.
- `npm run typecheck` geslaagd.
- `npm run lint` geslaagd.
- `npx next build` geslaagd met bestaande Prisma Client.

Niet volledig afgerond:

- `npm run db:generate` faalde lokaal door Windows Prisma query-engine rename-lock:
  `EPERM ... query_engine-windows.dll.node.tmp... -> query_engine-windows.dll.node`.
- `npm run build` faalde om dezelfde prebuild `prisma generate` lock.
- Vervolg staat in `TODO.md` onder `TODO-011`.

Hercontrole:

- `npm run db:generate` is opnieuw uitgevoerd op 2026-07-12.
- De blokkade blijft dezelfde lokale Windows Prisma query-engine rename-lock:
  `EPERM ... query_engine-windows.dll.node.tmp... -> query_engine-windows.dll.node`.
- `npm run build` is daarom niet opnieuw gestart; de prebuild-stap voert opnieuw `prisma generate` uit en zou dezelfde lock raken.
- `TODO-011` blijft open in `TODO.md`.

Restoreprocedure voor de gemaakte back-up:

- Gebruik een MySQL/MariaDB client op een veilige beheeromgeving.
- Restore naar dezelfde of een lege doel-database met de juiste credentials.
- Voer het SQL-bestand uit tegen de doel-database.
- Verifieer daarna `_prisma_migrations`, tabelcounts en applicatieconnectie.
- Het back-upbestand bevat schema en data en mag niet in Git worden geplaatst.

## 2026-07-12 - RM-004 Contactmomenten eerste vervolgstap

Uitgevoerd:

- Contactmomenten technisch aangesloten op de bestaande Microsoft Graph/Outlook-sync.
- Contactmomenten gebruiken dezelfde `Intervention` Outlookvelden.
- Geannuleerde en niet-uitgevoerde Contactmomenten verwijderen het bestaande Outlook-event wanneer dat bestaat.
- Client past Outlook-syncstatus nu ook toe op Contactmomenten.
- Gerichte test `npm run test:outlook-sync` toegevoegd.

Validatie:

- `npm run test:outlook-sync` geslaagd.
- `npm run test:contact-moments` geslaagd.
- `npm run typecheck` geslaagd.
- `npm run lint` geslaagd.
- `npx next build` geslaagd.

Open:

- Externe Graph-validatie met echte Microsoft tokens staat in `TODO.md`.

## 2026-07-12 - Contactmomenten overzichtsfilters

Uitgevoerd:

- Filterbalk toegevoegd aan het Contactmomenten-overzicht.
- Filters toegevoegd voor Alle, Vandaag, Toekomstig, Conceptverslagen, Gedeeld, Geannuleerd en Niet uitgevoerd.
- Filterlogica werkt op de bestaande permission-gefilterde contactmomentenlijst en verbreedt geen scope.
- Conceptverslagen omvatten `concept`, `wacht_op_vt_input` en `in_uitvoering` voor compatibiliteit met bestaande/historische statuswaarden.
- Gerichte helper en test toegevoegd: `lib/contact-moment-filters.ts` en `npm run test:contact-moment-filters`.

Validatie:

- `npm run test:contact-moment-filters` geslaagd.
- `npm run test:contact-moments` geslaagd.
- `npm run typecheck` geslaagd.
- `npm run lint` geslaagd.

## 2026-07-12 - RM-003 centrale mailservice

Uitgevoerd:

- Mailsectie toegevoegd onder Beheer -> Instellingen.
- `MAIL TEST` onder Mail geplaatst.
- SMTP-server, poort, protocol, authenticatie, username, write-only password, default from en reply-to beheerbaar gemaakt.
- SMTP-wachtwoord wordt niet naar browser/auditlog geschreven.
- `nodemailer` toegevoegd.
- Centrale mailservice en mailtemplates toegevoegd.
- Hulpaanvragen en zichtbare/gedeelde Contactmomenten sturen best-effort mail via de centrale `MAIL TEST`-router.
- Delivery logging beperkt tot route/resultaat/error-metadata zonder mailbody.

Validatie:

- `npm run test:mail-test-settings` geslaagd.
- `npm run test:mail-service` geslaagd.
- `npm run test:help-requests` geslaagd.
- `npm run test:contact-moments` geslaagd.
- `npm run test:notifications` geslaagd.
- `npm run typecheck` geslaagd.
- `npm run lint` geslaagd.
- `npx next build` geslaagd.

Open:

- Staging/productie-testmail en contractafhankelijke approval/Professional/Expert/reminder-mails staan in `TODO.md`.

## 2026-07-12 - RM-002 generiek notificatiecentrum

Uitgevoerd:

- Generieke in-app notificaties toegevoegd op `NotificationDelivery`.
- Approval-notificaties en generieke notificaties worden samen gelezen en gemarkeerd.
- Eventtypes en NL/FR/DE vertalingen toegevoegd voor Hulpaanvragen, Contactmomenten en Professional/Expert-events.
- Hulpaanvragen maken in-app meldingen voor nieuwe aanvraag, antwoord, sluiting en opvolging.
- Contactmomenten maken in-app meldingen voor gepland/gewijzigd/gedeeld/geannuleerd/niet uitgevoerd.
- Verborgen contactmomenten lekken niet via notificaties zolang ze niet aangekondigd of gedeeld zijn.

Validatie:

- `npm run test:notifications` geslaagd.
- `npm run test:help-requests` geslaagd.
- `npm run test:contact-moments` geslaagd.
- `npm run typecheck` geslaagd.
- `npm run lint` geslaagd.

## 2026-07-12 - RM-018 lint-waarschuwingen

Uitgevoerd:

- React hook dependency warnings in `components/performance-provider.tsx` opgelost.
- Bewuste legacy/voorziene blokken lokaal met lint-excepties gedocumenteerd.
- Lint-output is schoon.

Validatie:

- `npm run lint` geslaagd zonder warnings.
- `npm run typecheck` geslaagd.
- `npx next build` geslaagd.

## 2026-07-12 - Roadmap- en TODO-inventaris

Uitgevoerd:

- `ROADMAP-260711.md` aangemaakt als tijdelijk uitvoerregister.
- `TODO-extra.md` en `docs/ai/modules/Coaching/TODO.md` geanalyseerd.
- Open punten gekoppeld aan RM-items.
- Afgewerkte punten zijn nu samengevat in `DONE.md`; actieve punten staan in `TODO.md`.
