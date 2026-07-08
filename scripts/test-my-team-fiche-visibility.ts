import assert from "node:assert/strict";
import {
  canViewFicheSection,
  getFicheTimelineItemTypes,
  getVisibleFicheSections,
  getVisibleFicheTabs,
} from "../lib/my-team-fiche-visibility";
import { representatives } from "../lib/mock-data";
import type { AppModuleCode, AppModuleConfig, FieldForcePermissionKey, MockUser, Role } from "../lib/types";
import { roleTemplates } from "../lib/user-management";

const moduleCodes: AppModuleCode[] = [
  "PLANNING",
  "BEGELEIDINGEN",
  "CONTACTMOMENTEN",
  "RETRAININGEN",
  "SALESTRAININGEN",
  "HULPAANVRAGEN",
  "ACTIEPUNTEN",
  "RAPPORTERING",
];

function modules(disabled: AppModuleCode[] = []): AppModuleConfig[] {
  return moduleCodes.map((code) => ({
    id: code,
    code,
    name: code,
    enabled: !disabled.includes(code),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

function user(
  role: Role,
  overrides: Partial<Record<FieldForcePermissionKey, boolean>> = {}
): MockUser {
  return {
    id: `test-${role}`,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
    country: "BE",
    countryAccess: role === "SALES_MANAGER" ? ["BE", "NL"] : undefined,
    language: "nl",
    teamId: role === "SALES_LEADER" || role === "REPRESENTATIVE" ? "be-1" : undefined,
    representativeId: role === "REPRESENTATIVE" ? "rep-1" : undefined,
    permissions: { ...roleTemplates[role].permissions, ...overrides },
  };
}

const repBeTeam = representatives.find((item) => item.id === "rep-1")!;
const repNl = representatives.find((item) => item.id === "rep-6")!;
const repDe = representatives.find((item) => item.id === "rep-9")!;
const allModules = modules();

const leader = user("SALES_LEADER");
assert.equal(canViewFicheSection("coachings", { user: leader, representative: repBeTeam, modules: allModules }), true);
assert.equal(canViewFicheSection("actionPoints", { user: leader, representative: repBeTeam, modules: allModules }), true);
assert.equal(canViewFicheSection("performanceCircle", { user: leader, representative: repBeTeam, modules: allModules }), true);
assert.equal(canViewFicheSection("kpis", { user: leader, representative: repBeTeam, modules: allModules }), true);
assert.equal(canViewFicheSection("coachings", { user: leader, representative: repNl, modules: allModules }), false, "Een verkoopleider mag geen fiche-secties zien buiten het eigen team.");

const noCoachingModule = modules(["BEGELEIDINGEN"]);
assert.equal(canViewFicheSection("coachings", { user: leader, representative: repBeTeam, modules: noCoachingModule }), false);
assert.equal(canViewFicheSection("personalCriteria", { user: leader, representative: repBeTeam, modules: noCoachingModule }), false);
assert.equal(canViewFicheSection("actionPoints", { user: leader, representative: repBeTeam, modules: noCoachingModule }), true, "Actiepunten blijven zichtbaar wanneer alleen Begeleidingen uit staat.");

const noCoachingPermission = user("SALES_LEADER", { moduleVisitRecord: false });
assert.equal(canViewFicheSection("coachings", { user: noCoachingPermission, representative: repBeTeam, modules: allModules }), false);
assert.ok(!getVisibleFicheTabs({ user: noCoachingPermission, representative: repBeTeam, modules: allModules }).some((tab) => tab.id === "coachings"));

const noPreparationPermission = user("SALES_LEADER", { modulePreparation: false });
assert.equal(canViewFicheSection("actionPoints", { user: noPreparationPermission, representative: repBeTeam, modules: allModules }), false);
assert.equal(canViewFicheSection("contactMoments", { user: noPreparationPermission, representative: repBeTeam, modules: allModules }), false);
assert.equal(canViewFicheSection("retrainings", { user: noPreparationPermission, representative: repBeTeam, modules: allModules }), false);

const noReportingModule = modules(["RAPPORTERING"]);
assert.equal(canViewFicheSection("performanceCircle", { user: leader, representative: repBeTeam, modules: noReportingModule }), false);
assert.equal(canViewFicheSection("kpis", { user: leader, representative: repBeTeam, modules: noReportingModule }), false);
assert.equal(canViewFicheSection("productAnalysis", { user: leader, representative: repBeTeam, modules: noReportingModule }), false);

const noPerformanceView = user("SALES_LEADER", { performanceView: false });
assert.equal(canViewFicheSection("performanceCircle", { user: noPerformanceView, representative: repBeTeam, modules: allModules }), false);
assert.equal(canViewFicheSection("kpis", { user: noPerformanceView, representative: repBeTeam, modules: allModules }), true, "KPI-zichtbaarheid volgt performanceScoresView, niet performanceView.");

const salesManager = user("SALES_MANAGER");
assert.equal(canViewFicheSection("overview", { user: salesManager, representative: repNl, modules: allModules }), true);
assert.equal(canViewFicheSection("overview", { user: salesManager, representative: repDe, modules: allModules }), false, "Sales Manager ziet geen landen buiten countryAccess.");

const sectionsWithoutUndefinedModules = getVisibleFicheSections({
  user: leader,
  representative: repBeTeam,
  modules: modules(["CONTACTMOMENTEN", "HULPAANVRAGEN"]),
});
const timelineTypes = getFicheTimelineItemTypes(sectionsWithoutUndefinedModules);
assert.ok(!timelineTypes.includes("contactmoment"), "Timeline mag geen contactmoment-data tonen als Contactmomenten uit staat.");
assert.ok(!timelineTypes.includes("hulpaanvraag"), "Timeline mag geen hulpaanvraag-data tonen als Hulpaanvragen uit staat.");
assert.ok(timelineTypes.includes("begeleiding"), "Toegelaten Begeleidingen blijven in de timeline zichtbaar.");

console.log("Mijn Team fiche-zichtbaarheid gecontroleerd voor modules, overrides en scope.");
