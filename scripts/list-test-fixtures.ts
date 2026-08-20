import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "example.invalid" } },
        { firstName: { startsWith: "Codex" } },
        { lastName: { startsWith: "Test" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      country: true,
      active: true,
      representativeId: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ country: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  const userIds = users.map((user) => user.id);
  const interventions = userIds.length
    ? await prisma.intervention.findMany({
        where: {
          OR: [
            { representativeId: { in: userIds } },
            { initiatorId: { in: userIds } },
            { ownerId: { in: userIds } },
          ],
        },
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          plannedAt: true,
          deletedAt: true,
          representativeId: true,
          initiatorId: true,
          ownerId: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const step9Remaining = await prisma.intervention.count({
    where: { id: { startsWith: "step9-" } },
  });

  console.log(JSON.stringify({
    result: "TEST_FIXTURE_INVENTORY",
    users,
    interventions,
    step9Remaining,
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
