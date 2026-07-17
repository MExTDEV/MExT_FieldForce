import { randomUUID } from "node:crypto";

import { Prisma, type ErpIntegrationProvider, type SalesAppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import {
  buildSalesErpCommand,
  canonicalSalesErpJson,
  enqueueSalesErpCommandInTransaction,
  SalesErpError,
  type SalesErpAppointment,
  type SalesErpProvider,
  type SalesErpReferenceItem,
} from "@/lib/server/integrations/sales-erp";
import {
  salesDayBusinessDate,
  salesDayCustomerScopeWhere,
} from "@/lib/server/salesday-customer-access";
import type { MockUser } from "@/lib/types";

export type SalesDayAppointmentInput = {
  relationId: string;
  startsAt?: string;
  endsAt?: string;
  timeZone: string;
};

export type SalesDayAppointmentOutcome = "COMPLETED" | "NOT_COMPLETED" | "MOVED" | "CANCELLED";

export function normalizeSalesErpAppointment(appointment: SalesErpAppointment) {
  const businessDate = dateOnly(appointment.businessDate, "afspraakdatum");
  const sourceUpdatedAt = instant(appointment.sourceUpdatedAt, "ERP-brontijd");
  if (!Number.isInteger(appointment.sequence) || appointment.sequence < 0) invalid("De ERP-afspraakvolgorde is ongeldig.");
  if (!appointment.externalId.trim() || !appointment.customerExternalId.trim() || !appointment.representativeExternalId.trim()) {
    invalid("De ERP-afspraak mist een verplichte externe identiteit.");
  }
  return {
    providerExternalId: appointment.externalId.trim(),
    sourceVersion: required(appointment.sourceVersion, "ERP-bronversie"),
    sourceUpdatedAt,
    businessDate,
    startsAt: appointment.startsAt ? instant(appointment.startsAt, "starttijd") : null,
    endsAt: appointment.endsAt ? instant(appointment.endsAt, "eindtijd") : null,
    timeZone: required(appointment.timeZone, "tijdzone"),
    sequence: appointment.sequence,
    status: appointment.status,
    nativeStatus: appointment.status,
    customerExternalId: appointment.customerExternalId.trim(),
    representativeExternalId: appointment.representativeExternalId.trim(),
    teamExternalId: appointment.teamExternalId?.trim() || null,
    country: appointment.country,
    outcomeReasonExternalId: appointment.outcomeReasonExternalId?.trim() || null,
    outcomeComment: appointment.outcomeComment?.trim() || null,
  };
}

export async function applySalesErpAppointment(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  appointment: SalesErpAppointment,
) {
  const normalized = normalizeSalesErpAppointment(appointment);
  const prismaProvider = provider as ErpIntegrationProvider;
  const [relationLink, representative] = await Promise.all([
    tx.businessRelationExternalLink.findUnique({
      where: { provider_externalId: { provider: prismaProvider, externalId: normalized.customerExternalId } },
      select: { relationId: true },
    }),
    tx.user.findFirst({
      where: {
        role: "REPRESENTATIVE",
        OR: [
          { representativeId: normalized.representativeExternalId },
          { id: normalized.representativeExternalId },
        ],
      },
      select: { id: true, teamId: true },
    }),
  ]);
  if (!relationLink) invalid("De ERP-afspraak verwijst naar een onbekende klant.");
  if (!representative) invalid("De ERP-afspraak verwijst naar een onbekende vertegenwoordiger.");

  const existing = await tx.salesAppointment.findUnique({
    where: { provider_externalId: { provider: prismaProvider, externalId: normalized.providerExternalId } },
  });
  if (existing?.pendingFieldForceEdit) {
    return { status: "PRESERVED_PENDING_FIELD_FORCE_EDIT" as const, appointmentId: existing.id };
  }
  const data = {
    provider: prismaProvider,
    externalId: normalized.providerExternalId,
    sourceVersion: normalized.sourceVersion,
    sourceUpdatedAt: normalized.sourceUpdatedAt,
    businessDate: normalized.businessDate,
    startsAt: normalized.startsAt,
    endsAt: normalized.endsAt,
    timeZone: normalized.timeZone,
    sequence: normalized.sequence,
    status: normalized.status,
    nativeStatus: normalized.nativeStatus,
    origin: "ERP" as const,
    pendingFieldForceEdit: false,
    relationId: relationLink.relationId,
    representativeUserId: representative.id,
    representativeExternalId: normalized.representativeExternalId,
    teamId: representative.teamId,
    teamExternalId: normalized.teamExternalId,
    country: normalized.country,
    outcomeReasonExternalId: normalized.outcomeReasonExternalId,
    outcomeComment: normalized.outcomeComment,
  };
  const saved = existing
    ? await tx.salesAppointment.update({ where: { id: existing.id }, data })
    : await tx.salesAppointment.create({ data });
  return { status: existing ? "UPDATED" as const : "CREATED" as const, appointmentId: saved.id };
}

export async function applySalesErpAppointmentOutcomeReason(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  reason: SalesErpReferenceItem,
) {
  return tx.salesAppointmentOutcomeReason.upsert({
    where: {
      provider_externalId: {
        provider: provider as ErpIntegrationProvider,
        externalId: required(reason.externalId, "reden-ID"),
      },
    },
    update: reasonValues(reason),
    create: {
      provider: provider as ErpIntegrationProvider,
      externalId: reason.externalId,
      ...reasonValues(reason),
    },
  });
}

export async function listSalesDayAppointments(actor: MockUser, now = new Date()) {
  if (actor.role !== "REPRESENTATIVE") denied("Mijn agenda is alleen beschikbaar voor een vertegenwoordiger.");
  return prisma.salesAppointment.findMany({
    where: {
      representativeUserId: actor.id,
      businessDate: dateOnly(salesDayBusinessDate(actor, now), "werkdag"),
      status: { not: "CANCELLED" },
    },
    include: {
      relation: {
        include: {
          contacts: { where: { active: true }, orderBy: [{ primary: "desc" }, { name: "asc" }] },
          addresses: { where: { active: true }, orderBy: [{ primary: "desc" }, { type: "asc" }] },
          billingValidation: true,
        },
      },
    },
    orderBy: [{ sequence: "asc" }, { startsAt: "asc" }, { id: "asc" }],
  });
}

export async function listSalesDayAppointmentOutcomeReasons(actor: MockUser, provider: SalesErpProvider) {
  return prisma.salesAppointmentOutcomeReason.findMany({
    where: {
      provider: provider as ErpIntegrationProvider,
      active: true,
      OR: [{ country: null }, { country: actor.country }],
    },
    orderBy: [{ code: "asc" }, { externalId: "asc" }],
  });
}

export async function createSalesDayAppointment(input: {
  actor: MockUser;
  deviceId: string;
  provider: SalesErpProvider;
  appointment: SalesDayAppointmentInput;
  now?: Date;
  changeType?: "CREATE" | "DUPLICATE";
}) {
  requireRepresentative(input.actor);
  const now = input.now ?? new Date();
  const businessDate = salesDayBusinessDate(input.actor, now);
  const prepared = prepareTimes(input.appointment, businessDate);
  const commandId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const relation = await tx.businessRelation.findFirst({
      where: { id: input.appointment.relationId, ...salesDayCustomerScopeWhere(input.actor) },
      include: { externalLinks: { where: { provider: input.provider as ErpIntegrationProvider }, take: 1 } },
    });
    if (!relation) denied("De geselecteerde klant valt buiten je SalesDay-scope.");
    const customerExternalId = relation.externalLinks[0]?.externalId;
    if (!customerExternalId) invalid("Een eigen afspraak vereist een klant die al door het ERP is bevestigd.");
    const last = await tx.salesAppointment.aggregate({
      where: { representativeUserId: input.actor.id, businessDate: dateOnly(businessDate, "werkdag") },
      _max: { sequence: true },
    });
    const sequence = (last._max.sequence ?? 0) + 1;
    const appointment = await tx.salesAppointment.create({
      data: {
        businessDate: dateOnly(businessDate, "werkdag"),
        startsAt: prepared.startsAt,
        endsAt: prepared.endsAt,
        timeZone: prepared.timeZone,
        sequence,
        origin: "REPRESENTATIVE",
        localRevision: 1,
        pendingFieldForceEdit: true,
        relationId: relation.id,
        representativeUserId: input.actor.id,
        representativeExternalId: input.actor.representativeId ?? input.actor.id,
        teamId: input.actor.teamId ?? null,
        teamExternalId: input.actor.teamId ?? null,
        country: input.actor.country,
      },
    });
    const command = appointmentUpsertCommand({
      commandId,
      actor: input.actor,
      deviceId: input.deviceId,
      appointment,
      customerExternalId,
      now,
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
    await recordChange(tx, {
      appointmentId: appointment.id,
      actor: input.actor,
      deviceId: input.deviceId,
      type: input.changeType ?? "CREATE",
      oldValue: {},
      proposedValue: appointmentSnapshot(appointment),
      commandId,
    });
    return { appointmentId: appointment.id, commandId, sequence };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function duplicateSalesDayAppointment(input: {
  actor: MockUser;
  deviceId: string;
  provider: SalesErpProvider;
  appointmentId: string;
  now?: Date;
}) {
  const source = await requireMutableAppointment(input.actor, input.appointmentId, input.now ?? new Date());
  return createSalesDayAppointment({
    ...input,
    appointment: {
      relationId: source.relationId,
      startsAt: source.startsAt?.toISOString(),
      endsAt: source.endsAt?.toISOString(),
      timeZone: source.timeZone,
    },
    changeType: "DUPLICATE",
  });
}

export async function updateSalesDayAppointment(input: {
  actor: MockUser;
  deviceId: string;
  provider: SalesErpProvider;
  appointmentId: string;
  appointment: SalesDayAppointmentInput;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const current = await requireMutableAppointment(input.actor, input.appointmentId, now);
  const businessDate = salesDayBusinessDate(input.actor, now);
  const prepared = prepareTimes(input.appointment, businessDate);
  const commandId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const locked = await lockMutableAppointment(tx, input.actor, current.id, current.businessDate);
    const relation = await tx.businessRelation.findFirst({
      where: { id: input.appointment.relationId, ...salesDayCustomerScopeWhere(input.actor) },
      include: { externalLinks: { where: { provider: input.provider as ErpIntegrationProvider }, take: 1 } },
    });
    if (!relation) denied("De geselecteerde klant valt buiten je SalesDay-scope.");
    const customerExternalId = relation.externalLinks[0]?.externalId;
    if (!customerExternalId) invalid("De afspraak vereist een klant die al door het ERP is bevestigd.");
    const revision = locked.localRevision + 1;
    const updated = await tx.salesAppointment.update({
      where: { id: locked.id },
      data: {
        relationId: relation.id,
        startsAt: prepared.startsAt,
        endsAt: prepared.endsAt,
        timeZone: prepared.timeZone,
        localRevision: revision,
        pendingFieldForceEdit: true,
      },
    });
    const dependency = await pendingCreateDependency(tx, locked);
    const command = appointmentUpsertCommand({
      commandId,
      actor: input.actor,
      deviceId: input.deviceId,
      appointment: updated,
      customerExternalId,
      now,
      dependsOnCommandIds: dependency,
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
    await recordChange(tx, {
      appointmentId: locked.id,
      actor: input.actor,
      deviceId: input.deviceId,
      type: "EDIT",
      oldValue: appointmentSnapshot(locked),
      proposedValue: appointmentSnapshot(updated),
      commandId,
    });
    return { appointmentId: updated.id, commandId, revision };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function setSalesDayAppointmentOutcome(input: {
  actor: MockUser;
  deviceId: string;
  provider: SalesErpProvider;
  appointmentId: string;
  outcome: SalesDayAppointmentOutcome;
  reasonExternalId?: string;
  comment?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const current = await requireMutableAppointment(input.actor, input.appointmentId, now);
  const reasonExternalId = input.reasonExternalId?.trim() || null;
  const comment = input.comment?.trim() || null;
  const commandId = randomUUID();
  const businessDate = salesDayBusinessDate(input.actor, now);
  return prisma.$transaction(async (tx) => {
    const locked = await lockMutableAppointment(tx, input.actor, current.id, current.businessDate);
    let reason: { requiresComment: boolean; active: boolean; country: MockUser["country"] | null } | null = null;
    if (input.outcome !== "COMPLETED") {
      if (!reasonExternalId) invalid("Een ERP-uitkomstreden is verplicht.");
      reason = await tx.salesAppointmentOutcomeReason.findUnique({
        where: {
          provider_externalId: {
            provider: input.provider as ErpIntegrationProvider,
            externalId: reasonExternalId,
          },
        },
        select: { active: true, country: true, requiresComment: true },
      });
      if (!reason || !reason.active || (reason.country && reason.country !== input.actor.country)) {
        invalid("De gekozen ERP-uitkomstreden is niet actief voor dit land.");
      }
      if (reason.requiresComment && !comment) invalid("Een toelichting is verplicht voor deze uitkomstreden.");
    }
    const revision = locked.localRevision + 1;
    const updated = await tx.salesAppointment.update({
      where: { id: locked.id },
      data: {
        status: input.outcome as SalesAppointmentStatus,
        outcomeReasonExternalId: reasonExternalId,
        outcomeComment: comment,
        localRevision: revision,
        pendingFieldForceEdit: true,
      },
    });
    const dependencies = await pendingCreateDependency(tx, locked);
    const command = buildSalesErpCommand({
      commandId,
      issuedAt: now.toISOString(),
      commandType: "appointment.outcome",
      businessKey: `sales-appointment:${locked.id}:revision:${revision}:outcome`,
      dependsOnCommandIds: dependencies,
      context: commandContext(input.actor, input.deviceId, locked.externalId ?? undefined),
      payload: {
        localAppointmentId: locked.id,
        appointmentExternalId: locked.externalId ?? undefined,
        expectedSourceVersion: locked.sourceVersion ?? undefined,
        outcome: input.outcome,
        reasonExternalId: reasonExternalId ?? undefined,
        comment: comment ?? undefined,
        completedAt: now.toISOString(),
      },
    });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
    await recordChange(tx, {
      appointmentId: locked.id,
      actor: input.actor,
      deviceId: input.deviceId,
      type: "OUTCOME",
      oldValue: appointmentSnapshot(locked),
      proposedValue: appointmentSnapshot(updated),
      validation: { reasonExternalId, commentRequired: reason?.requiresComment ?? false },
      commandId,
    });
    return { appointmentId: updated.id, commandId, revision, status: updated.status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function requireMutableAppointment(actor: MockUser, appointmentId: string, now: Date) {
  requireRepresentative(actor);
  const appointment = await prisma.salesAppointment.findFirst({
    where: {
      id: appointmentId,
      representativeUserId: actor.id,
      businessDate: dateOnly(salesDayBusinessDate(actor, now), "werkdag"),
      status: "PLANNED",
    },
  });
  if (!appointment) denied("Alleen een eigen geplande afspraak van vandaag kan worden gewijzigd.");
  return appointment;
}

async function lockMutableAppointment(
  tx: Prisma.TransactionClient,
  actor: MockUser,
  appointmentId: string,
  businessDate: Date,
) {
  const appointment = await tx.salesAppointment.findFirst({
    where: { id: appointmentId, representativeUserId: actor.id, businessDate, status: "PLANNED" },
  });
  if (!appointment) denied("De afspraak is intussen gewijzigd en kan niet meer worden bewerkt.");
  return appointment;
}

function appointmentUpsertCommand(input: {
  commandId: string;
  actor: MockUser;
  deviceId: string;
  appointment: {
    id: string; externalId: string | null; sourceVersion: string | null; businessDate: Date;
    startsAt: Date | null; endsAt: Date | null; timeZone: string; sequence: number;
    representativeExternalId: string;
  };
  customerExternalId: string;
  now: Date;
  dependsOnCommandIds?: string[];
}) {
  const revision = "localRevision" in input.appointment ? Number(input.appointment.localRevision) : 1;
  return buildSalesErpCommand({
    commandId: input.commandId,
    issuedAt: input.now.toISOString(),
    commandType: "appointment.upsert",
    businessKey: `sales-appointment:${input.appointment.id}:revision:${revision}`,
    dependsOnCommandIds: input.dependsOnCommandIds,
    context: commandContext(input.actor, input.deviceId, input.appointment.externalId ?? undefined),
    payload: {
      localAppointmentId: input.appointment.id,
      externalId: input.appointment.externalId ?? undefined,
      expectedSourceVersion: input.appointment.sourceVersion ?? undefined,
      businessDate: isoDate(input.appointment.businessDate),
      startsAt: input.appointment.startsAt?.toISOString(),
      endsAt: input.appointment.endsAt?.toISOString(),
      timeZone: input.appointment.timeZone,
      sequence: input.appointment.sequence,
      customerExternalId: input.customerExternalId,
      representativeExternalId: input.appointment.representativeExternalId,
    },
  });
}

async function pendingCreateDependency(
  tx: Prisma.TransactionClient,
  appointment: { id: string; externalId: string | null },
) {
  if (appointment.externalId) return [];
  const latest = await tx.salesAppointmentChange.findFirst({
    where: { appointmentId: appointment.id },
    orderBy: { createdAt: "asc" },
    select: { commandId: true },
  });
  return latest ? [latest.commandId] : [];
}

async function recordChange(
  tx: Prisma.TransactionClient,
  input: {
    appointmentId: string; actor: MockUser; deviceId: string;
    type: "CREATE" | "EDIT" | "DUPLICATE" | "OUTCOME";
    oldValue: unknown; proposedValue: unknown; validation?: unknown; commandId: string;
  },
) {
  await tx.salesAppointmentChange.create({
    data: {
      appointmentId: input.appointmentId,
      actorUserId: input.actor.id,
      deviceId: input.deviceId,
      type: input.type,
      oldValueJson: canonicalSalesErpJson(input.oldValue),
      proposedValueJson: canonicalSalesErpJson(input.proposedValue),
      validationJson: canonicalSalesErpJson(input.validation ?? {}),
      commandId: input.commandId,
    },
  });
  await tx.auditLog.create({
    data: {
      userId: input.actor.id,
      entityType: "SalesAppointment",
      entityId: input.appointmentId,
      action: `salesday.appointment.${input.type.toLowerCase()}`,
      oldValue: canonicalSalesErpJson(input.oldValue),
      newValue: canonicalSalesErpJson({ commandId: input.commandId, value: input.proposedValue }),
    },
  });
}

function prepareTimes(input: SalesDayAppointmentInput, businessDate: string) {
  const timeZone = required(input.timeZone, "Tijdzone");
  const startsAt = input.startsAt ? instant(input.startsAt, "starttijd") : null;
  const endsAt = input.endsAt ? instant(input.endsAt, "eindtijd") : null;
  if (startsAt && localDate(startsAt, timeZone) !== businessDate) invalid("De afspraak mag alleen voor vandaag worden gepland.");
  if (endsAt && localDate(endsAt, timeZone) !== businessDate) invalid("De eindtijd moet op dezelfde werkdag vallen.");
  if (startsAt && endsAt && endsAt <= startsAt) invalid("De eindtijd moet na de starttijd liggen.");
  return { startsAt, endsAt, timeZone };
}

function reasonValues(reason: SalesErpReferenceItem) {
  return {
    sourceVersion: required(reason.sourceVersion, "reden-bronversie"),
    sourceUpdatedAt: instant(reason.sourceUpdatedAt, "reden-brontijd"),
    code: required(reason.code, "redencode"),
    labelNl: required(reason.labelNl, "Nederlandse reden"),
    labelFr: required(reason.labelFr, "Franse reden"),
    labelDe: required(reason.labelDe, "Duitse reden"),
    country: reason.country ?? null,
    active: reason.active,
    requiresComment: reason.requiresComment,
  };
}

function appointmentSnapshot(appointment: object) {
  return Object.fromEntries(Object.entries(appointment).filter(([key]) => !["createdAt", "updatedAt"].includes(key)));
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

function localDate(value: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  } catch {
    invalid("De tijdzone is ongeldig.");
  }
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${label} is ongeldig.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || isoDate(date) !== value) invalid(`${label} is ongeldig.`);
  return date;
}

function instant(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid(`${label} is ongeldig.`);
  return date;
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) invalid(`${label} is verplicht.`);
  return normalized;
}

function requireRepresentative(actor: MockUser) {
  if (actor.role !== "REPRESENTATIVE") denied("Managementtoegang tot SalesDay is alleen-lezen.");
}

function denied(message: string): never {
  throw new SalesErpError({ code: "PERMISSION_REVOKED", message });
}

function invalid(message: string): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message });
}
