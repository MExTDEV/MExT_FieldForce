import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import type { Language, MockUser } from "@/lib/types";
import {
  canAccessContractCountry,
  contractCustomerWhere,
  contractOwnerWhere,
  requireContractAccess,
  requireContractManagement,
} from "@/lib/contract/access";
import {
  CONTRACT_CALCULATION_ENGINE_VERSION,
  calculateContract,
} from "@/lib/contract/calculation-engine";
import {
  MEXT_CONTRACT_MODEL_CODE,
  parseMextAllInWorkbook,
  type ContractWorkbookImport,
} from "@/lib/contract/importer/mext-all-in-2026";
import { generateAndSignContractLetter } from "@/lib/contract/letter";

export type SaveContractCalculationInput = {
  name: string;
  customerId?: string;
  customer?: {
    companyName: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
    vatNumber?: string;
    preferredLanguage?: Language;
  };
  durationYears: number;
  lines: { articleId: string; quantity: string | number }[];
};

export async function getContractOverview(actor: MockUser) {
  requireContractAccess(actor);
  const where = contractOwnerWhere(actor);
  const [calculations, customers, activeModel] = await Promise.all([
    prisma.contractCalculation.findMany({
      where,
      include: { customer: true, owner: { select: { firstName: true, lastName: true } }, lines: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.contractCustomer.findMany({
      where: contractCustomerWhere(actor),
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    getActiveContractModel(),
  ]);
  const totals = calculations.reduce((result, calculation) => {
    result.annualPrice = result.annualPrice.add(calculation.annualPrice);
    result.totalCost = result.totalCost.add(calculation.totalCost);
    return result;
  }, {
    annualPrice: new Prisma.Decimal(0),
    totalCost: new Prisma.Decimal(0),
  });
  return {
    calculations: calculations.map(serializeCalculation),
    customers: customers.map(serializeCustomer),
    activeModel: activeModel ? {
      id: activeModel.id,
      code: activeModel.code,
      label: activeModel.label,
      sourceWorkbookVersion: activeModel.sourceWorkbookVersion,
      termRules: activeModel.termRules.map((rule) => ({
        durationYears: rule.durationYears,
        discountPercentage: rule.discountPercentage.toString(),
        priceMultiplier: rule.priceMultiplier.toString(),
      })),
    } : null,
    metrics: {
      calculationCount: calculations.length,
      annualPrice: totals.annualPrice.toString(),
      totalCost: totals.totalCost.toString(),
    },
  };
}

export async function searchContractArticles(actor: MockUser, query: string) {
  requireContractAccess(actor);
  const trimmed = query.trim();
  const where = {
    active: true,
    ...(trimmed
      ? {
          OR: [
            { articleNumber: { contains: trimmed } },
            { stemNumber: { contains: trimmed } },
            { descriptionNl: { contains: trimmed } },
            { descriptionFr: { contains: trimmed } },
            { descriptionDe: { contains: trimmed } },
          ],
        }
      : {}),
  };
  const articles = await prisma.contractArticle.findMany({
    where,
    orderBy: [{ stemNumber: "asc" }, { articleNumber: "asc" }],
    take: 40,
  });
  return articles.map(serializeArticle);
}

export async function saveContractCalculation(actor: MockUser, input: SaveContractCalculationInput) {
  requireContractAccess(actor);
  if (!input.name.trim()) badRequest("contract.error.nameRequired");
  if (!input.lines.length) badRequest("contract.error.noLines");
  const activeModel = await getActiveContractModel();
  if (!activeModel) badRequest("contract.error.noActiveModel");
  const term = activeModel.termRules.find((rule) => rule.durationYears === input.durationYears && rule.active);
  if (!term) badRequest("contract.error.unsupportedDuration");
  const articles = await prisma.contractArticle.findMany({
    where: { id: { in: input.lines.map((line) => line.articleId) }, active: true },
  });
  if (articles.length !== new Set(input.lines.map((line) => line.articleId)).size) {
    badRequest("contract.error.articleUnavailable");
  }
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const result = calculateContract({
    term,
    lines: input.lines.map((line) => {
      const article = articleById.get(line.articleId);
      if (!article) badRequest("contract.error.articleUnavailable");
      return {
        articleId: article.id,
        articleNumber: article.articleNumber,
        stemNumber: article.stemNumber,
        descriptionNl: article.descriptionNl,
        descriptionFr: article.descriptionFr,
        descriptionDe: article.descriptionDe,
        unitPrice: article.unitPrice,
        unitCost: article.unitCost,
        quantity: line.quantity,
      };
    }),
  });
  const saved = await prisma.$transaction(async (tx) => {
    const customer = input.customerId
      ? await tx.contractCustomer.findFirst({ where: { id: input.customerId, ...contractCustomerWhere(actor) } })
      : await createContractCustomer(tx, actor, input.customer);
    if (!customer) notFound("contract.error.customerNotFound");
    const calculationNumber = await nextCalculationNumber(tx);
    const calculation = await tx.contractCalculation.create({
      data: {
        calculationNumber,
        name: input.name.trim(),
        customerId: customer.id,
        ownerUserId: actor.id,
        teamIdSnapshot: actor.teamId ?? null,
        countrySnapshot: actor.country,
        customerLanguage: customer.preferredLanguage,
        modelVersionId: activeModel.id,
        durationYears: result.durationYears,
        discountPercentageSnapshot: result.discountPercentage,
        subtotal: result.subtotal,
        discountAmount: result.discountAmount,
        annualPrice: result.annualPrice,
        totalCost: result.totalCost,
        lines: {
          create: result.lines.map((line, index) => ({
            ...line,
            sortOrder: index,
          })),
        },
      },
      include: { customer: true, lines: true, owner: { select: { firstName: true, lastName: true } } },
    });
    return calculation;
  });
  await writeAuditLog({
    actorId: actor.id,
    entityType: "ContractCalculation",
    entityId: saved.id,
    action: "contract.calculation.created",
    newValue: { calculationNumber: saved.calculationNumber, annualPrice: saved.annualPrice.toString() },
  });
  return serializeCalculation(saved);
}

export async function signContractCalculation(actor: MockUser, id: string, input: { signedByName: string; signedPlace?: string; signatureData?: string }) {
  const result = await generateAndSignContractLetter(actor, id, input);
  return {
    ...serializeCalculation(result.calculation),
    generatedDocument: result.document,
  };
}

export async function previewContractWorkbook(actor: MockUser, fileName: string, buffer: Buffer) {
  requireContractManagement(actor, "contractImportsManage");
  if (!/\.(xlsx|xlsm)$/i.test(fileName)) badRequest("contract.import.error.extension");
  const parsed = parseMextAllInWorkbook(buffer);
  const existingModel = await prisma.contractModelVersion.findUnique({ where: { sourceFileSha256: parsed.sourceFileSha256 } });
  const currentArticles = await prisma.contractArticle.findMany();
  const currentByNumber = new Map(currentArticles.map((article) => [article.articleNumber, article]));
  const incoming = new Map(parsed.articles.map((article) => [article.articleNumber, article]));
  const changed = parsed.articles.filter((article) => {
    const current = currentByNumber.get(article.articleNumber);
    return current && (
      current.descriptionNl !== article.descriptionNl ||
      !current.unitPrice.equals(article.unitPrice) ||
      !current.unitCost.equals(article.unitCost)
    );
  });
  const preview = {
    sourceFileName: fileName,
    sourceFileSha256: parsed.sourceFileSha256,
    sourceWorkbookVersion: parsed.sourceWorkbookVersion,
    duplicateSha: Boolean(existingModel),
    foundArticles: parsed.articles.length,
    newArticles: parsed.articles.filter((article) => !currentByNumber.has(article.articleNumber)).length,
    changedArticles: changed.length,
    deactivatedArticles: currentArticles.filter((article) => !incoming.has(article.articleNumber) && article.active).length,
    unchangedArticles: parsed.articles.length - changed.length - parsed.articles.filter((article) => !currentByNumber.has(article.articleNumber)).length,
    changedPriceRows: changed.slice(0, 100).map((article) => {
      const current = currentByNumber.get(article.articleNumber);
      return {
        articleNumber: article.articleNumber,
        description: article.descriptionNl,
        oldUnitPrice: current?.unitPrice.toString(),
        newUnitPrice: article.unitPrice,
        oldUnitCost: current?.unitCost.toString(),
        newUnitCost: article.unitCost,
      };
    }),
    termRules: parsed.termRules,
    warnings: parsed.warnings,
  };
  const run = await prisma.contractImportRun.create({
    data: {
      status: "PREVIEW_READY",
      sourceFileName: fileName,
      sourceFileSha256: parsed.sourceFileSha256,
      sourceWorkbookVersion: parsed.sourceWorkbookVersion,
      startedByUserId: actor.id,
      finishedAt: new Date(),
      foundArticles: preview.foundArticles,
      newArticles: preview.newArticles,
      changedArticles: preview.changedArticles,
      deactivatedArticles: preview.deactivatedArticles,
      unchangedArticles: preview.unchangedArticles,
      warningCount: preview.warnings.length + (preview.duplicateSha ? 1 : 0),
      previewJson: JSON.stringify({ parsed, preview }),
    },
  });
  await writeAuditLog({ actorId: actor.id, entityType: "ContractImportRun", entityId: run.id, action: "contract.import.validated", newValue: preview });
  return { id: run.id, ...preview };
}

export async function confirmContractImport(actor: MockUser, runId: string) {
  requireContractManagement(actor, "contractImportsManage");
  const run = await prisma.contractImportRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "PREVIEW_READY" || !run.previewJson) notFound("contract.import.error.runNotFound");
  const payload = JSON.parse(run.previewJson) as { parsed: ContractWorkbookImport };
  const parsed = payload.parsed;
  const result = await prisma.$transaction(async (tx) => {
    const model = await tx.contractModelVersion.create({
      data: {
        code: MEXT_CONTRACT_MODEL_CODE,
        label: `MExT All-In ${parsed.sourceWorkbookVersion ?? "2026"}`,
        status: "ACTIVE",
        sourceFileName: run.sourceFileName,
        sourceFileSha256: parsed.sourceFileSha256,
        sourceWorkbookVersion: parsed.sourceWorkbookVersion,
        calculationEngineVersion: CONTRACT_CALCULATION_ENGINE_VERSION,
        activatedAt: new Date(),
        activatedByUserId: actor.id,
        importedByUserId: actor.id,
        termRules: {
          create: parsed.termRules.map((rule, index) => ({ ...rule, sortOrder: index })),
        },
      },
    });
    await tx.contractModelVersion.updateMany({
      where: { id: { not: model.id }, status: "ACTIVE" },
      data: { status: "INACTIVE" },
    });
    const incomingNumbers = parsed.articles.map((article) => article.articleNumber);
    for (const article of parsed.articles) {
      await tx.contractArticle.upsert({
        where: { articleNumber: article.articleNumber },
        update: {
          stemNumber: article.stemNumber,
          descriptionNl: article.descriptionNl,
          descriptionFr: article.descriptionFr,
          descriptionDe: article.descriptionDe,
          unitPrice: article.unitPrice,
          unitCost: article.unitCost,
          active: true,
          externalSource: "excel",
          externalId: article.articleNumber,
          lastSyncedAt: new Date(),
          sourceModelVersionId: model.id,
        },
        create: {
          articleNumber: article.articleNumber,
          stemNumber: article.stemNumber,
          descriptionNl: article.descriptionNl,
          descriptionFr: article.descriptionFr,
          descriptionDe: article.descriptionDe,
          unitPrice: article.unitPrice,
          unitCost: article.unitCost,
          externalSource: "excel",
          externalId: article.articleNumber,
          lastSyncedAt: new Date(),
          sourceModelVersionId: model.id,
        },
      });
    }
    await tx.contractArticle.updateMany({
      where: { articleNumber: { notIn: incomingNumbers } },
      data: { active: false },
    });
    await tx.contractImportRun.update({
      where: { id: run.id },
      data: { status: "IMPORTED", modelVersionId: model.id, finishedAt: new Date() },
    });
    return model;
  }, { maxWait: 10_000, timeout: 60_000 });
  await writeAuditLog({ actorId: actor.id, entityType: "ContractImportRun", entityId: run.id, action: "contract.import.confirmed", newValue: { modelVersionId: result.id } });
  return { modelVersionId: result.id };
}

export async function listContractImports(actor: MockUser) {
  requireContractManagement(actor, "contractImportsManage");
  return prisma.contractImportRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { startedBy: { select: { firstName: true, lastName: true } }, modelVersion: true },
  });
}

export async function listContractModelVersions(actor: MockUser) {
  requireContractManagement(actor, "contractModelsManage");
  return prisma.contractModelVersion.findMany({
    orderBy: { createdAt: "desc" },
    include: { termRules: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function activateContractModelVersion(actor: MockUser, id: string) {
  requireContractManagement(actor, "contractModelsManage");
  const model = await prisma.contractModelVersion.findUnique({ where: { id }, include: { termRules: true } });
  if (!model || !model.termRules.length) notFound("contract.error.modelNotFound");
  await prisma.$transaction([
    prisma.contractModelVersion.updateMany({ where: { status: "ACTIVE" }, data: { status: "INACTIVE" } }),
    prisma.contractModelVersion.update({ where: { id }, data: { status: "ACTIVE", activatedAt: new Date(), activatedByUserId: actor.id } }),
  ]);
  await writeAuditLog({ actorId: actor.id, entityType: "ContractModelVersion", entityId: id, action: "contract.model.activated" });
  return { ok: true };
}

async function createContractCustomer(tx: Prisma.TransactionClient, actor: MockUser, customer?: SaveContractCalculationInput["customer"]) {
  if (!customer?.companyName.trim()) badRequest("contract.error.companyRequired");
  const countryCode = (customer.countryCode ?? actor.country) as MockUser["country"];
  if (!canAccessContractCountry(actor, countryCode)) forbidden("contract.error.customerScope");
  const companyName = customer.companyName.trim();
  const contactName = customer.contactName?.trim() || null;
  const email = customer.email?.trim() || null;
  const phone = customer.phone?.trim() || null;
  const address = customer.address?.trim() || null;
  const street = customer.street?.trim() || null;
  const houseNumber = customer.houseNumber?.trim() || null;
  const postalCode = customer.postalCode?.trim() || null;
  const city = customer.city?.trim() || null;
  const preferredLanguage = customer.preferredLanguage ?? actor.language;
  const businessRelation = await tx.businessRelation.create({
    data: {
      type: "CUSTOMER",
      status: "ACTIVE",
      legalName: companyName,
      displayName: companyName,
      vatNumber: customer.vatNumber?.trim() || null,
      preferredLanguage,
      country: countryCode,
      ownerUserId: actor.id,
      teamId: actor.teamId ?? null,
      billingValidation: { create: { status: "NOT_CHECKED" } },
      contacts: contactName || email || phone
        ? {
            create: {
              type: "PERSON",
              name: contactName ?? companyName,
              email,
              phone,
              primary: true,
            },
          }
        : undefined,
      addresses: address || street || postalCode || city
        ? {
            create: {
              type: "LEGAL",
              street: street ?? address ?? "",
              houseNumber,
              postalCode: postalCode ?? "",
              city: city ?? "",
              country: countryCode,
              primary: true,
            },
          }
        : undefined,
    },
  });
  return tx.contractCustomer.create({
    data: {
      companyName,
      contactName,
      email,
      phone,
      address,
      street,
      houseNumber,
      postalCode,
      city,
      countryCode,
      countrySnapshot: countryCode,
      vatNumber: customer.vatNumber?.trim() || null,
      preferredLanguage,
      ownerUserId: actor.id,
      teamIdSnapshot: actor.teamId ?? null,
      businessRelationId: businessRelation.id,
    },
  });
}

async function getActiveContractModel() {
  return prisma.contractModelVersion.findFirst({
    where: { status: "ACTIVE" },
    include: { termRules: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { activatedAt: "desc" },
  });
}

async function nextCalculationNumber(tx: Prisma.TransactionClient) {
  const now = new Date();
  const prefix = `CC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const latest = await tx.contractCalculation.findFirst({
    where: { calculationNumber: { startsWith: prefix } },
    orderBy: { calculationNumber: "desc" },
    select: { calculationNumber: true },
  });
  const next = latest ? Number(latest.calculationNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

function serializeArticle(article: Awaited<ReturnType<typeof prisma.contractArticle.findFirst>> & {}) {
  return {
    id: article.id,
    articleNumber: article.articleNumber,
    stemNumber: article.stemNumber,
    descriptionNl: article.descriptionNl,
    descriptionFr: article.descriptionFr,
    descriptionDe: article.descriptionDe,
    unitPrice: article.unitPrice.toString(),
    unitCost: article.unitCost.toString(),
    unit: article.unit,
    vatRate: article.vatRate.toString(),
    active: article.active,
  };
}

function serializeCustomer(customer: Awaited<ReturnType<typeof prisma.contractCustomer.findFirst>> & {}) {
  return {
    id: customer.id,
    companyName: customer.companyName,
    contactName: customer.contactName,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    street: customer.street,
    houseNumber: customer.houseNumber,
    postalCode: customer.postalCode,
    city: customer.city,
    countryCode: customer.countryCode,
    vatNumber: customer.vatNumber,
    preferredLanguage: customer.preferredLanguage,
    ownerUserId: customer.ownerUserId,
  };
}

function serializeCalculation(calculation: Awaited<ReturnType<typeof prisma.contractCalculation.findFirst>> & { customer: NonNullable<Awaited<ReturnType<typeof prisma.contractCustomer.findFirst>>>; lines: unknown[]; owner?: { firstName: string; lastName: string } }) {
  return {
    id: calculation.id,
    calculationNumber: calculation.calculationNumber,
    name: calculation.name,
    status: calculation.status,
    customer: serializeCustomer(calculation.customer),
    ownerName: calculation.owner ? `${calculation.owner.firstName} ${calculation.owner.lastName}`.trim() : "",
    durationYears: calculation.durationYears,
    discountPercentage: calculation.discountPercentageSnapshot.toString(),
    subtotal: calculation.subtotal.toString(),
    discountAmount: calculation.discountAmount.toString(),
    annualPrice: calculation.annualPrice.toString(),
    totalCost: calculation.totalCost.toString(),
    signedByName: calculation.signedByName,
    signedAt: calculation.signedAt?.toISOString() ?? null,
    signedPlace: calculation.signedPlace,
    createdAt: calculation.createdAt.toISOString(),
    lines: calculation.lines,
  };
}
