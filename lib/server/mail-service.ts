import { randomUUID } from "node:crypto";
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { prisma } from "@/lib/server/db";
import {
  buildMailSettingsTestTemplate,
  buildWorkflowMailTemplate,
} from "@/lib/server/mail-templates";
import {
  getMailRuntimeSettings,
  type MailRuntimeSettings,
} from "@/lib/server/mail-settings";
import {
  getMailTestRecipient,
  isMailTestActive,
  logMailDelivery,
  routeMailThroughMailTest,
  type MailEnvelope,
  type MailRoutingContext,
  type RoutedMail,
} from "@/lib/server/mail-test";
import type { AppNotificationType } from "@/lib/notifications";
import type { Language } from "@/lib/types";
import { getCurrentImpersonationMailContext } from "@/lib/server/impersonation";

export type OutboundMail = {
  recipientUserId: string;
  envelope: MailEnvelope;
  subject: string;
  text?: string;
  html?: string;
  context: MailRoutingContext;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
  impersonation?: { sessionId: string; actorName: string; effectiveUserName: string } | null;
};

export type MailTransport = Pick<Transporter, "sendMail">;

export type WorkflowEventMailInput = {
  type: AppNotificationType;
  recipientUserId: string;
  triggeredByUserId?: string;
  entityTitle?: string;
  linkUrl?: string;
  contentHtml?: string;
  context: MailRoutingContext;
};

export type MailSettingsTestInput = {
  actorId: string;
  actorName: string;
  language: Language;
  recipient: string;
};

export async function sendFieldForceMail(input: OutboundMail) {
  const [settings, mailTestActive, mailTestRecipient, impersonation] = await Promise.all([
    getMailRuntimeSettings(),
    isMailTestActive(),
    getMailTestRecipient(),
    getCurrentImpersonationMailContext(),
  ]);
  const transporter = nodemailer.createTransport(buildSmtpTransportOptions(settings));
  return sendFieldForceMailWithTransport({
    input: { ...input, impersonation },
    mailTestActive,
    mailTestRecipient,
    settings,
    transport: transporter,
    logDelivery: logMailDelivery,
  });
}

export async function sendWorkflowEventMail(input: WorkflowEventMailInput) {
  const settings = await getMailRuntimeSettings();
  if (!settings.smtp.enabled || !settings.ready) {
    return { status: "skipped" as const, reason: `Mail niet geconfigureerd: ${settings.missing.join(", ") || "onbekend"}` };
  }
  const [recipient, actor, mailTestActive, mailTestRecipient, impersonation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.recipientUserId },
      select: { email: true, language: true },
    }),
    input.triggeredByUserId
      ? prisma.user.findUnique({
          where: { id: input.triggeredByUserId },
          select: { firstName: true, lastName: true, email: true },
        })
      : Promise.resolve(null),
    isMailTestActive(),
    getMailTestRecipient(),
    getCurrentImpersonationMailContext(),
  ]);
  if (!recipient?.email) {
    return { status: "skipped" as const, reason: "Ontvanger heeft geen e-mailadres." };
  }
  const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : undefined;
  const template = buildWorkflowMailTemplate({
    type: input.type,
    language: recipient.language,
    actorName,
    entityTitle: input.entityTitle,
    linkUrl: input.linkUrl,
    contentHtml: input.contentHtml,
  });
  const transporter = nodemailer.createTransport(buildSmtpTransportOptions(settings));
  await sendFieldForceMailWithTransport({
    input: {
      recipientUserId: input.recipientUserId,
      envelope: { to: [recipient.email] },
      subject: template.subject,
      text: template.text,
      html: template.html,
      replyToEmail: actor?.email,
      context: input.context,
      impersonation,
    },
    mailTestActive,
    mailTestRecipient,
    settings,
    transport: transporter,
    logDelivery: logMailDelivery,
  });
  return { status: "sent" as const };
}

export async function sendMailSettingsTest(input: MailSettingsTestInput) {
  const template = buildMailSettingsTestTemplate({
    language: input.language,
    actorName: input.actorName,
    recipient: input.recipient,
  });
  return sendFieldForceMail({
    recipientUserId: input.actorId,
    envelope: { to: [input.recipient] },
    subject: template.subject,
    text: template.text,
    html: template.html,
    context: {
      sourceModule: "BEHEER",
      entityType: "AppSetting",
      entityId: "MAIL_TEST",
      eventKey: `MAIL_SETTINGS_TEST:${input.actorId}:${randomUUID()}`,
      reason: "Handmatige SMTP-test vanuit de mailinstellingen",
      sentAt: new Date(),
    },
  });
}

export async function sendFieldForceMailWithTransport({
  input,
  logDelivery,
  mailTestActive,
  mailTestRecipient,
  settings,
  transport,
}: {
  input: OutboundMail;
  mailTestActive: boolean;
  mailTestRecipient?: string;
  settings: MailRuntimeSettings;
  transport: MailTransport;
  logDelivery: typeof logMailDelivery;
}) {
  if (!settings.smtp.enabled || !settings.ready) {
    throw new Error(`Mail is niet volledig geconfigureerd: ${settings.missing.join(", ") || "onbekend"}.`);
  }
  const routed = routeMailThroughMailTest({
    mailTestActive,
    mailTestRecipient,
    envelope: input.envelope,
    context: input.context,
  });
  try {
    if (routed.routingError) {
      throw new Error(routed.routingError);
    }
    const message = buildMailMessage(input, routed, settings);
    assertMailProviderRecipientsAreSafe(message, routed);
    const info = await transport.sendMail(message);
    await logDelivery({
      eventKey: input.context.eventKey,
      recipientUserId: input.recipientUserId,
      status: "sent",
      routed,
      context: input.context,
    });
    return { routed, info };
  } catch (error) {
    await logDelivery({
      eventKey: input.context.eventKey,
      recipientUserId: input.recipientUserId,
      status: "error",
      routed,
      context: input.context,
      error: error instanceof Error ? error.message : "Onbekende mailfout.",
    });
    throw error;
  }
}

export function buildSmtpTransportOptions(settings: MailRuntimeSettings) {
  return {
    host: settings.smtp.host,
    port: settings.smtp.port,
    secure: settings.smtp.security === "tls",
    requireTLS: settings.smtp.security === "starttls",
    auth: settings.smtp.authType === "password"
      ? {
          user: settings.smtp.username,
          pass: settings.smtpPassword ?? "",
        }
      : undefined,
  };
}

export function buildMailMessage(
  input: OutboundMail,
  routed: RoutedMail,
  settings: MailRuntimeSettings
): SendMailOptions {
  const fromEmail = input.fromEmail || settings.smtp.defaultFromEmail;
  const fromName = input.fromName || settings.smtp.defaultFromName;
  const replyToEmail = routed.mailTestActive
    ? undefined
    : input.replyToEmail || settings.smtp.defaultReplyToEmail || undefined;
  const impersonationWarning = routed.mailTestActive && input.impersonation
    ? `IMPERSONATING was actief. Echte gebruiker: ${input.impersonation.actorName}. Geïmpersoneerde gebruiker: ${input.impersonation.effectiveUserName}. Sessie: ${input.impersonation.sessionId}.`
    : undefined;
  const warning = [routed.testWarning, impersonationWarning].filter(Boolean).join("\n");
  const effectiveRecipients = [
    ...routed.envelope.to,
    ...routed.envelope.cc,
    ...routed.envelope.bcc,
  ];
  return {
    from: fromName ? { name: fromName, address: fromEmail } : fromEmail,
    replyTo: replyToEmail,
    to: routed.envelope.to,
    cc: routed.envelope.cc.length ? routed.envelope.cc : undefined,
    bcc: routed.envelope.bcc.length ? routed.envelope.bcc : undefined,
    envelope: {
      from: fromEmail,
      to: effectiveRecipients,
    },
    subject: mailTestSubject(input.subject, routed.mailTestActive),
    text: warning ? `${warning}\n\n${input.text ?? ""}` : input.text,
    html: warning ? `${htmlMailTestWarning(warning)}${input.html ?? ""}` : input.html,
  };
}

export function assertMailProviderRecipientsAreSafe(
  message: SendMailOptions,
  routed: RoutedMail
) {
  if (!routed.mailTestActive) return;
  const testRecipient = routed.envelope.to[0]?.toLowerCase();
  if (!testRecipient) {
    throw new Error("Mail blocked: MAIL TEST is enabled without a valid test recipient.");
  }
  const providerRecipients = collectProviderRecipients(message).map((recipient) => recipient.toLowerCase());
  const hasNonTestRecipient = providerRecipients.some((recipient) => recipient !== testRecipient);
  const hasTestRecipient = providerRecipients.some((recipient) => recipient === testRecipient);
  if (!hasTestRecipient || hasNonTestRecipient) {
    throw new Error("Mail blocked: non-test recipient detected while MAIL TEST is enabled.");
  }
}

function collectProviderRecipients(message: SendMailOptions) {
  return [
    ...extractAddressValues(message.to),
    ...extractAddressValues(message.cc),
    ...extractAddressValues(message.bcc),
    ...extractAddressValues(message.envelope && typeof message.envelope === "object" ? message.envelope.to : undefined),
  ];
}

function extractAddressValues(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(extractAddressValues);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "object" && "address" in value) {
    const address = (value as { address?: unknown }).address;
    return typeof address === "string" && address.trim() ? [address.trim()] : [];
  }
  return [];
}

function mailTestSubject(subject: string, mailTestActive: boolean) {
  return mailTestActive ? `[MAIL TEST] ${subject}` : subject;
}

function htmlMailTestWarning(value: string) {
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<pre style="font-family:system-ui,sans-serif;background:#fff7ed;border:1px solid #fed7aa;padding:12px;white-space:pre-wrap;">${escaped}</pre>`;
}
