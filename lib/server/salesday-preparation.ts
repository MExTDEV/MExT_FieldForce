import { Prisma, type ErpIntegrationProvider } from "@prisma/client";

import {
  buildPreparationRecommendations,
  countryLocalDateTime,
  nextEffectiveBusinessDate,
  parseSalesPreparationConfiguration,
  type SalesPreparationConfiguration,
} from "@/lib/salesday/preparation";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/server/db";
import type {
  SalesErpCommercialHistoryDocument,
  SalesErpProvider,
} from "@/lib/server/integrations/sales-erp/contracts";
import { canonicalSalesErpJson } from "@/lib/server/integrations/sales-erp";
import { SalesErpError } from "@/lib/server/integrations/sales-erp/errors";
import { assertSalesDayServerDayAccess } from "@/lib/server/salesday-day-access";
import { isSalesDayManagementRole, scopedSalesDayRepresentativeUserWhere } from "@/lib/server/salesday-scope";
import type { MockUser } from "@/lib/types";

const preparationSettingKey = "salesday.preparation.v1";

export async function applySalesErpCommercialHistory(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  document: SalesErpCommercialHistoryDocument,
) {
  const prismaProvider = provider as ErpIntegrationProvider;
  const relationLink = await tx.businessRelationExternalLink.findUnique({
    where: { provider_externalId: { provider: prismaProvider, externalId: required(document.customerExternalId, "klant-ID") } },
    select: { relationId: true },
  });
  if (!relationLink) invalid("Het ERP-verkoophistoriedocument verwijst naar een onbekende klant.");
  const values = historyValues(document, relationLink.relationId);
  const existing = await tx.salesCommercialHistoryDocument.findUnique({
    where: { provider_externalId: { provider: prismaProvider, externalId: required(document.externalId, "document-ID") } },
  });
  const saved = existing
    ? await tx.salesCommercialHistoryDocument.update({ where: { id: existing.id }, data: values })
    : await tx.salesCommercialHistoryDocument.create({ data: { provider: prismaProvider, externalId: document.externalId, ...values } });
  if (existing) await tx.salesCommercialHistoryLine.deleteMany({ where: { documentId: saved.id } });
  if (document.lines.length) {
    await tx.salesCommercialHistoryLine.createMany({
      data: document.lines.map((line) => ({
        documentId: saved.id,
        lineNumber: line.lineNumber,
        articleExternalId: required(line.articleExternalId, "artikel-ID"),
        articleNumberSnapshot: required(line.articleNumberSnapshot, "artikelnummer"),
        descriptionSnapshot: required(line.descriptionSnapshot, "artikelomschrijving"),
        quantity: decimal(line.quantity, "hoeveelheid"),
        unitSnapshot: required(line.unitSnapshot, "eenheid"),
        unitPriceSnapshot: decimal(line.unitPriceSnapshot, "eenheidsprijs"),
        vatRateSnapshot: decimal(line.vatRateSnapshot, "btw-percentage"),
        lineAmountExcludingVat: decimal(line.lineAmountExcludingVat, "lijnbedrag"),
        carrierExternalId: line.carrierExternalId?.trim() || null,
      })),
    });
  }
  return { status: existing ? "UPDATED" as const : "CREATED" as const, documentId: saved.id };
}

export async function getSalesPreparationConfiguration() {
  const setting = await prisma.appSetting.findUnique({ where: { key: preparationSettingKey }, select: { value: true } });
  return parseSalesPreparationConfiguration(setting?.value);
}

export async function setSalesPreparationConfiguration(actor: MockUser, configuration: SalesPreparationConfiguration) {
  if (!can(actor, "salesday.settings.manage")) denied("Je hebt geen recht om SalesDay-voorbereiding te beheren.");
  const normalized = parseSalesPreparationConfiguration(JSON.stringify(configuration));
  const value = canonicalSalesErpJson(normalized);
  return prisma.$transaction(async (tx) => {
    const previous = await tx.appSetting.findUnique({ where: { key: preparationSettingKey } });
    const setting = await tx.appSetting.upsert({
      where: { key: preparationSettingKey },
      update: { value, updatedById: actor.id },
      create: { key: preparationSettingKey, value, updatedById: actor.id },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        entityType: "AppSetting",
        entityId: setting.id,
        action: "salesday.preparation.configuration.set",
        oldValue: previous?.value ?? null,
        newValue: value,
      },
    });
    return normalized;
  });
}

export async function getSalesPreparationWindow(actor: MockUser, now = new Date()) {
  const configuration = await getSalesPreparationConfiguration();
  const countryConfiguration = configuration.countries[actor.country];
  const local = countryLocalDateTime(now, countryConfiguration);
  const holidays = await prisma.holiday.findMany({
    where: { country: actor.country, active: true, date: { gt: dateOnly(local.date) } },
    select: { date: true },
  });
  const businessDate = nextEffectiveBusinessDate(local.date, holidays.map((holiday) => holiday.date));
  return {
    businessDate,
    visible: local.time >= countryConfiguration.visibleFrom,
    visibleFrom: countryConfiguration.visibleFrom,
    timeZone: countryConfiguration.timeZone,
    localDate: local.date,
    localTime: local.time,
    configuration: countryConfiguration,
  };
}

export async function getSalesPreparationOverview(input: {
  actor: MockUser;
  loginSessionId: string | null;
  deviceId: string;
  now?: Date;
}) {
  const window = await getSalesPreparationWindow(input.actor, input.now);
  const gate = input.actor.role === "REPRESENTATIVE"
    ? await assertSalesDayServerDayAccess({
        actor: input.actor,
        loginSessionId: input.loginSessionId,
        deviceId: input.deviceId,
        businessDate: window.businessDate,
        now: input.now,
      })
    : null;
  if (input.actor.role !== "REPRESENTATIVE" && !isSalesDayManagementRole(input.actor)) {
    denied("Je hebt geen toegang tot SalesDay-voorbereiding.");
  }
  if (!window.visible) return { ...window, gate, appointments: [] };
  const appointments = await prisma.salesAppointment.findMany({
    where: {
      ...(input.actor.role === "REPRESENTATIVE"
        ? { representativeUserId: input.actor.id }
        : { representative: { is: scopedSalesDayRepresentativeUserWhere(input.actor) } }),
      businessDate: dateOnly(window.businessDate),
      status: { not: "CANCELLED" },
    },
    include: {
      representative: { select: { id: true, firstName: true, lastName: true, country: true, team: { select: { id: true, name: true } } } },
      relation: {
        include: {
          contacts: { where: { active: true }, orderBy: [{ primary: "desc" }, { name: "asc" }] },
          addresses: { where: { active: true }, orderBy: [{ primary: "desc" }, { type: "asc" }] },
        },
      },
      preparationState: true,
      preparationNote: true,
      preparationFeedback: true,
    },
    orderBy: [{ sequence: "asc" }, { startsAt: "asc" }, { id: "asc" }],
  });
  const relationIds = [...new Set(appointments.map((appointment) => appointment.relationId))];
  const history = relationIds.length
    ? await prisma.salesCommercialHistoryDocument.findMany({
        where: { relationId: { in: relationIds } },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
        orderBy: { documentDate: "asc" },
      })
    : [];
  const historyByRelation = groupByRelationId(history);
  return {
    ...window,
    gate,
    readOnly: input.actor.role !== "REPRESENTATIVE",
    scope: input.actor.role === "REPRESENTATIVE" ? "OWN" as const : "MANAGEMENT" as const,
    appointments: appointments.map((appointment) => {
      const recommendations = buildPreparationRecommendations({
        appointmentBusinessDate: window.businessDate,
        configuration: window.configuration,
        documents: historyByRelation.get(appointment.relationId) ?? [],
      });
      const feedback = new Map(appointment.preparationFeedback.map((item) => [item.articleExternalId, item]));
      return {
        ...appointment,
        recommendations: recommendations.map((recommendation) => ({
          ...recommendation,
          feedback: feedback.get(recommendation.articleExternalId) ?? null,
        })),
      };
    }),
  };
}

function groupByRelationId<T extends { relationId: string }>(items: T[]) {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const group = result.get(item.relationId);
    if (group) group.push(item);
    else result.set(item.relationId, [item]);
  }
  return result;
}

export async function updateSalesPreparation(input: {
  actor: MockUser;
  loginSessionId: string | null;
  deviceId: string;
  appointmentId: string;
  note?: string;
  prepared?: boolean;
  feedback?: { articleExternalId: string; relevant?: boolean; addedManually?: boolean; comment?: string };
  now?: Date;
}) {
  requireRepresentative(input.actor);
  const now = input.now ?? new Date();
  const window = await getSalesPreparationWindow(input.actor, now);
  if (!window.visible) denied("De voorbereiding is nog niet beschikbaar.");
  await assertSalesDayServerDayAccess({
    actor: input.actor,
    loginSessionId: input.loginSessionId,
    deviceId: input.deviceId,
    businessDate: window.businessDate,
    now,
  });
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.salesAppointment.findFirst({
      where: {
        id: input.appointmentId,
        representativeUserId: input.actor.id,
        businessDate: dateOnly(window.businessDate),
        status: { not: "CANCELLED" },
      },
    });
    if (!appointment) denied("De afspraak hoort niet bij je volgende voorbereiding.");
    if (input.note !== undefined) {
      const content = input.note.trim();
      await tx.salesPreparationNote.upsert({
        where: { appointmentId: appointment.id },
        update: { content, authorUserId: input.actor.id },
        create: { appointmentId: appointment.id, authorUserId: input.actor.id, content },
      });
    }
    if (input.prepared) {
      await tx.salesPreparationState.upsert({
        where: { appointmentId: appointment.id },
        update: { preparedById: input.actor.id, preparedAt: now },
        create: { appointmentId: appointment.id, preparedById: input.actor.id, preparedAt: now },
      });
    }
    if (input.feedback) {
      const articleExternalId = required(input.feedback.articleExternalId, "artikel-ID");
      const exists = await tx.salesCommercialHistoryLine.findFirst({
        where: { articleExternalId, document: { relationId: appointment.relationId } },
        select: { id: true },
      });
      if (!exists) invalid("Feedback kan alleen worden opgeslagen voor een ERP-artikel uit de klantgeschiedenis.");
      await tx.salesPreparationRecommendationFeedback.upsert({
        where: { appointmentId_articleExternalId: { appointmentId: appointment.id, articleExternalId } },
        update: {
          actorUserId: input.actor.id,
          relevant: input.feedback.relevant ?? null,
          addedManually: input.feedback.addedManually ?? false,
          comment: input.feedback.comment?.trim() || null,
        },
        create: {
          appointmentId: appointment.id,
          actorUserId: input.actor.id,
          articleExternalId,
          relevant: input.feedback.relevant ?? null,
          addedManually: input.feedback.addedManually ?? false,
          comment: input.feedback.comment?.trim() || null,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: input.actor.id,
        entityType: "SalesAppointment",
        entityId: appointment.id,
        action: "salesday.preparation.updated",
        newValue: canonicalSalesErpJson({ noteChanged: input.note !== undefined, prepared: Boolean(input.prepared), feedback: input.feedback ?? null }),
      },
    });
    return { appointmentId: appointment.id, prepared: Boolean(input.prepared) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function historyValues(document: SalesErpCommercialHistoryDocument, relationId: string) {
  return {
    sourceVersion: required(document.sourceVersion, "document-bronversie"),
    sourceUpdatedAt: instant(document.sourceUpdatedAt, "document-brontijd"),
    documentType: document.documentType,
    documentNumber: required(document.documentNumber, "documentnummer"),
    documentDate: dateOnly(document.documentDate),
    relationId,
    representativeExternalId: document.representativeExternalId?.trim() || null,
    currency: document.currency,
    amountExcludingVat: decimal(document.amountExcludingVat, "bedrag excl. btw"),
    amountIncludingVat: decimal(document.amountIncludingVat, "bedrag incl. btw"),
    paymentStatus: document.paymentStatus,
    openAmount: decimal(document.openAmount, "openstaand bedrag"),
  };
}

function decimal(value: string, label: string) {
  try { return new Prisma.Decimal(value); } catch { invalid(`${label} is ongeldig.`); }
}

function instant(value: string, label: string) {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) invalid(`${label} is ongeldig.`);
  return result;
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("De werkdag is ongeldig.");
  const result = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) invalid("De werkdag is ongeldig.");
  return result;
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) invalid(`${label} is verplicht.`);
  return normalized;
}

function requireRepresentative(actor: MockUser) {
  if (actor.role !== "REPRESENTATIVE") denied("Mijn voorbereiding is alleen beschikbaar voor een vertegenwoordiger.");
}

function denied(message: string): never {
  throw new SalesErpError({ code: "PERMISSION_REVOKED", message });
}

function invalid(message: string): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message });
}
