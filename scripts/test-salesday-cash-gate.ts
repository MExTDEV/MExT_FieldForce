import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  combineSalesDayDayGate,
  isSalesDayOperationalPathAllowedWhileBlocked,
  type SalesDayServerDayGate,
} from "../lib/salesday/day-access";
import {
  countryBusinessDate,
  firstEffectiveWorkdayOfWeek,
  isFirstEffectiveWorkday,
} from "../lib/salesday/cash";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative: string) => fs.existsSync(path.join(root, relative));
const expectText = (relative: string, patterns: string[]) => {
  const source = read(relative);
  for (const pattern of patterns) assert.ok(source.includes(pattern), `${relative} must contain ${pattern}`);
};

assert.equal(firstEffectiveWorkdayOfWeek({
  businessDate: "2026-07-20",
  holidays: [],
}), "2026-07-20");
assert.equal(isFirstEffectiveWorkday({
  businessDate: "2026-07-20",
  holidays: [],
}), true);
assert.equal(firstEffectiveWorkdayOfWeek({
  businessDate: "2026-07-20",
  holidays: ["2026-07-20"],
  plannedBusinessDates: ["2026-07-21"],
}), "2026-07-21");
assert.equal(firstEffectiveWorkdayOfWeek({
  businessDate: "2026-07-22",
  holidays: [],
  plannedBusinessDates: ["2026-07-22", "2026-07-23"],
}), "2026-07-22");
assert.equal(firstEffectiveWorkdayOfWeek({
  businessDate: "2026-07-20",
  holidays: ["2026-07-20"],
  plannedBusinessDates: [],
}), "2026-07-21");
assert.equal(countryBusinessDate("BE", new Date("2026-07-19T22:30:00.000Z")), "2026-07-20");

const normalGate: SalesDayServerDayGate = {
  businessDate: "2026-07-20",
  mode: "NORMAL",
  reason: "NONE",
  serverOpenPreviousCommandCount: 0,
  oldestServerOpenBusinessDate: null,
  cashBlock: null,
  emergency: null,
};
const cashBlockedGate = combineSalesDayDayGate({
  ...normalGate,
  mode: "BLOCKED",
  reason: "CASH_BALANCE_NOT_ZERO",
  cashBlock: {
    firstEffectiveBusinessDate: "2026-07-20",
    currency: "EUR",
    confirmedBalance: "42.0000",
    lastDepositConfirmedAt: null,
    missingCashBalance: false,
  },
}, { openBusinessDates: ["2026-07-17"] });
assert.equal(cashBlockedGate.mode, "BLOCKED");
assert.equal(cashBlockedGate.reason, "CASH_BALANCE_NOT_ZERO");
assert.equal(cashBlockedGate.localOpenPreviousCommandCount, 1);

assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday"), true);
assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/cash"), true);
assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/sync/status"), true);
assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/support"), true);
assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/mijn-agenda"), false);
assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/salesday/mijn-voorbereiding"), false);
assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/contract/new"), false);
assert.equal(isSalesDayOperationalPathAllowedWhileBlocked("/api/salesday/appointments"), false);

expectText("prisma/schema.prisma", [
  "model SalesPaymentMethod",
  "model SalesCashBalance",
  "model SalesCashEntry",
  "enum SalesCashEntryType",
  "paymentMethodExternalId",
]);
expectText("prisma/migrations/0055_salesday_cash_weekly_gate/migration.sql", [
  "CREATE TABLE `SalesPaymentMethod`",
  "CREATE TABLE `SalesCashBalance`",
  "CREATE TABLE `SalesCashEntry`",
  "ALTER TABLE `SalesDocument`",
]);
expectText("lib/server/salesday-cash.ts", [
  "applySalesErpPaymentMethod",
  "applySalesErpCashBalance",
  "DOCUMENT_CASH_PAYMENT",
  "ERP_DEPOSIT_CONFIRMATION",
  "confirmedBalance.eq(0)",
  "input.document.documentType === \"ORDER\"",
  "!input.paymentMethod?.affectsCashBalance",
  "input.actor.role !== \"REPRESENTATIVE\"",
]);
expectText("lib/server/salesday-day-access.ts", [
  "getSalesDayCashBlock",
  "CASH_BALANCE_NOT_ZERO",
  "exact nul kassaldo",
]);
expectText("lib/server/salesday-commercial-documents.ts", [
  "resolveSalesPaymentMethod",
  "paymentMethodExternalId",
  "createDocumentCashEntryInTransaction",
]);
expectText("lib/server/salesday-business-relations.ts", [
  "payment-method.upserted",
  "cash-balance.upserted",
  "applySalesErpPaymentMethod",
  "applySalesErpCashBalance",
]);
expectText("lib/server/integrations/sales-erp/contracts.ts", [
  "paymentMethodExternalId?: string",
  "\"cashBalances\"",
  "\"paymentMethods\"",
]);
expectText("app/api/salesday/cash/route.ts", [
  "getSalesDayCashSheet",
  "assertSalesDayFeatureEnabled(actor, \"SALESDAY\")",
]);
expectText("lib/app-switcher.ts", ["menu.salesday.cash", "/salesday/cash"]);
expectText("lib/user-management.ts", ["menu.salesday.cash"]);
expectText("components/salesday/day-gate-notice.tsx", [
  "cashBlockedTitle",
  "href=\"/salesday/cash\"",
]);

const cashRoute = read("app/api/salesday/cash/route.ts");
assert.equal(cashRoute.includes("export async function POST"), false);
assert.equal(cashRoute.includes("assertSalesDayServerDayAccess"), false);
assert.equal(exists("app/api/salesday/cash/override/route.ts"), false);
assert.equal(exists("app/api/salesday/cash/deposit/route.ts"), false);

const migration = read("prisma/migrations/0055_salesday_cash_weekly_gate/migration.sql").toUpperCase();
assert.equal(migration.includes("DROP TABLE"), false);
assert.equal(migration.includes("DELETE FROM"), false);

for (const language of ["nl", "fr", "de"]) {
  const dictionary = JSON.parse(read(`locales/${language}.json`)) as Record<string, string>;
  for (const key of [
    "salesday.dayGate.cashBlockedTitle",
    "salesday.dayGate.cashBlockedDescription",
    "salesday.dayGate.openCash",
    "salesday.dayGate.cashBalance",
    "salesday.dayGate.firstEffectiveWorkday",
    "salesday.dayGate.missingCashBalance",
  ]) {
    assert.equal(typeof dictionary[key], "string", `${language} missing ${key}`);
  }
}

console.log("SalesDay cash-gate: ERP-betaalmethodes, exact-nul weekblokkade, automatische unblock en toegelaten sync/support getest.");
