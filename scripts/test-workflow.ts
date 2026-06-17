import assert from "node:assert/strict";
import {
  confirmWorkflowApproval,
  createHelpRequest,
  planHelpRequestFollowUp,
  saveRetraining,
  saveSalesTraining,
  saveContactMoment,
  saveCoaching,
  submitContactMomentInput,
  submitWorkflowReflection,
  type CoachingWorkflowInput,
} from "../lib/workflow-engine";
import type { WorkflowState } from "../lib/types";

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
const input: CoachingWorkflowInput = {
  representativeId: "rep-1",
  initiatorId: "user-leader-be",
  focusNames: ["Introductie"],
  scores: [
    {
      focus: "Introductie",
      criterion: "Zichzelf en MExT voorstellen",
      value: 75,
      previousScore: 50,
    },
  ],
  actionPoints: [
    {
      title: "Introductie consequent uitvoeren",
      type: "vaardigheid",
      due: "2026-06-30",
    },
  ],
};

const concept = saveCoaching(empty, input, "concept");
assert.equal(concept.intervention.status, "concept");
assert.equal(concept.intervention.scores.length, 1);
assert.equal(concept.intervention.actionPoints.length, 1);
assert.equal(concept.state.reflections.length, 0);

const finalized = saveCoaching(
  concept.state,
  { ...input, id: concept.intervention.id },
  "wacht_op_vt"
);
assert.equal(finalized.intervention.status, "wacht_op_vt");
assert.equal(finalized.state.reflections.length, 1);
assert.equal(finalized.state.reflections[0].status, "niet_gestart");

const reflected = submitWorkflowReflection(
  finalized.state,
  finalized.state.reflections[0].id,
  {
    learnedText: "Ik heb geleerd mijn introductie kort te houden.",
    workOnText: "Ik ga de openingsvragen bewuster inzetten.",
    concreteGoalText: "Bij de volgende vijf bezoeken gebruik ik de vaste introductie.",
  }
);
assert.equal(reflected.reflections[0].status, "ingediend");
assert.equal(reflected.interventions[0].status, "wacht_op_akkoord");
assert.equal(reflected.approvals.length, 1);

assert.throws(
  () => confirmWorkflowApproval(reflected, reflected.approvals[0].id, "gelezen_niet_akkoord", ""),
  /Commentaar is verplicht/
);

const approved = confirmWorkflowApproval(
  reflected,
  reflected.approvals[0].id,
  "gelezen_akkoord",
  ""
);
assert.equal(approved.approvals[0].status, "gelezen_akkoord");
assert.equal(approved.interventions[0].status, "afgesloten");

const contactDraft = saveContactMoment(approved, {
  representativeId: "rep-1",
  initiatorId: "user-leader-be",
  reason: "KPI-opvolging",
  reportedProblems: "PV blijft onder doel",
  leaderThemes: ["KPI-opvolging"],
}, "wacht_op_vt_input");
assert.equal(contactDraft.contactMoment.status, "wacht_op_vt_input");

const contactWithInput = submitContactMomentInput(
  contactDraft.state,
  contactDraft.contactMoment.id,
  "rep-1",
  ["PV %"],
  ["Prijsverdediging"]
);
assert.equal(contactWithInput.contactMoments[0].status, "gepland");

const contactClosed = saveContactMoment(contactWithInput, {
  id: contactDraft.contactMoment.id,
  representativeId: "rep-1",
  initiatorId: "user-leader-be",
  reason: "KPI-opvolging",
  reportedProblems: "PV blijft onder doel",
  leaderThemes: ["KPI-opvolging"],
  representativeKpis: ["PV %"],
  representativeThemes: ["Prijsverdediging"],
  discussedThemes: ["KPI-opvolging", "Prijsverdediging"],
  conclusion: "Focus op een consequente prijsverdediging.",
  actionPoints: [{ title: "Vijf prijsbezwaren oefenen", type: "vaardigheid", due: "2026-07-15" }],
}, "afgesloten");
assert.equal(contactClosed.contactMoment.actionPoints.length, 1);

const help = createHelpRequest(contactClosed.state, {
  representativeId: "rep-1",
  requesterId: "user-rep-be",
  subject: "Hulp bij prijsverdediging",
  difficulty: "Ik verlies zekerheid bij bezwaren.",
  desiredResult: "Een gericht contactmoment.",
  urgency: "hoog",
  explanation: "Voor de volgende klantafspraak.",
});
assert.equal(help.helpRequest.status, "nieuw");

const helpPlanned = planHelpRequestFollowUp(
  help.state,
  help.helpRequest.id,
  "user-leader-be",
  "contactmoment"
);
assert.equal(helpPlanned.helpRequests[0].status, "vervolgactie_gepland");
assert.equal(helpPlanned.contactMoments.length, 2);
assert.equal(helpPlanned.contactMoments[1].sourceHelpRequestId, help.helpRequest.id);

const retraining = saveRetraining(helpPlanned, {
  representativeId: "rep-1",
  initiatorId: "user-leader-be",
  theme: "Prijsverdediging",
  reason: "Onder doel",
  desiredImprovement: "Zelfzekerder reageren",
  kpi: "PV %",
  frameworkPhase: "Afsluiten",
  date: "2026-07-01",
  trainer: "Sophie Vermeulen",
  result: "Techniek correct toegepast.",
  actionPoints: [{ title: "Vijf bezwaren oefenen", type: "vaardigheid", due: "2026-07-15" }],
}, "afgerond");
assert.equal(retraining.retraining.status, "afgerond");
assert.equal(retraining.retraining.actionPoints.length, 1);

const salesTraining = saveSalesTraining(retraining.state, {
  initiatorId: "user-leader-be",
  participantIds: ["rep-1", "rep-2"],
  theme: "Afsluittechnieken",
  reason: "Teamontwikkeling",
  targetAudience: "BE Team 1",
  date: "2026-07-10",
  trainer: "Sophie Vermeulen",
  conclusion: "De technieken zijn geoefend.",
  followUpAction: "Pas de afsluitvraag toe",
  createIndividualActions: true,
  createGroupAction: true,
  actionDue: "2026-07-31",
}, "afgerond");
assert.equal(salesTraining.salesTraining.participantIds.length, 2);
assert.equal(salesTraining.salesTraining.actionPoints.length, 3);

const retrainingHelp = createHelpRequest(salesTraining.state, {
  representativeId: "rep-1",
  requesterId: "user-rep-be",
  subject: "Extra productkennis",
  difficulty: "Nieuwe producten uitleggen",
  desiredResult: "Productgamma zelfstandig demonstreren",
  urgency: "normaal",
  explanation: "",
});
const linkedRetraining = planHelpRequestFollowUp(
  retrainingHelp.state,
  retrainingHelp.helpRequest.id,
  "user-leader-be",
  "retraining"
);
assert.equal(linkedRetraining.retrainings.at(-1)?.sourceHelpRequestId, retrainingHelp.helpRequest.id);
assert.equal(linkedRetraining.retrainings.at(-1)?.theme, "Extra productkennis");

const salesHelp = createHelpRequest(linkedRetraining, {
  representativeId: "rep-2",
  requesterId: "user-leader-be",
  subject: "Afsluitvragen teamtraining",
  difficulty: "Afsluiten gebeurt niet consequent.",
  desiredResult: "Een gedeelde afsluitstructuur gebruiken.",
  urgency: "normaal",
  explanation: "",
});
const linkedSalesTraining = planHelpRequestFollowUp(
  salesHelp.state,
  salesHelp.helpRequest.id,
  "user-leader-be",
  "sales_training"
);
assert.equal(linkedSalesTraining.salesTrainings.at(-1)?.sourceHelpRequestId, salesHelp.helpRequest.id);
assert.deepEqual(linkedSalesTraining.salesTrainings.at(-1)?.participantIds, ["rep-2"]);
assert.equal(linkedSalesTraining.salesTrainings.at(-1)?.followUpAction, "Een gedeelde afsluitstructuur gebruiken.");

console.log("Workflow tests passed: coaching, contact moment, help request, retraining, and sales training.");
