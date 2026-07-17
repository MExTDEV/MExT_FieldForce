import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizeSalesErpCustomer } from "../lib/server/salesday-business-relations";
import { salesErpMockDataset } from "../lib/server/integrations/sales-erp/fixtures";

const customer = salesErpMockDataset.customers[0];
const normalized = normalizeSalesErpCustomer(customer);

assert.equal(normalized.type, "CUSTOMER");
assert.equal(normalized.country, "BE");
assert.equal(normalized.contacts[0].sourceExternalId, "mock-contact-be-001");
assert.equal(normalized.addresses[0].type, "LEGAL");
assert.equal(normalized.billingValidation.status, "VALID");
assert.equal(normalized.billingValidation.modulo97Valid, true);
assert.equal(normalized.sourceUpdatedAt.toISOString(), customer.sourceUpdatedAt);

assert.throws(
  () => normalizeSalesErpCustomer({
    ...customer,
    contacts: [customer.contacts[0], { ...customer.contacts[0], externalId: "duplicate-primary" }],
  }),
  /more than one active primary contact/,
);
assert.throws(
  () => normalizeSalesErpCustomer({ ...customer, sourceUpdatedAt: "not-a-date" }),
  /Invalid customer source timestamp/,
);

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/0046_salesday_business_relations/migration.sql");
const contractService = read("lib/contract/services.ts");
const relationService = read("lib/server/salesday-business-relations.ts");

for (const model of [
  "BusinessRelation",
  "BusinessRelationContact",
  "BusinessRelationAddress",
  "BusinessRelationBillingValidation",
  "BusinessRelationExternalLink",
]) {
  assert(schema.includes(`model ${model}`));
  assert(migration.includes(`CREATE TABLE \`${model}\``));
}
assert(schema.includes("businessRelationId String?"));
assert(migration.includes("UPDATE `ContractCustomer`"));
assert(migration.includes("ContractCustomer_businessRelationId_key"));
assert.equal(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i.test(migration), false);
assert(contractService.includes("await tx.businessRelation.create"));
assert(contractService.includes("businessRelationId: businessRelation.id"));
assert(relationService.includes("PRESERVED_PENDING_FIELD_FORCE_EDIT"));
assert(relationService.includes("updateContractCompatibility"));

console.log("SalesDay relations: ERP-normalisatie, primaire records, Contract-brug en additieve migratie gevalideerd.");

function read(path: string) {
  return readFileSync(path, "utf8");
}
