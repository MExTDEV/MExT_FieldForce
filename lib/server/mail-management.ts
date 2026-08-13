import { can } from "@/lib/permissions";
import { forbidden, badRequest } from "@/lib/server/api";
import { ensureMailTemplateCatalog, getMailDatabase } from "@/lib/server/mail-template-store";
import { getTransactionalMailCatalogEntry, renderTransactionalTemplate, validateTemplateContent, type TransactionalMailType } from "@/lib/server/transactional-mail";
import { prisma } from "@/lib/server/db";
import type { Country, Language, MockUser } from "@/lib/types";
import { getMailRuntimeSettings } from "@/lib/server/mail-settings";
import { defaultMailTestRecipient, getMailTestRecipient } from "@/lib/server/mail-test";
import { sendFieldForceMail } from "@/lib/server/mail-service";
import { sanitizeRichText } from "@/lib/rich-text";

const supportedCountries: Country[] = ["BE", "NL", "DE"];
const supportedLanguages: Language[] = ["nl", "fr", "de"];

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

export type MailBrandingInput = {
  country: Country;
  senderName?: string;
  replyToEmail?: string;
  supportEmail?: string;
  supportPhone?: string;
  logoUrl?: string;
  footerLanguage: Language;
  footerHtml: string;
  changeNote?: string;
};

export async function getMailBranding(actor: MockUser) {
  requireMailPermission(actor, "mail.templates.view");
  const db = getMailDatabase();
  const profiles = (await db.mailCountryProfile.findMany({
    orderBy: { country: "asc" },
    include: { logoAsset: true, footers: { include: { versions: { orderBy: { version: "desc" } } } } },
  })) as Array<{
    id: string;
    country: Country;
    senderName: string | null;
    replyToEmail: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    logoAsset: { publicUrl: string } | null;
    footers: Array<{ language: Language; versions: Array<{ id: string; version: number; status: string; bodyHtml: string; changeNote: string | null }> }>;
  }>;
  return profiles.filter((profile) => isCountryInScope(actor, profile.country)).map((profile) => ({
    ...profile,
    footerVersions: profile.footers.flatMap((footer) => footer.versions.map((version) => ({ ...version, language: footer.language }))),
  }));
}

export async function saveMailBranding(actor: MockUser, input: MailBrandingInput) {
  requireMailPermission(actor, "mail.countrySettings.manage");
  if (!isCountryInScope(actor, input.country)) forbidden("Deze country-scope valt buiten je toegelaten landenscope.");
  if (!supportedLanguages.includes(input.footerLanguage)) badRequest("Ongeldige footer-taal.");
  const footerHtml = sanitizeRichText(input.footerHtml.trim());
  if (!footerHtml) badRequest("De footer mag niet leeg zijn.");
  if (/javascript:|vbscript:|data:text\/html|on[a-z]+\s*=/i.test(input.logoUrl ?? "")) badRequest("De logo-URL is niet veilig.");
  const db = getMailDatabase();
  const profile = (await db.mailCountryProfile.upsert({
    where: { country: input.country },
    create: {
      country: input.country,
      senderName: input.senderName?.trim() || null,
      replyToEmail: input.replyToEmail?.trim() || null,
      supportEmail: input.supportEmail?.trim() || null,
      supportPhone: input.supportPhone?.trim() || null,
    },
    update: {
      senderName: input.senderName?.trim() || null,
      replyToEmail: input.replyToEmail?.trim() || null,
      supportEmail: input.supportEmail?.trim() || null,
      supportPhone: input.supportPhone?.trim() || null,
    },
  })) as { id: string };
  if (input.logoUrl?.trim()) {
    await db.mailAsset.upsert({
      where: { storageKey: `mail-logo:${input.country}` },
      create: { storageKey: `mail-logo:${input.country}`, publicUrl: input.logoUrl.trim(), originalName: `logo-${input.country}`, mimeType: "image/*", byteSize: 0, altText: input.senderName?.trim() || `Logo ${input.country}`, uploadedById: actor.id },
      update: { publicUrl: input.logoUrl.trim(), altText: input.senderName?.trim() || `Logo ${input.country}`, active: true },
    });
    const asset = (await db.mailAsset.findUnique({ where: { storageKey: `mail-logo:${input.country}` } })) as { id: string } | null;
    if (asset) await db.mailCountryProfile.update({ where: { id: profile.id }, data: { logoAssetId: asset.id } });
  }
  const footer = (await db.mailFooter.upsert({ where: { profileId_language: { profileId: profile.id, language: input.footerLanguage } }, create: { profileId: profile.id, language: input.footerLanguage }, update: {} })) as { id: string };
  const latest = (await db.mailFooterVersion.findFirst({ where: { footerId: footer.id }, orderBy: { version: "desc" } })) as { version: number } | null;
  const draft = await db.mailFooterVersion.create({ data: { footerId: footer.id, version: (latest?.version ?? 0) + 1, status: "DRAFT", bodyHtml: footerHtml, changeNote: input.changeNote?.trim() || null, createdById: actor.id } });
  await writeMailAudit(actor, "mail.branding.footer_draft_saved", profile.id, { country: input.country, language: input.footerLanguage, version: (draft as { version: number }).version });
  return { profileId: profile.id, footerVersion: draft };
}

export async function publishMailFooterVersion(actor: MockUser, versionId: string) {
  requireMailPermission(actor, "mail.templates.publish");
  const db = getMailDatabase();
  const version = (await db.mailFooterVersion.findUnique({ where: { id: versionId }, include: { footer: { include: { profile: true } } } })) as { id: string; footerId: string; footer: { profile: { id: string; country: Country } } } | null;
  if (!version) badRequest("Footerversie niet gevonden.");
  if (!isCountryInScope(actor, version.footer.profile.country)) forbidden("Je mag deze country-footer niet publiceren.");
  await db.mailFooterVersion.updateMany({ where: { footerId: version.footerId, status: "PUBLISHED" }, data: { status: "DRAFT" } });
  const published = await db.mailFooterVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  await writeMailAudit(actor, "mail.branding.footer_published", version.footer.profile.id, { versionId });
  return published;
}

export async function listMailTemplateRows(actor: MockUser) {
  requireMailPermission(actor, "mail.templates.view");
  await ensureMailTemplateCatalog();
  const db = getMailDatabase();
  const records = (await db.mailType.findMany({
    orderBy: [{ moduleCode: "asc" }, { key: "asc" }],
    include: { parameterDefinitions: { orderBy: { sortOrder: "asc" } }, templates: { include: { versions: { orderBy: [{ language: "asc" }, { version: "desc" }] } } } },
  })) as MailTypeRow[];
  return records.flatMap((mailType) => mailType.templates
    .filter((template) => canAccessTemplateScope(actor, template.scopeLevel, template.country))
    .map((template) => {
      const published = new Map<Language, typeof template.versions[number]>();
      for (const version of template.versions) {
        if (version.status === "PUBLISHED" && !published.has(version.language)) published.set(version.language, version);
      }
      return {
        id: template.id,
        type: mailType.key,
        functionalNameNl: mailType.functionalNameNl,
        descriptionNl: mailType.descriptionNl,
        triggerDescriptionNl: mailType.triggerDescriptionNl,
        moduleCode: mailType.moduleCode,
        scopeLevel: template.scopeLevel,
        scopeKey: template.scopeKey,
        country: template.country,
        languages: supportedLanguages.map((language) => ({
          language,
          published: published.has(language),
          version: published.get(language)?.version ?? null,
          publishedAt: published.get(language)?.publishedAt ?? null,
        })),
        parameters: mailType.parameterDefinitions,
      };
    }));
}

export async function getMailTemplateEditor(actor: MockUser, type: string, scopeKey = "GLOBAL") {
  requireMailPermission(actor, "mail.templates.view");
  await ensureMailTemplateCatalog();
  const db = getMailDatabase();
  const mailType = (await db.mailType.findUnique({
    where: { key: type },
    include: { parameterDefinitions: { orderBy: { sortOrder: "asc" } }, templates: { where: { scopeKey }, include: { versions: { orderBy: [{ language: "asc" }, { version: "desc" }] } } } },
  })) as MailTypeRow | null;
  if (!mailType) badRequest("Onbekend transactioneel mailtype.");
  const template = mailType.templates[0];
  if (template && !canAccessTemplateScope(actor, template.scopeLevel, template.country)) forbidden("Deze templatescope valt buiten je landenscope.");
  const entry = getTransactionalMailCatalogEntry(type);
  if (!entry) badRequest("Onbekend transactioneel mailtype.");
  return {
    type: mailType.key,
    functionalNameNl: mailType.functionalNameNl,
    descriptionNl: mailType.descriptionNl,
    triggerDescriptionNl: mailType.triggerDescriptionNl,
    moduleCode: mailType.moduleCode,
    scopeKey,
    scopeLevel: template?.scopeLevel ?? "GLOBAL",
    country: template?.country ?? null,
    parameters: mailType.parameterDefinitions,
    versions: template?.versions ?? [],
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
  const usedParameters = validateTemplateContent(input.type, input.subject, input.preheader, input.bodyHtml);
  const created = await db.mailTemplateVersion.create({
    data: {
      templateId: template.id,
      language: input.language,
      version: (latest?.version ?? 0) + 1,
      status: "DRAFT",
      subject: input.subject.trim(),
      preheader: input.preheader.trim() || null,
      bodyHtml: input.bodyHtml,
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

function isCountryInScope(actor: MockUser, country: Country) {
  const countries = actor.countryAccess?.length ? actor.countryAccess : [actor.country];
  return countries.includes(country);
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
