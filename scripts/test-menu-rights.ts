import { getAvailableDomains } from "../lib/app-switcher";
import {
  canAccessManagementSection,
  managementSections,
} from "../lib/management-access";
import {
  canAccessCoachingModuleNavigation,
  canAccessDashboard,
  canAccessMyTeamNavigation,
  coachingModuleNavigationRules,
} from "../lib/navigation-access";
import { appModuleRegistry } from "../lib/modules";
import { fieldForcePermissionGroups, roleTemplates } from "../lib/user-management";
import type {
  AppModuleConfig,
  FieldForcePermissionKey,
  MockUser,
  Role,
} from "../lib/types";

const modules: AppModuleConfig[] = [
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
  enabled: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}));

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
    teamId: role === "SALES_LEADER" || role === "REPRESENTATIVE" ? "team-1" : undefined,
    permissions: { ...roleTemplates[role].permissions, ...overrides },
  };
}

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

for (const appModule of appModuleRegistry) {
  expect(
    Boolean(coachingModuleNavigationRules[appModule.code]),
    `${appModule.code} mist een configureerbare menu-permissie.`
  );
}

for (const section of managementSections) {
  expect(
    section.permission.startsWith("menu.coaching."),
    `${section.section} mist een configureerbare Beheer-menupermissie.`
  );
}

const configurablePermissionKeys = new Set(
  fieldForcePermissionGroups.flatMap((group) =>
    group.permissions.map((permission) => permission.key)
  )
);
for (const section of managementSections) {
  expect(
    configurablePermissionKeys.has(section.permission),
    `${section.permission} ontbreekt in role/user permission configuration.`
  );
}
for (const rule of Object.values(coachingModuleNavigationRules)) {
  expect(
    configurablePermissionKeys.has(rule.menuPermission),
    `${rule.menuPermission} ontbreekt in role/user permission configuration.`
  );
}

for (const role of ["SUPER_ADMIN", "ADMIN", "COUNTRY_MANAGER", "SALES_MANAGER", "SALES_LEADER"] as Role[]) {
  const domains = getAvailableDomains(user(role), modules);
  expect(domains.length === 5, `${role} moet vijf toegestane hoofditems krijgen.`);
}

const representative = user("REPRESENTATIVE");
const representativeDomains = getAvailableDomains(representative, modules);
expect(representativeDomains.length === 1, "Een vertegenwoordiger mag standaard alleen Coaching zien.");
expect(representativeDomains[0]?.key === "coaching", "Coaching moet het hoofditem van de vertegenwoordiger zijn.");
const representativeLinks = representativeDomains[0]?.links.map((link) => link.key) ?? [];
expect(representativeLinks.includes("dashboard"), "Dashboard ontbreekt voor de vertegenwoordiger.");
expect(representativeLinks.includes("planning"), "Planning ontbreekt voor de vertegenwoordiger.");
expect(representativeLinks.includes("coachings"), "Begeleidingen ontbreekt voor de vertegenwoordiger.");
expect(!representativeLinks.includes("myTeam"), "Mijn Team mag niet zichtbaar zijn voor de vertegenwoordiger.");
expect(!representativeLinks.includes("users"), "Gebruikersbeheer mag niet zichtbaar zijn voor de vertegenwoordiger.");
expect(!representativeLinks.includes("log"), "Log mag niet zichtbaar zijn voor de vertegenwoordiger.");

const admin = user("ADMIN");
const adminCoachingLinks = getAvailableDomains(admin, modules)
  .find((domain) => domain.key === "coaching")
  ?.links.map((link) => link.key) ?? [];
expect(adminCoachingLinks.includes("log"), "Admin moet standaard Beheer > Log kunnen zien.");
expect(canAccessManagementSection(admin, "log"), "Admin moet standaard directe toegang hebben tot Beheer > Log.");
expect(canAccessManagementSection(user("SUPER_ADMIN"), "log"), "Super Admin moet Beheer > Log kunnen zien.");
for (const role of ["SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "REPRESENTATIVE"] as Role[]) {
  expect(!canAccessManagementSection(user(role), "log"), `${role} mag Beheer > Log niet standaard zien.`);
}

const adminWithoutLog = user("ADMIN", { "menu.coaching.log": false });
expect(!canAccessManagementSection(adminWithoutLog, "log"), "Een user override moet Beheer > Log kunnen uitschakelen.");
const salesManagerWithLog = user("SALES_MANAGER", { "menu.coaching.log": true });
expect(canAccessManagementSection(salesManagerWithLog, "log"), "Een user override moet Beheer > Log kunnen inschakelen.");
expect(!canAccessManagementSection(user("COUNTRY_MANAGER"), "teams"), "Country Manager heeft standaard geen teambeheer.");
expect(
  canAccessManagementSection(user("COUNTRY_MANAGER", { "menu.coaching.teams": true }), "teams"),
  "Country Manager kan teambeheer krijgen via expliciete rechten."
);

expect(!canAccessDashboard(user("ADMIN", { "menu.coaching.dashboard": false })), "Dashboard volgt menu overrides.");
expect(!canAccessCoachingModuleNavigation(user("ADMIN", { "menu.coaching.planning": false }), "PLANNING"), "Planning volgt menu overrides.");
expect(!canAccessMyTeamNavigation(user("SALES_LEADER", { "menu.coaching.myTeam": false })), "Mijn Team volgt menu overrides.");
expect(!canAccessManagementSection(user("ADMIN", { "menu.coaching.enabled": false }), "log"), "Beheer-items volgen het overkoepelende Coaching-menu.");

admin.permissions = { ...admin.permissions, "menu.pst.enabled": false };
expect(
  !getAvailableDomains(admin, modules).some((domain) => domain.key === "pst"),
  "Een uitgeschakeld hoofditem mag niet in het mega-menu staan."
);

const leader = user("SALES_LEADER");
leader.permissions = { ...leader.permissions, "menu.pst.planning": false };
const leaderPst = getAvailableDomains(leader, modules).find((domain) => domain.key === "pst");
expect(
  !leaderPst?.links.some((link) => link.key === "planning"),
  "Een uitgeschakeld subitem mag niet in het mega-menu staan."
);

const inactivePlanningModules = modules.map((appModule) =>
  appModule.code === "PLANNING" ? { ...appModule, enabled: false } : appModule
);
expect(
  !getAvailableDomains(user("SUPER_ADMIN"), inactivePlanningModules)
    .find((domain) => domain.key === "coaching")
    ?.links.some((link) => link.key === "planning"),
  "Een inactieve module mag geen directe link tonen."
);

console.log("Menu-rechten gecontroleerd voor role defaults, user overrides, Beheer > Log en module-permissies.");
