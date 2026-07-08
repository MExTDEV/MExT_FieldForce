import assert from "node:assert/strict";

import {
  canShowPlannedCoachingIndicator,
  isPlannedCoachingIndicatorCandidate,
  withPlannedCoachingIndicators,
  type MyTeamMember,
  type PlannedCoachingIndicatorSource,
} from "../lib/my-team";
import { visibleCoachings } from "../lib/coaching/visibility";
import { roleTemplates } from "../lib/user-management";
import type {
  AppModuleCode,
  AppModuleConfig,
  CoachingIntervention,
  FieldForcePermissionKey,
  MockUser,
  Role,
} from "../lib/types";

const moduleCodes: AppModuleCode[] = ["PLANNING", "BEGELEIDINGEN"];

function modules(disabled: AppModuleCode[] = []): AppModuleConfig[] {
  return moduleCodes.map((code) => ({
    id: code,
    code,
    name: code,
    enabled: !disabled.includes(code),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

function user(
  id: string,
  role: Role,
  overrides: Partial<Record<FieldForcePermissionKey, boolean>> = {}
): MockUser {
  return {
    id,
    name: id,
    email: `${id}@example.test`,
    role,
    country: "BE",
    countryAccess: role === "SALES_MANAGER" ? ["BE", "NL"] : undefined,
    language: "nl",
    teamId: role === "SALES_LEADER" ? "team-be" : undefined,
    representativeId: role === "REPRESENTATIVE" ? "rep-be" : undefined,
    permissions: { ...roleTemplates[role].permissions, ...overrides },
  };
}

function member(input: Partial<MyTeamMember> = {}): MyTeamMember {
  return {
    id: "user-rep-be",
    representativeId: "rep-be",
    firstName: "Rita",
    lastName: "Rep",
    initials: "RR",
    role: "REPRESENTATIVE",
    country: "BE",
    countryId: "BE",
    team: "Team BE",
    teamId: "team-be",
    isTeamLeader: false,
    profileHref: "/mijn-team/rep-be",
    ...input,
  };
}

function indicatorSource(
  input: Partial<PlannedCoachingIndicatorSource> = {}
): PlannedCoachingIndicatorSource {
  return {
    representativeId: "rep-be",
    status: "gepland",
    plannedDate: "2026-07-08",
    updatedAt: "2026-07-08T08:00:00.000Z",
    ...input,
  };
}

function coaching(input: Partial<CoachingIntervention> = {}): CoachingIntervention {
  return {
    id: "coaching",
    representativeId: "rep-be",
    initiatorId: "leader-be",
    ownerId: "leader-be",
    country: "BE",
    teamId: "team-be",
    title: "Geplande begeleiding",
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
    ...input,
  };
}

const allModules = modules();
const leader = user("leader-be", "SALES_LEADER");

assert.equal(canShowPlannedCoachingIndicator(leader, allModules), true);
assert.equal(
  canShowPlannedCoachingIndicator(leader, modules(["BEGELEIDINGEN"])),
  false,
  "De indicator verdwijnt wanneer Begeleidingen als module uit staat."
);
assert.equal(
  canShowPlannedCoachingIndicator(
    user("leader-no-coaching", "SALES_LEADER", { moduleVisitRecord: false }),
    allModules
  ),
  false,
  "Een user-level override op moduleVisitRecord blokkeert de indicator."
);

assert.equal(isPlannedCoachingIndicatorCandidate(indicatorSource(), "2026-07-08"), true);
assert.equal(
  isPlannedCoachingIndicatorCandidate(indicatorSource({ plannedDate: "2026-07-09" }), "2026-07-08"),
  true
);
assert.equal(
  isPlannedCoachingIndicatorCandidate(indicatorSource({ plannedDate: "2026-07-07" }), "2026-07-08"),
  false,
  "Verlopen geplande items markeren de rij niet."
);
assert.equal(
  isPlannedCoachingIndicatorCandidate(indicatorSource({ status: "wacht_op_akkoord" }), "2026-07-08"),
  false,
  "Wachten op akkoord is uitgevoerd/ingediend en telt niet als gepland."
);
assert.equal(
  isPlannedCoachingIndicatorCandidate(indicatorSource({ status: "voltooid" }), "2026-07-08"),
  false
);

const annotated = withPlannedCoachingIndicators(
  [member(), member({ id: "user-rep-other", representativeId: "rep-other" })],
  [indicatorSource()],
  "2026-07-08"
);
assert.equal(annotated[0].hasPlannedCoaching, true);
assert.equal(annotated[1].hasPlannedCoaching, false);

const leaderMember = member({
  id: "leader-target-user",
  representativeId: undefined,
  role: "SALES_LEADER",
  isTeamLeader: true,
});
const leaderTarget = indicatorSource({
  representativeId: "leader-target",
  subject: { id: "leader-target", userId: "leader-target-user" },
});
assert.equal(
  withPlannedCoachingIndicators([leaderMember], [leaderTarget], "2026-07-08")[0]
    .hasPlannedCoaching,
  true,
  "Ook een verkoopleider die zelf begeleidingssubject is krijgt de indicator."
);

const surprise = coaching({ notifyRepresentative: false });
const representative = user("user-rep-be", "REPRESENTATIVE");
assert.equal(visibleCoachings(representative, [surprise]).length, 0);
assert.equal(
  withPlannedCoachingIndicators([member()], visibleCoachings(representative, [surprise]), "2026-07-08")[0]
    .hasPlannedCoaching,
  false,
  "Een vertegenwoordiger krijgt geen indirecte indicator voor een verborgen surprise begeleiding."
);

const announced = coaching({ notifyRepresentative: true });
assert.equal(visibleCoachings(representative, [announced]).length, 1);
assert.equal(
  withPlannedCoachingIndicators([member()], visibleCoachings(representative, [announced]), "2026-07-08")[0]
    .hasPlannedCoaching,
  true
);

console.log("Mijn Team planned-coaching indicator volgt module-, permission- en visibility-regels.");
