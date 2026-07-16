import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getOwnActiveSalesDevice,
  refreshOwnSalesDevice,
  registerOwnSalesDevice,
  revokeSalesDevice,
  SalesDeviceRegistrationError,
  type SalesDeviceRegistration,
  type SalesDeviceRegistrationStore,
  type SalesDeviceRegistrationTransaction,
} from "../lib/server/salesday-device-registration";
import { fieldForcePermissionKeys, roleTemplates } from "../lib/user-management";
import type { Country, FieldForcePermissionKey, MockUser, Role } from "../lib/types";

class MemoryDeviceRegistrationStore implements SalesDeviceRegistrationStore {
  readonly records = new Map<string, SalesDeviceRegistration>();
  private sequence = 0;

  constructor(private readonly userCountries: Readonly<Record<string, Country>>) {}

  async transaction<T>(action: (database: SalesDeviceRegistrationTransaction) => Promise<T>) {
    return action({
      findByDeviceId: async (deviceId) => this.clone(this.records.get(deviceId) ?? null),
      findActiveByUserId: async (userId) => this.clone(
        [...this.records.values()].find((record) => record.userId === userId && record.status === "ACTIVE") ?? null,
      ),
      create: async (data) => {
        if (this.records.has(data.deviceId)) throw new Error("Duplicate deviceId in memory store");
        if ([...this.records.values()].some((record) => record.activeUserKey === data.activeUserKey)) {
          throw new Error("Duplicate activeUserKey in memory store");
        }
        const record: SalesDeviceRegistration = {
          id: `device-registration-${++this.sequence}`,
          ...data,
          status: "ACTIVE",
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
          userCountry: this.userCountries[data.userId],
          createdAt: data.registeredAt,
          updatedAt: data.registeredAt,
        };
        this.records.set(record.deviceId, record);
        return this.clone(record)!;
      },
      refresh: async (deviceId, data) => {
        const current = this.required(deviceId);
        const record = { ...current, ...data, updatedAt: data.lastSeenAt };
        this.records.set(deviceId, record);
        return this.clone(record)!;
      },
      revoke: async (deviceId, data) => {
        const current = this.required(deviceId);
        const record = { ...current, ...data, updatedAt: data.revokedAt };
        this.records.set(deviceId, record);
        return this.clone(record)!;
      },
    });
  }

  private required(deviceId: string) {
    const record = this.records.get(deviceId);
    if (!record) throw new Error(`Device ${deviceId} not found in memory store`);
    return record;
  }

  private clone<T extends SalesDeviceRegistration | null>(record: T): T {
    return record ? structuredClone(record) as T : record;
  }
}

function actor(
  id: string,
  role: Role,
  country: Country,
  permissions: Partial<Record<FieldForcePermissionKey, boolean>> = {},
): MockUser {
  return {
    id,
    name: id,
    email: `${id}@example.test`,
    role,
    country,
    countryAccess: [country],
    language: "nl",
    representativeId: role === "REPRESENTATIVE" ? id : undefined,
    permissions,
  };
}

async function main() {
  const firstSeen = new Date("2026-07-16T20:00:00.000Z");
  const refreshedAt = new Date("2026-07-16T20:05:00.000Z");
  const revokedAt = new Date("2026-07-16T20:10:00.000Z");
  const representativeBe = actor("rep-device-be", "REPRESENTATIVE", "BE");
  const representativeNl = actor("rep-device-nl", "REPRESENTATIVE", "NL");
  const salesLeader = actor("leader-device-be", "SALES_LEADER", "BE");
  const scopedAdmin = actor("admin-device-be", "ADMIN", "BE", { "salesday.manage": true });
  const superAdmin = actor("super-device", "SUPER_ADMIN", "BE");
  const store = new MemoryDeviceRegistrationStore({
    [representativeBe.id]: "BE",
    [representativeNl.id]: "NL",
  });

  const registered = await registerOwnSalesDevice(representativeBe, {
    deviceId: "device-installation-be-001",
    platform: "WINDOWS",
    deviceLabel: "Tablet vertegenwoordiger BE",
    operatingSystemVersion: "11",
    appVersion: "0.1.0",
  }, { store, now: () => firstSeen });
  assert.equal(registered.status, "ACTIVE");
  assert.equal(registered.activeUserKey, representativeBe.id);
  assert.equal((await getOwnActiveSalesDevice(representativeBe, { store }))?.deviceId, registered.deviceId);

  const refreshed = await registerOwnSalesDevice(representativeBe, {
    deviceId: registered.deviceId,
    platform: "ANDROID",
    operatingSystemVersion: "15",
    appVersion: "0.2.0",
  }, { store, now: () => refreshedAt });
  assert.equal(store.records.size, 1);
  assert.equal(refreshed.platform, "ANDROID");
  assert.equal(refreshed.lastSeenAt.toISOString(), refreshedAt.toISOString());

  await assert.rejects(
    () => registerOwnSalesDevice(representativeBe, {
      deviceId: "device-installation-be-002",
      platform: "ANDROID",
    }, { store }),
    (error: unknown) => error instanceof SalesDeviceRegistrationError && error.code === "ACTIVE_DEVICE_EXISTS",
  );
  await assert.rejects(
    () => registerOwnSalesDevice(representativeNl, {
      deviceId: registered.deviceId,
      platform: "ANDROID",
    }, { store }),
    (error: unknown) => error instanceof SalesDeviceRegistrationError && error.code === "DEVICE_ALREADY_BOUND",
  );
  await assert.rejects(
    () => registerOwnSalesDevice(salesLeader, {
      deviceId: "device-installation-leader-001",
      platform: "ANDROID",
    }, { store }),
    (error: unknown) => error instanceof SalesDeviceRegistrationError && error.code === "ROLE_NOT_ALLOWED",
  );
  await assert.rejects(
    () => refreshOwnSalesDevice(representativeNl, registered.deviceId, {}, { store }),
    (error: unknown) => error instanceof SalesDeviceRegistrationError && error.code === "DEVICE_NOT_FOUND",
  );

  const nlDevice = await registerOwnSalesDevice(representativeNl, {
    deviceId: "device-installation-nl-001",
    platform: "ANDROID",
  }, { store, now: () => firstSeen });
  await assert.rejects(
    () => revokeSalesDevice(scopedAdmin, nlDevice.deviceId, "Toestel verloren", { store }),
    (error: unknown) => error instanceof SalesDeviceRegistrationError && error.code === "OUTSIDE_SCOPE",
  );

  const revoked = await revokeSalesDevice(superAdmin, registered.deviceId, "Gecontroleerde toestelvervanging", {
    store,
    now: () => revokedAt,
  });
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.activeUserKey, null);
  assert.equal(revoked.revokedByUserId, superAdmin.id);
  assert.equal(revoked.revocationReason, "Gecontroleerde toestelvervanging");
  assert.equal(await getOwnActiveSalesDevice(representativeBe, { store }), null);
  await assert.rejects(
    () => refreshOwnSalesDevice(representativeBe, registered.deviceId, {}, { store }),
    (error: unknown) => error instanceof SalesDeviceRegistrationError && error.code === "DEVICE_REVOKED",
  );
  await assert.rejects(
    () => registerOwnSalesDevice(representativeBe, {
      deviceId: registered.deviceId,
      platform: "ANDROID",
    }, { store }),
    (error: unknown) => error instanceof SalesDeviceRegistrationError && error.code === "DEVICE_REVOKED",
  );
  const replacement = await registerOwnSalesDevice(representativeBe, {
    deviceId: "device-installation-be-002",
    platform: "ANDROID",
  }, { store, now: () => new Date("2026-07-16T20:15:00.000Z") });
  assert.equal(replacement.status, "ACTIVE");
  assert.equal(store.records.size, 3);

  assert.equal(fieldForcePermissionKeys.includes("salesday.manage"), true);
  assert.equal(roleTemplates.SUPER_ADMIN.permissions["salesday.manage"], true);
  assert.equal(roleTemplates.ADMIN.permissions["salesday.manage"], false);

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/0042_salesday_device_registration/migration.sql", "utf8");
  assert(schema.includes("model DeviceRegistration"));
  assert(schema.includes("activeUserKey          String?                  @unique"));
  assert(migration.includes("CREATE TABLE `DeviceRegistration`"));
  assert(migration.includes("DeviceRegistration_activeUserKey_key"));
  assert.equal(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i.test(migration), false);

  console.log(
    "SalesDay device registration: persoonlijke binding, scope, intrekking, vervanging, permissie en additieve migratie gevalideerd.",
  );
}

void main();
