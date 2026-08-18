import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterWorkflowStateByActiveModules,
  moduleForWorkflowRoute,
} from "@/lib/coaching/workflow-module-access";
import {
  isActivePlannedCoaching,
  matchesCoachingOverviewPeriod,
  matchesCoachingOverviewStatus,
} from "@/lib/coaching/overview-filters";
import { rankUniqueScoreInsights } from "@/lib/coaching/pdf-score-insights";
import {
  formatCoachingScoreDifference,
  formatCoachingScorePercentage,
} from "@/lib/coaching/score";
import type { AppModuleConfig, WorkflowState } from "@/lib/types";

assert.equal(moduleForWorkflowRoute("coaching"), "BEGELEIDINGEN");
assert.equal(moduleForWorkflowRoute("contact-moments"), "CONTACTMOMENTEN");
assert.equal(moduleForWorkflowRoute("unknown"), undefined);

const populatedState = {
  interventions: [{ id: "coaching" }],
  reflections: [{ id: "reflection" }],
  approvals: [{ id: "approval" }],
  contactMoments: [{ id: "contact" }],
  helpRequests: [{ id: "help" }],
  linkedInterventions: [
    { id: "linked-coaching", type: "begeleiding" },
    { id: "linked-retraining", type: "retraining" },
    { id: "linked-training", type: "sales_training" },
  ],
  retrainings: [{ id: "retraining" }],
  salesTrainings: [{ id: "training" }],
} as unknown as WorkflowState;
const moduleConfig = (code: AppModuleConfig["code"], enabled: boolean) => ({ code, enabled }) as AppModuleConfig;
const filteredState = filterWorkflowStateByActiveModules(populatedState, [
  moduleConfig("BEGELEIDINGEN", true),
  moduleConfig("ACTIEPUNTEN", false),
  moduleConfig("CONTACTMOMENTEN", false),
  moduleConfig("HULPAANVRAGEN", false),
  moduleConfig("RETRAININGEN", false),
  moduleConfig("SALESTRAININGEN", false),
]);
assert.equal(filteredState.interventions.length, 1);
assert.equal(filteredState.approvals.length, 1);
assert.equal(filteredState.reflections.length, 0);
assert.equal(filteredState.contactMoments.length, 0);
assert.equal(filteredState.helpRequests.length, 0);
assert.deepEqual(filteredState.linkedInterventions.map((item) => item.id), ["linked-coaching"]);

const today = "2026-08-18";
assert.equal(isActivePlannedCoaching({ status: "gepland", plannedDate: today }, today), true);
assert.equal(isActivePlannedCoaching({ status: "gepland", plannedDate: "2026-08-17" }, today), false);
assert.equal(matchesCoachingOverviewStatus({ status: "afgesloten", plannedDate: "2026-06-01" }, "planned", today), false);
assert.equal(matchesCoachingOverviewStatus({ status: "gepland", plannedDate: "2026-08-19" }, "planned", today), true);
assert.equal(matchesCoachingOverviewStatus({ status: "afgesloten", plannedDate: "2026-06-01" }, "closed", today), true);
assert.equal(matchesCoachingOverviewPeriod({ status: "gepland", plannedDate: "2026-09-17" }, "next30Days", today), true);
assert.equal(matchesCoachingOverviewPeriod({ status: "gepland", plannedDate: "2026-09-18" }, "next30Days", today), false);
assert.equal(matchesCoachingOverviewPeriod({ status: "afgesloten", plannedDate: "2026-07-01" }, "thisQuarter", today), true);

assert.equal(formatCoachingScorePercentage(4), "80%");
assert.equal(formatCoachingScorePercentage(75), "75%");
assert.equal(formatCoachingScorePercentage("nvt", "N.v.t."), "N.v.t.");
assert.equal(formatCoachingScoreDifference(4, 3), "+20%");
assert.equal(formatCoachingScoreDifference(2, 4), "-40%");

assert.deepEqual(rankUniqueScoreInsights([]), { strongest: [], improvements: [] });
assert.deepEqual(rankUniqueScoreInsights([{ criterion: "A", score: 80 }]), {
  strongest: [{ criterion: "A", score: 80 }],
  improvements: [],
});
const equalInsights = rankUniqueScoreInsights([
  { criterion: "B", score: 60 },
  { criterion: "A", score: 60 },
  { criterion: "C", score: 60 },
]);
assert.deepEqual(equalInsights.strongest.map((item) => item.criterion), ["A", "B", "C"]);
assert.deepEqual(equalInsights.improvements, []);
const rankedInsights = rankUniqueScoreInsights([
  { criterion: "Sterk", score: 100 },
  { criterion: "Midden", score: 60 },
  { criterion: "Werkpunt", score: 20 },
  { criterion: "werkpunt", score: 40 },
]);
assert.deepEqual(rankedInsights.strongest.map((item) => item.criterion), ["Sterk", "Midden"]);
assert.deepEqual(rankedInsights.improvements.map((item) => item.criterion), ["Werkpunt"]);
assert.equal(new Set([...rankedInsights.strongest, ...rankedInsights.improvements].map((item) => item.criterion.toLowerCase())).size, 3);

const guardedRoutes = [
  "app/api/workflows/coaching/[id]/route.ts",
  "app/api/workflows/coaching/[id]/historical-scores/route.ts",
  "app/api/workflows/coaching/[id]/transition/route.ts",
  "app/api/workflows/coaching/[id]/actions/route.ts",
  "app/api/workflows/coaching/[id]/cancel/route.ts",
  "app/api/workflows/coaching/preparation-references/route.ts",
  "app/api/workflows/approvals/[id]/reflection/route.ts",
  "app/api/workflows/contact-moments/[id]/photos/route.ts",
  "app/api/workflows/contact-moments/[id]/photos/[photoId]/route.ts",
];
guardedRoutes.forEach((file) => {
  assert.match(readFileSync(file, "utf8"), /requireAppModuleEnabled\(/, `${file} mist de moduleguard`);
});

const workspaceSource = readFileSync("components/workspace-pages.tsx", "utf8");
assert.ok(
  workspaceSource.indexOf("routeModule && modulesLoading") < workspaceSource.indexOf("routeModule && !isModuleEnabled"),
  "Directe routes moeten wachten tot de moduleconfiguratie geladen is",
);
assert.match(workspaceSource, /newAppointmentDraft/);
assert.match(workspaceSource, /confirmNewAppointment/);
const addAppointmentBody = workspaceSource.match(/function addAppointment\(\) \{([\s\S]*?)\n  \}\n\n  function confirmNewAppointment/)?.[1] ?? "";
assert.match(addAppointmentBody, /setNewAppointmentDraft/);
assert.doesNotMatch(addAppointmentBody, /setLocal/);

const wizardSource = readFileSync("components/coaching-wizard.tsx", "utf8");
assert.match(wizardSource, /formatCoachingScorePercentage\(row\.score, "-"\)/);
assert.doesNotMatch(wizardSource, /row\.score <= 5/);

console.log("P1-regressies voor modules, filters, scores, PDF-inzichten en afspraakbevestiging getest.");
