import assert from "node:assert/strict";

import { buildCoachingScopeGroups, type CoachingScopeGroupItem } from "../lib/coaching/scope-groups";
import {
  coachingGroupKey,
  collectCoachingGroupIds,
  matchesCoachingSearch,
  normalizeCoachingSearchText,
} from "../lib/coaching/overview-list";
import type { MockUser } from "../lib/types";

type TestRow = CoachingScopeGroupItem & { searchText: string };

const manager: MockUser = {
  id: "manager",
  name: "Manager",
  email: "manager@example.test",
  role: "SUPER_ADMIN",
  country: "BE",
  language: "nl",
};

const rows: TestRow[] = [
  {
    id: "coaching-1",
    country: "BE",
    teamId: "team-a",
    team: "Team Antwerpen",
    representativeId: "rep-1",
    person: "Élodie Peeters",
    searchText: "Élodie Peeters Koen Coach Team Antwerpen België 12 aug 2026 Gepland",
  },
  {
    id: "coaching-2",
    country: "NL",
    teamId: "team-b",
    team: "Team Utrecht",
    representativeId: "rep-2",
    person: "Noor Jansen",
    searchText: "Noor Jansen Team Utrecht Nederland Afgesloten",
  },
];

assert.equal(normalizeCoachingSearchText("ÉLODIE"), "elodie", "Zoeken moet hoofdletter- en accentongevoelig zijn.");
assert.equal(matchesCoachingSearch(rows[0].searchText, "Peet"), true, "Gedeeltelijke gebruikersnaam moet matchen.");
assert.equal(matchesCoachingSearch(rows[0].searchText, "utrecht"), false, "Een andere teamgroep mag niet matchen.");
assert.equal(matchesCoachingSearch(rows[0].searchText, ""), true, "Een lege zoekterm moet alles tonen.");
assert.equal(matchesCoachingSearch(rows[0].searchText, "bestaat-niet"), false, "Een onbekende zoekterm moet nul resultaten geven.");

const groups = buildCoachingScopeGroups(manager, rows);
const groupIds = collectCoachingGroupIds(groups);
assert.deepEqual(
  [...groupIds].sort(),
  [
    coachingGroupKey("country", "BE"),
    coachingGroupKey("country", "NL"),
    coachingGroupKey("team", "BE", "team-a"),
    coachingGroupKey("team", "NL", "team-b"),
    coachingGroupKey("user", "BE", "team-a", "rep-1"),
    coachingGroupKey("user", "NL", "team-b", "rep-2"),
  ].sort(),
  "Alles uitklappen moet land-, team- en gebruikersgroepen omvatten."
);

const filteredGroups = buildCoachingScopeGroups(manager, rows.filter((row) => matchesCoachingSearch(row.searchText, "Utrecht")));
assert.deepEqual(filteredGroups.countries.map((country) => country.id), ["NL"], "Lege landgroepen moeten uit de gefilterde boom verdwijnen.");
assert.deepEqual(filteredGroups.countries[0].teams.map((team) => team.name), ["Team Utrecht"]);
assert.deepEqual(filteredGroups.countries[0].teams[0].users.map((user) => user.name), ["Noor Jansen"]);

console.log("Zoeken, leegmaken, nulresultaten en coachinggroep-expansie gecontroleerd.");
