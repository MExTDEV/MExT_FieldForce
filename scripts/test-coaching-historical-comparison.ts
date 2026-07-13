import assert from "node:assert/strict";

import {
  buildHistoricalComparisonOptions,
  buildHistoricalScoreLookup,
  compareScoreRows,
  historicalScoreKey,
  type HistoricalComparisonCandidate,
} from "../lib/coaching/historical-comparison";

const candidates: HistoricalComparisonCandidate[] = [
  scored("previous-old", "rep-a", "2026-05-22", "VOLTOOID", [{ key: historicalScoreKey("Dossier:Algemeen", "Open vragen"), score: 3 }]),
  scored("current", "rep-a", "2026-07-10", "VOLTOOID", [{ key: historicalScoreKey("Dossier:Algemeen", "Open vragen"), score: 5 }]),
  scored("cancelled", "rep-a", "2026-07-01", "GEANNULEERD", [{ key: historicalScoreKey("Dossier:Algemeen", "Open vragen"), score: 2 }]),
  scored("future", "rep-a", "2026-08-01", "VOLTOOID", [{ key: historicalScoreKey("Dossier:Algemeen", "Open vragen"), score: 4 }]),
  scored("empty", "rep-a", "2026-06-30", "VOLTOOID", []),
  scored("other-rep", "rep-b", "2026-06-29", "VOLTOOID", [{ key: historicalScoreKey("Dossier:Algemeen", "Open vragen"), score: 1 }]),
  scored("previous-new", "rep-a", "2026-06-18", "AKKOORD_DOOR_VERTEGENWOORDIGER", [
    { key: historicalScoreKey("Dossier:Algemeen", "Open vragen"), score: 4 },
    { key: historicalScoreKey("Dossier:Persoonlijkheid", "Zelfzekerheid"), score: 5 },
  ]),
];

const options = buildHistoricalComparisonOptions({
  currentId: "current",
  representativeId: "rep-a",
  currentDate: "2026-07-10",
  candidates,
});

assert.deepEqual(
  options.map((item) => item.id),
  ["previous-new", "previous-old"],
  "Alleen eerdere, niet-geannuleerde begeleidingen met scoredata van dezelfde vertegenwoordiger mogen in de dropdown staan."
);

const lookup = buildHistoricalScoreLookup(candidates.find((item) => item.id === "previous-new")!.scores);
const rows = compareScoreRows([
  { key: historicalScoreKey("Dossier:Algemeen", "Open vragen"), label: "Open vragen", score: 5 },
  { key: historicalScoreKey("Dossier:Algemeen", "Upselling"), label: "Upselling", score: 4 },
  { key: historicalScoreKey("Dossier:Persoonlijkheid", "Zelfzekerheid"), label: "Zelfzekerheid", score: "nvt" },
], lookup);

assert.deepEqual(
  rows.map((row) => ({ label: row.label, previous: row.previousScore, difference: row.difference, status: row.status })),
  [
    { label: "Open vragen", previous: 4, difference: 1, status: "better" },
    { label: "Upselling", previous: undefined, difference: undefined, status: "new" },
    { label: "Zelfzekerheid", previous: 5, difference: undefined, status: "not_scored" },
  ],
  "Nieuwe en niet-gescoorde criteria moeten veilig vergelijkbaar blijven zonder historische invoer te wijzigen."
);

console.log("Historische scorevergelijking: selectie en scorematching zijn correct.");

function scored(
  id: string,
  representativeId: string,
  date: string,
  status: HistoricalComparisonCandidate["status"],
  scores: HistoricalComparisonCandidate["scores"]
): HistoricalComparisonCandidate {
  return {
    id,
    representativeId,
    date,
    ownerName: "Coach Test",
    status,
    scores,
  };
}
