import { randomUUID } from "node:crypto";

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

import { decimal, denied, invalid, normalizeOptional, required, toInventoryDateOnly } from "./primitives";

export type ConsumablesRequestLineInput = {
  articleExternalId: string;
  quantity: string;
  unit: string;
  articleNumberSnapshot?: string;
  descriptionSnapshot?: string;
  comment?: string;
};

export type ConsumablesRequestInput = {
  requestKey?: string;
  commandId?: string;
  businessDate?: string;
  submittedAt?: string;
  comment?: string;
  lines: ConsumablesRequestLineInput[];
};

export async function listConsumablesRequests(input: { actor: MockUser; provider: SalesErpProvider }) {
  if (!can(input.actor, "inventory.consumables.requestOwn") && !can(input.actor, "inventory.manage")) {
    denied("Je hebt geen recht om verbruiksgoederen te bekijken.");
  }
  return prisma.inventoryConsumablesRequest.findMany({
    where: {
      provider: input.provider as ErpIntegrationProvider,
      ...(can(input.actor, "inventory.manage")
        ? { country: { in: effectiveCountries(input.actor) } }
        : { actorUserId: input.actor.id }),
    },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
    orderBy: { submittedAt: "desc" },
  });
}

export async function submitConsumablesRequest(input: {
  actor: MockUser;
  provider: SalesErpProvider;
  deviceId: string;
  request: ConsumablesRequestInput;
  now?: Date;
}) {
  if (!can(input.actor, "inventory.consumables.requestOwn")) denied("Je hebt geen recht om verbruiksgoederen aan te vragen.");
  if (!input.request.lines.length) invalid("Minstens één verbruiksgoederenlijn is verplicht.");
  const now = input.now ?? new Date();
  const requestKey = input.request.requestKey?.trim() || `consumables:${randomUUID()}`;
  const commandId = input.request.commandId?.trim() || requestKey;
  const businessDate = toInventoryDateOnly(input.request.businessDate ?? salesDayBusinessDate(input.actor, now));
  if (!businessDate) invalid("Werkdag ontbreekt.");
  const submittedAt = parseInstant(input.request.submittedAt, now);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryConsumablesRequest.findUnique({
      where: { requestKey },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
    if (existing) return { request: existing, idempotent: true };

    const normalizedLines = input.request.lines.map((line, index) => {
      const quantity = decimal(line.quantity, "Aantal verbruiksgoed");
      if (quantity.lte(0)) invalid("Aantal verbruiksgoed moet groter zijn dan nul.");
      return {
        lineNumber: index + 1,
        articleExternalId: required(line.articleExternalId, "Artikel-ID"),
        articleNumberSnapshot: normalizeOptional(line.articleNumberSnapshot),
        descriptionSnapshot: normalizeOptional(line.descriptionSnapshot),
        quantity,
        unit: required(line.unit, "Eenheid"),
        comment: normalizeOptional(line.comment),
      };
    });
    const request = await tx.inventoryConsumablesRequest.create({
      data: {
        requestKey,
        provider: input.provider as ErpIntegrationProvider,
        country: input.actor.country,
        actorUserId: input.actor.id,
        representativeExternalId: input.actor.representativeId ?? input.actor.id,
        businessDate,
        submittedAt,
        commandId,
        comment: normalizeOptional(input.request.comment),
        lines: { create: normalizedLines },
      },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
    const command = buildSalesErpCommand({
      commandType: "consumables-request.create",
      commandId,
      businessKey: `consumables-request:${request.id}`,
      issuedAt: now.toISOString(),
      context: {
        actorUserId: input.actor.id,
        representativeExternalId: input.actor.representativeId ?? input.actor.id,
        deviceId: input.deviceId,
        country: input.actor.country,
      },
      payload: {
        localRequestId: request.id,
        requestedAt: submittedAt.toISOString(),
        lines: request.lines.map((line) => ({
          articleExternalId: line.articleExternalId,
          quantity: line.quantity.toFixed(3),
          unit: line.unit,
        })),
      },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate: businessDate.toISOString().slice(0, 10) });
    await audit(tx, input.actor.id, "InventoryConsumablesRequest", request.id, "inventory.consumables.submitted", { commandId });
    return { request, idempotent: false };
  });
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
