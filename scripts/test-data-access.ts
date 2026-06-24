import assert from "node:assert/strict";
import {
  getVisibleRepresentatives,
  getVisibleWorkflowState,
} from "../lib/data-access";
import { mockUsers, representatives } from "../lib/mock-data";
import type { MockUser, WorkflowState } from "../lib/types";

const jonas = mockUsers.find((user) => user.id === "user-rep-be")!;
const sophie = mockUsers.find((user) => user.id === "user-leader-be")!;
const superAdmin = mockUsers.find((user) => user.id === "user-super")!;
const countryManagerBe: MockUser = {
  id: "test-country-be",
  name: "Country Manager BE",
  email: "country.be@mext.local",
  role: "COUNTRY_MANAGER",
  country: "BE",
  language: "nl",
};

assert.deepEqual(
  getVisibleRepresentatives(jonas, representatives).map((item) => item.id),
  ["rep-1"],
  "Jonas mag uitsluitend zichzelf zien."
);
assert.ok(
  getVisibleRepresentatives(sophie, representatives).every((item) => item.teamId === "be-1"),
  "Een verkoopleider mag uitsluitend het eigen team zien."
);
assert.ok(
  getVisibleRepresentatives(countryManagerBe, representatives).every(
    (item) => item.country === "BE"
  ),
  "Een Country Manager mag uitsluitend het eigen land zien."
);
assert.equal(
  getVisibleRepresentatives(superAdmin, representatives).length,
  representatives.length,
  "Een Super Admin moet alle vertegenwoordigers zien."
);

const state: WorkflowState = {
  interventions: [],
  reflections: [],
  approvals: [],
  contactMoments: [],
  helpRequests: [],
  linkedInterventions: [],
  retrainings: [],
  salesTrainings: [
    {
      id: "scope-training",
      initiatorId: "user-super",
      country: "BE",
      theme: "Scopecontrole",
      reason: "Test",
      targetAudience: "Alle vertegenwoordigers",
      participantIds: ["rep-1", "rep-2", "rep-6"],
      date: "2026-06-15",
      trainer: "Trainer",
      conclusion: "",
      followUpAction: "",
      createIndividualActions: false,
      createGroupAction: false,
      actionDue: "",
      actionPoints: [],
      status: "gepland",
      createdAt: "2026-06-15T08:00:00.000Z",
      updatedAt: "2026-06-15T08:00:00.000Z",
    },
  ],
};

assert.deepEqual(
  getVisibleWorkflowState(jonas, state, representatives).salesTrainings[0]?.participantIds,
  ["rep-1"],
  "Een vertegenwoordiger mag geen participant-ids van collega's ontvangen."
);
assert.deepEqual(
  getVisibleWorkflowState(sophie, state, representatives).salesTrainings[0]?.participantIds,
  ["rep-1", "rep-2"],
  "Een verkoopleider mag alleen deelnemers uit het eigen team ontvangen."
);

console.log("FieldForce dashboard data-access tests geslaagd.");
