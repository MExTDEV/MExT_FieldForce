import assert from "node:assert/strict";
import {
  buildMailMessage,
  buildSmtpTransportOptions,
  sendFieldForceMailWithTransport,
  type OutboundMail,
} from "@/lib/server/mail-service";
import { buildWorkflowMailTemplate } from "@/lib/server/mail-templates";
import type { MailRuntimeSettings } from "@/lib/server/mail-settings";

const settings: MailRuntimeSettings = {
  mailTest: {
    key: "MAIL_TEST",
    active: true,
    locked: true,
    recipient: "fieldforce-test@mext.be",
  },
  smtp: {
    enabled: true,
    host: "smtp.mext.be",
    port: 587,
    security: "starttls",
    authType: "password",
    username: "fieldforce@mext.be",
    passwordConfigured: true,
    defaultFromEmail: "fieldforce@mext.be",
    defaultFromName: "MExT FieldForce",
    defaultReplyToEmail: "helpdesk@mext.be",
  },
  smtpPassword: "supersecret",
  ready: true,
  missing: [],
};

const input: OutboundMail = {
  recipientUserId: "user-1",
  envelope: {
    to: ["real.one@mext.be", "real.two@mext.be"],
    cc: ["copy@mext.be"],
    bcc: ["hidden@mext.be"],
  },
  subject: "Hulpaanvraag beantwoord",
  text: "Er is een antwoord toegevoegd.",
  html: "<p>Er is een antwoord toegevoegd.</p>",
  context: {
    sourceModule: "HULPAANVRAGEN",
    entityType: "HelpRequest",
    entityId: "help-1",
    eventKey: "HELP_REQUEST_ANSWERED:help-1",
    reason: "Regressietest centrale mailservice",
    sentAt: new Date("2026-07-12T10:00:00.000Z"),
  },
};

async function main() {
  const sentMessages: unknown[] = [];
  const deliveryLogs: unknown[] = [];

  const result = await sendFieldForceMailWithTransport({
    input,
    settings,
    mailTestActive: false,
    mailTestRecipient: "fieldforce-test@mext.be",
    transport: {
      async sendMail(message) {
        sentMessages.push(message);
        return { messageId: "test-message-1" };
      },
    },
    async logDelivery(log) {
      deliveryLogs.push(log);
    },
  });

  assert.equal(sentMessages.length, 1);
  const message = sentMessages[0] as {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text: string;
    html: string;
    from: { name: string; address: string };
    replyTo: string;
  };
  assert.deepEqual(message.to, ["fieldforce-test@mext.be"]);
  assert.equal(message.cc, undefined);
  assert.equal(message.bcc, undefined);
  assert.equal(message.subject, "[MAIL TEST] Hulpaanvraag beantwoord");
  assert.match(message.text, /MAIL TEST is actief/);
  assert.match(message.text, /real\.one@mext\.be/);
  assert.match(message.html, /MAIL TEST is actief/);
  assert.deepEqual(message.from, { name: "MExT FieldForce", address: "fieldforce@mext.be" });
  assert.equal(message.replyTo, "helpdesk@mext.be");
  assert.equal(result.routed.mailTestActive, true);

  const replyMessage = buildMailMessage(
    { ...input, replyToEmail: "verkoopleider@mext.be" },
    result.routed,
    settings
  );
  assert.deepEqual(replyMessage.from, {
    name: "MExT FieldForce",
    address: "fieldforce@mext.be",
  });
  assert.equal(replyMessage.replyTo, "verkoopleider@mext.be");

  assert.equal(deliveryLogs.length, 1);
  const deliveryLog = deliveryLogs[0] as {
    status: string;
    routed: {
      envelope: { to: string[]; cc: string[]; bcc: string[] };
      original: { to: string[]; cc: string[]; bcc: string[] };
    };
  };
  assert.equal(deliveryLog.status, "sent");
  assert.deepEqual(deliveryLog.routed.envelope, { to: ["fieldforce-test@mext.be"], cc: [], bcc: [] });
  assert.deepEqual(deliveryLog.routed.original.to, ["real.one@mext.be", "real.two@mext.be"]);
  assert.equal(JSON.stringify(deliveryLog).includes("Er is een antwoord toegevoegd."), false);

  const transportOptions = buildSmtpTransportOptions(settings);
  assert.equal(transportOptions.host, "smtp.mext.be");
  assert.equal(transportOptions.port, 587);
  assert.equal(transportOptions.secure, false);
  assert.equal(transportOptions.requireTLS, true);
  assert.deepEqual(transportOptions.auth, {
    user: "fieldforce@mext.be",
    pass: "supersecret",
  });

  const template = buildWorkflowMailTemplate({
    type: "HELP_REQUEST_ANSWERED",
    language: "nl",
    actorName: "Verkoopleider",
    entityTitle: "Hulp bij offerte",
    linkUrl: "/hulpaanvragen/help-1",
  });
  assert.equal(template.subject, "Antwoord op hulpaanvraag");
  assert.match(template.text, /Er is een antwoord toegevoegd/);
  assert.match(template.text, /Hulp bij offerte/);
  assert.match(template.html, /Openen in FieldForce/);

  const germanTemplate = buildWorkflowMailTemplate({
    type: "COACHING_APPROVAL_REQUEST",
    language: "de",
    actorName: "Verkaufsleiter",
    entityTitle: "Begleitung Außendienst",
    linkUrl: "/begeleidingen/coaching-1",
  });
  assert.match(germanTemplate.text, /Aktion durch: Verkaufsleiter/);
  assert.match(germanTemplate.html, /In FieldForce öffnen/);

  console.log("Centrale mailservice routeert via MAIL TEST en logt geen mailbody.");
}

void main();
