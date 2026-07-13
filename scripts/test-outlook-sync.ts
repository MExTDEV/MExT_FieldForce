import assert from "node:assert/strict";
import { buildPlanningOutlookEventPayload } from "@/lib/server/microsoft-graph";

const visibleContact = buildPlanningOutlookEventPayload({
  id: "contact-1",
  kind: "CONTACTMOMENT",
  title: "Pipeline opvolging",
  plannedDate: "2026-08-10",
  startTime: "09:00",
  endTime: "10:00",
  notifyRepresentative: true,
  location: "Antwerpen",
}, {
  email: "rep@example.test",
  firstName: "Rep",
  lastName: "BE",
});

assert.equal(visibleContact.subject, "Fieldforce: Pipeline opvolging");
assert.deepEqual(visibleContact.start, { dateTime: "2026-08-10T09:00:00", timeZone: "Romance Standard Time" });
assert.deepEqual(visibleContact.end, { dateTime: "2026-08-10T10:00:00", timeZone: "Romance Standard Time" });
assert.deepEqual(visibleContact.location, { displayName: "Antwerpen" });
assert.deepEqual(visibleContact.attendees, [{
  emailAddress: { address: "rep@example.test", name: "Rep BE" },
  type: "required",
}]);
assert.match(visibleContact.body.content, /contactmoment/);

const hiddenContact = buildPlanningOutlookEventPayload({
  id: "contact-2",
  kind: "CONTACTMOMENT",
  title: "Verrassingscontact",
  plannedDate: "2026-08-11",
  startTime: "13:00",
  endTime: "14:00",
  notifyRepresentative: false,
}, {
  email: "rep@example.test",
  firstName: "Rep",
  lastName: "BE",
});

assert.deepEqual(hiddenContact.attendees, []);

console.log("Outlook-payload voor Contactmomenten volgt het bestaande FieldForce-synccontract.");
