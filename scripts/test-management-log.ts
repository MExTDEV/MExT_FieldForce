import assert from "node:assert/strict";
import { activityHistoryPageSize } from "../lib/activity-history";
import {
  canAccessManagementSection,
  getVisibleManagementSections,
} from "../lib/management-access";
import { roleTemplates } from "../lib/user-management";
import type { FieldForcePermissionKey, MockUser, Role } from "../lib/types";

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

assert.equal(activityHistoryPageSize, 15, "Beheer > Log moet 15 actiehistoriekregels per pagina blijven tonen.");

assert.equal(canAccessManagementSection(user("SUPER_ADMIN"), "log"), true, "Super Admin moet de log kunnen openen.");
assert.equal(canAccessManagementSection(user("ADMIN"), "log"), true, "Admin moet de log standaard kunnen openen.");
assert.equal(canAccessManagementSection(user("ADMIN", { "menu.coaching.log": false }), "log"), false, "Een Admin override kan de log verbergen.");
assert.equal(canAccessManagementSection(user("SALES_MANAGER"), "log"), false, "Sales Manager krijgt standaard geen logtoegang.");
assert.equal(canAccessManagementSection(user("SALES_MANAGER", { "menu.coaching.log": true }), "log"), true, "Een expliciete override kan logtoegang geven.");
assert.equal(canAccessManagementSection(user("ADMIN", { "menu.coaching.enabled": false }), "log"), false, "Het overkoepelende Coaching-menu blokkeert de log.");
assert.equal(canAccessManagementSection(user("REPRESENTATIVE"), "log"), false, "Vertegenwoordiger krijgt standaard geen logtoegang.");
assert.ok(
  getVisibleManagementSections(user("ADMIN")).some((section) => section.section === "log"),
  "Beheer > Log moet zichtbaar zijn in de Admin beheernavigatie."
);

console.log("Beheer > Log permissies, overrides en paginatie-instelling gecontroleerd.");
