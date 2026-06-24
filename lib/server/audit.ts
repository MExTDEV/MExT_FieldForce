import { prisma } from "@/lib/server/db";

export type AuditInput = {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    const userId = await resolveAuditUserId(input.actorId);
    if (!userId) return;
    await prisma.auditLog.create({
      data: {
        userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
        newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
      },
    });
  } catch (error) {
    console.error("[audit]", error);
  }
}

export async function writeAuditLogs(inputs: AuditInput[]) {
  for (const input of inputs) {
    await writeAuditLog(input);
  }
}

async function resolveAuditUserId(actorId?: string | null) {
  if (actorId) {
    const actor = await prisma.user.findFirst({
      where: { OR: [{ id: actorId }, { representativeId: actorId }] },
      select: { id: true },
    });
    if (actor) return actor.id;
  }
  const fallback = await prisma.user.findFirst({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return fallback?.id;
}
