import { can } from "@/lib/permissions";
import { forbidden, badRequest } from "@/lib/server/api";
import { ensureMailTemplateCatalog, getMailDatabase } from "@/lib/server/mail-template-store";
import { getTransactionalMailCatalogEntry, renderTransactionalTemplate, validateTemplateContent, type TransactionalMailType } from "@/lib/server/transactional-mail";
import { prisma } from "@/lib/server/db";
import type { Country, Language, MockUser } from "@/lib/types";
import { getMailRuntimeSettings } from "@/lib/server/mail-settings";
import { defaultMailTestRecipient, getMailTestRecipient } from "@/lib/server/mail-test";
import { sendFieldForceMail } from "@/lib/server/mail-service";
import { parseMailDesign, sanitizeMailDesign } from "@/lib/mail-design";

const supportedCountries: Country[] = ["BE", "NL", "DE"];
const supportedLanguages: Language[] = ["nl", "fr", "de"];

export async function listMailDesigns(actor: MockUser) {
  requireMailPermission(actor, "mail.templates.view");
  const db = getMailDatabase();
  return await db.mailDesign.findMany({ orderBy: [{ name: "asc" }, { createdAt: "desc" }] }) as Array<{ id: string; name: string; bodyHtml: string; createdAt: string | Date }>;
}

export async function saveMailDesign(actor: MockUser, input: { name: string; bodyHtml: string }) {
  requireMailPermission(actor, "mail.templates.edit");
  const name = input.name.trim();
  if (!name || name.length > 120) badRequest("Geef een designnaam van maximaal 120 tekens in.");
  const bodyHtml = sanitizeMailDesign(input.bodyHtml);
  if (!parseMailDesign(bodyHtml)) badRequest("Het design is ongeldig of onvolledig.");
  const db = getMailDatabase();
  return await db.mailDesign.create({ data: { name, bodyHtml, createdById: actor.id } });
}

type MailTypeRow = {
  id: string;
  key: string;
  moduleCode: string;
  functionalNameNl: string;
  descriptionNl: string;
  triggerDescriptionNl: string;
  templates: Array<{
    id: string;
    scopeLevel: string;
    scopeKey: string;
    country: Country | null;
    moduleCode: string | null;
    versions: Array<{ id: string; language: Language; version: number; status: string; subject: string; preheader: string | null; createdAt: string | Date; publishedAt: string | Date | null; createdById: string | null }>;
  }>;
  parameterDefinitions: Array<{ key: string; labelNl: string; descriptionNl: string; dataType: string; exampleValue: string | null; required: boolean; formatter: string | null; sortOrder: number }>;
};

type TemplateVersionRow = {
  id: string;
  templateId: string;
  language: Language;
  version: number;
  status: string;
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  parameterKeysJson: string;
  changeNote: string | null;
  createdById: string | null;
  publishedAt: Date | null;
  createdAt: Date;
};

export type MailTemplateDraftInput = {
  type: string;
  scopeLevel: "GLOBAL" | "COUNTRY" | "MODULE" | "MODULE_COUNTRY";
  country?: Country;
  moduleCode?: string;
  language: Language;
  subject: string;
  preheader: string;
  bodyHtml: string;
  changeNote?: string;
};

export async function listMailTemplateRows(actor: MockUser, country: Country = actor.country) {
  requireMailPermission(actor, "mail.templates.view");
  await ensureMailTemplateCatalog();
  const db = getMailDatabase();
  const records = (await db.mailType.findMany({
    orderBy: [{ moduleCode: "asc" }, { key: "asc" }],
    include: { parameterDefinitions: { orderBy: { sortOrder: "asc" } }, templates: { include: { versions: { orderBy: [{ language: "asc" }, { version: "desc" }] } } } },
  })) as MailTypeRow[];
  return records.map((mailType) => {
      const countryTemplate = mailType.templates.find((template) => template.scopeKey === `COUNTRY:${country}` && canAccessTemplateScope(actor, template.scopeLevel, template.country));
      const fallbackTemplate = mailType.templates.find((template) => template.scopeKey === "GLOBAL" && canAccessTemplateScope(actor, template.scopeLevel, template.country));
      const template = countryTemplate ?? fallbackTemplate;
      const effectiveVersions = countryTemplate?.versions ?? fallbackTemplate?.versions ?? [];
      const latest = new Map<Language, typeof mailType.templates[number]["versions"][number]>();
      const published = new Map<Language, typeof mailType.templates[number]["versions"][number]>();
      for (const version of effectiveVersions) {
        if (!latest.has(version.language)) latest.set(version.language, version);
        if (version.status === "PUBLISHED" && !published.has(version.language)) published.set(version.language, version);
      }
      return {
        id: template?.id ?? mailType.id,
        type: mailType.key,
        functionalNameNl: mailType.functionalNameNl,
        descriptionNl: mailType.descriptionNl,
        triggerDescriptionNl: mailType.triggerDescriptionNl,
        moduleCode: mailType.moduleCode,
        scopeLevel: countryTemplate?.scopeLevel ?? fallbackTemplate?.scopeLevel ?? "COUNTRY",
        scopeKey: `COUNTRY:${country}`,
        country,
        languages: supportedLanguages.map((language) => ({
          language,
          configured: latest.has(language),
          published: published.has(language),
          version: published.get(language)?.version ?? null,
          publishedAt: published.get(language)?.publishedAt ?? null,
        })),
        parameters: mailType.parameterDefinitions,
      };
    });
}

export async function getMailTemplateEditor(actor: MockUser, type: string, scopeKey = "GLOBAL") {
  requireMailPermission(actor, "mail.templates.view");
  await ensureMailTemplateCatalog();
  const db = getMailDatabase();
  const mailType = (await db.mailType.findUnique({
    where: { key: type },
    include: { parameterDefinitions: { orderBy: { sortOrder: "asc" } }, templates: { where: { scopeKey: { in: scopeKey === "GLOBAL" ? ["GLOBAL"] : [scopeKey, "GLOBAL"] } }, include: { versions: { orderBy: [{ language: "asc" }, { version: "desc" }] } } } },
  })) as MailTypeRow | null;
  if (!mailType) badRequest("Onbekend transactioneel mailtype.");
  const template = mailType.templates.find((item) => item.scopeKey === scopeKey);
  const fallbackTemplate = mailType.templates.find((item) => item.scopeKey === "GLOBAL");
  if (template && !canAccessTemplateScope(actor, template.scopeLevel, template.country)) forbidden("Deze templatescope valt buiten je landenscope.");
  const requestedCountry = scopeKey.startsWith("COUNTRY:") ? scopeKey.split(":")[1] as Country : undefined;
  if (!template && requestedCountry && !canAccessTemplateScope(actor, "COUNTRY", requestedCountry)) forbidden("Deze templatescope valt buiten je landenscope.");
  const entry = getTransactionalMailCatalogEntry(type);
  if (!entry) badRequest("Onbekend transactioneel mailtype.");
  return {
    type: mailType.key,
    functionalNameNl: mailType.functionalNameNl,
    descriptionNl: mailType.descriptionNl,
    triggerDescriptionNl: mailType.triggerDescriptionNl,
    moduleCode: mailType.moduleCode,
    scopeKey,
    scopeLevel: template?.scopeLevel ?? (scopeKey.startsWith("COUNTRY:") ? "COUNTRY" : "GLOBAL"),
    country: template?.country ?? requestedCountry ?? null,
    parameters: mailType.parameterDefinitions,
    versions: template?.versions ?? [],
    fallbackVersions: template ? [] : fallbackTemplate?.versions ?? [],
    fallback: entry.fallback,
  };
}

export async function saveMailTemplateDraft(actor: MockUser, input: MailTemplateDraftInput) {
  requireMailPermission(actor, "mail.templates.edit");
  validateMailDraftInput(input);
  const entry = getTransactionalMailCatalogEntry(input.type);
  if (!entry) badRequest("Onbekend transactioneel mailtype.");
  requireMailScopeForWrite(actor, input.scopeLevel, input.country);
  const scopeKey = scopeKeyFor(input, entry.moduleCode);
  const db = getMailDatabase();
  await ensureMailTemplateCatalog();
  const mailType = (await db.mailType.findUnique({ where: { key: input.type } })) as { id: string } | null;
  if (!mailType) badRequest("Mailtype is niet geregistreerd.");
  const existing = (await db.mailTemplate.findUnique({ where: { mailTypeId_scopeKey: { mailTypeId: mailType.id, scopeKey } } })) as { id: string } | null;
  const template = existing ?? (await db.mailTemplate.create({ data: { mailTypeId: mailType.id, scopeLevel: input.scopeLevel, scopeKey, country: input.country ?? null, moduleCode: input.moduleCode ?? (input.scopeLevel === "MODULE" || input.scopeLevel === "MODULE_COUNTRY" ? entry.moduleCode : null) } }) as { id: string });
  const latest = (await db.mailTemplateVersion.findFirst({ where: { templateId: template.id, language: input.language }, orderBy: { version: "desc" } })) as { version: number } | null;
  const bodyHtml = sanitizeMailDesign(input.bodyHtml.trim());
  const usedParameters = validateTemplateContent(input.type, input.subject, input.preheader, bodyHtml);
  const created = await db.mailTemplateVersion.create({
    data: {
      templateId: template.id,
      language: input.language,
      version: (latest?.version ?? 0) + 1,
      status: "DRAFT",
      subject: input.subject.trim(),
      preheader: input.preheader.trim() || null,
      bodyHtml,
      parameterKeysJson: JSON.stringify(usedParameters),
      changeNote: input.changeNote?.trim() || null,
      createdById: actor.id,
    },
  });
  await writeMailAudit(actor, "mail.template.draft_saved", template.id, { type: input.type, scopeKey, language: input.language, version: (created as { version: number }).version });
  return created;
}

export async function publishMailTemplateVersion(actor: MockUser, versionId: string) {
  requireMailPermission(actor, "mail.templates.publish");
  const db = getMailDatabase();
  const version = (await db.mailTemplateVersion.findUnique({ where: { id: versionId }, include: { template: true } })) as (TemplateVersionRow & { template: { id: string; scopeLevel: string; country: Country | null; mailType: { key: string } } }) | null;
  if (!version) badRequest("Templateversie niet gevonden.");
  if (!canAccessTemplateScope(actor, version.template.scopeLevel, version.template.country, true)) forbidden("Je mag deze templatescope niet publiceren.");
  validateTemplateContent(version.template.mailType.key, version.subject, version.preheader ?? "", version.bodyHtml);
  await db.mailTemplateVersion.updateMany({ where: { templateId: version.templateId, language: version.language, status: "PUBLISHED" }, data: { status: "DRAFT" } });
  const published = await db.mailTemplateVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  await writeMailAudit(actor, "mail.template.published", version.templateId, { versionId, language: version.language });
  return published;
}

export async function restoreMailTemplateVersion(actor: MockUser, versionId: string) {
  requireMailPermission(actor, "mail.templates.restore");
  const db = getMailDatabase();
  const version = (await db.mailTemplateVersion.findUnique({ where: { id: versionId }, include: { template: true } })) as (TemplateVersionRow & { template: { id: string; scopeLevel: string; country: Country | null; mailType: { key: string } } }) | null;
  if (!version) badRequest("Templateversie niet gevonden.");
  if (!canAccessTemplateScope(actor, version.template.scopeLevel, version.template.country, true)) forbidden("Je mag deze templatescope niet herstellen.");
  const latest = (await db.mailTemplateVersion.findFirst({ where: { templateId: version.templateId, language: version.language }, orderBy: { version: "desc" } })) as { version: number } | null;
  const restored = await db.mailTemplateVersion.create({ data: { templateId: version.templateId, language: version.language, version: (latest?.version ?? 0) + 1, status: "DRAFT", subject: version.subject, preheader: version.preheader, bodyHtml: version.bodyHtml, parameterKeysJson: version.parameterKeysJson, changeNote: `Herstel van versie ${version.version}`, createdById: actor.id, restoredFromId: version.id } });
  await writeMailAudit(actor, "mail.template.restored_as_draft", version.templateId, { sourceVersionId: version.id, restoredVersionId: (restored as { id: string }).id });
  return restored;
}

export async function sendMailTemplateTest(actor: MockUser, versionId: string) {
  requireMailPermission(actor, "mail.templates.test");
  const db = getMailDatabase();
  const version = (await db.mailTemplateVersion.findUnique({
    where: { id: versionId },
    include: { template: { include: { mailType: true } } },
  })) as (TemplateVersionRow & { template: { scopeLevel: string; country: Country | null; mailType: { key: string } } }) | null;
  if (!version) badRequest("Templateversie niet gevonden.");
  if (!canAccessTemplateScope(actor, version.template.scopeLevel, version.template.country)) forbidden("Je mag deze templatescope niet testen.");
  const type = version.template.mailType.key as TransactionalMailType;
  validateTemplateContent(type, version.subject, version.preheader ?? "", version.bodyHtml);
  const settings = await getMailRuntimeSettings();
  const recipient = await getMailTestRecipient() ?? defaultMailTestRecipient;
  const actorName = actor.name;
  const rendered = renderTransactionalTemplate({
    type,
    language: version.language,
    subject: version.subject,
    preheader: version.preheader,
    bodyHtml: version.bodyHtml,
    senderName: settings.smtp.defaultFromName,
    parameters: {
      ...exampleParameters(type),
      "recipient.firstName": actor.name.split(" ")[0] ?? actor.name,
      "recipient.fullName": actorName,
      "actor.fullName": actorName,
      "entity.title": "Voorbeeld uit FieldForce",
      "action.url": "https://fieldforce.example/voorbeeld",
      "action.message": "<p>Dit is een beveiligd voorbeeldbericht.</p>",
    },
  });
  const result = await sendFieldForceMail({
    recipientUserId: actor.id,
    envelope: { to: [recipient] },
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    fromName: settings.smtp.defaultFromName,
    templateVersionId: version.id,
    templateLanguage: version.language,
    templateCountry: version.template.country ?? undefined,
    correlationId: `MAIL_TEMPLATE_TEST:${version.id}:${Date.now()}`,
    context: {
      sourceModule: "BEHEER",
      entityType: "MailTemplateVersion",
      entityId: version.id,
      eventKey: `MAIL_TEMPLATE_TEST:${version.id}:${Date.now()}`,
      reason: "Testmail van transactionele template",
      sentAt: new Date(),
    },
  });
  return { status: "sent", routed: result.routed };
}

export async function sendMailTemplateDraftTest(actor: MockUser, input: {
  type: string;
  country: Country;
  language: Language;
  subject: string;
  preheader: string;
  bodyHtml: string;
}) {
  requireMailPermission(actor, "mail.templates.test");
  if (!supportedCountries.includes(input.country)) badRequest("Ongeldig template-land.");
  if (!supportedLanguages.includes(input.language)) badRequest("Ongeldige template-taal.");
  if (!canAccessTemplateScope(actor, "COUNTRY", input.country)) forbidden("Je mag deze templatescope niet testen.");
  const type = input.type as TransactionalMailType;
  validateTemplateContent(type, input.subject, input.preheader, input.bodyHtml);
  const settings = await getMailRuntimeSettings();
  const recipient = await getMailTestRecipient() ?? defaultMailTestRecipient;
  const actorName = actor.name;
  const rendered = renderTransactionalTemplate({
    type,
    language: input.language,
    subject: input.subject,
    preheader: input.preheader,
    bodyHtml: input.bodyHtml,
    senderName: settings.smtp.defaultFromName,
    parameters: {
      ...exampleParameters(type),
      "recipient.firstName": actor.name.split(" ")[0] ?? actor.name,
      "recipient.fullName": actorName,
      "actor.fullName": actorName,
      "entity.title": "Voorbeeld uit FieldForce",
      "action.url": "https://fieldforce.example/voorbeeld",
      "action.message": "<p>Dit is een beveiligd voorbeeldbericht.</p>",
    },
  });
  const eventKey = `MAIL_TEMPLATE_CURRENT_TEST:${input.type}:${input.country}:${input.language}:${Date.now()}`;
  const result = await sendFieldForceMail({
    recipientUserId: actor.id,
    envelope: { to: [recipient] },
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    fromName: settings.smtp.defaultFromName,
    templateLanguage: input.language,
    templateCountry: input.country,
    correlationId: eventKey,
    context: { sourceModule: "BEHEER", entityType: "MailType", entityId: input.type, eventKey, reason: "Testmail van huidig transactioneel maildesign", sentAt: new Date() },
  });
  return { status: "sent", routed: result.routed };
}

export function exampleParameters(type: string): Record<string, MailParameterValue> {
  const entry = getTransactionalMailCatalogEntry(type);
  if (!entry) return {};
  return Object.fromEntries(entry.parameters.map((parameter) => [parameter.key, parameter.exampleValue ?? "Voorbeeldwaarde"]));
}

function validateMailDraftInput(input: MailTemplateDraftInput) {
  if (!supportedLanguages.includes(input.language)) badRequest("Ongeldige template-taal.");
  if (input.scopeLevel === "COUNTRY" || input.scopeLevel === "MODULE_COUNTRY") {
    if (!input.country || !supportedCountries.includes(input.country)) badRequest("Een geldige country-scope is verplicht.");
  }
  if ((input.scopeLevel === "MODULE" || input.scopeLevel === "MODULE_COUNTRY") && !input.moduleCode) badRequest("Een module-scope is verplicht.");
  if (!input.subject.trim() || !input.bodyHtml.trim()) badRequest("Onderwerp en inhoud zijn verplicht.");
}

function scopeKeyFor(input: MailTemplateDraftInput, moduleCode: string) {
  if (input.scopeLevel === "GLOBAL") return "GLOBAL";
  if (input.scopeLevel === "COUNTRY") return `COUNTRY:${input.country}`;
  if (input.scopeLevel === "MODULE") return `MODULE:${input.moduleCode ?? moduleCode}`;
  return `MODULE_COUNTRY:${input.moduleCode ?? moduleCode}:${input.country}`;
}

function canAccessTemplateScope(actor: MockUser, scopeLevel: string, country: Country | null, requiresWrite = false) {
  if (scopeLevel === "GLOBAL" || scopeLevel === "MODULE") return can(actor, requiresWrite ? "mail.globalSettings.manage" : "mail.templates.view");
  if (!country) return false;
  const countries = actor.countryAccess?.length ? actor.countryAccess : [actor.country];
  return countries.includes(country) && can(actor, requiresWrite ? "mail.countrySettings.manage" : "mail.templates.view");
}

function requireMailScopeForWrite(actor: MockUser, scopeLevel: string, country?: Country) {
  if (scopeLevel === "GLOBAL" || scopeLevel === "MODULE") {
    requireMailPermission(actor, "mail.globalSettings.manage");
    return;
  }
  if (!country || !canAccessTemplateScope(actor, scopeLevel, country, true)) {
    forbidden("Deze country-scope valt buiten je toegelaten landenscope.");
  }
}

function requireMailPermission(actor: MockUser, permission: Parameters<typeof can>[1]) {
  if (!can(actor, permission)) forbidden("Je hebt geen toestemming voor dit e-mailbeheer.");
}

async function writeMailAudit(actor: MockUser, action: string, entityId: string, value: Record<string, unknown>) {
  await prismaAuditLogCreate({ userId: actor.id, entityType: "MailTemplate", entityId, action, newValue: JSON.stringify(value) });
}

async function prismaAuditLogCreate(data: { userId: string; entityType: string; entityId: string; action: string; newValue: string }) {
  await prisma.auditLog.create({ data });
}

type MailParameterValue = string | number | boolean | Date | null | undefined;
