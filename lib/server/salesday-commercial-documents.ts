import { createHash, randomUUID } from "node:crypto";

import { Prisma, type ErpIntegrationProvider, type Language } from "@prisma/client";

import { requireContractAccess } from "@/lib/contract/access";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/server/db";
import {
  buildSalesErpCommand,
  canonicalSalesErpJson,
  enqueueSalesErpCommandInTransaction,
  SalesErpError,
  type SalesErpArticle,
  type SalesErpProvider,
} from "@/lib/server/integrations/sales-erp";
import { createInventoryMovementsForSalesDocumentInTransaction } from "@/lib/server/inventory/sales-documents";
import {
  createDocumentCashEntryInTransaction,
  resolveSalesPaymentMethod,
} from "@/lib/server/salesday-cash";
import { salesDayBusinessDate } from "@/lib/server/salesday-customer-access";
import { assertSalesDayServerDayAccess } from "@/lib/server/salesday-day-access";
import type { MockUser } from "@/lib/types";

export type SalesCommercialDocumentType = "ORDER" | "ORDER_ALREADY_DELIVERED" | "INVOICE";

export type SalesDocumentLineInput = {
  articleExternalId: string;
  quantity: string;
  representativeStockQuantity: string;
  customerCarrierExternalId?: string;
};

export type SalesDocumentSignatureInput = {
  signedByName?: string;
  signatureData?: string;
  unsignedExceptionReasonId?: string;
  unsignedExceptionComment?: string;
};

export type SalesDocumentPaymentInput = {
  paymentMethodExternalId?: string;
};

type DocumentContext = {
  actor: MockUser;
  loginSessionId: string | null;
  deviceId: string;
  provider: SalesErpProvider;
  now?: Date;
};

export function proposeSalesDocumentType(input: {
  lines: { quantity: string; representativeStockQuantity: string }[];
  onsiteInvoiceAllowed?: boolean;
}): SalesCommercialDocumentType {
  if (!input.lines.length) invalid("Minstens een documentlijn is verplicht.");
  const insufficientStock = input.lines.some((line) => decimal(line.representativeStockQuantity, "Voorraad").lt(decimal(line.quantity, "Aantal")));
  if (insufficientStock) return "ORDER";
  return input.onsiteInvoiceAllowed === false ? "ORDER_ALREADY_DELIVERED" : "INVOICE";
}

export async function applySalesErpArticle(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  article: SalesErpArticle,
) {
  const normalized = normalizeSalesErpArticle(article);
  const prismaProvider = provider as ErpIntegrationProvider;
  const saved = await tx.salesArticle.upsert({
    where: { provider_externalId: { provider: prismaProvider, externalId: normalized.externalId } },
    update: {
      sourceVersion: normalized.sourceVersion,
      sourceUpdatedAt: normalized.sourceUpdatedAt,
      articleNumber: normalized.articleNumber,
      stemNumber: normalized.stemNumber,
      descriptionNl: normalized.descriptionNl,
      descriptionFr: normalized.descriptionFr,
      descriptionDe: normalized.descriptionDe,
      unit: normalized.unit,
      vatRate: normalized.vatRate,
      active: normalized.active,
      carrierBound: normalized.carrierBound,
      lotTrackingRequired: normalized.lotTrackingRequired,
      expiryTrackingRequired: normalized.expiryTrackingRequired,
    },
    create: {
      provider: prismaProvider,
      externalId: normalized.externalId,
      sourceVersion: normalized.sourceVersion,
      sourceUpdatedAt: normalized.sourceUpdatedAt,
      articleNumber: normalized.articleNumber,
      stemNumber: normalized.stemNumber,
      descriptionNl: normalized.descriptionNl,
      descriptionFr: normalized.descriptionFr,
      descriptionDe: normalized.descriptionDe,
      unit: normalized.unit,
      vatRate: normalized.vatRate,
      active: normalized.active,
      carrierBound: normalized.carrierBound,
      lotTrackingRequired: normalized.lotTrackingRequired,
      expiryTrackingRequired: normalized.expiryTrackingRequired,
    },
  });

  for (const price of normalized.prices) {
    await assertNoOverlappingSalesArticlePrice(tx, saved.id, prismaProvider, price);
    await tx.salesArticlePrice.upsert({
      where: { provider_externalId: { provider: prismaProvider, externalId: price.externalId } },
      update: {
        sourceVersion: price.sourceVersion,
        sourceUpdatedAt: price.sourceUpdatedAt,
        country: price.country,
        currency: price.currency,
        type: price.type,
        amount: price.amount,
        validFrom: price.validFrom,
        validUntil: price.validUntil,
      },
      create: {
        articleId: saved.id,
        provider: prismaProvider,
        externalId: price.externalId,
        sourceVersion: price.sourceVersion,
        sourceUpdatedAt: price.sourceUpdatedAt,
        country: price.country,
        currency: price.currency,
        type: price.type,
        amount: price.amount,
        validFrom: price.validFrom,
        validUntil: price.validUntil,
      },
    });
  }

  return saved;
}

export async function listSalesArticles(input: {
  actor: MockUser;
  provider: SalesErpProvider;
  query?: string;
  now?: Date;
}) {
  const documentDate = dateOnly(salesDayBusinessDate(input.actor, input.now));
  const query = input.query?.trim();
  return prisma.salesArticle.findMany({
    where: {
      provider: input.provider as ErpIntegrationProvider,
      active: true,
      prices: {
        some: {
          country: input.actor.country,
          type: "SALES",
          validFrom: { lte: documentDate },
          OR: [{ validUntil: null }, { validUntil: { gte: documentDate } }],
        },
      },
      ...(query ? {
        OR: [
          { articleNumber: { contains: query } },
          { descriptionNl: { contains: query } },
          { descriptionFr: { contains: query } },
          { descriptionDe: { contains: query } },
        ],
      } : {}),
    },
    include: {
      prices: {
        where: {
          country: input.actor.country,
          type: "SALES",
          validFrom: { lte: documentDate },
          OR: [{ validUntil: null }, { validUntil: { gte: documentDate } }],
        },
        orderBy: { validFrom: "desc" },
        take: 1,
      },
    },
    orderBy: [{ articleNumber: "asc" }, { id: "asc" }],
    take: 50,
  });
}

export async function listSalesDocumentSettings(actor: MockUser) {
  requireSalesDaySettings(actor);
  const [reasons, numberBlocks] = await Promise.all([
    prisma.salesDocumentReason.findMany({ orderBy: [{ kind: "asc" }, { country: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
    prisma.salesDocumentNumberBlock.findMany({
      include: { uses: { orderBy: { sequence: "asc" }, take: 20 } },
      orderBy: [{ country: "asc" }, { documentType: "asc" }, { reservedAt: "desc" }],
      take: 100,
    }),
  ]);
  return { reasons, numberBlocks };
}

export async function upsertSalesDocumentReason(input: {
  actor: MockUser;
  id?: string;
  kind: "OVERRIDE" | "UNSIGNED_EXCEPTION";
  code: string;
  labelNl: string;
  labelFr: string;
  labelDe: string;
  country?: MockUser["country"] | null;
  active?: boolean;
  requiresComment?: boolean;
  sortOrder?: number;
}) {
  requireSalesDaySettings(input.actor);
  const values = {
    kind: input.kind,
    code: required(input.code, "Redencode").toUpperCase(),
    labelNl: required(input.labelNl, "Nederlandse reden"),
    labelFr: required(input.labelFr, "Franse reden"),
    labelDe: required(input.labelDe, "Duitse reden"),
    country: input.country ?? null,
    active: input.active ?? true,
    requiresComment: input.requiresComment ?? true,
    sortOrder: input.sortOrder ?? 0,
  };
  const reason = input.id
    ? await prisma.salesDocumentReason.update({ where: { id: input.id }, data: values })
    : await prisma.salesDocumentReason.create({ data: values });
  await prisma.auditLog.create({
    data: {
      userId: input.actor.id,
      entityType: "SalesDocumentReason",
      entityId: reason.id,
      action: "salesday.salesDocument.reason.upsert",
      newValue: canonicalSalesErpJson(values),
    },
  });
  return reason;
}

export async function createSalesDocumentNumberBlock(input: {
  actor: MockUser;
  provider: SalesErpProvider;
  country: MockUser["country"];
  documentType: SalesCommercialDocumentType;
  prefix?: string;
  firstSequence: number;
  lastSequence: number;
  nextSequence?: number;
  padding?: number;
  externalId?: string;
  sourceVersion?: string;
  sourceUpdatedAt?: string;
  expiresAt?: string;
}) {
  requireSalesDaySettings(input.actor);
  const prefix = input.prefix?.trim() ?? "";
  const padding = input.padding ?? 0;
  const nextSequence = input.nextSequence ?? input.firstSequence;
  if (!Number.isInteger(input.firstSequence) || !Number.isInteger(input.lastSequence) || !Number.isInteger(nextSequence)) {
    invalid("Nummerblokgrenzen moeten gehele getallen zijn.");
  }
  if (input.firstSequence < 0 || input.lastSequence < input.firstSequence || nextSequence < input.firstSequence || nextSequence > input.lastSequence) {
    invalid("Nummerblokgrenzen zijn ongeldig.");
  }
  if (!Number.isInteger(padding) || padding < 0 || padding > 20) invalid("Nummerpadding is ongeldig.");

  return prisma.$transaction(async (tx) => {
    const overlap = await tx.salesDocumentNumberBlock.findFirst({
      where: {
        provider: input.provider as ErpIntegrationProvider,
        country: input.country,
        documentType: input.documentType,
        prefix,
        status: { in: ["ACTIVE", "EXHAUSTED"] },
        firstSequence: { lte: input.lastSequence },
        lastSequence: { gte: input.firstSequence },
      },
      select: { id: true },
    });
    if (overlap) invalid("Dit gereserveerde nummerblok overlapt met een bestaand blok.");
    const block = await tx.salesDocumentNumberBlock.create({
      data: {
        provider: input.provider as ErpIntegrationProvider,
        country: input.country,
        documentType: input.documentType,
        prefix,
        firstSequence: input.firstSequence,
        lastSequence: input.lastSequence,
        nextSequence,
        padding,
        externalId: input.externalId?.trim() || null,
        sourceVersion: input.sourceVersion?.trim() || null,
        sourceUpdatedAt: input.sourceUpdatedAt ? instant(input.sourceUpdatedAt, "nummerblok-brontijd") : null,
        expiresAt: input.expiresAt ? instant(input.expiresAt, "nummerblok-eindtijd") : null,
      },
    });
    await audit(tx, input.actor.id, "SalesDocumentNumberBlock", block.id, "salesday.salesDocument.numberBlock.created", {
      provider: input.provider,
      country: input.country,
      documentType: input.documentType,
      prefix,
      firstSequence: input.firstSequence,
      lastSequence: input.lastSequence,
    });
    return block;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reconcileSalesDocumentNumberBlock(input: {
  actor: MockUser;
  blockId: string;
  acceptedNumbers?: string[];
  skippedNumbers?: string[];
  voidedNumbers?: string[];
  now?: Date;
}) {
  requireSalesDaySettings(input.actor);
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const block = await tx.salesDocumentNumberBlock.findUnique({ where: { id: input.blockId }, include: { uses: true } });
    if (!block) invalid("Nummerblok niet gevonden.");
    const statusByNumber = new Map<string, "ACCEPTED" | "SKIPPED" | "VOIDED">();
    for (const number of input.acceptedNumbers ?? []) statusByNumber.set(number, "ACCEPTED");
    for (const number of input.skippedNumbers ?? []) statusByNumber.set(number, "SKIPPED");
    for (const number of input.voidedNumbers ?? []) statusByNumber.set(number, "VOIDED");
    for (const use of block.uses) {
      const status = statusByNumber.get(use.number);
      if (!status) continue;
      await tx.salesDocumentNumberUse.update({
        where: { id: use.id },
        data: {
          status,
          voidedAt: status === "VOIDED" ? now : use.voidedAt,
          reconciliationJson: canonicalSalesErpJson({ status, reconciledAt: now.toISOString() }),
        },
      });
    }
    const updated = await tx.salesDocumentNumberBlock.update({
      where: { id: block.id },
      data: { status: "RECONCILED", reconciledAt: now },
    });
    await audit(tx, input.actor.id, "SalesDocumentNumberBlock", block.id, "salesday.salesDocument.numberBlock.reconciled", {
      acceptedNumbers: input.acceptedNumbers ?? [],
      skippedNumbers: input.skippedNumbers ?? [],
      voidedNumbers: input.voidedNumbers ?? [],
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createSalesDocument(input: DocumentContext & {
  appointmentId: string;
  lines: SalesDocumentLineInput[];
  documentType?: SalesCommercialDocumentType;
  onsiteInvoiceAllowed?: boolean;
  overrideReasonId?: string;
  overrideComment?: string;
  language?: Language;
  currency?: string;
  payment?: SalesDocumentPaymentInput;
  signature: SalesDocumentSignatureInput;
}) {
  requireRepresentative(input.actor);
  const now = input.now ?? new Date();
  const businessDate = salesDayBusinessDate(input.actor, now);
  await assertSalesDayServerDayAccess({ ...input, businessDate, now });
  if (!input.deviceId.trim()) invalid("Een actief toestel is vereist.");
  if (!input.lines.length || input.lines.length > 100) invalid("Een document bevat 1 tot 100 lijnen.");

  return prisma.$transaction(async (tx) => {
    const closure = await tx.salesDayClosure.findUnique({
      where: { representativeUserId_businessDate: { representativeUserId: input.actor.id, businessDate: dateOnly(businessDate) } },
    });
    if (closure) denied("De afgesloten werkdag is onveranderlijk.");

    const appointment = await tx.salesAppointment.findFirst({
      where: {
        id: input.appointmentId,
        representativeUserId: input.actor.id,
        businessDate: dateOnly(businessDate),
        status: { not: "CANCELLED" },
      },
      include: {
        relation: {
          include: {
            contacts: { where: { active: true }, orderBy: [{ primary: "desc" }, { name: "asc" }] },
            addresses: { where: { active: true }, orderBy: [{ primary: "desc" }, { type: "asc" }] },
            billingValidation: true,
            externalLinks: { where: { provider: input.provider as ErpIntegrationProvider }, take: 1 },
          },
        },
      },
    });
    if (!appointment) denied("De afspraak hoort niet bij je agenda van vandaag.");

    const requestedCurrency = required(input.currency ?? "EUR", "Munt");
    if (requestedCurrency !== "EUR") invalid("Alleen EUR is in het huidige Sales ERP-contract ondersteund.");
    const currency = requestedCurrency as "EUR";
    const documentDate = dateOnly(businessDate);
    const preparedLines = await prepareDocumentLines(tx, {
      provider: input.provider,
      country: input.actor.country,
      currency,
      documentDate,
      documentType: input.documentType,
      lines: input.lines,
    });
    const proposedDocumentType = proposeSalesDocumentType({
      lines: preparedLines.map((line) => ({
        quantity: line.quantity.toFixed(3),
        representativeStockQuantity: line.representativeStockQuantity.toFixed(3),
      })),
      onsiteInvoiceAllowed: input.onsiteInvoiceAllowed,
    });
    const documentType = input.documentType ?? proposedDocumentType;
    const override = await resolveOverrideReason(tx, {
      actor: input.actor,
      requestedDocumentType: documentType,
      proposedDocumentType,
      reasonId: input.overrideReasonId,
      comment: input.overrideComment,
    });
    const lines = preparedLines.map((line) => finalizeLineForDocumentType(line, documentType));
    const paymentMethod = await resolveSalesPaymentMethod(tx, {
      provider: input.provider,
      country: input.actor.country,
      paymentMethodExternalId: input.payment?.paymentMethodExternalId,
    });
    const signature = await resolveSignatureEvidence(tx, {
      actor: input.actor,
      signature: input.signature,
      now,
    });

    const numberUse = await allocateSalesDocumentNumberInTransaction(tx, {
      provider: input.provider,
      country: input.actor.country,
      documentType,
      now,
    });
    const documentId = randomUUID();
    const commandId = randomUUID();
    const customerSnapshot = relationSnapshot(appointment.relation);
    const billingSnapshot = appointment.relation.billingValidation ? billingValidationSnapshot(appointment.relation.billingValidation) : null;
    const totals = calculateDocumentTotals(lines);
    const language = input.language ?? appointment.relation.preferredLanguage;
    const templateVersion = salesDocumentTemplateVersion(language);
    const rendered = renderSalesDocument({
      documentId,
      documentNumber: numberUse.number,
      documentType,
      proposedDocumentType,
      language,
      templateVersion,
      customer: customerSnapshot,
      lines,
      totals,
      documentDate: businessDate,
    });
    const dependencies = await salesDocumentDependencies(tx, {
      relationId: appointment.relationId,
      relationExternalId: appointment.relation.externalLinks[0]?.externalId ?? null,
      appointmentId: appointment.id,
      appointmentExternalId: appointment.externalId,
    });
    const command = buildSalesErpCommand({
      commandId,
      issuedAt: now.toISOString(),
      commandType: "sales-document.create",
      businessKey: `sales-document:${numberUse.number}`,
      dependsOnCommandIds: dependencies,
      context: commandContext(input.actor, input.deviceId, appointment.externalId ?? undefined),
      payload: {
        localDocumentId: documentId,
        documentType,
        reservedDocumentNumber: numberUse.number,
        customerExternalId: appointment.relation.externalLinks[0]?.externalId,
        localRelationId: appointment.relation.externalLinks[0]?.externalId ? undefined : appointment.relationId,
        appointmentExternalId: appointment.externalId ?? undefined,
        localAppointmentId: appointment.externalId ? undefined : appointment.id,
        documentDate: businessDate,
        language,
        currency,
        paymentMethodExternalId: paymentMethod?.externalId,
        proposedDocumentType,
        overrideReasonCode: override.reason?.code,
        overrideComment: override.comment ?? undefined,
        lines: lines.map((line) => ({
          lineId: line.id,
          articleExternalId: line.articleExternalId,
          articleNumberSnapshot: line.articleNumberSnapshot,
          descriptionSnapshot: line.descriptionSnapshot,
          quantity: line.quantity.toFixed(3),
          unitSnapshot: line.unitSnapshot,
          unitPriceSnapshot: line.unitPriceSnapshot.toFixed(4),
          vatRateSnapshot: line.vatRateSnapshot.toFixed(4),
          representativeStockImpactQuantity: line.representativeStockImpactQuantity.toFixed(3),
          customerCarrierExternalId: line.customerCarrierExternalId ?? undefined,
        })),
        signature: {
          signed: signature.status === "SIGNED",
          signedByName: signature.signedByName ?? undefined,
          signedAt: signature.signedAt.toISOString(),
          documentSha256: rendered.sha256,
          signatureUploadToken: signature.signatureUploadToken,
          exceptionReasonCode: signature.exceptionReason?.code,
          exceptionComment: signature.exceptionComment ?? undefined,
        },
      },
    });

    const document = await tx.salesDocument.create({
      data: {
        id: documentId,
        appointmentId: appointment.id,
        relationId: appointment.relationId,
        representativeUserId: input.actor.id,
        provider: input.provider as ErpIntegrationProvider,
        documentType,
        proposedDocumentType,
        documentNumber: numberUse.number,
        numberUseId: numberUse.id,
        businessDate: documentDate,
        documentDate,
        currency,
        language,
        templateVersion,
        paymentMethodId: paymentMethod?.id ?? null,
        paymentMethodExternalId: paymentMethod?.externalId ?? null,
        customerSnapshotJson: canonicalSalesErpJson(customerSnapshot),
        billingSnapshotJson: billingSnapshot ? canonicalSalesErpJson(billingSnapshot) : null,
        renderedDocumentHtml: rendered.html,
        renderedDocumentSha256: rendered.sha256,
        contentFingerprint: rendered.sha256,
        amountExcludingVat: totals.amountExcludingVat,
        vatAmount: totals.vatAmount,
        amountIncludingVat: totals.amountIncludingVat,
        overrideReasonId: override.reason?.id ?? null,
        overrideComment: override.comment,
        commandId,
        lines: {
          create: lines.map((line) => ({
            id: line.id,
            lineNumber: line.lineNumber,
            articleId: line.articleId,
            articleExternalId: line.articleExternalId,
            articleNumberSnapshot: line.articleNumberSnapshot,
            descriptionSnapshot: line.descriptionSnapshot,
            quantity: line.quantity,
            unitSnapshot: line.unitSnapshot,
            unitPriceSnapshot: line.unitPriceSnapshot,
            vatRateSnapshot: line.vatRateSnapshot,
            lineAmountExcludingVat: line.lineAmountExcludingVat,
            lineVatAmount: line.lineVatAmount,
            lineAmountIncludingVat: line.lineAmountIncludingVat,
            representativeStockQuantitySnapshot: line.representativeStockQuantity,
            representativeStockImpactQuantity: line.representativeStockImpactQuantity,
            carrierRequired: line.carrierRequired,
            customerCarrierExternalId: line.customerCarrierExternalId,
          })),
        },
        signatureEvidence: {
          create: {
            status: signature.status,
            signedByName: signature.signedByName,
            signedAt: signature.signedAt,
            signatureData: signature.signatureData,
            signatureSha256: signature.signatureSha256,
            exceptionReasonId: signature.exceptionReason?.id ?? null,
            exceptionComment: signature.exceptionComment,
            documentSha256: rendered.sha256,
            signatureContextJson: canonicalSalesErpJson({
              actorUserId: input.actor.id,
              deviceId: input.deviceId,
              documentNumber: numberUse.number,
              status: signature.status,
            }),
          },
        },
      },
      include: { lines: true, signatureEvidence: true },
    });
    await createInventoryMovementsForSalesDocumentInTransaction(tx, {
      actor: input.actor,
      documentId: document.id,
      documentType,
      commandId,
      occurredAt: now,
      lines: document.lines,
    });
    await createDocumentCashEntryInTransaction(tx, {
      document,
      paymentMethod,
      actor: input.actor,
      occurredAt: now,
      commandId,
    });
    await tx.salesDocumentNumberUse.update({
      where: { id: numberUse.id },
      data: { status: "SUBMITTED", submittedAt: now },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
    await audit(tx, input.actor.id, "SalesDocument", document.id, "salesday.salesDocument.created", {
      commandId,
      documentNumber: numberUse.number,
      documentType,
      proposedDocumentType,
      amountIncludingVat: totals.amountIncludingVat.toFixed(4),
      documentSha256: rendered.sha256,
    });
    return {
      documentId: document.id,
      commandId,
      documentNumber: numberUse.number,
      documentType,
      proposedDocumentType,
      documentSha256: rendered.sha256,
      status: document.status,
      deliveryStatus: document.deliveryStatus,
      paymentMethodExternalId: paymentMethod?.externalId ?? null,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listSalesDocumentsForAppointment(input: DocumentContext & { appointmentId: string }) {
  const businessDate = salesDayBusinessDate(input.actor, input.now);
  await assertSalesDayServerDayAccess({ ...input, businessDate, now: input.now });
  const appointment = await prisma.salesAppointment.findFirst({
    where: {
      id: input.appointmentId,
      businessDate: dateOnly(businessDate),
      ...(input.actor.role === "REPRESENTATIVE" ? { representativeUserId: input.actor.id } : managementScopeWhere(input.actor)),
    },
    select: { id: true },
  });
  if (!appointment) denied("De afspraak valt buiten je SalesDay-scope.");
  return prisma.salesDocument.findMany({
    where: { appointmentId: appointment.id },
    include: { lines: { orderBy: { lineNumber: "asc" } }, signatureEvidence: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getSalesDocumentPrintShareDescriptor(input: {
  actor: MockUser;
  documentId: string;
}) {
  const document = await prisma.salesDocument.findFirst({
    where: {
      id: input.documentId,
      OR: input.actor.role === "REPRESENTATIVE"
        ? [{ representativeUserId: input.actor.id }]
        : [{ appointment: managementScopeWhere(input.actor) }],
    },
    include: { lines: true, signatureEvidence: true },
  });
  if (!document) denied("Het salesdocument valt buiten je SalesDay-scope.");
  return {
    adapter: "STANDARD_ANDROID_PRINT_SHARE",
    directPrinterAdapter: "REPLACEABLE_BOUNDARY",
    documentId: document.id,
    documentNumber: document.documentNumber,
    fileName: `${document.documentNumber}.html`,
    mimeType: "text/html",
    html: document.renderedDocumentHtml,
    sha256: document.renderedDocumentSha256,
    printCreatesErpCommand: false,
  };
}

export async function getSalesDayContractContext(input: DocumentContext & { appointmentId: string }) {
  requireContractAccess(input.actor);
  const businessDate = salesDayBusinessDate(input.actor, input.now);
  await assertSalesDayServerDayAccess({ ...input, businessDate, now: input.now });
  const appointment = await prisma.salesAppointment.findFirst({
    where: {
      id: input.appointmentId,
      representativeUserId: input.actor.role === "REPRESENTATIVE" ? input.actor.id : undefined,
      businessDate: dateOnly(businessDate),
      ...(input.actor.role === "REPRESENTATIVE" ? {} : managementScopeWhere(input.actor)),
    },
    include: { relation: { include: { contractCustomer: true } } },
  });
  if (!appointment) denied("De afspraak valt buiten je SalesDay- of Contract-scope.");
  return {
    appointmentId: appointment.id,
    relationId: appointment.relationId,
    contractCustomerId: appointment.relation.contractCustomer?.id ?? null,
    href: `/contract/new?salesAppointmentId=${encodeURIComponent(appointment.id)}&relationId=${encodeURIComponent(appointment.relationId)}`,
  };
}

async function prepareDocumentLines(
  tx: Prisma.TransactionClient,
  input: {
    provider: SalesErpProvider;
    country: MockUser["country"];
    currency: string;
    documentDate: Date;
    documentType?: SalesCommercialDocumentType;
    lines: SalesDocumentLineInput[];
  },
) {
  const ids = [...new Set(input.lines.map((line) => required(line.articleExternalId, "Artikel-ID")))];
  if (ids.length !== input.lines.length) invalid("Een document mag hetzelfde artikel maar een keer bevatten in deze milestone.");
  const articles = await tx.salesArticle.findMany({
    where: { provider: input.provider as ErpIntegrationProvider, externalId: { in: ids }, active: true },
    include: {
      prices: {
        where: {
          country: input.country,
          currency: input.currency,
          type: "SALES",
          validFrom: { lte: input.documentDate },
          OR: [{ validUntil: null }, { validUntil: { gte: input.documentDate } }],
        },
        orderBy: { validFrom: "desc" },
        take: 1,
      },
    },
  });
  const byExternalId = new Map(articles.map((article) => [article.externalId, article]));
  return input.lines.map((line, index) => {
    const article = byExternalId.get(line.articleExternalId.trim());
    if (!article) invalid("Het gekozen artikel is niet actief in de ERP-replica.");
    const price = article.prices[0];
    if (!price) invalid("Er is geen geldige ERP-verkoopprijs voor dit artikel en land.");
    const quantity = decimal(line.quantity, "Aantal");
    if (quantity.lte(0)) invalid("Aantal moet groter zijn dan nul.");
    const representativeStockQuantity = decimal(line.representativeStockQuantity, "Voorraad");
    if (representativeStockQuantity.lt(0)) invalid("Voorraad mag niet negatief zijn.");
    const lineAmountExcludingVat = quantity.mul(price.amount);
    const lineVatAmount = lineAmountExcludingVat.mul(article.vatRate).div(100);
    const lineAmountIncludingVat = lineAmountExcludingVat.plus(lineVatAmount);
    return {
      id: randomUUID(),
      lineNumber: index + 1,
      articleId: article.id,
      articleExternalId: article.externalId,
      articleNumberSnapshot: article.articleNumber,
      descriptionSnapshot: article.descriptionNl,
      quantity,
      unitSnapshot: article.unit,
      unitPriceSnapshot: price.amount,
      vatRateSnapshot: article.vatRate,
      lineAmountExcludingVat,
      lineVatAmount,
      lineAmountIncludingVat,
      representativeStockQuantity,
      representativeStockImpactQuantity: new Prisma.Decimal(0),
      carrierRequired: article.carrierBound,
      customerCarrierExternalId: line.customerCarrierExternalId?.trim() || null,
    };
  });
}

function finalizeLineForDocumentType<T extends Awaited<ReturnType<typeof prepareDocumentLines>>[number]>(
  line: T,
  documentType: SalesCommercialDocumentType,
) {
  if (line.carrierRequired && documentType !== "ORDER" && !line.customerCarrierExternalId) {
    invalid("Een drager is verplicht voor dragergebonden artikels die direct geleverd worden.");
  }
  return {
    ...line,
    representativeStockImpactQuantity: documentType === "ORDER" ? new Prisma.Decimal(0) : line.quantity,
  };
}

async function allocateSalesDocumentNumberInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    provider: SalesErpProvider;
    country: MockUser["country"];
    documentType: SalesCommercialDocumentType;
    now: Date;
  },
) {
  const block = await tx.salesDocumentNumberBlock.findFirst({
    where: {
      provider: input.provider as ErpIntegrationProvider,
      country: input.country,
      documentType: input.documentType,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
    },
    orderBy: [{ reservedAt: "asc" }, { id: "asc" }],
  });
  if (!block || block.nextSequence > block.lastSequence) invalid("Er is geen vrij gereserveerd documentnummer beschikbaar.");
  const sequence = block.nextSequence;
  const number = `${block.prefix}${String(sequence).padStart(block.padding, "0")}`;
  const use = await tx.salesDocumentNumberUse.create({
    data: { blockId: block.id, sequence, number, status: "ALLOCATED", allocatedAt: input.now },
  });
  await tx.salesDocumentNumberBlock.update({
    where: { id: block.id },
    data: {
      nextSequence: sequence + 1,
      status: sequence >= block.lastSequence ? "EXHAUSTED" : "ACTIVE",
    },
  });
  return use;
}

async function resolveOverrideReason(
  tx: Prisma.TransactionClient,
  input: {
    actor: MockUser;
    requestedDocumentType: SalesCommercialDocumentType;
    proposedDocumentType: SalesCommercialDocumentType;
    reasonId?: string;
    comment?: string;
  },
) {
  const comment = input.comment?.trim() || null;
  if (input.requestedDocumentType === input.proposedDocumentType) {
    if (input.reasonId || comment) invalid("Een overrulereden is alleen toegestaan wanneer het documenttype wordt aangepast.");
    return { reason: null, comment: null };
  }
  if (!input.reasonId) invalid("Een overrulereden is verplicht.");
  const reason = await tx.salesDocumentReason.findFirst({
    where: {
      id: input.reasonId,
      kind: "OVERRIDE",
      active: true,
      OR: [{ country: null }, { country: input.actor.country }],
    },
  });
  if (!reason) invalid("De gekozen overrulereden is niet actief voor dit land.");
  if (reason.requiresComment && !comment) invalid("Een toelichting is verplicht voor deze overrulereden.");
  return { reason, comment };
}

async function resolveSignatureEvidence(
  tx: Prisma.TransactionClient,
  input: {
    actor: MockUser;
    signature: SalesDocumentSignatureInput;
    now: Date;
  },
) {
  const signatureData = input.signature.signatureData?.trim() || null;
  const signedByName = input.signature.signedByName?.trim() || null;
  if (signatureData) {
    if (!signedByName) invalid("De naam van de ondertekenaar is verplicht.");
    if (input.signature.unsignedExceptionReasonId) invalid("Een ondertekend document mag geen niet-ondertekenen-reden bevatten.");
    const signatureSha256 = sha256(signatureData);
    return {
      status: "SIGNED" as const,
      signedByName,
      signedAt: input.now,
      signatureData,
      signatureSha256,
      signatureUploadToken: `signature:${signatureSha256}`,
      exceptionReason: null,
      exceptionComment: null,
    };
  }
  const comment = input.signature.unsignedExceptionComment?.trim() || null;
  if (!input.signature.unsignedExceptionReasonId) invalid("Een niet-ondertekend document vereist een reden.");
  const reason = await tx.salesDocumentReason.findFirst({
    where: {
      id: input.signature.unsignedExceptionReasonId,
      kind: "UNSIGNED_EXCEPTION",
      active: true,
      OR: [{ country: null }, { country: input.actor.country }],
    },
  });
  if (!reason) invalid("De gekozen niet-ondertekenen-reden is niet actief voor dit land.");
  if (reason.requiresComment && !comment) invalid("Een toelichting is verplicht wanneer de klant niet tekent.");
  return {
    status: "UNSIGNED_EXCEPTION" as const,
    signedByName: null,
    signedAt: input.now,
    signatureData: null,
    signatureSha256: null,
    signatureUploadToken: undefined,
    exceptionReason: reason,
    exceptionComment: comment,
  };
}

async function salesDocumentDependencies(
  tx: Prisma.TransactionClient,
  input: {
    relationId: string;
    relationExternalId: string | null;
    appointmentId: string;
    appointmentExternalId: string | null;
  },
) {
  const dependencies: string[] = [];
  if (!input.relationExternalId) {
    const relationChange = await tx.businessRelationChange.findFirst({
      where: { relationId: input.relationId },
      orderBy: { createdAt: "asc" },
      select: { commandId: true },
    });
    if (!relationChange) invalid("De klant heeft nog geen bevestigde of afhankelijke ERP-identiteit.");
    dependencies.push(relationChange.commandId);
  }
  if (!input.appointmentExternalId) {
    const appointmentChange = await tx.salesAppointmentChange.findFirst({
      where: { appointmentId: input.appointmentId },
      orderBy: { createdAt: "asc" },
      select: { commandId: true },
    });
    if (!appointmentChange) invalid("De afspraak heeft nog geen bevestigde of afhankelijke ERP-identiteit.");
    dependencies.push(appointmentChange.commandId);
  }
  return [...new Set(dependencies)].sort();
}

function normalizeSalesErpArticle(article: SalesErpArticle) {
  const sourceUpdatedAt = instant(article.sourceUpdatedAt, "artikel-brontijd");
  if (!article.prices.length) invalid("Een ERP-artikel vereist minstens een prijs.");
  return {
    externalId: required(article.externalId, "artikel-ID"),
    sourceVersion: required(article.sourceVersion, "artikel-bronversie"),
    sourceUpdatedAt,
    articleNumber: required(article.articleNumber, "artikelnummer"),
    stemNumber: article.stemNumber?.trim() || null,
    descriptionNl: required(article.descriptionNl, "Nederlandse artikelomschrijving"),
    descriptionFr: required(article.descriptionFr, "Franse artikelomschrijving"),
    descriptionDe: required(article.descriptionDe, "Duitse artikelomschrijving"),
    unit: required(article.unit, "artikelunit"),
    vatRate: decimal(article.vatRate, "BTW"),
    active: article.active,
    carrierBound: article.carrierBound,
    lotTrackingRequired: article.lotTrackingRequired,
    expiryTrackingRequired: article.expiryTrackingRequired,
    prices: article.prices.map((price) => {
      const validFrom = dateOnly(price.validFrom);
      const validUntil = price.validUntil ? dateOnly(price.validUntil) : null;
      if (validUntil && validUntil < validFrom) invalid("De prijs-einddatum ligt voor de startdatum.");
      return {
        externalId: required(price.externalId, "prijs-ID"),
        sourceVersion: required(price.sourceVersion, "prijs-bronversie"),
        sourceUpdatedAt: instant(price.sourceUpdatedAt, "prijs-brontijd"),
        country: price.country,
        currency: required(price.currency, "prijsmunt"),
        type: price.type,
        amount: decimal(price.amount, "Prijs"),
        validFrom,
        validUntil,
      };
    }),
  };
}

async function assertNoOverlappingSalesArticlePrice(
  tx: Prisma.TransactionClient,
  articleId: string,
  provider: ErpIntegrationProvider,
  price: ReturnType<typeof normalizeSalesErpArticle>["prices"][number],
) {
  const farFuture = new Date("9999-12-31T00:00:00.000Z");
  const overlap = await tx.salesArticlePrice.findFirst({
    where: {
      articleId,
      country: price.country,
      currency: price.currency,
      type: price.type,
      NOT: { provider, externalId: price.externalId },
      validFrom: { lte: price.validUntil ?? farFuture },
      OR: [{ validUntil: null }, { validUntil: { gte: price.validFrom } }],
    },
    select: { id: true },
  });
  if (overlap) invalid("Overlappende ERP-prijsperiodes zijn niet toegestaan.");
}

function relationSnapshot(relation: {
  id: string;
  legalName: string;
  displayName: string;
  vatNumber: string | null;
  preferredLanguage: Language;
  country: MockUser["country"];
  contacts: { name: string; email: string | null; phone: string | null; mobile: string | null; primary: boolean }[];
  addresses: { type: string; street: string; houseNumber: string | null; postalCode: string; city: string; country: MockUser["country"]; primary: boolean }[];
}) {
  return {
    relationId: relation.id,
    legalName: relation.legalName,
    displayName: relation.displayName,
    vatNumber: relation.vatNumber,
    preferredLanguage: relation.preferredLanguage,
    country: relation.country,
    contacts: relation.contacts.map((contact) => ({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
      primary: contact.primary,
    })),
    addresses: relation.addresses.map((address) => ({
      type: address.type,
      street: address.street,
      houseNumber: address.houseNumber,
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
      primary: address.primary,
    })),
  };
}

function billingValidationSnapshot(validation: {
  status: string;
  modulo97Valid: boolean | null;
  viesCheckedAt: Date | null;
  peppolCheckedAt: Date | null;
  officialLegalName: string | null;
  officialBillingAddressJson: string | null;
}) {
  return {
    status: validation.status,
    modulo97Valid: validation.modulo97Valid,
    viesCheckedAt: validation.viesCheckedAt?.toISOString() ?? null,
    peppolCheckedAt: validation.peppolCheckedAt?.toISOString() ?? null,
    officialLegalName: validation.officialLegalName,
    officialBillingAddressJson: validation.officialBillingAddressJson,
  };
}

function calculateDocumentTotals(lines: { lineAmountExcludingVat: Prisma.Decimal; lineVatAmount: Prisma.Decimal; lineAmountIncludingVat: Prisma.Decimal }[]) {
  return lines.reduce(
    (totals, line) => ({
      amountExcludingVat: totals.amountExcludingVat.plus(line.lineAmountExcludingVat),
      vatAmount: totals.vatAmount.plus(line.lineVatAmount),
      amountIncludingVat: totals.amountIncludingVat.plus(line.lineAmountIncludingVat),
    }),
    {
      amountExcludingVat: new Prisma.Decimal(0),
      vatAmount: new Prisma.Decimal(0),
      amountIncludingVat: new Prisma.Decimal(0),
    },
  );
}

function renderSalesDocument(input: {
  documentId: string;
  documentNumber: string;
  documentType: SalesCommercialDocumentType;
  proposedDocumentType: SalesCommercialDocumentType;
  language: Language;
  templateVersion: string;
  customer: ReturnType<typeof relationSnapshot>;
  lines: ReturnType<typeof finalizeLineForDocumentType>[];
  totals: ReturnType<typeof calculateDocumentTotals>;
  documentDate: string;
}) {
  const title = input.documentType === "INVOICE" ? "Factuur" : input.documentType === "ORDER_ALREADY_DELIVERED" ? "Order-Reeds-Geleverd" : "Order";
  const html = [
    "<!doctype html><html><head><meta charset=\"utf-8\"><title>",
    escapeHtml(`${title} ${input.documentNumber}`),
    "</title></head><body>",
    `<h1>${escapeHtml(title)} ${escapeHtml(input.documentNumber)}</h1>`,
    `<p data-template-version="${escapeHtml(input.templateVersion)}">${escapeHtml(input.documentDate)} · ${escapeHtml(input.language)}</p>`,
    `<section><h2>Klant</h2><p>${escapeHtml(input.customer.displayName)}<br>${escapeHtml(input.customer.vatNumber ?? "")}</p></section>`,
    "<table><thead><tr><th>#</th><th>Artikel</th><th>Aantal</th><th>Prijs</th><th>BTW</th><th>Totaal</th></tr></thead><tbody>",
    ...input.lines.map((line) => `<tr><td>${line.lineNumber}</td><td>${escapeHtml(line.articleNumberSnapshot)} ${escapeHtml(line.descriptionSnapshot)}</td><td>${line.quantity.toFixed(3)} ${escapeHtml(line.unitSnapshot)}</td><td>${line.unitPriceSnapshot.toFixed(4)}</td><td>${line.vatRateSnapshot.toFixed(4)}</td><td>${line.lineAmountIncludingVat.toFixed(4)}</td></tr>`),
    "</tbody></table>",
    `<p data-total-excl="${input.totals.amountExcludingVat.toFixed(4)}" data-vat="${input.totals.vatAmount.toFixed(4)}" data-total-incl="${input.totals.amountIncludingVat.toFixed(4)}"></p>`,
    "</body></html>",
  ].join("");
  return { html, sha256: sha256(html) };
}

function salesDocumentTemplateVersion(language: Language) {
  return `sales-document-v1-${language}`;
}

function managementScopeWhere(actor: MockUser) {
  if (actor.role === "SUPER_ADMIN" || actor.role === "GROUP_MANAGER") return {};
  if (actor.role === "SALES_LEADER") return { teamId: actor.teamId ?? "__none__" };
  if (["SALES_MANAGER", "COUNTRY_MANAGER", "ADMIN"].includes(actor.role)) {
    return { country: { in: actor.countryAccess?.length ? actor.countryAccess : [actor.country] } };
  }
  return { representativeUserId: actor.id };
}

function commandContext(actor: MockUser, deviceId: string, appointmentExternalId?: string) {
  return {
    actorUserId: actor.id,
    representativeExternalId: actor.representativeId ?? actor.id,
    deviceId,
    country: actor.country,
    appointmentExternalId,
  };
}

async function audit(tx: Prisma.TransactionClient, userId: string, entityType: string, entityId: string, action: string, value: unknown) {
  await tx.auditLog.create({ data: { userId, entityType, entityId, action, newValue: canonicalSalesErpJson(value) } });
}

function instant(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid(`${label} is ongeldig.`);
  return date;
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("Datum moet YYYY-MM-DD gebruiken.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid("Datum is ongeldig.");
  return date;
}

function decimal(value: string | Prisma.Decimal, label: string) {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) invalid(`${label} is ongeldig.`);
    return parsed;
  } catch {
    invalid(`${label} is ongeldig.`);
  }
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) invalid(`${label} is verplicht.`);
  return normalized;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function requireRepresentative(actor: MockUser) {
  if (actor.role !== "REPRESENTATIVE") denied("Managementtoegang tot SalesDay is alleen-lezen.");
}

function requireSalesDaySettings(actor: MockUser) {
  if (!can(actor, "salesday.settings.manage")) denied("Je hebt geen recht om SalesDay-documentinstellingen te beheren.");
}

function denied(message: string): never {
  throw new SalesErpError({ code: "PERMISSION_REVOKED", message });
}

function invalid(message: string): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message });
}
