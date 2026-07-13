import assert from "node:assert/strict";

import { normalizeHistoricalActionPoints } from "../lib/server/performance";

const now = new Date("2026-07-13T10:00:00.000Z");
const closedAt = new Date("2026-07-13T09:00:00.000Z");

const actions = normalizeHistoricalActionPoints([
  {
    id: "shared-action",
    representativeId: "rep-a",
    representative: { representativeId: "REP-A" },
    interventionId: "coaching-1",
    intervention: null,
    title: "Prijsgesprek opvolgen",
    type: "VAARDIGHEID",
    status: "OPEN",
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
    closedAt: null,
    closedByUserId: null,
    updatedAt: now,
    assignments: [
      {
        id: "assignment-a",
        representativeId: "rep-a",
        representative: { representativeId: "REP-A" },
        status: "AFGEROND",
        closedAt,
        closedByUserId: "leader-1",
      },
      {
        id: "assignment-b",
        representativeId: "rep-b",
        representative: { representativeId: "REP-B" },
        status: "OPEN",
        closedAt: null,
        closedByUserId: null,
      },
    ],
  },
], [], "2026-07-13");

assert.equal(actions.length, 2, "Elke toewijzing blijft een afzonderlijk concreet actiepunt.");
assert.deepEqual(
  actions.map((item) => [item.id, item.representativeId, item.status]),
  [
    ["shared-action:rep-a", "REP-A", "afgerond"],
    ["shared-action:rep-b", "REP-B", "open"],
  ],
  "Sluiten van een toewijzing sluit alleen die vertegenwoordiger."
);
assert.equal(actions[0].closedAt, closedAt.toISOString(), "Sluitdatum wordt doorgegeven aan overzichten.");
assert.equal(actions[0].closedByUserId, "leader-1", "Sluitende gebruiker wordt doorgegeven aan overzichten.");
assert.equal(actions.filter((item) => item.status === "open").length, 1, "Dashboard- en overzichttellingen tellen alleen open toewijzingen.");

console.log("Actiepunt sluiten lifecycle-normalisatie is correct.");
