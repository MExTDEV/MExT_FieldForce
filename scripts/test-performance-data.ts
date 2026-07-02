import assert from "node:assert/strict";
import {
  coachingsForRepresentative,
  criterionScoresFromRows,
  mergeCriterionScores,
  performanceTrend,
} from "../lib/performance-data";
import {
  getPerformanceWheelData,
  getPreviousComparableIntervention,
} from "../lib/performance/performance-wheel";
import { loadPerformanceDatasetFromDatabase } from "../lib/server/performance";
import { listRepresentativesFromDatabase } from "../lib/server/representatives";

async function main() {
  const appointmentCriteria = criterionScoresFromRows([
    { criterion: "Introductie - Voorstellen", score: 4 },
    { criterion: "Introductie - Bedanken", score: 3 },
    { criterion: "Analyse - Open vragen", score: 5 },
    { criterion: "Analyse - Open vragen", score: 3 },
    { criterion: "Afsluiten - Order noteren", score: null, notApplicable: true },
  ]);
  assert.equal(appointmentCriteria.length, 4, "Elk uniek afspraakcriterium moet behouden blijven");
  assert.equal(appointmentCriteria.find((item) => item.criterion === "Open vragen")?.score, 80, "Herhaalde criteria moeten correct gemiddeld worden");
  assert.equal(appointmentCriteria.find((item) => item.criterion === "Order noteren")?.scored, false, "Niet-gescoorde criteria moeten als dusdanig behouden blijven");

  const mergedCriteria = mergeCriterionScores(appointmentCriteria, [{
    focus: "Persoonlijk",
    criterion: "Eigen criterium",
    score: 60,
    scored: true,
  }]);
  assert.equal(mergedCriteria.length, 5, "Vertegenwoordiger-specifieke criteria mogen niet verdwijnen");

  const [dataset, representatives] = await Promise.all([
    loadPerformanceDatasetFromDatabase(),
    listRepresentativesFromDatabase(),
  ]);

  assert.ok(representatives.length > 0, "MariaDB moet vertegenwoordigers bevatten");

  for (const representative of representatives) {
    const coachings = coachingsForRepresentative(dataset, representative.id);
    const actions = dataset.historicalActionPoints.filter((item) => item.representativeId === representative.id);
    const snapshots = dataset.monthlyKpiSnapshots.filter((item) => item.representativeId === representative.id);

    assert.ok(snapshots.every((item) => item.representativeId === representative.id));
    assert.ok(actions.every((item) => item.representativeId === representative.id));
    assert.ok(coachings.every((item) => item.representativeId === representative.id));
  }

  const trends = new Set(representatives.map((item) => performanceTrend(dataset, item.id)));
  assert.ok([...trends].every((item) => [-1, 0, 1].includes(item)), "Trends moeten genormaliseerd zijn");

  const representativeWithCoachings = representatives.find((representative) =>
    coachingsForRepresentative(dataset, representative.id).length > 0
  );

  if (representativeWithCoachings) {
    const coachings = coachingsForRepresentative(dataset, representativeWithCoachings.id);
    const firstWheel = getPerformanceWheelData(representativeWithCoachings.id, coachings[0].id, "kapstok", undefined, coachings);
    assert.ok(firstWheel?.criteria.every((item) => item.previousScore === undefined));
    assert.ok(firstWheel?.criteria.every((item) => item.trend === "first"));
    assert.equal(getPreviousComparableIntervention(representativeWithCoachings.id, coachings[0].id, coachings), undefined);

    const latest = coachings.at(-1)!;
    const wheel = getPerformanceWheelData(representativeWithCoachings.id, latest.id, "kapstok", undefined, coachings);
    assert.ok(wheel);
    assert.ok(wheel.criteria.length > 0);
  }

  const regressionCoaching = dataset.historicalCoachings.find((item) => item.id === "coaching-1782884164016-jg9uog");
  if (regressionCoaching) {
    const regressionWheel = getPerformanceWheelData(
      regressionCoaching.representativeId,
      regressionCoaching.id,
      "kapstok",
      undefined,
      [regressionCoaching]
    );
    assert.equal(regressionWheel?.criteria.length, 28, "De 28 opgeslagen afspraakcriteria moeten allemaal in de prestatiecirkel staan");
  }

  console.log("Performance database tests passed: actions, KPIs, coachings, contacts, and trends.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
