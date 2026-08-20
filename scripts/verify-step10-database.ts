import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  const [interventions, helpRequests, criteria, modules] = await Promise.all([
    prisma.intervention.findMany({
      where: { id: { startsWith: "step9-" } },
      include: {
        representative: { select: { id: true, representativeId: true, email: true } },
        initiator: { select: { id: true, email: true } },
        owner: { select: { id: true, email: true } },
        contactMoment: true,
        coachingDetail: true,
        trainingDetail: true,
        focuses: { include: { focus: true } },
        scores: true,
        actionPoints: {
          include: {
            representative: { select: { id: true, representativeId: true } },
            owner: { select: { id: true, email: true } },
            assignments: true,
          },
        },
        trainingParticipants: {
          include: {
            representative: { select: { id: true, representativeId: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.helpRequest.findMany({
      where: { subject: { startsWith: "STEP9" } },
      include: {
        representative: { select: { id: true, representativeId: true, email: true } },
        requester: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.personalCoachingCriterion.findMany({
      where: { id: { startsWith: "step9-" } },
      include: {
        representative: { select: { id: true, representativeId: true, email: true } },
        createdBy: { select: { id: true, email: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.appModule.findMany({
      select: { code: true, actief: true },
    }),
  ]);

  const enabledModules = new Set(
    modules.filter((module) => module.actief).map((module) => module.code)
  );
  const expectedInterventionTypes = new Set([
    "BEGELEIDING",
    ...(enabledModules.has("CONTACTMOMENTEN") ? ["CONTACTMOMENT"] : []),
    ...(enabledModules.has("RETRAININGEN") ? ["RETRAINING"] : []),
    ...(enabledModules.has("SALESTRAININGEN") ? ["SALES_TRAINING"] : []),
  ]);

  const entityIds = [
    ...interventions.map((item) => item.id),
    ...helpRequests.map((item) => item.id),
    ...criteria.map((item) => item.id),
  ];
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityId: { in: entityIds } },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const groupedRuns = new Map<string, typeof interventions>();
  for (const intervention of interventions) {
    const match = intervention.id.match(/^(step9-\d{14})-/);
    assert.ok(match, `Unexpected STEP9 intervention id: ${intervention.id}`);
    const current = groupedRuns.get(match[1]) ?? [];
    current.push(intervention);
    groupedRuns.set(match[1], current);
  }

  const completeRuns = [...groupedRuns.entries()]
    .filter(([runId, records]) => {
      const persistedTypes = new Set<string>(records.map((item) => item.type));
      const hasExpectedInterventions = [...expectedInterventionTypes].every((type) => persistedTypes.has(type));
      const hasCriterion = criteria.some((item) => item.id.startsWith(runId));
      const hasHelpRequest = !enabledModules.has("HULPAANVRAGEN") ||
        helpRequests.some((item) => item.subject.includes(runId));
      return hasExpectedInterventions && hasCriterion && hasHelpRequest;
    })
    .sort(([left], [right]) => left.localeCompare(right));

  assert.ok(
    completeRuns.length >= 2,
    `Expected at least two complete STEP9 runs for active modules: ${[...enabledModules].join(", ")}.`
  );

  const report = [];
  for (const [runId, records] of completeRuns) {
    const coaching = records.find((item) => item.type === "BEGELEIDING");
    const contact = records.find((item) => item.type === "CONTACTMOMENT");
    const retraining = records.find((item) => item.type === "RETRAINING");
    const salesTraining = records.find((item) => item.type === "SALES_TRAINING");
    const help = helpRequests.find((item) => item.subject.includes(runId));
    const criterion = criteria.find((item) => item.id.startsWith(runId));

    assert.ok(coaching, `${runId}: coaching missing.`);
    if (enabledModules.has("CONTACTMOMENTEN")) assert.ok(contact, `${runId}: contact moment missing.`);
    if (enabledModules.has("RETRAININGEN")) assert.ok(retraining, `${runId}: retraining missing.`);
    if (enabledModules.has("SALESTRAININGEN")) assert.ok(salesTraining, `${runId}: sales training missing.`);
    if (enabledModules.has("HULPAANVRAGEN")) assert.ok(help, `${runId}: help request missing.`);
    assert.ok(criterion, `${runId}: personal criterion missing.`);

    assert.ok(
      [
        "GEPLAND",
        "IN_UITVOERING",
        "WACHT_OP_VT_INPUT",
        "WACHT_OP_VT",
        "WACHT_OP_AKKOORD",
        "GEFINALISEERD",
        "AFGESLOTEN",
        "GESLOTEN",
      ].includes(coaching.status),
      `${runId}: coaching has invalid persisted status ${coaching.status}.`
    );
    assert.equal(coaching.notifyRepresentative, false);
    assert.equal(coaching.focuses.length, 1);
    assert.ok(
      coaching.scores.some(
        (score) =>
          score.category === "Introductie" &&
          score.label === "Zichzelf en MExT voorstellen" &&
          score.score === 75
      ),
      `${runId}: expected coaching focus score missing.`
    );
    assert.ok(
      coaching.scores.some((score) => score.category?.startsWith("Dossier:")),
      `${runId}: dossier score rows missing.`
    );
    assert.equal(coaching.actionPoints.length, 1);
    assert.match(coaching.actionPoints[0].title, /bijgewerkt/);
    assert.equal(coaching.actionPoints[0].representativeId, coaching.representativeId);
    assert.ok(
      coaching.actionPoints[0].owner.email,
      `${runId}: action point owner relation missing.`
    );

    if (contact) {
      assert.equal(contact.status, "AFGESLOTEN");
      assert.ok(contact.contactMoment, `${runId}: contact detail missing.`);
      assert.match(contact.contactMoment.reason, /bijgewerkt/);
    }

    if (retraining) {
      assert.equal(retraining.status, "GEPLAND");
      assert.ok(retraining.trainingDetail, `${runId}: retraining detail missing.`);
      assert.match(retraining.trainingDetail.theme, /bijgewerkt/);
    }

    if (salesTraining) {
      assert.equal(salesTraining.status, "GEPLAND");
      assert.ok(salesTraining.trainingDetail, `${runId}: sales training detail missing.`);
      assert.match(salesTraining.trainingDetail.theme, /bijgewerkt/);
      assert.ok(salesTraining.trainingParticipants.length >= 1);
    }

    if (help) {
      assert.equal(help.status, "IN_BEHANDELING");
      assert.match(help.subject, /bijgewerkt/);
      assert.equal(help.representative.id, coaching.representativeId);
    }

    assert.equal(criterion.active, true);
    assert.match(criterion.title, /bijgewerkt/);
    assert.equal(criterion.representativeId, coaching.representativeId);
    assert.ok(
      criterion.createdBy.email,
      `${runId}: personal criterion creator relation missing.`
    );

    const relatedRecords = [criterion, ...(help ? [help] : [])];
    for (const record of [...records, ...relatedRecords]) {
      assert.ok(record.updatedAt.getTime() >= record.createdAt.getTime());
    }

    const runEntityIds = [
      ...records.map((item) => item.id),
      ...(help ? [help.id] : []),
      criterion.id,
    ];
    const runAudits = auditLogs.filter((log) => runEntityIds.includes(log.entityId));
    const expectedAuditRows = 4 +
      (contact ? 2 : 0) +
      (retraining ? 2 : 0) +
      (salesTraining ? 2 : 0) +
      (help ? 2 : 0);
    assert.ok(runAudits.length >= expectedAuditRows, `${runId}: expected create/update audit records.`);

    report.push({
      runId,
      representative: coaching.representative.representativeId ?? coaching.representative.id,
      actor: coaching.initiator.email,
      interventions: records.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      helpRequest: help ? {
        id: help.id,
        status: help.status,
        subject: help.subject,
      } : null,
      personalCriterion: {
        id: criterion.id,
        title: criterion.title,
        team: criterion.team.name,
      },
      actionPoint: {
        id: coaching.actionPoints[0].id,
        title: coaching.actionPoints[0].title,
        status: coaching.actionPoints[0].status,
      },
      auditRows: runAudits.length,
    });
  }

  console.log(JSON.stringify({
    result: "STEP10_DATABASE_VERIFICATION_PASSED",
    runs: report,
    totalAuditRows: auditLogs.length,
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
