import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SalesErpMockAdapter } from "../lib/server/integrations/sales-erp/mock-adapter";
import {
  resolveSalesDayFeature,
  resolveSalesDayFeatures,
  salesDayFeatureScopeKey,
  type SalesDayFeatureFlagRecord,
} from "../lib/salesday/feature-flags";
import { buildNeutralSalesDayLockScreenNotification } from "../lib/salesday/notifications";
import {
  defaultSalesDayRuntimeConfiguration,
  parseSalesDayRuntimeConfiguration,
  SalesDayRuntimeConfigurationError,
} from "../lib/salesday/runtime-configuration";
import { canAccessSalesday } from "../lib/permissions";
import { roleTemplates, fieldForcePermissionKeys } from "../lib/user-management";
import type { MockUser } from "../lib/types";

const actor: MockUser = {
  id: "rep-be-1",
  name: "Testvertegenwoordiger",
  email: "rep@example.invalid",
  role: "REPRESENTATIVE",
  country: "BE",
  language: "nl",
  teamId: "team-be-1",
  representativeId: "rep-be-1",
};

const flags: SalesDayFeatureFlagRecord[] = [
  { key: "SALESDAY", scope: "GLOBAL", enabled: true },
  { key: "SALESDAY", scope: "COUNTRY", country: "BE", enabled: true },
  { key: "INVENTORY", scope: "GLOBAL", enabled: true },
  { key: "INVENTORY", scope: "COUNTRY", country: "BE", enabled: true },
  { key: "OFFLINE_COMMANDS", scope: "GLOBAL", enabled: true },
  { key: "OFFLINE_COMMANDS", scope: "COUNTRY", country: "BE", enabled: true },
  { key: "ERP_WRITES", scope: "GLOBAL", enabled: true },
  { key: "ERP_WRITES", scope: "COUNTRY", country: "BE", enabled: true },
];

assert.equal(resolveSalesDayFeature([], actor, "SALESDAY").enabled, false);
assert.equal(resolveSalesDayFeature([{ key: "SALESDAY", scope: "GLOBAL", enabled: true }], actor, "SALESDAY").enabled, false);
assert.equal(resolveSalesDayFeatures(flags, actor).SALESDAY.enabled, true);
assert.equal(resolveSalesDayFeatures(flags, actor).INVENTORY.enabled, true);

const teamDenied = [...flags, { key: "SALESDAY", scope: "TEAM", teamId: actor.teamId, enabled: false } satisfies SalesDayFeatureFlagRecord];
assert.equal(resolveSalesDayFeature(teamDenied, actor, "SALESDAY").enabled, false);
const pilotAllowed = [...teamDenied, { key: "SALESDAY", scope: "USER", userId: actor.id, enabled: true } satisfies SalesDayFeatureFlagRecord];
assert.deepEqual(resolveSalesDayFeature(pilotAllowed, actor, "SALESDAY"), {
  key: "SALESDAY",
  enabled: true,
  matchedScope: "USER",
  reason: "ENABLED",
});
assert.equal(
  resolveSalesDayFeature(flags.filter((flag) => !(flag.key === "SALESDAY" && flag.scope === "GLOBAL")), actor, "ERP_WRITES").reason,
  "SALESDAY_DISABLED",
);
assert.equal(salesDayFeatureScopeKey("SALESDAY", "COUNTRY", "BE"), "SALESDAY:COUNTRY:BE");
assert.throws(() => salesDayFeatureScopeKey("SALESDAY", "TEAM"));

assert.equal(defaultSalesDayRuntimeConfiguration("development").provider, "MOCK");
assert.throws(
  () => defaultSalesDayRuntimeConfiguration("production"),
  (error: unknown) => error instanceof SalesDayRuntimeConfigurationError && error.code === "CONFIGURATION_MISSING",
);
for (const configuration of [
  { provider: "MOCK", mockSeedEnabled: false, enabledNotifications: [] },
  { provider: "BC_NAV", mockSeedEnabled: true, enabledNotifications: [] },
]) {
  assert.throws(
    () => parseSalesDayRuntimeConfiguration(JSON.stringify(configuration), "production"),
    (error: unknown) => error instanceof SalesDayRuntimeConfigurationError && error.code === "PRODUCTION_MOCK_FORBIDDEN",
  );
}
assert.equal(
  parseSalesDayRuntimeConfiguration(JSON.stringify({
    provider: "BC_NAV",
    mockSeedEnabled: false,
    enabledNotifications: ["SYNC_FAILED"],
  }), "production").provider,
  "BC_NAV",
);
assert.throws(
  () => new SalesErpMockAdapter({ runtimeEnvironment: "production" }),
  (error: unknown) => error instanceof SalesDayRuntimeConfigurationError,
);

const sensitiveValues = ["Geheime Klant", "€ 9.999", "MOCK-INV-0001"];
for (const language of ["nl", "fr", "de"] as const) {
  const notification = buildNeutralSalesDayLockScreenNotification("DOCUMENT_STATUS", language);
  assert(notification.title.length > 0 && notification.body.length > 0);
  assert.equal(sensitiveValues.some((value) => `${notification.title} ${notification.body}`.includes(value)), false);
}

assert.equal(canAccessSalesday(actor), true);
assert.equal(fieldForcePermissionKeys.includes("salesday.settings.manage"), true);
assert.equal(fieldForcePermissionKeys.includes("salesday.integration.monitor"), true);
assert.equal(roleTemplates.SUPER_ADMIN.permissions["salesday.settings.manage"], true);
assert.equal(roleTemplates.ADMIN.permissions["salesday.settings.manage"], false);
assert.equal(roleTemplates.REPRESENTATIVE.permissions["menu.salesday.enabled"], true);
assert.equal(roleTemplates.REPRESENTATIVE.permissions["menu.salesday.team"], false);

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/0045_salesday_feature_controls/migration.sql", "utf8");
const commandRoute = readFileSync("app/api/salesday/sync/commands/route.ts", "utf8");
const bootstrapRoute = readFileSync("app/api/salesday/bootstrap/route.ts", "utf8");
const worker = readFileSync("lib/server/integrations/sales-erp/outbox-worker.ts", "utf8");
assert(schema.includes("model SalesDayFeatureFlag"));
assert(migration.includes("CREATE TABLE `SalesDayFeatureFlag`"));
assert(commandRoute.includes('assertSalesDayFeatureEnabled(actor, "OFFLINE_COMMANDS")'));
assert(commandRoute.includes("provider: runtime.provider"));
assert(bootstrapRoute.includes('assertSalesDayFeatureEnabled(actor, "SALESDAY")'));
assert(worker.includes("writesEnabled: boolean"));
assert(worker.indexOf("if (!input.writesEnabled)") < worker.indexOf("const candidates = await"));

console.log("SalesDay feature controls: scopes, production guard, neutral notifications, menu/API/bootstrap/background gates validated.");
