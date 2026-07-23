import { randomUUID } from "node:crypto";

import { ErpOutboxStatus, Prisma, type ErpIntegrationProvider } from "@prisma/client";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/server/db";
import {
  buildSalesErpCommand,
  canonicalSalesErpJson,
  enqueueSalesErpCommandInTransaction,
  SalesErpError,
  type SalesErpCommand,
  type SalesErpProvider,
} from "@/lib/server/integrations/sales-erp";
import { salesDayBusinessDate } from "@/lib/server/salesday-customer-access";
import { assertSalesDayServerDayAccess } from "@/lib/server/salesday-day-access";
import { isSalesDayManagementRole, scopedSalesDayRepresentativeUserWhere } from "@/lib/server/salesday-scope";
import type { MockUser } from "@/lib/types";

type DayContext = { actor: MockUser; loginSessionId: string | null; deviceId: string; provider: SalesErpProvider; now?: Date };
type MutableAppointment = Prisma.SalesAppointmentGetPayload<{ include: { visitReport: true } }>;

export async function getSalesDayAgenda(input: Omit<DayContext, "provider">) {
  const businessDate = salesDayBusinessDate(input.actor, input.now);
  if (input.actor.role === "REPRESENTATIVE") {
    const gate = await assertSalesDayServerDayAccess({ ...input, businessDate });
    const appointments = await findSalesDayAgendaAppointments({
      businessDate,
      where: { representativeUserId: input.actor.id },
    });
    const closure = await prisma.salesDayClosure.findUnique({
      where: { representativeUserId_businessDate: { representativeUserId: input.actor.id, businessDate: dateOnly(businessDate) } },
    });
    return { businessDate, gate, readOnly: false, scope: "OWN" as const, appointments, closure };
  }
  if (!isSalesDayManagementRole(input.actor)) denied("Je hebt geen toegang tot SalesDay-agenda.");
  const appointments = await findSalesDayAgendaAppointments({
    businessDate,
    where: { representative: { is: scopedSalesDayRepresentativeUserWhere(input.actor) } },
  });
  return { businessDate, gate: null, readOnly: true, scope: "MANAGEMENT" as const, appointments, closure: null };
}

async function findSalesDayAgendaAppointments(input: {
  businessDate: string;
  where: Prisma.SalesAppointmentWhereInput;
}) {
  const appointments = await prisma.salesAppointment.findMany({
    where: { ...input.where, businessDate: dateOnly(input.businessDate) },
    include: {
      representative: { select: { id: true, firstName: true, lastName: true, country: true, team: { select: { id: true, name: true } } } },
      relation: { include: { contacts: { where: { active: true } }, addresses: { where: { active: true } }, billingValidation: true } },
      visitReport: { include: { addenda: { orderBy: { createdAt: "asc" } } } },
      leads: { orderBy: { createdAt: "asc" } },
      followUps: { orderBy: { createdAt: "asc" } },
      references: { orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ sequence: "asc" }, { startsAt: "asc" }, { id: "asc" }],
  });
  return appointments;
}

export async function createSalesVisitReport(input: DayContext & { appointmentId: string; html: string }) {
  const now = input.now ?? new Date();
  const html = required(input.html, "Bezoekverslag");
  return withMutableDayAppointment(input, async (tx, appointment, businessDate) => {
    if (appointment.visitReport) invalid("Het originele bezoekverslag is definitief en kan niet worden vervangen.");
    const commandId = randomUUID();
    const reportId = randomUUID();
    const dependencies = await appointmentDependencies(tx, appointment.id, appointment.externalId);
    const command = buildSalesErpCommand({
      commandId, issuedAt: now.toISOString(), commandType: "visit-report.submit",
      businessKey: `visit-report:${reportId}:closed`, dependsOnCommandIds: dependencies,
      context: commandContext(input, appointment.externalId),
      payload: { localAppointmentId: appointment.id, appointmentExternalId: appointment.externalId ?? undefined, localReportId: reportId, html, closedAt: now.toISOString() },
    });
    const report = await tx.salesVisitReport.create({ data: { id: reportId, appointmentId: appointment.id, authorUserId: input.actor.id, html, closedAt: now, commandId } });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
    await audit(tx, input.actor.id, "SalesVisitReport", report.id, "salesday.visitReport.closed", { commandId });
    return { reportId: report.id, commandId };
  });
}

export async function createSalesVisitReportAddendum(input: DayContext & { reportId: string; reason: string; html: string }) {
  if (!can(input.actor, "salesday.manage")) denied("Je hebt geen recht om een correctie-addendum toe te voegen.");
  const now = input.now ?? new Date();
  const reason = required(input.reason, "Correctiereden");
  const html = required(input.html, "Correctie");
  return prisma.$transaction(async (tx) => {
    const report = await tx.salesVisitReport.findUnique({
      where: { id: input.reportId },
      include: { appointment: true },
    });
    if (!report || !managementCountryAccess(input.actor, report.appointment.country)) denied("Het bezoekverslag valt buiten je beheerscope.");
    const closure = await tx.salesDayClosure.findUnique({
      where: { representativeUserId_businessDate: { representativeUserId: report.appointment.representativeUserId, businessDate: report.appointment.businessDate } },
    });
    if (!closure) invalid("Een correctie-addendum is pas na de dagafsluiting toegestaan.");
    const id = randomUUID();
    const commandId = randomUUID();
    const dependencies = report.externalId ? [] : [report.commandId];
    const command = buildSalesErpCommand({
      commandId, issuedAt: now.toISOString(), commandType: "visit-report.addendum",
      businessKey: `visit-report-addendum:${id}`, dependsOnCommandIds: dependencies,
      context: commandContext(input, report.appointment.externalId),
      payload: {
        localAppointmentId: report.appointment.id, appointmentExternalId: report.appointment.externalId ?? undefined,
        localReportId: report.id, reportExternalId: report.externalId ?? undefined,
        localAddendumId: id, reason, html, createdAt: now.toISOString(),
      },
    });
    const addendum = await tx.salesVisitReportAddendum.create({ data: { id, reportId: report.id, authorUserId: input.actor.id, reason, html, commandId } });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate: isoDate(report.appointment.businessDate) });
    await audit(tx, input.actor.id, "SalesVisitReportAddendum", addendum.id, "salesday.visitReport.addendum.created", { reportId: report.id, commandId, reason });
    return { addendumId: addendum.id, commandId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createSalesLead(input: DayContext & { appointmentId: string; title: string; description?: string }) {
  return createAppointmentSideCommand(input, "lead.create", "SalesLead", {
    title: required(input.title, "Leadtitel"), description: input.description?.trim() || null,
  });
}

export async function createSalesFollowUp(input: DayContext & { appointmentId: string; type: string; description: string }) {
  return createAppointmentSideCommand(input, "follow-up.create", "SalesFollowUp", {
    type: required(input.type, "Opvolgtype"), description: required(input.description, "Opvolgbeschrijving"),
  });
}

export async function createSalesReference(input: DayContext & {
  appointmentId: string; proposedName: string; contactName?: string; email?: string; phone?: string; comment?: string;
}) {
  return createAppointmentSideCommand(input, "reference.create", "SalesReference", {
    proposedName: required(input.proposedName, "Naam potentiële klant"), contactName: input.contactName?.trim() || null,
    email: input.email?.trim() || null, phone: input.phone?.trim() || null, comment: input.comment?.trim() || null,
  });
}

export async function closeSalesDay(input: DayContext) {
  requireRepresentative(input.actor);
  const now = input.now ?? new Date();
  const businessDate = salesDayBusinessDate(input.actor, now);
  await assertSalesDayServerDayAccess({ ...input, businessDate, now });
  return prisma.$transaction(async (tx) => {
    const existing = await tx.salesDayClosure.findUnique({ where: { representativeUserId_businessDate: { representativeUserId: input.actor.id, businessDate: dateOnly(businessDate) } } });
    if (existing) return { closureId: existing.id, commandId: existing.commandId, alreadyClosed: true };
    const appointments = await tx.salesAppointment.findMany({
      where: { representativeUserId: input.actor.id, businessDate: dateOnly(businessDate) },
      include: { visitReport: { select: { id: true } } }, orderBy: { sequence: "asc" },
    });
    const unresolved = appointments.filter((appointment) => !["COMPLETED", "NOT_COMPLETED", "MOVED", "CANCELLED"].includes(appointment.status));
    if (unresolved.length) invalid("Elke afspraak moet eerst een definitieve uitkomst hebben.");
    if (appointments.some((appointment) => appointment.status === "COMPLETED" && !appointment.visitReport)) invalid("Elke uitgevoerde afspraak vereist een definitief bezoekverslag.");
    if (appointments.some((appointment) => ["NOT_COMPLETED", "MOVED", "CANCELLED"].includes(appointment.status) && !appointment.outcomeReasonExternalId)) invalid("Elke niet-uitgevoerde afspraak vereist een ERP-reden.");
    const pending = await tx.erpOutboxCommand.findMany({
      where: { actorUserId: input.actor.id, businessDate: dateOnly(businessDate), status: { not: ErpOutboxStatus.ACCEPTED } }, select: { commandId: true },
    });
    const id = randomUUID();
    const commandId = randomUUID();
    const command = buildSalesErpCommand({
      commandId, issuedAt: now.toISOString(), commandType: "day-close.submit", businessKey: `sales-day:${input.actor.id}:${businessDate}:close`,
      dependsOnCommandIds: pending.map((item) => item.commandId), context: commandContext(input),
      payload: {
        localDayCloseId: id, businessDate, closedAt: now.toISOString(),
        appointmentExternalIds: appointments.flatMap((appointment) => appointment.externalId ? [appointment.externalId] : []),
        localAppointmentIds: appointments.map((appointment) => appointment.id),
      },
    });
    const closure = await tx.salesDayClosure.create({ data: { id, representativeUserId: input.actor.id, businessDate: dateOnly(businessDate), closedAt: now, commandId } });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
    await audit(tx, input.actor.id, "SalesDayClosure", closure.id, "salesday.day.closed", { commandId, pendingCommandCount: pending.length });
    return { closureId: closure.id, commandId, alreadyClosed: false, synchronizationRequired: pending.length > 0 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function createAppointmentSideCommand(
  input: DayContext & { appointmentId: string },
  commandType: "lead.create" | "follow-up.create" | "reference.create",
  model: "SalesLead" | "SalesFollowUp" | "SalesReference",
  values: Record<string, string | null>,
) {
  const now = input.now ?? new Date();
  return withMutableDayAppointment(input, async (tx, appointment, businessDate) => {
    const relationLink = await tx.businessRelationExternalLink.findFirst({ where: { relationId: appointment.relationId, provider: input.provider as ErpIntegrationProvider } });
    if (!relationLink) invalid("De klant heeft nog geen bevestigde ERP-identiteit.");
    const id = randomUUID();
    const commandId = randomUUID();
    const dependencies = await appointmentDependencies(tx, appointment.id, appointment.externalId);
    const common = { localAppointmentId: appointment.id, appointmentExternalId: appointment.externalId ?? undefined };
    let command: SalesErpCommand;
    if (commandType === "lead.create") {
      command = buildSalesErpCommand({ commandId, issuedAt: now.toISOString(), commandType, businessKey: `${commandType}:${id}`, dependsOnCommandIds: dependencies, context: commandContext(input, appointment.externalId), payload: { ...common, localLeadId: id, customerExternalId: relationLink.externalId, title: values.title!, description: values.description ?? undefined } });
    } else if (commandType === "follow-up.create") {
      command = buildSalesErpCommand({ commandId, issuedAt: now.toISOString(), commandType, businessKey: `${commandType}:${id}`, dependsOnCommandIds: dependencies, context: commandContext(input, appointment.externalId), payload: { ...common, localFollowUpId: id, customerExternalId: relationLink.externalId, type: values.type!, description: values.description! } });
    } else {
      command = buildSalesErpCommand({ commandId, issuedAt: now.toISOString(), commandType, businessKey: `${commandType}:${id}`, dependsOnCommandIds: dependencies, context: commandContext(input, appointment.externalId), payload: { ...common, localReferenceId: id, referringCustomerExternalId: relationLink.externalId, proposedName: values.proposedName!, contactName: values.contactName ?? undefined, email: values.email ?? undefined, phone: values.phone ?? undefined, comment: values.comment ?? undefined } });
    }
    if (model === "SalesLead") await tx.salesLead.create({ data: { id, appointmentId: appointment.id, actorUserId: input.actor.id, title: values.title!, description: values.description, commandId } });
    else if (model === "SalesFollowUp") await tx.salesFollowUp.create({ data: { id, appointmentId: appointment.id, actorUserId: input.actor.id, type: values.type!, description: values.description!, commandId } });
    else await tx.salesReference.create({ data: { id, appointmentId: appointment.id, actorUserId: input.actor.id, proposedName: values.proposedName!, contactName: values.contactName, email: values.email, phone: values.phone, comment: values.comment, commandId } });
    await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
    await audit(tx, input.actor.id, model, id, `salesday.${commandType}`, { commandId });
    return { id, commandId };
  });
}

async function withMutableDayAppointment<T>(input: DayContext & { appointmentId: string }, work: (tx: Prisma.TransactionClient, appointment: MutableAppointment, businessDate: string) => Promise<T>) {
  requireRepresentative(input.actor);
  const now = input.now ?? new Date();
  const businessDate = salesDayBusinessDate(input.actor, now);
  await assertSalesDayServerDayAccess({ ...input, businessDate, now });
  return prisma.$transaction(async (tx) => {
    const closure = await tx.salesDayClosure.findUnique({ where: { representativeUserId_businessDate: { representativeUserId: input.actor.id, businessDate: dateOnly(businessDate) } } });
    if (closure) denied("De afgesloten werkdag is onveranderlijk.");
    const appointment = await tx.salesAppointment.findFirst({ where: { id: input.appointmentId, representativeUserId: input.actor.id, businessDate: dateOnly(businessDate) }, include: { visitReport: true } });
    if (!appointment) denied("De afspraak hoort niet bij je agenda van vandaag.");
    return work(tx, appointment, businessDate);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function appointmentDependencies(tx: Prisma.TransactionClient, appointmentId: string, externalId: string | null) {
  if (externalId) return [];
  const created = await tx.salesAppointmentChange.findFirst({ where: { appointmentId }, orderBy: { createdAt: "asc" }, select: { commandId: true } });
  return created ? [created.commandId] : [];
}

async function audit(tx: Prisma.TransactionClient, userId: string, entityType: string, entityId: string, action: string, value: unknown) {
  await tx.auditLog.create({ data: { userId, entityType, entityId, action, newValue: canonicalSalesErpJson(value) } });
}

function commandContext(input: Pick<DayContext, "actor" | "deviceId">, appointmentExternalId?: string | null) {
  return { actorUserId: input.actor.id, representativeExternalId: input.actor.representativeId ?? input.actor.id, deviceId: input.deviceId, country: input.actor.country, appointmentExternalId: appointmentExternalId ?? undefined };
}

function managementCountryAccess(actor: MockUser, country: MockUser["country"]) {
  return actor.role === "SUPER_ADMIN" || actor.country === country || Boolean(actor.countryAccess?.includes(country));
}

function dateOnly(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function required(value: string, label: string) { const normalized = value.trim(); if (!normalized) invalid(`${label} is verplicht.`); return normalized; }
function requireRepresentative(actor: MockUser) { if (actor.role !== "REPRESENTATIVE") denied("Managementtoegang tot SalesDay is alleen-lezen."); }
function denied(message: string): never { throw new SalesErpError({ code: "PERMISSION_REVOKED", message }); }
function invalid(message: string): never { throw new SalesErpError({ code: "INVALID_CONTRACT", message }); }
