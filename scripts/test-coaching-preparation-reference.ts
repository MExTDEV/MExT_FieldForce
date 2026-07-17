import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildPreparationPdfSections,
  buildPreparationReferenceOptions,
  resolvePreparationReferenceId,
  type PreparationReferenceCandidate,
} from "../lib/coaching/preparation-reference";

const candidates: PreparationReferenceCandidate[] = [
  candidate("latest", "rep-a", "2026-07-08", "VOLTOOID", "Coach Recent"),
  candidate("older", "rep-a", "2026-03-12", "AKKOORD_DOOR_VERTEGENWOORDIGER", "Coach Oud"),
  candidate("cancelled", "rep-a", "2026-06-01", "GEANNULEERD", "Coach Test"),
  candidate("planned", "rep-a", "2026-07-01", "GEPLAND", "Coach Test"),
  candidate("incomplete", "rep-a", "2026-06-28", "IN_UITVOERING", "Coach Test"),
  candidate("future", "rep-a", "2026-08-01", "VOLTOOID", "Coach Test"),
  candidate("other-representative", "rep-b", "2026-07-09", "VOLTOOID", "Coach Test"),
  candidate("current", "rep-a", "2026-07-10", "VOLTOOID", "Coach Test"),
];

const options = buildPreparationReferenceOptions({
  representativeId: "rep-a",
  currentId: "current",
  today: "2026-07-16",
  candidates,
});

assert.deepEqual(
  options.map((option) => option.id),
  ["latest", "older"],
  "Alleen afgeronde begeleidingen van dezelfde persoon mogen als voorbereiding dienen."
);
assert.equal(options[0].isLatest, true);
assert.equal(resolvePreparationReferenceId(options), "latest", "De meest recente begeleiding is de standaardselectie.");
assert.equal(resolvePreparationReferenceId(options, "older"), "older", "Een oudere begeleiding kan expliciet worden geselecteerd.");
assert.equal(resolvePreparationReferenceId(options, undefined, "older"), "older", "Een opgeslagen referentie wordt bij heropenen behouden.");
assert.equal(resolvePreparationReferenceId(options, undefined, "missing"), "latest", "Een legacy of verdwenen referentie valt veilig terug op de meest recente begeleiding.");

assert.deepEqual(
  buildPreparationPdfSections({ id: "latest" }, { id: "latest" }),
  [{ kind: "combined", detail: { id: "latest" } }],
  "Dezelfde geselecteerde en meest recente begeleiding mag maar één PDF-hoofdstuk opleveren."
);
assert.deepEqual(
  buildPreparationPdfSections({ id: "older" }, { id: "latest" }).map((section) => section.kind),
  ["selected", "latest"],
  "Een oudere referentie en de actuele laatste begeleiding krijgen elk een PDF-hoofdstuk."
);
assert.deepEqual(buildPreparationPdfSections(undefined, undefined), [], "Ontbrekende historie mag de PDF-export niet blokkeren.");

const root = resolve(import.meta.dirname, "..");
const server = read("lib/server/coaching-preparation.ts");
const persistRoute = read("app/api/workflows/persist-route.ts");
const wizard = read("components/coaching-wizard.tsx");
const schema = read("prisma/schema.prisma");

assert.match(server, /requireCoachingParticipantScope/, "De metadata- en detailroute moet de bestaande personenscope afdwingen.");
assert.match(server, /buildCoachingVisibilityFilter/, "Historische records moeten door de bestaande coachingscope worden gefilterd.");
assert.match(server, /criterionSnapshots/, "Historische snapshotvolgorde moet de scoretabellen sturen.");
assert.match(persistRoute, /requireValidPreparationReferences/, "Opslag moet de gekozen referentie opnieuw server-side valideren.");
assert.match(persistRoute, /rowRepresentativeIds\.includes\(item\.representativeId\)/, "Een referentie van een andere vertegenwoordiger moet worden geweigerd.");
assert.match(wizard, /loadLocalDraft<Draft>/, "Een browserrefresh moet de lokale wizardselectie kunnen herstellen.");
assert.match(wizard, /while \(offset < totalLines\)/, "Lange PDF-opmerkingen moeten over pagina's kunnen worden verdeeld.");
assert.match(schema, /preparationReferenceCoachingId String\?/, "De geplande begeleiding moet een persistente referentierelatie hebben.");

console.log("Voorbereidingsreferentie: selectie, fallback, beveiliging en PDF-deduplicatie zijn correct.");

function candidate(
  id: string,
  representativeId: string,
  date: string,
  status: string,
  ownerName: string
): PreparationReferenceCandidate {
  return { id, representativeId, date, status, ownerName };
}

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}
