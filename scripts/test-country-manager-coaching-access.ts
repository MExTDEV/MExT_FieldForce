import assert from "node:assert/strict";

import { getAvailableDomains } from "../lib/app-switcher";
import { moduleForRoute } from "../lib/modules";
import { canAccessCoachingModuleNavigation } from "../lib/navigation-access";
import {
  canAccessCountry,
  canCreateCoachingIntervention,
} from "../lib/permissions";
import { roleTemplates } from "../lib/user-management";
import type { AppModuleConfig, MockUser } from "../lib/types";

const modules: AppModuleConfig[] = [
  {
    id: "module-begeleidingen",
    code: "BEGELEIDINGEN",
    name: "Begeleidingen",
    enabled: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
];

function countryManager(
  overrides: Partial<NonNullable<MockUser["permissions"]>> = {}
): MockUser {
  return {
    id: "country-manager-be",
    name: "Country Manager BE",
    email: "country.manager.be@example.test",
    role: "COUNTRY_MANAGER",
    country: "BE",
    language: "nl",
    permissions: {
      ...roleTemplates.COUNTRY_MANAGER.permissions,
      ...overrides,
    },
  };
}

const actor = countryManager();

assert.equal(
  roleTemplates.COUNTRY_MANAGER.permissions.moduleVisitRecord,
  true,
  "Country Manager moet standaard het Begeleidingen-functierecht krijgen."
);
assert.equal(moduleForRoute("begeleidingen")?.code, "BEGELEIDINGEN");
assert.equal(
  canAccessCoachingModuleNavigation(actor, "BEGELEIDINGEN"),
  true,
  "Country Manager moet de Begeleidingen-route binnen de module kunnen openen."
);
assert.equal(
  canCreateCoachingIntervention(actor),
  true,
  "De server-side Coaching-mutatieguard moet Country Manager toelaten."
);
assert.ok(
  getAvailableDomains(actor, modules)
    .find((domain) => domain.key === "coaching")
    ?.links.some((link) => link.key === "coachings"),
  "Begeleidingen moet in het Coaching-menu van Country Manager staan."
);

const blockedActor = countryManager({ moduleVisitRecord: false });
assert.equal(
  canAccessCoachingModuleNavigation(blockedActor, "BEGELEIDINGEN"),
  false,
  "Een expliciete persoonlijke beperking moet de directe route blokkeren."
);
assert.equal(
  canCreateCoachingIntervention(blockedActor),
  false,
  "Een expliciete persoonlijke beperking moet Coaching-mutaties blokkeren."
);

assert.equal(canAccessCountry(actor, "BE"), true);
assert.equal(
  canAccessCountry(actor, "NL"),
  false,
  "Het nieuwe Coaching-recht mag de Country Manager-scope niet verruimen."
);

console.log("Country Manager Coaching-recht, route, API-guard en landscope gecontroleerd.");
