import { randomUUID } from "node:crypto";

import { Prisma, type Country } from "@prisma/client";

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
  inventoryBalanceKey,
  inventoryMovementKey,
  invalid,
  normalizeOptional,
  required,
  toInventoryDateOnly,
} from "./primitives";
import { assertCustomerInventoryAccess } from "./service";

export type CarrierCountLineInput = {
  articleExternalId: string;
  countedQuantity: string;
  unit: string;
  lotNumber?: string;
  expiryDate?: string;
  reasonId?: string;
  reasonComment?: string;
};

export type CarrierCountInput = {
  countKey?: string;
  commandId?: string;
  appointmentId?: string;
  countedAt?: string;
  comment?: string;
  lines: CarrierCountLineInput[];
};

export async function listCarrierBalances(input: { actor: MockUser; relationId?: string; carrierLocationId?: string; now?: Date }) {
  if (!can(input.actor, "inventory.balance.readOwn") && !can(input.actor, "inventory.manage")) {
    denied("Je hebt geen recht om dragerstock te bekijken.");
  }
  if (input.relationId) await assertCustomerInventoryAccess(prisma, input.actor, input.relationId, input.now);
  const carriers = await prisma.inventoryLocation.findMany({
    where: {
      type: "CUSTOMER_CARRIER",
      ...(input.carrierLocationId ? { id: input.carrierLocationId } : {}),
      ...(input.relationId ? { relationId: input.relationId } : {}),
      ...(can(input.actor, "inventory.manage") ? { country: { in: effectiveCountries(input.actor) } } : {}),
    },
    include: { balances: { orderBy: [{ articleExternalId: "asc" }, { expiryDate: "asc" }] }, archiveReason: true },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });
  return carriers;
}

export async function submitCarrierCount(input: {
  actor: MockUser;
  provider: SalesErpProvider;
  deviceId: string;
  carrierLocationId: string;
  count: CarrierCountInput;
  now?: Date;
}) {
  if (!can(input.actor, "inventory.carriers.writeOwnAppointment")) denied("Je hebt geen recht om dragers te tellen.");
  if (!input.count.lines.length) invalid("Minstens één tellijn is verplicht.");
  const now = input.now ?? new Date();
  const countKey = input.count.countKey?.trim() || `carrier-count:${randomUUID()}`;
  const commandId = input.count.commandId?.trim() || countKey;
  const countedAt = parseInstant(input.count.countedAt, now);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryCarrierCount.findUnique({
      where: { countKey },
      include: { lines: true },
    });
    if (existing) return { count: existing, idempotent: true };

    const carrier = await tx.inventoryLocation.findUnique({ where: { id: input.carrierLocationId }, include: { relation: true } });
    if (!carrier || carrier.type !== "CUSTOMER_CARRIER" || !carrier.relationId) invalid("Drager bestaat niet.");
    if (carrier.archived) invalid("Een gearchiveerde drager kan geen nieuwe levering of telling ontvangen.");
    const access = await assertCustomerInventoryAccess(tx, input.actor, carrier.relationId, now, input.count.appointmentId);
    const count = await tx.inventoryCarrierCount.create({
      data: {
        countKey,
        carrierLocationId: carrier.id,
        actorUserId: input.actor.id,
        countedAt,
        commandId,
        comment: normalizeOptional(input.count.comment),
      },
    });

    const commandLines: {
      articleExternalId: string;
      countedQuantity: string;
      theoreticalQuantity: string;
      unit: string;
      reasonCode?: string;
      lotNumber?: string;
      expiryDate?: string;
    }[] = [];

    for (const [index, rawLine] of input.count.lines.entries()) {
      const articleExternalId = required(rawLine.articleExternalId, "Artikel-ID");
      const countedQuantity = decimal(rawLine.countedQuantity, "Geteld aantal");
      if (countedQuantity.lt(0)) invalid("Geteld aantal mag niet negatief zijn.");
      const expiryDate = toInventoryDateOnly(rawLine.expiryDate);
      const balanceKey = inventoryBalanceKey({ locationId: carrier.id, articleExternalId, lotNumber: rawLine.lotNumber, expiryDate });
      const balance = await tx.inventoryBalance.findUnique({ where: { balanceKey } });
      const systemQuantity = balance?.quantity ?? new Prisma.Decimal(0);
      const unit = balance?.unit ?? required(rawLine.unit, "Eenheid");
      if (balance && balance.unit !== rawLine.unit) invalid("Tellijn gebruikt een andere eenheid dan de bestaande balans.");
      const differenceQuantity = countedQuantity.minus(systemQuantity);
      const reason = differenceQuantity.eq(0)
        ? null
        : await resolveCountReason(tx, rawLine.reasonId, carrier.country, rawLine.reasonComment);
      const countLine = await tx.inventoryCarrierCountLine.create({
        data: {
          countId: count.id,
          articleExternalId,
          systemQuantity,
          countedQuantity,
          differenceQuantity,
          unit,
          lotNumber: normalizeOptional(rawLine.lotNumber),
          expiryDate,
          reasonId: reason?.id ?? null,
          reasonComment: normalizeOptional(rawLine.reasonComment),
        },
      });
      if (!differenceQuantity.eq(0)) {
        await applyInventoryMovementInTransaction(tx, {
          movementKey: inventoryMovementKey("carrier-count-correction", { countKey, index }),
          type: "CARRIER_COUNT_CORRECTION",
          actorUserId: input.actor.id,
          fromLocationId: differenceQuantity.lt(0) ? carrier.id : null,
          toLocationId: differenceQuantity.gt(0) ? carrier.id : null,
          articleExternalId,
          quantity: differenceQuantity.abs(),
          unit,
          lotNumber: rawLine.lotNumber,
          expiryDate,
          carrierCountLineId: countLine.id,
          reasonId: reason?.id ?? null,
          reasonComment: rawLine.reasonComment,
          commandId,
          occurredAt: countedAt,
        });
      }
      commandLines.push({
        articleExternalId,
        countedQuantity: countedQuantity.toFixed(3),
        theoreticalQuantity: systemQuantity.toFixed(3),
        unit,
        reasonCode: reason?.code,
        lotNumber: normalizeOptional(rawLine.lotNumber) ?? undefined,
        expiryDate: expiryDate?.toISOString().slice(0, 10),
      });
    }

    const command = buildSalesErpCommand({
      commandType: "carrier-count.submit",
      commandId,
      businessKey: `carrier-count:${count.id}`,
      issuedAt: now.toISOString(),
      context: {
        actorUserId: input.actor.id,
        representativeExternalId: input.actor.representativeId ?? input.actor.id,
        deviceId: input.deviceId,
        country: input.actor.country,
        appointmentExternalId: access.appointmentExternalId,
      },
      payload: {
        localCountId: count.id,
        carrierExternalId: carrier.externalId ?? carrier.id,
        countedAt: countedAt.toISOString(),
        lines: commandLines,
      },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate: salesDayBusinessDate(input.actor, now) });
    await audit(tx, input.actor.id, "InventoryCarrierCount", count.id, "inventory.carrierCount.submitted", { commandId });
    const saved = await tx.inventoryCarrierCount.findUniqueOrThrow({ where: { id: count.id }, include: { lines: true } });
    return { count: saved, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function resolveCountReason(
  tx: Prisma.TransactionClient,
  reasonId: string | undefined,
  country: Country,
  comment: string | undefined,
) {
  if (!reasonId) invalid("Een reden is verplicht wanneer de drager-telling afwijkt.");
  const reason = await tx.inventoryReason.findFirst({
    where: { id: reasonId, kind: "CARRIER_COUNT_DISCREPANCY", active: true, OR: [{ country: null }, { country }] },
  });
  if (!reason) invalid("De tellingsreden bestaat niet of is niet actief.");
  if (reason.requiresComment && !normalizeOptional(comment)) invalid("Een toelichting is verplicht voor deze tellingsreden.");
  return reason;
}

function parseInstant(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid("Tijdstip is ongeldig.");
  return parsed;
}

function effectiveCountries(actor: MockUser): Country[] {
  if (actor.role === "SUPER_ADMIN" || actor.role === "GROUP_MANAGER") return ["BE", "NL", "DE"];
  return (actor.countryAccess?.length ? actor.countryAccess : [actor.country]) as Country[];
}

async function audit(tx: Prisma.TransactionClient, userId: string, entityType: string, entityId: string, action: string, value: unknown) {
  await tx.auditLog.create({ data: { userId, entityType, entityId, action, newValue: canonicalSalesErpJson(value) } });
}
