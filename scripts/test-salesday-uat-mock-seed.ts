import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assertSalesDayMockUatSeedAllowed,
  buildSalesDayMockUatRuntimeConfiguration,
  buildSalesDayMockUatSummary,
  isSalesDayMockUatDatabaseNameAllowed,
  parseSalesDayMockUatDatabaseUrl,
} from "../lib/salesday/mock-uat-seed";
import { salesErpMockDataset, salesErpMockUatScenario } from "../lib/server/integrations/sales-erp/fixtures";

const summary = buildSalesDayMockUatSummary(salesErpMockDataset);

assert.deepEqual(summary.countries, ["BE", "DE", "NL"]);
assert.equal(summary.scenarios.allCustomersAreDemo, true);
assert.equal(summary.scenarios.coversAllCountries, true);
assert.equal(summary.scenarios.hasTodayAndPreparationAppointments, true);
assert.equal(summary.scenarios.hasInvalidOrMissingVat, true);
assert.equal(summary.scenarios.hasNotCompletedAppointment, true);
assert.equal(summary.scenarios.hasNonZeroCashBalance, true);
assert.equal(summary.scenarios.hasCarrierStock, true);
assert.equal(summary.scenarios.hasReplenishment, true);
assert(summary.counts.customers >= 12);
assert(summary.counts.appointments >= 15);
assert(summary.counts.articles >= 5);

const runtime = buildSalesDayMockUatRuntimeConfiguration();
assert.equal(runtime.provider, "MOCK");
assert.equal(runtime.mockSeedEnabled, true);
assert(runtime.enabledNotifications.includes("SYNC_FAILED"));

assert.equal(isSalesDayMockUatDatabaseNameAllowed("MExT_FieldForce_UAT"), true);
assert.equal(isSalesDayMockUatDatabaseNameAllowed("fieldforce_mock_local"), true);
assert.equal(isSalesDayMockUatDatabaseNameAllowed("MExT_FieldForce"), false);

assert.deepEqual(
  parseSalesDayMockUatDatabaseUrl("mysql://user:secret@localhost:3306/MExT_FieldForce_UAT"),
  { scheme: "mysql", host: "localhost", database: "MExT_FieldForce_UAT" },
);

assert.doesNotThrow(() => assertSalesDayMockUatSeedAllowed({
  databaseUrl: "mysql://user:secret@localhost/MExT_FieldForce_UAT",
  nodeEnv: "development",
}));
assert.throws(() => assertSalesDayMockUatSeedAllowed({
  databaseUrl: "mysql://user:secret@localhost/MExT_FieldForce_UAT",
  nodeEnv: "production",
}), /forbidden in production/);
assert.throws(() => assertSalesDayMockUatSeedAllowed({
  databaseUrl: "mysql://user:secret@localhost/MExT_FieldForce",
  nodeEnv: "development",
}), /refused database/);

const seedScript = readFileSync("scripts/seed-salesday-uat-mock.ts", "utf8");
assert(seedScript.includes("applySalesDayReplicaEvent"));
assert(seedScript.includes("role: \"REPRESENTATIVE\""));
assert(seedScript.includes("--include-blockers"));
assert(seedScript.includes("SalesDay mock/UAT seed requires one active real Representative per country"));

assert.deepEqual(salesErpMockUatScenario.countries, ["BE", "NL", "DE"]);

console.log("SalesDay mock/UAT seed: guards, scenario coverage and runner contract validated.");
