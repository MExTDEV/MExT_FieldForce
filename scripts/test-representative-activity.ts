import assert from "node:assert/strict";
import { buildRepresentativeActivities } from "@/lib/representative-activity";

const activities = buildRepresentativeActivities({
  representativeId: "rep-1",
  coachings: [{
    id: "coaching-1",
    representativeId: "rep-1",
    date: "2026-08-03",
    ownerId: "leader-1",
    ownerName: "Teamlead",
    status: "voltooid",
    focusNames: [],
    phaseScores: [],
    generalScores: [],
    criterionScores: [],
  }],
  workflowCoachings: [],
  historicalActionPoints: [{
    id: "action-1",
    representativeId: "rep-1",
    title: "Voorbereiding verbeteren",
    type: "vaardigheid",
    status: "afgerond",
    due: "2026-08-02",
    progress: 100,
    updatedAt: "2026-08-04T10:00:00.000Z",
    closedAt: "2026-08-05T10:00:00.000Z",
  }],
  contactMoments: [],
  historicalContactMoments: [{
    id: "contact-1",
    representativeId: "rep-1",
    date: "2026-08-04",
    ownerId: "leader-1",
    reason: "Opvolging",
    status: "afgesloten",
  }],
  helpRequests: [],
  retrainings: [],
  salesTrainings: [],
  evaluations: [{
    id: "evaluation-1",
    date: "2026-08-06",
    title: "3 maanden",
    status: "APPROVED",
    targetUrl: "/tussentijdse-evaluaties/evaluation-1",
  }],
});

assert.deepEqual(
  activities.map((activity) => activity.id),
  ["evaluation:evaluation-1", "actionPoint:action-1", "contactMoment:contact-1", "coaching:coaching-1"],
);
assert.equal(activities[1]?.targetUrl, "/actiepunten?representativeId=rep-1&actionPointId=action-1");
assert.equal(activities.length, 4);
console.log("Representative activity feed checks passed.");
