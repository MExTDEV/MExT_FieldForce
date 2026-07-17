import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizeSalesErpAppointment } from "../lib/server/salesday-appointments";
import { salesErpMockDataset } from "../lib/server/integrations/sales-erp/fixtures";

const appointment = salesErpMockDataset.appointments[0];
const normalized = normalizeSalesErpAppointment(appointment);

assert.equal(normalized.providerExternalId, appointment.externalId);
assert.equal(normalized.businessDate.toISOString(), "2026-07-20T00:00:00.000Z");
assert.equal(normalized.sequence, 1);
assert.equal(normalized.status, "PLANNED");
assert.equal(normalized.customerExternalId, salesErpMockDataset.customers[0].externalId);
assert.throws(() => normalizeSalesErpAppointment({ ...appointment, sequence: -1 }), /volgorde is ongeldig/);
assert.throws(() => normalizeSalesErpAppointment({ ...appointment, businessDate: "20-07-2026" }), /afspraakdatum is ongeldig/);

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/0048_salesday_appointment_operations/migration.sql");
const service = read("lib/server/salesday-appointments.ts");
const dispatcher = read("lib/server/salesday-business-relations.ts");
const contracts = read("lib/server/integrations/sales-erp/contracts.ts");
const appointmentsRoute = read("app/api/salesday/appointments/route.ts");

for (const model of ["SalesAppointmentChange", "SalesAppointmentOutcomeReason"]) {
  assert(schema.includes(`model ${model}`));
  assert(migration.includes(`CREATE TABLE \`${model}\``));
}
assert.equal(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i.test(migration), false);
assert(schema.includes("pendingFieldForceEdit    Boolean"));
assert(service.includes('orderBy: [{ sequence: "asc" }'));
assert(service.includes("const sequence = (last._max.sequence ?? 0) + 1"));
const appointmentInput = service.slice(
  service.indexOf("export type SalesDayAppointmentInput"),
  service.indexOf("};", service.indexOf("export type SalesDayAppointmentInput")),
);
assert(!appointmentInput.includes("sequence"));
assert(service.includes('businessDate: dateOnly(salesDayBusinessDate(actor, now), "werkdag")'));
assert(service.includes("lockMutableAppointment"));
assert(service.includes("enqueueSalesErpCommandInTransaction"));
assert(service.includes("tx.salesAppointmentChange.create"));
assert(service.includes("tx.auditLog.create"));
assert(service.includes("pendingCreateDependency"));
assert(dispatcher.includes('event.eventType === "appointment.upserted"'));
assert(dispatcher.includes('event.eventType === "appointment-outcome-reason.upserted"'));
assert(contracts.includes("appointmentExternalId?: string"));
assert(contracts.includes('"COMPLETED" | "NOT_COMPLETED" | "MOVED" | "CANCELLED"'));
assert(appointmentsRoute.includes("requireActiveSalesDayDevice"));

console.log("SalesDay afspraken: replica, bindende volgorde, dagscope, offline dependencies en audit gevalideerd.");

function read(path: string) {
  return readFileSync(path, "utf8");
}
