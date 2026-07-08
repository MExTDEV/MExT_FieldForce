import assert from "node:assert/strict";
import { toPersistableCoachingActionPoints } from "../lib/coaching/action-point-persistence";
import { representatives } from "../lib/mock-data";
import { saveCoaching } from "../lib/workflow-engine";
import type { WorkflowActionPoint, WorkflowState } from "../lib/types";

const actions: WorkflowActionPoint[] = [
  {
    id: "action-yoni-1",
    definitionId: "definition-yoni-1",
    title: "Oefen de introductie",
    type: "vaardigheid",
    due: "2026-07-31",
    status: "open",
    owner: "coach-jochen",
    priority: "hoog",
    description: "Blijf kort en duidelijk.",
    tipsAndTricks: "<p>Gebruik de vaste openingszin.</p>",
    targetValue: 80,
    achievedScore: 70,
    isNew: true,
  },
];

const [persistable] = toPersistableCoachingActionPoints(actions);

assert.deepEqual(persistable, {
  title: "Oefen de introductie",
  type: "vaardigheid",
  due: "2026-07-31",
  owner: "coach-jochen",
  priority: "hoog",
  description: "Blijf kort en duidelijk.",
  tipsAndTricks: "<p>Gebruik de vaste openingszin.</p>",
  targetValue: 80,
  achievedScore: 70,
  definitionId: "definition-yoni-1",
  isNew: true,
});

const empty: WorkflowState = {
  interventions: [],
  reflections: [],
  approvals: [],
  contactMoments: [],
  helpRequests: [],
  linkedInterventions: [],
  retrainings: [],
  salesTrainings: [],
};

const result = saveCoaching(
  empty,
  {
    representativeId: "rep-1",
    initiatorId: "user-leader-be",
    focusNames: ["Introductie"],
    scores: [],
    actionPoints: toPersistableCoachingActionPoints(actions),
  },
  "voltooid",
  representatives
);

assert.equal(result.intervention.status, "voltooid");
assert.equal(result.intervention.actionPoints[0].isNew, true);
assert.equal(result.intervention.actionPoints[0].tipsAndTricks, "<p>Gebruik de vaste openingszin.</p>");

console.log("Coaching action point persistence mapping test passed.");
