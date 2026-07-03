import assert from "node:assert/strict";
import { prisma } from "../lib/server/db";
import { listVisibleMyTeamMembers } from "../lib/server/my-team";
import type { MockUser } from "../lib/types";

async function main() {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["SALES_LEADER", "ADMIN", "SUPER_ADMIN"] } },
    orderBy: { role: "asc" },
  });
  let populatedLeaderTeamSeen = false;

  for (const user of users) {
    const actor: MockUser = {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      country: user.country,
      language: user.language,
      teamId: user.teamId ?? undefined,
      representativeId: user.representativeId ?? undefined,
    };
    const members = await listVisibleMyTeamMembers(actor);
    if (actor.role === "SALES_LEADER") {
      assert.ok(members.length > 0, "De verkoopleider moet minstens zichzelf zien.");
      if (members.length > 1) populatedLeaderTeamSeen = true;
      assert.ok(members.some((member) => member.id === actor.id && member.isTeamLeader), "De verkoopleider moet zichzelf bovenaan kunnen tonen.");
      assert.ok(members.every((member) => member.teamId === actor.teamId), "De verkoopleider mag alleen het eigen team zien.");
    }
    console.log(`${actor.role}: ${members.length} teamleden, ${new Set(members.map((member) => member.teamId)).size} teams`);
  }
  assert.ok(populatedLeaderTeamSeen, "Minstens één gevuld team moet leider en vertegenwoordiger(s) teruggeven.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
