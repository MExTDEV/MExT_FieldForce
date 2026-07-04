import assert from "node:assert/strict";
import { prisma } from "../lib/server/db";
import { listEffectiveActionDefinitions, saveActionDefinition } from "../lib/server/action-definitions";
import { sanitizeRichText } from "../lib/rich-text";
import type { MockUser } from "../lib/types";

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { active: true, role: "SUPER_ADMIN" } });
  const participant = await prisma.user.findFirstOrThrow({ where: { active: true, role: "REPRESENTATIVE", teamId: { not: null } } });
  const actor: MockUser = { id: admin.id, name: `${admin.firstName} ${admin.lastName}`, email: admin.email, role: admin.role, country: admin.country, language: admin.language };
  const suffix = Date.now().toString(36);
  const definition = await saveActionDefinition(actor, {
    title: `Test actie ${suffix}`, description: "Scope test", tipsAndTricks: "<b>Doe dit</b>", targetValue: 80,
    priority: "hoog", scope: "GLOBAL", validFrom: "2026-01-01",
  });
  try {
    await prisma.actionTargetOverride.create({ data: {
      actionDefinitionId: definition.id, scope: "USER", scopeKey: `USER:${participant.id}`,
      userId: participant.id, country: participant.country, teamId: participant.teamId, targetValue: 98,
    } });
    const effective = await listEffectiveActionDefinitions(participant.id, new Date("2026-07-03T12:00:00Z"));
    const selected = effective.find((item) => item.id === definition.id);
    assert.equal(selected?.targetValue, 98, "De meest specifieke targetoverride moet winnen.");
    assert.equal(selected?.priority, "hoog");
    assert.equal(sanitizeRichText('<b onclick="x()">ok</b><script>alert(1)</script>'), "<b>ok</b>");
  } finally {
    await prisma.actionDefinition.delete({ where: { id: definition.id } });
    await prisma.$disconnect();
  }
  console.log("Coachingactie-scope, targetoverride en rich-textsanitatie getest.");
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
