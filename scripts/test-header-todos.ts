import assert from "node:assert/strict";

import {
  buildHeaderTodoItems,
  shouldAnimateTodoBell,
} from "../lib/dashboard-attention";
import { visibleCoachings } from "../lib/coaching/visibility";
import type { CoachingIntervention, MockUser } from "../lib/types";

const user = (
  id: string,
  role: MockUser["role"],
  country: MockUser["country"],
  representativeId?: string,
): MockUser => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role,
  country,
  language: "nl",
  representativeId,
  teamId: country === "BE" ? "team-be" : "team-nl",
});

const leader = user("leader", "SALES_LEADER", "BE");
const representative = user("rep-user", "REPRESENTATIVE", "BE", "rep-1");
const otherRepresentative = user("other-rep-user", "REPRESENTATIVE", "BE", "rep-2");
const adminBe = user("admin-be", "ADMIN", "BE");
const salesManagerBe = { ...user("sales-manager", "SALES_MANAGER", "BE"), countryAccess: ["BE"] as MockUser["country"][] };
const salesManagerWithoutScope = { ...user("sales-manager-empty", "SALES_MANAGER", "BE"), countryAccess: [] as MockUser["country"][] };

function coaching(
  id: string,
  status: CoachingIntervention["status"],
  representativeId = "rep-1",
  country: MockUser["country"] = "BE",
  notifyRepresentative = true,
): CoachingIntervention {
  return {
    id,
    representativeId,
    initiatorId: leader.id,
    ownerId: leader.id,
    country,
    teamId: country === "BE" ? "team-be" : "team-nl",
    title: `Begeleiding ${id}`,
    status,
    plannedDate: "2026-07-08",
    startTime: "09:00",
    endTime: "10:00",
    notifyRepresentative,
    outlookSyncStatus: "NOT_SYNCED",
    focusNames: [],
    scores: [],
    actionPoints: [],
    createdAt: "2026-07-08T07:00:00.000Z",
    updatedAt: "2026-07-08T07:00:00.000Z",
  };
}

const completedOnly = buildHeaderTodoItems({
  currentUser: leader,
  today: "2026-07-08",
  interventions: [coaching("completed", "voltooid")],
});
assert.equal(completedOnly.length, 0, "Volledig uitgevoerde items zonder actie tellen niet als open ToDo.");

const executionTodo = buildHeaderTodoItems({
  currentUser: leader,
  today: "2026-07-08",
  interventions: [coaching("planned", "gepland")],
});
assert.equal(executionTodo.length, 1);
assert.equal(executionTodo[0].todoKind, "execution");
assert.equal(executionTodo[0].href, "/begeleidingen/planned");

const hiddenSurprise = visibleCoachings(representative, [
  coaching("surprise", "gepland", "rep-1", "BE", false),
]);
assert.equal(hiddenSurprise.length, 0);
assert.equal(
  buildHeaderTodoItems({
    currentUser: representative,
    today: "2026-07-08",
    interventions: hiddenSurprise,
  }).length,
  0,
  "Verborgen surprise coachings mogen geen indirecte header-ToDo veroorzaken.",
);

const ownPending = coaching("pending-own", "wacht_op_akkoord", "rep-1", "BE", false);
const representativePendingTodos = buildHeaderTodoItems({
  currentUser: representative,
  today: "2026-07-08",
  interventions: visibleCoachings(representative, [ownPending]),
});
assert.equal(representativePendingTodos.length, 1);
assert.equal(representativePendingTodos[0].todoKind, "approval");
assert.equal(representativePendingTodos[0].href, "/begeleidingen/pending-own");

const otherRepresentativePendingTodos = buildHeaderTodoItems({
  currentUser: otherRepresentative,
  today: "2026-07-08",
  interventions: visibleCoachings(otherRepresentative, [ownPending]),
});
assert.equal(
  otherRepresentativePendingTodos.length,
  0,
  "Andere vertegenwoordigers zien geen akkoord-ToDo van iemand anders.",
);

const pendingBe = coaching("pending-be", "verzonden_ter_akkoord", "rep-1", "BE", false);
const pendingNl = coaching("pending-nl", "wacht_op_akkoord", "rep-nl", "NL", false);
assert.deepEqual(
  buildHeaderTodoItems({
    currentUser: adminBe,
    today: "2026-07-08",
    interventions: visibleCoachings(adminBe, [pendingBe, pendingNl]),
  }).map((item) => item.recordId),
  ["pending-be"],
  "Managementrollen zien akkoord-ToDo's alleen binnen bestaande scope.",
);
assert.equal(visibleCoachings(salesManagerBe, [pendingBe]).length, 1);
assert.equal(visibleCoachings(salesManagerWithoutScope, [pendingBe]).length, 0);

const approvedPendingStatus = {
  ...coaching("already-approved", "wacht_op_akkoord", "rep-1", "BE", false),
  approvedByRepAt: "2026-07-08T12:00:00.000Z",
};
assert.equal(
  buildHeaderTodoItems({
    currentUser: representative,
    today: "2026-07-08",
    interventions: visibleCoachings(representative, [approvedPendingStatus]),
  }).length,
  0,
  "Een akkoord-ToDo telt niet meer wanneer bestaande approvalvelden al ingevuld zijn.",
);

assert.equal(shouldAnimateTodoBell(1, false), true);
assert.equal(shouldAnimateTodoBell(0, false), false);
assert.equal(shouldAnimateTodoBell(1, true), false);

console.log("Header ToDo-bel volgt bestaande visible workflowdata en akkoord-ToDo regels.");
