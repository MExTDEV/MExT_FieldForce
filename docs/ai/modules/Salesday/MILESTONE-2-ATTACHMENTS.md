# SalesDay Milestone 2 — Bijlagen

## Status

Implemented in source; migration `0052_salesday_attachments` is additive and deployment-pending.

Bijlagen voor een afspraak of klant worden als afzonderlijke `SalesAttachment`-records gestaged. De ERP-documentcategorie, bestandsmetadata, SHA-256, uploadtoken, lokale opslagreferentie en ERP-commandocorrelatie blijven bewaard. De oorspronkelijke bytes worden privé opgeslagen onder `FIELD_FORCE_UPLOAD_ROOT` (standaard de lokale uploadopslag) met padvalidatie en een atomische `wx`-write.

Een vertegenwoordiger kan alleen bijlagen toevoegen of lezen voor zijn eigen niet-geannuleerde afspraak van vandaag. Een klantbijlage vereist bovendien expliciet die afspraak; zo kan een directe URL geen vrij klantdossier openen. De record, auditlog en `attachment.submit`-outboxopdracht worden transactioneel aangemaakt. ERP-erkenning kan later de status en externe identiteit invullen; FieldForce verzint geen documentcategorieën.

## Validatie

`npm run test:salesday-attachments` controleert de scope-gate, metadata/hash, private staging, transactionele outbox en additive migratie. De test wijzigt geen database of bestanden.
