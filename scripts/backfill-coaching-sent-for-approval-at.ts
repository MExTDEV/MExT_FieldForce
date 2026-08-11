import { prisma } from "../lib/server/db";
import { resolveCoachingApprovalSentForApprovalAt } from "../lib/coaching/approval-actions";

const shouldWrite = process.argv.includes("--write");

async function main() {
  const coachings = await prisma.intervention.findMany({
    where: {
      type: "BEGELEIDING",
      deletedAt: null,
      status: { in: ["VERZONDEN_TER_AKKOORD", "WACHT_OP_AKKOORD"] },
      sentForApprovalAt: null,
    },
    select: {
      id: true,
      approval: { select: { createdAt: true } },
    },
  });
  if (!coachings.length) {
    console.log("Geen pending begeleidingen zonder sentForApprovalAt gevonden.");
    return;
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Intervention",
      entityId: { in: coachings.map((item) => item.id) },
      action: "coaching.sent_for_approval",
    },
    orderBy: { createdAt: "desc" },
    select: {
      entityId: true,
      createdAt: true,
      action: true,
      newValue: true,
    },
  });
  const auditByIntervention = new Map<string, typeof auditLogs>();
  for (const audit of auditLogs) {
    const current = auditByIntervention.get(audit.entityId) ?? [];
    current.push(audit);
    auditByIntervention.set(audit.entityId, current);
  }

  let updated = 0;
  let unresolved = 0;
  for (const coaching of coachings) {
    const resolved = resolveCoachingApprovalSentForApprovalAt({
      auditTrail: (auditByIntervention.get(coaching.id) ?? []).map((entry) => ({
        at: entry.createdAt.toISOString(),
        action: entry.action,
        newValue: parseJsonObject(entry.newValue),
      })),
      approvalCreatedAt: coaching.approval?.createdAt,
    });
    if (!resolved) {
      unresolved += 1;
      console.log(`Geen betrouwbaar verzendmoment gevonden voor ${coaching.id}.`);
      continue;
    }
    if (shouldWrite) {
      await prisma.intervention.update({
        where: { id: coaching.id },
        data: { sentForApprovalAt: new Date(resolved) },
      });
    }
    updated += 1;
    console.log(`${shouldWrite ? "Bijgewerkt" : "Dry-run"} ${coaching.id}: ${resolved}`);
  }

  console.log(`${shouldWrite ? "Backfill" : "Dry-run"} klaar. Opgelost: ${updated}. Zonder betrouwbaar moment: ${unresolved}.`);
}

function parseJsonObject(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
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
