import assert from "node:assert/strict";

import {
  buildCoachingApprovalConfirmedEntityTitle,
  buildCoachingApprovalConfirmedEventKey,
  resolveCoachingApprovalConfirmedRecipients,
} from "../lib/coaching/approval-notifications";
import { buildCoachingApprovalNotification, buildInAppNotification } from "../lib/server/notifications";

const sentForApprovalAt = new Date("2026-07-09T12:15:00.000Z");
const createdAt = new Date("2026-07-09T12:10:00.000Z");

const unreadNotification = buildCoachingApprovalNotification({
  id: "approval-1",
  representativeId: "rep-user-1",
  openedAt: null,
  createdAt,
  interventionId: "coaching-1",
  intervention: {
    id: "coaching-1",
    title: "Begeleiding Yoni",
    sentForApprovalAt,
    sentForApprovalById: "leader-1",
  },
}, "nl");

assert.equal(unreadNotification.id, "approval-1");
assert.equal(unreadNotification.targetUserId, "rep-user-1");
assert.equal(unreadNotification.type, "COACHING_APPROVAL_REQUEST");
assert.equal(unreadNotification.entityType, "coaching");
assert.equal(unreadNotification.entityId, "coaching-1");
assert.equal(unreadNotification.linkUrl, "/begeleidingen/coaching-1");
assert.equal(unreadNotification.createdAt, sentForApprovalAt.toISOString());
assert.equal(unreadNotification.isRead, false);
assert.equal(unreadNotification.readAt, undefined);
assert.equal(unreadNotification.triggeredByUserId, "leader-1");
assert.equal(unreadNotification.title, "Nieuwe begeleiding ter akkoord");
assert.equal(
  unreadNotification.body,
  "Er staat een begeleiding klaar voor jouw beoordeling. Vul eerst de drie verplichte reflectievragen in. Daarna kun je het begeleidingsverslag bekijken en je akkoord doorgeven."
);

const readAt = new Date("2026-07-09T12:20:00.000Z");
const readNotification = buildCoachingApprovalNotification({
  id: "approval-2",
  representativeId: "rep-user-2",
  openedAt: readAt,
  createdAt,
  interventionId: "coaching-2",
  intervention: {
    id: "coaching-2",
    title: "Begeleiding Elke",
    sentForApprovalAt: null,
    sentForApprovalById: null,
  },
}, "de");

assert.equal(readNotification.createdAt, createdAt.toISOString());
assert.equal(readNotification.isRead, true);
assert.equal(readNotification.readAt, readAt.toISOString());
assert.equal(readNotification.triggeredByUserId, undefined);
assert.equal(readNotification.title, "Neue Begleitung zur Bestaetigung");

const genericCreatedAt = new Date("2026-07-12T08:30:00.000Z");
const genericUpdatedAt = new Date("2026-07-12T08:45:00.000Z");
const helpRequestNotification = buildInAppNotification({
  id: "delivery-1",
  eventKey: "HELP_REQUEST_CREATED:helpRequest:help-1",
  recipientUserId: "leader-1",
  status: "unread",
  sourceModule: "HULPAANVRAGEN",
  entityType: "helpRequest",
  entityId: "help-1",
  originalTo: "rep-user-1",
  createdAt: genericCreatedAt,
  updatedAt: genericUpdatedAt,
}, "nl");

assert.ok(helpRequestNotification);
assert.equal(helpRequestNotification.id, "delivery-1");
assert.equal(helpRequestNotification.targetUserId, "leader-1");
assert.equal(helpRequestNotification.type, "HELP_REQUEST_CREATED");
assert.equal(helpRequestNotification.entityType, "helpRequest");
assert.equal(helpRequestNotification.entityId, "help-1");
assert.equal(helpRequestNotification.linkUrl, "/hulpaanvragen/help-1");
assert.equal(helpRequestNotification.isRead, false);
assert.equal(helpRequestNotification.readAt, undefined);
assert.equal(helpRequestNotification.triggeredByUserId, "rep-user-1");
assert.equal(helpRequestNotification.title, "Nieuwe hulpaanvraag");
assert.equal(helpRequestNotification.body, "Er staat een nieuwe hulpaanvraag klaar voor opvolging.");

const contactNotification = buildInAppNotification({
  id: "delivery-2",
  eventKey: "CONTACT_MOMENT_SHARED:contactMoment:contact-1",
  recipientUserId: "rep-user-1",
  status: "read",
  sourceModule: "CONTACTMOMENTEN",
  entityType: "contactMoment",
  entityId: "contact-1",
  originalTo: "leader-1",
  createdAt: genericCreatedAt,
  updatedAt: genericUpdatedAt,
}, "de");

assert.ok(contactNotification);
assert.equal(contactNotification.type, "CONTACT_MOMENT_SHARED");
assert.equal(contactNotification.linkUrl, "/contactmomenten/contact-1");
assert.equal(contactNotification.isRead, true);
assert.equal(contactNotification.readAt, genericUpdatedAt.toISOString());
assert.equal(contactNotification.title, "Kontakt geteilt");

const approvalConfirmedNotification = buildInAppNotification({
  id: "delivery-3",
  eventKey: "COACHING_APPROVAL_CONFIRMED:coaching:coaching-3:approval:approval-3",
  recipientUserId: "leader-1",
  status: "unread",
  sourceModule: "BEGELEIDINGEN",
  entityType: "coaching",
  entityId: "coaching-3",
  originalTo: "rep-user-1",
  createdAt: genericCreatedAt,
  updatedAt: genericUpdatedAt,
}, "nl");

assert.ok(approvalConfirmedNotification);
assert.equal(approvalConfirmedNotification.type, "COACHING_APPROVAL_CONFIRMED");
assert.equal(approvalConfirmedNotification.targetUserId, "leader-1");
assert.equal(approvalConfirmedNotification.linkUrl, "/begeleidingen/coaching-3");
assert.equal(approvalConfirmedNotification.triggeredByUserId, "rep-user-1");
assert.equal(approvalConfirmedNotification.title, "Begeleiding akkoord bevestigd");
assert.equal(
  approvalConfirmedNotification.body,
  "De begeleide gebruiker heeft de begeleiding voor akkoord bevestigd."
);

const coachingPlannedNotification = buildInAppNotification({
  id: "delivery-4",
  eventKey: "COACHING_PLANNED:coaching:coaching-4:2026-07-12T08:30:00.000Z",
  recipientUserId: "rep-user-1",
  status: "unread",
  sourceModule: "BEGELEIDINGEN",
  entityType: "coaching",
  entityId: "coaching-4",
  originalTo: "leader-1",
  createdAt: genericCreatedAt,
  updatedAt: genericUpdatedAt,
}, "nl");

assert.ok(coachingPlannedNotification);
assert.equal(coachingPlannedNotification.type, "COACHING_PLANNED");
assert.equal(coachingPlannedNotification.linkUrl, "/begeleidingen/coaching-4");
assert.equal(coachingPlannedNotification.title, "Begeleiding gepland");
assert.equal(coachingPlannedNotification.body, "Er staat een begeleiding voor jou gepland.");

const approvalConfirmedRecipients = resolveCoachingApprovalConfirmedRecipients({
  id: "coaching-3",
  title: "Begeleiding Yoni",
  ownerId: "leader-1",
  initiatorId: "planner-1",
  sentForApprovalById: "leader-1",
  plannedDate: "2026-07-12",
}, "rep-user-1");
assert.deepEqual(approvalConfirmedRecipients, ["leader-1"]);
assert.deepEqual(
  resolveCoachingApprovalConfirmedRecipients({
    id: "coaching-4",
    title: "Begeleiding zonder eigenaar",
    ownerId: "",
    initiatorId: "planner-1",
    sentForApprovalById: "submitter-1",
  }, "rep-user-1"),
  ["submitter-1"]
);
assert.deepEqual(
  resolveCoachingApprovalConfirmedRecipients({
    id: "coaching-5",
    title: "Begeleiding zonder eigenaar of verzender",
    ownerId: "",
    initiatorId: "planner-1",
    sentForApprovalById: undefined,
  }, "rep-user-1"),
  ["planner-1"]
);
assert.equal(
  buildCoachingApprovalConfirmedEventKey("coaching-3", "approval-3"),
  "COACHING_APPROVAL_CONFIRMED:coaching:coaching-3:approval:approval-3"
);
assert.equal(
  buildCoachingApprovalConfirmedEntityTitle({
    id: "coaching-3",
    title: "Begeleiding Yoni",
    ownerId: "leader-1",
    initiatorId: "planner-1",
    plannedDate: "2026-07-12",
    representativeName: "Yoni Peeters",
  }),
  "Begeleiding Yoni (Yoni Peeters - 2026-07-12)"
);

const unknownNotification = buildInAppNotification({
  id: "delivery-5",
  eventKey: "UNKNOWN_EVENT:helpRequest:help-1",
  recipientUserId: "leader-1",
  status: "unread",
  sourceModule: null,
  entityType: "helpRequest",
  entityId: "help-1",
  originalTo: null,
  createdAt: genericCreatedAt,
  updatedAt: genericUpdatedAt,
}, "nl");

assert.equal(unknownNotification, undefined);

console.log("Approval- en generieke in-app notificaties worden correct opgebouwd met link, read-state en vertaling.");
