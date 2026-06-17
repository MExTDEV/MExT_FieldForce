import assert from "node:assert/strict";
import { representatives } from "../lib/mock-data";
import {
  coachingsForRepresentative,
  historicalActionPoints,
  historicalContactMoments,
  monthlyKpiSnapshots,
  performanceTrend,
} from "../lib/performance-data";
import {
  getPerformanceWheelData,
  getPreviousComparableIntervention,
} from "../lib/performance/performance-wheel";

for (const representative of representatives) {
  const coachings = coachingsForRepresentative(representative.id);
  const actions = historicalActionPoints.filter((item) => item.representativeId === representative.id);
  const snapshots = monthlyKpiSnapshots.filter((item) => item.representativeId === representative.id);

  assert.ok(coachings.length >= 6, `${representative.id} heeft onvoldoende begeleidingen`);
  assert.ok(coachings.every((item) => item.phaseScores.length === 5));
  assert.ok(coachings.every((item) => item.generalScores.length === 8));
  assert.ok(coachings.every((item) => item.criterionScores.length > 0));
  assert.ok(actions.length >= 3 && actions.length <= 8, `${representative.id} heeft ${actions.length} actiepunten`);
  assert.equal(snapshots.length, 12);

  if (["Professional", "Expert"].includes(representative.level)) {
    assert.ok(
      historicalContactMoments.filter((item) => item.representativeId === representative.id).length >= 2,
      `${representative.id} heeft onvoldoende contactmomenten`
    );
  }
}

const trends = new Set(representatives.map((item) => performanceTrend(item.id)));
assert.ok(trends.has(1), "Seeddata moet stijgende prestaties bevatten");
assert.ok(trends.has(0), "Seeddata moet stabiele prestaties bevatten");
assert.ok(trends.has(-1), "Seeddata moet dalende prestaties bevatten");

const jonasCoachings = coachingsForRepresentative("rep-1");
const jonasPrevious = jonasCoachings.at(-2)!;
const jonasCurrent = jonasCoachings.at(-1)!;
for (const key of ["phaseScores", "generalScores"] as const) {
  const differences = jonasCurrent[key].map((item, index) => item.score - jonasPrevious[key][index].score);
  assert.ok(differences.some((value) => value > 0), `${key} moet een verbetering bevatten`);
  assert.ok(differences.some((value) => value < 0), `${key} moet een achteruitgang bevatten`);
  assert.ok(differences.some((value) => value === 0), `${key} moet een gelijke score bevatten`);
}

const firstWheel = getPerformanceWheelData("rep-1", jonasCoachings[0].id, "kapstok");
assert.ok(firstWheel?.criteria.every((item) => item.previousScore === undefined));
assert.ok(firstWheel?.criteria.every((item) => item.trend === "first"));
assert.equal(getPreviousComparableIntervention("rep-1", jonasCoachings[0].id), undefined);

const comparisonWheel = getPerformanceWheelData("rep-1", jonasCurrent.id, "algemeen");
assert.equal(comparisonWheel?.comparisonInterventionId, jonasPrevious.id);
assert.equal(comparisonWheel?.criteria.length, 8);
assert.deepEqual(comparisonWheel?.categories.map((item) => item.name), [
  "Werkhouding",
  "Persoonlijkheid",
  "Organisatie",
  "Communicatie",
]);
assert.ok(comparisonWheel?.criteria.some((item) => item.trend === "better"));
assert.ok(comparisonWheel?.criteria.some((item) => item.trend === "worse"));
assert.ok(comparisonWheel?.criteria.some((item) => item.trend === "equal"));

const kapstokWheel = getPerformanceWheelData("rep-1", jonasCurrent.id, "kapstok");
assert.equal(kapstokWheel?.criteria.length, 28);
assert.deepEqual(kapstokWheel?.categories.map((item) => item.name), [
  "Introductie",
  "Behoefteanalyse",
  "Demonstratie",
  "Afsluiten",
  "Koffercontrole",
]);

console.log("Performance seed tests passed: coaching, contacts, actions, KPIs, scores, and trends.");
