import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";

import { can } from "@/lib/permissions";
import { actorCanAccessCountry } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import type { Country, MockUser } from "@/lib/types";

const DEFAULT_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export type DeviceControlType = "LOGOUT" | "WIPE";
export type DeviceControlStatus = "PENDING" | "DELIVERED" | "ACKNOWLEDGED";

export type DeviceSecurityRegistration = {
  id: string;
  deviceId: string;
  userId: string;
  userCountry: Country;
  status: "ACTIVE" | "REVOKED";
  activeUserKey: string | null;
  keyVersion: number;
  keyFingerprint: string | null;
  keyProvisionedAt: Date | null;
  keyRevokedAt: Date | null;
  deviceTokenHash: string | null;
  deviceTokenIssuedAt: Date | null;
  deviceTokenRevokedAt: Date | null;
};

export type DeviceKeyChallenge = {
  challengeId: string;
  deviceRegistrationId: string;
  tokenHash: string;
  loginSessionId: string | null;
  targetKeyVersion: number;
  expiresAt: Date;
  consumedAt: Date | null;
  device: DeviceSecurityRegistration;
};

export type DeviceControlCommand = {
  commandId: string;
  deviceRegistrationId: string;
  type: DeviceControlType;
  status: DeviceControlStatus;
  pendingKey: string | null;
  requestedByUserId: string;
  reason: string;
  requestedAt: Date;
  deliveredAt: Date | null;
  acknowledgedAt: Date | null;
};

type CreateChallengeInput = Omit<DeviceKeyChallenge, "consumedAt" | "device">;
type ProvisionDeviceInput = {
  deviceRegistrationId: string;
  keyVersion: number;
  keyFingerprint: string;
  keyProvisionedAt: Date;
  deviceTokenHash: string;
  deviceTokenIssuedAt: Date;
};
type CreateControlInput = Omit<
  DeviceControlCommand,
  "status" | "deliveredAt" | "acknowledgedAt"
>;

export interface DeviceSecurityTransaction {
  findDeviceById(deviceId: string): Promise<DeviceSecurityRegistration | null>;
  createChallenge(input: CreateChallengeInput): Promise<void>;
  findChallenge(challengeId: string): Promise<DeviceKeyChallenge | null>;
  consumeChallenge(challengeId: string, consumedAt: Date): Promise<boolean>;
  provisionDevice(input: ProvisionDeviceInput): Promise<DeviceSecurityRegistration>;
  bindLoginSession(sessionId: string, userId: string, deviceRegistrationId: string): Promise<boolean>;
  findOpenControl(deviceRegistrationId: string, type: DeviceControlType): Promise<DeviceControlCommand | null>;
  createControl(input: CreateControlInput): Promise<DeviceControlCommand>;
  applyWipeToDevice(input: {
    deviceRegistrationId: string;
    actorUserId: string;
    reason: string;
    at: Date;
  }): Promise<void>;
  closeDeviceSessions(deviceRegistrationId: string, at: Date): Promise<number>;
  findDeviceByToken(
    deviceId: string,
    tokenHash: string,
    allowRevokedToken?: boolean,
  ): Promise<DeviceSecurityRegistration | null>;
  deliverOpenControls(deviceRegistrationId: string, at: Date): Promise<DeviceControlCommand[]>;
  findControl(deviceRegistrationId: string, commandId: string): Promise<DeviceControlCommand | null>;
  acknowledgeControl(deviceRegistrationId: string, commandId: string, at: Date): Promise<DeviceControlCommand>;
  revokeDeviceToken(deviceRegistrationId: string, at: Date): Promise<void>;
}

export interface DeviceSecurityStore {
  transaction<T>(action: (database: DeviceSecurityTransaction) => Promise<T>): Promise<T>;
}

export type DeviceSecurityServiceOptions = {
  store?: DeviceSecurityStore;
  now?: () => Date;
  challengeTtlMs?: number;
  randomToken?: () => string;
  randomId?: () => string;
};

export type DeviceSecurityErrorCode =
  | "INVALID_INPUT"
  | "ROLE_NOT_ALLOWED"
  | "MANAGE_PERMISSION_REQUIRED"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_REVOKED"
  | "OUTSIDE_SCOPE"
  | "CHALLENGE_NOT_FOUND"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_CONSUMED"
  | "CHALLENGE_MISMATCH"
  | "SESSION_MISMATCH"
  | "SESSION_NOT_FOUND"
  | "FINGERPRINT_IN_USE"
  | "DEVICE_TOKEN_INVALID"
  | "CONTROL_NOT_FOUND";

export class DeviceSecurityError extends Error {
  constructor(
    public readonly code: DeviceSecurityErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DeviceSecurityError";
  }
}

export async function startDeviceKeyProvisioning(
  actor: MockUser,
  deviceId: string,
  loginSessionId: string | null,
  options: DeviceSecurityServiceOptions = {},
) {
  requireRepresentative(actor);
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const now = (options.now ?? (() => new Date()))();
  const ttl = normalizeTtl(options.challengeTtlMs ?? DEFAULT_CHALLENGE_TTL_MS);
  const token = (options.randomToken ?? secureToken)();
  const challengeId = (options.randomId ?? randomUUID)();
  const store = options.store ?? prismaDeviceSecurityStore;

  return store.transaction(async (database) => {
    const device = await requireOwnedActiveDevice(database, actor, normalizedDeviceId);
    const challenge = {
      challengeId,
      token,
      targetKeyVersion: device.keyVersion + 1,
      expiresAt: new Date(now.getTime() + ttl),
    };
    await database.createChallenge({
      challengeId,
      deviceRegistrationId: device.id,
      tokenHash: hashSecret(token),
      loginSessionId,
      targetKeyVersion: challenge.targetKeyVersion,
      expiresAt: challenge.expiresAt,
    });
    return challenge;
  });
}

export async function completeDeviceKeyProvisioning(
  actor: MockUser,
  deviceId: string,
  loginSessionId: string | null,
  input: { challengeId: string; token: string; keyFingerprint: string },
  options: DeviceSecurityServiceOptions = {},
) {
  requireRepresentative(actor);
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const challengeId = normalizeTechnicalValue(input.challengeId, "challengeId", 64);
  const token = normalizeTechnicalValue(input.token, "provisioningtoken", 256);
  const keyFingerprint = normalizeFingerprint(input.keyFingerprint);
  const now = (options.now ?? (() => new Date()))();
  const deviceToken = (options.randomToken ?? secureToken)();
  const store = options.store ?? prismaDeviceSecurityStore;

  try {
    return await store.transaction(async (database) => {
      const challenge = await database.findChallenge(challengeId);
      if (!challenge || challenge.device.deviceId !== normalizedDeviceId) {
        throw new DeviceSecurityError("CHALLENGE_NOT_FOUND", "Provisioningaanvraag niet gevonden.");
      }
      if (challenge.device.userId !== actor.id) {
        throw new DeviceSecurityError("CHALLENGE_NOT_FOUND", "Provisioningaanvraag niet gevonden.");
      }
      if (challenge.device.status !== "ACTIVE") {
        throw new DeviceSecurityError("DEVICE_REVOKED", "Deze toestelregistratie werd ingetrokken.");
      }
      if (challenge.consumedAt) {
        throw new DeviceSecurityError("CHALLENGE_CONSUMED", "Deze provisioningaanvraag werd reeds gebruikt.");
      }
      if (challenge.expiresAt <= now) {
        throw new DeviceSecurityError("CHALLENGE_EXPIRED", "Deze provisioningaanvraag is verlopen.");
      }
      if (challenge.loginSessionId !== loginSessionId) {
        throw new DeviceSecurityError("SESSION_MISMATCH", "De provisioningaanvraag hoort bij een andere login-sessie.");
      }
      if (!safeSecretEqual(challenge.tokenHash, hashSecret(token))) {
        throw new DeviceSecurityError("CHALLENGE_MISMATCH", "Ongeldige provisioningtoken.");
      }
      if (!(await database.consumeChallenge(challengeId, now))) {
        throw new DeviceSecurityError("CHALLENGE_CONSUMED", "Deze provisioningaanvraag werd reeds gebruikt.");
      }
      const device = await database.provisionDevice({
        deviceRegistrationId: challenge.deviceRegistrationId,
        keyVersion: challenge.targetKeyVersion,
        keyFingerprint,
        keyProvisionedAt: now,
        deviceTokenHash: hashSecret(deviceToken),
        deviceTokenIssuedAt: now,
      });
      if (loginSessionId && !(await database.bindLoginSession(loginSessionId, actor.id, device.id))) {
        throw new DeviceSecurityError("SESSION_NOT_FOUND", "De actieve login-sessie kon niet aan het toestel worden gekoppeld.");
      }
      return {
        deviceId: device.deviceId,
        keyVersion: device.keyVersion,
        keyFingerprint: device.keyFingerprint!,
        keyProvisionedAt: device.keyProvisionedAt!,
        deviceToken,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DeviceSecurityError(
        "FINGERPRINT_IN_USE",
        "Deze sleutelfingerprint of toesteltoken is reeds in gebruik.",
        { cause: error },
      );
    }
    throw error;
  }
}

export async function requestDeviceControl(
  actor: MockUser,
  deviceId: string,
  type: DeviceControlType,
  reason: string,
  options: DeviceSecurityServiceOptions = {},
) {
  if (!can(actor, "salesday.manage")) {
    throw new DeviceSecurityError("MANAGE_PERMISSION_REQUIRED", "Je hebt geen toestemming om SalesDay-toestellen te beheren.");
  }
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const normalizedType = normalizeControlType(type);
  const normalizedReason = normalizeReason(reason);
  const now = (options.now ?? (() => new Date()))();
  const commandId = (options.randomId ?? randomUUID)();
  const store = options.store ?? prismaDeviceSecurityStore;

  return store.transaction(async (database) => {
    const device = await database.findDeviceById(normalizedDeviceId);
    if (!device) throw new DeviceSecurityError("DEVICE_NOT_FOUND", "Toestelregistratie niet gevonden.");
    if (!actorCanAccessCountry(actor, device.userCountry)) {
      throw new DeviceSecurityError("OUTSIDE_SCOPE", "Dit toestel valt buiten je toegestane landenscope.");
    }
    const existing = await database.findOpenControl(device.id, normalizedType);
    if (existing) return { command: existing, invalidatedSessionCount: 0, reused: true };
    const command = await database.createControl({
      commandId,
      deviceRegistrationId: device.id,
      type: normalizedType,
      pendingKey: `${device.id}:${normalizedType}`,
      requestedByUserId: actor.id,
      reason: normalizedReason,
      requestedAt: now,
    });
    if (normalizedType === "WIPE") {
      await database.applyWipeToDevice({
        deviceRegistrationId: device.id,
        actorUserId: actor.id,
        reason: normalizedReason,
        at: now,
      });
    }
    const invalidatedSessionCount = await database.closeDeviceSessions(device.id, now);
    return { command, invalidatedSessionCount, reused: false };
  });
}

export async function pollDeviceControls(
  deviceId: string,
  deviceToken: string,
  options: DeviceSecurityServiceOptions = {},
) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const token = normalizeTechnicalValue(deviceToken, "toesteltoken", 256);
  const now = (options.now ?? (() => new Date()))();
  const store = options.store ?? prismaDeviceSecurityStore;
  return store.transaction(async (database) => {
    const device = await database.findDeviceByToken(normalizedDeviceId, hashSecret(token));
    if (!device) throw new DeviceSecurityError("DEVICE_TOKEN_INVALID", "Ongeldige of ingetrokken toestelautorisatie.");
    return database.deliverOpenControls(device.id, now);
  });
}

export async function acknowledgeDeviceControl(
  deviceId: string,
  deviceToken: string,
  commandId: string,
  options: DeviceSecurityServiceOptions = {},
) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const token = normalizeTechnicalValue(deviceToken, "toesteltoken", 256);
  const normalizedCommandId = normalizeTechnicalValue(commandId, "commandId", 64);
  const now = (options.now ?? (() => new Date()))();
  const store = options.store ?? prismaDeviceSecurityStore;
  return store.transaction(async (database) => {
    const device = await database.findDeviceByToken(normalizedDeviceId, hashSecret(token), true);
    if (!device) throw new DeviceSecurityError("DEVICE_TOKEN_INVALID", "Ongeldige of ingetrokken toestelautorisatie.");
    const command = await database.findControl(device.id, normalizedCommandId);
    if (!command) throw new DeviceSecurityError("CONTROL_NOT_FOUND", "Toestelopdracht niet gevonden.");
    if (command.status === "ACKNOWLEDGED") return command;
    const acknowledged = await database.acknowledgeControl(device.id, normalizedCommandId, now);
    if (acknowledged.type === "WIPE") await database.revokeDeviceToken(device.id, now);
    return acknowledged;
  });
}

function requireRepresentative(actor: MockUser) {
  if (actor.role !== "REPRESENTATIVE") {
    throw new DeviceSecurityError("ROLE_NOT_ALLOWED", "Alleen een vertegenwoordiger kan een toestel beveiligen.");
  }
}

async function requireOwnedActiveDevice(
  database: DeviceSecurityTransaction,
  actor: MockUser,
  deviceId: string,
) {
  const device = await database.findDeviceById(deviceId);
  if (!device || device.userId !== actor.id) {
    throw new DeviceSecurityError("DEVICE_NOT_FOUND", "Actieve toestelregistratie niet gevonden.");
  }
  if (device.status !== "ACTIVE") {
    throw new DeviceSecurityError("DEVICE_REVOKED", "Deze toestelregistratie werd ingetrokken.");
  }
  return device;
}

function normalizeDeviceId(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new DeviceSecurityError("INVALID_INPUT", "Ongeldige technische toestelidentiteit.");
  }
  return normalized;
}

function normalizeTechnicalValue(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new DeviceSecurityError("INVALID_INPUT", `Ongeldige ${label}.`);
  }
  return normalized;
}

function normalizeFingerprint(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new DeviceSecurityError("INVALID_INPUT", "Ongeldige sleutelfingerprint.");
  }
  return normalized;
}

function normalizeControlType(value: DeviceControlType) {
  if (value !== "LOGOUT" && value !== "WIPE") {
    throw new DeviceSecurityError("INVALID_INPUT", "Ongeldige toestelopdracht.");
  }
  return value;
}

function normalizeReason(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 1000) {
    throw new DeviceSecurityError("INVALID_INPUT", "Een reden van maximaal 1000 tekens is verplicht.");
  }
  return normalized;
}

function normalizeTtl(value: number) {
  if (!Number.isSafeInteger(value) || value < 30_000 || value > 60 * 60 * 1000) {
    throw new DeviceSecurityError("INVALID_INPUT", "Ongeldige geldigheidsduur voor provisioning.");
  }
  return value;
}

function secureToken() {
  return randomBytes(32).toString("base64url");
}

function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeSecretEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function mapDevice(record: {
  id: string;
  deviceId: string;
  userId: string;
  status: "ACTIVE" | "REVOKED";
  activeUserKey: string | null;
  keyVersion: number;
  keyFingerprint: string | null;
  keyProvisionedAt: Date | null;
  keyRevokedAt: Date | null;
  deviceTokenHash: string | null;
  deviceTokenIssuedAt: Date | null;
  deviceTokenRevokedAt: Date | null;
  user: { country: Country };
}): DeviceSecurityRegistration {
  const { user, ...device } = record;
  return { ...device, userCountry: user.country };
}

function mapControl(record: DeviceControlCommand) {
  return record;
}

function prismaSecurityTransaction(database: Prisma.TransactionClient): DeviceSecurityTransaction {
  const deviceInclude = { user: { select: { country: true } } } as const;
  return {
    findDeviceById: async (deviceId) => {
      const record = await database.deviceRegistration.findUnique({ where: { deviceId }, include: deviceInclude });
      return record ? mapDevice(record) : null;
    },
    createChallenge: async (input) => {
      await database.deviceKeyProvisioningChallenge.create({ data: input });
    },
    findChallenge: async (challengeId) => {
      const record = await database.deviceKeyProvisioningChallenge.findUnique({
        where: { challengeId },
        include: { deviceRegistration: { include: deviceInclude } },
      });
      if (!record) return null;
      return {
        challengeId: record.challengeId,
        deviceRegistrationId: record.deviceRegistrationId,
        tokenHash: record.tokenHash,
        loginSessionId: record.loginSessionId,
        targetKeyVersion: record.targetKeyVersion,
        expiresAt: record.expiresAt,
        consumedAt: record.consumedAt,
        device: mapDevice(record.deviceRegistration),
      };
    },
    consumeChallenge: async (challengeId, consumedAt) => (
      await database.deviceKeyProvisioningChallenge.updateMany({
        where: { challengeId, consumedAt: null },
        data: { consumedAt },
      })
    ).count === 1,
    provisionDevice: async (input) => mapDevice(await database.deviceRegistration.update({
      where: { id: input.deviceRegistrationId },
      data: {
        keyVersion: input.keyVersion,
        keyFingerprint: input.keyFingerprint,
        keyProvisionedAt: input.keyProvisionedAt,
        keyRevokedAt: null,
        deviceTokenHash: input.deviceTokenHash,
        deviceTokenIssuedAt: input.deviceTokenIssuedAt,
        deviceTokenRevokedAt: null,
      },
      include: deviceInclude,
    })),
    bindLoginSession: async (sessionId, userId, deviceRegistrationId) => (
      await database.userLoginSession.updateMany({
        where: { sessionId, userId, logoutAt: null, expiresAt: { gt: new Date() } },
        data: { deviceRegistrationId },
      })
    ).count === 1,
    findOpenControl: async (deviceRegistrationId, type) => {
      const record = await database.deviceControlCommand.findFirst({
        where: { deviceRegistrationId, type, status: { in: ["PENDING", "DELIVERED"] } },
      });
      return record ? mapControl(record) : null;
    },
    createControl: async (input) => mapControl(await database.deviceControlCommand.create({
      data: { ...input, status: "PENDING" },
    })),
    applyWipeToDevice: async (input) => {
      await database.deviceRegistration.update({
        where: { id: input.deviceRegistrationId },
        data: {
          status: "REVOKED",
          activeUserKey: null,
          revokedAt: input.at,
          revokedByUserId: input.actorUserId,
          revocationReason: input.reason,
          keyRevokedAt: input.at,
        },
      });
    },
    closeDeviceSessions: async (deviceRegistrationId, at) => {
      const sessions = await database.userLoginSession.findMany({
        where: { deviceRegistrationId, logoutAt: null },
        select: { sessionId: true, loginAt: true },
      });
      await Promise.all(sessions.map((session) => database.userLoginSession.update({
        where: { sessionId: session.sessionId },
        data: {
          logoutAt: at,
          lastActivityAt: at,
          durationSeconds: Math.max(0, Math.floor((at.getTime() - session.loginAt.getTime()) / 1000)),
        },
      })));
      return sessions.length;
    },
    findDeviceByToken: async (deviceId, tokenHash, allowRevokedToken = false) => {
      const record = await database.deviceRegistration.findFirst({
        where: {
          deviceId,
          deviceTokenHash: tokenHash,
          ...(allowRevokedToken ? {} : { deviceTokenRevokedAt: null }),
        },
        include: deviceInclude,
      });
      return record ? mapDevice(record) : null;
    },
    deliverOpenControls: async (deviceRegistrationId, at) => {
      await database.deviceControlCommand.updateMany({
        where: { deviceRegistrationId, status: "PENDING" },
        data: { status: "DELIVERED", deliveredAt: at },
      });
      return database.deviceControlCommand.findMany({
        where: { deviceRegistrationId, status: "DELIVERED" },
        orderBy: [{ requestedAt: "asc" }, { commandId: "asc" }],
      });
    },
    findControl: async (deviceRegistrationId, commandId) => {
      const record = await database.deviceControlCommand.findFirst({ where: { deviceRegistrationId, commandId } });
      return record ? mapControl(record) : null;
    },
    acknowledgeControl: async (deviceRegistrationId, commandId, at) => mapControl(
      await database.deviceControlCommand.update({
        where: { commandId },
        data: { status: "ACKNOWLEDGED", acknowledgedAt: at, pendingKey: null },
      }),
    ),
    revokeDeviceToken: async (deviceRegistrationId, at) => {
      await database.deviceRegistration.update({
        where: { id: deviceRegistrationId },
        data: { deviceTokenRevokedAt: at },
      });
    },
  };
}

export const prismaDeviceSecurityStore: DeviceSecurityStore = {
  transaction: (action) => prisma.$transaction(
    (database) => action(prismaSecurityTransaction(database)),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ),
};
