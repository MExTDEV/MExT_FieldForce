# Transactionele e-mail: inventarisatie en technisch ontwerp

Datum inventarisatie: 2026-08-13

Dit document is de inventarisatie- en ontwerpfase voor het centrale,
meertalige e-mailsysteem. Er is in deze fase geen functionele e-mailcode
gewijzigd. De werkelijke code en de actuele technische documentatie zijn de
bron voor de inventarisatie.

## 1. Bestaande infrastructuur

FieldForce heeft al een gedeeltelijke centrale verzendbasis:

- `lib/server/mail-service.ts` maakt de Nodemailer SMTP-transportlaag aan.
- `sendWorkflowEventMail()` haalt de ontvangerstaal op uit `User.language`,
  maakt een codegedreven template via `buildWorkflowMailTemplate()` en stuurt
  via dezelfde centrale service.
- `lib/server/mail-test.ts` routeert `To`, `CC`, `BCC` en de SMTP-envelope
  centraal naar `MAIL_TEST_RECIPIENT` wanneer MAIL TEST actief is.
- `NotificationDelivery` dedupliceert per event, gebruiker en kanaal en legt
  de verzendstatus vast.
- `AppSetting` bevat SMTP-, afzender-, Reply-To- en MAIL TEST-instellingen.
- `lib/rich-text.ts` saneert een beperkte HTML-subset. Er is geen aparte
  WYSIWYG-editor- of HTML-sanitizingdependency aanwezig in `package.json`.
- Afbeeldingsuploads bestaan momenteel als private opslag voor gebruikers,
  contactmomenten en SalesDay. Er is geen bestaande publieke mailasset-opslag.
- Microsoft Graph wordt gebruikt voor Outlook-agendasynchronisatie; in de
  onderzochte code is geen Graph-mailverzendpad gevonden.

Er is geen actieve e-mailqueue, cronmail-worker of afzonderlijk retrykanaal
gevonden. E-mails worden best-effort en synchroon na geslaagde workflow-
of notificatiepersisting verstuurd. De bestaande starter-evaluatiejob maakt
wel evaluaties aan, maar verstuurt momenteel geen e-mail.

## 2. Gevonden mailtypes en triggers

De onderstaande mailtypes worden door de huidige code effectief aangeroepen.
De onderwerpregel en basisinhoud komen nu uit de vertaalde notificatiesleutels;
de aanvullende dossier-, actor-, bericht- en linkvelden worden in de service
toegevoegd.

| Technische sleutel | Module en trigger | Ontvanger | Huidige bron / inhoud | Link en bijzonderheden |
| --- | --- | --- | --- | --- |
| `COACHING_PLANNED` | Begeleidingen; geplande begeleiding met voorafgaande melding in `persist-route.ts` | Begeleide gebruiker en optioneel teamleiders van de begeleide gebruiker of uitvoerder | `notifications.coaching.planned.title/body`, plus titel en actor | `/begeleidingen/:id`; één mail per ontvanger |
| `COACHING_APPROVAL_REQUEST` | Begeleidingen; ter akkoord versturen en `remind_approval` | Betrokken begeleide gebruiker, uit `Approval.representativeId` of fallback `Intervention.representativeId` | `notifications.coachingApproval.title/body`; reminder gebruikt hetzelfde type | `/begeleidingen/:id`; Reply-To is nu de opgeslagen e-mail van de uitvoerende gebruiker; reminder heeft audit-cooldown van tien minuten |
| `COACHING_APPROVAL_CONFIRMED` | Begeleidingen; akkoord door de begeleide persoon | Verantwoordelijke coach/leider en indien van toepassing de indiener, met uitsluiting van de ondertekenaar | `notifications.coachingApproval.confirmed.title/body` | `/begeleidingen/:id`; eventkey is gekoppeld aan de approval |
| `COACHING_CANCELLED` | Begeleidingen; annulering van een toekomstige geplande begeleiding | Snapshot van de oorspronkelijke notificatieontvangers | `notifications.coaching.cancelled.title/body` en aanvullende geparametriseerde annuleringsboodschap | `/begeleidingen/:id`; bestaande status- en Outlook-annuleringsaudit blijft leidend |
| `HELP_REQUEST_CREATED` | Hulpaanvragen; nieuwe aanvraag in `persist-route.ts` | Server-resolved verantwoordelijke manager | `notifications.helpRequest.created.title/body`, aanvraagomschrijving | `/hulpaanvragen/:id`; mailfout draait de aanvraag niet terug |
| `HELP_REQUEST_ANSWERED` | Hulpaanvragen; antwoord zonder definitieve afsluiting | Aanvrager wanneer de manager antwoordt, of verantwoordelijke manager bij de gecontroleerde antwoordstap | `notifications.helpRequest.answered.title/body`, antwoordinhoud | `/hulpaanvragen/:id` |
| `HELP_REQUEST_CLOSED` | Hulpaanvragen; antwoord dat de aanvraag sluit | De andere workflowbetrokkene | `notifications.helpRequest.closed.title/body`, antwoordinhoud | `/hulpaanvragen/:id` |
| `HELP_REQUEST_FOLLOW_UP` | Hulpaanvragen; concrete vervolgactie | Aanvrager of vertegenwoordiger volgens de bestaande route | `notifications.helpRequest.followUp.title/body`, eventueel laatste antwoord | `/hulpaanvragen/:id` |
| `CONTACT_MOMENT_PLANNED` | Contactmomenten; nieuw gepland en zichtbaar gemeld | Betrokken vertegenwoordiger | `notifications.contactMoment.planned.title/body` | `/contactmomenten/:id` |
| `CONTACT_MOMENT_UPDATED` | Contactmomenten; wijziging van een reeds bestaand zichtbaar moment | Betrokken vertegenwoordiger | `notifications.contactMoment.updated.title/body` | `/contactmomenten/:id` |
| `CONTACT_MOMENT_SHARED` | Contactmomenten; verslag gedeeld | Betrokken vertegenwoordiger | `notifications.contactMoment.shared.title/body` | `/contactmomenten/:id` |
| `CONTACT_MOMENT_CANCELLED` | Contactmomenten; geannuleerd | Betrokken vertegenwoordiger | `notifications.contactMoment.cancelled.title/body` | `/contactmomenten/:id` |
| `CONTACT_MOMENT_NOT_EXECUTED` | Contactmomenten; gemarkeerd als niet uitgevoerd | Betrokken vertegenwoordiger | `notifications.contactMoment.notExecuted.title/body` | `/contactmomenten/:id` |

De huidige ontvangerbepaling is per gebruiker en de template wordt per
ontvanger opgebouwd. De uitvoerende gebruiker bepaalt de taal niet. De code
gebruikt de taal van de ontvanger, maar gebruikt land momenteel niet voor
footer, afzendernaam of Reply-To.

## 3. Gedefinieerde sleutels zonder gevonden e-mailverzending

`lib/server/mail-templates.ts` bevat ook mappings voor:

- `PEER_COACHING_ASSIGNED`;
- `PEER_COACHING_LATE`;
- `PEER_COACHING_ACTION_REVIEW`;
- `PEER_COACHING_FINAL_APPROVED`;
- `PEER_COACHING_FINAL_REJECTED`.

In de onderzochte aanroeppaden is voor deze sleutels geen e-mailverzending
gevonden. Ze zijn daarom nog geen te migreren e-mailstromen; het zijn nu
notificatie-/templatecontracten zonder aangetoonde mailtrigger.

Voor de volgende gebieden is geen bestaande e-mailtrigger gevonden:

- Actiepunten;
- Retrainingen;
- Salestrainingen;
- Tussentijdse evaluaties;
- SalesDay, Contract, Service en overige toekomstige modules.

Retrainingen en Salestrainingen zijn bovendien als `UNDEFINED` gedocumenteerd.
Daarvoor wordt geen nieuwe notificatie- of e-mailbusinesslogica uitgevonden.
Tussentijdse evaluaties noemen e-mailflows expliciet als openstaand item.

## 4. Provider-, test- en foutgedrag

Alle gevonden e-mailverzending loopt via `lib/server/mail-service.ts` en SMTP.
De workflow-aanroepen geven nu type, gebruiker, actor, titel, link en
`MailRoutingContext` door. De service haalt de ontvanger op, bouwt de mail,
routeert via MAIL TEST en schrijft `NotificationDelivery`.

Wanneer MAIL TEST actief is:

- worden echte `To`, `CC`, `BCC` en envelope-ontvangers vervangen door het
  centrale testadres;
- wordt `Reply-To` verwijderd;
- blokkeert de laatste providercheck een niet-testontvanger;
- wordt in de mail een waarschuwing met oorspronkelijke route en eventcontext
  opgenomen.

Ontbreekt het testadres, dan blokkeert de huidige service de verzending. Er is
geen fallback naar een functionele ontvanger. De bestaande implementatie test
dit voor gewone workflowmails en instellingen-testmails; uitbreiding naar
template-preview, retries en toekomstige workers moet dezelfde centrale
router blijven gebruiken.

De huidige deliverylog slaat `originalTo`, `originalCc` en `originalBcc`
echter als leesbare adressen op. Dat is een privacy-aandachtspunt voor het
nieuwe auditontwerp: verzendlogs moeten standaard maskeren of een beperkte,
afgeschermde representatie gebruiken en nooit gepersonaliseerde HTML of
gevoelige context opslaan.

## 5. Vastgestelde ontwerpconflicten en risico’s

1. `docs/ai/02_DATABASE.md` en `docs/technical/database.md` beschrijven voor
   een ontbrekend MAIL TEST-adres nog een fallback naar
   `helpdesk@mext.be`. `docs/technical/mail-settings.md` en de huidige code
   blokkeren in dat geval. Dit moet vóór de implementatie als één beslissing
   worden rechtgezet. Voor de centrale veiligheidsregel is blokkeren de
   veilige keuze.
2. De huidige mailinstellingen gebruiken de brede managementtoegang
   `menu.coaching.settings`; er bestaan nog geen afzonderlijke rechten voor
   bekijken, concept wijzigen, testen, publiceren, herstellen, landfooter,
   globale instellingen of audit.
3. `buildWorkflowMailTemplate()` is geen beheersjabloon: onderwerp en basis-
   tekst zijn code/i18n, er is geen preheader, uniforme responsive layout,
   echte CTA-knop, afbeelding, tabel of templateparametercontract.
4. `sanitizeRichText()` staat links toe met `http`, `https` en `mailto`, maar
   ondersteunt geen afbeeldingen of tabellen en is geen volledige editor-
   sanitizer. De nieuwe renderer moet de veilige subset uitbreiden zonder de
   vaste layout door beheerders-HTML te laten breken.
5. Private uploads kunnen niet zonder meer als mailafbeelding worden gebruikt.
   `APP_URL` bestaat in de deploymentconfiguratie, maar er is nog geen
   publiek, gedeactiveerbaar en referentiegetraceerd mailassetmodel.
6. De bestaande verzending is synchroon best-effort. Een queue, retrybeleid,
   idempotentie over process-restarts en achtergrond-escalaties zijn nog geen
   bestaand contract. Dat mag niet stilzwijgend worden ingevoerd.
7. De huidige cancel-flow gebruikt per ontvanger dezelfde
   `COACHING_CANCELLED`-eventkey. De toekomstige verzendlog moet dit bestaande
   deduplicatiegedrag behouden of expliciet migreren zonder dubbele mails.

## 6. Voorgesteld generiek datamodel

Herbruik bestaande `User`, `Country`, `Language`, `AppModule`, `Permission`,
`RolePermission`, `UserPermission`, `AppSetting`, `AuditLog` en
`NotificationDelivery`. Voeg voor de mailfunctie, na schemareview, minimaal
de volgende genormaliseerde concepten toe:

- `MailType`: stabiele sleutel, module, functionele naam/omschrijving,
  triggerbeschrijving, actief-status en verwijzing naar de systeemfallback.
- `MailParameterDefinition`: whitelist per mailtype met sleutel, datatype,
  verplichtheid, formattering, omschrijving en voorbeeldwaarde.
- `MailTemplate`: één identiteit per mailtype en scope-niveau (`GLOBAL`,
  `COUNTRY`, `MODULE`, `MODULE_COUNTRY`), met optionele country/module-scope.
- `MailTemplateVersion`: immutable versie met status `DRAFT` of `PUBLISHED`,
  taal, onderwerp, preheader, inhoud, parametergebruik, auteur,
  publicatiedatum, wijzigingsnotitie en bronversie bij herstel.
- `MailCountryProfile`: landgebonden afzendernaam, Reply-To, supportgegevens
  en logo-/assetreferentie, met globale fallback via `AppSetting`.
- `MailFooterVersion`: versieerbare footer per country/language, met dezelfde
  concept/publicatie-regels als templates.
- `MailAsset`: veilige opslagmetadata, MIME/type- en groottelimieten,
  alt-tekst, actieve status en referentietelling of gebruikscontrole.
- `MailAuditLog` of een expliciet typegebonden uitbreiding van `AuditLog` voor
  beheeractie, scope, oude/nieuwe versie en resultaat.

De werkelijke Prisma-modellen moeten nog worden afgestemd op de bestaande
`AppModule`-structuur, auditconventies en MariaDB-indexbeperkingen. Er wordt
geen tweede user-, country-, language- of permissionbron aangemaakt.

## 7. Selectie- en rendercontract

De centrale service wordt de enige publieke workflow-ingang. Aanroepers
leveren alleen mailtype, ontvanger(s), context, actor en toegelaten metadata.
De service voert in deze volgorde uit:

1. resolveer en valideer elke ontvanger afzonderlijk;
2. bepaal ontvangerstaal met `User.language`, met expliciete fallback naar de
   centrale standaardtaal en anders `nl`;
3. bepaal land onafhankelijk van taal via `User.country`;
4. selecteer de eerste gepubliceerde versie in deze volgorde:
   `MODULE_COUNTRY`, `COUNTRY`, `MODULE`, `GLOBAL`, systeemfallback;
5. laad de landfooter en sender/Reply-To met globale fallback;
6. valideer alle parameters tegen het vaste mailtypecontract;
7. formatteer datum en tijd met ontvangerstaal en tijdzone;
8. saneer en render onderwerp, preheader, vaste layout, inhoud, CTA’s,
   afbeeldingen en footer;
9. pas MAIL TEST toe op de finale providerboodschap;
10. verstuur en log zonder volledige gepersonaliseerde body/context.

Een draft overschrijft nooit een gepubliceerde versie. Een lokaal concept kan
worden gepubliceerd of verwijderd zodat de selectie opnieuw erft. Een herstel
maakt altijd een nieuwe versie.

De systeemfallback blijft codegedreven en wordt voor elk gemigreerd mailtype
meegeleverd. Daardoor blijft essentiële verzending mogelijk vóór een database-
template bestaat.

## 8. Beheer, rechten en fasering

De beheerroute kan aansluiten op de bestaande
`/beheer/instellingen/mail`-structuur, maar moet templates, landprofielen,
footers, globale instellingen, testmail, versies en audit als afzonderlijke
server-beveiligde acties behandelen.

Voorgestelde afzonderlijke permission keys:

- `mail.templates.view`;
- `mail.templates.edit`;
- `mail.templates.test`;
- `mail.templates.publish`;
- `mail.templates.restore`;
- `mail.countrySettings.manage`;
- `mail.globalSettings.manage`;
- `mail.audit.view`.

Landgebonden wijzigingen moeten door de bestaande effectieve
`UserCountryAccess` worden begrensd. Globale templates, globale instellingen
en cross-country audit vereisen aparte rechten. De UI mag alleen acties tonen;
elke API controleert recht en landenscope opnieuw.

Implementatievolgorde:

1. besluit over MAIL TEST-documentatie en privacy van deliverylogs;
2. Prisma-modellen, migratie en codegedreven mailtype-/parameterregistratie;
3. centrale resolver, parameterparser, veilige renderer en uniforme layout;
4. server-side beheer-API, rechten en versies;
5. beheerinterface met inheritance-preview, testmail en bevestiging;
6. landprofielen, footers en gecontroleerde mailassets;
7. migratie van de 13 effectief aangeroepen Coaching-mailtypes;
8. regressietests voor selectie, taal, parameters, rechten, rendering en
   MAIL TEST;
9. pas daarna uitbreiding naar toekomstige of nog niet gedefinieerde modules.

De bestaande triggers en ontvangerresolutie blijven tijdens de migratie
functioneel gelijk. Retrainingen, Salestrainingen, Tussentijdse evaluaties en
peer-coachingmails krijgen pas een echte e-mailimplementatie wanneer een
concrete workflowtrigger en ontvangercontract in de eigen domeindocumentatie
bestaan.

## 9. Open ontwerpkeuzes voor volgende fase

De codebase laat de volgende punten niet betrouwbaar als reeds goedgekeurd
afleiden:

- blokkeren zonder testadres versus de oudere gedocumenteerde helpdesk-
  fallback;
- maskeringsniveau en toegangsmodel van oorspronkelijke ontvangers in
  verzendlogs;
- of country/module-templates één gecombineerde template-identiteit of
  afzonderlijke scope-records in de beheer-UI tonen;
- of mailassets publiek via een bestaande infrastructuur beschikbaar mogen
  worden gemaakt, of dat daarvoor eerst een nieuwe beveiligde publicatie-
  route nodig is;
- of retries/queue buiten deze eerste migratie blijven, gezien het bestaande
  synchroon best-effort contract.

De kernimplementatie staat in `lib/server/transactional-mail.ts`,
`lib/server/mail-template-store.ts` en `lib/server/mail-management.ts`; de
databasemigratie staat in `0059_transactional_mail_templates`. Na migratie en
configuratieseed worden de 13 catalogustypes als centrale NL/FR/DE-versies
geregistreerd. Volgende uitbreidingen zijn inheritance-preview, uitgebreider
auditbeheer en een expliciet queue/retrycontract indien verzending niet langer
synchroon best-effort mag blijven.
