import assert from "node:assert/strict";
import { representatives } from "../lib/mock-data";
import { buildReportingDataset } from "../lib/reporting";
import { analyzeRepresentative, buildSmartCoaching } from "../lib/smart-coaching";
import type { WorkflowState } from "../lib/types";

const state: WorkflowState = {
  interventions: [],
  reflections: [],
  approvals: [],
  contactMoments: [],
  helpRequests: [{
    id: "help-risk",
    requesterId: "user-rep-be",
    representativeId: "rep-2",
    country: "BE",
    teamId: "be-1",
    subject: "Hulp bij behoefteanalyse",
    difficulty: "Te weinig open vragen",
    desiredResult: "Betere analyse",
    urgency: "hoog",
    explanation: "",
    status: "nieuw",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
  }],
  linkedInterventions: [],
  retrainings: [],
  salesTrainings: [],
};

const baseDataset = buildReportingDataset(state, representatives);
const dataset = {
  ...baseDataset,
  kpis: [
    ...baseDataset.kpis,
    {
      representativeId: "rep-3",
      kpi: "PV %",
      previousValue: "82%",
      currentValue: "74%",
      target: "80%",
      trend: -1,
    },
  ],
};
const referenceDate = "2026-06-11";
const result = buildSmartCoaching(dataset, state, referenceDate);
const starter = analyzeRepresentative(
  representatives.find((item) => item.id === "rep-2")!,
  dataset,
  state,
  referenceDate
);
const expert = analyzeRepresentative(
  representatives.find((item) => item.id === "rep-3")!,
  dataset,
  state,
  referenceDate
);
const stableRepresentative = representatives.find((item) => item.id === "rep-8")!;
const stableDataset = {
  ...dataset,
  actions: dataset.actions.filter((item) => item.representativeId !== stableRepresentative.id),
};
const stable = analyzeRepresentative(stableRepresentative, stableDataset, state, referenceDate);
const attention = analyzeRepresentative(stableRepresentative, {
  ...stableDataset,
  actions: [...stableDataset.actions, {
    id: "overdue-one",
    representativeId: stableRepresentative.id,
    title: "Eén verlopen opvolgactie",
    type: "vaardigheid",
    linkedKpi: "",
    startValue: "—",
    targetValue: "—",
    currentValue: "—",
    due: "2026-05-01",
    status: "nieuw",
    ownerId: "leader-nl-1",
    updatedAt: "2026-05-01",
  }],
}, state, referenceDate);

assert.equal(starter.risk, "red");
assert.ok(starter.reasons.some((reason) => reason.includes("hulpaanvraag zonder opvolging")));
assert.ok(starter.recommendations.some((item) => item.title === "Plan een retraining"));
assert.equal(expert.risk, "red");
assert.ok(expert.recommendations.some((item) => item.title === "Plan een contactmoment"));
assert.equal(stable.risk, "green");
assert.equal(attention.risk, "orange");
assert.ok(result.heatmap.some((item) => item.teamId === "be-1" && item.riskUserCount > 0));
assert.ok(result.alerts.some((item) => item.category === "help"));
assert.ok(result.trends.helpRequests.some((item) => item.label === "Behoefteanalyse"));

console.log("Smart Coaching tests passed: risk, recommendations, heatmap, trends, and alerts.");
