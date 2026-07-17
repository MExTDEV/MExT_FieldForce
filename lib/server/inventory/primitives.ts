import { createHash } from "node:crypto";

import { Prisma, type Country, type ErpIntegrationProvider, type InventoryLocationType, type InventoryMovementType } from "@prisma/client";

import { SalesErpError } from "@/lib/server/integrations/sales-erp";

export const DEFAULT_INVENTORY_EXPIRY_WARNING_DAYS = 180;

export type InventoryMovementInput = {
  movementKey: string;
  type: InventoryMovementType;
  actorUserId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  articleExternalId: string;
  articleNumberSnapshot?: string | null;
  quantity: string | number | Prisma.Decimal;
  unit: string;
  lotNumber?: string | null;
  expiryDate?: Date | string | null;
  sourceDocumentLineId?: string | null;
  replenishmentReceiptLineId?: string | null;
  carrierCountLineId?: string | null;
  reasonId?: string | null;
  reasonComment?: string | null;
  commandId?: string | null;
  occurredAt?: Date;
};

type LocationInput = {
  country: Country;
  name: string;
  representativeUserId?: string | null;
  relationId?: string | null;
  parentId?: string | null;
  provider?: ErpIntegrationProvider | null;
  externalId?: string | null;
  sourceVersion?: string | null;
  sourceUpdatedAt?: Date | null;
  linkedArticleExternalId?: string | null;
};

export function inventoryHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function inventoryBalanceKey(input: {
  locationId: string;
  articleExternalId: string;
  lotNumber?: string | null;
  expiryDate?: Date | string | null;
}) {
  return `invbal:${inventoryHash({
    locationId: input.locationId,
    articleExternalId: input.articleExternalId,
    lotNumber: normalizeOptional(input.lotNumber),
    expiryDate: normalizeDateKey(input.expiryDate),
  })}`;
}

export function inventoryMovementKey(prefix: string, value: unknown) {
  return `invmov:${prefix}:${inventoryHash(value)}`;
}

export function toInventoryDateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) invalid("Datum is ongeldig.");
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("Datum moet YYYY-MM-DD gebruiken.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid("Datum is ongeldig.");
  return parsed;
}

export function isExpiryWithinWarningWindow(input: {
  today: Date | string;
  expiryDate: Date | string;
  warningDays?: number;
}) {
  const today = toInventoryDateOnly(input.today);
  const expiryDate = toInventoryDateOnly(input.expiryDate);
  if (!today || !expiryDate) return false;
  const warningDays = normalizeExpiryWarningDays(input.warningDays ?? DEFAULT_INVENTORY_EXPIRY_WARNING_DAYS);
  const dayDifference = Math.floor((expiryDate.getTime() - today.getTime()) / 86_400_000);
  return dayDifference >= 0 && dayDifference <= warningDays;
}

export function normalizeExpiryWarningDays(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 730) {
    invalid("De voorraadwaarschuwing moet een geheel aantal dagen tussen 0 en 730 zijn.");
  }
  return value;
}

export async function getOrCreateCentralWarehouseLocation(
  tx: Prisma.TransactionClient,
  input: { country: Country },
) {
  return getOrCreateSystemLocation(tx, "CENTRAL_WAREHOUSE", {
    country: input.country,
    name: `ERP centraal magazijn ${input.country}`,
  });
}

export async function getOrCreateRepresentativeVehicleLocation(
  tx: Prisma.TransactionClient,
  input: { country: Country; representativeUserId: string; name?: string },
) {
  return getOrCreateSystemLocation(tx, "REPRESENTATIVE_VEHICLE", {
    country: input.country,
    representativeUserId: input.representativeUserId,
    name: input.name ?? "Voorraad vertegenwoordiger",
  });
}

export async function getOrCreateQuarantineLocation(
  tx: Prisma.TransactionClient,
  input: { country: Country; representativeUserId: string },
) {
  return getOrCreateSystemLocation(tx, "QUARANTINE", {
    country: input.country,
    representativeUserId: input.representativeUserId,
    name: "Quarantaine beschadigde goederen",
  });
}

export async function getOrCreateTransitLocation(
  tx: Prisma.TransactionClient,
  input: LocationInput & { replenishmentExternalId: string },
) {
  return getOrCreateSystemLocation(tx, "TRANSIT", {
    ...input,
    externalId: input.externalId ?? `transit:${input.replenishmentExternalId}`,
    name: input.name,
  }, `transit:${input.provider ?? "LOCAL"}:${input.replenishmentExternalId}`);
}

export async function getOrCreateSystemLocation(
  tx: Prisma.TransactionClient,
  type: InventoryLocationType,
  input: LocationInput,
  explicitSystemKey?: string,
) {
  const systemKey = explicitSystemKey ?? [
    type,
    input.country,
    input.representativeUserId ?? "none",
    input.relationId ?? "none",
    input.parentId ?? "none",
    input.externalId ?? "none",
  ].join(":");
  return tx.inventoryLocation.upsert({
    where: { systemKey },
    update: {
      name: input.name,
      provider: input.provider ?? null,
      externalId: input.externalId ?? null,
      sourceVersion: input.sourceVersion ?? null,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null,
      linkedArticleExternalId: input.linkedArticleExternalId ?? null,
      archived: false,
    },
    create: {
      systemKey,
      type,
      country: input.country,
      name: input.name,
      provider: input.provider ?? null,
      externalId: input.externalId ?? null,
      sourceVersion: input.sourceVersion ?? null,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null,
      relationId: input.relationId ?? null,
      representativeUserId: input.representativeUserId ?? null,
      parentId: input.parentId ?? null,
      linkedArticleExternalId: input.linkedArticleExternalId ?? null,
    },
  });
}

export async function applyInventoryMovementInTransaction(
  tx: Prisma.TransactionClient,
  input: InventoryMovementInput,
) {
  const existing = await tx.inventoryMovement.findUnique({ where: { movementKey: input.movementKey } });
  if (existing) return { movement: existing, applied: false };

  const quantity = decimal(input.quantity, "Aantal");
  if (quantity.lte(0)) invalid("Een voorraadbeweging moet een positief aantal hebben.");
  if (!input.fromLocationId && !input.toLocationId) invalid("Een voorraadbeweging vereist een bron- of doellocatie.");

  const expiryDate = toInventoryDateOnly(input.expiryDate);
  const movement = await tx.inventoryMovement.create({
    data: {
      movementKey: input.movementKey,
      type: input.type,
      actorUserId: input.actorUserId ?? null,
      fromLocationId: input.fromLocationId ?? null,
      toLocationId: input.toLocationId ?? null,
      articleExternalId: required(input.articleExternalId, "Artikel-ID"),
      articleNumberSnapshot: input.articleNumberSnapshot ?? null,
      quantity,
      unit: required(input.unit, "Eenheid"),
      lotNumber: normalizeOptional(input.lotNumber),
      expiryDate,
      sourceDocumentLineId: input.sourceDocumentLineId ?? null,
      replenishmentReceiptLineId: input.replenishmentReceiptLineId ?? null,
      carrierCountLineId: input.carrierCountLineId ?? null,
      reasonId: input.reasonId ?? null,
      reasonComment: normalizeOptional(input.reasonComment),
      commandId: input.commandId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  if (input.fromLocationId) {
    await applyInventoryBalanceDelta(tx, {
      locationId: input.fromLocationId,
      articleExternalId: input.articleExternalId,
      unit: input.unit,
      lotNumber: input.lotNumber,
      expiryDate,
      delta: quantity.neg(),
    });
  }
  if (input.toLocationId) {
    await applyInventoryBalanceDelta(tx, {
      locationId: input.toLocationId,
      articleExternalId: input.articleExternalId,
      unit: input.unit,
      lotNumber: input.lotNumber,
      expiryDate,
      delta: quantity,
    });
  }

  return { movement, applied: true };
}

export async function applyInventoryBalanceDelta(
  tx: Prisma.TransactionClient,
  input: {
    locationId: string;
    articleExternalId: string;
    unit: string;
    lotNumber?: string | null;
    expiryDate?: Date | string | null;
    delta: Prisma.Decimal;
    sourceVersion?: string | null;
  },
) {
  if (input.delta.eq(0)) return null;
  const expiryDate = toInventoryDateOnly(input.expiryDate);
  const balanceKey = inventoryBalanceKey({
    locationId: input.locationId,
    articleExternalId: input.articleExternalId,
    lotNumber: input.lotNumber,
    expiryDate,
  });
  const existing = await tx.inventoryBalance.findUnique({ where: { balanceKey } });
  const nextQuantity = (existing?.quantity ?? new Prisma.Decimal(0)).plus(input.delta);
  if (nextQuantity.lt(0)) {
    invalid("Voorraad mag niet negatief worden zonder expliciete correctiebron.");
  }
  if (existing) {
    if (existing.unit !== input.unit) invalid("Voorraadbalans gebruikt een andere eenheid.");
    return tx.inventoryBalance.update({
      where: { balanceKey },
      data: {
        quantity: nextQuantity,
        sourceVersion: input.sourceVersion ?? existing.sourceVersion,
      },
    });
  }
  return tx.inventoryBalance.create({
    data: {
      balanceKey,
      locationId: input.locationId,
      articleExternalId: required(input.articleExternalId, "Artikel-ID"),
      unit: required(input.unit, "Eenheid"),
      quantity: nextQuantity,
      lotNumber: normalizeOptional(input.lotNumber),
      expiryDate,
      sourceVersion: input.sourceVersion ?? null,
    },
  });
}

export function decimal(value: string | number | Prisma.Decimal, label: string) {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) invalid(`${label} is ongeldig.`);
    return parsed;
  } catch {
    invalid(`${label} is ongeldig.`);
  }
}

export function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) invalid(`${label} is verplicht.`);
  return normalized;
}

export function normalizeOptional(value: string | null | undefined) {
  return value?.trim() || null;
}

export function normalizeDateKey(value: Date | string | null | undefined) {
  const date = toInventoryDateOnly(value);
  return date?.toISOString().slice(0, 10) ?? null;
}

export function invalid(message: string): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message });
}

export function denied(message: string): never {
  throw new SalesErpError({ code: "PERMISSION_REVOKED", message });
}
