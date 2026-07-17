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
import { can } from "../lib/permissions";
import { fieldForcePermissionGroups, roleTemplates } from "../lib/user-management";
import { applyPermissionOverrides, listPermissionOverrides, resolveRolePermissions } from "../lib/role-permissions";
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
  "TUSSENTIJDSE_EVALUATIES",
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
expect(representativeDomains.length === 3, "Een vertegenwoordiger moet standaard Coaching, SalesDay en Contract zien.");
expect(representativeDomains.some((domain) => domain.key === "contract"), "Contract ontbreekt voor de vertegenwoordiger.");
const representativeSalesDayLinks = representativeDomains.find((domain) => domain.key === "salesday")?.links.map((link) => link.key) ?? [];
expect(representativeSalesDayLinks.includes("preparation"), "SalesDay-voorbereiding ontbreekt voor de vertegenwoordiger.");
expect(representativeSalesDayLinks.includes("agenda"), "SalesDay-agenda ontbreekt voor de vertegenwoordiger.");
expect(representativeSalesDayLinks.includes("stock"), "SalesDay-voorraad ontbreekt voor de vertegenwoordiger.");
expect(!representativeSalesDayLinks.includes("team"), "SalesDay Mijn Team mag niet zichtbaar zijn voor de vertegenwoordiger.");
const representativeLinks = representativeDomains.find((domain) => domain.key === "coaching")?.links.map((link) => link.key) ?? [];
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
expect(
  can(user("SUPER_ADMIN", { "menu.contract.open": false }), "menu.contract.open"),
  "Een Super Admin mag nooit door een user override worden geblokkeerd."
);
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

const storedDefaults = resolveRolePermissions("SALES_MANAGER", [
  { role: "SALES_MANAGER", enabled: true, permission: { key: "reportingAll" } },
]);
expect(
  storedDefaults.reportingAll,
  "Opgeslagen rolrechten moeten de statische template overschrijven."
);
const effectivePermissions = applyPermissionOverrides(
  storedDefaults,
  [{ enabled: false, permission: { key: "reportingAll" } }]
);
expect(!effectivePermissions.reportingAll, "Een expliciete user override moet het rolrecht overschrijven.");
const sparseOverrides = listPermissionOverrides(effectivePermissions, storedDefaults);
expect(sparseOverrides.length === 1, "Alleen afwijkingen van de rol mogen als user override bewaard worden.");
expect(sparseOverrides[0]?.key === "reportingAll", "De juiste afwijking moet bewaard worden.");

console.log("Menu-rechten gecontroleerd voor opgeslagen rolrechten, user overrides, Beheer > Log en module-permissies.");
