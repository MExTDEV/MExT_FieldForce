import assert from "node:assert/strict";
import fs from "node:fs";

import {
  isCoachingApprovalOverrideDue,
  latestCoachingApprovalOverrideSentAt,
} from "../lib/coaching/schedule";
import { calculateOfficialCoachingScore } from "../lib/coaching/score";
import {
  canOverrideCoachingApproval,
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

const sentForApprovalAt = "2026-03-15T10:00:00.000Z";
assert.equal(
  isCoachingApprovalOverrideDue({ sentForApprovalAt, now: new Date("2026-03-29T08:59:59.999Z") }),
  false,
  "De override mag in Europe/Brussels niet voor veertien kalenderdagen beschikbaar zijn."
);
assert.equal(
  isCoachingApprovalOverrideDue({ sentForApprovalAt, now: new Date("2026-03-29T09:00:00.000Z") }),
  true,
  "De override moet vanaf hetzelfde lokale uur na veertien kalenderdagen beschikbaar zijn."
);
assert.equal(isCoachingApprovalOverrideDue({ sentForApprovalAt: undefined }), false);
assert.equal(
  latestCoachingApprovalOverrideSentAt(new Date("2026-03-29T09:00:00.000Z")).toISOString(),
  sentForApprovalAt
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

const lessThanFourteenDays = intervention({
  status: "verzonden_ter_akkoord",
  sentForApprovalAt: "2026-07-16T12:00:00.000Z",
});
assert.equal(isPendingCoachingApprovalStatus(lessThanFourteenDays.status), true);
assert.equal(canRemindCoachingApproval(manager, lessThanFourteenDays), true, "Porren moet meteen zichtbaar zijn.");
assert.equal(
  canOverrideCoachingApproval({
    currentUser: manager,
    intervention: lessThanFourteenDays,
    now: new Date("2026-07-30T11:59:59.999Z"),
    isDue: isCoachingApprovalOverrideDue,
  }),
  false,
  "Akkoord zetten mag niet voor exact 14 kalenderdagen zichtbaar zijn."
);
assert.equal(
  canOverrideCoachingApproval({
    currentUser: manager,
    intervention: lessThanFourteenDays,
    now: new Date("2026-07-30T12:00:00.000Z"),
    isDue: isCoachingApprovalOverrideDue,
  }),
  true,
  "Akkoord zetten moet exact na 14 kalenderdagen zichtbaar zijn."
);
assert.equal(
  canOverrideCoachingApproval({
    currentUser: manager,
    intervention: lessThanFourteenDays,
    now: new Date("2026-08-11T08:00:00.000Z"),
    isDue: isCoachingApprovalOverrideDue,
  }),
  true,
  "De begeleidingen van 15/16 juli moeten op 11 augustus overrulbaar zijn."
);

const wachtOpAkkoord = intervention({
  status: "wacht_op_akkoord",
  sentForApprovalAt: "2026-07-15T08:00:00.000Z",
});
assert.equal(canRemindCoachingApproval(manager, wachtOpAkkoord), true, "De oudere pending status mag de knop Porren niet verbergen.");
assert.equal(
  canOverrideCoachingApproval({
    currentUser: manager,
    intervention: wachtOpAkkoord,
    now: new Date("2026-08-11T08:00:00.000Z"),
    isDue: isCoachingApprovalOverrideDue,
  }),
  true,
  "De oudere pending status moet Akkoord zetten tonen wanneer de termijn verstreken is."
);

const otherStatus = intervention({ status: "voltooid", sentForApprovalAt: "2026-07-15T08:00:00.000Z" });
assert.equal(canRemindCoachingApproval(manager, otherStatus), false);
assert.equal(
  canOverrideCoachingApproval({
    currentUser: manager,
    intervention: otherStatus,
    now: new Date("2026-08-11T08:00:00.000Z"),
    isDue: isCoachingApprovalOverrideDue,
  }),
  false
);

const legacyWithAudit = intervention({
  status: "verzonden_ter_akkoord",
  auditSentForApprovalAt: "2026-07-16T12:00:00.000Z",
});
assert.equal(resolveCoachingApprovalSentForApprovalAt(legacyWithAudit), "2026-07-16T12:00:00.000Z");
assert.equal(
  canOverrideCoachingApproval({
    currentUser: manager,
    intervention: legacyWithAudit,
    now: new Date("2026-08-11T08:00:00.000Z"),
    isDue: isCoachingApprovalOverrideDue,
  }),
  true,
  "Een bestaand record zonder nieuw datumveld moet via betrouwbare historiek behandeld worden."
);
assert.equal(
  resolveCoachingApprovalSentForApprovalAt({
    sentForApprovalAt: undefined,
    auditTrail: [],
    approvalCreatedAt: "2026-07-16T12:00:00.000Z",
  }),
  "2026-07-16T12:00:00.000Z",
  "Approval.createdAt is de laatste fallback voor oudere records zonder verzendveld."
);

assert.equal(canRemindCoachingApproval(representative, lessThanFourteenDays), false, "De begeleide gebruiker mag zichzelf niet porren.");
assert.equal(canRemindCoachingApproval(serviceOperator, lessThanFourteenDays), false, "Een niet-workflowbeheerrol mag niet porren.");
assert.equal(
  canOverrideCoachingApproval({
    currentUser: representative,
    intervention: lessThanFourteenDays,
    now: new Date("2026-08-11T08:00:00.000Z"),
    isDue: isCoachingApprovalOverrideDue,
  }),
  false,
  "De begeleide gebruiker mag de manager-override niet uitvoeren."
);

const route = fs.readFileSync("app/api/workflows/coaching/[id]/actions/route.ts", "utf8");
assert.match(route, /isPendingCoachingApprovalStatus\(coaching\.status\)/, "De API moet pending statussen centraal controleren.");
assert.match(route, /status:\s*\{\s*in:\s*\["VERZONDEN_TER_AKKOORD", "WACHT_OP_AKKOORD"\]\s*\}/, "De override moet beide interne pending statussen server-side toestaan.");
assert.match(route, /coaching\.approved_by_manager_override/, "De override moet expliciet in de historiek terechtkomen.");
assert.doesNotMatch(route, /approvedByRepAt|approvedByRepId/, "De override mag niet doen alsof de begeleide gebruiker zelf akkoord gaf.");

const workspacePage = fs.readFileSync("components/workspace-pages.tsx", "utf8");
assert.match(
  workspacePage,
  /\.\.\.rawItems\.filter\(\(item\) => !item\.intervention\),[\s\S]*\.\.\.rawItems\.filter\(\(item\) => item\.intervention\),/,
  "De Mijn Team-tabel moet workflowrecords met acties laten winnen van historische scorekopieën."
);

console.log("Coaching score-, termijn-, visibility- en override-autorisatieregels zijn correct.");
