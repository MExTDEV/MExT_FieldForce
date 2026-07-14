import assert from "node:assert/strict";
import { appModuleRegistry } from "@/lib/modules";
import { coachingModuleNavigationRules } from "@/lib/navigation-access";
import {
  calculateStarterEvaluationMilestones,
  dueStarterEvaluationMoments,
  momentsJson,
  parseMomentsJson,
  scopeApplies,
  scopePriority,
  starterEvaluationQuestionSeeds,
  starterEvaluationSectionSeeds,
} from "@/lib/starter-evaluations";
import { fieldForcePermissionKeys, roleTemplates } from "@/lib/user-management";

const start = new Date("2026-01-15T12:00:00.000Z");
const milestones = calculateStarterEvaluationMilestones(start);

assert.equal(milestones.MONTH_1_5.toISOString().slice(0, 10), "2026-02-26");
assert.equal(milestones.MONTH_3.toISOString().slice(0, 10), "2026-04-15");
assert.equal(milestones.MONTH_5.toISOString().slice(0, 10), "2026-06-15");

assert.deepEqual(dueStarterEvaluationMoments(start, new Date("2026-02-25T23:00:00.000Z")), []);
assert.deepEqual(dueStarterEvaluationMoments(start, new Date("2026-02-26T00:00:00.000Z")), ["MONTH_1_5"]);
assert.deepEqual(dueStarterEvaluationMoments(start, new Date("2026-06-16T00:00:00.000Z")), ["MONTH_1_5", "MONTH_3", "MONTH_5"]);

assert.deepEqual(parseMomentsJson(momentsJson(["MONTH_1_5", "MONTH_3"])), ["MONTH_1_5", "MONTH_3"]);
assert.equal(scopePriority("GLOBAL") < scopePriority("USER"), true);
assert.equal(scopeApplies({ scopeType: "GLOBAL", scopeKey: "GLOBAL" }, { country: "BE", teamId: "team-1", userId: "user-1" }), true);
assert.equal(scopeApplies({ scopeType: "COUNTRY", scopeKey: "COUNTRY:BE" }, { country: "BE", teamId: "team-1", userId: "user-1" }), true);
assert.equal(scopeApplies({ scopeType: "TEAM", scopeKey: "TEAM:team-1" }, { country: "BE", teamId: "team-1", userId: "user-1" }), true);
assert.equal(scopeApplies({ scopeType: "USER", scopeKey: "USER:user-1" }, { country: "BE", teamId: "team-1", userId: "user-1" }), true);
assert.equal(scopeApplies({ scopeType: "COUNTRY", scopeKey: "COUNTRY:NL" }, { country: "BE", teamId: "team-1", userId: "user-1" }), false);

assert.ok(starterEvaluationSectionSeeds.some((section) => section.code === "measure" && section.active === false));
assert.ok(starterEvaluationQuestionSeeds.some((question) => question.key === "next_period_action_points" && question.answerType === "ACTION_POINTS"));
assert.ok(appModuleRegistry.some((module) => module.code === "TUSSENTIJDSE_EVALUATIES" && module.routePrefixes.includes("tussentijdse-evaluaties")));
assert.equal(coachingModuleNavigationRules.TUSSENTIJDSE_EVALUATIES.menuPermission, "menu.coaching.starterEvaluations");
assert.ok(fieldForcePermissionKeys.includes("menu.coaching.starterEvaluations"));
assert.equal(roleTemplates.REPRESENTATIVE.permissions["menu.coaching.starterEvaluations"], true);
assert.equal(roleTemplates.SALES_LEADER.permissions["menu.coaching.starterEvaluations"], true);

console.log("Tussentijdse evaluaties: mijlpalen, scopes, seed en moduletoegang gevalideerd.");
