import assert from "node:assert/strict";

import {
  createExternalCalendarDedupeKeys,
  isLinkedExternalCalendarItem,
  layoutOverlappingPlanningItems,
  sortPlanningItems,
  type SortablePlanningItem,
} from "../lib/planning-items";

const item = (
  id: string,
  date: string,
  planningSource: SortablePlanningItem["planningSource"],
  planningType: SortablePlanningItem["planningType"],
  startTime: string,
  endTime: string,
): SortablePlanningItem => ({
  id,
  date,
  planningSource,
  planningType,
  startTime,
  endTime,
});

const sorted = sortPlanningItems([
  item("outlook-early", "2026-07-07", "EXTERNAL_CALENDAR", "OUTLOOK_APPOINTMENT", "08:30", "09:00"),
  item("coaching-later", "2026-07-07", "FIELD_FORCE", "COACHING", "09:00", "10:00"),
  item("help-request", "2026-07-07", "FIELD_FORCE", "HELP_REQUEST", "10:00", "11:00"),
  item("contact", "2026-07-07", "FIELD_FORCE", "CONTACT_MOMENT", "09:30", "10:00"),
  item("outlook-later", "2026-07-07", "EXTERNAL_CALENDAR", "OUTLOOK_APPOINTMENT", "10:00", "11:00"),
  item("previous-day-outlook", "2026-07-06", "EXTERNAL_CALENDAR", "OUTLOOK_APPOINTMENT", "16:00", "17:00"),
]);

assert.deepEqual(
  sorted.map((entry) => entry.id),
  [
    "previous-day-outlook",
    "coaching-later",
    "contact",
    "help-request",
    "outlook-early",
    "outlook-later",
  ],
);

const sameTime = sortPlanningItems([
  item("outlook-same-time", "2026-07-07", "EXTERNAL_CALENDAR", "OUTLOOK_APPOINTMENT", "10:00", "11:00"),
  item("coaching-same-time", "2026-07-07", "FIELD_FORCE", "COACHING", "10:00", "11:00"),
]);

assert.deepEqual(
  sameTime.map((entry) => entry.id),
  ["coaching-same-time", "outlook-same-time"],
);

const stableTieBreak = sortPlanningItems([
  item("b", "2026-07-07", "FIELD_FORCE", "HELP_REQUEST", "10:00", "11:00"),
  item("a", "2026-07-07", "FIELD_FORCE", "HELP_REQUEST", "10:00", "11:00"),
]);

assert.deepEqual(stableTieBreak.map((entry) => entry.id), ["a", "b"]);

const keys = createExternalCalendarDedupeKeys([
  { outlookEventId: "event-1", outlookICalUId: "ical-1" },
  { outlookEventId: undefined, outlookICalUId: "ical-2" },
]);

assert.equal(isLinkedExternalCalendarItem({ id: "event-1" }, keys), true);
assert.equal(isLinkedExternalCalendarItem({ id: "other", iCalUId: "ical-2" }, keys), true);
assert.equal(isLinkedExternalCalendarItem({ id: "other", iCalUId: "other" }, keys), false);

const overlapping = layoutOverlappingPlanningItems([
  item("outlook-overlap", "2026-07-07", "EXTERNAL_CALENDAR", "OUTLOOK_APPOINTMENT", "08:30", "09:30"),
  item("coaching-overlap", "2026-07-07", "FIELD_FORCE", "COACHING", "09:00", "10:00"),
  item("coaching-late", "2026-07-07", "FIELD_FORCE", "COACHING", "11:00", "12:00"),
]);

const coachingOverlap = overlapping.find((entry) => entry.id === "coaching-overlap");
const outlookOverlap = overlapping.find((entry) => entry.id === "outlook-overlap");
const coachingLate = overlapping.find((entry) => entry.id === "coaching-late");

assert.equal(coachingOverlap?.layoutColumn, 0);
assert.equal(coachingOverlap?.layoutColumnCount, 2);
assert.equal(outlookOverlap?.layoutColumn, 1);
assert.equal(outlookOverlap?.layoutColumnCount, 2);
assert.equal(coachingLate?.layoutColumn, 0);
assert.equal(coachingLate?.layoutColumnCount, 1);

console.log("Planning-sortering, Outlook-deduplicatie en overlap-layout zijn correct.");
