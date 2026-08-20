import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

loadEnvFile();

const prisma = new PrismaClient();

const runIds = [
  "step9-20260820073906",
  "step9-20260820073926",
  "step9-20260820082705",
  "step9-20260820082725",
];

if (!process.argv.includes("--confirm")) {
  console.error("Geen data verwijderd. Voer opnieuw uit met --confirm.");
  process.exitCode = 2;
} else {
  async function main() {
    const interventions = await prisma.intervention.findMany({
      where: {
        OR: runIds.map((runId) => ({ id: { startsWith: `${runId}-` } })),
      },
      select: {
        id: true,
        actionPoints: { select: { id: true } },
      },
    });

    const criteria = await prisma.personalCoachingCriterion.findMany({
      where: {
        OR: runIds.map((runId) => ({ id: { startsWith: `${runId}-` } })),
      },
      select: { id: true },
    });

    const helpRequests = await prisma.helpRequest.findMany({
      where: {
        OR: runIds.map((runId) => ({ subject: { contains: runId } })),
      },
      select: { id: true },
    });

    const interventionIds = interventions.map((item) => item.id);
    const actionPointIds = interventions.flatMap((item) =>
      item.actionPoints.map((actionPoint) => actionPoint.id)
    );
    const criterionIds = criteria.map((item) => item.id);
    const helpRequestIds = helpRequests.map((item) => item.id);
    const auditEntityIds = [
      ...interventionIds,
      ...actionPointIds,
      ...criterionIds,
      ...helpRequestIds,
    ];

    assert.ok(
      interventionIds.length > 0 || criterionIds.length > 0 || helpRequestIds.length > 0,
      "Geen STEP9-testfixtures gevonden; er is niets verwijderd."
    );

    const deleted = await prisma.$transaction(async (tx) => {
      const auditLogs = auditEntityIds.length
        ? await tx.auditLog.deleteMany({ where: { entityId: { in: auditEntityIds } } })
        : { count: 0 };
      const removedHelpRequests = helpRequestIds.length
        ? await tx.helpRequest.deleteMany({ where: { id: { in: helpRequestIds } } })
        : { count: 0 };
      const removedActionPoints = actionPointIds.length
        ? await tx.actionPoint.deleteMany({ where: { id: { in: actionPointIds } } })
        : { count: 0 };
      const removedInterventions = interventionIds.length
        ? await tx.intervention.deleteMany({ where: { id: { in: interventionIds } } })
        : { count: 0 };
      const removedCriteria = criterionIds.length
        ? await tx.personalCoachingCriterion.deleteMany({ where: { id: { in: criterionIds } } })
        : { count: 0 };

      return {
        auditLogs: auditLogs.count,
        helpRequests: removedHelpRequests.count,
        actionPoints: removedActionPoints.count,
        interventions: removedInterventions.count,
        criteria: removedCriteria.count,
      };
    });

    console.log(JSON.stringify({ result: "STEP9_FIXTURES_CLEANED", runIds, deleted }, null, 2));
  }

  void main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
