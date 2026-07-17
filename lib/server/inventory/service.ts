import { randomUUID } from "node:crypto";

import { Prisma, type Country, type ErpIntegrationProvider, type InventoryLocationType } from "@prisma/client";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/server/db";
import {
  buildSalesErpCommand,
  canonicalSalesErpJson,
  enqueueSalesErpCommandInTransaction,
  type SalesErpCarrierBalance,
  type SalesErpCustomerLocation,
  type SalesErpProvider,
  type SalesErpReplenishment,
} from "@/lib/server/integrations/sales-erp";
import { salesDayBusinessDate } from "@/lib/server/salesday-customer-access";
import type { MockUser } from "@/lib/types";

import {
  DEFAULT_INVENTORY_EXPIRY_WARNING_DAYS,
  applyInventoryMovementInTransaction,
  decimal,
  denied,
  getOrCreateCentralWarehouseLocation,
  getOrCreateTransitLocation,
  inventoryBalanceKey,
  inventoryMovementKey,
  invalid,
  isExpiryWithinWarningWindow,
  normalizeExpiryWarningDays,
  normalizeOptional,
  required,
  toInventoryDateOnly,
} from "./primitives";

export const INVENTORY_SETTINGS_KEY = "inventory.settings.v1";

export type InventoryRuntimeSettings = {
  expiryWarningDays: number;
};

export type InventoryLocationInput = {
  relationId: string;
  appointmentId?: string;
  parentLocationId?: string;
  type: "LOCATION" | "SUBLOCATION" | "CARRIER";
  name: string;
  linkedArticleExternalId?: string;
};

export type InventoryLocationUpdateInput = {
  appointmentId?: string;
  name?: string;
  linkedArticleExternalId?: string | null;
};

export type InventoryLocationArchiveInput = {
  appointmentId?: string;
  reasonId: string;
  comment?: string;
};

type InventoryCommandContext = {
  actor: MockUser;
  provider: SalesErpProvider;
  deviceId: string;
  now?: Date;
};

export async function getInventoryRuntimeSettings() {
  const setting = await prisma.appSetting.findUnique({ where: { key: INVENTORY_SETTINGS_KEY } });
  if (!setting) return defaultInventorySettings();
  try {
    const parsed = JSON.parse(setting.value) as Partial<InventoryRuntimeSettings>;
    return {
      expiryWarningDays: normalizeExpiryWarningDays(
        typeof parsed.expiryWarningDays === "number"
          ? parsed.expiryWarningDays
          : DEFAULT_INVENTORY_EXPIRY_WARNING_DAYS,
      ),
    };
  } catch {
    return defaultInventorySettings();
  }
}

export async function saveInventoryRuntimeSettings(actor: MockUser, settings: InventoryRuntimeSettings) {
  requireInventoryManage(actor);
  const value = {
    expiryWarningDays: normalizeExpiryWarningDays(settings.expiryWarningDays),
  };
  return prisma.appSetting.upsert({
    where: { key: INVENTORY_SETTINGS_KEY },
    update: { value: JSON.stringify(value), updatedById: actor.id },
    create: { key: INVENTORY_SETTINGS_KEY, value: JSON.stringify(value), updatedById: actor.id },
  });
}

export async function listInventoryReasons(actor: MockUser) {
  requireInventoryManage(actor);
  return prisma.inventoryReason.findMany({
    orderBy: [{ kind: "asc" }, { country: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function upsertInventoryReason(input: {
  actor: MockUser;
  id?: string;
  kind: "ARCHIVE" | "CARRIER_COUNT_DISCREPANCY" | "RECEIPT_DISCREPANCY";
  code: string;
  labelNl: string;
  labelFr: string;
  labelDe: string;
  country?: Country | null;
  active?: boolean;
  requiresComment?: boolean;
  sortOrder?: number;
}) {
  requireInventoryManage(input.actor);
  const code = required(input.code, "Redencode");
  const data = {
    kind: input.kind,
    code,
    labelNl: required(input.labelNl, "Nederlandse reden"),
    labelFr: required(input.labelFr, "Franse reden"),
    labelDe: required(input.labelDe, "Duitse reden"),
    country: input.country ?? null,
    active: input.active ?? true,
    requiresComment: input.requiresComment ?? true,
    sortOrder: input.sortOrder ?? 0,
  };
  if (input.id) return prisma.inventoryReason.update({ where: { id: input.id }, data });
  const existing = await prisma.inventoryReason.findFirst({ where: { kind: input.kind, code, country: input.country ?? null } });
  if (existing) return prisma.inventoryReason.update({ where: { id: existing.id }, data });
  return prisma.inventoryReason.create({ data });
}

export async function applySalesErpReplenishment(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  replenishment: SalesErpReplenishment,
) {
  const prismaProvider = provider as ErpIntegrationProvider;
  const representative = await tx.user.findUnique({ where: { representativeId: replenishment.representativeExternalId } });
  if (!representative) invalid("ERP-bevoorrading verwijst naar een onbekende vertegenwoordiger.");

  const transitLocation = await getOrCreateTransitLocation(tx, {
    provider: prismaProvider,
    replenishmentExternalId: replenishment.externalId,
    externalId: `transit:${replenishment.externalId}`,
    sourceVersion: replenishment.sourceVersion,
    sourceUpdatedAt: new Date(replenishment.sourceUpdatedAt),
    country: replenishment.country as Country,
    representativeUserId: representative.id,
    name: `Transit ${replenishment.shipmentNumber}`,
  });
  await getOrCreateCentralWarehouseLocation(tx, { country: replenishment.country as Country });
  const saved = await tx.inventoryReplenishment.upsert({
    where: { provider_externalId: { provider: prismaProvider, externalId: replenishment.externalId } },
    update: {
      sourceVersion: replenishment.sourceVersion,
      sourceUpdatedAt: new Date(replenishment.sourceUpdatedAt),
      shipmentNumber: replenishment.shipmentNumber,
      status: replenishment.status,
      country: replenishment.country as Country,
      representativeUserId: representative.id,
      representativeExternalId: replenishment.representativeExternalId,
      transitLocationId: transitLocation.id,
      shippedAt: new Date(replenishment.shippedAt),
    },
    create: {
      provider: prismaProvider,
      externalId: replenishment.externalId,
      sourceVersion: replenishment.sourceVersion,
      sourceUpdatedAt: new Date(replenishment.sourceUpdatedAt),
      shipmentNumber: replenishment.shipmentNumber,
      status: replenishment.status,
      country: replenishment.country as Country,
      representativeUserId: representative.id,
      representativeExternalId: replenishment.representativeExternalId,
      transitLocationId: transitLocation.id,
      shippedAt: new Date(replenishment.shippedAt),
    },
  });

  for (const line of replenishment.lines) {
    const savedLine = await tx.inventoryReplenishmentLine.upsert({
      where: { replenishmentId_externalId: { replenishmentId: saved.id, externalId: line.externalId } },
      update: {
        articleExternalId: line.articleExternalId,
        articleNumberSnapshot: line.articleNumberSnapshot,
        expectedQuantity: decimal(line.expectedQuantity, "Verwacht aantal"),
        unit: line.unitSnapshot,
        lotNumber: normalizeOptional(line.lotNumber),
        expiryDate: toInventoryDateOnly(line.expiryDate),
      },
      create: {
        replenishmentId: saved.id,
        externalId: line.externalId,
        articleExternalId: line.articleExternalId,
        articleNumberSnapshot: line.articleNumberSnapshot,
        expectedQuantity: decimal(line.expectedQuantity, "Verwacht aantal"),
        unit: line.unitSnapshot,
        lotNumber: normalizeOptional(line.lotNumber),
        expiryDate: toInventoryDateOnly(line.expiryDate),
      },
    });
    await applyInventoryMovementInTransaction(tx, {
      movementKey: inventoryMovementKey("erp-replenishment-transit", {
        provider,
        replenishmentExternalId: replenishment.externalId,
        lineExternalId: line.externalId,
      }),
      type: "ERP_REPLENISHMENT_TRANSIT",
      fromLocationId: null,
      toLocationId: transitLocation.id,
      articleExternalId: line.articleExternalId,
      articleNumberSnapshot: line.articleNumberSnapshot,
      quantity: savedLine.expectedQuantity,
      unit: line.unitSnapshot,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
      occurredAt: new Date(replenishment.shippedAt),
    });
  }
  return saved;
}

export async function applySalesErpCustomerLocation(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  location: SalesErpCustomerLocation,
) {
  const prismaProvider = provider as ErpIntegrationProvider;
  const relationLink = await tx.businessRelationExternalLink.findUnique({
    where: { provider_externalId: { provider: prismaProvider, externalId: location.customerExternalId } },
    select: { relationId: true, relation: { select: { country: true } } },
  });
  if (!relationLink) invalid("ERP-klantlocatie verwijst naar een onbekende klant.");
  const parent = location.parentLocationExternalId
    ? await tx.inventoryLocation.findUnique({ where: { provider_externalId: { provider: prismaProvider, externalId: location.parentLocationExternalId } } })
    : null;
  const type = mapErpLocationType(location.type);
  return tx.inventoryLocation.upsert({
    where: { provider_externalId: { provider: prismaProvider, externalId: location.externalId } },
    update: {
      type,
      sourceVersion: location.sourceVersion,
      sourceUpdatedAt: new Date(location.sourceUpdatedAt),
      country: relationLink.relation.country,
      relationId: relationLink.relationId,
      parentId: parent?.id ?? null,
      name: location.name,
      linkedArticleExternalId: normalizeOptional(location.linkedArticleExternalId),
      archived: location.archived,
    },
    create: {
      systemKey: `customer-location:${provider}:${location.externalId}`,
      type,
      provider: prismaProvider,
      externalId: location.externalId,
      sourceVersion: location.sourceVersion,
      sourceUpdatedAt: new Date(location.sourceUpdatedAt),
      country: relationLink.relation.country,
      relationId: relationLink.relationId,
      parentId: parent?.id ?? null,
      name: location.name,
      linkedArticleExternalId: normalizeOptional(location.linkedArticleExternalId),
      archived: location.archived,
    },
  });
}

export async function applySalesErpCarrierBalance(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  balance: SalesErpCarrierBalance,
) {
  const prismaProvider = provider as ErpIntegrationProvider;
  const carrier = await tx.inventoryLocation.findUnique({
    where: { provider_externalId: { provider: prismaProvider, externalId: balance.carrierExternalId } },
  });
  if (!carrier || carrier.type !== "CUSTOMER_CARRIER") invalid("ERP-dragerbalans verwijst naar een onbekende drager.");
  const desired = decimal(balance.quantity, "Dragerbalans");
  if (desired.lt(0)) invalid("Een ERP-dragerbalans mag niet negatief zijn.");
  const balanceKey = inventoryBalanceKey({
    locationId: carrier.id,
    articleExternalId: balance.articleExternalId,
    lotNumber: balance.lotNumber,
    expiryDate: balance.expiryDate,
  });
  const existing = await tx.inventoryBalance.findUnique({ where: { balanceKey } });
  const current = existing?.quantity ?? new Prisma.Decimal(0);
  const delta = desired.minus(current);
  if (delta.eq(0)) {
    await tx.inventoryBalance.upsert({
      where: { balanceKey },
      update: { sourceVersion: balance.sourceVersion },
      create: {
        balanceKey,
        locationId: carrier.id,
        articleExternalId: balance.articleExternalId,
        unit: balance.unit,
        quantity: desired,
        lotNumber: normalizeOptional(balance.lotNumber),
        expiryDate: toInventoryDateOnly(balance.expiryDate),
        sourceVersion: balance.sourceVersion,
      },
    });
    return;
  }
  await applyInventoryMovementInTransaction(tx, {
    movementKey: inventoryMovementKey("erp-carrier-balance", {
      provider,
      externalId: balance.externalId,
      sourceVersion: balance.sourceVersion,
    }),
    type: "ERP_CORRECTION",
    fromLocationId: delta.lt(0) ? carrier.id : null,
    toLocationId: delta.gt(0) ? carrier.id : null,
    articleExternalId: balance.articleExternalId,
    quantity: delta.abs(),
    unit: balance.unit,
    lotNumber: balance.lotNumber,
    expiryDate: balance.expiryDate,
    occurredAt: new Date(balance.sourceUpdatedAt),
  });
  await tx.inventoryBalance.updateMany({
    where: { balanceKey },
    data: { sourceVersion: balance.sourceVersion },
  });
}

export async function listOwnInventoryBalances(input: { actor: MockUser }) {
  if (!can(input.actor, "inventory.balance.readOwn") && !can(input.actor, "inventory.manage")) {
    denied("Je hebt geen recht om voorraad te bekijken.");
  }
  const locations = await prisma.inventoryLocation.findMany({
    where: can(input.actor, "inventory.manage")
      ? { country: { in: effectiveCountries(input.actor) }, archived: false }
      : { representativeUserId: input.actor.id, type: "REPRESENTATIVE_VEHICLE", archived: false },
    include: { balances: { orderBy: [{ articleExternalId: "asc" }, { expiryDate: "asc" }] } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const settings = await getInventoryRuntimeSettings();
  const today = salesDayBusinessDate(input.actor);
  return locations.map((location) => ({
    ...location,
    balances: location.balances.map((balance) => ({
      ...balance,
      expiryWarning: balance.expiryDate
        ? isExpiryWithinWarningWindow({ today, expiryDate: balance.expiryDate, warningDays: settings.expiryWarningDays })
        : false,
    })),
  }));
}

export async function listCustomerInventoryLocations(input: { actor: MockUser; relationId: string; now?: Date }) {
  await assertCustomerInventoryAccess(prisma, input.actor, input.relationId, input.now);
  return prisma.inventoryLocation.findMany({
    where: { relationId: input.relationId },
    include: { balances: true, children: true, archiveReason: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCustomerInventoryLocation(input: InventoryCommandContext & { location: InventoryLocationInput }) {
  if (!can(input.actor, "inventory.carriers.writeOwnAppointment") && !can(input.actor, "inventory.manage")) {
    denied("Je hebt geen recht om klantlocaties te wijzigen.");
  }
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const access = await assertCustomerInventoryAccess(tx, input.actor, input.location.relationId, now, input.location.appointmentId);
    const parent = input.location.parentLocationId
      ? await tx.inventoryLocation.findFirst({ where: { id: input.location.parentLocationId, relationId: input.location.relationId, archived: false } })
      : null;
    if (input.location.parentLocationId && !parent) invalid("De bovenliggende locatie bestaat niet of is gearchiveerd.");
    const locationType = mapLocalLocationType(input.location.type);
    const location = await tx.inventoryLocation.create({
      data: {
        type: locationType,
        country: access.country,
        relationId: input.location.relationId,
        parentId: parent?.id ?? null,
        name: required(input.location.name, "Locatienaam"),
        linkedArticleExternalId: normalizeOptional(input.location.linkedArticleExternalId),
        commandId: randomUUID(),
      },
    });
    const command = buildSalesErpCommand({
      commandType: "customer-location.upsert",
      commandId: location.commandId ?? undefined,
      businessKey: `customer-location:${location.id}`,
      issuedAt: now.toISOString(),
      context: inventoryCommandContext(input.actor, input.deviceId, access.appointmentExternalId),
      payload: {
        localLocationId: location.id,
        customerExternalId: access.customerExternalId,
        parentLocationExternalId: parent?.externalId ?? undefined,
        type: input.location.type,
        name: location.name,
        linkedArticleExternalId: location.linkedArticleExternalId ?? undefined,
        archived: false,
      },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate: salesDayBusinessDate(input.actor, now) });
    await audit(tx, input.actor.id, "InventoryLocation", location.id, "inventory.location.created", { commandId: command.commandId });
    return location;
  });
}

export async function updateCustomerInventoryLocation(input: InventoryCommandContext & { locationId: string; patch: InventoryLocationUpdateInput }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryLocation.findUnique({ where: { id: input.locationId } });
    if (!existing || !existing.relationId) invalid("Klantlocatie bestaat niet.");
    if (existing.archived) invalid("Een gearchiveerde drager of locatie kan niet meer worden gewijzigd.");
    const access = await assertCustomerInventoryAccess(tx, input.actor, existing.relationId, now, input.patch.appointmentId);
    const location = await tx.inventoryLocation.update({
      where: { id: existing.id },
      data: {
        name: input.patch.name !== undefined ? required(input.patch.name, "Locatienaam") : existing.name,
        linkedArticleExternalId: input.patch.linkedArticleExternalId !== undefined
          ? normalizeOptional(input.patch.linkedArticleExternalId)
          : existing.linkedArticleExternalId,
        commandId: existing.commandId ?? randomUUID(),
      },
    });
    const command = buildSalesErpCommand({
      commandType: "customer-location.upsert",
      commandId: location.commandId ?? undefined,
      businessKey: `customer-location:${location.id}`,
      issuedAt: now.toISOString(),
      context: inventoryCommandContext(input.actor, input.deviceId, access.appointmentExternalId),
      payload: {
        localLocationId: location.id,
        externalId: location.externalId ?? undefined,
        expectedSourceVersion: location.sourceVersion ?? undefined,
        customerExternalId: access.customerExternalId,
        parentLocationExternalId: existing.parentId
          ? (await tx.inventoryLocation.findUnique({ where: { id: existing.parentId }, select: { externalId: true } }))?.externalId ?? undefined
          : undefined,
        type: unmapLocalLocationType(location.type),
        name: location.name,
        linkedArticleExternalId: location.linkedArticleExternalId ?? undefined,
        archived: location.archived,
      },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate: salesDayBusinessDate(input.actor, now) });
    await audit(tx, input.actor.id, "InventoryLocation", location.id, "inventory.location.updated", { commandId: command.commandId });
    return location;
  });
}

export async function archiveCustomerInventoryLocation(input: InventoryCommandContext & { locationId: string; archive: InventoryLocationArchiveInput }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryLocation.findUnique({ where: { id: input.locationId } });
    if (!existing || !existing.relationId) invalid("Klantlocatie bestaat niet.");
    if (existing.archived) return existing;
    const access = await assertCustomerInventoryAccess(tx, input.actor, existing.relationId, now, input.archive.appointmentId);
    const reason = await tx.inventoryReason.findFirst({
      where: { id: input.archive.reasonId, kind: "ARCHIVE", active: true, OR: [{ country: null }, { country: existing.country }] },
    });
    if (!reason) invalid("De archiveringsreden bestaat niet of is niet actief.");
    const comment = normalizeOptional(input.archive.comment);
    if (reason.requiresComment && !comment) invalid("Een toelichting is verplicht voor deze archiveringsreden.");
    const location = await tx.inventoryLocation.update({
      where: { id: existing.id },
      data: {
        archived: true,
        archiveReasonId: reason.id,
        archiveComment: comment,
        archivedAt: now,
        commandId: existing.commandId ?? randomUUID(),
      },
    });
    const command = buildSalesErpCommand({
      commandType: "customer-location.upsert",
      commandId: location.commandId ?? undefined,
      businessKey: `customer-location:${location.id}`,
      issuedAt: now.toISOString(),
      context: inventoryCommandContext(input.actor, input.deviceId, access.appointmentExternalId),
      payload: {
        localLocationId: location.id,
        externalId: location.externalId ?? undefined,
        expectedSourceVersion: location.sourceVersion ?? undefined,
        customerExternalId: access.customerExternalId,
        parentLocationExternalId: undefined,
        type: unmapLocalLocationType(location.type),
        name: location.name,
        linkedArticleExternalId: location.linkedArticleExternalId ?? undefined,
        archived: true,
        archiveReasonCode: reason.code,
      },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate: salesDayBusinessDate(input.actor, now) });
    await audit(tx, input.actor.id, "InventoryLocation", location.id, "inventory.location.archived", { commandId: command.commandId, reasonCode: reason.code });
    return location;
  });
}

export async function assertCustomerInventoryAccess(
  tx: Prisma.TransactionClient | typeof prisma,
  actor: MockUser,
  relationId: string,
  now?: Date,
  appointmentId?: string,
) {
  const relation = await tx.businessRelation.findUnique({
    where: { id: relationId },
    include: { externalLinks: true },
  });
  if (!relation) invalid("Klant bestaat niet.");
  if (can(actor, "inventory.manage")) {
    if (!effectiveCountries(actor).includes(relation.country)) denied("Deze klant valt buiten je landenscope.");
  } else {
    if (!can(actor, "inventory.carriers.writeOwnAppointment")) denied("Je hebt geen recht om klantdragers te wijzigen.");
    const appointment = await tx.salesAppointment.findFirst({
      where: {
        ...(appointmentId ? { id: appointmentId } : {}),
        relationId,
        representativeUserId: actor.id,
        businessDate: dateOnly(salesDayBusinessDate(actor, now)),
        status: { in: ["PLANNED", "COMPLETED", "NOT_COMPLETED"] },
      },
      select: { id: true, externalId: true },
    });
    if (!appointment) denied("Klantlocaties mogen alleen voor klanten op je werkdag worden aangepast.");
    const external = relation.externalLinks[0];
    if (!external) invalid("De klant heeft nog geen ERP-identiteit.");
    return { country: relation.country, customerExternalId: external.externalId, appointmentExternalId: appointment.externalId ?? undefined };
  }
  const external = relation.externalLinks[0];
  if (!external) invalid("De klant heeft nog geen ERP-identiteit.");
  return { country: relation.country, customerExternalId: external.externalId, appointmentExternalId: undefined };
}

export function defaultInventorySettings(): InventoryRuntimeSettings {
  return { expiryWarningDays: DEFAULT_INVENTORY_EXPIRY_WARNING_DAYS };
}

function mapErpLocationType(type: SalesErpCustomerLocation["type"]): InventoryLocationType {
  if (type === "LOCATION") return "CUSTOMER_LOCATION";
  if (type === "SUBLOCATION") return "CUSTOMER_SUBLOCATION";
  return "CUSTOMER_CARRIER";
}

function mapLocalLocationType(type: InventoryLocationInput["type"]): InventoryLocationType {
  if (type === "LOCATION") return "CUSTOMER_LOCATION";
  if (type === "SUBLOCATION") return "CUSTOMER_SUBLOCATION";
  return "CUSTOMER_CARRIER";
}

function unmapLocalLocationType(type: InventoryLocationType): InventoryLocationInput["type"] {
  if (type === "CUSTOMER_LOCATION") return "LOCATION";
  if (type === "CUSTOMER_SUBLOCATION") return "SUBLOCATION";
  if (type === "CUSTOMER_CARRIER") return "CARRIER";
  invalid("Alleen klantlocaties, sublocaties en dragers kunnen naar het ERP worden gestuurd.");
}

function inventoryCommandContext(actor: MockUser, deviceId: string, appointmentExternalId?: string) {
  return {
    actorUserId: actor.id,
    representativeExternalId: actor.representativeId ?? actor.id,
    deviceId,
    country: actor.country,
    appointmentExternalId,
  };
}

function effectiveCountries(actor: MockUser): Country[] {
  if (actor.role === "SUPER_ADMIN" || actor.role === "GROUP_MANAGER") return ["BE", "NL", "DE"];
  return (actor.countryAccess?.length ? actor.countryAccess : [actor.country]) as Country[];
}

function requireInventoryManage(actor: MockUser) {
  if (!can(actor, "inventory.manage")) denied("Je hebt geen recht om Inventory te beheren.");
}

async function audit(tx: Prisma.TransactionClient, userId: string, entityType: string, entityId: string, action: string, value: unknown) {
  await tx.auditLog.create({ data: { userId, entityType, entityId, action, newValue: canonicalSalesErpJson(value) } });
}

function dateOnly(value: string) {
  const parsed = toInventoryDateOnly(value);
  if (!parsed) invalid("Datum is verplicht.");
  return parsed;
}
