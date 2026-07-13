import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getVisibleWorkflowState } from "../lib/data-access";
import { saveContactMoment } from "../lib/workflow-engine";
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

const contactMomentComponent = readFileSync(
  join(process.cwd(), "components", "contact-help-workflows.tsx"),
  "utf8"
);
assert.match(contactMomentComponent, /useEffect\(\(\) => \{\s+setForm\(\(current\) => \{/);
assert.match(
  contactMomentComponent,
  /current\.representativeId \|\| firstAvailableRepresentativeId \|\| ""/
);

const leader: MockUser = {
  id: "user-leader-be",
  name: "Leider BE",
  email: "leader@example.test",
  role: "SALES_LEADER",
  country: "BE",
  language: "nl",
  teamId: "be-1",
};

const representative: MockUser = {
  id: "user-rep-be",
  representativeId: "rep-1",
  name: "Rep BE",
  email: "rep@example.test",
  role: "REPRESENTATIVE",
  country: "BE",
  language: "nl",
  teamId: "be-1",
};

const plannedHidden = saveContactMoment(empty, {
  representativeId: "rep-1",
  initiatorId: leader.id,
  plannedDate: "2026-08-10",
  startTime: "09:00",
  endTime: "10:00",
  notifyRepresentative: false,
  subject: "Pipeline opvolging",
  reason: "Pipeline opvolging",
  reportedProblems: "",
  leaderThemes: ["Planning en organisatie"],
}, "gepland", representatives);

assert.equal(getVisibleWorkflowState(leader, plannedHidden.state, representatives).contactMoments.length, 1);
assert.equal(getVisibleWorkflowState(representative, plannedHidden.state, representatives).contactMoments.length, 0);

const plannedVisible = saveContactMoment(empty, {
  representativeId: "rep-1",
  initiatorId: leader.id,
  plannedDate: "2026-08-10",
  startTime: "11:00",
  endTime: "12:00",
  notifyRepresentative: true,
  subject: "Aangekondigd contactmoment",
  reason: "Aangekondigd contactmoment",
  reportedProblems: "",
  leaderThemes: [],
}, "gepland", representatives);

assert.equal(getVisibleWorkflowState(representative, plannedVisible.state, representatives).contactMoments.length, 1);

const started = saveContactMoment(plannedHidden.state, {
  ...plannedHidden.contactMoment,
  initiatorId: leader.id,
}, "in_uitvoering", representatives);

assert.throws(() => saveContactMoment(started.state, {
  ...started.contactMoment,
  initiatorId: leader.id,
  reportHtml: "<p></p>",
}, "afgesloten", representatives), /verslag is verplicht/i);

const shared = saveContactMoment(started.state, {
  ...started.contactMoment,
  initiatorId: leader.id,
  reportHtml: "<p>Definitief verslag met concrete afspraken.</p>",
  actionPoints: [{
    title: "Bel twee slapende klanten opnieuw op",
    type: "vaardigheid",
    due: "2026-08-20",
    priority: "normaal",
  }],
}, "afgesloten", representatives);

const visibleAfterShare = getVisibleWorkflowState(representative, shared.state, representatives).contactMoments;
assert.equal(visibleAfterShare.length, 1);
assert.equal(visibleAfterShare[0].finalSnapshot !== undefined, true);
assert.equal(visibleAfterShare[0].actionPoints[0].owner, "rep-1");

assert.throws(() => saveContactMoment(shared.state, {
  ...shared.contactMoment,
  initiatorId: leader.id,
  reportHtml: "<p>Gewijzigd na delen.</p>",
}, "afgesloten", representatives), /definitief contactmoment/i);

assert.throws(() => saveContactMoment(plannedVisible.state, {
  ...plannedVisible.contactMoment,
  initiatorId: leader.id,
}, "geannuleerd", representatives), /reden/i);

const notCompleted = saveContactMoment(plannedVisible.state, {
  ...plannedVisible.contactMoment,
  initiatorId: leader.id,
  closedReason: "Klantbezoek liep uit.",
}, "niet_uitgevoerd", representatives);

assert.equal(notCompleted.contactMoment.closedReason, "Klantbezoek liep uit.");
assert.equal(getVisibleWorkflowState(representative, notCompleted.state, representatives).contactMoments.length, 1);

console.log("Contactmomenten workflowregels OK");
