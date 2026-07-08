import assert from "node:assert/strict";

import { buildDashboardAttentionSections } from "../lib/dashboard-attention";
import { visibleCoachings } from "../lib/coaching/visibility";
import type {
  CoachingIntervention,
  ContactMoment,
  HelpRequest,
  MockUser,
  Representative,
  Retraining,
  SalesTraining,
} from "../lib/types";

const user = (
  id: string,
  role: MockUser["role"],
  representativeId?: string,
): MockUser => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role,
  country: "BE",
  language: "nl",
  representativeId,
  teamId: "team-be",
});

const leader = user("leader", "SALES_LEADER");
const representativeUser = user("rep-user", "REPRESENTATIVE", "rep-1");

const representative: Representative = {
  id: "rep-1",
  firstName: "Rita",
  lastName: "Peeters",
  initials: "RP",
  country: "BE",
  team: "Team BE",
  teamId: "team-be",
  level: "Vertegenwoordiger",
  levelColor: "bg-sky-100 text-sky-800",
  lastCoaching: "Nog niet",
  openActions: 0,
  email: "rita@example.test",
  phone: "",
  kpis: [],
};

function coaching(
  id: string,
  status: CoachingIntervention["status"],
  plannedDate: string,
  startTime: string,
  notifyRepresentative = true,
): CoachingIntervention {
  return {
    id,
    representativeId: representative.id,
    initiatorId: leader.id,
    ownerId: leader.id,
    country: "BE",
    teamId: representative.teamId,
    title: `Begeleiding ${id}`,
    status,
    plannedDate,
    startTime,
    endTime: "11:00",
    notifyRepresentative,
    outlookSyncStatus: "NOT_SYNCED",
    focusNames: [],
    scores: [],
    actionPoints: [],
    createdAt: `${plannedDate}T07:00:00.000Z`,
    updatedAt: `${plannedDate}T07:00:00.000Z`,
  };
}

const contact: ContactMoment = {
  id: "contact-today",
  representativeId: representative.id,
  initiatorId: leader.id,
  ownerId: leader.id,
  country: "BE",
  teamId: representative.teamId,
  status: "gepland",
  reason: "KPI opvolging",
  reportedProblems: "",
  leaderThemes: [],
  representativeKpis: [],
  representativeThemes: [],
  discussedThemes: [],
  conclusion: "",
  actionPoints: [],
  createdAt: "2026-07-07T08:00:00.000Z",
  updatedAt: "2026-07-07T08:00:00.000Z",
};

const retraining: Retraining = {
  id: "retraining-today",
  representativeId: representative.id,
  initiatorId: leader.id,
  country: "BE",
  teamId: representative.teamId,
  theme: "Demo",
  reason: "",
  desiredImprovement: "",
  date: "2026-07-07",
  trainer: "Trainer",
  result: "",
  actionPoints: [],
  status: "gepland",
  createdAt: "2026-07-01T08:00:00.000Z",
  updatedAt: "2026-07-01T08:00:00.000Z",
};

const salesTraining: SalesTraining = {
  id: "sales-training-today",
  initiatorId: leader.id,
  country: "BE",
  theme: "Sales focus",
  reason: "",
  targetAudience: "Team",
  participantIds: [representative.id],
  date: "2026-07-07",
  trainer: "Trainer",
  conclusion: "",
  followUpAction: "",
  createIndividualActions: false,
  createGroupAction: false,
  actionDue: "",
  actionPoints: [],
  status: "afgerond",
  createdAt: "2026-07-01T08:00:00.000Z",
  updatedAt: "2026-07-07T13:00:00.000Z",
};

const helpRequest: HelpRequest = {
  id: "help-today",
  requesterId: representativeUser.id,
  representativeId: representative.id,
  country: "BE",
  teamId: representative.teamId,
  subject: "Hulp bij contract",
  difficulty: "",
  desiredResult: "",
  urgency: "normaal",
  explanation: "",
  status: "in_behandeling",
  createdAt: "2026-07-07T09:00:00.000Z",
  updatedAt: "2026-07-07T09:00:00.000Z",
};

const sections = buildDashboardAttentionSections({
  currentUser: leader,
  today: "2026-07-07",
  interventions: [
    coaching("coaching-open-late", "gepland", "2026-07-07", "10:00"),
    coaching("coaching-open-early", "in_uitvoering", "2026-07-07", "08:30"),
    coaching("coaching-done", "wacht_op_akkoord", "2026-07-07", "09:30"),
    coaching("coaching-future", "gepland", "2026-07-08", "09:00"),
    coaching("coaching-past", "gepland", "2026-07-06", "09:00"),
  ],
  contactMoments: [contact],
  retrainings: [retraining],
  salesTrainings: [salesTraining],
  helpRequests: [helpRequest],
  representativeName: () => `${representative.firstName} ${representative.lastName}`,
  ownerName: () => "Leider",
});

assert.deepEqual(
  sections.todo.map((item) => item.recordId),
  [
    "contact-today",
    "help-today",
    "retraining-today",
    "coaching-open-early",
    "coaching-open-late",
  ],
);
assert.deepEqual(
  sections.done.map((item) => item.recordId),
  ["sales-training-today", "coaching-done"],
);

const surprise = coaching("surprise", "gepland", "2026-07-07", "09:00", false);
const announced = coaching("announced", "gepland", "2026-07-07", "10:00", true);
const pending = coaching("pending", "wacht_op_akkoord", "2026-07-07", "11:00", false);
const representativeVisible = visibleCoachings(representativeUser, [surprise, announced, pending]);
const representativeSections = buildDashboardAttentionSections({
  currentUser: representativeUser,
  today: "2026-07-07",
  interventions: representativeVisible,
  representativeName: () => `${representative.firstName} ${representative.lastName}`,
});

assert.deepEqual(
  representativeSections.todo.map((item) => item.recordId),
  ["announced"],
  "Een vertegenwoordiger ziet alleen aangekondigde geplande begeleidingen.",
);
assert.deepEqual(
  representativeSections.done.map((item) => item.recordId),
  ["pending"],
  "Een verrassingsbegeleiding verschijnt pas na Wachten op akkoord.",
);
assert.equal(
  representativeSections.todo[0].href,
  undefined,
  "Een vertegenwoordiger mag een onafgewerkte aangekondigde begeleiding niet openen.",
);

console.log("Dashboard Aandacht vereist splitst vandaag-items correct.");
