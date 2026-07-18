# MExT FieldForce complete handleiding

Deze map bevat de bronassets voor de gecombineerde gebruikershandleiding, het procesboek en het technisch framework van Coaching, SalesDay en Contract.

## Eindbestanden

- `output/docx/MExT_FieldForce_Complete_Handleiding.docx`
- `output/pdf/MExT_FieldForce_Complete_Handleiding.pdf`

De DOCX bevat een dynamische Word-inhoudsopgave en de instelling om velden bij openen bij te werken. De PDF wordt rechtstreeks uit dezelfde hoofdstukfuncties opgebouwd en bevat een klikbare inhoudsopgave en PDF-bladwijzers.

## Opnieuw genereren

Voer vanuit de repositoryroot uit:

```powershell
python scripts/build-fieldforce-complete-manual.py
python scripts/build-fieldforce-complete-manual-pdf.py
python scripts/qa-fieldforce-complete-manual.py
```

De drie scripts gebruiken alleen lokale broncode, documentatie en afbeeldingen. Zij wijzigen geen database, featureflag, ontwikkelserver of productieomgeving.

## Inhoudsbronnen

De handleiding volgt de actuele bronnen van waarheid in deze volgorde:

1. `AGENTS.md` en `docs/ai/INDEX.md`;
2. de eigenaar-documenten onder `docs/ai` en `docs/ai/modules`;
3. `prisma/schema.prisma`;
4. relevante route-, service- en workspacecode;
5. de lokaal vastgelegde screenshots in `docs/manuals/assets`.

Wijzig zakelijk gedrag eerst in het eigenaar-document, de code en de tests. Genereer daarna beide handleidingformaten opnieuw.

## Screenshots en vertrouwelijkheid

De opgenomen screenshots tonen de lokale testomgeving van 17 juli 2026. Coaching bevat testgegevens, maar zichtbare gebruikersnamen kunnen echte gebruikers voorstellen. Behandel de handleiding daarom als intern document.

Een scherm waarop een module niet actief is, is bewust zo gelabeld. Voor de handleiding zijn geen moduleactivaties of databasewijzigingen uitgevoerd.

## Kwaliteitscontrole

`qa-fieldforce-complete-manual.py` controleert onder meer:

- integriteit van het DOCX-containerbestand;
- aanwezigheid van koppen, tabellen, afbeeldingen en alt-teksten;
- aanwezigheid van het Word-TOC-veld en automatische veldupdate;
- PDF-metadata, tekstextractie, paginatelling en bladwijzers;
- lege pagina's, mogelijke randafsnijding en tekencodering;
- visuele contactbladen van alle PDF-pagina's onder `tmp/manual-qa`.

De map `tmp/manual-qa` is controle-output en geen publicatie-artefact.

## Bekende verificatiegrens

Op de huidige ontwikkelmachine is Microsoft Word aanwezig maar LibreOffice niet. De DOCX wordt daarom structureel gecontroleerd, terwijl de PDF volledig wordt gerenderd en visueel geïnspecteerd. Word werkt de dynamische inhoudsopgave bij bij het openen van de DOCX.
