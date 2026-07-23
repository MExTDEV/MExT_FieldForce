import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildPreparationRecommendations,
  countryLocalDateTime,
  defaultSalesPreparationConfiguration,
  nextEffectiveBusinessDate,
  parseSalesPreparationConfiguration,
} from "../lib/salesday/preparation";

const be = defaultSalesPreparationConfiguration.countries.BE;
assert.deepEqual(parseSalesPreparationConfiguration(null), defaultSalesPreparationConfiguration);
assert.equal(countryLocalDateTime(new Date("2026-07-17T14:29:00.000Z"), be).time, "16:29");
assert.equal(countryLocalDateTime(new Date("2026-07-17T14:30:00.000Z"), be).time, "16:30");
assert.equal(nextEffectiveBusinessDate("2026-07-17", []), "2026-07-20");
assert.equal(nextEffectiveBusinessDate("2026-07-17", ["2026-07-20"]), "2026-07-21");
assert.throws(
  () => parseSalesPreparationConfiguration(JSON.stringify({ countries: { ...defaultSalesPreparationConfiguration.countries, BE: { ...be, visibleFrom: "25:00" } } })),
  /zichtbaarheidstijdstip/,
);

const recommendations = buildPreparationRecommendations({
  appointmentBusinessDate: "2026-07-20",
  configuration: be,
  documents: [
    invoice("2026-05-01", "2"),
    invoice("2026-06-01", "4"),
    invoice("2026-07-01", "3"),
    { ...invoice("2026-07-10", "99"), documentType: "QUOTE" },
  ],
});
assert.equal(recommendations.length, 1);
assert.equal(recommendations[0].articleNumber, "A-100");
assert.equal(recommendations[0].purchaseCount, 3);
assert.equal(recommendations[0].averageQuantity, 3);
assert.equal(recommendations[0].reasonCode, "EXPECTED_REORDER_DUE");

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/0049_salesday_preparation/migration.sql");
const service = read("lib/server/salesday-preparation.ts");
const routes = read("app/api/salesday/preparations/route.ts") + read("app/api/salesday/preparations/[appointmentId]/route.ts");

for (const model of [
  "SalesPreparationState",
  "SalesPreparationNote",
  "SalesPreparationRecommendationFeedback",
  "SalesCommercialHistoryDocument",
  "SalesCommercialHistoryLine",
]) {
  assert(schema.includes(`model ${model}`));
  assert(migration.includes(`CREATE TABLE \`${model}\``));
}
assert.equal(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i.test(migration), false);
assert(service.includes("assertSalesDayServerDayAccess"));
assert(service.includes("isSalesDayManagementRole"));
assert(service.includes("scopedSalesDayRepresentativeUserWhere"));
assert(service.includes("groupByRelationId"));
assert.equal(service.includes("Map.groupBy"), false);
assert(service.includes('orderBy: [{ sequence: "asc" }'));
assert(service.includes("salesday.preparation.configuration.set"));
assert(service.includes("salesday.preparation.updated"));
assert(routes.includes("deviceId"));

console.log("SalesDay voorbereiding: tijdvenster, feestdagen, aanbevelingen, daggate en audit gevalideerd.");

function invoice(documentDate: string, quantity: string) {
  return {
    documentType: "INVOICE",
    documentDate,
    lines: [{
      articleExternalId: "article-100",
      articleNumberSnapshot: "A-100",
      descriptionSnapshot: "Verbanddoos",
      quantity,
      unitSnapshot: "ST",
    }],
  };
}

function read(path: string) {
  return readFileSync(path, "utf8");
}
