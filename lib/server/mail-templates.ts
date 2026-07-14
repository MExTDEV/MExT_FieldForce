import { translate } from "@/lib/i18n";
import { richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";
import type { AppNotificationType } from "@/lib/notifications";
import type { Language } from "@/lib/types";

export type WorkflowMailTemplateInput = {
  type: AppNotificationType;
  language: Language;
  actorName?: string;
  entityTitle?: string;
  linkUrl?: string;
  contentHtml?: string;
};

export type WorkflowMailTemplate = {
  subject: string;
  text: string;
  html: string;
};

export type MailSettingsTestTemplateInput = {
  language: Language;
  actorName: string;
  recipient: string;
};

const templateKeys: Partial<Record<AppNotificationType, { title: Parameters<typeof translate>[1]; body: Parameters<typeof translate>[1] }>> = {
  COACHING_APPROVAL_REQUEST: {
    title: "notifications.coachingApproval.title",
    body: "notifications.coachingApproval.body",
  },
  COACHING_PLANNED: {
    title: "notifications.coaching.planned.title",
    body: "notifications.coaching.planned.body",
  },
  COACHING_APPROVAL_CONFIRMED: {
    title: "notifications.coachingApproval.confirmed.title",
    body: "notifications.coachingApproval.confirmed.body",
  },
  HELP_REQUEST_CREATED: {
    title: "notifications.helpRequest.created.title",
    body: "notifications.helpRequest.created.body",
  },
  HELP_REQUEST_ANSWERED: {
    title: "notifications.helpRequest.answered.title",
    body: "notifications.helpRequest.answered.body",
  },
  HELP_REQUEST_CLOSED: {
    title: "notifications.helpRequest.closed.title",
    body: "notifications.helpRequest.closed.body",
  },
  HELP_REQUEST_FOLLOW_UP: {
    title: "notifications.helpRequest.followUp.title",
    body: "notifications.helpRequest.followUp.body",
  },
  CONTACT_MOMENT_PLANNED: {
    title: "notifications.contactMoment.planned.title",
    body: "notifications.contactMoment.planned.body",
  },
  CONTACT_MOMENT_UPDATED: {
    title: "notifications.contactMoment.updated.title",
    body: "notifications.contactMoment.updated.body",
  },
  CONTACT_MOMENT_SHARED: {
    title: "notifications.contactMoment.shared.title",
    body: "notifications.contactMoment.shared.body",
  },
  CONTACT_MOMENT_CANCELLED: {
    title: "notifications.contactMoment.cancelled.title",
    body: "notifications.contactMoment.cancelled.body",
  },
  CONTACT_MOMENT_NOT_EXECUTED: {
    title: "notifications.contactMoment.notExecuted.title",
    body: "notifications.contactMoment.notExecuted.body",
  },
  PEER_COACHING_ASSIGNED: {
    title: "notifications.peerCoaching.assigned.title",
    body: "notifications.peerCoaching.assigned.body",
  },
  PEER_COACHING_LATE: {
    title: "notifications.peerCoaching.late.title",
    body: "notifications.peerCoaching.late.body",
  },
  PEER_COACHING_ACTION_REVIEW: {
    title: "notifications.peerCoaching.actionReview.title",
    body: "notifications.peerCoaching.actionReview.body",
  },
  PEER_COACHING_FINAL_APPROVED: {
    title: "notifications.peerCoaching.finalApproved.title",
    body: "notifications.peerCoaching.finalApproved.body",
  },
  PEER_COACHING_FINAL_REJECTED: {
    title: "notifications.peerCoaching.finalRejected.title",
    body: "notifications.peerCoaching.finalRejected.body",
  },
};

export function buildWorkflowMailTemplate(input: WorkflowMailTemplateInput): WorkflowMailTemplate {
  const keys = templateKeys[input.type];
  if (!keys) {
    throw new Error(`Geen mailtemplate voor notificatietype ${input.type}.`);
  }
  const subject = translate(input.language, keys.title);
  const body = translate(input.language, keys.body);
  const recordLabel = translate(input.language, "mail.template.recordLabel");
  const actorLabel = translate(input.language, "mail.template.actorLabel");
  const messageLabel = translate(input.language, "mail.template.messageLabel");
  const openLabel = translate(input.language, "mail.template.openLabel");
  const openAction = translate(input.language, "mail.template.openAction");
  const contentText = richTextToPlainText(input.contentHtml);
  const lines = [
    body,
    input.entityTitle ? `${recordLabel}: ${input.entityTitle}` : undefined,
    input.actorName ? `${actorLabel}: ${input.actorName}` : undefined,
    contentText ? `${messageLabel}: ${contentText}` : undefined,
    input.linkUrl ? `${openLabel}: ${input.linkUrl}` : undefined,
  ].filter(Boolean);
  return {
    subject,
    text: lines.join("\n"),
    html: [
      `<p>${escapeHtml(body)}</p>`,
      input.entityTitle ? `<p><strong>${escapeHtml(recordLabel)}:</strong> ${escapeHtml(input.entityTitle)}</p>` : "",
      input.actorName ? `<p><strong>${escapeHtml(actorLabel)}:</strong> ${escapeHtml(input.actorName)}</p>` : "",
      contentText ? `<p><strong>${escapeHtml(messageLabel)}:</strong></p><div>${sanitizeRichText(input.contentHtml ?? "")}</div>` : "",
      input.linkUrl ? `<p><a href="${escapeHtml(input.linkUrl)}">${escapeHtml(openAction)}</a></p>` : "",
    ].join(""),
  };
}

export function buildMailSettingsTestTemplate(
  input: MailSettingsTestTemplateInput
): WorkflowMailTemplate {
  const subject = translate(input.language, "settings.mailTest.emailSubject");
  const body = translate(input.language, "settings.mailTest.emailBody");
  const recipientLabel = translate(input.language, "settings.mailTest.emailRecipientLabel");
  const actorLabel = translate(input.language, "settings.mailTest.emailActorLabel");
  return {
    subject,
    text: [
      body,
      `${recipientLabel}: ${input.recipient}`,
      `${actorLabel}: ${input.actorName}`,
    ].join("\n"),
    html: [
      `<p>${escapeHtml(body)}</p>`,
      `<p><strong>${escapeHtml(recipientLabel)}:</strong> ${escapeHtml(input.recipient)}</p>`,
      `<p><strong>${escapeHtml(actorLabel)}:</strong> ${escapeHtml(input.actorName)}</p>`,
    ].join(""),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
