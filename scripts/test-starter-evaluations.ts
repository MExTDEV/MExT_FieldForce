import assert from "node:assert/strict";
import { appModuleRegistry } from "@/lib/modules";
import { coachingModuleNavigationRules } from "@/lib/navigation-access";
import {
  calculateStarterEvaluationMilestones,
  canStartStarterEvaluation,
  canStartStarterEvaluationForRepresentative,
  dueStarterEvaluationMoments,
  formatStarterEvaluationDateInput,
  momentsJson,
  parseMomentsJson,
  parseStarterEvaluationDateInput,
  scopeApplies,
  scopePriority,
  starterEvaluationQuestionSeeds,
  starterEvaluationSectionSeeds,
} from "@/lib/starter-evaluations";
import { fieldForcePermissionKeys, roleTemplates } from "@/lib/user-management";
import type { FieldForcePermissionKey, MockUser, Role } from "@/lib/types";

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
assert.ok(starterEvaluationQuestionSeeds.some((question) => question.textNl === "Stiptheid"));
assert.ok(starterEvaluationQuestionSeeds.some((question) => question.textNl === "Voorbereiding"));
assert.ok(starterEvaluationQuestionSeeds.some((question) => question.textNl === "Gemiddelde omzet per dag"));
assert.ok(starterEvaluationQuestionSeeds.some((question) => question.textNl === "Conclusies uit begeleidingen"));
assert.ok(starterEvaluationQuestionSeeds.some((question) => question.textNl === "Zijn de voorgaande werkpunten verbeterd?"));
assert.ok(starterEvaluationQuestionSeeds.every((question) => question.scopeType === undefined || ["GLOBAL", "COUNTRY", "TEAM", "USER"].includes(question.scopeType)));
assert.ok(appModuleRegistry.some((module) => module.code === "TUSSENTIJDSE_EVALUATIES" && module.routePrefixes.includes("tussentijdse-evaluaties")));
assert.equal(coachingModuleNavigationRules.TUSSENTIJDSE_EVALUATIES.menuPermission, "menu.coaching.starterEvaluations");
assert.ok(fieldForcePermissionKeys.includes("menu.coaching.starterEvaluations"));
assert.equal(roleTemplates.REPRESENTATIVE.permissions["menu.coaching.starterEvaluations"], true);
assert.equal(roleTemplates.SALES_LEADER.permissions["menu.coaching.starterEvaluations"], true);

const salesLeader = mockUser("SALES_LEADER", { teamId: "team-a" });
const countryManager = mockUser("COUNTRY_MANAGER", { country: "NL" });
const representative = mockUser("REPRESENTATIVE", { teamId: "team-a" });
const starterInTeam = { id: "starter-1", role: "REPRESENTATIVE", country: "BE", teamId: "team-a" };
const starterOtherTeam = { id: "starter-2", role: "REPRESENTATIVE", country: "BE", teamId: "team-b" };
const starterInCountry = { id: "starter-3", role: "REPRESENTATIVE", country: "NL", teamId: "team-c" };

assert.equal(canStartStarterEvaluation(salesLeader), true);
assert.equal(canStartStarterEvaluation(representative), false);
assert.equal(canStartStarterEvaluationForRepresentative(salesLeader, starterInTeam), true);
assert.equal(canStartStarterEvaluationForRepresentative(salesLeader, starterOtherTeam), false);
assert.equal(canStartStarterEvaluationForRepresentative(countryManager, starterInCountry), true);
assert.equal(canStartStarterEvaluationForRepresentative(countryManager, starterInTeam), false);
assert.equal(parseStarterEvaluationDateInput("2026-07-14").toISOString().slice(0, 10), "2026-07-14");
assert.equal(formatStarterEvaluationDateInput(new Date("2026-07-14T22:00:00.000Z")), "2026-07-14");
assert.throws(() => parseStarterEvaluationDateInput("14/07/2026"), /ongeldig/);

console.log("Tussentijdse evaluaties: mijlpalen, scopes, seed, moduletoegang en manuele start gevalideerd.");

function mockUser(role: Role, patch: Partial<MockUser> = {}): MockUser {
  const permissions = fieldForcePermissionKeys.reduce(
    (result, key) => ({ ...result, [key]: true }),
    {} as Record<FieldForcePermissionKey, boolean>
  );
  return {
    id: `${role.toLowerCase()}-1`,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
    country: "BE",
    countryAccess: ["BE"],
    language: "nl",
    permissions,
    ...patch,
  };
}
