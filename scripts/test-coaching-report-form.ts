import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  coachingReportIssues,
  hasExplicitScore,
} from "../lib/coaching/report-form";
import { representatives } from "../lib/mock-data";
import { saveCoaching } from "../lib/workflow-engine";
import type {
  CoachingDossier,
  WorkflowActionPoint,
  WorkflowState,
} from "../lib/types";

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

const created = saveCoaching(
  emptyState,
  {
    representativeId: "rep-1",
    initiatorId: "user-leader-be",
    focusNames: ["Introductie"],
    scores: [],
    actionPoints: [],
  },
  "in_uitvoering",
  representatives
).intervention;

assert.ok(created.dossier);
assert.ok(created.dossier!.generalScores.every((score) => score.score === null));
assert.ok(created.dossier!.personalityScores.every((score) => score.score === null));
assert.equal(hasExplicitScore({ score: null }), false);
assert.equal(hasExplicitScore({ score: "nvt" }), true);
assert.equal(hasExplicitScore({ score: 0 }), true);

const emptyIssues = coachingReportIssues({
  dossier: created.dossier,
  actionPoints: [],
});
assert.equal(
  emptyIssues.filter((issue) => issue.code === "general_score_missing").length,
  created.dossier!.generalScores.length
);
assert.equal(
  emptyIssues.filter((issue) => issue.code === "personality_score_missing").length,
  created.dossier!.personalityScores.length
);
assert.ok(emptyIssues.some((issue) => issue.code === "action_point_missing"));

const completeDossier: CoachingDossier = {
  ...created.dossier!,
  generalScores: created.dossier!.generalScores.map((score, index) => ({
    ...score,
    score: index === 0 ? "nvt" : 4,
  })),
  personalityScores: created.dossier!.personalityScores.map((score) => ({
    ...score,
    score: 3,
  })),
};
const validAction: WorkflowActionPoint = {
  id: "new-action",
  title: "Introductie consequent toepassen",
  type: "vaardigheid",
  due: "",
  status: "open",
  owner: "user-leader-be",
  priority: "normaal",
  tipsAndTricks: "<p>Gebruik de vaste openingszin.</p>",
  isNew: true,
};

assert.deepEqual(
  coachingReportIssues({ dossier: completeDossier, actionPoints: [validAction] }),
  [],
  "Een expliciete NVT-selectie en geldige numerieke scores moeten aanvaard worden."
);

const blankRichTextIssues = coachingReportIssues({
  dossier: completeDossier,
  actionPoints: [{ ...validAction, tipsAndTricks: "<p><br></p>" }],
});
assert.ok(blankRichTextIssues.some((issue) => issue.code === "action_point_tips_missing"));

const source = readFileSync("components/workspace-pages.tsx", "utf8");
const stepKeys = source.match(/coaching\.report\.step\.(?:generalEvaluation|general|preparation|personality|appointments|actionPoints|closing)(?=")/g) ?? [];
assert.equal(new Set(stepKeys).size, 7, "Het begeleidingsverslag moet exact zeven herkenbare stappen bevatten.");
assert.match(source, /saveInFlightRef/);
assert.match(source, /finalizeInFlightRef/);
assert.match(source, /window\.localStorage\.setItem\(draftStorageKey/);
assert.match(source, /disabled=\{!reportIsValid \|\| transitioning\}/);

console.log("Begeleidingsverslag: zeven stappen, expliciete scores en afsluitvalidatie zijn correct.");
