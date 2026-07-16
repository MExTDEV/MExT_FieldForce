import { readFileSync } from "node:fs";
import { prisma } from "../lib/server/db";
import {
  CONTRACT_CALCULATION_ENGINE_VERSION,
} from "../lib/contract/calculation-engine";
import {
  MEXT_CONTRACT_MODEL_CODE,
  parseMextAllInWorkbook,
} from "../lib/contract/importer/mext-all-in-2026";

async function main() {
  const workbookPath = process.argv[2] ?? process.env.CONTRACT_XLSM_PATH;
  if (!workbookPath) {
    throw new Error("Geef het pad naar Contractberkening_Tool_09062026_NL.xlsm mee.");
  }
  const actor = await prisma.user.findFirst({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!actor) throw new Error("Geen actieve Admin/Super Admin gevonden voor auditvelden.");
  const parsed = parseMextAllInWorkbook(readFileSync(workbookPath));
  await prisma.$transaction(async (tx) => {
    const model = await tx.contractModelVersion.upsert({
      where: { sourceFileSha256: parsed.sourceFileSha256 },
      update: {
        status: "ACTIVE",
        activatedAt: new Date(),
        activatedByUserId: actor.id,
      },
      create: {
        code: MEXT_CONTRACT_MODEL_CODE,
        label: `MExT All-In ${parsed.sourceWorkbookVersion ?? "2026"}`,
        status: "ACTIVE",
        sourceFileName: workbookPath.split(/[\\/]/).pop() ?? "Contractberekening.xlsm",
        sourceFileSha256: parsed.sourceFileSha256,
        sourceWorkbookVersion: parsed.sourceWorkbookVersion,
        calculationEngineVersion: CONTRACT_CALCULATION_ENGINE_VERSION,
        activatedAt: new Date(),
        activatedByUserId: actor.id,
        importedByUserId: actor.id,
        termRules: {
          create: parsed.termRules.map((rule, index) => ({ ...rule, sortOrder: index })),
        },
      },
    });
    await tx.contractModelVersion.updateMany({
      where: { id: { not: model.id }, status: "ACTIVE" },
      data: { status: "INACTIVE" },
    });
    for (const article of parsed.articles) {
      await tx.contractArticle.upsert({
        where: { articleNumber: article.articleNumber },
        update: {
          stemNumber: article.stemNumber,
          descriptionNl: article.descriptionNl,
          descriptionFr: article.descriptionFr,
          descriptionDe: article.descriptionDe,
          unitPrice: article.unitPrice,
          unitCost: article.unitCost,
          active: true,
          externalSource: "excel",
          externalId: article.articleNumber,
          lastSyncedAt: new Date(),
          sourceModelVersionId: model.id,
        },
        create: {
          articleNumber: article.articleNumber,
          stemNumber: article.stemNumber,
          descriptionNl: article.descriptionNl,
          descriptionFr: article.descriptionFr,
          descriptionDe: article.descriptionDe,
          unitPrice: article.unitPrice,
          unitCost: article.unitCost,
          externalSource: "excel",
          externalId: article.articleNumber,
          lastSyncedAt: new Date(),
          sourceModelVersionId: model.id,
        },
      });
    }
    await tx.contractImportRun.upsert({
      where: { id: `initial-${parsed.sourceFileSha256.slice(0, 16)}` },
      update: { status: "IMPORTED", modelVersionId: model.id, foundArticles: parsed.articles.length, finishedAt: new Date() },
      create: {
        id: `initial-${parsed.sourceFileSha256.slice(0, 16)}`,
        status: "IMPORTED",
        sourceFileName: workbookPath.split(/[\\/]/).pop() ?? "Contractberekening.xlsm",
        sourceFileSha256: parsed.sourceFileSha256,
        sourceWorkbookVersion: parsed.sourceWorkbookVersion,
        modelVersionId: model.id,
        startedByUserId: actor.id,
        finishedAt: new Date(),
        foundArticles: parsed.articles.length,
        newArticles: parsed.articles.length,
      },
    });
  }, { maxWait: 10_000, timeout: 60_000 });
  console.log(`Contractcatalogus geïmporteerd: ${parsed.articles.length} artikelen (${parsed.sourceWorkbookVersion}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
