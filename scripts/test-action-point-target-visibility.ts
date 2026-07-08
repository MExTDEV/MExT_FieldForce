import assert from "node:assert/strict";

import { splitActionPointSections, type ActionPointOverviewItem } from "../lib/action-points/visibility";
import { emptyPerformanceDataset, type HistoricalActionPoint } from "../lib/performance-data";
import { buildReportingDataset, emptyReportingFilters, filterReportingDataset } from "../lib/reporting";
import { buildSmartCoaching } from "../lib/smart-coaching";
import type { Representative, WorkflowState } from "../lib/types";

async function main() {
  const performanceModule = await import("../lib/server/performance");
  const normalizeHistoricalActionPoints = (performanceModule as {
    normalizeHistoricalActionPoints?: (
      legacyRows: unknown[],
      coachingRows: unknown[],
      referenceDate?: string
    ) => HistoricalActionPoint[];
  }).normalizeHistoricalActionPoints;

  assert.equal(
    typeof normalizeHistoricalActionPoints,
    "function",
    "Performance-data normaliseert legacy ActionPoint- en CoachingAction-records."
  );

const yoni: Representative = {
  id: "rep-yoni",
  firstName: "Yoni",
  lastName: "Pieters",
  initials: "YP",
  country: "BE",
  team: "Team BE",
  teamId: "team-be",
  level: "Vertegenwoordiger",
  levelColor: "bg-sky-100 text-sky-800",
  lastCoaching: "2026-07-01",
  openActions: 0,
  email: "yoni@example.test",
  phone: "",
  kpis: [],
};

const other: Representative = {
  ...yoni,
  id: "rep-other",
  firstName: "Andere",
  lastName: "Gebruiker",
  initials: "AG",
  email: "andere@example.test",
};

const emptyState: WorkflowState = {
  interventions: [],
  reflections: [],
  approvals: [],
  contactMoments: [],
  helpRequests: [],
  linkedInterventions: [],
  retrainings: [],
  salesTrainings: [],
};

const normalized = normalizeHistoricalActionPoints!(
  [
    {
      id: "legacy-wrong-representative",
      title: "Werkpunt uit begeleiding",
      type: "VAARDIGHEID",
      status: "NIEUW",
      dueDate: null,
      updatedAt: new Date("2026-07-08T09:00:00.000Z"),
      representativeId: "coach-user",
      representative: { representativeId: "rep-coach" },
      interventionId: "coaching-yoni",
      intervention: {
        representativeId: "user-yoni",
        representative: { representativeId: "rep-yoni" },
      },
    },
    {
      id: "legacy-closed",
      title: "Afgewerkt werkpunt",
      type: "VAARDIGHEID",
      status: "AFGEROND",
      dueDate: null,
      updatedAt: new Date("2026-07-08T10:00:00.000Z"),
      representativeId: "user-yoni",
      representative: { representativeId: "rep-yoni" },
      interventionId: "coaching-yoni",
      intervention: {
        representativeId: "user-yoni",
        representative: { representativeId: "rep-yoni" },
      },
    },
  ],
  [
    {
      id: "coaching-action-yoni",
      title: "Nieuw persoonlijk werkpunt",
      updatedAt: new Date("2026-07-08T11:00:00.000Z"),
      userId: "user-yoni",
      user: { representativeId: "rep-yoni" },
      interventionId: "coaching-yoni",
      intervention: {
        representativeId: "user-yoni",
        representative: { representativeId: "rep-yoni" },
      },
    },
    {
      id: "coaching-action-duplicate",
      title: "Werkpunt uit begeleiding",
      updatedAt: new Date("2026-07-08T12:00:00.000Z"),
      userId: "user-yoni",
      user: { representativeId: "rep-yoni" },
      interventionId: "coaching-yoni",
      intervention: {
        representativeId: "user-yoni",
        representative: { representativeId: "rep-yoni" },
      },
    },
    {
      id: "coaching-action-other",
      title: "Werkpunt van iemand anders",
      updatedAt: new Date("2026-07-08T13:00:00.000Z"),
      userId: "user-other",
      user: { representativeId: "rep-other" },
      interventionId: "coaching-other",
      intervention: {
        representativeId: "user-other",
        representative: { representativeId: "rep-other" },
      },
    },
  ],
  "2026-07-08"
);

assert.deepEqual(
  normalized.filter((item) => item.representativeId === "rep-yoni").map((item) => item.id).sort(),
  ["coaching-action:coaching-action-yoni", "legacy-closed", "legacy-wrong-representative"],
  "Bestaande en nieuwe begeleidingsactiepunten worden aan de target-vertegenwoordiger gekoppeld en niet dubbel geteld."
);

const dataset = buildReportingDataset(emptyState, [yoni, other], {
  ...emptyPerformanceDataset,
  historicalActionPoints: normalized,
});
const scopedDataset = filterReportingDataset(dataset, [yoni], emptyReportingFilters);

assert.deepEqual(
  scopedDataset.actions.map((item) => item.id).sort(),
  ["coaching-action:coaching-action-yoni", "legacy-closed", "legacy-wrong-representative"],
  "De Actiepunten-dataset voor een vertegenwoordiger bevat alleen persoonlijke actiepunten van die vertegenwoordiger."
);

const smart = buildSmartCoaching(scopedDataset, emptyState, "2026-07-08");
assert.equal(
  smart.insights.find((item) => item.representative.id === "rep-yoni")?.openActionCount,
  2,
  "Dashboardteller telt alleen open zichtbare actiepunten."
);

const overviewItems: ActionPointOverviewItem[] = scopedDataset.actions.map((action) => ({
  id: action.id,
  title: action.title,
  description: "",
  tipsAndTricks: "",
  priority: "normaal",
  scope: "USER",
  scopeKey: `USER:${action.representativeId}`,
  country: yoni.country,
  teamId: yoni.teamId,
  userId: action.representativeId,
  active: true,
  validFrom: action.updatedAt,
  validUntil: action.due,
  createdAt: `${action.updatedAt}T00:00:00.000Z`,
  updatedAt: `${action.updatedAt}T00:00:00.000Z`,
  source: "workflow",
  status: action.status,
  due: action.due,
  representativeId: action.representativeId,
  representativeName: "Yoni Pieters",
  ownerName: "Jochen Andries",
  originLabel: "Begeleidingsdossier",
}));
const sections = splitActionPointSections(overviewItems);

assert.deepEqual(
  sections[0].items.map((item) => item.id).sort(),
  ["coaching-action:coaching-action-yoni", "legacy-wrong-representative"],
  "De module Actiepunten toont dezelfde open persoonlijke actiepunten als het dashboard."
);
assert.deepEqual(
  sections[1].items.map((item) => item.id),
  ["legacy-closed"],
  "Afgewerkte actiepunten komen niet in de open telling terecht."
);

console.log("Actiepunten uit begeleidingen zijn zichtbaar op target-user, dashboard en modulelijst.");
}

void main();
