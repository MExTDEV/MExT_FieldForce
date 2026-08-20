import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

loadEnvFile();

const prisma = new PrismaClient();
const allStep9 = process.argv.includes("--all-step9");
const confirmed = process.argv.includes("--confirm");

const runIds = [
  "step9-20260820073906",
  "step9-20260820073926",
  "step9-20260820082705",
  "step9-20260820082725",
];

if (!confirmed) {
  console.error("Geen data verwijderd. Voer opnieuw uit met --confirm.");
  process.exitCode = 2;
} else if (allStep9 && process.env.NODE_ENV === "production") {
  console.error("Veiligheidsstop: all-step9 cleanup is geblokkeerd in production.");
  process.exitCode = 2;
} else {
  async function main() {
    const interventionWhere = allStep9
      ? { id: { startsWith: "step9-" } }
      : { OR: runIds.map((runId) => ({ id: { startsWith: `${runId}-` } })) };
    const criterionWhere = allStep9
      ? { id: { startsWith: "step9-" } }
      : { OR: runIds.map((runId) => ({ id: { startsWith: `${runId}-` } })) };
    const helpWhere = allStep9
      ? { subject: { startsWith: "STEP9" } }
      : { OR: runIds.map((runId) => ({ subject: { contains: runId } })) };
    const actionPointWhere = allStep9
      ? { title: { startsWith: "STEP9 actiepunt" } }
      : { OR: runIds.map((runId) => ({ title: { contains: runId } })) };

    const [interventions, criteria, helpRequests, detachedActionPoints] = await Promise.all([
      prisma.intervention.findMany({
        where: interventionWhere,
        select: { id: true, actionPoints: { select: { id: true } } },
      }),
      prisma.personalCoachingCriterion.findMany({
        where: criterionWhere,
        select: { id: true },
      }),
      prisma.helpRequest.findMany({
        where: helpWhere,
        select: { id: true },
      }),
      prisma.actionPoint.findMany({
        where: actionPointWhere,
        select: { id: true },
      }),
    ]);

    const interventionIds = interventions.map((item) => item.id);
    const actionPointIds = [
      ...new Set([
        ...interventions.flatMap((item) => item.actionPoints.map((actionPoint) => actionPoint.id)),
        ...detachedActionPoints.map((item) => item.id),
      ]),
    ];
    const criterionIds = criteria.map((item) => item.id);
    const helpRequestIds = helpRequests.map((item) => item.id);
    const auditEntityIds = [
      ...interventionIds,
      ...actionPointIds,
      ...criterionIds,
      ...helpRequestIds,
    ];

    assert.ok(
      auditEntityIds.length > 0,
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

    console.log(JSON.stringify({
      result: "STEP9_FIXTURES_CLEANED",
      scope: allStep9 ? "all-step9" : "known-runs",
      runIds: allStep9 ? "all step9-* fixtures" : runIds,
      deleted,
    }, null, 2));
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
