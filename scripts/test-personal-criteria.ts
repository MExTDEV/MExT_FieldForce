import { mockUsers, representatives } from "../lib/mock-data";
import {
  activePersonalCriteriaForRepresentative,
  canManagePersonalCriterionForRepresentative,
  canViewPersonalCriterion,
  validatePersonalCriterionInput,
} from "../lib/personal-criteria";
import type { PersonalCoachingCriterion } from "../lib/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const leader = mockUsers.find((user) => user.id === "user-leader-be")!;
const representative = mockUsers.find((user) => user.id === "user-rep-be")!;
const countryManager = mockUsers.find((user) => user.id === "user-country-de")!;
const superAdmin = mockUsers.find((user) => user.id === "user-super")!;

const ownCriterion: PersonalCoachingCriterion = {
  id: "criterion-test-own",
  title: "Doorvragen op verborgen bezwaar",
  description: "",
  focusName: "Behoefteanalyse",
  representativeId: "rep-1",
  createdByUserId: leader.id,
  teamId: "be-1",
  country: "BE",
  isActive: true,
  createdAt: "2026-06-16T08:00:00.000Z",
  updatedAt: "2026-06-16T08:00:00.000Z",
};

const otherTeamCriterion: PersonalCoachingCriterion = {
  ...ownCriterion,
  id: "criterion-test-other-team",
  title: "Andere teamfocus",
  representativeId: "rep-4",
  teamId: "be-2",
};

assert(canViewPersonalCriterion(representative, ownCriterion, representatives), "VT moet eigen persoonlijke criteria zien.");
assert(!canViewPersonalCriterion(representative, otherTeamCriterion, representatives), "VT mag geen criteria van collega's zien.");
assert(canViewPersonalCriterion(leader, ownCriterion, representatives), "VL moet eigen criteria voor teamleden zien.");
assert(!canViewPersonalCriterion(leader, otherTeamCriterion, representatives), "VL mag geen criteria buiten eigen team zien.");
assert(!canManagePersonalCriterionForRepresentative(leader, {
  id: "rep-4",
  firstName: "Emma",
  lastName: "Maes",
  initials: "EM",
  country: "BE",
  team: "BE Team 2",
  teamId: "be-2",
  level: "Vertegenwoordiger",
  levelColor: "",
  lastCoaching: "",
  openActions: 0,
  email: "",
  phone: "",
  kpis: [],
}), "VL mag niet beheren buiten eigen team.");
assert(!canViewPersonalCriterion(countryManager, ownCriterion, representatives), "Country Manager DE mag geen BE-criteria zien.");
assert(canViewPersonalCriterion(superAdmin, otherTeamCriterion, representatives), "Super Admin moet alle criteria zien.");
assert(activePersonalCriteriaForRepresentative(representative, "rep-1", [ownCriterion, otherTeamCriterion], representatives).length === 1, "Actieve criteria moeten per VT gescopeerd zijn.");
assert(validatePersonalCriterionInput(leader, [ownCriterion], {
  title: ownCriterion.title,
  description: "",
  focusName: "Behoefteanalyse",
  representativeId: "rep-1",
}, representatives)?.includes("bestaat al"), "Duplicaten per VT moeten geweigerd worden.");

console.log("Personal criteria access checks passed.");
