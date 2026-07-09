import assert from "node:assert/strict";

import { buildCoachingApprovalNotification } from "../lib/server/notifications";

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
  "Er staat een begeleiding klaar om te controleren en voor akkoord te bevestigen."
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

console.log("Approval-notificaties worden correct opgebouwd met link, unread/read status en vertaling.");
