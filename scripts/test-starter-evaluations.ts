import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appModuleRegistry } from "@/lib/modules";
import { canAccessManagementSection } from "@/lib/management-access";
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
  type StarterEvaluationAnswerType,
  starterEvaluationQuestionSeeds,
  starterEvaluationSectionSeeds,
} from "@/lib/starter-evaluations";
import { fieldForcePermissionKeys, roleTemplates } from "@/lib/user-management";
import type { FieldForcePermissionKey, MockUser, RepresentativeLevel, Role } from "@/lib/types";

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
assert.equal(canAccessManagementSection(mockUser("GROUP_MANAGER"), "starterEvaluations"), true);
assert.ok(appModuleRegistry.some((module) => module.code === "TUSSENTIJDSE_EVALUATIES" && module.routePrefixes.includes("tussentijdse-evaluaties")));
assert.equal(coachingModuleNavigationRules.TUSSENTIJDSE_EVALUATIES.menuPermission, "menu.coaching.starterEvaluations");
assert.ok(fieldForcePermissionKeys.includes("menu.coaching.starterEvaluations"));
assert.ok(fieldForcePermissionKeys.includes("starterEvaluationsExecute"));
assert.ok(fieldForcePermissionKeys.includes("starterEvaluationsManage"));
assert.equal(roleTemplates.REPRESENTATIVE.permissions["menu.coaching.starterEvaluations"], true);
assert.equal(roleTemplates.REPRESENTATIVE.permissions.starterEvaluationsExecute, false);
assert.equal(roleTemplates.SERVICE_OPERATOR.permissions.starterEvaluationsExecute, false);
assert.equal(roleTemplates.SALES_LEADER.permissions["menu.coaching.starterEvaluations"], true);
assert.equal(roleTemplates.SALES_LEADER.permissions.starterEvaluationsExecute, true);
assert.equal(roleTemplates.SALES_LEADER.permissions.starterEvaluationsManage, false);
assert.equal(roleTemplates.SALES_MANAGER.permissions.starterEvaluationsManage, true);

const salesLeader = mockUser("SALES_LEADER", { teamId: "team-a" });
const countryManager = mockUser("COUNTRY_MANAGER", { country: "NL" });
const representative = mockUser("REPRESENTATIVE", { teamId: "team-a" });
const starterInTeam = { id: "starter-1", role: "REPRESENTATIVE", country: "BE", teamId: "team-a" };
const starterOtherTeam = { id: "starter-2", role: "REPRESENTATIVE", country: "BE", teamId: "team-b" };
const starterInCountry = { id: "starter-3", role: "REPRESENTATIVE", country: "NL", teamId: "team-c" };
const nonRepresentativeInTeam = { id: "leader-1", role: "SALES_LEADER", country: "BE", teamId: "team-a" };

assert.equal(canStartStarterEvaluation(salesLeader), true);
assert.equal(canStartStarterEvaluation(representative), false);
assert.equal(canStartStarterEvaluationForRepresentative(salesLeader, starterInTeam), true);
assert.equal(canStartStarterEvaluationForRepresentative(salesLeader, starterOtherTeam), false);
assert.equal(canStartStarterEvaluationForRepresentative(countryManager, starterInCountry), true);
assert.equal(canStartStarterEvaluationForRepresentative(countryManager, starterInTeam), false);
assert.equal(canStartStarterEvaluationForRepresentative(salesLeader, nonRepresentativeInTeam), false);

for (const representativeLevel of ["STARTER", "SALES_EXECUTIVE", "PROFESSIONAL", "EXPERT"] satisfies RepresentativeLevel[]) {
  assert.equal(
    canStartStarterEvaluationForRepresentative(salesLeader, { ...starterInTeam, representativeLevel }),
    true,
    `Manuele tussentijdse evaluatie mag niet filteren op niveau ${representativeLevel}.`
  );
}

assert.equal(
  canStartStarterEvaluationForRepresentative(mockUser("SALES_MANAGER", { countryAccess: ["NL"] }), starterInCountry),
  true
);
assert.equal(
  canStartStarterEvaluationForRepresentative(mockUser("SALES_MANAGER", { countryAccess: ["DE"] }), starterInCountry),
  false
);
assert.equal(canStartStarterEvaluationForRepresentative(mockUser("ADMIN", { country: "BE", countryAccess: ["NL"] }), starterInCountry), true);
assert.equal(canStartStarterEvaluationForRepresentative(mockUser("GROUP_MANAGER"), starterInCountry), true);
assert.equal(canStartStarterEvaluationForRepresentative(mockUser("SUPER_ADMIN"), starterInCountry), true);
assert.equal(parseStarterEvaluationDateInput("2026-07-14").toISOString().slice(0, 10), "2026-07-14");
assert.equal(formatStarterEvaluationDateInput(new Date("2026-07-14T22:00:00.000Z")), "2026-07-14");
assert.throws(() => parseStarterEvaluationDateInput("14/07/2026"), /ongeldig/);
const supportedAnswerType: StarterEvaluationAnswerType = "MULTI_CHOICE";
assert.equal(supportedAnswerType, "MULTI_CHOICE");
const repairMigration = readFileSync("prisma/migrations/0036_starter_evaluation_question_schema_repair/migration.sql", "utf8");
for (const expectedSql of [
  "ADD COLUMN IF NOT EXISTS `createdById`",
  "ADD COLUMN IF NOT EXISTS `updatedById`",
  "ADD COLUMN IF NOT EXISTS `optionsJson`",
  "ADD COLUMN IF NOT EXISTS `linkedCriterionType`",
  "CREATE TABLE IF NOT EXISTS `StarterEvaluationQuestionScopeLink`",
  "StarterEvaluationQuestion_createdById_fkey",
  "ON DELETE SET NULL",
]) {
  assert.ok(repairMigration.includes(expectedSql), `Reparatiemigratie mist ${expectedSql}.`);
}
const defaultQuestionSeedMigration = readFileSync("prisma/migrations/0037_seed_starter_evaluation_default_questions/migration.sql", "utf8");
for (const expectedSql of [
  "INSERT INTO `StarterEvaluationSection`",
  "INSERT INTO `StarterEvaluationQuestion`",
  "INSERT INTO `StarterEvaluationQuestionScopeLink`",
  "job_expectations_1",
  "next_period_action_points",
  "general_evaluation_summary",
]) {
  assert.ok(defaultQuestionSeedMigration.includes(expectedSql), `Standaardvragenmigratie mist ${expectedSql}.`);
}
const manualStartRepairMigration = readFileSync("prisma/migrations/0038_starter_evaluation_manual_start_schema_repair/migration.sql", "utf8");
for (const expectedSql of [
  "ADD COLUMN IF NOT EXISTS `manualStartedById`",
  "ADD COLUMN IF NOT EXISTS `manualStartedAt`",
  "StarterEvaluation_manualStartedById_fkey",
  "ON DELETE SET NULL",
]) {
  assert.ok(manualStartRepairMigration.includes(expectedSql), `Manuele-start reparatiemigratie mist ${expectedSql}.`);
}
const manualMomentRepairMigration = readFileSync("prisma/migrations/0039_starter_evaluation_manual_moment_nullable/migration.sql", "utf8");
assert.ok(
  manualMomentRepairMigration.includes("MODIFY COLUMN `moment` ENUM('MONTH_1_5','MONTH_3','MONTH_5') NULL"),
  "Manuele evaluaties zonder startermoment moeten een nullable moment-kolom houden."
);

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
