import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  coachingReportIssues,
  hasExplicitScore,
  parseCoachingReportDraft,
  serializeCoachingReportDraft,
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

const legacyDraft = {
  id: "legacy-report",
  dossier: {
    ...completeDossier,
    generalScores: [
      { criterion: "Stiptheid", score: "nvt" as const, comment: "" },
      { criterion: "Vertrekuur", score: 4 as const, comment: "" },
    ],
    personalityScores: [
      { criterion: "Uitstraling", score: "nvt" as const, comment: "" },
    ],
  },
};
const restoredLegacyDraft = parseCoachingReportDraft<typeof legacyDraft>(JSON.stringify(legacyDraft));
assert.equal(restoredLegacyDraft?.dossier?.generalScores[0]?.score, null);
assert.equal(restoredLegacyDraft?.dossier?.generalScores[1]?.score, 4);
assert.equal(restoredLegacyDraft?.dossier?.personalityScores[0]?.score, null);

const currentDraft = {
  ...legacyDraft,
  dossier: {
    ...legacyDraft.dossier,
    generalScores: [{ criterion: "Stiptheid", score: "nvt" as const, comment: "Bewust NVT" }],
  },
};
const restoredCurrentDraft = parseCoachingReportDraft<typeof currentDraft>(serializeCoachingReportDraft(currentDraft));
assert.equal(
  restoredCurrentDraft?.dossier?.generalScores[0]?.score,
  "nvt",
  "Een expliciete NVT-keuze in een nieuw browserconcept moet behouden blijven."
);

const source = readFileSync("components/workspace-pages.tsx", "utf8");
const stepKeys = source.match(/coaching\.report\.step\.(?:generalEvaluation|general|preparation|personality|appointments|actionPoints|closing)(?=")/g) ?? [];
assert.equal(new Set(stepKeys).size, 7, "Het begeleidingsverslag moet exact zeven herkenbare stappen bevatten.");
assert.match(source, /saveInFlightRef/);
assert.match(source, /finalizeInFlightRef/);
assert.match(source, /window\.localStorage\.setItem\(draftStorageKey/);
assert.match(source, /serializeCoachingReportDraft\(local\)/);
assert.match(source, /disabled=\{!reportIsValid \|\| transitioning\}/);

const repairMigration = readFileSync(
  "prisma/migrations/0051_coaching_clear_legacy_default_nvt/migration.sql",
  "utf8"
);
assert.match(repairMigration, /`notApplicable` = false/);
assert.match(repairMigration, /'Dossier:Algemeen'/);
assert.match(repairMigration, /'Dossier:Persoonlijkheid'/);
assert.match(repairMigration, /'IN_UITVOERING'/);

console.log("Begeleidingsverslag: zeven stappen, expliciete scores en afsluitvalidatie zijn correct.");
