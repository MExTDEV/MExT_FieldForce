import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { Prisma, SalesAttachmentStatus, SalesAttachmentTargetType } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import { badRequest } from "@/lib/server/api";
import { buildSalesErpCommand, canonicalSalesErpJson, enqueueSalesErpCommandInTransaction, SalesErpError, type SalesErpProvider } from "@/lib/server/integrations/sales-erp";
import { salesDayBusinessDate } from "@/lib/server/salesday-customer-access";
import { assertSalesDayServerDayAccess } from "@/lib/server/salesday-day-access";
import type { MockUser } from "@/lib/types";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf", "text/plain", "text/csv",
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

type AttachmentContext = { actor: MockUser; loginSessionId: string | null; deviceId: string; provider: SalesErpProvider; now?: Date };

export async function stageSalesDayAttachment(input: AttachmentContext & {
  targetType: "APPOINTMENT" | "CUSTOMER";
  appointmentId: string;
  relationId?: string;
  categoryExternalId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  if (input.actor.role !== "REPRESENTATIVE") throw denied("Managementtoegang tot SalesDay is alleen-lezen.");
  const now = input.now ?? new Date();
  const businessDate = salesDayBusinessDate(input.actor, now);
  await assertSalesDayServerDayAccess({ ...input, businessDate, now });
  const categoryExternalId = required(input.categoryExternalId, "ERP-documentcategorie");
  const fileName = sanitizeFileName(input.fileName);
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!allowedMimeTypes.has(mimeType)) badRequest("Dit bestandstype wordt niet ondersteund.");
  if (input.bytes.length < 1 || input.bytes.length > MAX_ATTACHMENT_BYTES) badRequest("Een bijlage mag maximaal 25 MB groot zijn.");
  if (!input.deviceId.trim()) badRequest("Een actief toestel is vereist.");

  const appointment = await prisma.salesAppointment.findFirst({
    where: { id: input.appointmentId, representativeUserId: input.actor.id, businessDate: dateOnly(businessDate), status: { not: "CANCELLED" } },
    select: { id: true, relationId: true, externalId: true },
  });
  if (!appointment) throw denied("De afspraak hoort niet bij je agenda van vandaag.");
  const relationId = input.relationId ?? appointment.relationId;
  if (input.targetType === "CUSTOMER" && relationId !== appointment.relationId) throw denied("De klantbijlage valt buiten de afspraakscope.");
  const relationLink = await prisma.businessRelationExternalLink.findFirst({ where: { relationId, provider: input.provider }, select: { externalId: true } });
  if (!relationLink) throw invalid("De klant heeft nog geen bevestigde ERP-identiteit.");

  const id = randomUUID();
  const uploadToken = randomUUID();
  const commandId = randomUUID();
  const storageKey = `salesday-attachments/${businessDate}/${input.actor.id}/${id}-${fileName}`;
  const storagePath = safeStoragePath(storageKey);
  await mkdir(resolve(storagePath, ".."), { recursive: true });
  await writeFile(storagePath, input.bytes, { flag: "wx" });
  try {
    return await prisma.$transaction(async (tx) => {
      const dependencies = appointment.externalId ? [] : await appointmentCreateDependencies(tx, appointment.id);
      const targetExternalId = input.targetType === "APPOINTMENT" ? (appointment.externalId ?? appointment.id) : relationLink.externalId;
      const command = buildSalesErpCommand({
        commandId, commandType: "attachment.submit", businessKey: `attachment:${id}`, dependsOnCommandIds: dependencies,
        context: { actorUserId: input.actor.id, representativeExternalId: input.actor.representativeId ?? input.actor.id, deviceId: input.deviceId, country: input.actor.country, appointmentExternalId: appointment.externalId ?? undefined },
        payload: { localAttachmentId: id, targetType: input.targetType, targetExternalId, categoryExternalId, uploadToken, fileName, mimeType, sha256: createHash("sha256").update(input.bytes).digest("hex") },
        issuedAt: now.toISOString(),
      });
      const attachment = await tx.salesAttachment.create({ data: {
        id, targetType: input.targetType === "APPOINTMENT" ? SalesAttachmentTargetType.APPOINTMENT : SalesAttachmentTargetType.CUSTOMER,
        status: SalesAttachmentStatus.STAGED, appointmentId: appointment.id, relationId, authorUserId: input.actor.id,
        deviceId: input.deviceId, categoryExternalId, fileName, storageKey, mimeType, sizeBytes: input.bytes.length,
        sha256: command.payload.sha256, uploadToken, commandId,
      } });
      await enqueueSalesErpCommandInTransaction(tx, { provider: input.provider, command, businessDate });
      await tx.auditLog.create({ data: { userId: input.actor.id, entityType: "SalesAttachment", entityId: id, action: "salesday.attachment.staged", newValue: canonicalSalesErpJson({ commandId, targetType: input.targetType, categoryExternalId, sha256: attachment.sha256, sizeBytes: attachment.sizeBytes }) } });
      return { attachmentId: id, commandId, storageKey, sha256: attachment.sha256, status: attachment.status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    await rm(storagePath, { force: true });
    throw error;
  }
}

export async function listSalesDayAttachments(input: AttachmentContext & { appointmentId?: string; relationId?: string }) {
  if (input.actor.role !== "REPRESENTATIVE") throw denied("Managementtoegang tot SalesDay is alleen-lezen.");
  const businessDate = salesDayBusinessDate(input.actor, input.now);
  await assertSalesDayServerDayAccess({ ...input, businessDate });
  if (input.relationId && !input.appointmentId) throw denied("Een klantbijlage vereist een afspraak van vandaag.");
  if (input.appointmentId) {
    const appointment = await prisma.salesAppointment.findFirst({ where: { id: input.appointmentId, representativeUserId: input.actor.id, businessDate: dateOnly(businessDate), ...(input.relationId ? { relationId: input.relationId } : {}) }, select: { id: true } });
    if (!appointment) throw denied("De afspraak hoort niet bij je agenda van vandaag.");
  }
  return prisma.salesAttachment.findMany({ where: { authorUserId: input.actor.id, ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}), ...(input.relationId ? { relationId: input.relationId } : {}) }, orderBy: { createdAt: "asc" }, select: { id: true, targetType: true, status: true, appointmentId: true, relationId: true, categoryExternalId: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, externalId: true, erpAcknowledgedAt: true, createdAt: true } });
}

async function appointmentCreateDependencies(tx: Prisma.TransactionClient, appointmentId: string) {
  const change = await tx.salesAppointmentChange.findFirst({ where: { appointmentId }, orderBy: { createdAt: "asc" }, select: { commandId: true } });
  return change ? [change.commandId] : [];
}

function safeStoragePath(storageKey: string) {
  const root = resolve(process.env.FIELD_FORCE_UPLOAD_ROOT ?? join(process.cwd(), "storage", "uploads"));
  const path = resolve(root, ...storageKey.split("/"));
  if (!path.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`)) throw new Error("Ongeldig bestandspad.");
  return path;
}
function sanitizeFileName(value: string) { const name = value.trim().replace(/[^\w.\- ]/g, "").replace(/\s+/g, " ").slice(0, 180); if (!name || name === "." || name === "..") badRequest("Bestandsnaam ontbreekt."); return name; }
function required(value: string, label: string) { const normalized = value.trim(); if (!normalized) badRequest(`${label} is verplicht.`); return normalized; }
function dateOnly(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function denied(message: string): never { throw new SalesErpError({ code: "PERMISSION_REVOKED", message }); }
function invalid(message: string): never { throw new SalesErpError({ code: "INVALID_CONTRACT", message }); }
