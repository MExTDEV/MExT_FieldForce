import { prisma } from "../lib/server/db";
import { sendFieldForceMail } from "../lib/server/mail-service";
import { getMailRuntimeSettings } from "../lib/server/mail-settings";

const requiredConfirmation = "MAIL_TEST_SMOKE_SEND";

async function main() {
  if (process.env.MAIL_TEST_SMOKE_CONFIRM !== requiredConfirmation) {
    throw new Error(
      `Zet MAIL_TEST_SMOKE_CONFIRM=${requiredConfirmation} om exact één gecontroleerde testmail te versturen.`
    );
  }

  const settings = await getMailRuntimeSettings();
  if (!settings.ready) {
    const readiness = {
      smtpEnabled: settings.smtp.enabled,
      hostConfigured: Boolean(settings.smtp.host),
      portConfigured: Boolean(settings.smtp.port),
      usernameConfigured: Boolean(settings.smtp.username),
      passwordConfigured: settings.smtp.passwordConfigured,
      fromConfigured: Boolean(settings.smtp.defaultFromEmail),
    };
    throw new Error(`SMTP is niet verzendklaar: ${settings.missing.join(", ") || "onbekend"}. ${JSON.stringify(readiness)}`);
  }
  if (!settings.mailTest.active || !settings.mailTest.locked) {
    throw new Error("De gecontroleerde smoke-test mag alleen draaien wanneer MAIL TEST verplicht actief en vergrendeld is.");
  }

  const originalRecipient = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!originalRecipient?.email) {
    throw new Error("Er is geen actieve gebruiker beschikbaar om de oorspronkelijke route te simuleren.");
  }

  const now = new Date();
  const eventKey = `MAIL_TEST_SMOKE:${now.toISOString()}`;
  const result = await sendFieldForceMail({
    recipientUserId: originalRecipient.id,
    envelope: { to: [originalRecipient.email] },
    subject: "Gecontroleerde FieldForce MAIL TEST",
    text: "Dit is een gecontroleerde SMTP-smoke-test. Echte gebruikers ontvingen deze e-mail niet.",
    html: "<p>Dit is een gecontroleerde SMTP-smoke-test. Echte gebruikers ontvingen deze e-mail niet.</p>",
    context: {
      sourceModule: "BEHEER",
      entityType: "AppSetting",
      entityId: "MAIL_TEST",
      eventKey,
      reason: "Gecontroleerde SMTP-validatie van de centrale MAIL TEST-router",
      sentAt: now,
    },
  });

  const actualTo = result.routed.envelope.to;
  if (
    !result.routed.mailTestActive ||
    actualTo.length !== 1 ||
    actualTo[0]?.toLowerCase() !== settings.mailTest.recipient.toLowerCase()
  ) {
    throw new Error("De SMTP-smoke-test werd niet uitsluitend naar de ingestelde MAIL TEST-ontvanger gerouteerd.");
  }

  const delivery = await prisma.notificationDelivery.findUnique({
    where: {
      eventKey_recipientUserId_channel: {
        eventKey,
        recipientUserId: originalRecipient.id,
        channel: "email",
      },
    },
    select: { status: true, mailTestActive: true, actualTo: true },
  });
  if (
    delivery?.status !== "sent" ||
    !delivery.mailTestActive ||
    delivery.actualTo?.toLowerCase() !== settings.mailTest.recipient.toLowerCase()
  ) {
    throw new Error("Het delivery-log bevestigt de gecontroleerde MAIL TEST-verzending niet.");
  }

  console.log(JSON.stringify({
    status: delivery.status,
    mailTestActive: delivery.mailTestActive,
    actualTo: maskEmail(settings.mailTest.recipient),
    originalRecipientCount: result.routed.original.to.length,
    eventKey,
  }));
}

function maskEmail(value: string) {
  const [local = "", domain = ""] = value.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : "Onbekende fout tijdens de SMTP-smoke-test.");
    await prisma.$disconnect();
    process.exit(1);
  });
