import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isExpiryWithinWarningWindow } from "../lib/server/inventory/primitives";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const expectText = (relative: string, patterns: string[]) => {
  const source = read(relative);
  for (const pattern of patterns) assert.ok(source.includes(pattern), `${relative} must contain ${pattern}`);
};
const expectMissingPath = (relative: string) => {
  assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} must not exist`);
};

assert.equal(isExpiryWithinWarningWindow({ today: "2027-09-01", expiryDate: "2028-02-28", warningDays: 180 }), true);
assert.equal(isExpiryWithinWarningWindow({ today: "2027-09-01", expiryDate: "2028-02-29", warningDays: 180 }), false);
assert.equal(isExpiryWithinWarningWindow({
  today: new Date("2027-09-01T00:00:00.000Z"),
  expiryDate: new Date("2028-02-28T23:59:59.000Z"),
  warningDays: 180,
}), true);

expectText("prisma/schema.prisma", [
  "model InventoryLocation",
  "model InventoryMovement",
  "model InventoryBalance",
  "model InventoryReplenishment",
  "model InventoryReceipt",
  "model InventoryReceiptEvidence",
  "model InventoryDiscrepancy",
  "model InventoryConsumablesRequest",
  "model InventoryCarrierCount",
  "enum InventoryLocationType",
  "CUSTOMER_CARRIER",
  "QUARANTINE",
]);
expectText("prisma/migrations/0054_shared_inventory/migration.sql", [
  "CREATE TABLE `InventoryLocation`",
  "CREATE TABLE `InventoryMovement`",
  "CREATE TABLE `InventoryReceiptEvidence`",
  "CREATE TABLE `InventoryConsumablesRequest`",
  "CREATE TABLE `InventoryCarrierCount`",
]);
expectText("lib/server/inventory/primitives.ts", [
  "applyInventoryMovementInTransaction",
  "inventoryBalanceKey",
  "Voorraad mag niet negatief worden",
  "DEFAULT_INVENTORY_EXPIRY_WARNING_DAYS = 180",
]);
expectText("lib/server/inventory/replenishments.ts", [
  "Minstens één foto is verplicht bij ontvangst.",
  "Naam ondertekenaar",
  "REPLENISHMENT_DAMAGED_QUARANTINE",
  "receiptKey",
  "idempotent: true",
  "PARTIALLY_RECEIVED",
]);
expectText("lib/server/inventory/carrier-stock.ts", [
  "Een gearchiveerde drager kan geen nieuwe levering of telling ontvangen.",
  "Een reden is verplicht wanneer de drager-telling afwijkt.",
  "CARRIER_COUNT_CORRECTION",
  "differenceQuantity",
]);
expectText("lib/server/inventory/consumables.ts", [
  "consumables-request.create",
  "idempotent: true",
  "verbruiksgoederen",
]);
expectText("lib/server/inventory/sales-documents.ts", [
  "if (input.documentType === \"ORDER\") return []",
  "SALES_CARRIER_DELIVERY",
  "SALES_DELIVERY",
  "Een gearchiveerde drager kan geen nieuwe levering ontvangen.",
]);
expectText("lib/server/salesday-commercial-documents.ts", [
  "createInventoryMovementsForSalesDocumentInTransaction",
]);
expectText("lib/server/salesday-business-relations.ts", [
  "applySalesErpReplenishment",
  "applySalesErpCustomerLocation",
  "applySalesErpCarrierBalance",
]);
expectText("lib/types.ts", [
  "inventory.balance.readOwn",
  "inventory.receipts.acceptOwn",
  "inventory.consumables.requestOwn",
  "inventory.carriers.writeOwnAppointment",
  "inventory.manage",
  "menu.inventory.enabled",
]);
expectText("lib/user-management.ts", [
  "Gedeelde voorraad, bevoorrading, verbruiksgoederen en klantdragers.",
  "inventory.carriers.writeOwnAppointment",
]);
expectText("app/api/inventory/replenishments/[replenishmentId]/receipt/route.ts", [
  "requireActiveSalesDayDevice",
  "ERP_WRITES",
]);
expectText("app/api/inventory/carrier-counts/route.ts", [
  "submitCarrierCount",
  "ERP_WRITES",
]);
expectText("app/api/inventory/consumables/route.ts", [
  "submitConsumablesRequest",
]);

for (const forbidden of [
  "app/api/inventory/representative-transfers",
  "app/api/inventory/customer-returns",
  "app/api/inventory/personal-stock-counts",
  "app/api/inventory/personal-stock-corrections",
]) {
  expectMissingPath(forbidden);
}

const migration = read("prisma/migrations/0054_shared_inventory/migration.sql").toUpperCase();
assert.equal(migration.includes("DROP TABLE"), false);
assert.equal(migration.includes("DELETE FROM"), false);

console.log("Shared Inventory Milestone 4: schema, receipt evidence, quarantine, carriers, consumables, expiry en verboden endpoints gevalideerd.");
