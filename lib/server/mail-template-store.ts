import { prisma } from "@/lib/server/db";
import {
  getTransactionalMailCatalogEntry,
  renderTransactionalTemplate,
  transactionalMailCatalog,
  type MailParameters,
  type TransactionalMailType,
  validateTemplateContent,
} from "@/lib/server/transactional-mail";
import type { Country, Language } from "@/lib/types";

type MailTypeRecord = { id: string; key: string; moduleCode: string };
type MailVersionRecord = {
  id: string;
  language: Language;
  version: number;
  status: string;
  subject: string;
  preheader: string | null;
  bodyHtml: string;
};
type MailTemplateRecord = { id: string; mailTypeId: string; scopeKey: string; versions?: MailVersionRecord[] };
type MailProfileRecord = {
  senderName: string | null;
  replyToEmail: string | null;
  logoAsset?: { publicUrl: string } | null;
};
type MailDelegate = {
  findMany(args: object): Promise<unknown>;
  findUnique(args: object): Promise<unknown>;
  findFirst(args: object): Promise<unknown>;
  upsert(args: object): Promise<unknown>;
  create(args: object): Promise<unknown>;
  update(args: object): Promise<unknown>;
  updateMany(args: object): Promise<unknown>;
};
export type MailDatabase = {
  mailType: MailDelegate;
  mailParameterDefinition: MailDelegate;
  mailTemplate: MailDelegate;
  mailTemplateVersion: MailDelegate;
  mailDesign: MailDelegate;
  mailCountryProfile: MailDelegate;
  mailFooter: MailDelegate;
  mailFooterVersion: MailDelegate;
  mailAsset: MailDelegate;
};

const mailDb = prisma as unknown as MailDatabase;
let catalogSeedPromise: Promise<void> | undefined;

export function getMailDatabase() {
  return mailDb;
}

export async function ensureMailTemplateCatalog() {
  catalogSeedPromise ??= seedMailTemplateCatalog().catch((error) => {
    catalogSeedPromise = undefined;
    throw error;
  });
  return catalogSeedPromise;
}

export async function resolveTransactionalMail(input: {
  type: TransactionalMailType;
  language: Language;
  country: Country;
  parameters: MailParameters;
  globalSenderName?: string;
  globalReplyToEmail?: string;
}) {
  const catalogEntry = getTransactionalMailCatalogEntry(input.type);
  if (!catalogEntry) throw new Error(`Onbekend transactioneel mailtype: ${input.type}.`);

  let stored: { version: MailVersionRecord; scopeKey: string } | undefined;
  try {
    await ensureMailTemplateCatalog();
    const mailType = (await mailDb.mailType.findUnique({ where: { key: input.type } })) as MailTypeRecord | null;
    if (mailType) {
      const candidates = [
        `MODULE_COUNTRY:${catalogEntry.moduleCode}:${input.country}`,
        `COUNTRY:${input.country}`,
        `MODULE:${catalogEntry.moduleCode}`,
        "GLOBAL",
      ];
      for (const scopeKey of candidates) {
        const template = (await mailDb.mailTemplate.findUnique({
          where: { mailTypeId_scopeKey: { mailTypeId: mailType.id, scopeKey } },
          include: { versions: { where: { language: input.language, status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 } },
        })) as MailTemplateRecord | null;
        const version = template?.versions?.[0];
        if (template && version) {
          stored = { version, scopeKey };
          break;
        }
      }
    }
  } catch {
    // A not-yet-migrated database must still be protected by the code fallback.
    stored = undefined;
  }

  let senderName = input.globalSenderName;
  let replyToEmail = input.globalReplyToEmail;
  let logoUrl: string | undefined;
  try {
    const profile = (await mailDb.mailCountryProfile.findUnique({
      where: { country: input.country },
      include: { logoAsset: true },
    })) as MailProfileRecord | null;
    senderName = profile?.senderName?.trim() || senderName;
    replyToEmail = profile?.replyToEmail?.trim() || replyToEmail;
    logoUrl = profile?.logoAsset?.publicUrl;
  } catch {
    // Country profiles are optional; global settings and the code footer remain valid.
  }

  const fallback = catalogEntry.fallback[input.language] ?? catalogEntry.fallback.nl;
  const rendered = stored
    ? renderTransactionalTemplate({
        type: input.type,
        language: input.language,
        subject: stored.version.subject,
        preheader: stored.version.preheader,
        bodyHtml: stored.version.bodyHtml,
        parameters: input.parameters,
        logoUrl,
        senderName,
      })
    : (() => {
        validateTemplateContent(input.type, fallback.subject, fallback.preheader, fallback.bodyHtml);
        return renderTransactionalTemplate({
          type: input.type,
          language: input.language,
          subject: fallback.subject,
          preheader: fallback.preheader,
          bodyHtml: fallback.bodyHtml,
          logoUrl,
          parameters: input.parameters,
          senderName,
        });
      })();
  return {
    ...rendered,
    templateVersionId: stored?.version.id,
    templateScopeKey: stored?.scopeKey ?? "SYSTEM_FALLBACK",
    senderName,
    replyToEmail,
  };
}

async function seedMailTemplateCatalog() {
  for (const entry of transactionalMailCatalog) {
    const mailType = (await mailDb.mailType.upsert({
      where: { key: entry.key },
      update: {
        moduleCode: entry.moduleCode,
        functionalNameNl: entry.functionalNameNl,
        descriptionNl: entry.descriptionNl,
        triggerDescriptionNl: entry.triggerDescriptionNl,
        systemFallbackKey: entry.key,
        active: true,
      },
      create: {
        key: entry.key,
        moduleCode: entry.moduleCode,
        functionalNameNl: entry.functionalNameNl,
        descriptionNl: entry.descriptionNl,
        triggerDescriptionNl: entry.triggerDescriptionNl,
        systemFallbackKey: entry.key,
      },
    })) as MailTypeRecord;

    for (const [sortOrder, parameter] of entry.parameters.entries()) {
      await mailDb.mailParameterDefinition.upsert({
        where: { mailTypeId_key: { mailTypeId: mailType.id, key: parameter.key } },
        update: {
          labelNl: parameter.labelNl,
          descriptionNl: parameter.descriptionNl,
          dataType: parameter.dataType,
          exampleValue: parameter.exampleValue,
          required: Boolean(parameter.required),
          formatter: parameter.formatter,
          sortOrder,
        },
        create: {
          mailTypeId: mailType.id,
          key: parameter.key,
          labelNl: parameter.labelNl,
          descriptionNl: parameter.descriptionNl,
          dataType: parameter.dataType,
          exampleValue: parameter.exampleValue,
          required: Boolean(parameter.required),
          formatter: parameter.formatter,
          sortOrder,
        },
      });
    }

    const template = (await mailDb.mailTemplate.upsert({
      where: { mailTypeId_scopeKey: { mailTypeId: mailType.id, scopeKey: "GLOBAL" } },
      update: {},
      create: { mailTypeId: mailType.id, scopeLevel: "GLOBAL", scopeKey: "GLOBAL" },
    })) as MailTemplateRecord;

    for (const language of ["nl", "fr", "de"] as const) {
      const fallback = entry.fallback[language];
      const latest = (await mailDb.mailTemplateVersion.findFirst({
        where: { templateId: template.id, language },
        orderBy: { version: "desc" },
      })) as MailVersionRecord | null;
      const published = latest?.status === "PUBLISHED";
      if (published) continue;
      const usedParameters = validateTemplateContent(entry.key, fallback.subject, fallback.preheader, fallback.bodyHtml);
      await mailDb.mailTemplateVersion.create({
        data: {
          templateId: template.id,
          language,
          version: (latest?.version ?? 0) + 1,
          status: "PUBLISHED",
          subject: fallback.subject,
          preheader: fallback.preheader,
          bodyHtml: fallback.bodyHtml,
          parameterKeysJson: JSON.stringify(usedParameters),
          changeNote: "Initiële centrale template",
          publishedAt: new Date(),
        },
      });
    }
  }
}
