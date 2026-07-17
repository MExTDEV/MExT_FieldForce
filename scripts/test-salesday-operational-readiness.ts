import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  evaluateSalesDayProductionReadiness,
  normalizeSalesDayPowerBiLink,
  parseSalesDayPowerBiSetting,
  serializeSalesDayPowerBiSetting,
  summarizeReadiness,
} from "../lib/salesday/operational-dashboard";
import { buildSalesDayUatPlan } from "./generate-salesday-uat-plan";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const expectText = (relative: string, patterns: string[]) => {
  const source = read(relative);
  for (const pattern of patterns) assert.ok(source.includes(pattern), `${relative} must contain ${pattern}`);
};

const powerBi = normalizeSalesDayPowerBiLink({
  label: "SalesDay rapportering",
  href: "https://app.powerbi.com/groups/demo/reports/report-id?ctid=tenant#ignored",
});
assert.equal(powerBi.configured, true);
assert.equal(powerBi.label, "SalesDay rapportering");
assert.equal(powerBi.href?.startsWith("https://app.powerbi.com/"), true);
assert.equal(powerBi.href?.includes("#"), false);
assert.throws(() => normalizeSalesDayPowerBiLink({ href: "http://app.powerbi.com/report" }));
assert.throws(() => normalizeSalesDayPowerBiLink({ href: "https://example.com/report" }));
assert.equal(parseSalesDayPowerBiSetting(null).configured, false);
assert.equal(parseSalesDayPowerBiSetting(serializeSalesDayPowerBiSetting({ href: "https://app.powerbi.com/report" })).configured, true);

const blocked = evaluateSalesDayProductionReadiness({
  salesdayFeatureEnabled: true,
  inventoryFeatureEnabled: true,
  offlineCommandsEnabled: true,
  erpWritesEnabled: true,
  runtimeProvider: "MOCK",
  powerBiConfigured: false,
  openIncidentCount: 1,
  openOutboxCommandCount: 2,
  runtimeEnvironment: "production",
});
assert.equal(summarizeReadiness(blocked), "BLOCKED");
assert.equal(blocked.some((check) => check.code === "REAL_ERP_ACCEPTANCE" && check.status === "EXTERNAL"), true);
assert.equal(blocked.some((check) => check.code === "MOCK_PROVIDER_DISABLED" && check.status === "FAIL"), true);

const ready = evaluateSalesDayProductionReadiness({
  salesdayFeatureEnabled: true,
  inventoryFeatureEnabled: true,
  offlineCommandsEnabled: true,
  erpWritesEnabled: true,
  runtimeProvider: "BC_NAV",
  powerBiConfigured: true,
  openIncidentCount: 0,
  openOutboxCommandCount: 0,
  runtimeEnvironment: "production",
  externalEvidence: { realErp: true, uat: true, migration: true, backupRestore: true, mdmDeviceLoss: true },
});
assert.equal(summarizeReadiness(ready), "OK");

const uatPlan = buildSalesDayUatPlan();
assert.equal(uatPlan.length, 3 * 4 * 20);
assert.deepEqual(new Set(uatPlan.map((item) => item.country)), new Set(["BE", "NL", "DE"]));
assert.equal(uatPlan.some((item) => item.scenario.includes("cash zero gate")), true);
assert.equal(uatPlan.some((item) => item.scenario.includes("MDM remote invalidation")), true);

expectText("lib/server/salesday-operational-dashboard.ts", [
  "salesDayPowerBiSettingKey",
  "salesday.powerbi.set",
  "salesday.integration.monitor",
  "getSalesDayOperationalDashboard",
  "ErpReconciliationIncidentStatus.OPEN",
  "REPRESENTATIVE_VEHICLE",
]);
expectText("app/api/salesday/operational-dashboard/route.ts", [
  "assertSalesDayFeatureEnabled(actor, \"SALESDAY\")",
  "getSalesDayOperationalDashboard",
]);
expectText("app/api/salesday/power-bi-link/route.ts", [
  "setSalesDayPowerBiLink",
  "requireAuthenticatedUserContext",
]);
expectText("components/salesday/salesday-workspace.tsx", [
  "/api/salesday/operational-dashboard",
  "powerBi.href",
  "target=\"_blank\"",
]);
assert.equal(read("components/salesday/salesday-workspace.tsx").includes("<iframe"), false);
assert.equal(read("package.json").includes("powerbi-client"), false);

const dictionaries = ["nl", "fr", "de"].map((language) => JSON.parse(read(`locales/${language}.json`)) as Record<string, string>);
const dashboardKeys = Object.keys(dictionaries[0]).filter((key) => key.startsWith("salesday.dashboard.")).sort();
assert(dashboardKeys.length >= 20);
for (const dictionary of dictionaries) {
  assert.deepEqual(Object.keys(dictionary).filter((key) => key.startsWith("salesday.dashboard.")).sort(), dashboardKeys);
}

console.log("SalesDay Milestone 6: operationele indicatoren, Power BI-link, readiness en UAT-plan gevalideerd.");
