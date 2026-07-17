import { createHash, randomUUID } from "node:crypto";

import { Prisma, type Country, type ErpIntegrationProvider } from "@prisma/client";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/server/db";
import {
  buildSalesErpCommand,
  canonicalSalesErpJson,
  enqueueSalesErpCommandInTransaction,
  type SalesErpProvider,
} from "@/lib/server/integrations/sales-erp";
import { salesDayBusinessDate } from "@/lib/server/salesday-customer-access";
import type { MockUser } from "@/lib/types";

import {
  applyInventoryMovementInTransaction,
  decimal,
  denied,
  getOrCreateQuarantineLocation,
  getOrCreateRepresentativeVehicleLocation,
  inventoryMovementKey,
  invalid,
  normalizeOptional,
  required,
} from "./primitives";

export type ReplenishmentReceiptLineInput = {
  replenishmentLineId: string;
  actualQuantity: string;
  damagedQuantity?: string;
  discrepancyReasonId?: string;
  discrepancyComment?: string;
};

export type ReplenishmentReceiptInput = {
  replenishmentId: string;
  receiptKey?: string;
  commandId?: string;
  receivedAt?: string;
  signature: {
    signerName: string;
    signatureData: string;
    capturedAt?: string;
  };
  photos: {
    storageKey?: string;
    mimeType?: string;
    contentSha256?: string;
    capturedAt?: string;
  }[];
  lines: ReplenishmentReceiptLineInput[];
  comment?: string;
};

type ReceiptContext = {
  actor: MockUser;
  provider: SalesErpProvider;
  deviceId: string;
  now?: Date;
};

export async function listOwnReplenishments(input: { actor: MockUser; provider: SalesErpProvider }) {
  if (!can(input.actor, "inventory.receipts.acceptOwn") && !can(input.actor, "inventory.manage")) {
    denied("Je hebt geen recht om bevoorrading te bekijken.");
  }
  return prisma.inventoryReplenishment.findMany({
    where: {
      provider: input.provider as ErpIntegrationProvider,
      ...(can(input.actor, "inventory.manage")
        ? { country: { in: effectiveCountries(input.actor) } }
        : { representativeUserId: input.actor.id }),
    },
    include: {
      lines: { orderBy: [{ articleExternalId: "asc" }, { externalId: "asc" }] },
      receipts: {
        include: { lines: true, evidence: true, discrepancies: true },
        orderBy: { receivedAt: "desc" },
      },
    },
    orderBy: [{ expectedAt: "asc" }, { shippedAt: "asc" }, { id: "asc" }],
  });
}

export async function submitReplenishmentReceipt(input: ReceiptContext & { receipt: ReplenishmentReceiptInput }) {
  if (!can(input.actor, "inventory.receipts.acceptOwn")) denied("Je hebt geen recht om bevoorrading te ontvangen.");
  const now = input.now ?? new Date();
  const receiptKey = input.receipt.receiptKey?.trim() || `receipt:${randomUUID()}`;
  const commandId = input.receipt.commandId?.trim() || receiptKey;
  const receivedAt = parseInstant(input.receipt.receivedAt, now);
  const signature = normalizeSignature(input.receipt.signature, receivedAt);
  const photos = normalizePhotos(input.receipt.photos, receivedAt);
  if (!input.receipt.lines.length) invalid("Minstens een ontvangstlijn is verplicht.");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryReceipt.findUnique({
      where: { receiptKey },
      include: { lines: true, evidence: true, discrepancies: true },
    });
    if (existing) return { receipt: existing, idempotent: true };

    const replenishment = await tx.inventoryReplenishment.findFirst({
      where: {
        id: input.receipt.replenishmentId,
        provider: input.provider as ErpIntegrationProvider,
        representativeUserId: input.actor.id,
        status: { in: ["IN_TRANSIT", "PARTIALLY_RECEIVED"] },
      },
      include: { lines: true },
    });
    if (!replenishment) denied("Deze bevoorrading valt buiten je scope of is niet meer ontvangbaar.");
    if (!replenishment.transitLocationId) invalid("Bevoorrading mist een transitlocatie.");

    const vehicle = await getOrCreateRepresentativeVehicleLocation(tx, {
      country: replenishment.country,
      representativeUserId: input.actor.id,
      name: "Voorraad vertegenwoordiger",
    });
    const quarantine = await getOrCreateQuarantineLocation(tx, {
      country: replenishment.country,
      representativeUserId: input.actor.id,
    });
    const receipt = await tx.inventoryReceipt.create({
      data: {
        receiptKey,
        replenishmentId: replenishment.id,
        actorUserId: input.actor.id,
        receivedAt,
        comment: normalizeOptional(input.receipt.comment),
        commandId,
        evidence: {
          create: [
            {
              type: "REPRESENTATIVE_SIGNATURE",
              signerName: signature.signerName,
              signatureData: signature.signatureData,
              contentSha256: signature.sha256,
              capturedAt: signature.capturedAt,
            },
            ...photos.map((photo) => ({
              type: "PHOTO" as const,
              storageKey: photo.storageKey,
              mimeType: photo.mimeType,
              contentSha256: photo.contentSha256,
              capturedAt: photo.capturedAt,
            })),
          ],
        },
      },
    });
    const lineById = new Map(replenishment.lines.map((line) => [line.id, line]));
    const commandLines: { replenishmentLineExternalId: string; actualQuantity: string; damagedQuantity: string; unit: string; discrepancyComment?: string }[] = [];

    for (const [index, rawLine] of input.receipt.lines.entries()) {
      const replenishmentLine = lineById.get(rawLine.replenishmentLineId);
      if (!replenishmentLine) invalid("Ontvangstlijn hoort niet bij deze bevoorrading.");
      const actualQuantity = decimal(rawLine.actualQuantity, "Werkelijk ontvangen aantal");
      const damagedQuantity = decimal(rawLine.damagedQuantity ?? "0", "Beschadigd aantal");
      if (actualQuantity.lt(0) || damagedQuantity.lt(0)) invalid("Ontvangen aantallen mogen niet negatief zijn.");
      if (damagedQuantity.gt(actualQuantity)) invalid("Beschadigd aantal mag niet groter zijn dan werkelijk ontvangen aantal.");
      const sellableQuantity = actualQuantity.minus(damagedQuantity);
      const expectedRemaining = maxDecimal(
        new Prisma.Decimal(0),
        replenishmentLine.expectedQuantity.minus(replenishmentLine.receivedQuantity),
      );
      const expectedPortion = minDecimal(actualQuantity, expectedRemaining);
      const damagedFromTransit = minDecimal(damagedQuantity, expectedPortion);
      const sellableFromTransit = expectedPortion.minus(damagedFromTransit);
      const excessDamaged = damagedQuantity.minus(damagedFromTransit);
      const excessSellable = sellableQuantity.minus(sellableFromTransit);
      const receiptLine = await tx.inventoryReceiptLine.create({
        data: {
          receiptId: receipt.id,
          replenishmentLineId: replenishmentLine.id,
          articleExternalId: replenishmentLine.articleExternalId,
          articleNumberSnapshot: replenishmentLine.articleNumberSnapshot,
          receivedQuantity: actualQuantity,
          damagedQuantity,
          excessQuantity: maxDecimal(new Prisma.Decimal(0), actualQuantity.minus(expectedRemaining)),
          unit: replenishmentLine.unit,
          lotNumber: replenishmentLine.lotNumber,
          expiryDate: replenishmentLine.expiryDate,
        },
      });
      await tx.inventoryReplenishmentLine.update({
        where: { id: replenishmentLine.id },
        data: {
          receivedQuantity: { increment: actualQuantity },
          damagedQuantity: { increment: damagedQuantity },
        },
      });
      await createReceiptDiscrepancies(tx, {
        receiptId: receipt.id,
        receiptLineId: receiptLine.id,
        articleExternalId: replenishmentLine.articleExternalId,
        unit: replenishmentLine.unit,
        expectedRemaining,
        actualQuantity,
        damagedQuantity,
        reasonId: rawLine.discrepancyReasonId,
        comment: rawLine.discrepancyComment,
      });
      await moveReceiptQuantity(tx, {
        movementKey: inventoryMovementKey("receipt-sellable-transit", { receiptKey, index }),
        actorUserId: input.actor.id,
        fromLocationId: replenishment.transitLocationId,
        toLocationId: vehicle.id,
        quantity: sellableFromTransit,
        receiptLineId: receiptLine.id,
        line: replenishmentLine,
        commandId,
        occurredAt: receivedAt,
      });
      await moveReceiptQuantity(tx, {
        movementKey: inventoryMovementKey("receipt-damaged-transit", { receiptKey, index }),
        actorUserId: input.actor.id,
        fromLocationId: replenishment.transitLocationId,
        toLocationId: quarantine.id,
        quantity: damagedFromTransit,
        receiptLineId: receiptLine.id,
        line: replenishmentLine,
        commandId,
        occurredAt: receivedAt,
        type: "REPLENISHMENT_DAMAGED_QUARANTINE",
      });
      await moveReceiptQuantity(tx, {
        movementKey: inventoryMovementKey("receipt-excess-sellable", { receiptKey, index }),
        actorUserId: input.actor.id,
        fromLocationId: null,
        toLocationId: vehicle.id,
        quantity: excessSellable,
        receiptLineId: receiptLine.id,
        line: replenishmentLine,
        commandId,
        occurredAt: receivedAt,
      });
      await moveReceiptQuantity(tx, {
        movementKey: inventoryMovementKey("receipt-excess-damaged", { receiptKey, index }),
        actorUserId: input.actor.id,
        fromLocationId: null,
        toLocationId: quarantine.id,
        quantity: excessDamaged,
        receiptLineId: receiptLine.id,
        line: replenishmentLine,
        commandId,
        occurredAt: receivedAt,
        type: "REPLENISHMENT_DAMAGED_QUARANTINE",
      });
      commandLines.push({
        replenishmentLineExternalId: replenishmentLine.externalId,
        actualQuantity: actualQuantity.toFixed(3),
        damagedQuantity: damagedQuantity.toFixed(3),
        unit: replenishmentLine.unit,
        discrepancyComment: normalizeOptional(rawLine.discrepancyComment) ?? undefined,
      });
    }

    await updateReplenishmentStatus(tx, replenishment.id, receivedAt);
    const command = buildSalesErpCommand({
      commandType: "replenishment-receipt.submit",
      commandId,
      businessKey: `replenishment-receipt:${receipt.id}`,
      issuedAt: now.toISOString(),
      context: {
        actorUserId: input.actor.id,
        representativeExternalId: input.actor.representativeId ?? input.actor.id,
        deviceId: input.deviceId,
        country: input.actor.country,
      },
      payload: {
        localReceiptId: receipt.id,
        replenishmentExternalId: replenishment.externalId,
        receivedAt: receivedAt.toISOString(),
        lines: commandLines,
        representativeSignatureUploadToken: `signature:${signature.sha256}`,
        photoUploadTokens: photos.map((photo) => photo.uploadToken),
      },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate: salesDayBusinessDate(input.actor, now) });
    await audit(tx, input.actor.id, "InventoryReceipt", receipt.id, "inventory.receipt.submitted", {
      commandId,
      replenishmentId: replenishment.id,
      photoCount: photos.length,
    });
    const saved = await tx.inventoryReceipt.findUniqueOrThrow({
      where: { id: receipt.id },
      include: { lines: true, evidence: true, discrepancies: true },
    });
    return { receipt: saved, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function createReceiptDiscrepancies(
  tx: Prisma.TransactionClient,
  input: {
    receiptId: string;
    receiptLineId: string;
    articleExternalId: string;
    unit: string;
    expectedRemaining: Prisma.Decimal;
    actualQuantity: Prisma.Decimal;
    damagedQuantity: Prisma.Decimal;
    reasonId?: string;
    comment?: string;
  },
) {
  const comment = normalizeOptional(input.comment);
  const reasonId = input.reasonId?.trim() || null;
  const discrepancyBase = {
    receiptId: input.receiptId,
    receiptLineId: input.receiptLineId,
    articleExternalId: input.articleExternalId,
    unit: input.unit,
    reasonId,
    comment,
  };
  if (input.actualQuantity.lt(input.expectedRemaining)) {
    await tx.inventoryDiscrepancy.create({
      data: {
        ...discrepancyBase,
        type: "SHORTAGE",
        quantity: input.expectedRemaining.minus(input.actualQuantity),
      },
    });
  }
  if (input.actualQuantity.gt(input.expectedRemaining)) {
    await tx.inventoryDiscrepancy.create({
      data: {
        ...discrepancyBase,
        type: "EXCESS",
        quantity: input.actualQuantity.minus(input.expectedRemaining),
      },
    });
  }
  if (input.damagedQuantity.gt(0)) {
    await tx.inventoryDiscrepancy.create({
      data: {
        ...discrepancyBase,
        type: "DAMAGE",
        quantity: input.damagedQuantity,
      },
    });
  }
}

async function moveReceiptQuantity(
  tx: Prisma.TransactionClient,
  input: {
    movementKey: string;
    actorUserId: string;
    fromLocationId: string | null;
    toLocationId: string;
    quantity: Prisma.Decimal;
    receiptLineId: string;
    line: { articleExternalId: string; articleNumberSnapshot: string | null; unit: string; lotNumber: string | null; expiryDate: Date | null };
    commandId: string;
    occurredAt: Date;
    type?: "REPLENISHMENT_RECEIPT" | "REPLENISHMENT_DAMAGED_QUARANTINE";
  },
) {
  if (input.quantity.lte(0)) return;
  await applyInventoryMovementInTransaction(tx, {
    movementKey: input.movementKey,
    type: input.type ?? "REPLENISHMENT_RECEIPT",
    actorUserId: input.actorUserId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    articleExternalId: input.line.articleExternalId,
    articleNumberSnapshot: input.line.articleNumberSnapshot,
    quantity: input.quantity,
    unit: input.line.unit,
    lotNumber: input.line.lotNumber,
    expiryDate: input.line.expiryDate,
    replenishmentReceiptLineId: input.receiptLineId,
    commandId: input.commandId,
    occurredAt: input.occurredAt,
  });
}

async function updateReplenishmentStatus(tx: Prisma.TransactionClient, replenishmentId: string, receivedAt: Date) {
  const lines = await tx.inventoryReplenishmentLine.findMany({ where: { replenishmentId } });
  const anyReceived = lines.some((line) => line.receivedQuantity.gt(0));
  const allReceived = lines.every((line) => line.receivedQuantity.gte(line.expectedQuantity));
  await tx.inventoryReplenishment.update({
    where: { id: replenishmentId },
    data: {
      status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : "IN_TRANSIT",
      receivedAt: allReceived ? receivedAt : null,
    },
  });
}

function normalizeSignature(signature: ReplenishmentReceiptInput["signature"], fallbackDate: Date) {
  const signerName = required(signature.signerName, "Naam ondertekenaar");
  const signatureData = required(signature.signatureData, "Handtekening");
  return {
    signerName,
    signatureData,
    sha256: createHash("sha256").update(signatureData, "utf8").digest("hex"),
    capturedAt: parseInstant(signature.capturedAt, fallbackDate),
  };
}

function normalizePhotos(photos: ReplenishmentReceiptInput["photos"], fallbackDate: Date) {
  if (!Array.isArray(photos) || photos.length < 1) invalid("Minstens één foto is verplicht bij ontvangst.");
  return photos.map((photo) => {
    const storageKey = normalizeOptional(photo.storageKey);
    const contentSha256 = normalizeOptional(photo.contentSha256);
    if (!storageKey && !contentSha256) invalid("Elke ontvangstfoto vereist een opslagreferentie of hash.");
    return {
      storageKey,
      contentSha256,
      mimeType: normalizeOptional(photo.mimeType),
      capturedAt: parseInstant(photo.capturedAt, fallbackDate),
      uploadToken: storageKey ? `photo:${storageKey}` : `photo:${contentSha256}`,
    };
  });
}

function parseInstant(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid("Tijdstip is ongeldig.");
  return parsed;
}

function minDecimal(left: Prisma.Decimal, right: Prisma.Decimal) {
  return left.lte(right) ? left : right;
}

function maxDecimal(left: Prisma.Decimal, right: Prisma.Decimal) {
  return left.gte(right) ? left : right;
}

function effectiveCountries(actor: MockUser): Country[] {
  if (actor.role === "SUPER_ADMIN" || actor.role === "GROUP_MANAGER") return ["BE", "NL", "DE"];
  return (actor.countryAccess?.length ? actor.countryAccess : [actor.country]) as Country[];
}

async function audit(tx: Prisma.TransactionClient, userId: string, entityType: string, entityId: string, action: string, value: unknown) {
  await tx.auditLog.create({ data: { userId, entityType, entityId, action, newValue: canonicalSalesErpJson(value) } });
}
