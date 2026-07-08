import assert from "node:assert/strict";

import {
  actionPointScopeLabel,
  canAccessActionPointsOverview,
  canViewScopedActionDefinition,
  splitActionPointSections,
} from "../lib/action-points/visibility";
import { getAvailableDomains } from "../lib/app-switcher";
import { roleTemplates } from "../lib/user-management";
import type { AppModuleConfig, MockUser, Role, ScopedActionDefinition } from "../lib/types";

const activeModules = modules(true);
const inactiveActionPointModules = modules(false);

function modules(actionPointsEnabled: boolean): AppModuleConfig[] {
  return [
    "PLANNING",
    "BEGELEIDINGEN",
    "CONTACTMOMENTEN",
    "RETRAININGEN",
    "SALESTRAININGEN",
    "HULPAANVRAGEN",
    "ACTIEPUNTEN",
    "RAPPORTERING",
  ].map((code) => ({
    id: code,
    code: code as AppModuleConfig["code"],
    name: code,
    enabled: code === "ACTIEPUNTEN" ? actionPointsEnabled : true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

function user(role: Role, input: Partial<MockUser> = {}): MockUser {
  return {
    id: `${role.toLowerCase()}-be`,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
    country: "BE",
    countryAccess: ["BE"],
    language: "nl",
    teamId: role === "SALES_LEADER" || role === "REPRESENTATIVE" ? "team-be-a" : undefined,
    representativeId: role === "REPRESENTATIVE" ? "representative-be" : undefined,
    permissions: { ...roleTemplates[role].permissions },
    ...input,
  };
}

function action(input: Partial<ScopedActionDefinition>): ScopedActionDefinition {
  return {
    id: "action",
    title: "Actiepunt",
    description: "Beschrijving",
    tipsAndTricks: "",
    priority: "normaal",
    scope: "USER",
    scopeKey: "USER:representative-be",
    country: "BE",
    teamId: "team-be-a",
    userId: "representative-be",
    active: true,
    validFrom: "2026-07-01",
    validUntil: "2026-07-20",
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-02T08:00:00.000Z",
    ...input,
  };
}

const globalAction = action({ id: "global", scope: "GLOBAL", scopeKey: "GLOBAL", country: undefined, teamId: undefined, userId: undefined });
const countryBeAction = action({ id: "country-be", scope: "COUNTRY", scopeKey: "COUNTRY:BE", country: "BE", teamId: undefined, userId: undefined });
const countryNlAction = action({ id: "country-nl", scope: "COUNTRY", scopeKey: "COUNTRY:NL", country: "NL", teamId: undefined, userId: undefined });
const teamBeAction = action({ id: "team-be", scope: "TEAM", scopeKey: "TEAM:team-be-a", country: "BE", teamId: "team-be-a", userId: undefined });
const teamOtherAction = action({ id: "team-other", scope: "TEAM", scopeKey: "TEAM:team-be-b", country: "BE", teamId: "team-be-b", userId: undefined });
const personalOwnAction = action({ id: "personal-own", scope: "USER", scopeKey: "USER:representative-be", userId: "representative-be", teamId: "team-be-a" });
const personalOtherTeamAction = action({ id: "personal-other-team", scope: "USER", scopeKey: "USER:rep-other-team", userId: "rep-other-team", teamId: "team-be-b" });
const personalNlAction = action({ id: "personal-nl", scope: "USER", scopeKey: "USER:rep-nl", country: "NL", teamId: "team-nl", userId: "rep-nl" });

const representative = user("REPRESENTATIVE");
assert.equal(canViewScopedActionDefinition(representative, personalOwnAction), true, "Vertegenwoordiger ziet eigen persoonlijke open actiepunten.");
assert.equal(canViewScopedActionDefinition(representative, personalOtherTeamAction), false, "Vertegenwoordiger ziet geen persoonlijke actiepunten van anderen.");
assert.equal(canViewScopedActionDefinition(representative, teamOtherAction), false, "Vertegenwoordiger ziet geen teamactiepunten buiten toegestane scope.");
assert.equal(canViewScopedActionDefinition(representative, globalAction), true, "Vertegenwoordiger ziet globale actiepunten wanneer de module dat ondersteunt.");

const leader = user("SALES_LEADER");
assert.equal(canViewScopedActionDefinition(leader, teamBeAction), true, "Verkoopleider ziet actiepunten voor eigen team.");
assert.equal(canViewScopedActionDefinition(leader, personalOwnAction), true, "Verkoopleider ziet actiepunten voor teamleden.");
assert.equal(canViewScopedActionDefinition(leader, teamOtherAction), false, "Verkoopleider ziet geen actiepunten van andere teams.");

const countryManager = user("COUNTRY_MANAGER", { countryAccess: ["BE"] });
assert.equal(canViewScopedActionDefinition(countryManager, countryBeAction), true, "Country Manager ziet actiepunten binnen toegewezen landenscope.");
assert.equal(canViewScopedActionDefinition(countryManager, countryNlAction), false, "Country Manager ziet geen actiepunten buiten toegewezen landenscope.");

const salesManager = user("SALES_MANAGER", { countryAccess: ["BE"] });
assert.equal(canViewScopedActionDefinition(salesManager, teamBeAction), true, "Sales Manager ziet actiepunten binnen toegewezen landenscope.");
assert.equal(canViewScopedActionDefinition(salesManager, personalNlAction), false, "Sales Manager ziet geen actiepunten buiten toegewezen landenscope.");

const admin = user("ADMIN", { countryAccess: ["BE"] });
assert.equal(canViewScopedActionDefinition(admin, personalOwnAction), true, "Admin ziet actiepunten binnen toegewezen landenscope.");
assert.equal(canViewScopedActionDefinition(admin, personalNlAction), false, "Admin ziet geen actiepunten buiten toegewezen landenscope.");

const superAdmin = user("SUPER_ADMIN", { countryAccess: ["BE", "NL", "DE"] });
assert.deepEqual(
  [globalAction, countryBeAction, countryNlAction, teamBeAction, teamOtherAction, personalOwnAction, personalNlAction]
    .filter((item) => canViewScopedActionDefinition(superAdmin, item))
    .map((item) => item.id),
  ["global", "country-be", "country-nl", "team-be", "team-other", "personal-own", "personal-nl"],
  "Super Admin ziet alle actiepunten."
);

const sections = splitActionPointSections([
  action({ id: "open-later", active: true, validUntil: "2026-08-01" }),
  action({ id: "closed", active: false, updatedAt: "2026-07-10T08:00:00.000Z" }),
  action({ id: "open-sooner", active: true, validUntil: "2026-07-10" }),
]);
assert.deepEqual(sections[0].items.map((item) => item.id), ["open-sooner", "open-later"], "Open actiepunten verschijnen in sectie Open en sorteren stabiel.");
assert.deepEqual(sections[1].items.map((item) => item.id), ["closed"], "Afgesloten actiepunten verschijnen in sectie Afgesloten.");
assert.equal(actionPointScopeLabel("GLOBAL"), "Globaal", "Typebadge Globaal verschijnt correct.");
assert.equal(actionPointScopeLabel("COUNTRY"), "Land", "Typebadge Land verschijnt correct.");
assert.equal(actionPointScopeLabel("TEAM"), "Team", "Typebadge Team verschijnt correct.");
assert.equal(actionPointScopeLabel("USER"), "Persoonlijk", "Typebadge Persoonlijk verschijnt correct.");

assert.equal(canAccessActionPointsOverview(leader, inactiveActionPointModules), false, "Disabled Actiepunten-module blokkeert de pagina.");
const leaderWithoutPreparation = user("SALES_LEADER", { permissions: { ...roleTemplates.SALES_LEADER.permissions, modulePreparation: false } });
assert.equal(canAccessActionPointsOverview(leaderWithoutPreparation, activeModules), false, "User-level override uit werkt correct.");
assert.equal(canAccessActionPointsOverview(leader, activeModules), true, "User-level override aan werkt correct.");

const countryManagerLinks = getAvailableDomains(countryManager, activeModules)
  .find((domain) => domain.key === "coaching")
  ?.links.map((link) => link.key) ?? [];
assert.ok(countryManagerLinks.includes("actionPoints"), "Country Manager role-default toont Actiepunten wanneer de module actief is.");

const disabledLinks = getAvailableDomains(leader, inactiveActionPointModules)
  .find((domain) => domain.key === "coaching")
  ?.links.map((link) => link.key) ?? [];
assert.ok(!disabledLinks.includes("actionPoints"), "Disabled Actiepunten-module verdwijnt uit de navigatie.");

console.log("Actiepunten-overview visibility, secties, badges en module-overrides zijn correct.");
