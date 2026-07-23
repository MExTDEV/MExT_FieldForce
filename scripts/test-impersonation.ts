import assert from "node:assert/strict";
import { canImpersonateUser, validateImpersonationReason } from "@/lib/server/impersonation";
import { roleTemplates } from "@/lib/user-management";
import type { Country, MockUser, Role } from "@/lib/types";
import { readFileSync } from "node:fs";

function user(role: Role, id: string, options: { country?: Country; countryAccess?: Country[]; teamId?: string; permission?: boolean; active?: boolean } = {}) {
  return {
    id,
    name: id,
    email: `${id}@mext.test`,
    role,
    country: options.country ?? "BE",
    countryAccess: options.countryAccess ?? [],
    language: "nl",
    teamId: options.teamId,
    permissions: { "users.impersonate": options.permission ?? roleTemplates[role].permissions["users.impersonate"] },
    active: options.active ?? true,
  } satisfies MockUser & { active: boolean };
}

const representative = user("REPRESENTATIVE", "rep");
const serviceOperator = user("SERVICE_OPERATOR", "service");
const salesLeader = user("SALES_LEADER", "leader", { teamId: "team-1" });
assert.equal(canImpersonateUser(representative, serviceOperator).allowed, false);
assert.equal(canImpersonateUser(serviceOperator, representative).allowed, false);
assert.equal(canImpersonateUser(salesLeader, representative).allowed, false);

const countryManager = user("COUNTRY_MANAGER", "cm");
assert.equal(canImpersonateUser(countryManager, representative).allowed, true);
assert.equal(canImpersonateUser(countryManager, user("REPRESENTATIVE", "nl-rep", { country: "NL" })).allowed, false);

const salesManager = user("SALES_MANAGER", "sm", { countryAccess: ["BE", "NL"] });
assert.equal(canImpersonateUser(salesManager, user("REPRESENTATIVE", "nl-rep", { country: "NL" })).allowed, true);
assert.equal(canImpersonateUser(salesManager, user("REPRESENTATIVE", "de-rep", { country: "DE" })).allowed, false);

const admin = user("ADMIN", "admin", { countryAccess: ["BE"] });
assert.equal(canImpersonateUser(admin, user("REPRESENTATIVE", "be-rep")).allowed, true);
assert.equal(canImpersonateUser(admin, user("REPRESENTATIVE", "de-rep", { country: "DE" })).allowed, false);
assert.equal(canImpersonateUser(countryManager, admin).allowed, false);

const groupManager = user("GROUP_MANAGER", "gm");
assert.equal(canImpersonateUser(groupManager, user("REPRESENTATIVE", "de-rep", { country: "DE" })).allowed, true);
assert.equal(canImpersonateUser(groupManager, admin).allowed, false);

const superAdmin = user("SUPER_ADMIN", "super");
assert.equal(canImpersonateUser(superAdmin, admin).allowed, true);
assert.equal(canImpersonateUser(superAdmin, user("SUPER_ADMIN", "other-super")).allowed, true);
assert.equal(canImpersonateUser(superAdmin, superAdmin).allowed, false);
assert.equal(canImpersonateUser(superAdmin, user("REPRESENTATIVE", "inactive", { active: false })).allowed, false);

assert.deepEqual(validateImpersonationReason("USER_SUPPORT"), { reasonType: "USER_SUPPORT", reasonText: null });
assert.throws(() => validateImpersonationReason("OTHER"), /omschrijving/);
assert.throws(() => validateImpersonationReason("UNKNOWN"), /geldige reden/);

assert.equal(roleTemplates.REPRESENTATIVE.permissions["users.impersonate"], false);
assert.equal(roleTemplates.SERVICE_OPERATOR.permissions["users.impersonate"], false);
assert.equal(roleTemplates.SALES_LEADER.permissions["users.impersonate"], false);
for (const role of ["SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"] as Role[]) {
  assert.equal(roleTemplates[role].permissions["users.impersonate"], true, `${role} mist users.impersonate`);
}
for (const role of ["GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"] as Role[]) {
  assert.equal(roleTemplates[role].permissions["audit.impersonation.read"], true, `${role} mist auditrecht`);
}

const schema = readFileSync("prisma/schema.prisma", "utf8");
const authenticatedUserSource = readFileSync("lib/server/authenticated-user.ts", "utf8");
const loginHistorySource = readFileSync("lib/server/login-history.ts", "utf8");
const auditSource = readFileSync("lib/server/audit.ts", "utf8");
const databaseSource = readFileSync("lib/server/db.ts", "utf8");
const notificationReadSource = readFileSync("app/api/notifications/[id]/read/route.ts", "utf8");
assert.match(schema, /model ImpersonationSession/);
assert.match(schema, /loginSession\s+UserLoginSession/);
assert.match(authenticatedUserSource, /PERMISSION_REVOKED/);
assert.match(authenticatedUserSource, /TARGET_DEACTIVATED/);
assert.match(authenticatedUserSource, /IMPERSONATION_EXPIRED/);
assert.match(loginHistorySource, /endReason: "LOGOUT"/);
assert.match(auditSource, /effectiveUserId/);
assert.match(auditSource, /impersonationSessionId/);
assert.match(databaseSource, /getImpersonationAuditContext/);
assert.match(databaseSource, /userId: context.actorUserId/);
assert.match(notificationReadSource, /impersonationSessionId/);

console.log("Impersonation-policy, standaardrechten, scope, hiërarchie en redenvalidatie zijn correct.");
