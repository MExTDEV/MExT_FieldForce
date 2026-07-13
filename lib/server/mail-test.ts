import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";

export const mailTestSettingKey = "MAIL_TEST";
export const mailTestRecipientSettingKey = "MAIL_TEST_RECIPIENT";
export const defaultMailTestRecipient = "helpdesk@mext.be";
export const mailTestRecipient = defaultMailTestRecipient;
export const mailTestProductionConfirmation = "PRODUCTIE";
const mailTestWriteAttempts = 3;
const mailTestRecipientPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type MailRuntimeEnvironment = string | undefined;
export type MailDeploymentEnvironment = string | undefined;

export function isMailTestForced(
  runtimeEnvironment: MailRuntimeEnvironment = process.env.NODE_ENV,
  deploymentEnvironment: MailDeploymentEnvironment = process.env.DEPLOYMENT_ENV
) {
  return runtimeEnvironment !== "production" || deploymentEnvironment !== "production";
}

export function effectiveMailTestActive(
  configuredActive: boolean,
  runtimeEnvironment: MailRuntimeEnvironment = process.env.NODE_ENV,
  deploymentEnvironment: MailDeploymentEnvironment = process.env.DEPLOYMENT_ENV
) {
  return isMailTestForced(runtimeEnvironment, deploymentEnvironment) || configuredActive;
}

export function assertMailTestCanBeDisabled(
  runtimeEnvironment: MailRuntimeEnvironment = process.env.NODE_ENV,
  deploymentEnvironment: MailDeploymentEnvironment = process.env.DEPLOYMENT_ENV
) {
  if (isMailTestForced(runtimeEnvironment, deploymentEnvironment)) {
    throw new Error(
      "MAIL TEST kan niet worden uitgeschakeld in een ontwikkel- of testomgeving."
    );
  }
}

export type MailEnvelope = {
  to: string[];
  cc?: string[];
  bcc?: string[];
};

export type MailRoutingContext = {
  sourceModule: string;
  entityType?: string;
  entityId?: string;
  eventKey: string;
  reason: string;
  sentAt?: Date;
};

export type RoutedMail = {
  mailTestActive: boolean;
  envelope: Required<MailEnvelope>;
  original: Required<MailEnvelope>;
  testWarning?: string;
};

export async function isMailTestActive() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: mailTestSettingKey },
    select: { value: true },
  });
  return effectiveMailTestActive(mailTestValueIsActive(setting?.value));
}

export async function getMailTestRecipient() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: mailTestRecipientSettingKey },
    select: { value: true },
  });
  return normalizeMailTestRecipient(setting?.value) ?? defaultMailTestRecipient;
}

export async function setMailTestSettings(input: {
  active: boolean;
  recipient: string;
  actorId: string;
  confirmation?: string;
}) {
  const recipient = normalizeMailTestRecipient(input.recipient);
  if (!recipient) {
    throw new Error("Geef een geldig e-mailadres voor de MAIL TEST-ontvanger in.");
  }
  if (!input.active) assertMailTestCanBeDisabled();
  if (!input.active && input.confirmation !== mailTestProductionConfirmation) {
    throw new Error(`Typ exact ${mailTestProductionConfirmation} om MAIL TEST uit te schakelen.`);
  }
  for (let attempt = 1; attempt <= mailTestWriteAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const currentRows = await tx.appSetting.findMany({
          where: { key: { in: [mailTestSettingKey, mailTestRecipientSettingKey] } },
          select: { key: true, value: true },
        });
        const current = new Map(currentRows.map((setting) => [setting.key, setting.value]));
        const previousActive = mailTestValueIsActive(current.get(mailTestSettingKey));
        const previousRecipient = normalizeMailTestRecipient(current.get(mailTestRecipientSettingKey)) ?? defaultMailTestRecipient;

        const mailTestSetting = await tx.appSetting.upsert({
          where: { key: mailTestSettingKey },
          create: {
            key: mailTestSettingKey,
            value: input.active ? "true" : "false",
            updatedById: input.actorId,
          },
          update: {
            value: input.active ? "true" : "false",
            updatedById: input.actorId,
          },
        });
        await tx.appSetting.upsert({
          where: { key: mailTestRecipientSettingKey },
          create: {
            key: mailTestRecipientSettingKey,
            value: recipient,
            updatedById: input.actorId,
          },
          update: {
            value: recipient,
            updatedById: input.actorId,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: input.actorId,
            entityType: "AppSetting",
            entityId: mailTestSetting.id,
            action: "mail_test.changed",
            oldValue: JSON.stringify({ active: previousActive, recipient: previousRecipient }),
            newValue: JSON.stringify({ active: input.active, recipient }),
          },
        });
        return { active: input.active, recipient };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (!retryable || attempt === mailTestWriteAttempts) throw error;
    }
  }
  throw new Error("MAIL TEST kon niet transactioneel worden opgeslagen.");
}

export async function setMailTestActive(active: boolean, actorId: string, confirmation?: string) {
  if (!active && confirmation !== mailTestProductionConfirmation) {
    throw new Error(`Typ exact ${mailTestProductionConfirmation} om MAIL TEST uit te schakelen.`);
  }
  const recipient = await getMailTestRecipient();
  await setMailTestSettings({ active, actorId, confirmation, recipient });
  return active;
}

export function routeMailThroughMailTest(input: {
  mailTestActive: boolean;
  mailTestRecipient?: string;
  envelope: MailEnvelope;
  context: MailRoutingContext;
  runtimeEnvironment?: MailRuntimeEnvironment;
  deploymentEnvironment?: MailDeploymentEnvironment;
}): RoutedMail {
  const original = normalizeEnvelope(input.envelope);
  const mailTestActive = effectiveMailTestActive(
    input.mailTestActive,
    input.runtimeEnvironment,
    input.deploymentEnvironment
  );
  if (!mailTestActive) {
    return {
      mailTestActive: false,
      envelope: original,
      original,
    };
  }
  const recipient = normalizeMailTestRecipient(input.mailTestRecipient) ?? defaultMailTestRecipient;
  return {
    mailTestActive: true,
    envelope: { to: [recipient], cc: [], bcc: [] },
    original,
    testWarning: buildMailTestWarning(original, input.context),
  };
}

export async function logMailDelivery(input: {
  eventKey: string;
  recipientUserId: string;
  status: string;
  routed: RoutedMail;
  context: MailRoutingContext;
  error?: string;
}) {
  await prisma.notificationDelivery.upsert({
    where: {
      eventKey_recipientUserId_channel: {
        eventKey: input.eventKey,
        recipientUserId: input.recipientUserId,
        channel: "email",
      },
    },
    create: {
      eventKey: input.eventKey,
      recipientUserId: input.recipientUserId,
      channel: "email",
      status: input.status,
      sourceModule: input.context.sourceModule,
      entityType: input.context.entityType,
      entityId: input.context.entityId,
      mailTestActive: input.routed.mailTestActive,
      originalTo: input.routed.original.to.join(", "),
      originalCc: input.routed.original.cc.join(", "),
      originalBcc: input.routed.original.bcc.join(", "),
      actualTo: input.routed.envelope.to.join(", "),
      error: input.error,
      sentAt: input.status === "sent" ? input.context.sentAt ?? new Date() : null,
    },
    update: {
      status: input.status,
      sourceModule: input.context.sourceModule,
      entityType: input.context.entityType,
      entityId: input.context.entityId,
      mailTestActive: input.routed.mailTestActive,
      originalTo: input.routed.original.to.join(", "),
      originalCc: input.routed.original.cc.join(", "),
      originalBcc: input.routed.original.bcc.join(", "),
      actualTo: input.routed.envelope.to.join(", "),
      error: input.error,
      sentAt: input.status === "sent" ? input.context.sentAt ?? new Date() : null,
      updatedAt: new Date(),
    },
  });
}

function normalizeEnvelope(envelope: MailEnvelope): Required<MailEnvelope> {
  return {
    to: uniqueNonEmpty(envelope.to),
    cc: uniqueNonEmpty(envelope.cc ?? []),
    bcc: uniqueNonEmpty(envelope.bcc ?? []),
  };
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeMailTestRecipient(value?: string | null) {
  const recipient = value?.trim();
  if (!recipient || !mailTestRecipientPattern.test(recipient)) return undefined;
  return recipient;
}

function mailTestValueIsActive(value?: string | null) {
  return value?.trim().toLowerCase() !== "false";
}

function buildMailTestWarning(original: Required<MailEnvelope>, context: MailRoutingContext) {
  return [
    "MAIL TEST is actief: deze e-mail werd niet naar de oorspronkelijke ontvanger(s) verstuurd.",
    `Oorspronkelijke To: ${original.to.join(", ") || "-"}`,
    `Oorspronkelijke CC: ${original.cc.join(", ") || "-"}`,
    `Oorspronkelijke BCC: ${original.bcc.join(", ") || "-"}`,
    `Bronmodule: ${context.sourceModule}`,
    `Record: ${context.entityType ?? "-"} ${context.entityId ?? "-"}`,
    `Gebeurtenis: ${context.eventKey}`,
    `Verzendtijdstip: ${(context.sentAt ?? new Date()).toISOString()}`,
    `Aanleiding: ${context.reason}`,
  ].join("\n");
}
