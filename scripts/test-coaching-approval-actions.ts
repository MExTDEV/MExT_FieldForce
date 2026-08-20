import assert from "node:assert/strict";
import fs from "node:fs";

import { calculateOfficialCoachingScore } from "../lib/coaching/score";
import {
  canRemindCoachingApproval,
  isPendingCoachingApprovalStatus,
  resolveCoachingApprovalSentForApprovalAt,
} from "../lib/coaching/approval-actions";
import { isCoachingApprovalManagerRole } from "../lib/coaching/access";
import type { CoachingIntervention, MockUser, Status } from "../lib/types";

assert.equal(
  calculateOfficialCoachingScore({ dossierScores: [2.7], appointmentScores: [] }),
  54,
  "2,7 / 5 moet als 54% worden berekend."
);
assert.equal(
  calculateOfficialCoachingScore({ dossierScores: [3.5], appointmentScores: [] }),
  70,
  "3,5 / 5 moet als 70% worden berekend."
);
assert.equal(
  calculateOfficialCoachingScore({ dossierScores: [3.6], appointmentScores: [] }),
  72,
  "3,6 / 5 moet als 72% worden berekend."
);
assert.equal(
  calculateOfficialCoachingScore({ dossierScores: ["NVT"], appointmentScores: [] }),
  undefined,
  "Een ongescoorde begeleiding mag geen totaalscore tonen."
);
assert.equal(
  Math.round(calculateOfficialCoachingScore({
    dossierScores: [3],
    appointmentScores: [[3], [5]],
  }) ?? -1),
  76,
  "De officiële totaalscore moet afspraken voor 80% en het hoofdformulier voor 20% wegen."
);

assert.equal(isCoachingApprovalManagerRole("REPRESENTATIVE"), false);
assert.equal(isCoachingApprovalManagerRole("SERVICE_OPERATOR"), false);
assert.equal(isCoachingApprovalManagerRole("SALES_LEADER"), true);
assert.equal(isCoachingApprovalManagerRole("ADMIN"), true);
assert.equal(isCoachingApprovalManagerRole("SUPER_ADMIN"), true);

const manager: MockUser = {
  id: "leader-1",
  name: "Leidinggevende",
  email: "leader@example.test",
  role: "SALES_LEADER",
  country: "BE",
  language: "nl",
  teamId: "team-1",
};
const representative: MockUser = {
  ...manager,
  id: "rep-1",
  representativeId: "rep-1",
  role: "REPRESENTATIVE",
  teamId: "team-1",
};
const serviceOperator: MockUser = {
  ...manager,
  id: "service-1",
  role: "SERVICE_OPERATOR",
};

function intervention(input: {
  status: Status;
  sentForApprovalAt?: string;
  auditSentForApprovalAt?: string;
}): CoachingIntervention {
  return {
    id: "coaching-1",
    representativeId: "rep-1",
    initiatorId: manager.id,
    ownerId: manager.id,
    country: "BE",
    teamId: "team-1",
    title: "Begeleiding test",
    status: input.status,
    plannedDate: "2026-07-15",
    outlookSyncStatus: "NOT_SYNCED",
    focusNames: [],
    scores: [],
    actionPoints: [],
    auditTrail: input.auditSentForApprovalAt
      ? [{
          id: "audit-1",
          at: input.auditSentForApprovalAt,
          userId: manager.id,
          action: "coaching.sent_for_approval",
          summary: "Begeleiding naar de vertegenwoordiger verstuurd ter akkoord.",
          newValue: { status: "VERZONDEN_TER_AKKOORD", sentForApprovalAt: input.auditSentForApprovalAt },
        }]
      : [],
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-16T12:00:00.000Z",
    sentForApprovalAt: input.sentForApprovalAt,
  };
}

const pending = intervention({
  status: "verzonden_ter_akkoord",
  sentForApprovalAt: "2026-07-16T12:00:00.000Z",
});
assert.equal(isPendingCoachingApprovalStatus(pending.status), true);
assert.equal(canRemindCoachingApproval(manager, pending), true, "Porren moet zichtbaar blijven.");
assert.equal(canRemindCoachingApproval(representative, pending), false, "De begeleide gebruiker mag niet porren.");
assert.equal(canRemindCoachingApproval(serviceOperator, pending), false, "Een niet-workflowbeheerrol mag niet porren.");

const legacyWithAudit = intervention({
  status: "verzonden_ter_akkoord",
  auditSentForApprovalAt: "2026-07-16T12:00:00.000Z",
});
assert.equal(resolveCoachingApprovalSentForApprovalAt(legacyWithAudit), "2026-07-16T12:00:00.000Z");
assert.equal(
  resolveCoachingApprovalSentForApprovalAt({
    sentForApprovalAt: undefined,
    auditTrail: [],
    approvalCreatedAt: "2026-07-16T12:00:00.000Z",
  }),
  "2026-07-16T12:00:00.000Z",
  "Approval.createdAt blijft een fallback voor oudere records."
);

const route = fs.readFileSync("app/api/workflows/coaching/[id]/actions/route.ts", "utf8");
assert.match(route, /remind_approval/);
assert.doesNotMatch(route, /override_approval|COACHING_APPROVAL_OVERRIDE|approved_by_manager_override/);

const workspacePage = fs.readFileSync("components/workspace-pages.tsx", "utf8");
assert.match(
  workspacePage,
  /canRemindCoachingApproval\(user, item\)/,
  "De Mijn Team-tabel moet Porren blijven koppelen aan de bestaande rechtencontrole."
);
assert.doesNotMatch(workspacePage, /overrideApproval|override_approval|canOverrideApproval|isCoachingApprovalOverrideDue/);

for (const locale of ["nl", "fr", "de"]) {
  const translations = fs.readFileSync(`locales/${locale}.json`, "utf8");
  assert.doesNotMatch(translations, /overrideApproval|overrideConfirmation|overrideTooEarly|overrideTimestampMissing/);
}

console.log("Coaching approval visibility en Porren-regels zijn correct.");


const transitionRoute = fs.readFileSync("app/api/workflows/coaching/[id]/transition/route.ts", "utf8");
assert.match(transitionRoute, /"approve" \| "reject"/);
assert.match(transitionRoute, /GELEZEN_NIET_AKKOORD/);
assert.match(transitionRoute, /comment\.length < 3/);

const workflowProvider = fs.readFileSync("components/workflow-provider.tsx", "utf8");
assert.match(workflowProvider, /action: status === "gelezen_akkoord" \? "approve" : "reject"/);
assert.doesNotMatch(workflowProvider, /confirmWorkflowApproval/);

const representativeWorkflow = fs.readFileSync("components/representative-workflow-pages.tsx", "utf8");
assert.match(representativeWorkflow, /await confirmApproval\(approval\.id, status, comment\)/);
assert.match(representativeWorkflow, /disabled=\{!valid \|\| confirming\}/);
