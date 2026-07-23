import assert from "node:assert/strict";
import {
  assertMailProviderRecipientsAreSafe,
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
    replyTo?: string;
    envelope: { from: string; to: string[] };
  };
  assert.deepEqual(message.to, ["fieldforce-test@mext.be"]);
  assert.equal(message.cc, undefined);
  assert.equal(message.bcc, undefined);
  assert.deepEqual(message.envelope, {
    from: "fieldforce@mext.be",
    to: ["fieldforce-test@mext.be"],
  });
  assert.equal(message.subject, "[MAIL TEST] Hulpaanvraag beantwoord");
  assert.match(message.text, /MAIL TEST is actief/);
  assert.match(message.text, /real\.one@mext\.be/);
  assert.match(message.html, /MAIL TEST is actief/);
  assert.deepEqual(message.from, { name: "MExT FieldForce", address: "fieldforce@mext.be" });
  assert.equal(message.replyTo, undefined);
  assert.equal(result.routed.mailTestActive, true);

  const impersonatedMessage = buildMailMessage(
    {
      ...input,
      impersonation: {
        sessionId: "imp-session-1",
        actorName: "Jochen Admin",
        effectiveUserName: "Sophie Dubois",
      },
    },
    result.routed,
    settings
  );
  assert.match(String(impersonatedMessage.text), /IMPERSONATING was actief/);
  assert.match(String(impersonatedMessage.text), /Jochen Admin/);
  assert.match(String(impersonatedMessage.text), /Sophie Dubois/);
  assert.match(String(impersonatedMessage.html), /imp-session-1/);

  const replyMessage = buildMailMessage(
    { ...input, replyToEmail: "verkoopleider@mext.be" },
    result.routed,
    settings
  );
  assert.deepEqual(replyMessage.from, {
    name: "MExT FieldForce",
    address: "fieldforce@mext.be",
  });
  assert.equal(replyMessage.replyTo, undefined);
  assert.deepEqual(replyMessage.envelope, {
    from: "fieldforce@mext.be",
    to: ["fieldforce-test@mext.be"],
  });
  assert.throws(() => assertMailProviderRecipientsAreSafe({
    ...replyMessage,
    cc: ["manager@mext.be"],
  }, result.routed), /non-test recipient/);

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

  await assert.rejects(sendFieldForceMailWithTransport({
    input,
    settings,
    mailTestActive: true,
    mailTestRecipient: "",
    transport: {
      async sendMail(message) {
        sentMessages.push(message);
        return { messageId: "blocked-message" };
      },
    },
    async logDelivery(log) {
      deliveryLogs.push(log);
    },
  }), /zonder geldig testadres|valid test recipient/);
  assert.equal(sentMessages.length, 1);
  assert.equal((deliveryLogs[1] as { status: string; error: string }).status, "error");
  assert.match((deliveryLogs[1] as { error: string }).error, /geldig testadres/);

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
    contentHtml: "<p><strong>Oefen</strong> dit in het volgende contactmoment.</p>",
  });
  assert.equal(template.subject, "Antwoord op hulpaanvraag");
  assert.match(template.text, /Er is een antwoord toegevoegd/);
  assert.match(template.text, /Hulp bij offerte/);
  assert.match(template.text, /Oefen dit in het volgende contactmoment/);
  assert.match(template.html, /<strong>Oefen<\/strong>/);
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

  const confirmedTemplate = buildWorkflowMailTemplate({
    type: "COACHING_APPROVAL_CONFIRMED",
    language: "nl",
    actorName: "Yoni Peeters",
    entityTitle: "Begeleiding Yoni (Yoni Peeters - 2026-07-12)",
    linkUrl: "/begeleidingen/coaching-3",
  });
  assert.equal(confirmedTemplate.subject, "Begeleiding akkoord bevestigd");
  assert.match(confirmedTemplate.text, /De begeleide gebruiker heeft de begeleiding voor akkoord bevestigd/);
  assert.match(confirmedTemplate.text, /Begeleiding Yoni/);
  assert.match(confirmedTemplate.text, /Actie door: Yoni Peeters/);

  console.log("Centrale mailservice routeert via MAIL TEST en logt geen mailbody.");
}

void main();
