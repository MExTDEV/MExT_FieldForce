import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  const [interventions, helpRequests, criteria] = await Promise.all([
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
  ]);

  assert.ok(interventions.length >= 8, "Expected at least two STEP9 runs with four interventions each.");
  assert.ok(helpRequests.length >= 2, "Expected STEP9 help requests.");
  assert.ok(criteria.length >= 2, "Expected STEP9 personal criteria.");

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

  const report = [];
  for (const [runId, records] of groupedRuns) {
    const coaching = records.find((item) => item.type === "BEGELEIDING");
    const contact = records.find((item) => item.type === "CONTACTMOMENT");
    const retraining = records.find((item) => item.type === "RETRAINING");
    const salesTraining = records.find((item) => item.type === "SALES_TRAINING");
    const help = helpRequests.find((item) => item.subject.includes(runId));
    const criterion = criteria.find((item) => item.id.startsWith(runId));

    assert.ok(coaching, `${runId}: coaching missing.`);
    assert.ok(contact, `${runId}: contact moment missing.`);
    assert.ok(retraining, `${runId}: retraining missing.`);
    assert.ok(salesTraining, `${runId}: sales training missing.`);
    assert.ok(help, `${runId}: help request missing.`);
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
    assert.equal(coaching.notifyRepresentative, true);
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

    assert.equal(contact.status, "AFGESLOTEN");
    assert.ok(contact.contactMoment, `${runId}: contact detail missing.`);
    assert.match(contact.contactMoment.reason, /bijgewerkt/);

    assert.equal(retraining.status, "GEPLAND");
    assert.ok(retraining.trainingDetail, `${runId}: retraining detail missing.`);
    assert.match(retraining.trainingDetail.theme, /bijgewerkt/);

    assert.equal(salesTraining.status, "GEPLAND");
    assert.ok(salesTraining.trainingDetail, `${runId}: sales training detail missing.`);
    assert.match(salesTraining.trainingDetail.theme, /bijgewerkt/);
    assert.ok(salesTraining.trainingParticipants.length >= 1);

    assert.equal(help.status, "IN_BEHANDELING");
    assert.match(help.subject, /bijgewerkt/);
    assert.equal(help.representative.id, coaching.representativeId);

    assert.equal(criterion.active, true);
    assert.match(criterion.title, /bijgewerkt/);
    assert.equal(criterion.representativeId, coaching.representativeId);
    assert.ok(
      criterion.createdBy.email,
      `${runId}: personal criterion creator relation missing.`
    );

    for (const record of [...records, help, criterion]) {
      assert.ok(record.updatedAt.getTime() >= record.createdAt.getTime());
    }

    const runEntityIds = [
      ...records.map((item) => item.id),
      help.id,
      criterion.id,
    ];
    const runAudits = auditLogs.filter((log) => runEntityIds.includes(log.entityId));
    assert.ok(runAudits.length >= 11, `${runId}: expected create/update audit records.`);

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
      helpRequest: {
        id: help.id,
        status: help.status,
        subject: help.subject,
      },
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
