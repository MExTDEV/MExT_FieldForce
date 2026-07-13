import assert from "node:assert/strict";

import {
  actionPointScopeLabel,
  canAccessActionPointsOverview,
  canCloseConcreteActionPoint,
  canCreateActionPointDefinition,
  canManageActionPointDefinitions,
  canManageScopedActionDefinition,
  canViewActionPointUserTab,
  canViewScopedActionDefinition,
  groupActionPointsByRepresentative,
  splitActionPointSections,
  type ActionPointOverviewItem,
} from "../lib/action-points/visibility";
import { getAvailableDomains } from "../lib/app-switcher";
import { isBlankRichText, richTextToPlainText, richTextToStructuredPlainText, sanitizeRichText } from "../lib/rich-text";
import { roleTemplates } from "../lib/user-management";
import type { AppModuleConfig, ManagedUser, MockUser, Representative, Role } from "../lib/types";

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

function action(input: Partial<ActionPointOverviewItem>): ActionPointOverviewItem {
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
    validFrom: "2000-01-01",
    validUntil: "2099-12-31",
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-02T08:00:00.000Z",
    ...input,
  };
}

function actionRepresentative(input: Partial<Representative>): Representative {
  return {
    id: "representative-be",
    firstName: "Rita",
    lastName: "Peeters",
    initials: "RP",
    country: "BE",
    team: "Team BE A",
    teamId: "team-be-a",
    level: "Vertegenwoordiger",
    levelColor: "bg-sky-100 text-sky-800",
    lastCoaching: "Nog niet",
    openActions: 0,
    email: "rita@example.test",
    phone: "",
    kpis: [],
    ...input,
  };
}

function managedUser(input: Partial<ManagedUser>): ManagedUser {
  return {
    id: "user-be",
    firstName: "Rita",
    lastName: "Peeters",
    email: "rita@example.test",
    mobile: "",
    language: "nl",
    country: "BE",
    countryAccess: ["BE"],
    teamId: "team-be-a",
    teamName: "Team BE A",
    role: "REPRESENTATIVE",
    representativeLevel: "SALES_EXECUTIVE",
    teamSupervisor: false,
    branchNumber: "",
    active: true,
    avatarUrl: "",
    permissions: { ...roleTemplates.REPRESENTATIVE.permissions },
    representativeId: "representative-be",
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
assert.equal(canCreateActionPointDefinition(representative), false, "Vertegenwoordiger kan geen actiepuntdefinities aanmaken.");
assert.equal(canManageActionPointDefinitions(representative), false, "Vertegenwoordiger kan geen actiepuntdefinities beheren.");
assert.equal(canCloseConcreteActionPoint(representative), false, "Vertegenwoordiger kan geen actiepunten sluiten.");
assert.equal(canViewScopedActionDefinition(representative, personalOwnAction), true, "Vertegenwoordiger ziet eigen persoonlijke open actiepunten.");
assert.equal(canViewScopedActionDefinition(representative, personalOtherTeamAction), false, "Vertegenwoordiger ziet geen persoonlijke actiepunten van anderen.");
assert.equal(canViewScopedActionDefinition(representative, teamOtherAction), false, "Vertegenwoordiger ziet geen teamactiepunten buiten toegestane scope.");
assert.equal(canViewScopedActionDefinition(representative, globalAction), true, "Vertegenwoordiger ziet globale actiepunten wanneer de module dat ondersteunt.");
assert.equal(canViewActionPointUserTab(representative), false, "Vertegenwoordiger ziet geen Gebruikers-tab in Actiepunten.");

const leader = user("SALES_LEADER");
assert.equal(canCreateActionPointDefinition(leader), true, "Verkoopleider kan persoonlijke actiepunten aanmaken.");
assert.equal(canCloseConcreteActionPoint(leader), true, "Verkoopleider kan concrete actiepunten sluiten met sluitpermissie.");
assert.equal(
  canManageScopedActionDefinition(leader, action({ id: "leader-owned", scope: "USER", teamId: "team-be-a", createdById: leader.id })),
  true,
  "Verkoopleider beheert eigen persoonlijke actiepunten binnen het eigen team."
);
assert.equal(
  canManageScopedActionDefinition(leader, action({ id: "leader-team", scope: "TEAM", teamId: "team-be-a", createdById: leader.id })),
  false,
  "Verkoopleider beheert geen teamactiepunten."
);
assert.equal(canViewScopedActionDefinition(leader, teamBeAction), true, "Verkoopleider ziet actiepunten voor eigen team.");
assert.equal(canViewScopedActionDefinition(leader, personalOwnAction), true, "Verkoopleider ziet actiepunten voor teamleden.");
assert.equal(canViewScopedActionDefinition(leader, teamOtherAction), false, "Verkoopleider ziet geen actiepunten van andere teams.");
assert.equal(canViewActionPointUserTab(leader), true, "Verkoopleider behoudt de Gebruikers-tab in Actiepunten.");

const countryManager = user("COUNTRY_MANAGER", { countryAccess: ["BE"] });
assert.equal(canCreateActionPointDefinition(countryManager), true, "Country Manager kan actiepuntdefinities aanmaken.");
assert.equal(canCloseConcreteActionPoint(countryManager), true, "Country Manager kan concrete actiepunten sluiten met sluitpermissie.");
assert.equal(canManageScopedActionDefinition(countryManager, countryBeAction), true, "Country Manager beheert actiepunten binnen eigen landenscope.");
assert.equal(canManageScopedActionDefinition(countryManager, globalAction), false, "Country Manager beheert geen globale actiepunten.");
assert.equal(canViewScopedActionDefinition(countryManager, countryBeAction), true, "Country Manager ziet actiepunten binnen toegewezen landenscope.");
assert.equal(canViewScopedActionDefinition(countryManager, countryNlAction), false, "Country Manager ziet geen actiepunten buiten toegewezen landenscope.");

const salesManager = user("SALES_MANAGER", { countryAccess: ["BE"] });
assert.equal(canCloseConcreteActionPoint(salesManager), false, "Sales Manager krijgt geen standaard sluitrecht voor actiepunten.");
assert.equal(canViewScopedActionDefinition(salesManager, teamBeAction), true, "Sales Manager ziet actiepunten binnen toegewezen landenscope.");
assert.equal(canViewScopedActionDefinition(salesManager, personalNlAction), false, "Sales Manager ziet geen actiepunten buiten toegewezen landenscope.");

const admin = user("ADMIN", { countryAccess: ["BE"] });
assert.equal(canCloseConcreteActionPoint(admin), true, "Admin kan concrete actiepunten sluiten met sluitpermissie.");
assert.equal(canManageScopedActionDefinition(admin, globalAction), true, "Admin kan globale actiepunten beheren.");
assert.equal(canViewScopedActionDefinition(admin, personalOwnAction), true, "Admin ziet actiepunten binnen toegewezen landenscope.");
assert.equal(canViewScopedActionDefinition(admin, personalNlAction), false, "Admin ziet geen actiepunten buiten toegewezen landenscope.");

const superAdmin = user("SUPER_ADMIN", { countryAccess: ["BE", "NL", "DE"] });
assert.equal(canCloseConcreteActionPoint(superAdmin), true, "Super Admin kan concrete actiepunten sluiten.");
assert.deepEqual(
  [globalAction, countryBeAction, countryNlAction, teamBeAction, teamOtherAction, personalOwnAction, personalNlAction]
    .filter((item) => canViewScopedActionDefinition(superAdmin, item))
    .map((item) => item.id),
  ["global", "country-be", "country-nl", "team-be", "team-other", "personal-own", "personal-nl"],
  "Super Admin ziet alle actiepunten."
);

const sections = splitActionPointSections([
  action({ id: "open-later", active: true, validUntil: "2099-08-01" }),
  action({ id: "closed", active: false, updatedAt: "2026-07-10T08:00:00.000Z" }),
  action({ id: "expired", active: true, validUntil: "2000-01-02", updatedAt: "2026-07-09T08:00:00.000Z" }),
  action({ id: "open-sooner", active: true, validUntil: "2099-07-10" }),
  action({ id: "workflow-closed", active: true, source: "workflow", status: "behaald", updatedAt: "2026-07-11T08:00:00.000Z" }),
  action({ id: "global-open", active: true, scope: "GLOBAL", scopeKey: "GLOBAL", country: undefined, teamId: undefined, userId: undefined }),
]);
assert.deepEqual(sections[0].items.map((item) => item.id), ["open-sooner", "open-later", "global-open"], "Open actiepunten verschijnen in sectie Open en sorteren stabiel.");
assert.deepEqual(sections[1].items.map((item) => item.id), ["workflow-closed", "closed", "expired"], "Afgesloten en verlopen actiepunten verschijnen in sectie Afgesloten.");
assert.deepEqual(sections[0].groups.map((group) => group.id), ["GLOBAL", "USER"], "Open actiepunten worden inklapbaar per scope gegroepeerd.");
assert.equal(actionPointScopeLabel("GLOBAL"), "Globaal", "Typebadge Globaal verschijnt correct.");
assert.equal(actionPointScopeLabel("COUNTRY"), "Land", "Typebadge Land verschijnt correct.");
assert.equal(actionPointScopeLabel("TEAM"), "Team", "Typebadge Team verschijnt correct.");
assert.equal(actionPointScopeLabel("USER"), "Persoonlijk", "Typebadge Persoonlijk verschijnt correct.");

const userMappedAction = action({ id: "user-mapped", scope: "USER", scopeKey: "USER:user-be", userId: "user-be", teamId: "team-be-a" });
const representativeGroups = groupActionPointsByRepresentative(
  [globalAction, countryBeAction, teamBeAction, personalOwnAction, userMappedAction, teamOtherAction],
  [
    actionRepresentative({ id: "representative-be", firstName: "Rita", lastName: "Peeters", teamId: "team-be-a", team: "Team BE A" }),
    actionRepresentative({ id: "representative-other", firstName: "Ona", lastName: "Teams", teamId: "team-be-b", team: "Team BE B" }),
  ],
  [managedUser({ id: "user-be", representativeId: "representative-be" })],
);
assert.deepEqual(
  representativeGroups.find((group) => group.id === "representative-be")?.items.map((item) => item.id),
  ["global", "country-be", "team-be", "personal-own", "user-mapped"],
  "Gebruikerstab toont globale, land-, team- en persoonlijke actiepunten per gebruiker."
);
assert.deepEqual(
  representativeGroups.find((group) => group.id === "representative-other")?.items.map((item) => item.id),
  ["global", "country-be", "team-other"],
  "Gebruikerstab respecteert team- en landenscope per gebruiker."
);

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

const richDescription = [
  "<h2>Klantbezoek voorbereiden</h2>",
  "<p><strong>Vet</strong>, <em>cursief</em>, <u>onderlijnd</u> en éèëçàäöüß.</p>",
  "<ul><li>Eerste punt</li><li>Tweede punt</li></ul>",
  "<ol><li>Stap één</li><li>Stap twee</li></ol>",
  "<p><a href=\"https://mext.example/path\">Veilige link</a></p>",
  "<script>alert('xss')</script><a href=\"javascript:alert(1)\" onclick=\"bad()\">Onveilig</a><iframe src=\"x\"></iframe>",
].join("");
const sanitized = sanitizeRichText(richDescription);
assert.match(sanitized, /<strong>Vet<\/strong>/, "Toegestane rich-text opmaak blijft bewaard.");
assert.match(sanitized, /rel="noopener noreferrer"/, "Veilige links krijgen defensieve link-attributen.");
assert.ok(!sanitized.includes("<script"), "Script-tags worden verwijderd.");
assert.ok(!sanitized.includes("onclick"), "Eventhandlers worden verwijderd.");
assert.ok(!sanitized.includes("javascript:"), "Javascript-links worden verwijderd.");
assert.ok(!sanitized.includes("<iframe"), "Iframe-tags worden verwijderd.");
assert.equal(isBlankRichText("<p><br></p>"), true, "Lege editor-markup telt als leeg.");
assert.equal(richTextToPlainText(richDescription).includes("<strong>"), false, "Compacte previews tonen geen HTML-tags.");
const structured = richTextToStructuredPlainText(richDescription);
assert.match(structured, /- Eerste punt/, "PDF/plain-text conversie behoudt bullets.");
assert.match(structured, /1\. Stap één/, "PDF/plain-text conversie behoudt nummering.");
assert.match(structured, /Veilige link \(https:\/\/mext\.example\/path\)/, "Links blijven leesbaar in niet-HTML uitvoer.");
assert.match(structured, /éèëçàäöüß/, "Speciale tekens blijven leesbaar.");

console.log("Actiepunten-overview visibility, secties, badges, rich-text en module-overrides zijn correct.");
