import assert from "node:assert/strict";

import {
  approvalReflectionErrors,
  approvalHasCompletedReflection,
  isApprovalReflectionComplete,
  sanitizeApprovalReflection,
} from "../lib/coaching/approval-reflection";

assert.equal(isApprovalReflectionComplete({
  reflectionKpiHtml: "",
  reflectionLearningHtml: "<p><br></p>",
  reflectionGoalHtml: "<p>&nbsp;</p>",
}), false);

assert.deepEqual(approvalReflectionErrors({
  reflectionKpiHtml: "<p>   </p>",
  reflectionLearningHtml: "<strong></strong>",
  reflectionGoalHtml: "<ul><li><br></li></ul>",
}), {
  reflectionKpiHtml: true,
  reflectionLearningHtml: true,
  reflectionGoalHtml: true,
});

const sanitized = sanitizeApprovalReflection({
  reflectionKpiHtml: "<p><strong>KPI omzet</strong></p><script>alert(1)</script>",
  reflectionLearningHtml: "<p onclick=\"alert(1)\">Open vragen stellen</p>",
  reflectionGoalHtml: "<ul><li>Drie demo's plannen</li></ul>",
});

assert.equal(sanitized.reflectionKpiHtml.includes("<script>"), false);
assert.equal(sanitized.reflectionLearningHtml.includes("onclick"), false);
assert.equal(isApprovalReflectionComplete(sanitized), true);
assert.equal(approvalHasCompletedReflection({
  ...sanitized,
  reflectionCompletedAt: "2026-07-14T10:00:00.000Z",
}), true);
assert.equal(approvalHasCompletedReflection(sanitized), false);

console.log("Approval-reflectie valideert lege WYSIWYG, sanitizet HTML en herkent complete antwoorden.");
