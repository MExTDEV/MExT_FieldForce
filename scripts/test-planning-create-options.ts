import assert from "node:assert/strict";

import {
  hasActivePlanningCreateModules,
  isPlanningDateParam,
  planningCreateOptions,
} from "../lib/planning-create-options";
import type { AppModuleCode, FieldForcePermissionKey, MockUser } from "../lib/types";

const allCreateModules: AppModuleCode[] = [
  "BEGELEIDINGEN",
  "CONTACTMOMENTEN",
  "RETRAININGEN",
  "SALESTRAININGEN",
  "HULPAANVRAGEN",
  "TUSSENTIJDSE_EVALUATIES",
];

const planningPermissions: FieldForcePermissionKey[] = [
  "moduleVisitRecord",
  "modulePreparation",
  "menu.coaching.enabled",
  "menu.coaching.coachings",
  "menu.coaching.contacts",
  "menu.coaching.retrainings",
  "menu.coaching.trainings",
  "menu.coaching.help",
  "menu.coaching.starterEvaluations",
  "starterEvaluationsExecute",
];

function user(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.test",
    role: "SALES_LEADER",
    country: "BE",
    language: "nl",
    teamId: "team-1",
    permissions: Object.fromEntries(planningPermissions.map((permission) => [permission, true])),
    ...overrides,
  };
}

function enabled(active: AppModuleCode[]) {
  return (code: AppModuleCode) => active.includes(code);
}

const managerOptions = planningCreateOptions({
  user: user(),
  isModuleEnabled: enabled(allCreateModules),
  selectedDate: "2026-08-11",
});
assert.deepEqual(
  managerOptions.map((option) => option.type),
  ["coaching", "contact", "retraining", "salesTraining", "starterEvaluation"],
  "Een bevoegde leidinggevende ziet alle actieve beheerflows, maar geen Hulpaanvraag."
);
assert.equal(managerOptions.find((option) => option.type === "coaching")?.href, "/begeleidingen/nieuw?date=2026-08-11");
assert.equal(managerOptions.find((option) => option.type === "contact")?.href, "/contactmomenten/nieuw?date=2026-08-11");
assert.equal(managerOptions.find((option) => option.type === "retraining")?.href, "/retrainingen/nieuw?date=2026-08-11");
assert.equal(managerOptions.find((option) => option.type === "salesTraining")?.href, "/sales-trainingen/nieuw?date=2026-08-11");
assert.equal(managerOptions.find((option) => option.type === "starterEvaluation")?.href, "/tussentijdse-evaluaties?new=1&date=2026-08-11");

const inactiveContactOptions = planningCreateOptions({
  user: user(),
  isModuleEnabled: enabled(["BEGELEIDINGEN", "RETRAININGEN"]),
  selectedDate: "2026-08-11",
});
assert.deepEqual(
  inactiveContactOptions.map((option) => option.type),
  ["coaching", "retraining"],
  "Gedeactiveerde modules verdwijnen automatisch uit de keuze."
);

const representativeOptions = planningCreateOptions({
  user: user({
    role: "REPRESENTATIVE",
    representativeId: "rep-1",
    permissions: Object.fromEntries([
      ...planningPermissions.map((permission) => [permission, true] as const),
      ["starterEvaluationsExecute", false],
    ]),
  }),
  isModuleEnabled: enabled(allCreateModules),
  selectedDate: "2026-08-11",
});
assert.deepEqual(
  representativeOptions.map((option) => option.type),
  ["retraining", "salesTraining", "helpRequest"],
  "Een vertegenwoordiger krijgt alleen de flows die de bestaande modules hem laten starten."
);
assert.equal(representativeOptions.find((option) => option.type === "helpRequest")?.href, "/hulpaanvragen/nieuw");

const noRightsOptions = planningCreateOptions({
  user: user({ role: "SERVICE_OPERATOR", permissions: Object.fromEntries(planningPermissions.map((permission) => [permission, true])) }),
  isModuleEnabled: enabled(allCreateModules),
});
assert.deepEqual(noRightsOptions, [], "Een gebruiker zonder aanmaakrechten krijgt een lege keuzelijst.");
assert.equal(hasActivePlanningCreateModules(enabled([])), false);
assert.equal(hasActivePlanningCreateModules(enabled(["PLANNING"])), false);
assert.equal(hasActivePlanningCreateModules(enabled(["CONTACTMOMENTEN"])), true);

assert.equal(isPlanningDateParam("2026-08-11"), true);
assert.equal(isPlanningDateParam("11-08-2026"), false);
assert.equal(isPlanningDateParam(undefined), false);

console.log("Planning-keuze respecteert actieve modules, rechten, lege resultaten en navigatie.");
