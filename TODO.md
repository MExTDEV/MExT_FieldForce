# FieldForce TODO

## Documentinformatie

- Auditdatum: 2026-07-12 22:27:08 +02:00
- Repository: `C:\Users\jand\Documents\Codex\FieldForce`
- Branch: `main`
- Commit: `2f1319302406319cbe90a1522064f4be42ddfaba`
- Auditor: Codex
- Working tree voor audit: al gewijzigd en met veel untracked bestanden; deze audit heeft geen functionele code aangepast.
- Geraadpleegde documentatie: `AGENTS.md`, `docs/ai/INDEX.md`, alle actuele `docs/ai/*.md`, `docs/ai/modules/Coaching/*.md`, `docs/technical/*.md`, `README.md`, `TODO.md`, `TODO-extra.md`, `ROADMAP-260711.md`, `DONE.md`, `MIGRATION_GUIDE.md`, en de meegegeven opdrachttekst.
- Geraadpleegde implementatie: `app/`, `components/`, `lib/`, `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `scripts/`, `locales/`, `public/`, `.env.example`, `server.mjs`, `package.json`.
- Uitgevoerde controles: `npm run typecheck`, `npm run lint`, `npm run test:modules`, `npm run test:menu-rights`, `npm run test:contact-help-i18n`.
- Niet-uitgevoerde controles: geen devserver, geen browsercheck, geen Prisma migraties, geen seed, geen `npm run build`, geen productie- of staginglogin, geen echte Microsoft Graph/SMTP-test.

## Managementsamenvatting

FieldForce is een brede Next.js/Prisma/MariaDB-applicatie met echte implementatie voor authenticatie, sessies, rollen, scopes, modules, coaching-workflows, beheer, notificaties, mailinstellingen, PDF-export, rapportage, PWA-shell en auditlogging. De implementatie is verder dan sommige module-documentatie aangeeft: Retrainingen, Salestrainingen en Rapportage hebben routes, componenten, API-persistentie en datamodellen, maar de Coaching-documentatie markeert hun workflows nog als `UNDEFINED`.

De grootste resterende risico's zitten niet in één enkel scherm, maar in release- en acceptatiezekerheid: veel nieuwe code en migraties staan nog uncommitted, `db:generate`/`build` hebben een bekende Windows Prisma lock-risico, productie-authenticatie en externe Graph/SMTP-integraties zijn niet functioneel gevalideerd, en meerdere modules zijn technisch aanwezig zonder volledig vastgelegde businessdefinitie.

Prioriteitentelling:

- P0: 0
- P1: 8
- P2: 14
- P3: 4

## Kritieke bevindingen

Er is geen bewezen P0 gevonden tijdens deze documentatie-audit. Wel zijn er P1-risico's die voor productieacceptatie eerst moeten worden opgelost of expliciet vrijgegeven:

- De repository was vooraf zeer dirty, inclusief Prisma-migraties, API's, componenten, locale-bestanden, scripts en documentatie.
- Productieauthenticatie, sessies, Entra ID en externe Graph/SMTP-integraties zijn geïmplementeerd maar niet end-to-end bevestigd.
- Meerdere functionele gebieden zijn technisch aanwezig terwijl hun officiële workflowdocumentatie `UNDEFINED` of `PARTIALLY_DEFINED` blijft.
- De buildketen blijft afhankelijk van `prisma generate`, dat volgens bestaande documentatie lokaal op een Windows query-engine lock kan blokkeren.
- Er is geen CI-configuratie aangetroffen; kwaliteitsborging gebeurt via losse scripts.

## Aanbevolen uitvoeringsvolgorde

1. Stabiliseer releasebasis: dirty tree beoordelen, migratiestatus bevestigen, Prisma Client/build opnieuw valideren.
2. Valideer authenticatie, sessies, rolrechten en productieconfiguratie.
3. Rond externe integraties af: Microsoft Graph/Outlook en SMTP/mail delivery.
4. Leg undefined workflows vast voordat UI/API's verder worden uitgebreid.
5. Werk kernmodules af: Contactmomenten, Hulpaanvragen, Professional/Expert, Actiepunten.
6. Breng rapportage, KPI's en exports naar acceptatieniveau met vaste datasets.
7. Voer i18n-, tablet-, browser- en accessibility-acceptatie uit.
8. Consolideer documentatie en verwijder oude of lege documentpaden.
9. Zet CI of een vaste pre-release commandoset op.

## P0 - Blokkerend of kritiek

Geen P0-items bevestigd op basis van deze audit. Blijf P0 gebruiken zodra dataverlies, onbevoegde toegang, loginblokkade, productiestartblokkade of ontbrekende noodzakelijke migraties concreet wordt aangetoond.

## P1 - Hoog

### FF-P1-001 - Releasebasis en dirty working tree formaliseren

- Categorie: Releasebeheer, configuratie, risicobeheersing
- Status: Afgerond maar verificatie nodig
- Probleem: De workspace bevatte voor deze audit al veel gewijzigde en untracked code, migraties, tests, locale-bestanden en documentatie.
- Huidige werking: `docs/technical/release-baseline-2026-07-12.md` groepeert de dirty working tree in reviewbatches voor instructies/documentatie, auth/sessies, Coaching-workflows, Contactmomentfoto's, beheer/mail/import, database/migraties, i18n, scripts/tests en archiefdocumentatie.
- Gewenste werking: Voor release- of vervolgontwikkeling moet duidelijk zijn welke wijzigingen horen bij welke taak, welke al getest zijn en welke nog review nodig hebben.
- Bewijs: `git status --short`; `docs/technical/release-baseline-2026-07-12.md`; root `AGENTS.md` vereist behoud van andermans wijzigingen en feitelijke rapportage.
- Relevante bestanden: volledige working tree; in het bijzonder `docs/technical/release-baseline-2026-07-12.md`, `prisma/migrations/0021_*` tot `0029_*`, `components/contact-help-workflows.tsx`, `lib/server/contact-moment-photos.ts`, `locales/*.json`.
- Impact: Hoog, omdat vervolgwerk anders gemakkelijk bestaande wijzigingen overschrijft of ongeteste functionaliteit als stabiel behandelt.
- Risico: Onbedoelde regressies, onduidelijke release-inhoud, moeilijk reviewbare pull request.
- Afhankelijkheden: Beslissing van eigenaar over branch/commit-strategie en inhoudelijke review per batch.
- Voorgestelde aanpak: Gebruik de release-baseline als review- en commitkaart. Commit niet alles samen; valideer per batch en behandel database/migraties eerst.
- Acceptatiecriteria: Release-baseline bestaat; `TODO.md` en `DONE.md` verwijzen ernaar; owner kan per batch beslissen wat gecommit, geparkeerd of gesplitst wordt.
- Aanbevolen tests: Per baselinebatch de genoemde tests; voor deze documentatie-update minimaal `npm run typecheck` en `npm run lint`.

### FF-P1-002 - Prisma Client generatie en productiebuild opnieuw bevestigen

- Categorie: Build, database, release
- Status: Gevalideerd na user-approved devserver stop
- Probleem: Bestaande documentatie meldt dat `npm run db:generate` lokaal faalt op een Windows Prisma query-engine rename-lock, en dat `npm run build` via `prebuild` dezelfde stap raakt.
- Huidige werking: `package.json` heeft `prebuild: prisma generate`; `docs/ai/07_KNOWN_ISSUES.md`, `docs/technical/database.md` en de oude TODO beschrijven de lock als terugkerend risico.
- Gewenste werking: `npm run db:generate` en daarna `npm run build` moeten slagen op een schone omgeving of de blokkade moet als lokale omgevingsfout met workaround gedocumenteerd zijn.
- Bewijs: `package.json`; `docs/ai/07_KNOWN_ISSUES.md`; `docs/technical/database.md`; gearchiveerde `TODO-archive-2026-07-12.md`.
- Relevante bestanden: `package.json`, `prisma/schema.prisma`, `docs/technical/database.md`, `docs/ai/07_KNOWN_ISSUES.md`.
- Impact: Hoog, omdat deploys en releasevalidatie afhankelijk zijn van gegenereerde Prisma Client en productiebuild.
- Risico: Build- of deployblokkade vlak voor release.
- Afhankelijkheden: Vrijgave van Windows file lock of run op schone omgeving/CI.
- Voorgestelde aanpak: Proces dat Prisma query-engine gebruikt stoppen, `npm run db:generate` herhalen, daarna `npm run build`; bij blijvende lock een schone clone of CI-run gebruiken.
- Acceptatiecriteria: `db:generate` en `build` slagen, of er is een gedocumenteerde, reproduceerbare omgevingsbeperking met alternatief bewijs.
- Aanbevolen tests: `npm run db:generate`, `npm run build`, eventueel `npm run db:migrate:status` zonder migraties toe te passen.

Update 2026-07-13:

- `npm run db:generate` is exact één keer herhaald en faalde opnieuw vóór Prisma Client-generatie op de Windows query-engine rename-lock:
  `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`.
- `npm run build` is niet herhaald, omdat `prebuild` dezelfde geblokkeerde `prisma generate` stap opnieuw zou starten voordat Next.js compilatie begint.
- `npm run typecheck` slaagde met de bestaande generated client.

Update 2026-07-13 na migratie-deploy:

- Na succesvolle toepassing van `0029_contact_moment_private_photos` is `npm run db:generate` opnieuw geprobeerd.
- Dezelfde Windows rename-lock trad opnieuw op:
  `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`.
- `npm run build` blijft niet uitgevoerd, omdat de build via `prebuild` dezelfde geblokkeerde generate-stap opnieuw zou uitvoeren.

Update 2026-07-13 na unlock:

- De lock holder was de FieldForce devserver op poort 3000 (`npm run dev -- --port 3000` / `next dev --port 3000`).
- Met expliciete toestemming van de eigenaar is alleen die devserverprocesketen gestopt.
- `npm run db:generate` is daarna geslaagd.
- `npm run build` is daarna geslaagd, inclusief `prebuild`, Next.js compile, typecheck/lintfase en static page generation.
- De devserver is niet opnieuw gestart; lokaal verder testen vereist restart via `keep-fieldforce-dev.ps1`.

### FF-P1-003 - Productieauthenticatie, sessies en Entra ID end-to-end valideren

- Categorie: Authenticatie, beveiliging, productieacceptatie
- Status: Afgerond maar verificatie nodig
- Probleem: Auth.js, credentials-login, optionele Microsoft Entra ID, server-side tokenopslag en loginhistoriek zijn geïmplementeerd, maar productie-acceptatie is niet bevestigd.
- Huidige werking: `auth.ts` configureert credentials en Microsoft Entra ID; `UserLoginSession` en `MicrosoftAuthToken` bestaan; `server.mjs` en `scripts/validate-environment.ts` controleren productievariabelen.
- Gewenste werking: Database-login, Entra-login, logout, sessie-activiteit, rolwijziging en user overrides zijn in staging/productie aantoonbaar getest.
- Bewijs: `auth.ts`, `components/session-provider.tsx`, `lib/server/login-history.ts`, `lib/server/microsoft-token-store.ts`, `prisma/schema.prisma`, `docs/technical/entra-authentication.md`.
- Relevante bestanden: `app/login/page.tsx`, `app/api/auth/activity/route.ts`, `app/api/users/[id]/login-sessions/route.ts`, `lib/server/authenticated-user.ts`.
- Impact: Hoog, omdat dit de toegangspoort tot de applicatie en audittrail is.
- Risico: Login werkt lokaal/demo maar faalt of gedraagt zich anders in productie; Entra alias- of tokenproblemen blijven onzichtbaar.
- Afhankelijkheden: Staging/productieomgeving met echte secrets en testgebruikers.
- Voorgestelde aanpak: Acceptatiescript per rol uitvoeren met credentials en, indien geconfigureerd, Entra ID; sessielogs controleren; actorId/demo-routes gescheiden houden.
- Acceptatiecriteria: Aanmelden/afmelden werkt per rol; inactieve gebruikers worden geweigerd; sessielogging klopt; Entra mismatch wordt correct geweigerd.
- Aanbevolen tests: `npm run env:check:production`, `npm run test:auth-session`, `npm run test:login-history`, handmatige staging-login.

### FF-P1-004 - Productiestatus van migraties 0021-0029 bevestigen

- Categorie: Database, release, migratiebeheer
- Status: Uitgevoerd op gecontroleerde database; review/commit nog nodig
- Probleem: Recente migraties voor permission normalisatie, UTF-8, Professional/Expert, criterion scopes, Contactmomenten, Hulpaanvragen en private foto's staan als untracked bestanden in de workspace.
- Huidige werking: De migratiedirectories bestaan lokaal, maar deze audit heeft geen migratiestatus tegen een database gecontroleerd.
- Gewenste werking: Voor elke omgeving is bekend welke migraties zijn toegepast en welke nog pending zijn.
- Bewijs: `prisma/migrations/0021_normalize_user_permission_overrides/` tot `0029_contact_moment_private_photos/`; `prisma/schema.prisma`; `docs/technical/database.md`.
- Relevante bestanden: `prisma/migrations/*`, `prisma/schema.prisma`, `scripts/verify-step10-database.ts`.
- Impact: Hoog, omdat code inmiddels velden gebruikt zoals `ContactMomentDetail.photosJson`, `HelpRequestAnswer`, `NotificationDelivery` en Professional/Expert velden.
- Risico: Runtime-fouten wanneer code velden verwacht die niet in de doel-database bestaan.
- Afhankelijkheden: Toegang tot lokale/staging/productie database en migratiestatus.
- Voorgestelde aanpak: Per omgeving `prisma migrate status` of bestaand verificatiescript uitvoeren, zonder migraties automatisch toe te passen.
- Acceptatiecriteria: Migratiestatus is per omgeving gedocumenteerd; pending migraties zijn gepland; code wordt pas gedeployed na `migrate deploy`.
- Aanbevolen tests: `npm run db:migrate:status`, `npm run test:db-verification` wanneer databasecontext veilig beschikbaar is.

Update 2026-07-13:

- `npm run db:migrate:status` is uitgevoerd tegen `MExT_FieldForce` op `vps-2486653.yourvps.io:3306`.
- Prisma vond 29 migraties.
- `0021_normalize_user_permission_overrides` tot en met `0028_help_request_open_default` zijn toegepast.
- `0029_contact_moment_private_photos` is pending.
- De migraties `0021`-`0029` staan lokaal nog als untracked directories in Git en moeten vóór release in versiebeheer komen.
- Code die `ContactMomentDetail.photosJson` gebruikt blijft een runtime-risico totdat `0029` per omgeving via `npm run db:migrate:deploy` is toegepast.

Update 2026-07-13 na deploy:

- Migraties `0021`-`0029` zijn gestaged voor Git-review.
- Backupbewijs bevestigd vóór deploy:
  `C:\Users\jand\AppData\Local\Temp\FieldForce-db-backups\FieldForce-MExT_FieldForce-20260712T135436Z.sql`, 610202 bytes, laatst geschreven op 2026-07-12 15:54:44.
- `npm run db:migrate:deploy` heeft `0029_contact_moment_private_photos` succesvol toegepast.
- `npm run db:migrate:status` meldt daarna: `Database schema is up to date!`.
- De gecontroleerde database `MExT_FieldForce` op `vps-2486653.yourvps.io:3306` heeft nu alle 29 lokale migraties toegepast.
- `npm run db:generate` en `npm run build` zijn na het stoppen van de lock-houdende devserver geslaagd.

### FF-P1-005 - Contactmomenten productieklaar afronden

- Categorie: Coaching, Contactmomenten, integraties, export
- Status: Lokaal verder afgerond; externe acceptatie en uploadroot-restorebewijs nog open
- Probleem: Contactmomenten zijn functioneel en technisch ver gevorderd, maar externe Graph-validatie en productieacceptatie van uploadopslag/backups zijn nog niet bevestigd.
- Huidige werking: Route `/contactmomenten`, `ContactMomentsPage`, serverpersistentie, statusvalidatie, private foto-API, PDF-export en notificatie/mailtemplates bestaan. Foto's worden via een private API gelezen en metadata staat in `ContactMomentDetail.photosJson`.
- Gewenste werking: Contactmomenten hebben gevalideerde Outlook-sync, veilige en gedocumenteerde bestandsopslag, herstel/backup-afspraken, en PDF-export van gedeelde/gesloten rapporten.
- Bewijs: `components/contact-help-workflows.tsx`, `lib/server/contact-moment-photos.ts`, `app/api/workflows/contact-moments/[id]/photos/*`, `app/api/workflows/persist-route.ts`, `docs/ai/modules/Coaching/Contactmomenten.md`.
- Relevante bestanden: `lib/contact-moment-photo-metadata.ts`, `prisma/migrations/0026_contact_moment_execution_contract/`, `prisma/migrations/0029_contact_moment_private_photos/`, `lib/server/microsoft-graph.ts`.
- Impact: Hoog voor managers en vertegenwoordigers die contactrapporten en foto's als bewijs gebruiken.
- Risico: Externe agenda-sync, uploadopslag of export blijkt pas in productie niet volledig.
- Afhankelijkheden: Microsoft tokens, `FIELD_FORCE_UPLOAD_ROOT`/serveropslag, stagingacceptatie.
- Voorgestelde aanpak: stagingvalidatie met echte Graph-tokens uitvoeren, uploadroot/backup/retentie accepteren en handmatige browser/tablet upload-download-PDF-smoke uitvoeren.
- Acceptatiecriteria: Planning/update/cancel sync is getest met echte Microsoft tokens; foto's blijven private en herstelbaar; PDF bevat definitieve snapshot en beschikbare foto's; restore van uploadroot en database is aantoonbaar.
- Aanbevolen tests: `npm run test:contact-moments`, `npm run test:contact-moment-filters`, `npm run test:contact-moment-pdf`, `npm run test:outlook-sync`, handmatige upload/download/PDF-test.

Update 2026-07-13:

- `lib/contact-moment-pdf.ts` toegevoegd voor PDF-export van definitieve Contactmomenten.
- Detailpagina laadt private foto's via de bestaande API en voegt beschikbare foto's toe aan de PDF.
- `FIELD_FORCE_UPLOAD_ROOT` toegevoegd aan `.env.example`; `docs/technical/database.md` en `docs/technical/vps-deployment.md` documenteren nu opslag, backups en restorevoorwaarden.
- Lokaal gevalideerd met `npm run test:contact-moments`, `npm run test:contact-moment-filters`, `npm run test:contact-moment-pdf`, `npm run test:outlook-sync` en `npm run typecheck`.

### FF-P1-006 - Hulpaanvragen en vervolgacties beveiligen tegen undefined workflows

- Categorie: Coaching, Hulpaanvragen, workflow-integratie
- Status: Deels geïmplementeerd; Hulpaanvragen-flow uitgebreid op 2026-07-13
- Probleem: Hulpaanvragen zijn gedefinieerd en geïmplementeerd, maar vervolgacties naar Contactmoment, Retraining en Salestraining raken modules met verschillende definitiestatussen.
- Huidige werking: `/hulpaanvragen`, `HelpRequestsWorkflowPage`, `HelpRequest`, `HelpRequestAnswer` en servervalidatie bestaan. Follow-up naar begeleiding wordt strenger gevalideerd; andere vervolgtypes blijven afhankelijk van nog niet volledig gedefinieerde modules.
- Gewenste werking: Elke vervolgactie is alleen beschikbaar wanneer het doelworkflowcontract is gedefinieerd, server-side afgedwongen en getest.
- Bewijs: `components/contact-help-workflows.tsx`, `lib/workflow-engine.ts`, `app/api/workflows/persist-route.ts`, `docs/ai/modules/Coaching/Hulpaanvragen.md`, `docs/ai/INDEX.md`.
- Relevante bestanden: `app/api/workflows/help-requests/route.ts`, `prisma/migrations/0027_help_request_handling_contract/`, `prisma/migrations/0028_help_request_open_default/`.
- Impact: Hoog, omdat hulpvragen ondersteuning en escalatie structureren.
- Risico: Een gebruiker plant een vervolgactie naar een workflow waarvan rechten, statussen of zichtbaarheid niet officieel vastliggen.
- Afhankelijkheden: Definitie van Retrainingen, Salestrainingen en Contactmoment follow-upcontract.
- Voorgestelde aanpak: Follow-upmatrix vastleggen; UI-opties en servervalidatie per doeltype koppelen aan workflowstatus; regressietests uitbreiden.
- Acceptatiecriteria: Geen hidden follow-up detaillekken; managers buiten scope zien niets; geannuleerde wizard maakt geen synthetische begeleiding; server weigert undefined vervolgtypes.
- Aanbevolen tests: `npm run test:help-requests`, `npm run test:api-persistence`, extra negatieve scope-tests.

Update 2026-07-13:

- Hulpaanvragen gebruikt nu een echte rich-text editor voor omschrijving en antwoorden, met plain-text placeholder en server-side rich-text validatie.
- Managerdetail heeft één primaire knop `Verzenden`; de manager moet expliciet kiezen tussen Contactmoment, Begeleiding, Retraining, Salestraining, Sluiten of Respons.
- `Respons` is als gecontroleerde workflowstap toegevoegd zonder chatmodel: na een managerantwoord mag de vertegenwoordiger één antwoord toevoegen, waarna de aanvraag terug bij de manager ligt.
- Nieuwe aanvragen, managerantwoorden, sluitingen en vertegenwoordigerresponsen gebruiken de bestaande in-app notificatie- en mailroute; mails bevatten de gesanitized rich-text inhoud.
- Resterend risico: Begeleiding blijft bewust via de bestaande planningswizard lopen, en Retraining/Salestraining blijven afhankelijk van hun `UNDEFINED` modulecontracten.

Update 2026-07-13 WYSIWYG Actiepunten:

- Actiepuntomschrijvingen blijven HTML als canonical rich-textformaat gebruiken en worden via de centrale `RichTextRenderer` / `rich-text-content` styling getoond.
- Actiepuntenoverzicht en zoek/previews gebruiken veilige plattetekstconversie, zodat ruwe HTML-tags niet zichtbaar worden.
- Begeleidingsdetails en actiepuntdetails renderen volledige omschrijvingen als gesanitized rich text; lege editor-markup blijft leeg.
- Professionele begeleidings-PDF zet actiepunt-rich-text om naar gestructureerde tekst met paragrafen, bullets, nummering en leesbare links zonder HTML-tags.
- Resterende technische schuld: jsPDF reproduceert inline rich-textstijl binnen compacte tabelcellen niet volledig; titels blijven vet en structuur/tekst blijven behouden.

### FF-P1-007 - Professional/Expert lifecycle volledig maken en documenteren

- Categorie: Coaching, Professional/Expert, lifecycle
- Status: Deels geïmplementeerd
- Probleem: Professional/Expert peer coaching heeft schema- en servicebasis, maar niet alle lifecycle-acties, reminders, achtergrondtaken, finale goedkeuring en action-review flow zijn productklaar bevestigd.
- Huidige werking: `RepresentativeLevel`, peer-coaching velden, business-days, notifications en tests bestaan; oude TODO's noemen ontbrekende lifecycle-events.
- Gewenste werking: Professional/Expert coaching heeft een volledig, server-side afgedwongen lifecyclecontract met UI, notificaties, reminders, locks, toegangsexpiry en audit.
- Bewijs: `prisma/migrations/0023_representative_levels_peer_coaching/`, `lib/coaching/peer-execution.ts`, `lib/server/business-days.ts`, `lib/server/notifications.ts`, `docs/ai/modules/Coaching/TODO.md`.
- Relevante bestanden: `components/coaching-wizard.tsx`, `app/api/workflows/persist-route.ts`, `lib/workflow-engine.ts`, `scripts/test-representative-level-peer-coaching.ts`.
- Impact: Hoog voor coaching van Professional/Expert profielen en contractuele opvolging.
- Risico: Lifecycle-afspraken worden inconsistent toegepast of ontbreken in notificaties.
- Afhankelijkheden: Businessbeslissingen over background jobs, finale goedkeuring en action review.
- Voorgestelde aanpak: Lifecycle-tabel vastleggen, servervalidatie afronden, notificatie- en mailmomenten koppelen, tests uitbreiden.
- Acceptatiecriteria: Alle overgangen zijn gedocumenteerd en getest; late/expired/access-gevallen zijn zichtbaar en auditeerbaar; actiepuntvoorstellen activeren pas na goedkeuring.
- Aanbevolen tests: `npm run test:representative-level-peer-coaching`, `npm run test:notifications`, `npm run test:workflow`.

### FF-P1-008 - Mailproductie en delivery logging extern valideren

- Categorie: Notificaties, mail, beheer
- Status: Afgerond maar verificatie nodig
- Probleem: SMTP-instellingen, mailtest, mailrouting en delivery logging bestaan, maar gecontroleerde staging/productietest is niet uitgevoerd in deze audit.
- Huidige werking: `SettingsManagement`, `/api/management/settings/mail-test`, `lib/server/mail-settings.ts`, `lib/server/mail-service.ts` en `NotificationDelivery` zijn aanwezig.
- Gewenste werking: Beheer kan mail veilig testen met MAIL TEST actief; productie kan mail verzenden en logging tonen zonder gevoelige mailbody.
- Bewijs: `components/settings-management.tsx`, `lib/server/mail-settings.ts`, `lib/server/mail-service.ts`, `docs/technical/mail-settings.md`.
- Relevante bestanden: `app/api/management/settings/mail-test/route.ts`, `lib/server/mail-test.ts`, `lib/server/mail-templates.ts`, `prisma/schema.prisma`.
- Impact: Hoog voor workflowcommunicatie en audit.
- Risico: Mail lijkt geconfigureerd maar verzendt niet of lekt naar echte ontvangers buiten testmodus.
- Afhankelijkheden: SMTP-credentials, staging/productieomgeving, MAIL TEST beleid.
- Voorgestelde aanpak: Gecontroleerde testmail uitvoeren, delivery log in beheer controleren, approval-mailtrigger finaliseren.
- Acceptatiecriteria: Testmail gaat naar testontvanger; productie-uitzetten van MAIL TEST vereist bevestiging; delivery log toont status zonder body/secrets.
- Aanbevolen tests: `npm run test:mail-test-settings`, `npm run test:mail-service`, gecontroleerde stagingtest.

Update 2026-07-13 akkoord-terugmelding:

- De aanvraagmail naar de begeleide gebruiker blijft bestaan.
- Na succesvolle akkoordbevestiging krijgt de verantwoordelijke coach/leidinggevende nu een in-app notificatie en best-effort FieldForce-mail via hetzelfde notificatie/mailpad.
- Ontvangers worden server-side bepaald uit de Begeleiding: owner/coach eerst, daarna de submitter of initiator als fallback; de ondertekenaar wordt uitgesloten en event keys zijn idempotent per approval.
- Externe SMTP-/MAIL TEST-validatie in staging/productie blijft open.

Update 2026-07-13 refresh Begeleidingen na inplannen:

- Uitgevoerd: de normale inplanwizard wacht nu op de bevestigde `/api/workflows/coaching`-persist voordat hij naar `/begeleidingen` navigeert.
- De workflow-API geeft de opgeslagen patch terug; `WorkflowProvider` merge't die patch in de lokale workflowstate op basis van unieke Begeleiding-id.
- Het Begeleidingen-overzicht gebruikt geen React Query/SWR/cachetags, maar de gedeelde providerstate uit `/api/workflows` met `cache: "no-store"`; gerichte invalidatie betekent hier een state-merge van de geraakte workflowpatch.
- Outlook-syncstatus of syncfout wordt op het record bijgewerkt, maar een Outlook-fout blokkeert de zichtbaarheid van de geldige FieldForce-begeleiding niet.
- Duplicaten na lokale update plus latere refetch worden voorkomen via de gedeelde workflowdeduplicatie.
- Resterende technische schuld: cross-user realtime datarefresh voor andere geopende sessies bestaat nog niet; zij zien nieuwe coachings na hun normale datarefresh of navigatie.

## P2 - Normaal

### FF-P2-001 - Retrainingen businessworkflow definiëren of technisch begrenzen

- Categorie: Coaching, Retrainingen
- Status: Deels geïmplementeerd
- Probleem: Documentatie markeert Retrainingen als `UNDEFINED`, terwijl de app route, component, API-persistentie, type en databasevelden bevat.
- Huidige werking: `/retrainingen` gebruikt `TrainingWorkflowPage kind="retraining"`; `Retraining` type en `TrainingDetail` model bestaan; workflow-engine kan opslaan en statussen wijzigen.
- Gewenste werking: Het officiële doel, rollen, velden, statussen, Planning/Dashboard/Rapportage-koppeling en actiepuntencontract zijn gedefinieerd voordat de module productief gebruikt wordt.
- Bewijs: `docs/ai/INDEX.md`, `docs/ai/modules/Coaching/Retrainingen.md`, `components/training-workflows.tsx`, `lib/workflow-engine.ts`, `app/api/workflows/retrainings/route.ts`.
- Relevante bestanden: `prisma/schema.prisma`, `components/workflow-provider.tsx`, `lib/data-access.ts`.
- Impact: Normaal tot hoog; technische beschikbaarheid kan als functionele vrijgave worden geïnterpreteerd.
- Risico: Gebruikers voeren echte retrainingen in zonder gevalideerd proces.
- Afhankelijkheden: Businessdefinitie.
- Voorgestelde aanpak: Workflowdocument invullen of module in productie expliciet uitgeschakeld houden.
- Acceptatiecriteria: `Retrainingen.md` heeft `DEFINED` of module is duidelijk niet vrijgegeven; tests dekken rechten en statusovergangen.
- Aanbevolen tests: `npm run test:planning-items`, nieuwe retraining-workflowtests.

### FF-P2-002 - Salestrainingen businessworkflow definiëren of technisch begrenzen

- Categorie: Coaching, Salestrainingen
- Status: Deels geïmplementeerd
- Probleem: Salestrainingen zijn technisch aanwezig maar officieel `UNDEFINED`.
- Huidige werking: `/sales-trainingen` gebruikt `TrainingWorkflowPage kind="sales_training"`; groepsdeelnemers en individuele/groepsactiepunten zijn in types en componenten aanwezig.
- Gewenste werking: Doelgroep, sessievorm, deelnemersbeheer, actiepuntcreatie, rollen en afsluitregels zijn vastgelegd.
- Bewijs: `docs/ai/modules/Coaching/Salestrainingen.md`, `components/training-workflows.tsx`, `lib/workflow-engine.ts`, `app/api/workflows/sales-trainings/route.ts`.
- Relevante bestanden: `prisma/schema.prisma`, `lib/reporting.ts`, `lib/data-access.ts`.
- Impact: Normaal; vooral relevant voor groepsacties en rapportage.
- Risico: Salestrainingen leveren onduidelijke actiepunten of scope in rapportage.
- Afhankelijkheden: Businessdefinitie en rapportagecriteria.
- Voorgestelde aanpak: Workflowdocument opstellen, servervalidatie en tests afstemmen.
- Acceptatiecriteria: Salestrainingen hebben een formeel statusmodel, deelnemersregels en actiepuntcontract.
- Aanbevolen tests: nieuwe salestraining-workflowtests, `npm run test:data-access`.

### FF-P2-003 - Rapportageformules, filters en exportcontract vastleggen

- Categorie: Rapportage, KPI, analytics
- Status: Deels geïmplementeerd
- Probleem: Rapportage heeft componenten en datasetbouw, maar documentatie noemt rapportage `UNDEFINED`.
- Huidige werking: `/rapportering` gebruikt `ReportingDashboard`; `lib/reporting.ts` combineert workflow-, performance- en actiepuntdata met filters; menu-rechten bestaan.
- Gewenste werking: Rapporten, filters, periodes, KPI-formules, exports en scopes zijn officieel gedefinieerd en getest met vaste verwachte cijfers.
- Bewijs: `docs/ai/INDEX.md`, `docs/ai/modules/Coaching/Rapportage.md`, `components/reporting-dashboard.tsx`, `lib/reporting.ts`.
- Relevante bestanden: `components/smart-coaching-dashboard.tsx`, `lib/smart-coaching.ts`, `scripts/test-performance-data.ts`.
- Impact: Normaal; rapportage stuurt managementbeslissingen.
- Risico: Cijfers worden als officieel gebruikt zonder gevalideerde definitie.
- Afhankelijkheden: Business-KPI definities en testdataset.
- Voorgestelde aanpak: Rapportagecontract opstellen, verwachte output vastleggen, permissietests toevoegen.
- Acceptatiecriteria: Rapporten zijn gedefinieerd; filters zijn getest per rol/scope; exports zijn wel of niet expliciet ondersteund.
- Aanbevolen tests: `npm run test:performance`, nieuwe rapportage-fixturetests.

### FF-P2-004 - Resterende actiepunten-lifecycle beslissen

- Categorie: Actiepunten, workflow
- Status: Deels geïmplementeerd
- Probleem: Sluiten van concrete actiepunten is geïmplementeerd, maar goedkeuring, heropening, herverdeling, bewijs/commentaar en overdue-escalatie zijn nog niet volledig beslist.
- Huidige werking: `ActionDefinition` blijft de scoped definitie; `ActionPoint` en `ActionPointAssignment` dragen concrete status en sluitmetadata; sluiten vereist `actionPointsClose` plus effectieve scope.
- Gewenste werking: De resterende lifecycle-acties hebben een gedocumenteerd server-side contract.
- Bewijs: `docs/ai/modules/Coaching/Actiepunten.md`, `lib/server/action-points.ts`, `lib/action-points/visibility.ts`, `prisma/schema.prisma`.
- Relevante bestanden: `components/workspace-pages.tsx`, `app/api/action-points/[id]/close/route.ts`, `lib/server/action-definitions.ts`.
- Impact: Normaal; beïnvloedt opvolging, dashboard en rapportage.
- Risico: Resterende acties worden ad hoc ingevuld zonder goedkeuringslogica.
- Afhankelijkheden: Businessbeslissing over approval, reopen, reassignment, bewijs/commentaar en escalatie.
- Voorgestelde aanpak: Resterende lifecyclebeslissing documenteren, serveracties toevoegen, statusovergangen testen.
- Acceptatiecriteria: Resterende statusovergangen zijn rol- en scopegedreven; UI en server volgen hetzelfde contract.
- Aanbevolen tests: `npm run test:action-points-overview`, `npm run test:action-point-targets`, `npm run test:action-point-close`, nieuwe lifecycletests per vervolgactie.

### FF-P2-005 - Kapstok/criteria beheer en imports afronden

- Categorie: Configuratiebeheer, criteria, import/export
- Status: Deels geïmplementeerd
- Probleem: Kapstokfasen, criteria en scopekoppelingen zijn configureerbaar, maar bulkselectie, auditdetail en import/exportcontract voor scopes zijn niet volledig bevestigd.
- Huidige werking: `ConfigurationManagement` ondersteunt kapstok en scope-editor; `CriterionScopeLink` en `ConfigurableCriterion` bestaan; CSV import/export ondersteunt `kapstok`.
- Gewenste werking: Scopebeheer is ergonomisch, auditeerbaar en importeerbaar volgens vast CSV-contract.
- Bewijs: `components/configuration-management.tsx`, `lib/server/management.ts`, `lib/server/management-import-export.ts`, `prisma/migrations/0025_configurable_criterion_scopes/`.
- Relevante bestanden: `docs/ai/modules/Coaching/Actiepunten.md`, `docs/technical/database.md`.
- Impact: Normaal; criteria bepalen coachingformulier en scores.
- Risico: Onvolledige scopekoppelingen leiden tot lege of verkeerde formulieren.
- Afhankelijkheden: CSV-contract en businesskeuze over multiselects.
- Voorgestelde aanpak: UI en import/exportcontract concretiseren, auditlog uitbreiden, lege-state in begeleiding toevoegen.
- Acceptatiecriteria: Scopekoppelingen kunnen veilig worden beheerd, geïmporteerd en geaudit.
- Aanbevolen tests: `npm run test:criterion-scopes`, `npm run test:management-import-export`.

### FF-P2-006 - KPI-beheer productieacceptatie afronden

- Categorie: KPI, beheer, rapportage
- Status: Deels geïmplementeerd
- Probleem: KPI-definities, targettypes, doelwaarden en scopebeheer zijn aanwezig, maar waarde-invoer, code-uniekheid en browser/tabletacceptatie blijven open.
- Huidige werking: `KpiDefinition`, `KpiTarget`, `KpiSnapshot`, `KpiCategory`, `KpiType` bestaan; beheer-UI en servervalidatie bestaan.
- Gewenste werking: KPI-beheer is productieklaar inclusief invoerproces, scopes, targetvalidatie en releaseacceptatie.
- Bewijs: `components/configuration-management.tsx`, `lib/server/management.ts`, `docs/ai/07_KNOWN_ISSUES.md`, `docs/technical/database.md`.
- Relevante bestanden: `prisma/migrations/0020_kpi_management/`, `scripts/test-kpi-settings.ts`.
- Impact: Normaal; KPI's sturen prestatiecirkel, rapportage en actiepunten.
- Risico: KPI-codes of scopes blokkeren lokale varianten; cijfers blijven afhankelijk van seed/import.
- Afhankelijkheden: Businessbeslissing over value-entry en code-uniekheid.
- Voorgestelde aanpak: KPI-governance vastleggen, UI acceptatietest uitvoeren, waar nodig schema/proces aanpassen.
- Acceptatiecriteria: KPI's kunnen beheerd worden binnen scope; conflictscenario's zijn gedocumenteerd; tabletgebruik is bevestigd.
- Aanbevolen tests: `npm run test:kpi-settings`, `npm run test:management-import-export`.

### FF-P2-007 - i18n-sweep voor alle zichtbare modules uitvoeren

- Categorie: Internationalisatie, UX
- Status: Deels geïmplementeerd
- Probleem: Contactmomenten, Hulpaanvragen, notificaties en instellingen gebruiken veel vertalingen, maar oudere werkruimtes bevatten nog hardcoded Nederlandstalige UI-tekst.
- Huidige werking: `locales/nl.json`, `locales/fr.json`, `locales/de.json` bestaan; `lib/i18n.ts` gebruikt Nederlands als sleutelbasis; grote componenten zoals `workspace-pages.tsx`, `training-workflows.tsx` en `reporting-dashboard.tsx` bevatten nog letterlijke UI-strings.
- Gewenste werking: Alle user-facing tekst loopt via vertalingen en ondersteunt Nederlands, Frans en Duits.
- Bewijs: `locales/*.json`, `lib/i18n.ts`, `components/workspace-pages.tsx`, `components/training-workflows.tsx`, `components/reporting-dashboard.tsx`, `components/coaching-wizard.tsx`.
- Relevante bestanden: `components/configuration-management.tsx`, `components/user-management.tsx`, `components/performance-evolution.tsx`.
- Impact: Normaal; meertaligheid is een expliciete platformregel.
- Risico: FR/DE gebruikers zien Nederlandse tekst of onvolledige statuslabels.
- Afhankelijkheden: Terminologielijst en vertaalreview.
- Voorgestelde aanpak: Module per module vertalen, sleutelcoverage testen, UI-smoke in NL/FR/DE uitvoeren.
- Acceptatiecriteria: Geen nieuwe hardcoded user-facing strings in kernflows; status-, fout-, mail- en PDF-teksten bestaan in NL/FR/DE.
- Aanbevolen tests: `npm run test:contact-help-i18n`, nieuwe i18n coverage tests, handmatige taal-smoke.

### FF-P2-008 - PWA/offline-mutaties ontwerpen

- Categorie: PWA, offline, synchronisatie
- Status: Deels geïmplementeerd
- Probleem: FieldForce heeft een manifest en service worker shell-cache, maar geen echte offline mutatiequeue, IndexedDB-laag of conflictresolutie.
- Huidige werking: `public/sw.js` cachet een kleine app shell en heeft een TODO voor background sync; `lib/storage.ts` noemt localStorage alleen voor recoverable drafts/retry metadata.
- Gewenste werking: Offlinegedrag is expliciet afgebakend of productieklaar met queue, retry, conflictregels en privacybescherming.
- Bewijs: `public/manifest.webmanifest`, `public/sw.js`, `lib/storage.ts`, `README.md`.
- Relevante bestanden: `components/service-worker-registration.tsx`, `components/workflow-provider.tsx`.
- Impact: Normaal; tabletgebruik kan netwerkfluctuaties hebben.
- Risico: Gebruikers verwachten offline werken maar wijzigingen worden niet duurzaam gesynchroniseerd.
- Afhankelijkheden: Productbeslissing over offline scope en dataprivacy.
- Voorgestelde aanpak: Offlinecontract schrijven, daarna IndexedDB/queue/conflictstrategie implementeren of offline claims beperken.
- Acceptatiecriteria: Offlinefunctionaliteit is testbaar en in UI/documentatie correct benoemd.
- Aanbevolen tests: browser offline-smoke, nieuwe queue/conflict tests wanneer gebouwd.

### FF-P2-009 - Browser-, tablet- en toegankelijkheidsacceptatie uitvoeren

- Categorie: UX, toegankelijkheid, acceptatie
- Status: Onderzoek nodig
- Probleem: Er is geen browser- of tabletvalidatie uitgevoerd tijdens deze audit; AGENTS verbiedt devserverbeheer door Codex zonder expliciete opdracht.
- Huidige werking: UI is tablet-first gebouwd met veel responsive Tailwind, maar visuele acceptatie is niet bevestigd.
- Gewenste werking: Kernflows zijn op desktop/tablet/mobiel geaccepteerd, inclusief lange tekst, lege staten, modals, tabellen, rich text, foto's en PDF-preview.
- Bewijs: `AGENTS.md` local server rule; `components/*`; `docs/ai/04_UI_GUIDELINES.md`; oude TODO.
- Relevante bestanden: `components/workspace-pages.tsx`, `components/contact-help-workflows.tsx`, `components/configuration-management.tsx`, `components/planning-calendar.tsx`.
- Impact: Normaal; app is bedoeld voor tablet en touch.
- Risico: Layout- of bedieningproblemen worden pas bij gebruikersacceptatie ontdekt.
- Afhankelijkheden: User-managed devserver of expliciete toestemming voor browsercheck.
- Voorgestelde aanpak: Extern beheerde devserver gebruiken en vaste acceptatiechecklist doorlopen.
- Acceptatiecriteria: Screenshots/notes per viewport en kernflow; blocking UX-issues gelogd.
- Aanbevolen tests: handmatige browseracceptatie, eventueel Playwright later na toestemming.

### FF-P2-010 - Mijn Team thresholds en scope-inhoud beslissen

- Categorie: Mijn Team, coaching, performance
- Status: Deels geïmplementeerd
- Probleem: Mijn Team is geïmplementeerd, maar scorethresholds en exacte operationele rollen blijven als businessbeslissing open.
- Huidige werking: `MyTeamPage`, fiche-tab visibility, planned coaching indicator en scopehelpers bestaan.
- Gewenste werking: Duidelijke criteria voor rode markering, opgenomen rollen en fiche-inhoud per actieve module.
- Bewijs: `components/workspace-pages.tsx`, `lib/my-team.ts`, `lib/my-team-fiche-visibility.ts`, `docs/ai/modules/Coaching/MijnTeam.md`, `docs/ai/modules/Coaching/TODO.md`.
- Relevante bestanden: `scripts/test-my-team-fiche-visibility.ts`, `scripts/test-my-team-planned-indicator.ts`.
- Impact: Normaal; management gebruikt Mijn Team als operationeel overzicht.
- Risico: Markeringen en zichtbaarheid worden verschillend geïnterpreteerd.
- Afhankelijkheden: Businessbeslissing over thresholds en rollen.
- Voorgestelde aanpak: Thresholds documenteren, instelbaar maken indien nodig, tests uitbreiden.
- Acceptatiecriteria: Thresholds zijn expliciet; rolmatrix klopt met code; fiche toont alleen actieve modules.
- Aanbevolen tests: `npm run test:fiche-visibility`, `npm run test:my-team-planned`.

### FF-P2-011 - PDF- en exportdekking uniformeren

- Categorie: PDF, export, audit
- Status: Deels geïmplementeerd
- Probleem: Er bestaan meerdere PDF/exportmechanismen, maar dekking is ongelijk per module en niet overal gelokaliseerd of functioneel gevalideerd.
- Huidige werking: Voorbereidings-PDF in `coaching-wizard.tsx`, professioneel coachingrapport in `lib/coaching/export-professional-report.ts`, performance-PDF in `lib/performance/export-performance-pdf`, CSV import/export in beheer.
- Gewenste werking: Per module is duidelijk welke export bestaat, welke rechten nodig zijn, welke taal wordt gebruikt en of export in auditlog komt.
- Bewijs: `components/coaching-wizard.tsx`, `components/workspace-pages.tsx`, `components/performance-evolution.tsx`, `lib/coaching/export-professional-report.ts`, `lib/management-import-export.ts`.
- Relevante bestanden: `scripts/test-professional-coaching-pdf.ts`, `components/management-import-export-panel.tsx`.
- Impact: Normaal; exports worden gebruikt als officiële output.
- Risico: Gebruikers verwachten export waar die ontbreekt of audit logging is inconsistent.
- Afhankelijkheden: Exportbeleid per module en taalkeuze.
- Voorgestelde aanpak: Exportmatrix toevoegen aan documentatie en ontbrekende exports als aparte implementatietaken plannen.
- Acceptatiecriteria: Elk exportpunt is gedocumenteerd, getest en aan rechten gekoppeld.
- Aanbevolen tests: `npm run test:pdf-report`, import/exporttests, handmatige PDF-taalreview.

### FF-P2-012 - CI of vaste kwaliteitsgate toevoegen

- Categorie: Testing, kwaliteitsbewaking
- Status: Onderzoek nodig
- Probleem: Er zijn veel nuttige scripts, maar geen `.github`/CI-configuratie aangetroffen.
- Huidige werking: Kwaliteit wordt via losse npm scripts gevalideerd; deze audit draaide typecheck, lint en drie gerichte tests.
- Gewenste werking: Een vaste pre-release gate draait minimaal typecheck, lint, kern-permissietests, moduleconfiguratie en relevante domeintests.
- Bewijs: `package.json`; `scripts/`; geen `.github`-bestand gevonden via bestandsinventaris.
- Relevante bestanden: `package.json`, `scripts/test-*.ts`, `docs/ai/05_DEVELOPMENT_STANDARDS.md`.
- Impact: Normaal; regressierisico stijgt met veel modules en rechtenlogica.
- Risico: Belangrijke scripts worden vergeten of in verkeerde volgorde gedraaid.
- Afhankelijkheden: Keuze voor CI-platform of lokale releaseprocedure.
- Voorgestelde aanpak: `npm run validate` of CI-workflow definiëren met veilige defaults.
- Acceptatiecriteria: Eén gedocumenteerde commandoset of CI-run geeft releasebasisstatus.
- Aanbevolen tests: nieuwe `validate` script of CI workflow met bestaande scripts.

### FF-P2-013 - Lege businessdocumentatie invullen of verwijderen uit scope

- Categorie: Documentatie, business ownership
- Status: Onderzoek nodig
- Probleem: Alle bestanden onder `docs/business/*.md` zijn leeg.
- Huidige werking: `docs/business/Coaching.md`, `Contracten.md`, `KPI.md`, `Producten.md`, `Salesday.md`, `Service.md`, `Terminologie.md` bestaan met lengte 0.
- Gewenste werking: Lege documenten worden gevuld, naar de juiste bron verwezen of expliciet als placeholder gemarkeerd.
- Bewijs: bestandsinventaris met lengte 0.
- Relevante bestanden: `docs/business/*.md`.
- Impact: Normaal; lege bestanden suggereren ontbrekende of vergeten broninformatie.
- Risico: AI of ontwikkelaars openen lege documenten en missen businessregels.
- Afhankelijkheden: Documentatie-eigenaar en bronmateriaal.
- Voorgestelde aanpak: Per bestand beslissen: invullen, verwijzen naar `docs/ai`/`FieldForce.md`, of verwijderen na goedkeuring.
- Acceptatiecriteria: Geen leeg businessdocument zonder status of verwijzing.
- Aanbevolen tests: documentatiecheck op lege `.md`-bestanden.

### FF-P2-014 - Verouderde README- en technische documentpaden corrigeren

- Categorie: Documentatie, onboarding
- Status: Te doen
- Probleem: README en enkele technische docs verwijzen naar oude paden zoals `docs/vps-deployment.md` en `docs/entra-authentication.md`, terwijl de bestanden onder `docs/technical/` staan.
- Huidige werking: Nieuwe documentatie staat in `docs/technical`, maar root README noemt nog oude paden.
- Gewenste werking: Alle documentlinks wijzen naar bestaande bestanden.
- Bewijs: `README.md`; `docs/technical/vps-deployment.md`; `docs/technical/entra-authentication.md`; `docs/technical/database.md`.
- Relevante bestanden: `README.md`, `docs/technical/database.md`, `docs/technical/vps-deployment.md`.
- Impact: Normaal; onboarding en deployment kunnen verkeerde documenten missen.
- Risico: Ontwikkelaars volgen oude of niet-bestaande paden.
- Afhankelijkheden: Geen functionele afhankelijkheid.
- Voorgestelde aanpak: Paden in README en technische docs corrigeren.
- Acceptatiecriteria: Alle genoemde Markdown-links bestaan.
- Aanbevolen tests: `rg` op `docs/[^t]` en linkcheck.

### FF-P2-015 - Uploadopslag en privacybeleid voor contactfoto's vastleggen

- Categorie: Bestandsopslag, privacy, deployment
- Status: Onderzoek nodig
- Probleem: Contactfoto's worden buiten de database als bestanden opgeslagen; opslaglocatie, backup, retentie, cleanup en privacybeleid zijn nog niet als deploymentcontract bevestigd.
- Huidige werking: `lib/server/contact-moment-photos.ts` gebruikt `FIELD_FORCE_UPLOAD_ROOT` of `storage/uploads/contact-moments` en slaat metadata in `photosJson` op.
- Gewenste werking: Er is een expliciet beleid voor opslaglocatie, backups, toegang, verwijdering, migratie tussen servers en maximale bestandsgrootte/types.
- Bewijs: `lib/server/contact-moment-photos.ts`, `app/api/workflows/contact-moments/[id]/photos/*`, `prisma/migrations/0029_contact_moment_private_photos/`.
- Relevante bestanden: `docs/technical/vps-deployment.md`, `.env.example`.
- Impact: Normaal; foto's kunnen persoonsgegevens of klantinformatie bevatten.
- Risico: Foto's raken verloren bij deploy, backup mist uploads, of retentie is onduidelijk.
- Afhankelijkheden: Plesk/filesystemkeuze en privacybeleid.
- Voorgestelde aanpak: Uploaddirectory in `.env.example` en technische docs vastleggen; backup/retentie en cleanup beschrijven.
- Acceptatiecriteria: Opslagpad is configureerbaar en gedocumenteerd; backups omvatten uploadmap; privacyregels zijn bekend.
- Aanbevolen tests: upload/download/delete-test en restore-test op staging.

## P3 - Laag

### FF-P3-001 - Oude en dubbele documentatie opruimen

- Categorie: Documentatie, onderhoud
- Status: Te doen
- Probleem: `docs/ai/old/` en `docs/ai/modules/Coaching/old/` bevatten oude, soms zeer uitgebreide documenten; enkele oude modulebestanden zijn leeg.
- Huidige werking: Oude documentatie staat naast actuele docs en kan verwarring veroorzaken.
- Gewenste werking: Oude docs zijn duidelijk gearchiveerd, niet als actuele bron gebruikt, en lege oude bestanden zijn verklaard.
- Bewijs: bestandsinventaris; lege bestanden `docs/ai/modules/Coaching/old/Rapportage.md`, `Retrainingen.md`, `Salestrainingen.md`.
- Relevante bestanden: `docs/ai/old/`, `docs/ai/modules/Coaching/old/`.
- Impact: Laag tot normaal; vooral AI-context en onboarding.
- Risico: Verouderde regels worden per ongeluk gevolgd.
- Afhankelijkheden: Documentatie-eigenaar.
- Voorgestelde aanpak: Archive header toevoegen of oude map buiten actieve docs plaatsen.
- Acceptatiecriteria: Actieve index verwijst niet naar oude docs; oude docs hebben archiefstatus.
- Aanbevolen tests: documentatie-indexcheck.

### FF-P3-002 - `WorkspacePage` en grote clientcomponenten gefaseerd opsplitsen

- Categorie: Technische schuld, onderhoudbaarheid
- Status: Te doen
- Probleem: `components/workspace-pages.tsx` is een zeer grote centrale clientcomponent met routering, dashboard, team, coachingdetail, actiepunten, profiel en beheerdoorverwijzing.
- Huidige werking: De catch-all route werkt, maar veel verantwoordelijkheden zitten in één bestand.
- Gewenste werking: Grote schermen worden per module/component opgesplitst zonder gedrag te wijzigen.
- Bewijs: `components/workspace-pages.tsx` bevat functies `WorkspacePage`, `Dashboard`, `MyTeamPage`, `RepresentativeDetail`, `CoachingDetail`, `InterventionList`, `ActionPoints`, `Planning`, `Management`.
- Relevante bestanden: `app/[...slug]/page.tsx`, `components/workspace-pages.tsx`.
- Impact: Laag tot normaal; onderhoud en reviewkosten.
- Risico: Kleine wijzigingen krijgen brede blast radius.
- Afhankelijkheden: Geen functionele afhankelijkheid; refactor pas na testdekking.
- Voorgestelde aanpak: Eerst routering en per module componenten scheiden met snapshot/behavior tests.
- Acceptatiecriteria: Geen gedragwijziging; imports zijn logisch per module; bestaande tests blijven groen.
- Aanbevolen tests: `npm run typecheck`, `npm run lint`, modulegerichte tests.

### FF-P3-003 - Terminologie en accentkwaliteit in vertalingen nalopen

- Categorie: Terminologie, i18n
- Status: Te doen
- Probleem: Sommige Franse notificatieteksten gebruiken ASCII-vormen waar accenten verwacht worden; terminologie verschilt tussen Contact, Contactmoment, Begeleiding en Accompagnement.
- Huidige werking: `locales/fr.json` bevat zowel correcte accenten als strings zoals `a valider`, `pret`, `Reponse`.
- Gewenste werking: Terminologie en diacritics zijn consistent in NL/FR/DE.
- Bewijs: `locales/fr.json`; `locales/de.json`; `locales/nl.json`.
- Relevante bestanden: `docs/business/Terminologie.md`, `FieldForce.md`, `locales/*.json`.
- Impact: Laag; professioneel taalgebruik.
- Risico: Onprofessionele of inconsistente UI.
- Afhankelijkheden: Terminologielijst.
- Voorgestelde aanpak: Terminologielijst opstellen en vertaalreview per taal doen.
- Acceptatiecriteria: Kerntermen zijn consistent; accenten zijn waar nodig aanwezig.
- Aanbevolen tests: i18n-keycoverage en handmatige taalreview.

### FF-P3-004 - Historiek en TODO-archieven periodiek consolideren

- Categorie: Documentatie, historiek
- Status: Te doen
- Probleem: Root `DONE.md`, Coaching history, oude TODO's, `ROADMAP-260711.md`, `TODO-extra.md` en nieuwe archieven bestaan naast elkaar.
- Huidige werking: Historiek is bruikbaar maar verspreid.
- Gewenste werking: Actieve TODO, voltooid werk en archieven hebben duidelijke eigenaarschap en verwijzingen.
- Bewijs: `DONE.md`, `docs/ai/modules/Coaching/history/COMPLETED_2026-Q3.md`, `ROADMAP-260711.md`, `TODO-extra.md`, `TODO-archive-2026-07-12.md`.
- Relevante bestanden: root documentatie en `docs/ai/modules/Coaching/history/`.
- Impact: Laag; contextbeheer.
- Risico: Nieuwe taken worden dubbel of uit verouderde lijsten overgenomen.
- Afhankelijkheden: Documentatiebeleid.
- Voorgestelde aanpak: Maandelijkse archiefstructuur of index toevoegen.
- Acceptatiecriteria: Eén actieve TODO-bron; historie verwijst naar afgeronde taken.
- Aanbevolen tests: documentatie-inventaris.

## Bevindingen die eerst verder onderzocht moeten worden

- Productie/staging status van migraties 0021-0029.
- Echte Microsoft Graph create/update/cancel flow voor Begeleidingen en Contactmomenten.
- SMTP- en MAIL TEST-gedrag in staging/productie.
- Browser/tabletweergave via extern beheerde devserver.
- Of Reporting/KPI cijfers overeenkomen met businessverwachting.
- Of alle serverroutes direct-route access op dezelfde manier afdwingen als menu-zichtbaarheid.

## Mogelijk verouderde of dubbele code

- Oude documentatie onder `docs/ai/old/` en `docs/ai/modules/Coaching/old/`.
- Prototype-/demo-data blijft aanwezig in `lib/mock-data.ts` en `lib/development-seed.ts`, maar production docs zeggen dat dit alleen voor demo/dev bedoeld is.
- `components/workspace-pages.tsx` bevat veel modulecode die later beter gesplitst wordt.
- `docs/business/*.md` zijn lege placeholders en moeten niet als bron worden behandeld.

## Documentatie die niet overeenkomt met de implementatie

| Onderwerp | Documentatie zegt | Implementatie doet | Beoordeling | Actie |
| --- | --- | --- | --- | --- |
| Retrainingen | `UNDEFINED` | Route, component, API-persistentie, types en model bestaan | Implementatie onvolledig gedocumenteerd | FF-P2-001 |
| Salestrainingen | `UNDEFINED` | Route, component, API-persistentie, groepsdeelnemers en actiepunten bestaan | Implementatie onvolledig gedocumenteerd | FF-P2-002 |
| Rapportage | `UNDEFINED` | Dashboard, filters, datasetbouw en rechten bestaan | Implementatie onvolledig gedocumenteerd | FF-P2-003 |
| README documentpaden | Verwijst naar `docs/vps-deployment.md` en `docs/entra-authentication.md` | Bestanden staan onder `docs/technical/` | Documentatie verouderd | FF-P2-014 |
| Offline/PWA | README noemt PWA/local concept storage | Service worker is shell-cache, geen mutatiequeue | Deels geïmplementeerd | FF-P2-008 |
| Businessdocs | Bestanden bestaan | Bestanden zijn leeg | Niet verifieerbaar | FF-P2-013 |
| Contactmomentfoto's | Oude TODO zei ontwerp/implementatie nodig | Private API en metadata bestaan inmiddels | Waarschijnlijk verouderd | FF-P1-005 |

## Test- en kwaliteitslacunes

- Geen CI-configuratie gevonden.
- Geen browser/tabletacceptatie uitgevoerd.
- Geen productiebuild uitgevoerd in deze audit.
- Geen database- of migratiecommando's uitgevoerd.
- Geen echte Graph-, Entra- of SMTP-integratietest uitgevoerd.
- Rapportageformules missen vaste verwachte testdataset.

## Technische schuld

- Zeer grote clientcomponent `components/workspace-pages.tsx`.
- Gedeeltelijke i18n-migratie; meerdere modules hebben nog hardcoded tekst.
- Demo/mock-data bestaan terecht voor dev, maar blijven aandachtspunt voor productiegrenzen.
- Uploadopslag voor contactfoto's vereist deployment- en backupdocumentatie.

## Beveiligings- en privacybevindingen

- Authenticatie en server-side scopecontrole zijn aanwezig, maar productieacceptatie ontbreekt.
- Foto's worden private geserveerd via API, maar opslag/backup/retentie is nog niet gedocumenteerd.
- Demo user switcher is met env-guards afgebakend, maar moet in productie expliciet uit blijven.
- Mailtestmodus beschermt tegen ongecontroleerde verzending, maar externe SMTP-validatie ontbreekt.

## Migraties en databankacties

- Geen migraties uitgevoerd tijdens deze audit.
- Geen seeds uitgevoerd tijdens deze audit.
- Prisma schema bevat een brede domeinlaag voor gebruikers, teams, permissies, modules, KPI, coaching, contactmomenten, trainingen, hulpaanvragen, notificaties, auditlog en sessies.
- Migraties 0021-0029 zijn aanwezig in de workspace en moeten per omgeving worden bevestigd.
- `prisma/seed.ts` heeft veilige config-upserts en een destructieve dev-demo seed die door `SEED_ALLOW_DESTRUCTIVE=true` en non-production wordt bewaakt.

## Aanbevolen roadmap

### Fase 1 - Productie- en databankveiligheid

Gebruik de afgeronde release-baseline uit FF-P1-001 als kaart. Los daarna FF-P1-002 en FF-P1-004 op voordat release- of deploywerk gebeurt.

### Fase 2 - Authenticatie en rechten

Los FF-P1-003 op en breid server-side scopechecks uit waar directe routes nog niet afgedekt blijken.

### Fase 3 - Kernworkflows

Rond FF-P1-005, FF-P1-006 en FF-P1-007 af.

### Fase 4 - Gegevensconsistentie

Werk FF-P2-004, FF-P2-005 en FF-P2-006 af.

### Fase 5 - Ontbrekende of undefined functionaliteit

Beslis FF-P2-001, FF-P2-002 en FF-P2-003 voordat gebruikers deze modules productief gebruiken.

### Fase 6 - Rapportering en exports

Werk FF-P2-003 en FF-P2-011 uit met vaste testdata.

### Fase 7 - UX en internationalisatie

Werk FF-P2-007, FF-P2-009, FF-P2-010 en FF-P3-003 af.

### Fase 8 - Tests en technische schuld

Voer FF-P2-012 en FF-P3-002 uit.

### Fase 9 - Documentatie

Voer FF-P2-013, FF-P2-014, FF-P3-001 en FF-P3-004 uit.

## Archief en eerdere TODO-documenten

- Vorige root TODO: `TODO-archive-2026-07-12.md`
- Extra root backlog: `TODO-extra.md`
- Oude roadmap: `ROADMAP-260711.md`
- Voltooide root-historiek: `DONE.md`
- Coaching backlog: `docs/ai/modules/Coaching/TODO.md`
- Coaching historiek: `docs/ai/modules/Coaching/history/COMPLETED_2026-Q3.md`
