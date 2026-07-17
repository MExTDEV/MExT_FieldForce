import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  activateSalesDayEmergencyMode,
  deactivateSalesDayEmergencyMode,
  getActiveSalesDayEmergencyMode,
  SalesDayEmergencyModeError,
  type SalesDayEmergencyModeRecord,
  type SalesDayEmergencyModeStore,
  type SalesDayEmergencyModeTransaction,
} from "../lib/server/salesday-emergency-mode";
import {
  combineSalesDayDayGate,
  isSalesDayOperationalPathAllowedWhileBlocked,
  type SalesDayServerDayGate,
} from "../lib/salesday/day-access";
import { fieldForcePermissionKeys, roleTemplates } from "../lib/user-management";
import type { MockUser } from "../lib/types";

class MemoryEmergencyStore implements SalesDayEmergencyModeStore, SalesDayEmergencyModeTransaction {
  records = new Map<string, SalesDayEmergencyModeRecord>();
  audits: Array<{ action: string; entityId: string }> = [];
  sequence = 0;

  async transaction<T>(action: (database: SalesDayEmergencyModeTransaction) => Promise<T>) {
    return action(this);
  }

  async clearExpiredOpen(now: Date) {
    for (const record of this.records.values()) {
      if (record.activeKey && record.endsAt <= now) record.activeKey = null;
    }
  }

  async findOpen(now?: Date) {
    return [...this.records.values()].find((record) =>
      record.activeKey === "GLOBAL" && (!now || (!record.deactivatedAt && record.endsAt > now)),
    ) ?? null;
  }

  async findById(id: string) {
    return this.records.get(id) ?? null;
  }

  async create(data: Pick<SalesDayEmergencyModeRecord, "activeKey" | "reason" | "startsAt" | "endsAt" | "activatedByUserId">) {
    const timestamp = new Date("2026-07-17T06:00:00.000Z");
    const record: SalesDayEmergencyModeRecord = {
      id: `emergency-${++this.sequence}`,
      ...data,
      deactivatedAt: null,
      deactivatedByUserId: null,
      deactivationReason: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    return record;
  }

  async deactivate(id: string, data: Pick<SalesDayEmergencyModeRecord, "activeKey" | "deactivatedAt" | "deactivatedByUserId" | "deactivationReason">) {
    const record = this.records.get(id)!;
    Object.assign(record, data, { updatedAt: data.deactivatedAt ?? record.updatedAt });
    return record;
  }

  async writeAudit(data: { action: string; entityId: string }) {
    this.audits.push({ action: data.action, entityId: data.entityId });
  }

  async findActive(now: Date) {
    return [...this.records.values()].find((record) =>
      record.activeKey === "GLOBAL" && !record.deactivatedAt && record.startsAt <= now && record.endsAt > now,
    ) ?? null;
  }
}

const superAdmin: MockUser = {
  id: "super-admin-day-gate",
  name: "Super Admin",
  email: "super-admin@example.test",
  role: "SUPER_ADMIN",
  country: "BE",
  countryAccess: ["BE", "NL", "DE"],
  language: "nl",
  permissions: { "salesday.emergencyMode.manage": true },
};
const representative: MockUser = {
  id: "rep-day-gate",
  name: "Representative",
  email: "rep-day-gate@example.test",
  role: "REPRESENTATIVE",
  country: "BE",
  countryAccess: ["BE"],
  language: "nl",
  representativeId: "rep-day-gate",
  permissions: { "salesday.emergencyMode.manage": false },
};

async function main() {
  const store = new MemoryEmergencyStore();
  const now = new Date("2026-07-17T06:00:00.000Z");
  await assert.rejects(
    () => activateSalesDayEmergencyMode(representative, {
      reason: "ERP-storing",
      startsAt: now,
      endsAt: "2026-07-17T10:00:00.000Z",
    }, { store, now: () => now }),
    (error: unknown) => error instanceof SalesDayEmergencyModeError && error.code === "PERMISSION_REQUIRED",
  );
  await assert.rejects(
    () => activateSalesDayEmergencyMode(superAdmin, {
      reason: "Ongeldig verlopen venster",
      startsAt: "2026-07-16T08:00:00.000Z",
      endsAt: "2026-07-16T10:00:00.000Z",
    }, { store, now: () => now }),
    (error: unknown) => error instanceof SalesDayEmergencyModeError && error.code === "INVALID_INPUT",
  );
  const active = await activateSalesDayEmergencyMode(superAdmin, {
    reason: "Bevestigde langdurige ERP-storing",
    startsAt: now,
    endsAt: "2026-07-17T10:00:00.000Z",
  }, { store, now: () => now });
  assert.equal((await getActiveSalesDayEmergencyMode({ store, now: () => now }))?.id, active.id);
  assert.deepEqual(store.audits.map((audit) => audit.action), ["salesday.emergency.activate"]);
  await assert.rejects(
    () => activateSalesDayEmergencyMode(superAdmin, {
      reason: "Tweede storing",
      startsAt: now,
      endsAt: "2026-07-17T11:00:00.000Z",
    }, { store, now: () => now }),
    (error: unknown) => error instanceof SalesDayEmergencyModeError && error.code === "ALREADY_OPEN",
  );
  await deactivateSalesDayEmergencyMode(superAdmin, {
    emergencyModeId: active.id,
    reason: "ERP-verkeer is opnieuw stabiel",
  }, { store, now: () => new Date("2026-07-17T08:00:00.000Z") });
  await deactivateSalesDayEmergencyMode(superAdmin, {
    emergencyModeId: active.id,
    reason: "Herhaalde bevestiging",
  }, { store, now: () => new Date("2026-07-17T08:01:00.000Z") });
  assert.equal(await getActiveSalesDayEmergencyMode({ store, now: () => now }), null);
  assert.deepEqual(store.audits.map((audit) => audit.action), [
    "salesday.emergency.activate",
    "salesday.emergency.deactivate",
  ]);

  const normalServer: SalesDayServerDayGate = {
    businessDate: "2026-07-17",
    mode: "NORMAL",
    reason: "NONE",
    serverOpenPreviousCommandCount: 0,
    oldestServerOpenBusinessDate: null,
    cashBlock: null,
    emergency: null,
  };
  const localBlocked = combineSalesDayDayGate(normalServer, { openBusinessDates: ["2026-07-16", "2026-07-17"] });
  assert.equal(localBlocked.mode, "BLOCKED");
  assert.equal(localBlocked.oldestLocalOpenBusinessDate, "2026-07-16");
  const serverBlocked = combineSalesDayDayGate({
    ...normalServer,
    mode: "BLOCKED",
    reason: "DAY_MINUS_ONE_PENDING",
    serverOpenPreviousCommandCount: 2,
    oldestServerOpenBusinessDate: "2026-07-16",
  }, { openBusinessDates: [] });
  assert.equal(serverBlocked.mode, "BLOCKED");
  assert.equal(serverBlocked.reason, "DAY_MINUS_ONE_PENDING");
  const cashBlocked = combineSalesDayDayGate({
    ...normalServer,
    mode: "BLOCKED",
    reason: "CASH_BALANCE_NOT_ZERO",
    cashBlock: {
      firstEffectiveBusinessDate: "2026-07-20",
      currency: "EUR",
      confirmedBalance: "125.0000",
      lastDepositConfirmedAt: null,
      missingCashBalance: false,
    },
  }, { openBusinessDates: ["2026-07-16"] });
  assert.equal(cashBlocked.mode, "BLOCKED");
  assert.equal(cashBlocked.reason, "CASH_BALANCE_NOT_ZERO");
  assert.equal(cashBlocked.localOpenPreviousCommandCount, 1);
  const emergencyGate = combineSalesDayDayGate({
    ...normalServer,
    mode: "EMERGENCY",
    reason: "EMERGENCY_ACTIVE",
    emergency: {
      id: "emergency-allowed",
      reason: "ERP-storing",
      startsAt: "2026-07-17T06:00:00.000Z",
      endsAt: "2026-07-17T10:00:00.000Z",
    },
  }, { openBusinessDates: ["2026-07-16"] });
  assert.equal(emergencyGate.mode, "EMERGENCY");

  assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/cash"), true);
  assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/sync"), true);
  assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/support/incident"), true);
  assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/mijn-agenda"), false);
  assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/mijn-voorbereiding"), false);

  assert.equal(fieldForcePermissionKeys.includes("salesday.emergencyMode.manage"), true);
  assert.equal(roleTemplates.SUPER_ADMIN.permissions["salesday.emergencyMode.manage"], true);
  assert.equal(roleTemplates.ADMIN.permissions["salesday.emergencyMode.manage"], false);

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/0044_salesday_day_gate_emergency/migration.sql", "utf8");
  const gateSource = readFileSync("lib/server/salesday-day-access.ts", "utf8");
  const emergencySource = readFileSync("lib/server/salesday-emergency-mode.ts", "utf8");
  const gateRouteSource = readFileSync("app/api/salesday/sync/day-gate/route.ts", "utf8");
  const emergencyRouteSource = readFileSync("app/api/salesday/sync/emergency/route.ts", "utf8");
  const noticeSource = readFileSync("components/salesday/day-gate-notice.tsx", "utf8");
  assert(schema.includes("model SalesDayEmergencyMode"));
  assert(migration.includes("salesday.emergencyMode.manage"));
  assert(migration.includes("SUPER_ADMIN"));
  assert(gateSource.includes("status: { not: ErpOutboxStatus.ACCEPTED }"));
  assert(gateSource.includes("actorUserId: input.actor.id"));
  assert(gateSource.includes("getSalesDayCashBlock"));
  assert(gateSource.includes("CASH_BALANCE_NOT_ZERO"));
  assert(emergencySource.includes("Prisma.TransactionIsolationLevel.Serializable"));
  assert(emergencySource.includes("salesday.emergency.activate"));
  assert(emergencySource.includes("salesday.emergency.deactivate"));
  assert(gateRouteSource.includes("requireAuthenticatedUserContext"));
  assert(emergencyRouteSource.includes("activateSalesDayEmergencyMode"));
  assert(noticeSource.includes('role="alert"'));
  assert(noticeSource.includes('href="/salesday/cash"'));
  assert(noticeSource.includes('href="/salesday/sync"'));
  const dictionaries = ["nl", "fr", "de"].map((language) => JSON.parse(
    readFileSync(`locales/${language}.json`, "utf8"),
  ) as Record<string, string>);
  const gateKeys = Object.keys(dictionaries[0]).filter((key) => key.startsWith("salesday.dayGate.")).sort();
  assert(gateKeys.length >= 10);
  for (const dictionary of dictionaries) {
    assert.deepEqual(Object.keys(dictionary).filter((key) => key.startsWith("salesday.dayGate.")).sort(), gateKeys);
  }

  console.log("SalesDay day-gate: lokale/server dag −1-blokkering, afgeschermde routes en geaudite noodmodus gevalideerd.");
}

void main();
