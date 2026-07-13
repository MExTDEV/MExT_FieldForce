# Gearchiveerde TODO - 2026-07-12

Deze versie is gearchiveerd voordat `TODO.md` tijdens de repositorybrede FieldForce-audit van 2026-07-12 werd vervangen.

# TODO

Laatste update: 2026-07-12

Dit is de centrale actieve werklijst voor FieldForce. Kijk hier voor de volgende taken.
Afgewerkte zaken staan in `DONE.md`.

## Belangrijk voor elke taak

- Start, stop of herstart de lokale devserver niet; die wordt extern beheerd.
- Geen undefined workflows invullen op aannames.
- Geen rechten hardcoden.
- Geen secrets, database-URL's of back-ups committen.
- Werk documentatie bij wanneer gedrag, database, rechten of workflows wijzigen.

## Hoog

### TODO-001 - Professional/Expert notificaties en reminders

Status: Open / contractafhankelijk

- Professional/Expert lifecycle-events aansluiten op in-app notificaties.
- Reminder-mails aansluiten zodra lifecycle/background jobs definitief zijn.
- Extra persistence-tests toevoegen voor scopecontrole en deduplicatie.

### TODO-002 - Mailproductie valideren

Status: Extern te valideren

- Gecontroleerde testmail uitvoeren op staging/productie met `MAIL TEST` actief.
- Approval-mailtrigger aansluiten zodra het finale approval mailmoment bevestigd is.
- Delivery logs beschikbaar maken voor beheer/auditors zonder mailbody of gevoelige inhoud.

### TODO-003 - Contactmomenten afronden

Status: Gedeeltelijk afgewerkt

- Outlook/Graph-sync voor Contactmomenten extern valideren met echte Microsoft tokens.
- Veilige foto-upload ontwerpen en implementeren.
- Private bestandsdownload en galerij toevoegen.
- PDF-export op basis van definitieve snapshot toevoegen.

### TODO-004 - Hulpaanvragen afronden

Status: Gedeeltelijk afgewerkt

- Vervolgacties naar Contactmoment, Retraining en Salestraining pas koppelen zodra die workflows definitief beschreven zijn.
- Extra tests toevoegen voor geannuleerde wizard zonder synthetische begeleiding, hidden follow-up detaillekken en managers buiten scope.

### TODO-005 - Professional/Expert lifecycle volledig maken

Status: Open / contractuitwerking

- UI en servervalidatie voor starten, niet uitgevoerd, herplannen, uitvoerder vervangen, administratief afsluiten, finale goedkeuring en kopieren.
- Background jobs voor niet gestart, te laat afwerken, automatische goedkeuring, reminders, leader-access reconciliation en 14-dagen toegangsexpiry.
- Actiepuntvoorstellen laten beoordelen en pas na finale goedkeuring activeren.
- Auditor-schermen voor afwijkingsredenen, action-review redenen en mail-delivery logs.

### TODO-006 - Actiepunten-lifecycle beslissen

Status: Businessbeslissing nodig

- Bepalen wie actiepunten mag sluiten.
- Bepalen of sluiting/voltooiing goedkeuring vereist.
- Bepalen of actiepunten heropend of opnieuw toegewezen mogen worden.
- Officiele statussen vastleggen.
- UX-verschil tussen actiepuntdefinitie en concreet workflowactiepunt vastleggen.

### TODO-007 - Retrainingen en Salestrainingen specificeren

Status: Businessbeslissing nodig

- Doel, rollen, rechten, create/open/edit/close, statussen, Planning, Dashboard, Actiepunten en Rapportage per module vastleggen.
- Daarna pas implementeren.

### TODO-008 - Rapportage productklaar maken

Status: Businessbeslissing nodig

- Exacte rapporten, filters, periodes, exportformaten en KPI-definities vastleggen.
- Vaste testdataset met verwachte cijfers maken.
- Permissiontests per rol toevoegen.

## Middel / Hoog

### TODO-009 - Criteria/Kapstok-beheer uitbreiden

Status: Gedeeltelijk afgewerkt

- Bulk-/multiselects voor landen, teams en gebruikers toevoegen.
- Lege-staat begeleiding voorzien wanneer criteria geen scopekoppeling hebben.
- Visuele scopegroepen in het formulier voor alle criteriumtypes.
- Auditdetail per criterium- en scopewijziging.
- Score rows koppelen aan snapshot-id zodra Prisma Client generatie lokaal niet meer geblokkeerd is.
- Scope import/export afronden of expliciet blokkeren tot het bestandscontract vastligt.

### TODO-010 - Outlook/Graph-integratie hard maken

Status: Extern te valideren

- Create/update/cancel/duplicate filtering testen met mocks of staging.
- Contactmoment-sync extern valideren.
- Syncfouten zichtbaar maken voor beheerders.
- Graph-validatie uitvoeren met geldige tokens.

### TODO-011 - Database en Prisma Client afronden

Status: Gedeeltelijk afgewerkt / lokale lock open

- `0019_action_point_management` en `0020_kpi_management` zijn al toegepast op `MExT_FieldForce`.
- `npm run db:seed:config` is uitgevoerd en idempotent gecontroleerd.
- Laatste hercontrole 2026-07-12: `npm run db:generate` faalt nog steeds lokaal op de Windows Prisma query-engine rename-lock.
- Open: `npm run db:generate` opnieuw uitvoeren zodra de Windows Prisma query-engine lock weg is.
- Open: `npm run build` opnieuw uitvoeren nadat `db:generate` slaagt; zolang `db:generate` faalt, zal de prebuild-stap van `npm run build` dezelfde blokkade raken.
- Back-up van 2026-07-12 bewaren buiten Git tot de run formeel aanvaard is.

### TODO-012 - Authenticatie en sessies productie valideren

Status: Extern te valideren

- Entra ID login/logout valideren.
- Session persistence valideren.
- Rolwijziging en user-level overrides valideren.
- Demo/actorId-paden gescheiden houden van productieauthenticatie.

### TODO-013 - Mijn Team thresholds beslissen

Status: Businessbeslissing nodig

- Definitieve scorethreshold tussen slechte en goede score bepalen.
- Bepalen welke operationele rollen in Mijn Team verschijnen.
- Daarna instelling, rode markering en tests implementeren.

### TODO-014 - KPI-beheer verder uitwerken

Status: Gedeeltelijk afgewerkt / businesskeuze nodig

- Businessbeslissing over KPI-value-entry buiten imports.
- Bewuste schema/proceskeuze maken als dezelfde KPI-code per land nodig is.
- Browser/tabletacceptatie uitvoeren voor KPI-beheer.

### TODO-015 - i18n-sweep

Status: Gedeeltelijk afgewerkt

- Nieuwe notificatie-, mail-, status- en foutteksten in NL/FR/DE nalopen.
- UI-smoketest in NL, FR en DE uitvoeren.

### TODO-016 - Browser- en tabletacceptatie

Status: Handmatige validatie nodig

- Kernflows doorlopen via extern beheerde devserver.
- Lange namen, lange opmerkingen en lege staten controleren.
- Planning dag/week/maand visueel controleren.
- Beheer -> Instellingen, Contactmomenten, Hulpaanvragen en Professional/Expert-flows controleren.

## Laag / later

### TODO-017 - Legacyblokken opruimen

Status: Later

- Legacy/voorziene componentblokken fysiek verwijderen zodra bijbehorende workflows definitief zijn uitgefaseerd.

