import assert from "node:assert/strict";

import {
  buildCoachingScopeGroups,
  type CoachingScopeGroupItem,
} from "../lib/coaching/scope-groups";
import { visibleCoachings } from "../lib/coaching/visibility";
import type { CoachingIntervention, MockUser, Role } from "../lib/types";

type TestRow = CoachingScopeGroupItem & {
  detailHref: string;
};

function user(
  role: Role,
  input: Partial<MockUser> = {}
): MockUser {
  return {
    id: `user-${role}`,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
    country: "BE",
    language: "nl",
    ...input,
  };
}

function row(input: Partial<TestRow> = {}): TestRow {
  return {
    id: "coaching-be-a",
    country: "BE",
    teamId: "team-be-a",
    team: "Team A",
    representativeId: "rep-a",
    person: "Anna Aerts",
    detailHref: "/begeleidingen/coaching-be-a",
    ...input,
  };
}

function assertNoEmptySubgroups(groups: ReturnType<typeof buildCoachingScopeGroups<TestRow>>) {
  for (const country of groups.countries) {
    assert.ok(country.teams.length > 0, "Landgroepen zonder zichtbare teams mogen niet renderen.");
    for (const team of country.teams) {
      assert.ok(team.users.length > 0, "Teamgroepen zonder zichtbare gebruikers mogen niet renderen.");
      for (const userGroup of team.users) {
        assert.ok(userGroup.items.length > 0, "Gebruikersgroepen zonder zichtbare coachings mogen niet renderen.");
      }
    }
  }
}

function assertSingleCountryManagement(role: Role) {
  const groups = buildCoachingScopeGroups(
    user(role, { countryAccess: ["BE"] }),
    [row()]
  );
  assert.equal(groups.enabled, true);
  assert.equal(groups.showCountry, false, `${role} met een land start op Team -> Gebruiker.`);
  assert.equal(groups.countries.length, 1);
  assert.equal(groups.countries[0].teams[0].name, "Team A");
  assert.equal(groups.countries[0].teams[0].users[0].name, "Anna Aerts");
  assert.equal(groups.countries[0].teams[0].users[0].items[0].detailHref, "/begeleidingen/coaching-be-a");
  assertNoEmptySubgroups(groups);
}

function assertMultiCountryManagement(role: Role) {
  const groups = buildCoachingScopeGroups(
    user(role, { countryAccess: ["BE", "NL"] }),
    [
      row({ id: "coaching-nl", country: "NL", teamId: "team-nl", team: "Team NL", representativeId: "rep-nl", person: "Nora Noort" }),
      row({ id: "coaching-be", country: "BE", teamId: "team-be", team: "Team BE", representativeId: "rep-be", person: "Bert Bos" }),
    ]
  );
  assert.equal(groups.enabled, true);
  assert.equal(groups.showCountry, true, `${role} met meerdere landen krijgt Land -> Team -> Gebruiker.`);
  assert.deepEqual(groups.countries.map((country) => country.id), ["BE", "NL"]);
  assert.deepEqual(groups.countries.map((country) => country.teams[0].users[0].items.length), [1, 1]);
  assertNoEmptySubgroups(groups);
}

for (const role of ["COUNTRY_MANAGER", "SALES_MANAGER", "ADMIN"] as Role[]) {
  assertSingleCountryManagement(role);
  assertMultiCountryManagement(role);
}

const superAdminGroups = buildCoachingScopeGroups(
  user("SUPER_ADMIN", { country: "NL" }),
  [row()]
);
assert.equal(superAdminGroups.enabled, true);
assert.equal(superAdminGroups.showCountry, true, "Super Admin behoudt altijd Land -> Team -> Gebruiker.");
assertNoEmptySubgroups(superAdminGroups);

const leaderGroups = buildCoachingScopeGroups(
  user("SALES_LEADER", { teamId: "team-be-a" }),
  [row()]
);
assert.equal(leaderGroups.enabled, false, "Verkoopleider behoudt de bestaande niet-managementweergave.");

const representativeGroups = buildCoachingScopeGroups(
  user("REPRESENTATIVE", { representativeId: "rep-a" }),
  [row()]
);
assert.equal(representativeGroups.enabled, false, "Vertegenwoordiger krijgt geen managementgroepering.");

const representative = user("REPRESENTATIVE", { id: "rep-user", representativeId: "rep-a" });
const surprise: CoachingIntervention = {
  id: "surprise",
  representativeId: "rep-a",
  initiatorId: "leader-a",
  ownerId: "leader-a",
  country: "BE",
  teamId: "team-be-a",
  title: "Surprise begeleiding",
  status: "gepland",
  plannedDate: "2026-07-08",
  startTime: "09:00",
  endTime: "11:00",
  notifyRepresentative: false,
  outlookSyncStatus: "NOT_SYNCED",
  focusNames: [],
  scores: [],
  actionPoints: [],
  createdAt: "2026-07-08T07:00:00.000Z",
  updatedAt: "2026-07-08T07:00:00.000Z",
};
assert.equal(
  visibleCoachings(representative, [surprise]).length,
  0,
  "Groepering mag niet voorafgaan aan bestaande surprise-coaching visibility."
);

console.log("Begeleidingen scopegroepering gecontroleerd voor managementrollen en zichtbaarheid.");
