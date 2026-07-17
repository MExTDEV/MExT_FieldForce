import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const expectText = (relative: string, patterns: string[]) => {
  const source = read(relative);
  for (const pattern of patterns) assert.ok(source.includes(pattern), `${relative} must contain ${pattern}`);
};

expectText("lib/server/salesday-day-execution.ts", [
  "getSalesDayAgenda",
  "orderBy: \[\{ sequence",
  "withMutableDayAppointment",
  "Elke afspraak moet eerst een definitieve uitkomst hebben",
  "Elke uitgevoerde afspraak vereist een definitief bezoekverslag",
  "SalesVisitReportAddendum",
  "lead.create",
  "follow-up.create",
  "reference.create",
  "day-close.submit",
  "Serializable",
]);
expectText("app/api/salesday/appointments/route.ts", ["getSalesDayAgenda", "requireAuthenticatedUserContext"]);
expectText("app/api/salesday/day-close/route.ts", ["closeSalesDay", "ERP_WRITES"]);
expectText("app/api/salesday/appointments/[appointmentId]/visit-report/route.ts", ["createSalesVisitReport"]);
expectText("app/api/salesday/visit-reports/[reportId]/addenda/route.ts", ["createSalesVisitReportAddendum"]);
expectText("app/api/salesday/appointments/[appointmentId]/lead/route.ts", ["createSalesLead"]);
expectText("app/api/salesday/appointments/[appointmentId]/follow-up/route.ts", ["createSalesFollowUp"]);
expectText("app/api/salesday/appointments/[appointmentId]/reference/route.ts", ["createSalesReference"]);
expectText("lib/server/salesday-team.ts", ["readOnly: true", "teamScopeWhere", "assertTeamReader"]);
expectText("app/api/salesday/team/route.ts", ["getSalesDayTeam", "assertSalesDayFeatureEnabled"]);
expectText("prisma/schema.prisma", ["model SalesVisitReport", "model SalesLead", "model SalesFollowUp", "model SalesReference", "model SalesDayClosure"]);
expectText("prisma/migrations/0050_salesday_day_execution/migration.sql", ["CREATE TABLE `SalesVisitReport`", "CREATE TABLE `SalesDayClosure`"]);

console.log("SalesDay day-execution checks passed.");
