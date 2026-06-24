import assert from "node:assert/strict";
import {
  coachingsForRepresentative,
  performanceTrend,
} from "../lib/performance-data";
import {
  getPerformanceWheelData,
  getPreviousComparableIntervention,
} from "../lib/performance/performance-wheel";
import { loadPerformanceDatasetFromDatabase } from "../lib/server/performance";
import { listRepresentativesFromDatabase } from "../lib/server/representatives";

async function main() {
  const [dataset, representatives] = await Promise.all([
    loadPerformanceDatasetFromDatabase(),
    listRepresentativesFromDatabase(),
  ]);

  assert.ok(representatives.length > 0, "MariaDB moet vertegenwoordigers bevatten");
  assert.ok(dataset.monthlyKpiSnapshots.length > 0, "MariaDB moet KPI snapshots bevatten");

  for (const representative of representatives) {
    const coachings = coachingsForRepresentative(dataset, representative.id);
    const actions = dataset.historicalActionPoints.filter((item) => item.representativeId === representative.id);
    const snapshots = dataset.monthlyKpiSnapshots.filter((item) => item.representativeId === representative.id);

    assert.ok(snapshots.length > 0, `${representative.id} heeft geen KPI snapshots`);
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

  console.log("Performance database tests passed: actions, KPIs, coachings, contacts, and trends.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
