import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const service = read("lib/server/salesday-attachments.ts");
const customerRoute = read("app/api/salesday/customers/[relationId]/attachments/route.ts");
const appointmentRoute = read("app/api/salesday/appointments/[appointmentId]/attachments/route.ts");
const migration = read("prisma/migrations/0052_salesday_attachments/migration.sql");
const schema = read("prisma/schema.prisma");

for (const required of ["SalesAttachment", "attachment.submit", "sha256", "storageKey", "Serializable", "appointmentId", "categoryExternalId"]) {
  assert.ok(service.includes(required), `attachment service must contain ${required}`);
}
assert.ok(customerRoute.includes("Een afspraak van vandaag is vereist"), "customer route must enforce appointment gate");
assert.ok(customerRoute.includes("appointmentId"), "customer route must scope reads to appointment");
assert.ok(appointmentRoute.includes("targetType: \"APPOINTMENT\""), "appointment route must submit appointment target");
assert.ok(migration.includes("CREATE TABLE `SalesAttachment`"), "attachment migration must be additive");
assert.ok(schema.includes("model SalesAttachment"), "schema must define attachment staging");
console.log("SalesDay attachment checks passed.");
