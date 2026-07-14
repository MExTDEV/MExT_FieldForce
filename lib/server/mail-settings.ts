import { Prisma } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/server/db";
import {
  assertMailTestCanBeDisabled,
  effectiveMailTestActive,
  isMailTestForced,
  mailTestProductionConfirmation,
  mailTestRecipientSettingKey,
  mailTestSettingKey,
  normalizeMailTestRecipient,
} from "@/lib/server/mail-test";

export const mailSmtpEnabledSettingKey = "MAIL_SMTP_ENABLED";
export const mailSmtpHostSettingKey = "MAIL_SMTP_HOST";
export const mailSmtpPortSettingKey = "MAIL_SMTP_PORT";
export const mailSmtpSecuritySettingKey = "MAIL_SMTP_SECURITY";
export const mailSmtpAuthTypeSettingKey = "MAIL_SMTP_AUTH_TYPE";
export const mailSmtpUsernameSettingKey = "MAIL_SMTP_USERNAME";
export const mailSmtpPasswordSettingKey = "MAIL_SMTP_PASSWORD";
export const mailDefaultFromEmailSettingKey = "MAIL_DEFAULT_FROM_EMAIL";
export const mailDefaultFromNameSettingKey = "MAIL_DEFAULT_FROM_NAME";
export const mailDefaultReplyToEmailSettingKey = "MAIL_DEFAULT_REPLY_TO_EMAIL";

const writeAttempts = 3;
const encryptedPasswordPrefix = "enc:v1:";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MailSmtpSecurity = "none" | "starttls" | "tls";
export type MailSmtpAuthType = "none" | "password";

export type MailSettings = {
  mailTest: {
    key: typeof mailTestSettingKey;
    active: boolean;
    locked: boolean;
    recipient: string;
  };
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    security: MailSmtpSecurity;
    authType: MailSmtpAuthType;
    username: string;
    passwordConfigured: boolean;
    defaultFromEmail: string;
    defaultFromName: string;
    defaultReplyToEmail: string;
  };
  ready: boolean;
  missing: string[];
};

export type MailRuntimeSettings = MailSettings & {
  smtpPassword?: string;
};

export type MailSettingsUpdate = {
  mailTestActive: boolean;
  mailTestRecipient: string;
  confirmation?: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: MailSmtpSecurity;
  smtpAuthType: MailSmtpAuthType;
  smtpUsername: string;
  smtpPassword?: string;
  clearSmtpPassword?: boolean;
  defaultFromEmail: string;
  defaultFromName: string;
  defaultReplyToEmail: string;
};

export async function getMailSettings(): Promise<MailSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...mailSettingKeys] } },
    select: { key: true, value: true },
  });
  return mailSettingsFromValues(new Map(rows.map((row) => [row.key, row.value])));
}

export async function getMailRuntimeSettings(): Promise<MailRuntimeSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...mailSettingKeys] } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const settings = mailSettingsFromValues(values);
  const storedPassword = values.get(mailSmtpPasswordSettingKey)?.trim();
  return {
    ...settings,
    smtpPassword: storedPassword ? decryptMailSecret(storedPassword) : undefined,
  };
}

export async function setMailSettings(input: MailSettingsUpdate & { actorId: string }) {
  const normalized = normalizeMailSettingsUpdate(input);
  for (let attempt = 1; attempt <= writeAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const currentRows = await tx.appSetting.findMany({
          where: { key: { in: [...mailSettingKeys] } },
          select: { key: true, value: true },
        });
        const currentValues = new Map(currentRows.map((row) => [row.key, row.value]));
        const previous = mailSettingsFromValues(currentValues);
        const passwordValue = normalized.clearSmtpPassword
          ? ""
          : normalized.smtpPassword
            ? encryptMailSecret(normalized.smtpPassword)
            : currentValues.get(mailSmtpPasswordSettingKey) ?? "";

        const values = new Map<string, string>([
          [mailTestSettingKey, normalized.mailTestActive ? "true" : "false"],
          [mailTestRecipientSettingKey, normalized.mailTestRecipient],
          [mailSmtpEnabledSettingKey, normalized.smtpEnabled ? "true" : "false"],
          [mailSmtpHostSettingKey, normalized.smtpHost],
          [mailSmtpPortSettingKey, String(normalized.smtpPort)],
          [mailSmtpSecuritySettingKey, normalized.smtpSecurity],
          [mailSmtpAuthTypeSettingKey, normalized.smtpAuthType],
          [mailSmtpUsernameSettingKey, normalized.smtpUsername],
          [mailSmtpPasswordSettingKey, passwordValue],
          [mailDefaultFromEmailSettingKey, normalized.defaultFromEmail],
          [mailDefaultFromNameSettingKey, normalized.defaultFromName],
          [mailDefaultReplyToEmailSettingKey, normalized.defaultReplyToEmail],
        ]);

        let lastSettingId = "";
        for (const [key, value] of values) {
          const setting = await tx.appSetting.upsert({
            where: { key },
            create: { key, value, updatedById: input.actorId },
            update: { value, updatedById: input.actorId },
          });
          lastSettingId = setting.id;
        }

        const next = mailSettingsFromValues(values);
        await tx.auditLog.create({
          data: {
            userId: input.actorId,
            entityType: "AppSetting",
            entityId: lastSettingId,
            action: "mail_settings.changed",
            oldValue: JSON.stringify(redactMailSettings(previous)),
            newValue: JSON.stringify(redactMailSettings(next)),
          },
        });
        return next;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (!retryable || attempt === writeAttempts) throw error;
    }
  }
  throw new Error("Mailinstellingen konden niet transactioneel worden opgeslagen.");
}

export function normalizeMailSettingsUpdate(
  input: MailSettingsUpdate,
  runtimeEnvironment = process.env.NODE_ENV,
  deploymentEnvironment = process.env.DEPLOYMENT_ENV
): MailSettingsUpdate {
  const mailTestRecipient = normalizeMailTestRecipient(input.mailTestRecipient);
  if (!mailTestRecipient) {
    throw new Error("Geef een geldig e-mailadres voor de MAIL TEST-ontvanger in.");
  }
  if (!input.mailTestActive) {
    assertMailTestCanBeDisabled(runtimeEnvironment, deploymentEnvironment);
    if (input.confirmation !== mailTestProductionConfirmation) {
      throw new Error(`Typ exact ${mailTestProductionConfirmation} om MAIL TEST uit te schakelen.`);
    }
  }
  const smtpHost = input.smtpHost.trim();
  if (input.smtpEnabled && !smtpHost) {
    throw new Error("SMTP-server is verplicht wanneer mail actief is.");
  }
  if (!Number.isInteger(input.smtpPort) || input.smtpPort < 1 || input.smtpPort > 65535) {
    throw new Error("SMTP-poort moet tussen 1 en 65535 liggen.");
  }
  if (!isMailSmtpSecurity(input.smtpSecurity)) {
    throw new Error("SMTP-protocol is ongeldig.");
  }
  if (!isMailSmtpAuthType(input.smtpAuthType)) {
    throw new Error("SMTP-authenticatie is ongeldig.");
  }
  const defaultFromEmail = normalizeEmail(input.defaultFromEmail);
  if (input.smtpEnabled && !defaultFromEmail) {
    throw new Error("Standaard afzender is verplicht wanneer mail actief is.");
  }
  const defaultReplyToEmail = normalizeEmail(input.defaultReplyToEmail);
  if (input.defaultReplyToEmail.trim() && !defaultReplyToEmail) {
    throw new Error("Standaard reply-to adres is ongeldig.");
  }
  const smtpUsername = input.smtpUsername.trim();
  if (input.smtpEnabled && input.smtpAuthType === "password" && !smtpUsername) {
    throw new Error("Gebruikersnaam is verplicht voor wachtwoord-authenticatie.");
  }
  const smtpPassword = input.smtpPassword?.trim();
  if (smtpPassword && smtpPassword.length < 8) {
    throw new Error("SMTP-wachtwoord moet minstens 8 tekens bevatten.");
  }
  return {
    mailTestActive: input.mailTestActive,
    mailTestRecipient,
    confirmation: input.confirmation,
    smtpEnabled: input.smtpEnabled,
    smtpHost,
    smtpPort: input.smtpPort,
    smtpSecurity: input.smtpSecurity,
    smtpAuthType: input.smtpAuthType,
    smtpUsername,
    smtpPassword,
    clearSmtpPassword: Boolean(input.clearSmtpPassword),
    defaultFromEmail: defaultFromEmail ?? "",
    defaultFromName: input.defaultFromName.trim(),
    defaultReplyToEmail: defaultReplyToEmail ?? "",
  };
}

export function mailSettingsFromValues(
  values: Map<string, string | null | undefined>,
  runtimeEnvironment = process.env.NODE_ENV,
  deploymentEnvironment = process.env.DEPLOYMENT_ENV
): MailSettings {
  const smtp = {
    enabled: booleanSetting(values.get(mailSmtpEnabledSettingKey), false),
    host: values.get(mailSmtpHostSettingKey)?.trim() ?? "",
    port: numberSetting(values.get(mailSmtpPortSettingKey), 587),
    security: smtpSecuritySetting(values.get(mailSmtpSecuritySettingKey)),
    authType: smtpAuthTypeSetting(values.get(mailSmtpAuthTypeSettingKey)),
    username: values.get(mailSmtpUsernameSettingKey)?.trim() ?? "",
    passwordConfigured: Boolean(values.get(mailSmtpPasswordSettingKey)?.trim()),
    defaultFromEmail: normalizeEmail(values.get(mailDefaultFromEmailSettingKey)) ?? "",
    defaultFromName: values.get(mailDefaultFromNameSettingKey)?.trim() ?? "",
    defaultReplyToEmail: normalizeEmail(values.get(mailDefaultReplyToEmailSettingKey)) ?? "",
  };
  const missing = missingMailSettings(smtp);
  return {
    mailTest: {
      key: mailTestSettingKey,
      active: effectiveMailTestActive(
        mailTestValueIsActive(values.get(mailTestSettingKey)),
        runtimeEnvironment,
        deploymentEnvironment
      ),
      locked: isMailTestForced(runtimeEnvironment, deploymentEnvironment),
      recipient: normalizeMailTestRecipient(values.get(mailTestRecipientSettingKey)) ?? "",
    },
    smtp,
    ready: smtp.enabled && missing.length === 0,
    missing,
  };
}

export function redactMailSettings(settings: MailSettings) {
  return {
    ...settings,
    smtp: {
      ...settings.smtp,
      username: settings.smtp.username ? "***" : "",
      passwordConfigured: settings.smtp.passwordConfigured,
    },
  };
}

const mailSettingKeys = [
  mailTestSettingKey,
  mailTestRecipientSettingKey,
  mailSmtpEnabledSettingKey,
  mailSmtpHostSettingKey,
  mailSmtpPortSettingKey,
  mailSmtpSecuritySettingKey,
  mailSmtpAuthTypeSettingKey,
  mailSmtpUsernameSettingKey,
  mailSmtpPasswordSettingKey,
  mailDefaultFromEmailSettingKey,
  mailDefaultFromNameSettingKey,
  mailDefaultReplyToEmailSettingKey,
] as const;

function missingMailSettings(settings: MailSettings["smtp"]) {
  if (!settings.enabled) return ["smtpDisabled"];
  const missing: string[] = [];
  if (!settings.host) missing.push("smtpHost");
  if (!settings.port) missing.push("smtpPort");
  if (!settings.defaultFromEmail) missing.push("defaultFromEmail");
  if (settings.authType === "password") {
    if (!settings.username) missing.push("smtpUsername");
    if (!settings.passwordConfigured) missing.push("smtpPassword");
  }
  return missing;
}

function booleanSetting(value: string | null | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function numberSetting(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : fallback;
}

function smtpSecuritySetting(value: string | null | undefined): MailSmtpSecurity {
  const normalized = value?.trim().toLowerCase();
  return isMailSmtpSecurity(normalized) ? normalized : "starttls";
}

function smtpAuthTypeSetting(value: string | null | undefined): MailSmtpAuthType {
  const normalized = value?.trim().toLowerCase();
  return isMailSmtpAuthType(normalized) ? normalized : "password";
}

function isMailSmtpSecurity(value: unknown): value is MailSmtpSecurity {
  return value === "none" || value === "starttls" || value === "tls";
}

function isMailSmtpAuthType(value: unknown): value is MailSmtpAuthType {
  return value === "none" || value === "password";
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim();
  if (!email) return undefined;
  return emailPattern.test(email) ? email : undefined;
}

function mailTestValueIsActive(value?: string | null) {
  return value?.trim().toLowerCase() !== "false";
}

function encryptMailSecret(value: string) {
  const secret = process.env.MAIL_SETTINGS_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("MAIL_SETTINGS_SECRET of AUTH_SECRET is verplicht om SMTP-wachtwoorden op te slaan.");
  }
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encryptedPasswordPrefix}${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

function decryptMailSecret(value: string) {
  if (!value.startsWith(encryptedPasswordPrefix)) {
    return value;
  }
  const secret = process.env.MAIL_SETTINGS_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("MAIL_SETTINGS_SECRET of AUTH_SECRET is verplicht om SMTP-wachtwoorden te lezen.");
  }
  const payload = Buffer.from(value.slice(encryptedPasswordPrefix.length), "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = createHash("sha256").update(secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
