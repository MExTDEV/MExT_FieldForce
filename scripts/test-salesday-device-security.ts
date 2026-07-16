import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  loadLocalDeviceKey,
  provisionLocalDeviceKey,
  type DeviceKeyVaultDriver,
  type DeviceKeyVaultRecord,
} from "../lib/device/device-key-vault";
import { executeDeviceControls } from "../lib/device/device-control";
import {
  acknowledgeDeviceControl,
  completeDeviceKeyProvisioning,
  DeviceSecurityError,
  pollDeviceControls,
  requestDeviceControl,
  startDeviceKeyProvisioning,
  type DeviceControlCommand,
  type DeviceControlType,
  type DeviceKeyChallenge,
  type DeviceSecurityRegistration,
  type DeviceSecurityStore,
  type DeviceSecurityTransaction,
} from "../lib/server/salesday-device-security";
import type { MockUser } from "../lib/types";

class MemoryKeyVault implements DeviceKeyVaultDriver {
  readonly records = new Map<string, DeviceKeyVaultRecord>();

  async get(deviceId: string) {
    return this.records.get(deviceId) ?? null;
  }

  async put(record: DeviceKeyVaultRecord) {
    this.records.set(record.deviceId, record);
  }

  async remove(deviceId: string) {
    this.records.delete(deviceId);
  }

  async clear() {
    const count = this.records.size;
    this.records.clear();
    return count;
  }
}

type MemorySession = {
  sessionId: string;
  userId: string;
  deviceRegistrationId: string | null;
  active: boolean;
};

class MemoryDeviceSecurityStore implements DeviceSecurityStore {
  readonly challenges = new Map<string, Omit<DeviceKeyChallenge, "device">>();
  readonly controls = new Map<string, DeviceControlCommand>();
  readonly sessions = new Map<string, MemorySession>();

  constructor(public device: DeviceSecurityRegistration) {}

  async transaction<T>(action: (database: DeviceSecurityTransaction) => Promise<T>) {
    return action({
      findDeviceById: async (deviceId) => deviceId === this.device.deviceId ? this.clone(this.device) : null,
      createChallenge: async (input) => {
        this.challenges.set(input.challengeId, { ...input, consumedAt: null });
      },
      findChallenge: async (challengeId) => {
        const challenge = this.challenges.get(challengeId);
        return challenge ? { ...this.clone(challenge), device: this.clone(this.device) } : null;
      },
      consumeChallenge: async (challengeId, consumedAt) => {
        const challenge = this.challenges.get(challengeId);
        if (!challenge || challenge.consumedAt) return false;
        challenge.consumedAt = consumedAt;
        return true;
      },
      provisionDevice: async (input) => {
        assert.equal(input.deviceRegistrationId, this.device.id);
        this.device = {
          ...this.device,
          keyVersion: input.keyVersion,
          keyFingerprint: input.keyFingerprint,
          keyProvisionedAt: input.keyProvisionedAt,
          keyRevokedAt: null,
          deviceTokenHash: input.deviceTokenHash,
          deviceTokenIssuedAt: input.deviceTokenIssuedAt,
          deviceTokenRevokedAt: null,
        };
        return this.clone(this.device);
      },
      bindLoginSession: async (sessionId, userId, deviceRegistrationId) => {
        const session = this.sessions.get(sessionId);
        if (!session || !session.active || session.userId !== userId) return false;
        session.deviceRegistrationId = deviceRegistrationId;
        return true;
      },
      findOpenControl: async (deviceRegistrationId, type) => this.clone(
        [...this.controls.values()].find((command) =>
          command.deviceRegistrationId === deviceRegistrationId &&
          command.type === type &&
          command.status !== "ACKNOWLEDGED"
        ) ?? null,
      ),
      createControl: async (input) => {
        const command: DeviceControlCommand = {
          ...input,
          status: "PENDING",
          deliveredAt: null,
          acknowledgedAt: null,
        };
        this.controls.set(command.commandId, command);
        return this.clone(command);
      },
      applyWipeToDevice: async (input) => {
        assert.equal(input.deviceRegistrationId, this.device.id);
        this.device = {
          ...this.device,
          status: "REVOKED",
          activeUserKey: null,
          keyRevokedAt: input.at,
        };
      },
      closeDeviceSessions: async (deviceRegistrationId) => {
        let count = 0;
        for (const session of this.sessions.values()) {
          if (session.deviceRegistrationId === deviceRegistrationId && session.active) {
            session.active = false;
            count += 1;
          }
        }
        return count;
      },
      findDeviceByToken: async (deviceId, tokenHash, allowRevokedToken = false) => {
        if (
          deviceId !== this.device.deviceId ||
          tokenHash !== this.device.deviceTokenHash ||
          (!allowRevokedToken && this.device.deviceTokenRevokedAt)
        ) return null;
        return this.clone(this.device);
      },
      deliverOpenControls: async (deviceRegistrationId, at) => {
        const delivered: DeviceControlCommand[] = [];
        for (const [commandId, command] of this.controls) {
          if (command.deviceRegistrationId !== deviceRegistrationId || command.status === "ACKNOWLEDGED") continue;
          const updated = command.status === "PENDING"
            ? { ...command, status: "DELIVERED" as const, deliveredAt: at }
            : command;
          this.controls.set(commandId, updated);
          delivered.push(this.clone(updated));
        }
        return delivered.sort((left, right) => left.requestedAt.getTime() - right.requestedAt.getTime());
      },
      findControl: async (deviceRegistrationId, commandId) => {
        const command = this.controls.get(commandId);
        return command?.deviceRegistrationId === deviceRegistrationId ? this.clone(command) : null;
      },
      acknowledgeControl: async (deviceRegistrationId, commandId, at) => {
        const command = this.controls.get(commandId);
        assert.equal(command?.deviceRegistrationId, deviceRegistrationId);
        const acknowledged = {
          ...command!,
          status: "ACKNOWLEDGED" as const,
          pendingKey: null,
          acknowledgedAt: at,
        };
        this.controls.set(commandId, acknowledged);
        return this.clone(acknowledged);
      },
      revokeDeviceToken: async (deviceRegistrationId, at) => {
        assert.equal(deviceRegistrationId, this.device.id);
        this.device = { ...this.device, deviceTokenRevokedAt: at };
      },
    });
  }

  private clone<T>(value: T): T {
    return structuredClone(value);
  }
}

function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function commandId(type: DeviceControlType) {
  return `control-${type.toLowerCase()}-001`;
}

async function main() {
  const deviceId = "device-security-be-001";
  const representative: MockUser = {
    id: "rep-security-be",
    name: "Representative Security",
    email: "rep-security@example.test",
    role: "REPRESENTATIVE",
    country: "BE",
    countryAccess: ["BE"],
    language: "nl",
    representativeId: "rep-security-be",
  };
  const superAdmin: MockUser = {
    id: "super-security",
    name: "Super Security",
    email: "super-security@example.test",
    role: "SUPER_ADMIN",
    country: "BE",
    countryAccess: ["BE", "NL", "DE"],
    language: "nl",
  };
  const keyVault = new MemoryKeyVault();
  const localKey = await provisionLocalDeviceKey({
    deviceId,
    keyVersion: 1,
    driver: keyVault,
    now: () => new Date("2026-07-16T21:00:00.000Z"),
  });
  assert.equal(localKey.key.extractable, false);
  assert.equal(localKey.key.algorithm.name, "AES-GCM");
  assert.match(localKey.fingerprint, /^[a-f0-9]{64}$/);
  const loadedKey = await loadLocalDeviceKey({
    deviceId,
    expectedKeyVersion: 1,
    expectedFingerprint: localKey.fingerprint,
    driver: keyVault,
  });
  assert.equal(loadedKey.status, "found");

  const store = new MemoryDeviceSecurityStore({
    id: "device-registration-security-001",
    deviceId,
    userId: representative.id,
    userCountry: "BE",
    status: "ACTIVE",
    activeUserKey: representative.id,
    keyVersion: 0,
    keyFingerprint: null,
    keyProvisionedAt: null,
    keyRevokedAt: null,
    deviceTokenHash: null,
    deviceTokenIssuedAt: null,
    deviceTokenRevokedAt: null,
  });
  store.sessions.set("session-security-001", {
    sessionId: "session-security-001",
    userId: representative.id,
    deviceRegistrationId: null,
    active: true,
  });

  const challenge = await startDeviceKeyProvisioning(
    representative,
    deviceId,
    "session-security-001",
    {
      store,
      now: () => new Date("2026-07-16T21:01:00.000Z"),
      randomToken: () => "challenge-token-security-001",
      randomId: () => "challenge-security-001",
    },
  );
  assert.equal(challenge.targetKeyVersion, 1);
  assert.equal(store.challenges.get(challenge.challengeId)?.tokenHash, hashSecret(challenge.token));
  assert.notEqual(store.challenges.get(challenge.challengeId)?.tokenHash, challenge.token);

  await assert.rejects(
    () => completeDeviceKeyProvisioning(
      representative,
      deviceId,
      "different-session",
      { challengeId: challenge.challengeId, token: challenge.token, keyFingerprint: localKey.fingerprint },
      { store, now: () => new Date("2026-07-16T21:02:00.000Z"), randomToken: () => "unused" },
    ),
    (error: unknown) => error instanceof DeviceSecurityError && error.code === "SESSION_MISMATCH",
  );

  const provisioned = await completeDeviceKeyProvisioning(
    representative,
    deviceId,
    "session-security-001",
    { challengeId: challenge.challengeId, token: challenge.token, keyFingerprint: localKey.fingerprint },
    {
      store,
      now: () => new Date("2026-07-16T21:02:00.000Z"),
      randomToken: () => "device-token-security-001",
    },
  );
  assert.equal(provisioned.keyVersion, 1);
  assert.equal(store.device.keyFingerprint, localKey.fingerprint);
  assert.equal(store.device.deviceTokenHash, hashSecret(provisioned.deviceToken));
  assert.notEqual(store.device.deviceTokenHash, provisioned.deviceToken);
  assert.equal(store.sessions.get("session-security-001")?.deviceRegistrationId, store.device.id);
  await assert.rejects(
    () => completeDeviceKeyProvisioning(
      representative,
      deviceId,
      "session-security-001",
      { challengeId: challenge.challengeId, token: challenge.token, keyFingerprint: localKey.fingerprint },
      { store },
    ),
    (error: unknown) => error instanceof DeviceSecurityError && error.code === "CHALLENGE_CONSUMED",
  );

  const logout = await requestDeviceControl(superAdmin, deviceId, "LOGOUT", "Sessie preventief sluiten", {
    store,
    now: () => new Date("2026-07-16T21:03:00.000Z"),
    randomId: () => commandId("LOGOUT"),
  });
  assert.equal(logout.invalidatedSessionCount, 1);
  assert.equal(store.sessions.get("session-security-001")?.active, false);
  const logoutCommands = await pollDeviceControls(deviceId, provisioned.deviceToken, {
    store,
    now: () => new Date("2026-07-16T21:04:00.000Z"),
  });
  assert.equal(logoutCommands[0].status, "DELIVERED");
  await acknowledgeDeviceControl(deviceId, provisioned.deviceToken, logout.command.commandId, {
    store,
    now: () => new Date("2026-07-16T21:05:00.000Z"),
  });
  assert.notEqual(store.device.deviceTokenHash, null);

  const wipe = await requestDeviceControl(superAdmin, deviceId, "WIPE", "Toestel verloren", {
    store,
    now: () => new Date("2026-07-16T21:06:00.000Z"),
    randomId: () => commandId("WIPE"),
  });
  const duplicateWipe = await requestDeviceControl(superAdmin, deviceId, "WIPE", "Toestel verloren", {
    store,
  });
  assert.equal(duplicateWipe.reused, true);
  assert.equal(duplicateWipe.command.commandId, wipe.command.commandId);
  assert.equal(store.device.status, "REVOKED");
  assert.equal(store.device.activeUserKey, null);
  assert.notEqual(store.device.keyRevokedAt, null);
  const wipeCommands = await pollDeviceControls(deviceId, provisioned.deviceToken, { store });
  assert.equal(wipeCommands.some((command) => command.type === "WIPE"), true);
  const deviceActions: string[] = [];
  const executed = await executeDeviceControls({
    commands: wipeCommands,
    clearEncryptedDeviceData: async () => {
      deviceActions.push("clear-data");
      return 4;
    },
    clearDeviceKeys: async () => {
      deviceActions.push("clear-keys");
      return keyVault.clear();
    },
    clearAdditionalLocalData: async () => {
      deviceActions.push("clear-additional");
    },
    acknowledge: async (controlCommandId) => {
      deviceActions.push(`ack:${controlCommandId}`);
      await acknowledgeDeviceControl(deviceId, provisioned.deviceToken, controlCommandId, { store });
    },
    logout: async () => {
      deviceActions.push("logout");
    },
  });
  assert.equal(executed.action, "WIPE");
  assert.deepEqual(deviceActions, [
    "clear-data",
    "clear-keys",
    "clear-additional",
    `ack:${wipe.command.commandId}`,
    "logout",
  ]);
  assert.equal(store.device.deviceTokenHash, hashSecret(provisioned.deviceToken));
  assert.notEqual(store.device.deviceTokenRevokedAt, null);
  const repeatedAcknowledgement = await acknowledgeDeviceControl(
    deviceId,
    provisioned.deviceToken,
    wipe.command.commandId,
    { store },
  );
  assert.equal(repeatedAcknowledgement.status, "ACKNOWLEDGED");
  await assert.rejects(
    () => pollDeviceControls(deviceId, provisioned.deviceToken, { store }),
    (error: unknown) => error instanceof DeviceSecurityError && error.code === "DEVICE_TOKEN_INVALID",
  );

  const replacementLocalKey = await provisionLocalDeviceKey({
    deviceId,
    keyVersion: 2,
    driver: keyVault,
  });
  const mismatchKey = await loadLocalDeviceKey({
    deviceId,
    expectedKeyVersion: 3,
    expectedFingerprint: "0".repeat(64),
    driver: keyVault,
  });
  assert.equal(replacementLocalKey.keyVersion, 2);
  assert.deepEqual(mismatchKey, { status: "mismatch", removed: true });
  assert.equal(keyVault.records.size, 0);

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/0043_salesday_device_security/migration.sql", "utf8");
  const authSource = readFileSync("lib/server/authenticated-user.ts", "utf8");
  assert(schema.includes("model DeviceKeyProvisioningChallenge"));
  assert(schema.includes("model DeviceControlCommand"));
  assert(migration.includes("DeviceRegistration_deviceTokenHash_key"));
  assert(migration.includes("UserLoginSession_deviceRegistrationId_fkey"));
  assert.equal(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i.test(migration), false);
  assert(authSource.includes("Deze login-sessie is verlopen of op afstand afgemeld."));

  console.log(
    "SalesDay device security: lokale sleutelkluis, eenmalige provisioning, sessiebinding, remote logout/wipe en tokenintrekking gevalideerd.",
  );
}

void main();
