import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../lib/server/db");
  const { loadWorkflowStateFromDatabase } = await import("../lib/server/workflows");
  const { loadPerformanceDatasetFromDatabase } = await import("../lib/server/performance");

  try {
    const databaseRows = await prisma.intervention.findMany({
      where: { type: "BEGELEIDING", deletedAt: null },
      select: { id: true },
      distinct: ["id"],
    });
    assert.equal(new Set(databaseRows.map((item) => item.id)).size, databaseRows.length);

    const firstLoad = await loadWorkflowStateFromDatabase();
    const secondLoad = await loadWorkflowStateFromDatabase();
    const performance = await loadPerformanceDatasetFromDatabase();
    assert.equal(
      secondLoad.interventions.length,
      firstLoad.interventions.length,
      "Een tweede serveraanvraag mag geen begeleidingen aan de vorige aanvraag toevoegen."
    );
    assert.equal(
      new Set(secondLoad.interventions.map((item) => item.id)).size,
      secondLoad.interventions.length,
      "Elke begeleiding moet exact eenmaal in de workflowrespons staan."
    );
    for (const coaching of secondLoad.interventions) {
      const appointments = coaching.appointments ?? [];
      assert.equal(
        new Set(appointments.map((item) => item.id)).size,
        appointments.length,
        `Afspraken van ${coaching.id} moeten uniek zijn.`
      );
      for (const appointment of appointments) {
        assert.equal(
          new Set(appointment.scores.map((item) => item.criterion)).size,
          appointment.scores.length,
          `Scorecriteria van afspraak ${appointment.id} moeten uniek zijn.`
        );
      }
    }
    assert.equal(
      new Set(performance.historicalCoachings.map((item) => item.id)).size,
      performance.historicalCoachings.length,
      "De performance-API mag geen dubbele begeleidingen teruggeven."
    );
    assert.ok(
      performance.historicalCoachings.every((item) => !["concept", "gepland", "geannuleerd"].includes(item.status)),
      "De prestatiecirkel mag alleen uitgevoerde begeleidingen ontvangen."
    );

    const scored = performance.historicalCoachings.filter((item) => item.overallScore !== undefined).length;
    console.log(`Databasecontrole geslaagd: ${databaseRows.length} unieke begeleiding(en), ${scored} met effectieve scoredata.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
