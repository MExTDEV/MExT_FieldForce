import assert from "node:assert/strict";
import { myTeamScopeWhere } from "../lib/server/my-team";
import { sortMyTeamMembers, type MyTeamMember } from "../lib/my-team";
import type { MockUser, Role } from "../lib/types";

function actor(role: Role, country: MockUser["country"] = "BE"): MockUser {
  return {
    id: `actor-${role}`,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
    country,
    language: "nl",
    teamId: role === "SALES_LEADER" ? "team-eigen" : undefined,
  };
}

assert.deepEqual(myTeamScopeWhere(actor("SALES_LEADER")), { id: "team-eigen" });
assert.deepEqual(myTeamScopeWhere(actor("COUNTRY_MANAGER", "NL")), { country: "NL" });
assert.deepEqual(myTeamScopeWhere(actor("ADMIN")), {});
assert.deepEqual(myTeamScopeWhere(actor("SUPER_ADMIN")), {});
assert.deepEqual(myTeamScopeWhere(actor("REPRESENTATIVE")), { id: "__geen_toegang__" });

const base: Omit<MyTeamMember, "id" | "firstName" | "lastName" | "initials" | "role" | "isTeamLeader"> = {
  country: "BE",
  countryId: "BE",
  team: "Team Noord",
  teamId: "team-noord",
  profileHref: "/mijn-team",
};
const sorted = sortMyTeamMembers([
  { ...base, id: "rep-z", firstName: "Zoë", lastName: "Aerts", initials: "ZA", role: "REPRESENTATIVE", isTeamLeader: false },
  { ...base, id: "leader-b", firstName: "Bram", lastName: "Willems", initials: "BW", role: "SALES_LEADER", isTeamLeader: true },
  { ...base, id: "leader-a", firstName: "An", lastName: "Peeters", initials: "AP", role: "SALES_LEADER", isTeamLeader: true },
  { ...base, id: "rep-a", firstName: "An", lastName: "De Smet", initials: "AD", role: "REPRESENTATIVE", isTeamLeader: false },
]);
assert.deepEqual(sorted.map((member) => member.id), ["leader-a", "leader-b", "rep-z", "rep-a"]);

console.log("Mijn Team scope- en sorteertests geslaagd.");
