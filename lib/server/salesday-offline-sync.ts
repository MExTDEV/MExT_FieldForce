import { Prisma } from "@prisma/client";

import type { MockUser } from "@/lib/types";
import { prisma } from "@/lib/server/db";
import {
  assertSalesErpProvider,
  enqueueSalesErpCommandInTransaction,
  SalesErpError,
  serializeSalesErpCommand,
  type SalesErpCommand,
  type SalesErpProvider,
} from "@/lib/server/integrations/sales-erp";

export type OfflineSalesErpCommandItem = {
  command: SalesErpCommand;
  businessDate?: string;
};

export function parseOfflineSalesErpCommandItems(value: unknown): OfflineSalesErpCommandItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw invalidContract("Een synchronisatiebatch moet 1 tot 100 commando's bevatten.");
  }
  return value.map((item, index) => {
    if (!isObject(item) || !isObject(item.command)) {
      throw invalidContract(`Ongeldig synchronisatiecommando op positie ${index + 1}.`);
    }
    const command = item.command;
    if (
      typeof command.schemaVersion !== "string" ||
      typeof command.commandId !== "string" ||
      typeof command.commandType !== "string" ||
      typeof command.businessKey !== "string" ||
      typeof command.idempotencyKey !== "string" ||
      typeof command.issuedAt !== "string" ||
      command.conflictPriority !== "FIELDFORCE" ||
      !Array.isArray(command.dependsOnCommandIds) ||
      !command.dependsOnCommandIds.every((dependency) => typeof dependency === "string") ||
      !isObject(command.context) ||
      !isObject(command.payload)
    ) {
      throw invalidContract(`Onvolledige synchronisatie-envelop op positie ${index + 1}.`);
    }
    const businessDate = item.businessDate;
    if (businessDate !== undefined && (typeof businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate))) {
      throw invalidContract(`Ongeldige businessDate op positie ${index + 1}.`);
    }
    const typedCommand = command as SalesErpCommand;
    serializeSalesErpCommand(typedCommand);
    return { command: typedCommand, ...(businessDate ? { businessDate } : {}) };
  });
}

export function assertOfflineCommandActor(
  actor: MockUser,
  deviceId: string,
  items: readonly OfflineSalesErpCommandItem[],
) {
  if (actor.role !== "REPRESENTATIVE") {
    throw new SalesErpError({
      code: "PERMISSION_REVOKED",
      message: "Alleen een vertegenwoordiger kan eigen offline SalesDay-commando's indienen.",
    });
  }
  const representativeExternalId = actor.representativeId ?? actor.id;
  const commandIds = new Set<string>();
  for (const { command } of items) {
    if (commandIds.has(command.commandId)) throw invalidContract("Een synchronisatiebatch bevat dubbele commandId-waarden.");
    commandIds.add(command.commandId);
    if (
      command.context.actorUserId !== actor.id ||
      command.context.representativeExternalId !== representativeExternalId ||
      command.context.deviceId !== deviceId ||
      command.context.country !== actor.country
    ) {
      throw new SalesErpError({
        code: "PERMISSION_REVOKED",
        message: "Een offline commando valt buiten de aangemelde gebruiker, het toestel of de landenscope.",
        details: { commandId: command.commandId },
      });
    }
  }
}

export async function ingestOfflineSalesErpCommands(input: {
  actor: MockUser;
  loginSessionId: string | null;
  deviceId: string;
  provider: string;
  items: unknown;
}) {
  const { deviceId } = await requireActiveSalesDayDevice(input);
  assertSalesErpProvider(input.provider);
  const provider: SalesErpProvider = input.provider;
  const items = parseOfflineSalesErpCommandItems(input.items);
  assertOfflineCommandActor(input.actor, deviceId, items);

  return prisma.$transaction(async (database) => {
    const persistedCommandIds: string[] = [];
    for (const item of items) {
      const row = await enqueueSalesErpCommandInTransaction(database, { provider, ...item });
      persistedCommandIds.push(row.commandId);
    }
    return { persistedCommandIds };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function requireActiveSalesDayDevice(input: {
  actor: MockUser;
  loginSessionId: string | null;
  deviceId: string;
}) {
  const deviceId = normalizeDeviceId(input.deviceId);
  const device = await prisma.deviceRegistration.findFirst({
    where: {
      deviceId,
      userId: input.actor.id,
      status: "ACTIVE",
      keyFingerprint: { not: null },
      keyRevokedAt: null,
      deviceTokenRevokedAt: null,
      ...(input.loginSessionId
        ? {
            loginSessions: {
              some: {
                sessionId: input.loginSessionId,
                logoutAt: null,
                expiresAt: { gt: new Date() },
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
  if (!device) {
    throw new SalesErpError({
      code: "PERMISSION_REVOKED",
      message: "Het actieve, beveiligde SalesDay-toestel of de gebonden login-sessie is niet geldig.",
    });
  }
  return { deviceId, registrationId: device.id };
}

function normalizeDeviceId(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw invalidContract("Ongeldige technische toestelidentiteit.");
  }
  return normalized;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidContract(message: string) {
  return new SalesErpError({ code: "INVALID_CONTRACT", message });
}
