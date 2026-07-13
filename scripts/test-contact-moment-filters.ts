import assert from "node:assert/strict";
import {
  contactMomentFilterOptions,
  filterContactMoments,
  toLocalDateKey,
  type ContactMomentOverviewFilter,
} from "../lib/contact-moment-filters";
import type { ContactMoment } from "../lib/types";

const today = "2026-07-12";

function contact(id: string, status: ContactMoment["status"], plannedDate?: string): ContactMoment {
  return {
    id,
    representativeId: "rep-1",
    initiatorId: "user-leader",
    ownerId: "user-leader",
    country: "BE",
    teamId: "be-1",
    status,
    plannedDate,
    reason: id,
    reportedProblems: "",
    leaderThemes: [],
    representativeKpis: [],
    representativeThemes: [],
    discussedThemes: [],
    conclusion: "",
    actionPoints: [],
    createdAt: `${plannedDate ?? today}T08:00:00.000Z`,
    updatedAt: `${plannedDate ?? today}T08:00:00.000Z`,
  };
}

const contacts = [
  contact("today-planned", "gepland", today),
  contact("future-planned", "gepland", "2026-07-13"),
  contact("draft-modern", "in_uitvoering", "2026-07-11"),
  contact("draft-legacy", "wacht_op_vt_input", "2026-07-10"),
  contact("shared", "afgesloten", "2026-07-09"),
  contact("cancelled", "geannuleerd", "2026-07-08"),
  contact("not-completed", "niet_uitgevoerd", "2026-07-07"),
];

function ids(filter: ContactMomentOverviewFilter) {
  return filterContactMoments(contacts, filter, today).map((item) => item.id);
}

assert.equal(toLocalDateKey(new Date("2026-07-12T22:30:00")), today);
assert.deepEqual(contactMomentFilterOptions.map((item) => item.value), [
  "all",
  "today",
  "future",
  "draftReports",
  "shared",
  "cancelled",
  "notCompleted",
]);
assert.deepEqual(ids("all"), contacts.map((item) => item.id));
assert.deepEqual(ids("today"), ["today-planned"]);
assert.deepEqual(ids("future"), ["future-planned"]);
assert.deepEqual(ids("draftReports"), ["draft-modern", "draft-legacy"]);
assert.deepEqual(ids("shared"), ["shared"]);
assert.deepEqual(ids("cancelled"), ["cancelled"]);
assert.deepEqual(ids("notCompleted"), ["not-completed"]);

console.log("Contactmomenten overzichtsfilters OK");
