import { getAvailableDomains } from "../lib/app-switcher";
import { roleTemplates } from "../lib/user-management";
import type { AppModuleConfig, MockUser, Role } from "../lib/types";

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

function user(role: Role): MockUser {
  return {
    id: `test-${role}`,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
    country: "BE",
    countryAccess: role === "SALES_MANAGER" ? ["BE", "NL"] : undefined,
    language: "nl",
    teamId: role === "SALES_LEADER" || role === "REPRESENTATIVE" ? "team-1" : undefined,
    permissions: { ...roleTemplates[role].permissions },
  };
}

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
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

const admin = user("ADMIN");
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

const inactivePlanningModules = modules.map((module) =>
  module.code === "PLANNING" ? { ...module, enabled: false } : module
);
expect(
  !getAvailableDomains(user("SUPER_ADMIN"), inactivePlanningModules)
    .find((domain) => domain.key === "coaching")
    ?.links.some((link) => link.key === "planning"),
  "Een inactieve module mag geen directe link tonen."
);

console.log("Menu-rechten gecontroleerd voor Super Admin, Admin, Country Manager, Sales Manager, Verkoopleider en Vertegenwoordiger.");
