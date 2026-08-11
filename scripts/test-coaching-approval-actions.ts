import assert from "node:assert/strict";

import {
  isCoachingApprovalOverrideDue,
  latestCoachingApprovalOverrideSentAt,
} from "../lib/coaching/schedule";
import { calculateOfficialCoachingScore } from "../lib/coaching/score";
import { isCoachingApprovalManagerRole } from "../lib/coaching/access";

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
  isCoachingApprovalOverrideDue({ sentForApprovalAt, now: new Date("2026-03-29T09:59:59.999Z") }),
  false,
  "De override mag niet voor veertien volledige dagen beschikbaar zijn."
);
assert.equal(
  isCoachingApprovalOverrideDue({ sentForApprovalAt, now: new Date("2026-03-29T10:00:00.000Z") }),
  true,
  "De override moet vanaf exact veertien volledige dagen beschikbaar zijn."
);
assert.equal(isCoachingApprovalOverrideDue({ sentForApprovalAt: undefined }), false);
assert.equal(
  latestCoachingApprovalOverrideSentAt(new Date("2026-03-29T10:00:00.000Z")).toISOString(),
  sentForApprovalAt
);

assert.equal(isCoachingApprovalManagerRole("REPRESENTATIVE"), false);
assert.equal(isCoachingApprovalManagerRole("SERVICE_OPERATOR"), false);
assert.equal(isCoachingApprovalManagerRole("SALES_LEADER"), true);
assert.equal(isCoachingApprovalManagerRole("ADMIN"), true);
assert.equal(isCoachingApprovalManagerRole("SUPER_ADMIN"), true);

console.log("Coaching score-, termijn- en override-autorisatieregels zijn correct.");
