import assert from "node:assert/strict";
import { canCancelFutureCoaching } from "@/lib/coaching/access";
import type { CoachingIntervention, MockUser } from "@/lib/types";

const user = (id: string, role: MockUser["role"]): MockUser => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role,
  country: "BE",
  language: "nl",
});
const manager = user("manager", "SALES_LEADER");
manager.teamId = "team-1";
const representative = user("representative", "REPRESENTATIVE");
representative.representativeId = "rep-1";
const coaching: CoachingIntervention = {
  id: "coaching-cancel",
  representativeId: "rep-1",
  initiatorId: manager.id,
  ownerId: manager.id,
  country: "BE",
  teamId: "team-1",
  title: "Begeleiding",
  status: "gepland",
  plannedDate: "2026-08-17",
  startTime: "09:00",
  endTime: "11:00",
  actualStartedAt: undefined,
  outlookSyncStatus: "SYNCED",
  focusNames: [],
  scores: [],
  actionPoints: [],
  createdAt: "2026-08-10T08:00:00.000Z",
  updatedAt: "2026-08-10T08:00:00.000Z",
};

assert.equal(canCancelFutureCoaching(manager, coaching, "2026-08-13"), true);
assert.equal(canCancelFutureCoaching(representative, coaching, "2026-08-13"), false);
assert.equal(canCancelFutureCoaching(manager, { ...coaching, plannedDate: "2026-08-13" }, "2026-08-13"), false);
assert.equal(canCancelFutureCoaching(manager, { ...coaching, status: "in_uitvoering" }, "2026-08-13"), false);
assert.equal(canCancelFutureCoaching(manager, { ...coaching, actualStartedAt: "2026-08-12T09:00:00.000Z" }, "2026-08-13"), false);

console.log("Coaching cancellation access tests passed.");
