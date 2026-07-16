import { Prisma } from "@prisma/client";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/server/db";
import type { MockUser } from "@/lib/types";

const activeEmergencyKey = "GLOBAL";

export type SalesDayEmergencyModeRecord = {
  id: string;
  activeKey: string | null;
  reason: string;
  startsAt: Date;
  endsAt: Date;
  activatedByUserId: string;
  deactivatedAt: Date | null;
  deactivatedByUserId: string | null;
  deactivationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateEmergencyModeData = Pick<
  SalesDayEmergencyModeRecord,
  "activeKey" | "reason" | "startsAt" | "endsAt" | "activatedByUserId"
>;

type DeactivateEmergencyModeData = Pick<
  SalesDayEmergencyModeRecord,
  "activeKey" | "deactivatedAt" | "deactivatedByUserId" | "deactivationReason"
>;

type EmergencyAuditData = {
  userId: string;
  entityId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
};

export interface SalesDayEmergencyModeTransaction {
  clearExpiredOpen(now: Date): Promise<void>;
  findOpen(): Promise<SalesDayEmergencyModeRecord | null>;
  findById(id: string): Promise<SalesDayEmergencyModeRecord | null>;
  create(data: CreateEmergencyModeData): Promise<SalesDayEmergencyModeRecord>;
  deactivate(id: string, data: DeactivateEmergencyModeData): Promise<SalesDayEmergencyModeRecord>;
  writeAudit(data: EmergencyAuditData): Promise<void>;
}

export interface SalesDayEmergencyModeStore {
  transaction<T>(action: (database: SalesDayEmergencyModeTransaction) => Promise<T>): Promise<T>;
  findActive(now: Date): Promise<SalesDayEmergencyModeRecord | null>;
  findOpen(now: Date): Promise<SalesDayEmergencyModeRecord | null>;
}

export type SalesDayEmergencyModeErrorCode =
  | "INVALID_INPUT"
  | "PERMISSION_REQUIRED"
  | "ALREADY_OPEN"
  | "NOT_FOUND";

export class SalesDayEmergencyModeError extends Error {
  constructor(public readonly code: SalesDayEmergencyModeErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SalesDayEmergencyModeError";
  }
}

export async function activateSalesDayEmergencyMode(
  actor: MockUser,
  input: { reason: string; startsAt: string | Date; endsAt: string | Date },
  options: { store?: SalesDayEmergencyModeStore; now?: () => Date } = {},
) {
  requireEmergencyPermission(actor);
  const reason = requiredText(input.reason, "Incidentreden", 2000);
  const startsAt = requiredDate(input.startsAt, "Starttijd");
  const endsAt = requiredDate(input.endsAt, "Eindtijd");
  const now = (options.now ?? (() => new Date()))();
  if (endsAt <= startsAt) {
    throw new SalesDayEmergencyModeError("INVALID_INPUT", "De eindtijd moet na de starttijd liggen.");
  }
  if (endsAt <= now) {
    throw new SalesDayEmergencyModeError("INVALID_INPUT", "De eindtijd moet in de toekomst liggen.");
  }
  const store = options.store ?? prismaSalesDayEmergencyModeStore;
  try {
    return await store.transaction(async (database) => {
      await database.clearExpiredOpen(now);
      const existing = await database.findOpen();
      if (existing) {
        throw new SalesDayEmergencyModeError(
          "ALREADY_OPEN",
          "Er bestaat al een open SalesDay-noodvenster. Stop of laat dit eerst aflopen.",
        );
      }
      const created = await database.create({
        activeKey: activeEmergencyKey,
        reason,
        startsAt,
        endsAt,
        activatedByUserId: actor.id,
      });
      await database.writeAudit({
        userId: actor.id,
        entityId: created.id,
        action: "salesday.emergency.activate",
        oldValue: null,
        newValue: JSON.stringify({ reason, startsAt, endsAt }),
      });
      return created;
    });
  } catch (error) {
    if (error instanceof SalesDayEmergencyModeError) throw error;
    if (isUniqueConstraint(error)) {
      throw new SalesDayEmergencyModeError("ALREADY_OPEN", "Er bestaat al een open SalesDay-noodvenster.", { cause: error });
    }
    throw error;
  }
}

export async function deactivateSalesDayEmergencyMode(
  actor: MockUser,
  input: { emergencyModeId: string; reason: string },
  options: { store?: SalesDayEmergencyModeStore; now?: () => Date } = {},
) {
  requireEmergencyPermission(actor);
  const emergencyModeId = requiredText(input.emergencyModeId, "Noodvenster", 191);
  const reason = requiredText(input.reason, "Stopreden", 2000);
  const now = (options.now ?? (() => new Date()))();
  const store = options.store ?? prismaSalesDayEmergencyModeStore;
  return store.transaction(async (database) => {
    const existing = await database.findById(emergencyModeId);
    if (!existing) throw new SalesDayEmergencyModeError("NOT_FOUND", "SalesDay-noodvenster niet gevonden.");
    if (existing.deactivatedAt) return existing;
    const deactivated = await database.deactivate(existing.id, {
      activeKey: null,
      deactivatedAt: now,
      deactivatedByUserId: actor.id,
      deactivationReason: reason,
    });
    await database.writeAudit({
      userId: actor.id,
      entityId: existing.id,
      action: "salesday.emergency.deactivate",
      oldValue: JSON.stringify({
        reason: existing.reason,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
      }),
      newValue: JSON.stringify({ deactivatedAt: now, reason }),
    });
    return deactivated;
  });
}

export async function getActiveSalesDayEmergencyMode(
  options: { store?: SalesDayEmergencyModeStore; now?: () => Date } = {},
) {
  const now = (options.now ?? (() => new Date()))();
  return (options.store ?? prismaSalesDayEmergencyModeStore).findActive(now);
}

export async function getOpenSalesDayEmergencyMode(
  options: { store?: SalesDayEmergencyModeStore; now?: () => Date } = {},
) {
  const now = (options.now ?? (() => new Date()))();
  return (options.store ?? prismaSalesDayEmergencyModeStore).findOpen(now);
}

export function toSalesDayEmergencyModeResponse(record: SalesDayEmergencyModeRecord | null, now = new Date()) {
  if (!record) return { active: false as const };
  return {
    active: record.startsAt <= now && record.endsAt > now && !record.deactivatedAt,
    id: record.id,
    reason: record.reason,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    activatedByUserId: record.activatedByUserId,
    deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
  };
}

function requireEmergencyPermission(actor: MockUser) {
  if (!can(actor, "salesday.emergencyMode.manage")) {
    throw new SalesDayEmergencyModeError(
      "PERMISSION_REQUIRED",
      "Je hebt geen toestemming om de SalesDay-noodmodus te beheren.",
    );
  }
}

function requiredText(value: string, label: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new SalesDayEmergencyModeError(
      "INVALID_INPUT",
      `${label} is verplicht en mag maximaal ${maximum} tekens bevatten.`,
    );
  }
  return normalized;
}

function requiredDate(value: string | Date, label: string) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (
    Number.isNaN(date.getTime()) ||
    (typeof value === "string" && date.toISOString() !== value)
  ) {
    throw new SalesDayEmergencyModeError("INVALID_INPUT", `${label} is ongeldig.`);
  }
  return date;
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const prismaSalesDayEmergencyModeStore: SalesDayEmergencyModeStore = {
  transaction: (action) => prisma.$transaction(async (database) => action({
    clearExpiredOpen: async (now) => {
      await database.salesDayEmergencyMode.updateMany({
        where: { activeKey: activeEmergencyKey, endsAt: { lte: now } },
        data: { activeKey: null },
      });
    },
    findOpen: () => database.salesDayEmergencyMode.findUnique({ where: { activeKey: activeEmergencyKey } }),
    findById: (id) => database.salesDayEmergencyMode.findUnique({ where: { id } }),
    create: (data) => database.salesDayEmergencyMode.create({ data }),
    deactivate: (id, data) => database.salesDayEmergencyMode.update({ where: { id }, data }),
    writeAudit: async (data) => {
      await database.auditLog.create({ data: {
        userId: data.userId,
        entityType: "SalesDayEmergencyMode",
        entityId: data.entityId,
        action: data.action,
        oldValue: data.oldValue,
        newValue: data.newValue,
      } });
    },
  }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
  findActive: (now) => prisma.salesDayEmergencyMode.findFirst({
    where: {
      activeKey: activeEmergencyKey,
      deactivatedAt: null,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
  }),
  findOpen: (now) => prisma.salesDayEmergencyMode.findFirst({
    where: {
      activeKey: activeEmergencyKey,
      deactivatedAt: null,
      endsAt: { gt: now },
    },
  }),
};
