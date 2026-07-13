# Contactmomenten

## Status

Partieel geïmplementeerd op 2026-07-10.

Contactmomenten gebruiken het bestaande `Intervention`-workflowmodel met
`type = CONTACTMOMENT`. Er is geen aparte coachingkopie gemaakt en er wordt geen
begeleidingsformulier, scoremodel, prestatiecirkel of akkoordflow gebruikt.

## Geïmplementeerd

- Contactmomenten kunnen worden ingepland met medewerker, datum, beginuur,
  einduur, onderwerp, type, locatie, interne voorbereidende notitie en de keuze
  `Vooraf op de hoogte brengen`.
- De planninggegevens worden opgeslagen op `Intervention`; contactmoment-specifieke
  inhoud staat op `ContactMomentDetail`.
- Vertegenwoordigers zien verborgen contactmomenten niet vóór delen wanneer
  `notifyRepresentative` uit staat.
- Vertegenwoordigers zien aangekondigde contactmomenten wel vóór delen.
- Gedeelde contactmomenten worden zichtbaar voor de betrokken medewerker.
- `afgesloten`, `geannuleerd` en `niet_uitgevoerd` zijn definitieve statussen.
- Definitieve contactmomenten zijn centraal vergrendeld in de workflow-engine en
  server-side API-validatie.
- Delen vereist een niet-leeg rich-text verslag; lege editor-markup zoals
  `<p></p>` telt niet.
- Het rich-text verslag wordt gesanitized via de bestaande `rich-text` helpers.
- Annuleren en niet-uitvoeren vereisen een reden.
- Bij delen wordt een onveranderlijke snapshot opgeslagen met basisgegevens,
  verslag en actiepunten zoals ze op dat moment bestaan.
- Actiepunten vanuit een contactmoment blijven gekoppeld aan het bestaande
  `ActionPoint`-model via `interventionId` en worden automatisch aan de
  betrokken medewerker gekoppeld.
- Planning toont contactmomenten op basis van de geplande datum en uren en blijft
  routeren naar `/contactmomenten/:id`.
- Migratie `0026_contact_moment_execution_contract` breidt het datamodel uit.
- Gerichte regressietest toegevoegd: `npm run test:contact-moments`.
- Generieke in-app notificaties zijn aangesloten voor zichtbare/gedeelde
  contactmomenten zonder verborgen contactmomenten te lekken.
- E-mailnotificaties voor zichtbare/gedeelde contactmomenten lopen via de
  centrale MAIL TEST-mailservice.
- Outlook-sync is technisch aangesloten op de bestaande Graph-service en gebruikt
  dezelfde `Intervention` Outlookvelden; annuleren en niet-uitgevoerd verwijderen
  het bestaande Outlook-event wanneer dat bestaat.
- Gerichte Outlook-payloadtest toegevoegd: `npm run test:outlook-sync`.
- Het module-overzicht heeft filters voor Alle, Vandaag, Toekomstig,
  Conceptverslagen, Gedeeld, Geannuleerd en Niet uitgevoerd. De filters werken
  op de bestaande zichtbare contactmomentenlijst en wijzigen geen rechten- of
  scopefiltering.
- Gerichte filtertest toegevoegd: `npm run test:contact-moment-filters`.

## Statusmapping

- `gepland`: ingepland
- `in_uitvoering`: uitvoering/verslag opmaken
- `afgesloten`: definitief gedeeld en vergrendeld
- `geannuleerd`: definitief geannuleerd
- `niet_uitgevoerd`: definitief niet uitgevoerd

De oudere status `wacht_op_vt_input` blijft technisch aanwezig voor backwards
compatibility met bestaande historische records, maar de nieuwe UI-flow gebruikt
geen VT-input- of KPI-voorbereidingsstap.

## Nog open

- Outlook-synchronisatie voor contactmomenten extern valideren met echte
  Microsoft tokens en staging/productie-agenda.
- Veilige foto-upload en private bestandsdownload toevoegen met bestaande of nog
  te kiezen uploadinfrastructuur. Er is bewust geen onveilige base64- of publieke
  bestandsroute toegevoegd.
- PDF-export op basis van de definitieve snapshot toevoegen in de bestaande
  FieldForce-huisstijl.
- Volledige i18n-vervanging van de bestaande hardcoded teksten in de huidige
  Contactmomenten-pagina.
