import assert from "node:assert/strict";
import { getVisibleWorkflowState } from "../lib/data-access";
import {
  createHelpRequest,
  planHelpRequestFollowUp,
  scheduleHelpRequestCoaching,
  sendHelpRequestAnswer,
  setHelpRequestStatus,
  updateHelpRequest,
  withdrawHelpRequest,
} from "../lib/workflow-engine";
import { representatives } from "../lib/mock-data";
import type { MockUser, WorkflowState } from "../lib/types";

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

const representative: MockUser = {
  id: "user-rep-be",
  representativeId: "rep-1",
  name: "Jonas Peeters",
  email: "jonas@example.test",
  role: "REPRESENTATIVE",
  country: "BE",
  language: "nl",
  teamId: "be-1",
};

const leader: MockUser = {
  id: "user-leader-be",
  name: "Sophie Vermeulen",
  email: "sophie@example.test",
  role: "SALES_LEADER",
  country: "BE",
  language: "nl",
  teamId: "be-1",
};

assert.throws(() => createHelpRequest(empty, {
  representativeId: "rep-1",
  requesterId: representative.id,
  subject: "   ",
  descriptionHtml: "<p></p>",
}, representatives), /Onderwerp|Omschrijving/);

const created = createHelpRequest(empty, {
  representativeId: "rep-1",
  requesterId: representative.id,
  subject: "Hulp bij prijsverdediging",
  descriptionHtml: "<p>Ik verlies marge bij bezwaren.</p>",
}, representatives);

assert.equal(created.helpRequest.status, "open");
assert.equal(created.helpRequest.answers?.length, 0);
assert.equal(getVisibleWorkflowState(representative, created.state, representatives).helpRequests.length, 1);
assert.equal(getVisibleWorkflowState(leader, created.state, representatives).helpRequests.length, 1);

const changed = updateHelpRequest(created.state, {
  id: created.helpRequest.id,
  requesterId: representative.id,
  subject: "Hulp bij prijsverdediging bij grote klanten",
  descriptionHtml: "<p>Ik verlies marge bij grote bezwaren.</p>",
});
assert.match(changed.helpRequest.descriptionText ?? "", /grote bezwaren/);

const answered = sendHelpRequestAnswer(changed.state, {
  helpRequestId: changed.helpRequest.id,
  authorId: leader.id,
  bodyHtml: "<p>We oefenen dit samen in het volgende overleg.</p>",
});
assert.equal(answered.helpRequest.status, "in_behandeling");
assert.equal(answered.helpRequest.firstHandledByUserId, leader.id);
assert.equal(answered.helpRequest.answers?.length, 1);

assert.throws(() => updateHelpRequest(answered.state, {
  id: answered.helpRequest.id,
  requesterId: representative.id,
  subject: "Te laat",
  descriptionHtml: "<p>Mag niet meer.</p>",
}), /behandeld/i);

assert.throws(() => withdrawHelpRequest(answered.state, answered.helpRequest.id, representative.id), /behandelde/i);
assert.throws(() => setHelpRequestStatus(answered.state, answered.helpRequest.id, "gesloten"), /inhoudelijk antwoord/i);

const closed = sendHelpRequestAnswer(answered.state, {
  helpRequestId: answered.helpRequest.id,
  authorId: leader.id,
  bodyHtml: "<p>Ik sluit deze aanvraag na ons antwoord.</p>",
  closesRequest: true,
});
assert.equal(closed.helpRequest.status, "gesloten");

const followUpBase = createHelpRequest(empty, {
  representativeId: "rep-1",
  requesterId: representative.id,
  subject: "Contactmoment nodig",
  descriptionHtml: "<p>Graag samen kort overlopen.</p>",
}, representatives);
const followed = planHelpRequestFollowUp(followUpBase.state, followUpBase.helpRequest.id, leader.id, "contactmoment", representatives);
const linkedHelp = followed.helpRequests.find((item) => item.id === followUpBase.helpRequest.id)!;
assert.equal(linkedHelp.status, "contactmoment");
assert.equal(linkedHelp.followUpType, "contactmoment");
assert.ok(linkedHelp.linkedInterventionId);

const repVisible = getVisibleWorkflowState(representative, followed, representatives).helpRequests[0];
assert.equal(repVisible.status, "in_behandeling");
assert.equal(repVisible.followUpType, undefined);
assert.equal(repVisible.linkedInterventionId, undefined);

const followedWithAnswerBase = createHelpRequest(empty, {
  representativeId: "rep-1",
  requesterId: representative.id,
  subject: "Contactmoment met antwoord",
  descriptionHtml: "<p>Graag eerst kaderen.</p>",
}, representatives);
const followedWithAnswer = planHelpRequestFollowUp(
  followedWithAnswerBase.state,
  followedWithAnswerBase.helpRequest.id,
  leader.id,
  "contactmoment",
  representatives,
  "<p>We plannen dit als contactmoment.</p>"
);
const linkedWithAnswer = followedWithAnswer.helpRequests.find((item) => item.id === followedWithAnswerBase.helpRequest.id)!;
assert.equal(linkedWithAnswer.answers?.length, 1);
assert.equal(linkedWithAnswer.answers?.[0]?.authorId, leader.id);
assert.equal(linkedWithAnswer.answers?.[0]?.closesRequest, false);

const responseBase = sendHelpRequestAnswer(changed.state, {
  helpRequestId: changed.helpRequest.id,
  authorId: leader.id,
  bodyHtml: "<p>Kan je nog aangeven bij welke klant dit speelt?</p>",
});
const requesterResponse = sendHelpRequestAnswer(responseBase.state, {
  helpRequestId: responseBase.helpRequest.id,
  authorId: representative.id,
  bodyHtml: "<p>Het gaat vooral over prospect X.</p>",
});
assert.equal(requesterResponse.helpRequest.status, "in_behandeling");
assert.equal(requesterResponse.helpRequest.answers?.at(-1)?.authorId, representative.id);

const coachingFollowUpBase = createHelpRequest(empty, {
  representativeId: "rep-1",
  requesterId: representative.id,
  subject: "Begeleiding nodig",
  descriptionHtml: "<p>Graag inplannen als begeleiding.</p>",
}, representatives);

assert.throws(
  () => planHelpRequestFollowUp(coachingFollowUpBase.state, coachingFollowUpBase.helpRequest.id, leader.id, "begeleiding", representatives),
  /planningswizard/
);

const scheduledCoaching = scheduleHelpRequestCoaching(coachingFollowUpBase.state, coachingFollowUpBase.helpRequest.id, leader.id, {
  representativeId: "rep-1",
  initiatorId: leader.id,
  ownerId: leader.id,
  plannedDate: "2026-07-20",
  startTime: "09:30",
  endTime: "11:30",
  notifyRepresentative: true,
  focusNames: ["Prijsverdediging"],
  scores: [],
  actionPoints: [],
}, representatives);

assert.equal(scheduledCoaching.intervention.status, "gepland");
assert.equal(scheduledCoaching.intervention.representativeId, "rep-1");
assert.equal(scheduledCoaching.intervention.initiatorId, leader.id);
assert.equal(scheduledCoaching.intervention.ownerId, leader.id);
assert.equal(scheduledCoaching.intervention.plannedDate, "2026-07-20");
assert.equal(scheduledCoaching.intervention.startTime, "09:30");
assert.equal(scheduledCoaching.intervention.endTime, "11:30");
assert.deepEqual(scheduledCoaching.intervention.focusNames, ["Prijsverdediging"]);
assert.equal(scheduledCoaching.helpRequest.status, "begeleiding");
assert.equal(scheduledCoaching.helpRequest.followUpType, "begeleiding");
assert.equal(scheduledCoaching.helpRequest.linkedInterventionId, scheduledCoaching.intervention.id);
assert.equal(scheduledCoaching.helpRequest.firstHandledByUserId, leader.id);
assert.equal(scheduledCoaching.state.interventions.length, 1);
assert.equal(scheduledCoaching.state.linkedInterventions.length, 0);

assert.throws(
  () => scheduleHelpRequestCoaching(coachingFollowUpBase.state, coachingFollowUpBase.helpRequest.id, leader.id, {
    representativeId: "rep-2",
    initiatorId: leader.id,
    ownerId: leader.id,
    plannedDate: "2026-07-20",
    startTime: "09:30",
    endTime: "11:30",
    notifyRepresentative: true,
    focusNames: ["Prijsverdediging"],
    scores: [],
    actionPoints: [],
  }, representatives),
  /vertegenwoordiger van de hulpaanvraag/
);

console.log("Hulpaanvragen workflowregels OK");
