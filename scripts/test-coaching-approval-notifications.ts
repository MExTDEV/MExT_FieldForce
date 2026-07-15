import assert from "node:assert/strict";
import {
  buildCoachingApprovalConfirmedEntityTitle,
  buildCoachingApprovalConfirmedEventKey,
  resolveCoachingApprovalConfirmedRecipients,
} from "../lib/coaching/approval-notifications";

const source = {
  id: "coaching-1",
  title: "Begeleiding Yoni",
  ownerId: "owner-user",
  initiatorId: "initiator-user",
  sentForApprovalById: "submitter-user",
  plannedDate: "2026-07-15",
  representativeName: "Yoni Janssens",
};

assert.deepEqual(
  resolveCoachingApprovalConfirmedRecipients(source, "rep-user"),
  ["owner-user", "submitter-user"],
  "De eigenaar/coach en de verzender van het akkoordverzoek krijgen de bevestigingsmelding."
);

assert.deepEqual(
  resolveCoachingApprovalConfirmedRecipients({ ...source, ownerId: "rep-user" }, "rep-user"),
  ["submitter-user"],
  "De ondertekenende vertegenwoordiger wordt uitgesloten, maar de verzender blijft ontvanger."
);

assert.deepEqual(
  resolveCoachingApprovalConfirmedRecipients({
    ...source,
    ownerId: "",
    sentForApprovalById: undefined,
  }, "rep-user"),
  ["initiator-user"],
  "Zonder eigenaar of verzender valt de melding terug op de initiator."
);

assert.equal(
  buildCoachingApprovalConfirmedEventKey("coaching-1", "approval-1"),
  "COACHING_APPROVAL_CONFIRMED:coaching:coaching-1:approval:approval-1"
);
assert.equal(
  buildCoachingApprovalConfirmedEntityTitle(source),
  "Begeleiding Yoni (Yoni Janssens - 2026-07-15)"
);

console.log("FieldForce coaching approval notification tests geslaagd.");
