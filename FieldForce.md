# FieldForce

## 1. Documentinformatie

- Laatste analyse: 2026-07-12 22:27:08 +02:00
- Repository: `C:\Users\jand\Documents\Codex\FieldForce`
- Branch: `main`
- Commit: `2f1319302406319cbe90a1522064f4be42ddfaba`
- Status van dit document: auditdocument op basis van code, schema, migraties, scripts en Markdown-documentatie; geen runtime- of browseracceptatie.
- Gebruikte bronnen: `AGENTS.md`, `README.md`, `docs/ai/INDEX.md`, actuele `docs/ai/*.md`, actuele `docs/ai/modules/Coaching/*.md`, `docs/technical/*.md`, `package.json`, `app/`, `components/`, `lib/`, `prisma/`, `scripts/`, `locales/`, `public/`, `.env.example`, `server.mjs`.

## 2. Doel en toepassingsgebied van FieldForce

Vastgesteld: FieldForce is een Next.js-applicatie voor MExT field management, met de nadruk op coaching, planning, vertegenwoordigersopvolging, KPI's, actiepunten, hulpaanvragen, contactmomenten, rapportage, gebruikersbeheer en configuratiebeheer.

Vastgesteld: de huidige code bevat ook voorbereidende of placeholder-domeinen voor Salesday, PST, Contract en Service via het app-switcher/menu, maar deze domeinen zijn niet als volwaardige modules uitgewerkt in dezelfde mate als Coaching.

Niet bevestigd: productie- of staginggedrag, echte Microsoft Graph-werking, echte SMTP-verzending, browser/tabletweergave en actuele databasemigratiestatus.

## 3. Doelgroepen en gebruikersrollen

Vastgesteld in `lib/types.ts`, `prisma/schema.prisma`, `lib/permissions.ts` en `lib/user-management.ts`:

- Vertegenwoordiger: eigen gegevens, eigen coaching, reflecties, rapportakkoord, hulpaanvragen en eigen actiepunten.
- Verkoopleider: teamscope, planning/begeleiding/contactmomenten/actiepunten voor eigen team.
- Sales Manager: toegewezen landen via `UserCountryAccess`.
- Country Manager: landenscope.
- Group Manager: globale scope in code, maar documentatie noemt rolgedrag deels gedefinieerd.
- Admin: beheerfuncties binnen scope, niet automatisch Super Admin.
- Super Admin: alle rechten.
- Service Operator: aanwezig in rollen en menu, maar Coaching-gedrag is deels gedefinieerd.

## 4. Organisatiestructuur

### 4.1 Landen

Vastgesteld: landen zijn `BE`, `NL` en `DE` in `Country`. Scopecontrole gebruikt `country`, `countryAccess` en role-based helpers.

### 4.2 Teams

Vastgesteld: `Team` bevat naam, land, optionele `primaryLeaderId`, actief-vlag en `TeamLeader` relaties. Migratie `0018_make_team_primary_leader_optional` maakt een team zonder verkoopleider mogelijk.

### 4.3 Gebruikers

Vastgesteld: `User` is de centrale gebruiker/vertegenwoordiger-entiteit met rol, taal, land, team, representative level, active flag, password hash, Entra ID, Microsoft mail en login aliases.

### 4.4 Rollen

Vastgesteld: rollen zijn zowel in Prisma als TypeScript vastgelegd. Rechten kunnen via `RolePermission` en `UserPermission` worden aangepast.

### 4.5 Hiërarchie

Vastgesteld: scopehelpers gebruiken rol, land, team en assigned countries. Verkoopleiders zien team en zichzelf als vertegenwoordiger wanneer van toepassing. Sales Managers zien toegewezen landen. Group Manager en Super Admin hebben globale scope.

### 4.6 Gegevensbereik

Vastgesteld: `lib/data-access.ts`, `lib/server/authenticated-user.ts`, `lib/coaching/visibility.ts` en serverroutes controleren representatieve scope, coaching participant scope, owner scope en country scope.

## 5. Authenticatie en sessies

### 5.1 Inloggen

Vastgesteld: `auth.ts` configureert Auth.js met credentials-login en optionele Microsoft Entra ID. `app/login/page.tsx` toont credentials en, wanneer geconfigureerd, Microsoft-login.

### 5.2 Sessiebeheer

Vastgesteld: sessies gebruiken JWT-strategie. Databasegebruiker en login session id worden in de Auth.js token/session payload gezet. `components/session-provider.tsx` laadt de actieve gebruiker en bredere gebruikerslijst via API's.

### 5.3 Autorisatie

Vastgesteld: serverhelpers `requireAuthenticatedUser`, `requireRole`, `requirePermission`, `requireRepresentativeScope`, `requireCoachingParticipantScope` en `requireCoachingOwnerScope` bewaken API's en workflows.

### 5.4 Inactieve gebruikers

Vastgesteld: serverauth laadt actieve gebruikers; inactieve gebruikers worden niet als geldige actor behandeld.

### 5.5 Login- en sessielogging

Vastgesteld: `UserLoginSession` en `lib/server/login-history.ts` registreren provider, user-agent, IP, login, logout, laatste activiteit, expires en duration. Beheer-UI toont sessies in `components/user-management.tsx`.

## 6. Navigatie

### 6.1 Hoofdmenu

Vastgesteld: `components/app-shell.tsx`, `lib/modules.ts`, `lib/navigation-access.ts`, `lib/management-access.ts` en `lib/app-switcher.ts` sturen hoofdmenu, app-switcher, Coaching-modules en beheeritems.

### 6.2 Beschikbaarheid per rol

Vastgesteld: zichtbaarheid vereist tegelijk menu-permissie, module-permissie en soms rol/scope. Client-side zichtbaarheid wordt aangevuld met server-side route/API checks.

### 6.3 Moduleconfiguratie

Vastgesteld: `AppModule` en `lib/server/modules.ts` bewaren actieve modules. Standaard zijn alleen `PLANNING` en `BEGELEIDINGEN` actief in `defaultAppModules`; andere modules zijn configuratieafhankelijk.

### 6.4 Mobiele en tabletweergave

Vastgesteld: `AppShell` heeft desktopnavigatie en mobiele bottom navigation. Niet bevestigd: visuele tablet/browseracceptatie.

## 7. Dashboard

### Status

Geïmplementeerd.

### Doel

Het dashboard combineert persoonlijke taken, aandachtspunten, smart coaching, teamheatmap en actiehistoriek.

### Beschikbaarheid

Via `canAccessDashboard`: `menu.coaching.enabled`, `moduleDashboard` en `menu.coaching.dashboard` zijn vereist.

### Gegevensbereik

Het dashboard gebruikt `getVisibleRepresentatives`, `getVisibleWorkflowState`, reporting dataset en performance dataset binnen de actor-scope.

### Technische implementatie

`components/workspace-pages.tsx` (`Dashboard`), `lib/dashboard-attention.ts`, `components/smart-coaching-dashboard.tsx`, `components/activity-history-card.tsx`, `app/api/activity-history/route.ts`.

### Bekende beperkingen

Niet bevestigd in browser/tablet. Thresholds voor sommige managementsignalen moeten nog definitief worden beslist.

## 8. Mijn informatie

Vastgesteld: route `/mijn-gegevens` toont `MyProfilePage` in `components/workspace-pages.tsx`. De pagina zoekt het profiel in `managedUsers` en toont persoonlijke gegevens uit de sessie-/gebruikerscontext.

Status: Geïmplementeerd, maar niet browsermatig bevestigd.

## 9. Mijn team

### Status

Geïmplementeerd met open businessbeslissingen.

### Doel

Mijn Team toont medewerkers binnen de toegestane scope met fiche-informatie, planning/coachinghistoriek, performance en module-afhankelijke tabs.

### Beschikbaarheid

Vereist actieve module `BEGELEIDINGEN` plus `canAccessMyTeamNavigation`.

### Gegevensbereik

Verkoopleider: eigen team en zichzelf waar relevant. Sales Manager: toegewezen landen. Country Manager: eigen land. Group Manager/Super Admin: globaal.

### Technische implementatie

`components/workspace-pages.tsx` (`MyTeamPage`, `TeamMemberDetail`, `RepresentativeDetail`), `lib/my-team.ts`, `lib/my-team-fiche-visibility.ts`, `lib/data-access.ts`.

### Bekende beperkingen

Scorethresholds en inbegrepen operationele rollen staan nog als businessbeslissing open.

## 10. Planning en agenda

### Status

Geïmplementeerd als gedeelde presentatie.

### Doel

Planning toont geplande businessobjecten, maar bezit hun workflows niet.

### Beschikbaarheid

Module `PLANNING`, `moduleAgenda`, `menu.coaching.planning` en scope zijn vereist.

### Workflow

1. Gebruiker opent `/planning`.
2. `WorkspacePage` controleert moduleactivatie en navigatiepermissies.
3. `PlanningCalendar` haalt zichtbare workflowitems uit `useWorkflow`.
4. Items openen naar hun eigenaarmodule zoals Begeleidingen, Contactmomenten, Retrainingen, Salestrainingen of Hulpaanvragen.

### Technische implementatie

`components/planning-calendar.tsx`, `lib/planning-items.ts`, `scripts/test-planning-items.ts`, `docs/ai/modules/Coaching/Planning.md`.

### Bekende beperkingen

Outlook/Graph-validatie met echte tokens is niet bevestigd.

## 11. Begeleidingen

### 11.1 Doel

Begeleidingen ondersteunen planning, voorbereiding, uitvoering, scoreformulier, actiepunten, reflectie, akkoord door de begeleide persoon en professioneel rapport.

### 11.2 Inplannen

Vastgesteld: nieuwe begeleiding start via `app/begeleidingen/nieuw/page.tsx` en `components/coaching-wizard.tsx`. Actor, owner, representative, planning en notificatieopties worden gevalideerd.

### 11.3 Vooraf verwittigen

Vastgesteld: velden zoals `notifyRepresentative`, `notifyCoachedRepresentative`, `notifyCoachedTeamLeaders` en `notifyExecutorTeamLeaders` bestaan in schema/types.

### 11.4 Voorbereiding

Vastgesteld: wizard gebruikt performance, KPI's, vorige coaching en voorbereidingsexport.

### 11.5 Focusfasen

Vastgesteld: `CoachingFocus`, `CoachingCriterion`, `ConfigurableCriterion`, `CriterionScopeLink` en snapshots ondersteunen criteria en focusfasen.

### 11.6 Uitvoering

Vastgesteld: begeleiding bewaart scores, dossier, afspraken, actiepunten en status via `lib/workflow-engine.ts` en `app/api/workflows/persist-route.ts`.

### 11.7 Afronden

Vastgesteld: `saveCoaching` en servervalidatie vereisen onder meer actiepunten bij afgeronde statussen.

### 11.8 Voor akkoord versturen

Vastgesteld: `app/api/workflows/coaching/[id]/transition/route.ts` ondersteunt `send_for_approval` en maakt approval-notificatie.

### 11.9 Akkoord door vertegenwoordiger

Vastgesteld: representatieve approval verloopt via `approve`, `Approval` en `MyReportsPage`.

### 11.10 Statussen

Vastgesteld: `InterventionStatus` bevat `CONCEPT`, `GEPLAND`, `IN_UITVOERING`, `WACHT_OP_VT_INPUT`, `WACHT_OP_VT`, `WACHT_OP_AKKOORD`, `GEFINALISEERD`, `AFGESLOTEN`, `GESLOTEN`, `VOLTOOID`, `VERZONDEN_TER_AKKOORD`, `AKKOORD_DOOR_VERTEGENWOORDIGER`, `GEANNULEERD`, `NIET_UITGEVOERD`.

| Huidige status | Actie | Nieuwe status | Toegestane rol | Gevolg |
| --- | --- | --- | --- | --- |
| Voltooid/afgesloten varianten | Voor akkoord versturen | `VERZONDEN_TER_AKKOORD` | Manager/owner binnen scope | Approval-notificatie wordt aangemaakt |
| `VERZONDEN_TER_AKKOORD` | Goedkeuren | `AKKOORD_DOOR_VERTEGENWOORDIGER` | Vertegenwoordiger van rapport | Approval wordt afgehandeld |
| Afgeronde/approval-statussen | Bewerken via persist | Geblokkeerd | Server-side | Lifecycle lock |

### 11.11 Actiepunten

Vastgesteld: Begeleidingen kunnen workflowactiepunten bevatten en Professional/Expert kan coaching action review gebruiken.

### 11.12 PDF-export

Vastgesteld: professioneel coachingrapport bestaat in `lib/coaching/export-professional-report.ts`; UI-download staat in `CoachingDetail`.

### 11.13 Rechten en gegevensbereik

Vastgesteld: zichtbaarheid verloopt via `lib/coaching/visibility.ts`; bewerken via `lib/coaching/access.ts`, `app/api/workflows/persist-route.ts` en server scopehelpers.

### 11.14 Notificaties

Vastgesteld: approval-notificaties en peer coaching notification types bestaan in `lib/server/notifications.ts`.

## 12. Prestatiecirkel

Status: Geïmplementeerd.

Vastgesteld: prestatiecirkel en performance-evolutie gebruiken `components/charts/PerformanceWheel.tsx`, `components/performance-evolution.tsx`, `lib/performance-data.ts` en `lib/performance/export-performance-pdf.ts`. KPI-snapshots komen uit `KpiSnapshot`.

Bekende beperking: businessdefinitie en acceptatie van thresholds/formules zijn niet volledig bevestigd.

## 13. Scoretabellen en evaluatiecriteria

Status: Geïmplementeerd met configureerbare uitbreidingen.

Vastgesteld: scoretabellen gebruiken `Score`, `CoachingCriterion`, `ConfigurableCriterion`, `CriterionScopeLink`, `PersonalCoachingCriterion` en `CoachingCriterionSnapshot`. Beheer ondersteunt focus/criteria/scopekoppelingen.

Bekende beperking: scope-import/export en lege-state bij ontbrekende criteria vereisen verdere afwerking.

## 14. KPI's

Status: Deels geïmplementeerd tot breed geïmplementeerd, met open acceptatiepunten.

Vastgesteld: KPI's bestaan als definities, categorieën, types, doeltypes, targets, overrides en snapshots. Beheer-UI ondersteunt scoped KPI's en doelwaarden. Rapportage en performance gebruiken KPI-data.

Technische bronnen: `prisma/schema.prisma`, `lib/server/management.ts`, `components/configuration-management.tsx`, `lib/kpi-settings.ts`.

Bekende beperkingen: exacte value-entry en code-uniekheid per land/rol/team zijn businesskeuzes.

## 15. Contactmomenten

### Status

Deels geïmplementeerd; workflow is documentair `DEFINED`, maar externe validatie en PDF ontbreken.

### Doel

Kort contactmoment tussen manager en vertegenwoordiger, met planning, eventueel vooraf verwittigen, verslag, besproken thema's, actiepunten, foto's en afsluitstatus.

### Beschikbaarheid

Via module `CONTACTMOMENTEN`, `modulePreparation`, `menu.coaching.contacts`, plus scopecontrole.

### Workflow

1. Bevoegde gebruiker opent `/contactmomenten`.
2. UI toont zichtbare contactmomenten via `visibleContactMoments`.
3. Bij nieuw contact kiest de gebruiker vertegenwoordiger, datum, start/eindtijd, onderwerp/type/locatie en notificatie vooraf.
4. Server controleert actor, workflowpermissie en vertegenwoordigersscope.
5. Contact wordt als `Intervention` met `ContactMomentDetail` opgeslagen.
6. Bij uitvoering kan verslag worden ingevuld.
7. Afsluiten en delen zet het contact in finale status en lockt verdere bewerking.
8. Foto's kunnen via private API worden toegevoegd en verwijderd zolang contact mutable is.

### Statussen en overgangen

| Huidige status | Actie | Nieuwe status | Gevolg |
| --- | --- | --- | --- |
| `gepland` | Start | `in_uitvoering` | Verslag kan worden ingevuld |
| `in_uitvoering` | Finaliseren en delen | `afgesloten` | Lock en zichtbaarheid voor vertegenwoordiger |
| Mutable status | Annuleren | `geannuleerd` | Reden verplicht |
| Mutable status | Niet uitgevoerd | `niet_uitgevoerd` | Reden verplicht |

### Technische implementatie

`components/contact-help-workflows.tsx`, `lib/workflow-engine.ts`, `app/api/workflows/contact-moments/route.ts`, `lib/server/contact-moment-photos.ts`, `prisma/migrations/0026_*`, `0029_*`.

### Bekende beperkingen

Echte Graph-sync, backup/retentie van uploads en PDF-export zijn niet bevestigd.

## 16. Retrainingen

Status: Deels geïmplementeerd, officieel `UNDEFINED`.

Vastgesteld: route `/retrainingen`, `TrainingWorkflowPage kind="retraining"`, `Retraining` type, `TrainingDetail`, API-route en workflow-engine bestaan.

Niet bevestigd: officieel doel, rollen, statuscontract, planning/dashboard/rapportagecontract en actiepuntregels.

## 17. Salestrainingen

Status: Deels geïmplementeerd, officieel `UNDEFINED`.

Vastgesteld: route `/sales-trainingen`, `TrainingWorkflowPage kind="sales_training"`, participantselectie, groeps-/individuele acties, API-route en reporting-opname bestaan.

Niet bevestigd: businesscontract voor deelnemers, sessies, actiepuntcreatie en afsluiting.

## 18. Hulpaanvragen

### Status

Deels geïmplementeerd; workflowdocument is `DEFINED`.

### Doel

Een vertegenwoordiger kan hulp vragen; managers behandelen de vraag en kiezen een antwoord, sluiting of vervolgactie.

### Workflow

1. Vertegenwoordiger opent `/hulpaanvragen/nieuw`.
2. UI maakt een vraag met onderwerp, rich text beschrijving, difficulty, desired result en urgency.
3. Server bewaart `HelpRequest` en bepaalt scope.
4. Manager binnen scope opent detail.
5. Manager kan antwoorden, afsluiten of vervolgactie kiezen.
6. Vertegenwoordiger mag een onbehandelde vraag wijzigen of intrekken.
7. Finale statussen blokkeren verdere normale behandeling.

### Statussen

`nieuw`, `open`, `in_behandeling`, `vervolgactie_gepland`, `begeleiding`, `contactmoment`, `retraining`, `salestraining`, `gesloten`, `ingetrokken`, `afgesloten`, `geannuleerd`.

### Technische implementatie

`components/contact-help-workflows.tsx`, `lib/workflow-engine.ts`, `app/api/workflows/help-requests/route.ts`, `app/api/workflows/persist-route.ts`, `HelpRequest`, `HelpRequestAnswer`.

### Bekende beperkingen

Vervolgacties naar undefined modules moeten functioneel begrensd of gedefinieerd worden.

## 19. Actiepunten

Status: Deels geïmplementeerd.

Vastgesteld: er zijn actiepuntdefinities met scope `GLOBAL`, `COUNTRY`, `TEAM`, `USER`, productkoppelingen en target overrides. Workflowactiepunten bestaan voor begeleiding, contactmomenten, retrainingen en salestrainingen.

Beschikbaarheid: route `/actiepunten` vereist `modulePreparation` en `menu.coaching.actionPoints`. Representative krijgt ook routes `/mijn-reflecties` en `/mijn-verslagen` onder module `ACTIEPUNTEN`.

Bekende beperkingen: operationele lifecycle rond sluiten, heropenen, goedkeuring en reassignment is nog niet volledig beslist.

## 20. Rapportering

Status: Deels geïmplementeerd, officieel `UNDEFINED`.

Vastgesteld: `/rapportering` toont `ReportingDashboard` met overzicht, filters, team/leader/action/help/performance-inzichten via `lib/reporting.ts`.

Niet bevestigd: officiële formules, periodes, exportformaten en vaste verwachte cijfers.

## 21. Gebruikersbeheer

Status: Geïmplementeerd.

Vastgesteld: `/beheer/gebruikers` gebruikt `UsersManagementPage`. API's ondersteunen list/create/update/delete/deactivate-achtige acties, roltoewijzing, user overrides, Microsoft-status en login-sessies.

Technische bronnen: `components/user-management.tsx`, `app/api/users/route.ts`, `app/api/users/[id]/route.ts`, `lib/server/users.ts`, `lib/user-management.ts`.

## 22. Rollenbeheer

Status: Geïmplementeerd met open definities voor enkele rollen.

Vastgesteld: `/beheer/rollen` toont rollen en permissietoggles. Alleen Super Admin kan rollen activeren/deactiveren en role permission saves doen.

Bekende beperkingen: Group Manager en Service Operator zijn documentair `PARTIALLY_DEFINED`.

## 23. Landen- en teamsbeheer

Status: Geïmplementeerd voor teams en landen-scope; geen aparte landenbeheer-CRUD gevonden.

Vastgesteld: teams worden beheerd via `/beheer/teams`; landen zijn enumwaarden. Teams hebben actief/inactief en optionele primaire leider.

Technische bronnen: `components/configuration-management.tsx`, `lib/server/management.ts`, `Team`, `TeamLeader`.

## 24. Configuratiebeheer

Status: Geïmplementeerd.

Vastgesteld: beheer bevat gebruikers, teams, rollen, KPI's, kapstok, modules, instellingen en log. Configuratie wordt geladen via `/api/management`, `/api/configuration`, `/api/modules` en specifieke routes.

## 25. Producten en productkoppelingen

Status: Deels geïmplementeerd.

Vastgesteld: `Product`, `ProductAnalysis` en `ActionDefinitionProduct` bestaan; actiepuntdefinities kunnen producten koppelen. Productanalyses zitten in seed/data en reportingcontext.

Niet bevestigd: volwaardige productbeheer-UI buiten actiepunt/KPI-context.

## 26. Notificaties en todo's

Status: Geïmplementeerd met open triggercoverage.

Vastgesteld: header ToDo bell en notification provider bestaan. In-app notifications worden uit `Approval` en `NotificationDelivery` opgebouwd. Mailtemplates bestaan voor coaching approval, help requests, contactmomenten en peer coaching.

Technische bronnen: `components/notification-provider.tsx`, `lib/notifications.ts`, `lib/server/notifications.ts`, `lib/server/mail-templates.ts`.

Bekende beperking: triggercoverage en externe mailvalidatie zijn niet volledig bevestigd.

## 27. Foto's, documenten en bijlagen

Status: Deels geïmplementeerd.

Vastgesteld: Contactmomentfoto's zijn aanwezig via private API en bestandsopslag. Metadata staat in `photosJson`.

Niet aangetroffen: algemene documentbijlage-module.

## 28. PDF- en andere exports

Status: Deels geïmplementeerd.

Vastgesteld:

- Voorbereidings-PDF in `components/coaching-wizard.tsx`.
- Professioneel coachingrapport in `lib/coaching/export-professional-report.ts`.
- Performance PDF in `lib/performance/export-performance-pdf.ts`.
- CSV import/export voor beheer in `lib/server/management-import-export.ts`.

Niet bevestigd: Contactmoment PDF en rapportage-exportcontract.

## 29. Internationalisatie

Status: Deels geïmplementeerd.

Vastgesteld: `locales/nl.json`, `locales/fr.json`, `locales/de.json` en `lib/i18n.ts` bestaan. Contactmomenten/Hulpaanvragen, notificaties, import/export en mailinstellingen gebruiken veel vertalingen.

Bekende beperking: grote oudere componenten bevatten nog hardcoded Nederlandse user-facing tekst.

## 30. PWA, offlinewerking en synchronisatie

Status: Deels geïmplementeerd.

Vastgesteld: `public/manifest.webmanifest`, `public/sw.js` en `components/service-worker-registration.tsx` bestaan. Service worker cachet app shell en valt offline terug op `/dashboard`.

Niet geïmplementeerd bevestigd: IndexedDB, background sync, mutatiequeue, conflictresolutie en encrypted local business data.

## 31. Databank en gegevensmodel

Status: Breed geïmplementeerd.

Vastgesteld: Prisma/MySQL/MariaDB schema bevat onder meer:

- Users, teams, team leaders, login aliases, login sessions, Microsoft tokens.
- Permissions, role permissions, role configurations, user permission overrides.
- KPI definitions, categories, types, target types, targets, overrides, snapshots.
- Interventions, coaching details, contactmoment details, training details.
- Scores, criteria, configurable criteria, criterion scope links, snapshots.
- Action points, action definitions, products, target overrides, coaching actions.
- Help requests, help request answers, reflections, approvals.
- Notifications, audit logs, app settings, modules, holidays.

Migraties: `0001_init_mysql_schema` tot `0029_contact_moment_private_photos`.

Seeds: `prisma/seed.ts` heeft veilige configseed en destructieve dev-demo seed met guard.

## 32. API's en externe integraties

Status: Breed geïmplementeerd, externe werking deels niet bevestigd.

Vastgesteld: API-routes bestaan voor auth, users, management, modules, workflows, notifications, Outlook events, performance, representatives, configuration, action definitions en personal criteria.

Microsoft Graph: `lib/server/microsoft-graph.ts` ondersteunt Outlook calendar events en gebruikt server-side Microsoft tokens.

SMTP: `lib/server/mail-service.ts` gebruikt Nodemailer en runtime mailsettings.

Niet bevestigd: echte tenant/Graph/SMTP gedrag in staging/productie.

## 33. Beveiliging en privacy

Vastgesteld:

- Authenticated serverhelpers worden in veel API's gebruikt.
- Clientmenu is niet de enige beveiliging; serverroutes hebben rol-, permission- en scopechecks.
- Microsoft tokens worden server-side encrypted opgeslagen.
- Mailsettings redacteren gevoelige velden.
- Foto's worden via private API geserveerd met scopechecks.

Niet bevestigd:

- Productieconfiguratie en real-world penetration/security review.
- Backup/retentiebeleid voor foto-opslag.

## 34. Logging, audittrail en foutafhandeling

Vastgesteld: `AuditLog`, `writeAuditLog`, `CoachingChangeLog`, activity history, mail delivery logging en login session logging bestaan. API's gebruiken `handleApi`/`ApiRequestError` patronen.

Bekende beperking: niet elke functionele wijziging is aantoonbaar auditgedekt; dit moet per module worden bevestigd.

## 35. Technisch beheer en deployment

Status: Gedocumenteerd en deels geïmplementeerd.

Vastgesteld: `server.mjs` valideert productievariabelen, `scripts/validate-environment.ts` checkt env, `docs/technical/vps-deployment.md` beschrijft Plesk, `package.json` heeft `deploy:prepare`.

Niet uitgevoerd: deploy, build, migrate deploy, seed config.

## 36. Tests en kwaliteitsbewaking

Vastgesteld: `package.json` bevat veel gerichte scripts voor workflow, dashboard, notifications, planning, smart coaching, performance, PDF, modules, data-access, My Team, actiepunten, coaching visibility, contactmomenten, hulpaanvragen, mail, Outlook, criteria, roles, menu rights, import/export, auth, login history, KPI, API persistence en database verification.

Uitgevoerd tijdens deze audit:

- `npm run typecheck`: geslaagd.
- `npm run lint`: geslaagd.
- `npm run test:modules`: geslaagd.
- `npm run test:menu-rights`: geslaagd.
- `npm run test:contact-help-i18n`: geslaagd.

Niet aangetroffen: CI-configuratie.

## 37. Bekende beperkingen

- Geen runtime/browseracceptatie tijdens deze audit.
- Geen echte Graph-, SMTP-, Entra- of productievalidatie.
- Geen buildcheck vanwege bekende Prisma generate/build-context en auditfocus.
- Undefined modules zijn technisch aanwezig maar businessmatig niet vrijgegeven.
- Documentatiepaden en lege businessdocs vragen opschoning.

## 38. Niet-bereikbare of gedeeltelijke functionaliteit

| Functionaliteit | Status | Bron | Opmerking |
| --- | --- | --- | --- |
| Salesday | Aanwezig als placeholder/menu | `lib/app-switcher.ts`, `WorkspacePage` | Geen volwaardige module bevestigd |
| PST | Aanwezig als placeholder/menu | `lib/app-switcher.ts`, `WorkspacePage` | Geen volwaardige module bevestigd |
| Contract | Aanwezig als placeholder/menu | `lib/app-switcher.ts`, `WorkspacePage` | Geen volwaardige module bevestigd |
| Service | Aanwezig als placeholder/menu | `lib/app-switcher.ts`, `WorkspacePage` | Service Operator bestaat; module niet volledig bevestigd |
| Retrainingen | Deels geïmplementeerd | `TrainingWorkflowPage` | Workflowdocument `UNDEFINED` |
| Salestrainingen | Deels geïmplementeerd | `TrainingWorkflowPage` | Workflowdocument `UNDEFINED` |
| Rapportage | Deels geïmplementeerd | `ReportingDashboard` | Definitie/formules niet bevestigd |
| Offline sync | Deels geïmplementeerd | `public/sw.js`, `lib/storage.ts` | Geen mutatiequeue |

## 39. Terminologielijst

- Begeleiding: coachinginterventie met planning, uitvoering, verslag en akkoord.
- Vertegenwoordiger: field user/representative, meestal doelpersoon van coaching.
- Verkoopleider: manager met teamscope.
- Focusfase: coaching focusgroep met criteria.
- Prestatiecirkel: visualisatie van score/performancecriteria.
- KPI: prestatie-indicator met target en snapshot.
- Actiepunt: opvolgactie, als definitie of workflowactie.
- Hulpaanvraag: vraag van vertegenwoordiger om ondersteuning.
- Contactmoment: kort contact/gesprek met verslag en eventueel foto's.
- Retraining: technisch aanwezige training voor bijsturing, businessworkflow nog undefined.
- Salestraining: technisch aanwezige groeps-/salestraining, businessworkflow nog undefined.
- Vooraf verwittigen: notificatie/zichtbaarheid vóór het moment.
- Voor akkoord: status waarin begeleide persoon rapport moet bevestigen.
- Gegevensscope: toegestane users/teams/landen op basis van rol en overrides.
- Globale configuratie: instelling of actiepunt/KPI zonder land/team/user beperking.
- Landconfiguratie: configuratie beperkt tot land.
- Teamconfiguratie: configuratie beperkt tot team.
- Gebruikersconfiguratie: configuratie beperkt tot specifieke gebruiker.

## 40. Bronnen en relevante bestanden

### Centrale instructie en documentatie

- `AGENTS.md`
- `docs/ai/INDEX.md`
- `docs/ai/00_PROJECT.md`
- `docs/ai/01_ARCHITECTURE.md`
- `docs/ai/02_DATABASE.md`
- `docs/ai/03_ROLES.md`
- `docs/ai/04_UI_GUIDELINES.md`
- `docs/ai/05_DEVELOPMENT_STANDARDS.md`
- `docs/ai/06_DEPLOYMENT.md`
- `docs/ai/07_KNOWN_ISSUES.md`
- `docs/ai/modules/Coaching/*.md`
- `docs/technical/*.md`

### Implementatie

- `app/[...slug]/page.tsx`
- `components/app-shell.tsx`
- `components/workspace-pages.tsx`
- `components/coaching-wizard.tsx`
- `components/contact-help-workflows.tsx`
- `components/training-workflows.tsx`
- `components/reporting-dashboard.tsx`
- `components/configuration-management.tsx`
- `components/user-management.tsx`
- `components/workflow-provider.tsx`
- `lib/types.ts`
- `lib/permissions.ts`
- `lib/user-management.ts`
- `lib/navigation-access.ts`
- `lib/management-access.ts`
- `lib/data-access.ts`
- `lib/workflow-engine.ts`
- `lib/server/authenticated-user.ts`
- `lib/server/workflows.ts`
- `lib/server/management.ts`
- `lib/server/notifications.ts`
- `lib/server/mail-service.ts`
- `lib/server/microsoft-graph.ts`
- `prisma/schema.prisma`
- `prisma/migrations/`
- `prisma/seed.ts`
- `package.json`
- `locales/nl.json`
- `locales/fr.json`
- `locales/de.json`

## Documentatie versus implementatie

| Onderwerp | Documentatie zegt | Implementatie doet | Beoordeling | Actie |
| --- | --- | --- | --- | --- |
| Retrainingen | `UNDEFINED` | Route, UI, API en model bestaan | Implementatie onvolledig | Zie `TODO.md` FF-P2-001 |
| Salestrainingen | `UNDEFINED` | Route, UI, API en groepsacties bestaan | Implementatie onvolledig | Zie `TODO.md` FF-P2-002 |
| Rapportage | `UNDEFINED` | Dashboard en datasetbouw bestaan | Implementatie onvolledig | Zie `TODO.md` FF-P2-003 |
| Contactmomentfoto's | Oude TODO noemt ontwerp/implementatie | Private foto-API bestaat | Documentatie verouderd | Zie `TODO.md` FF-P1-005 |
| README paden | Oude `docs/*.md` paden | Actuele technische docs onder `docs/technical/` | Documentatie verouderd | Zie `TODO.md` FF-P2-014 |
| Offline | PWA/offline basis | Alleen shell-cache en beperkte storage helpers | Deels geïmplementeerd | Zie `TODO.md` FF-P2-008 |

## Rollenmatrix

| Functionaliteit | Vertegenwoordiger | Verkoopleider | Country Manager | Sales Manager | Group Manager | Admin | Super Admin |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Dashboard | Eigen gegevens | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Mijn gegevens | Eigen gegevens | Eigen gegevens | Eigen gegevens | Eigen gegevens | Eigen gegevens | Eigen gegevens | Eigen gegevens |
| Mijn Team | Geen toegang | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Planning | Eigen/zichtbare items | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Begeleidingen bekijken | Eigen/coached zichtbaar | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Begeleidingen aanmaken | Geen toegang bevestigd | Eigen team/scope | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Rapport akkoord geven | Eigen rapport | Geen toegang | Geen toegang | Geen toegang | Geen toegang | Geen toegang | Alleen indien target |
| Hulpaanvraag maken | Eigen aanvraag | Geen toegang bevestigd | Geen toegang bevestigd | Geen toegang bevestigd | Geen toegang bevestigd | Geen toegang bevestigd | Niet bevestigd |
| Hulpaanvraag behandelen | Geen toegang | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Contactmomenten | Eigen zichtbaarheid volgens status | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Retrainingen | Eigen zichtbaarheid | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Salestrainingen | Deelnemer/eigen scope | Eigen team | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Actiepunten | Eigen actiepunten | Eigen team/scope | Eigen land | Toegewezen landen | Globaal | Configuratieafhankelijk | Volledig |
| Rapportering | Eigen rapportering | Teamrapportering | Team/land | Toegewezen landen | Alle rapportering | Configuratieafhankelijk | Volledig |
| Gebruikersbeheer | Geen toegang | Alleen lezen binnen scope | Alleen lezen binnen scope | Alleen lezen binnen scope | Alleen lezen/globaal | Beheer binnen rechten | Volledig |
| Rollenbeheer | Geen toegang | Geen toegang | Geen toegang | Geen toegang | Geen toegang | Alleen lezen/configuratieafhankelijk | Volledig |
| Modules/technisch beheer | Geen toegang | Geen toegang | Geen toegang | Geen toegang | Geen toegang | Configuratieafhankelijk | Volledig |

