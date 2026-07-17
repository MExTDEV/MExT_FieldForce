import { Prisma } from "@prisma/client";

import { can } from "@/lib/permissions";
import { actorCanAccessCountry } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import type { Country, MockUser } from "@/lib/types";

export const salesDevicePlatforms = ["WINDOWS", "ANDROID"] as const;

export type SalesDevicePlatform = (typeof salesDevicePlatforms)[number];
export type SalesDeviceRegistrationStatus = "ACTIVE" | "REVOKED";

export type SalesDeviceRegistration = {
  id: string;
  deviceId: string;
  userId: string;
  activeUserKey: string | null;
  platform: SalesDevicePlatform;
  status: SalesDeviceRegistrationStatus;
  deviceLabel: string | null;
  operatingSystemVersion: string | null;
  appVersion: string | null;
  registeredAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  keyVersion?: number;
  keyFingerprint?: string | null;
  keyProvisionedAt?: Date | null;
  keyRevokedAt?: Date | null;
  userCountry: Country;
  createdAt: Date;
  updatedAt: Date;
};

export type RegisterSalesDeviceInput = {
  deviceId: string;
  platform: SalesDevicePlatform;
  deviceLabel?: string | null;
  operatingSystemVersion?: string | null;
  appVersion?: string | null;
};

export type RefreshSalesDeviceInput = Pick<
  RegisterSalesDeviceInput,
  "deviceLabel" | "operatingSystemVersion" | "appVersion"
>;

export type SalesDeviceRegistrationErrorCode =
  | "INVALID_INPUT"
  | "ROLE_NOT_ALLOWED"
  | "MANAGE_PERMISSION_REQUIRED"
  | "DEVICE_ALREADY_BOUND"
  | "ACTIVE_DEVICE_EXISTS"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_REVOKED"
  | "OUTSIDE_SCOPE";

export class SalesDeviceRegistrationError extends Error {
  constructor(
    public readonly code: SalesDeviceRegistrationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SalesDeviceRegistrationError";
  }
}

type CreateRegistrationData = {
  deviceId: string;
  userId: string;
  activeUserKey: string;
  platform: SalesDevicePlatform;
  deviceLabel: string | null;
  operatingSystemVersion: string | null;
  appVersion: string | null;
  registeredAt: Date;
  lastSeenAt: Date;
};

type RefreshRegistrationData = {
  platform?: SalesDevicePlatform;
  deviceLabel?: string | null;
  operatingSystemVersion?: string | null;
  appVersion?: string | null;
  lastSeenAt: Date;
};

type RevokeRegistrationData = {
  status: "REVOKED";
  activeUserKey: null;
  revokedAt: Date;
  revokedByUserId: string;
  revocationReason: string;
};

export interface SalesDeviceRegistrationTransaction {
  findByDeviceId(deviceId: string): Promise<SalesDeviceRegistration | null>;
  findActiveByUserId(userId: string): Promise<SalesDeviceRegistration | null>;
  create(data: CreateRegistrationData): Promise<SalesDeviceRegistration>;
  refresh(deviceId: string, data: RefreshRegistrationData): Promise<SalesDeviceRegistration>;
  revoke(deviceId: string, data: RevokeRegistrationData): Promise<SalesDeviceRegistration>;
}

export interface SalesDeviceRegistrationStore {
  transaction<T>(action: (database: SalesDeviceRegistrationTransaction) => Promise<T>): Promise<T>;
}

export type SalesDeviceRegistrationServiceOptions = {
  store?: SalesDeviceRegistrationStore;
  now?: () => Date;
};

export function toSalesDeviceRegistrationResponse(registration: SalesDeviceRegistration | null) {
  if (!registration) return null;
  return {
    id: registration.id,
    deviceId: registration.deviceId,
    userId: registration.userId,
    platform: registration.platform,
    status: registration.status,
    deviceLabel: registration.deviceLabel,
    operatingSystemVersion: registration.operatingSystemVersion,
    appVersion: registration.appVersion,
    registeredAt: registration.registeredAt,
    lastSeenAt: registration.lastSeenAt,
    revokedAt: registration.revokedAt,
    revokedByUserId: registration.revokedByUserId,
    revocationReason: registration.revocationReason,
    keyVersion: registration.keyVersion ?? 0,
    keyFingerprint: registration.keyFingerprint ?? null,
    keyProvisionedAt: registration.keyProvisionedAt ?? null,
    keyRevokedAt: registration.keyRevokedAt ?? null,
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
  };
}

export async function registerOwnSalesDevice(
  actor: MockUser,
  input: RegisterSalesDeviceInput,
  options: SalesDeviceRegistrationServiceOptions = {},
) {
  requireRepresentative(actor);
  const normalized = normalizeRegistrationInput(input);
  const now = (options.now ?? (() => new Date()))();
  const store = options.store ?? prismaSalesDeviceRegistrationStore;

  try {
    return await store.transaction(async (database) => {
      const existingDevice = await database.findByDeviceId(normalized.deviceId);
      if (existingDevice) {
        if (existingDevice.userId !== actor.id) {
          throw new SalesDeviceRegistrationError(
            "DEVICE_ALREADY_BOUND",
            "Dit toestel is reeds aan een andere gebruiker gekoppeld.",
          );
        }
        if (existingDevice.status === "REVOKED") {
          throw new SalesDeviceRegistrationError(
            "DEVICE_REVOKED",
            "Deze toestelregistratie werd ingetrokken en kan niet opnieuw worden geactiveerd.",
          );
        }
        return database.refresh(existingDevice.deviceId, {
          platform: normalized.platform,
          deviceLabel: normalized.deviceLabel,
          operatingSystemVersion: normalized.operatingSystemVersion,
          appVersion: normalized.appVersion,
          lastSeenAt: now,
        });
      }

      const activeDevice = await database.findActiveByUserId(actor.id);
      if (activeDevice) {
        throw new SalesDeviceRegistrationError(
          "ACTIVE_DEVICE_EXISTS",
          "Deze gebruiker heeft reeds een actief SalesDay-toestel. Rond eerst de gecontroleerde toestelvervanging af.",
        );
      }

      return database.create({
        ...normalized,
        userId: actor.id,
        activeUserKey: actor.id,
        registeredAt: now,
        lastSeenAt: now,
      });
    });
  } catch (error) {
    throw translateUniqueConstraint(error);
  }
}

export async function getOwnActiveSalesDevice(
  actor: MockUser,
  options: SalesDeviceRegistrationServiceOptions = {},
) {
  requireRepresentative(actor);
  const store = options.store ?? prismaSalesDeviceRegistrationStore;
  return store.transaction((database) => database.findActiveByUserId(actor.id));
}

export async function refreshOwnSalesDevice(
  actor: MockUser,
  deviceId: string,
  input: RefreshSalesDeviceInput = {},
  options: SalesDeviceRegistrationServiceOptions = {},
) {
  requireRepresentative(actor);
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const now = (options.now ?? (() => new Date()))();
  const store = options.store ?? prismaSalesDeviceRegistrationStore;
  const metadata = normalizeOptionalMetadata(input);

  return store.transaction(async (database) => {
    const registration = await database.findByDeviceId(normalizedDeviceId);
    if (!registration || registration.userId !== actor.id) {
      throw new SalesDeviceRegistrationError("DEVICE_NOT_FOUND", "Actieve toestelregistratie niet gevonden.");
    }
    if (registration.status === "REVOKED") {
      throw new SalesDeviceRegistrationError("DEVICE_REVOKED", "Deze toestelregistratie werd ingetrokken.");
    }
    return database.refresh(normalizedDeviceId, { ...metadata, lastSeenAt: now });
  });
}

export async function revokeSalesDevice(
  actor: MockUser,
  deviceId: string,
  reason: string,
  options: SalesDeviceRegistrationServiceOptions = {},
) {
  if (!can(actor, "salesday.manage")) {
    throw new SalesDeviceRegistrationError(
      "MANAGE_PERMISSION_REQUIRED",
      "Je hebt geen toestemming om SalesDay-toestellen te beheren.",
    );
  }
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const normalizedReason = normalizeRequiredText(reason, "Reden", 1000);
  const now = (options.now ?? (() => new Date()))();
  const store = options.store ?? prismaSalesDeviceRegistrationStore;

  return store.transaction(async (database) => {
    const registration = await database.findByDeviceId(normalizedDeviceId);
    if (!registration) {
      throw new SalesDeviceRegistrationError("DEVICE_NOT_FOUND", "Toestelregistratie niet gevonden.");
    }
    if (!actorCanAccessCountry(actor, registration.userCountry)) {
      throw new SalesDeviceRegistrationError("OUTSIDE_SCOPE", "Dit toestel valt buiten je toegestane landenscope.");
    }
    if (registration.status === "REVOKED") return registration;
    return database.revoke(normalizedDeviceId, {
      status: "REVOKED",
      activeUserKey: null,
      revokedAt: now,
      revokedByUserId: actor.id,
      revocationReason: normalizedReason,
    });
  });
}

function requireRepresentative(actor: MockUser) {
  if (actor.role !== "REPRESENTATIVE") {
    throw new SalesDeviceRegistrationError(
      "ROLE_NOT_ALLOWED",
      "Alleen een vertegenwoordiger kan een persoonlijk SalesDay-toestel registreren.",
    );
  }
}

function normalizeRegistrationInput(input: RegisterSalesDeviceInput) {
  if (!salesDevicePlatforms.includes(input.platform)) {
    throw new SalesDeviceRegistrationError("INVALID_INPUT", "Ongeldig toestelplatform.");
  }
  const metadata = normalizeOptionalMetadata(input);
  return {
    deviceId: normalizeDeviceId(input.deviceId),
    platform: input.platform,
    deviceLabel: metadata.deviceLabel ?? null,
    operatingSystemVersion: metadata.operatingSystemVersion ?? null,
    appVersion: metadata.appVersion ?? null,
  };
}

function normalizeOptionalMetadata(input: RefreshSalesDeviceInput) {
  return {
    deviceLabel: normalizeOptionalText(input.deviceLabel, "Toestelnaam", 191),
    operatingSystemVersion: normalizeOptionalText(input.operatingSystemVersion, "OS-versie", 64),
    appVersion: normalizeOptionalText(input.appVersion, "Appversie", 64),
  };
}

function normalizeDeviceId(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new SalesDeviceRegistrationError("INVALID_INPUT", "Ongeldige technische toestelidentiteit.");
  }
  return normalized;
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new SalesDeviceRegistrationError("INVALID_INPUT", `${label} is verplicht en mag maximaal ${maxLength} tekens bevatten.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined, label: string, maxLength: number) {
  if (value === undefined) return undefined;
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > maxLength) {
    throw new SalesDeviceRegistrationError("INVALID_INPUT", `${label} mag maximaal ${maxLength} tekens bevatten.`);
  }
  return normalized;
}

function translateUniqueConstraint(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return error;
  const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
  if (target.includes("activeUserKey")) {
    return new SalesDeviceRegistrationError(
      "ACTIVE_DEVICE_EXISTS",
      "Deze gebruiker heeft reeds een actief SalesDay-toestel.",
      { cause: error },
    );
  }
  return new SalesDeviceRegistrationError(
    "DEVICE_ALREADY_BOUND",
    "Dit toestel is reeds geregistreerd.",
    { cause: error },
  );
}

function mapRegistration(record: {
  id: string;
  deviceId: string;
  userId: string;
  activeUserKey: string | null;
  platform: SalesDevicePlatform;
  status: SalesDeviceRegistrationStatus;
  deviceLabel: string | null;
  operatingSystemVersion: string | null;
  appVersion: string | null;
  registeredAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  keyVersion: number;
  keyFingerprint: string | null;
  keyProvisionedAt: Date | null;
  keyRevokedAt: Date | null;
  user: { country: Country };
  createdAt: Date;
  updatedAt: Date;
}): SalesDeviceRegistration {
  const { user, ...registration } = record;
  return { ...registration, userCountry: user.country };
}

function prismaTransaction(database: Prisma.TransactionClient): SalesDeviceRegistrationTransaction {
  const include = { user: { select: { country: true } } } as const;
  return {
    findByDeviceId: async (deviceId) => {
      const record = await database.deviceRegistration.findUnique({ where: { deviceId }, include });
      return record ? mapRegistration(record) : null;
    },
    findActiveByUserId: async (userId) => {
      const record = await database.deviceRegistration.findFirst({
        where: { userId, status: "ACTIVE" },
        include,
      });
      return record ? mapRegistration(record) : null;
    },
    create: async (data) => mapRegistration(await database.deviceRegistration.create({ data, include })),
    refresh: async (deviceId, data) => mapRegistration(await database.deviceRegistration.update({
      where: { deviceId },
      data,
      include,
    })),
    revoke: async (deviceId, data) => mapRegistration(await database.deviceRegistration.update({
      where: { deviceId },
      data,
      include,
    })),
  };
}

export const prismaSalesDeviceRegistrationStore: SalesDeviceRegistrationStore = {
  transaction: (action) => prisma.$transaction(
    (database) => action(prismaTransaction(database)),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ),
};
