import assert from "node:assert/strict";
import { addBusinessDays } from "@/lib/server/business-days";
import {
  assertCanPlanPeerCoaching,
  assertPeerCoachCanStart,
  canExecutePeerCoaching,
} from "@/lib/coaching/peer-execution";
import { routeMailThroughMailTest } from "@/lib/server/mail-test";
import {
  defaultRepresentativeLevelForNewUser,
  defaultRepresentativeLevelForRoleReturn,
  representativeLevelLabels,
} from "@/lib/representative-levels";

assert.equal(defaultRepresentativeLevelForNewUser("REPRESENTATIVE"), "STARTER");
assert.equal(defaultRepresentativeLevelForRoleReturn("REPRESENTATIVE", { role: "SALES_LEADER", representativeLevel: "EXPERT" } as never), "SALES_EXECUTIVE");
assert.equal(representativeLevelLabels.PROFESSIONAL, "Professional");
assert.equal(representativeLevelLabels.EXPERT, "Expert");

const professional = {
  id: "pro-1",
  role: "REPRESENTATIVE" as const,
  representativeLevel: "PROFESSIONAL" as const,
  active: true,
  country: "BE" as const,
  teamId: "team-a",
};
const starter = {
  ...professional,
  id: "starter-1",
  representativeLevel: "STARTER" as const,
};
const target = {
  id: "target-1",
  role: "REPRESENTATIVE" as const,
  representativeLevel: "SALES_EXECUTIVE" as const,
  active: true,
  country: "NL" as const,
  teamId: "team-b",
};

assert.equal(canExecutePeerCoaching(professional), true);
assert.equal(canExecutePeerCoaching(starter), false);
assert.throws(() => assertCanPlanPeerCoaching({
  actor: { id: "planner", role: "SALES_MANAGER", country: "BE", countryAccess: ["BE"] },
  executor: professional,
  target,
}), /afwijkingsreden/i);

const deviation = assertCanPlanPeerCoaching({
  actor: { id: "planner", role: "SALES_MANAGER", country: "BE", countryAccess: ["BE"] },
  executor: professional,
  target,
  deviationReason: "Expertise nodig voor deze begeleiding.",
});
assert.equal(deviation.teamDeviation, true);
assert.equal(deviation.countryDeviation, true);

assert.throws(() => assertCanPlanPeerCoaching({
  actor: { id: "planner", role: "SALES_LEADER", country: "BE" },
  executor: professional,
  target: { ...target, country: "BE", teamId: "team-a" },
}), /Alleen Group Manager/i);

assert.throws(() => assertCanPlanPeerCoaching({
  actor: { id: "planner", role: "ADMIN", country: "BE" },
  executor: professional,
  target: { ...target, id: professional.id, country: "BE", teamId: "team-a" },
}), /Zelfbegeleiding/i);

assertPeerCoachCanStart({
  executor: professional,
  targetId: target.id,
  plannedDate: "2026-07-10",
  now: new Date("2026-07-10T00:00:00+02:00"),
});
assert.throws(() => assertPeerCoachCanStart({
  executor: professional,
  targetId: target.id,
  plannedDate: "2026-07-11",
  now: new Date("2026-07-10T23:00:00+02:00"),
}), /geplande kalenderdag/i);

const deadline = addBusinessDays(
  new Date("2026-07-10T09:00:00+02:00"),
  2,
  "BE",
  [{ country: "BE", date: "2026-07-13", active: true }],
);
assert.equal(deadline.toISOString().slice(0, 10), "2026-07-15");

const routed = routeMailThroughMailTest({
  mailTestActive: true,
  envelope: { to: ["yoni@mext.be"], cc: ["leader@mext.be"], bcc: ["audit@mext.be"] },
  context: {
    sourceModule: "Coaching",
    entityType: "Intervention",
    entityId: "coaching-1",
    eventKey: "coaching.planned",
    reason: "Uitvoerder informeren",
    sentAt: new Date("2026-07-10T10:00:00.000Z"),
  },
});
assert.deepEqual(routed.envelope, { to: ["helpdesk@mext.be"], cc: [], bcc: [] });
assert.equal(routed.original.to[0], "yoni@mext.be");
assert.match(routed.testWarning ?? "", /MAIL TEST is actief/);

console.log("Vertegenwoordigersniveaus, peer-coachingregels, werkdagen en MAIL TEST gevalideerd.");
