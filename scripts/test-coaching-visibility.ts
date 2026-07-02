import assert from "node:assert/strict";

import { visibleCoachings } from "../lib/coaching/visibility";
import type { CoachingIntervention, MockUser } from "../lib/types";

const user = (id: string, role: MockUser["role"], country: MockUser["country"], representativeId?: string): MockUser => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role,
  country,
  language: "nl",
  representativeId,
});

const leaderA = user("leader-a", "SALES_LEADER", "BE");
const leaderOther = user("leader-other", "SALES_LEADER", "BE");
leaderA.teamId = "team-be";
leaderOther.teamId = "team-other";
const teamLeader = user("leader-team", "SALES_LEADER", "BE");
teamLeader.teamId = "team-be";
const representativeB = user("user-rep-b", "REPRESENTATIVE", "BE", "rep-b");
const adminBe = user("admin-be", "ADMIN", "BE");
const adminNl = user("admin-nl", "ADMIN", "NL");
const superAdmin = user("super", "SUPER_ADMIN", "NL");

const coaching: CoachingIntervention = {
  id: "coaching-today",
  representativeId: "rep-b",
  initiatorId: leaderA.id,
  ownerId: leaderA.id,
  country: "BE",
  teamId: "team-be",
  title: "Begeleiding vandaag",
  status: "gepland",
  plannedDate: "2026-07-01",
  startTime: "09:00",
  endTime: "12:00",
  notifyRepresentative: false,
  outlookSyncStatus: "NOT_SYNCED",
  focusNames: [],
  scores: [],
  actionPoints: [],
  createdAt: "2026-07-01T07:00:00.000Z",
  updatedAt: "2026-07-01T07:00:00.000Z",
};

// Simuleer de vroegere fout: dezelfde rij kwam door hergebruikte arrays 13 keer binnen.
const duplicated = Array.from({ length: 13 }, () => ({ ...coaching }));

assert.equal(visibleCoachings(leaderA, duplicated).length, 1);
assert.equal(visibleCoachings(leaderOther, duplicated).length, 0);
assert.equal(visibleCoachings(teamLeader, duplicated).length, 1);
assert.equal(visibleCoachings(representativeB, duplicated).length, 0);
assert.equal(visibleCoachings(adminBe, duplicated).length, 1);
assert.equal(visibleCoachings(adminNl, duplicated).length, 0);
assert.equal(visibleCoachings(superAdmin, duplicated).length, 1);

const notified = duplicated.map((item) => ({ ...item, notifyRepresentative: true }));
assert.equal(visibleCoachings(representativeB, notified).length, 0);
assert.equal(visibleCoachings(leaderA, notified).length, 1);
assert.equal(visibleCoachings(adminBe, notified).length, 1);
assert.equal(visibleCoachings(superAdmin, notified).length, 1);

const sentForApproval = duplicated.map((item) => ({
  ...item,
  notifyRepresentative: false,
  status: "verzonden_ter_akkoord" as const,
}));
assert.equal(
  visibleCoachings(representativeB, sentForApproval).length,
  1,
  "Een verrassingsbegeleiding wordt pas zichtbaar na verzending ter akkoord."
);

console.log("Zichtbaarheid en deduplicatie van begeleidingen zijn correct.");
