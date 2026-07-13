import { prisma } from "../lib/server/db";
import {
  ensureCriterionSnapshotsForIntervention,
  listApplicableCriteriaForUser,
  listCriterionSnapshotsForInterventions,
} from "../lib/server/criterion-scopes";

type TestUser = {
  id: string;
  country: "BE" | "NL" | "DE";
  teamId: string;
};

const runId = `criterion-scope-test-${Date.now()}`;
const criterionId = `${runId}-criterion`;
const secondCriterionId = `${runId}-second`;
const interventionId = `${runId}-intervention`;

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const [user] = await prisma.$queryRawUnsafe<TestUser[]>(
    "SELECT id, country, teamId FROM `User` WHERE active = TRUE AND teamId IS NOT NULL ORDER BY updatedAt DESC LIMIT 1"
  );
  expect(user, "Er is minstens een actieve gebruiker met team nodig voor de scope-test.");

  try {
    await prisma.$executeRawUnsafe(
      "INSERT INTO `ConfigurableCriterion` (`id`, `type`, `code`, `title`, `section`, `createdAt`, `updatedAt`) VALUES (?, 'GENERAL_COACHING_SCORE', ?, 'Scope dedupe test', 'Test', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))",
      criterionId,
      `${runId.toUpperCase()}_CRITERION`
    );
    await prisma.$executeRawUnsafe(
      "INSERT INTO `ConfigurableCriterion` (`id`, `type`, `code`, `title`, `section`, `createdAt`, `updatedAt`) VALUES (?, 'GENERAL_COACHING_SCORE', ?, 'Scope global test', 'Test', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))",
      secondCriterionId,
      `${runId.toUpperCase()}_SECOND`
    );

    const links = [
      ["global", criterionId, "GLOBAL", "GLOBAL", null, null, null, 10],
      ["country", criterionId, "COUNTRY", `COUNTRY:${user.country}`, user.country, null, null, 7],
      ["team", criterionId, "TEAM", `TEAM:${user.teamId}`, null, user.teamId, null, 3],
      ["user", criterionId, "USER", `USER:${user.id}`, null, null, user.id, 1],
      ["second-global", secondCriterionId, "GLOBAL", "GLOBAL", null, null, null, 2],
    ] as const;

    for (const [suffix, targetCriterionId, scopeType, scopeKey, country, teamId, userId, sortOrder] of links) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`CriterionScopeLink\` (
          \`id\`, \`criterionType\`, \`criterionKey\`, \`configurableCriterionId\`,
          \`scopeType\`, \`scopeKey\`, \`country\`, \`teamId\`, \`userId\`, \`sortOrder\`,
          \`createdAt\`, \`updatedAt\`
        ) VALUES (?, 'GENERAL_COACHING_SCORE', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
        `${runId}-${suffix}`,
        `GENERAL_COACHING_SCORE:${targetCriterionId}`,
        targetCriterionId,
        scopeType,
        scopeKey,
        country,
        teamId,
        userId,
        sortOrder
      );
    }

    const applicable = await listApplicableCriteriaForUser(user.id, {
      types: ["GENERAL_COACHING_SCORE"],
    });
    const deduped = applicable.find((criterion) => criterion.sourceCriterionId === criterionId);
    const globalOnly = applicable.find((criterion) => criterion.sourceCriterionId === secondCriterionId);

    expect(deduped, "Het testcriterium moet van toepassing zijn.");
    expect(deduped?.appliedScopeType === "USER", "Meest specifieke scope moet Gebruiker zijn.");
    expect(deduped?.sortOrder === 1, "De sortering van de meest specifieke gebruikerskoppeling moet gelden.");
    expect(globalOnly?.appliedScopeType === "GLOBAL", "Een alleen-globaal criterium blijft Globaal.");
    expect(
      applicable.filter((criterion) => criterion.sourceCriterionId === criterionId).length === 1,
      "Een criterium met meerdere toepasselijke koppelingen mag maar een keer terugkomen."
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO \`Intervention\` (
        \`id\`, \`type\`, \`status\`, \`representativeId\`, \`initiatorId\`, \`ownerId\`,
        \`teamId\`, \`country\`, \`title\`, \`plannedAt\`, \`outlookSyncStatus\`,
        \`createdAt\`, \`updatedAt\`
      ) VALUES (?, 'BEGELEIDING', 'GEPLAND', ?, ?, ?, ?, ?, 'Scope snapshot test', CURRENT_TIMESTAMP(3), 'NOT_SYNCED', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      interventionId,
      user.id,
      user.id,
      user.id,
      user.teamId,
      user.country
    );

    await ensureCriterionSnapshotsForIntervention(prisma, interventionId, user.id);
    const firstSnapshots = await listCriterionSnapshotsForInterventions([interventionId]);
    await ensureCriterionSnapshotsForIntervention(prisma, interventionId, user.id);
    const secondSnapshots = await listCriterionSnapshotsForInterventions([interventionId]);

    expect(firstSnapshots.length > 0, "Een nieuwe begeleiding moet criteriumsnapshots krijgen.");
    expect(
      secondSnapshots.length === firstSnapshots.length,
      "Een bestaande snapshot mag niet opnieuw berekend of verdubbeld worden."
    );

    console.log(
      `Configureerbare criteria gecontroleerd: ${applicable.length} toepasselijke testcriteria, ${firstSnapshots.length} snapshots.`
    );
  } finally {
    await prisma.$executeRawUnsafe("DELETE FROM `Intervention` WHERE `id` = ?", interventionId);
    await prisma.$executeRawUnsafe(
      "DELETE FROM `ConfigurableCriterion` WHERE `id` IN (?, ?)",
      criterionId,
      secondCriterionId
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
