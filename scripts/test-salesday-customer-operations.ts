import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  validateBillingIdentity,
  validateVatLocally,
  type BillingAuthorityResult,
  type BillingValidationPort,
} from "../lib/salesday/billing-validation";
import {
  salesDayBusinessDate,
  salesDayCustomerScopeWhere,
} from "../lib/server/salesday-customer-access";
import type { MockUser } from "../lib/types";

async function main() {
const representative = user({
  id: "rep-be-1",
  role: "REPRESENTATIVE",
  country: "BE",
  teamId: "team-be-1",
  representativeId: "erp-rep-be-1",
});
const salesLeader = user({ id: "leader-be-1", role: "SALES_LEADER", country: "BE", teamId: "team-be-1" });
const salesManager = user({ id: "manager-1", role: "SALES_MANAGER", country: "BE", countryAccess: ["BE", "NL"] });

assert.equal(validateVatLocally("BE", "BE 0428.759.497").formatValid, true);
assert.equal(validateVatLocally("BE", "BE 0428.759.497").modulo97Valid, true);
assert.equal(validateVatLocally("BE", "BE 0428.759.498").modulo97Valid, false);
assert.equal(validateVatLocally("NL", "NL123456789B01").formatValid, true);
assert.equal(validateVatLocally("DE", "DE123456789").formatValid, true);

const officialIdentity = {
  legalName: "Voorbeeld NV",
  vatNumber: "BE0428759497",
  street: "Wetstraat",
  houseNumber: "1",
  postalCode: "1000",
  city: "Brussel",
  country: "BE" as const,
};
const validResult = await validateBillingIdentity({
  country: "BE",
  vatNumber: "BE0428759497",
  vies: port("VIES", { status: "VALID", authority: "VIES", checkedAt: "2026-07-17T10:00:00.000Z", identity: officialIdentity }),
  peppol: port("PEPPOL", { status: "VALID", authority: "PEPPOL", checkedAt: "2026-07-17T10:00:01.000Z", identity: officialIdentity }),
});
assert.equal(validResult.status, "VALID");
assert.equal(validResult.authoritativeIdentity?.legalName, "Voorbeeld NV");

const conflictResult = await validateBillingIdentity({
  country: "BE",
  vatNumber: "BE0428759497",
  vies: port("VIES", { status: "VALID", authority: "VIES", checkedAt: "2026-07-17T10:00:00.000Z", identity: officialIdentity }),
  peppol: port("PEPPOL", { status: "INVALID", authority: "PEPPOL", checkedAt: "2026-07-17T10:00:01.000Z" }),
});
assert.equal(conflictResult.status, "CONFLICT");
assert.equal(conflictResult.authoritativeIdentity, null);

const unavailableResult = await validateBillingIdentity({ country: "BE", vatNumber: "BE0428759497" });
assert.equal(unavailableResult.status, "UNAVAILABLE");
assert.equal(unavailableResult.local.modulo97Valid, true);

assert.deepEqual(salesDayCustomerScopeWhere(representative), {
  OR: [
    { ownerUserId: "rep-be-1" },
    { representativeExternalId: "erp-rep-be-1" },
    { teamId: "team-be-1" },
  ],
});
assert.deepEqual(salesDayCustomerScopeWhere(salesLeader), { teamId: "team-be-1" });
assert.deepEqual(salesDayCustomerScopeWhere(salesManager), { country: { in: ["BE", "NL"] } });
assert.equal(salesDayBusinessDate(representative, new Date("2026-07-16T22:30:00.000Z")), "2026-07-17");

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/0047_salesday_customer_operations/migration.sql");
const access = read("lib/server/salesday-customer-access.ts");
const operations = read("lib/server/salesday-customer-operations.ts");
const customerRoute = read("app/api/salesday/customers/[relationId]/route.ts");

for (const model of ["SalesAppointment", "BusinessRelationChange"]) {
  assert(schema.includes(`model ${model}`));
  assert(migration.includes(`CREATE TABLE \`${model}\``));
}
assert.equal(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i.test(migration), false);
assert(access.includes("AND: ["));
assert(access.includes("Volledige klantgegevens zijn alleen zichtbaar via een afspraak van vandaag"));
assert(operations.includes("const lockedAppointment = await tx.salesAppointment.findFirst"));
assert(operations.includes("pendingFieldForceEdit: true"));
assert(operations.includes("...relationData(prepared)"));
assert(!operations.includes("...relationData(input.actor, prepared)"));
assert(operations.includes("const hasExplicitPrimary"));
assert(operations.includes("isImplicitPrimaryAddress"));
assert(operations.includes("enqueueSalesErpCommandInTransaction"));
assert(operations.includes("tx.businessRelationChange.create"));
assert(operations.includes("tx.auditLog.create"));
assert(operations.includes("tx.contractCustomer.update"));
assert(customerRoute.includes("requireActiveSalesDayDevice"));

console.log("SalesDay klanten: scope, afspraaklock, btw-validatie, audit en ERP-outbox gevalideerd.");
}

void main();

function port(authority: "VIES" | "PEPPOL", result: BillingAuthorityResult): BillingValidationPort {
  return { authority, async validate() { return result; } };
}

function user(input: Pick<MockUser, "id" | "role" | "country"> & Partial<MockUser>): MockUser {
  return {
    name: input.id,
    email: `${input.id}@example.test`,
    language: "nl",
    ...input,
  };
}

function read(path: string) {
  return readFileSync(path, "utf8");
}
