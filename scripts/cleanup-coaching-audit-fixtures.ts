import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

loadEnvFile();

const prisma = new PrismaClient();

const testUserIds = [
  "cmsydgqs000x0hqfrlo98c4vz",
  "cmsydh0jt00x7hqfruucss7bt",
];
const testInterventionIds = [
  "coaching-1787040116180-8oajt8",
  "coaching-1787142340556-h1gpt1",
];
const testTeamId = "cmsydfhda00txhqfruh8y47zd";

if (!process.argv.includes("--confirm")) {
  console.error("Geen data gewijzigd. Voer opnieuw uit met --confirm.");
  process.exitCode = 2;
} else {
  async function main() {
    const interventions = await prisma.intervention.findMany({
      where: { id: { in: testInterventionIds } },
      select: {
        id: true,
        actionPoints: { select: { id: true } },
      },
    });
    const actionPointIds = interventions.flatMap((item) =>
      item.actionPoints.map((actionPoint) => actionPoint.id)
    );
    const auditEntityIds = [...testInterventionIds, ...actionPointIds];

    assert.equal(
      interventions.length,
      testInterventionIds.length,
      "Niet alle verwachte testbegeleidingen werden gevonden; er is niets gewijzigd."
    );

    const result = await prisma.$transaction(async (tx) => {
      const auditLogs = auditEntityIds.length
        ? await tx.auditLog.deleteMany({ where: { entityId: { in: auditEntityIds } } })
        : { count: 0 };
      const actionPoints = actionPointIds.length
        ? await tx.actionPoint.deleteMany({ where: { id: { in: actionPointIds } } })
        : { count: 0 };
      const interventions = await tx.intervention.deleteMany({
        where: { id: { in: testInterventionIds } },
      });
      const users = await tx.user.updateMany({
        where: { id: { in: testUserIds } },
        data: { active: false, teamId: null },
      });
      const team = await tx.team.updateMany({
        where: { id: testTeamId },
        data: { active: false, primaryLeaderId: null },
      });

      return {
        auditLogs: auditLogs.count,
        actionPoints: actionPoints.count,
        interventions: interventions.count,
        usersDeactivated: users.count,
        teamsDeactivated: team.count,
      };
    });

    console.log(JSON.stringify({
      result: "COACHING_AUDIT_FIXTURES_CLEANED",
      resultDetails: "Testgebruikers gedeactiveerd; historische gebruikersrelaties behouden.",
      result,
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
