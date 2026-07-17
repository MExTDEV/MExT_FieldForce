import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { Prisma, type Country } from "@prisma/client";

import {
  buildSalesDayMockUatRuntimeConfiguration,
  buildSalesDayMockUatSummary,
  assertSalesDayMockUatSeedAllowed,
} from "../lib/salesday/mock-uat-seed";
import { salesDayFeatureKeys, salesDayFeatureScopeKey } from "../lib/salesday/feature-flags";
import {
  SALES_ERP_SCHEMA_VERSION,
  buildSalesErpCommand,
  salesErpMockDataset,
  salesErpMockUatScenario,
  type SalesErpBootstrapResource,
  type SalesErpEvent,
  type SalesErpMockDataset,
} from "../lib/server/integrations/sales-erp";

type RepresentativeMapping = Record<string, { userId: string; representativeExternalId: string; teamExternalId?: string | null }>;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includeBlockers = args.has("--include-blockers");
const allowNonTestDatabase =
  args.has("--allow-non-test-db") &&
  process.env.SALESDAY_UAT_SEED_ALLOW_NON_TEST_DATABASE === "true";

loadEnvironment();

async function main() {
  const databaseInfo = assertSalesDayMockUatSeedAllowed({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    appEnv: process.env.APP_ENV,
    allowNonTestDatabase,
  });
  const summary = buildSalesDayMockUatSummary(salesErpMockDataset);
  if (dryRun) {
    console.log(JSON.stringify({ mode: "dry-run", database: databaseInfo, includeBlockers, summary }, null, 2));
    return;
  }

  const { prisma } = await import("../lib/server/db");
  const { applySalesDayReplicaEvent } = await import("../lib/server/salesday-business-relations");
  const { enqueueSalesErpCommand } = await import("../lib/server/integrations/sales-erp/ledger");

  const mapping = await resolveRepresentativeMapping(prisma);
  const dataset = includeBlockers
    ? remapDataset(salesErpMockDataset, mapping)
    : withoutBlockingBalances(remapDataset(salesErpMockDataset, mapping));

  const applied = await prisma.$transaction(async (tx) => {
    await seedRuntimeAndFeatureFlags(tx);
    await seedSalesDocumentReasons(tx);
    await seedInventoryReasonsAndSettings(tx);
    await seedDocumentNumberBlocks(tx);

    const resources: SalesErpBootstrapResource[] = [
      "paymentMethods",
      "appointmentOutcomeReasons",
      "articles",
      "customers",
      "appointments",
      "commercialHistory",
      "replenishments",
      "cashBalances",
      "customerLocations",
      "carrierBalances",
    ];
    const result: Record<string, number> = {};
    for (const resource of resources) {
      result[resource] = 0;
      for (const item of dataset[resource]) {
        await applySalesDayReplicaEvent(tx, eventFor(resource, item));
        result[resource] += 1;
      }
    }
    return result;
  }, { timeout: 60_000 });

  if (includeBlockers) {
    await enqueueOpenPreviousDayCommand(prisma, enqueueSalesErpCommand, mapping);
  }

  console.log(JSON.stringify({
    mode: "applied",
    database: databaseInfo,
    includeBlockers,
    applied,
    summary: buildSalesDayMockUatSummary(dataset),
  }, null, 2));

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function loadEnvironment() {
  for (const fileName of [".env", ".env.local"]) {
    const path = join(process.cwd(), fileName);
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!match || match[1].startsWith("#")) continue;
      const [, key, raw] = match;
      const value = raw.trim().replace(/^['"]|['"]$/g, "");
      if (fileName === ".env.local" || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

async function resolveRepresentativeMapping(prisma: Awaited<typeof import("../lib/server/db")>["prisma"]): Promise<RepresentativeMapping> {
  const countries = salesErpMockUatScenario.countries as readonly Country[];
  const representatives = await prisma.user.findMany({
    where: { role: "REPRESENTATIVE", active: true, country: { in: [...countries] } },
    orderBy: [{ country: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, representativeId: true, country: true, teamId: true },
  });
  const byCountry = new Map<Country, (typeof representatives)[number]>();
  for (const representative of representatives) {
    if (!byCountry.has(representative.country)) byCountry.set(representative.country, representative);
  }
  const missing = countries.filter((country) => !byCountry.has(country));
  if (missing.length) {
    throw new Error(
      `SalesDay mock/UAT seed requires one active real Representative per country. Missing: ${missing.join(", ")}.`,
    );
  }
  return Object.fromEntries(
    countries.map((country) => {
      const representative = byCountry.get(country)!;
      return [
        salesErpMockUatScenario.representativeExternalIds[country],
        {
          userId: representative.id,
          representativeExternalId: representative.representativeId ?? representative.id,
          teamExternalId: representative.teamId,
        },
      ];
    }),
  );
}

function remapDataset(dataset: SalesErpMockDataset, mapping: RepresentativeMapping): SalesErpMockDataset {
  const copy = structuredClone(dataset);
  for (const customer of copy.customers) {
    const mapped = customer.scope.representativeExternalId
      ? mapping[customer.scope.representativeExternalId]
      : undefined;
    if (mapped) {
      customer.scope.representativeExternalId = mapped.representativeExternalId;
      customer.scope.teamExternalId = mapped.teamExternalId ?? customer.scope.teamExternalId;
    }
  }
  for (const appointment of copy.appointments) {
    const mapped = mapping[appointment.representativeExternalId];
    if (mapped) {
      appointment.representativeExternalId = mapped.representativeExternalId;
      appointment.teamExternalId = mapped.teamExternalId ?? appointment.teamExternalId;
    }
  }
  for (const replenishment of copy.replenishments) {
    const mapped = mapping[replenishment.representativeExternalId];
    if (mapped) replenishment.representativeExternalId = mapped.representativeExternalId;
  }
  for (const balance of copy.cashBalances) {
    const mapped = mapping[balance.representativeExternalId];
    if (mapped) balance.representativeExternalId = mapped.representativeExternalId;
  }
  for (const document of copy.commercialHistory) {
    if (!document.representativeExternalId) continue;
    const mapped = mapping[document.representativeExternalId];
    if (mapped) document.representativeExternalId = mapped.representativeExternalId;
  }
  return copy;
}

function withoutBlockingBalances(dataset: SalesErpMockDataset): SalesErpMockDataset {
  return {
    ...dataset,
    cashBalances: dataset.cashBalances.map((balance) => ({
      ...balance,
      balance: "0.00",
      lastDepositConfirmedAt: "2026-07-13T07:00:00.000Z",
    })),
  };
}

async function seedRuntimeAndFeatureFlags(tx: Prisma.TransactionClient) {
  await tx.appSetting.upsert({
    where: { key: "salesday.runtime.v1" },
    update: { value: JSON.stringify(buildSalesDayMockUatRuntimeConfiguration()) },
    create: { key: "salesday.runtime.v1", value: JSON.stringify(buildSalesDayMockUatRuntimeConfiguration()) },
  });

  for (const key of salesDayFeatureKeys) {
    await tx.salesDayFeatureFlag.upsert({
      where: { scopeKey: salesDayFeatureScopeKey(key, "GLOBAL") },
      update: { enabled: true },
      create: { key, scope: "GLOBAL", scopeKey: salesDayFeatureScopeKey(key, "GLOBAL"), enabled: true },
    });
    for (const country of salesErpMockUatScenario.countries) {
      await tx.salesDayFeatureFlag.upsert({
        where: { scopeKey: salesDayFeatureScopeKey(key, "COUNTRY", country) },
        update: { enabled: true, country },
        create: { key, scope: "COUNTRY", scopeKey: salesDayFeatureScopeKey(key, "COUNTRY", country), enabled: true, country },
      });
    }
  }
}

async function seedSalesDocumentReasons(tx: Prisma.TransactionClient) {
  const reasons = [
    { kind: "OVERRIDE" as const, code: "CUSTOMER_CONFIRMED", labelNl: "Klant bevestigt afwijking", labelFr: "Client confirme l'ecart", labelDe: "Kunde bestaetigt Abweichung", requiresComment: true, sortOrder: 10 },
    { kind: "OVERRIDE" as const, code: "NO_STOCK", labelNl: "Onvoldoende voorraad", labelFr: "Stock insuffisant", labelDe: "Unzureichender Bestand", requiresComment: true, sortOrder: 20 },
    { kind: "UNSIGNED_EXCEPTION" as const, code: "CUSTOMER_REFUSED", labelNl: "Klant weigert te tekenen", labelFr: "Client refuse de signer", labelDe: "Kunde verweigert Unterschrift", requiresComment: true, sortOrder: 10 },
  ];
  for (const reason of reasons) {
    const existing = await tx.salesDocumentReason.findFirst({ where: { kind: reason.kind, code: reason.code, country: null } });
    if (existing) await tx.salesDocumentReason.update({ where: { id: existing.id }, data: reason });
    else await tx.salesDocumentReason.create({ data: reason });
  }
}

async function seedInventoryReasonsAndSettings(tx: Prisma.TransactionClient) {
  await tx.appSetting.upsert({
    where: { key: "inventory.settings.v1" },
    update: { value: JSON.stringify({ expiryWarningDays: 180 }) },
    create: { key: "inventory.settings.v1", value: JSON.stringify({ expiryWarningDays: 180 }) },
  });
  const reasons = [
    { kind: "ARCHIVE" as const, code: "CUSTOMER_REQUEST", labelNl: "Op vraag van klant", labelFr: "A la demande du client", labelDe: "Auf Kundenwunsch", requiresComment: true, sortOrder: 10 },
    { kind: "CARRIER_COUNT_DISCREPANCY" as const, code: "CUSTOMER_USED", labelNl: "Door klant gebruikt", labelFr: "Utilise par le client", labelDe: "Vom Kunden verwendet", requiresComment: false, sortOrder: 10 },
    { kind: "RECEIPT_DISCREPANCY" as const, code: "DAMAGED", labelNl: "Beschadigd ontvangen", labelFr: "Recu endommage", labelDe: "Beschaedigt erhalten", requiresComment: true, sortOrder: 10 },
  ];
  for (const reason of reasons) {
    const existing = await tx.inventoryReason.findFirst({ where: { kind: reason.kind, code: reason.code, country: null } });
    if (existing) await tx.inventoryReason.update({ where: { id: existing.id }, data: reason });
    else await tx.inventoryReason.create({ data: reason });
  }
}

async function seedDocumentNumberBlocks(tx: Prisma.TransactionClient) {
  const documents = [
    { documentType: "ORDER" as const, prefix: "MOCK-ORD-", firstSequence: 1000 },
    { documentType: "ORDER_ALREADY_DELIVERED" as const, prefix: "MOCK-DEL-", firstSequence: 2000 },
    { documentType: "INVOICE" as const, prefix: "MOCK-INV-", firstSequence: 3000 },
  ];
  for (const country of salesErpMockUatScenario.countries) {
    for (const document of documents) {
      const externalId = `mock-uat-number-block-${country.toLowerCase()}-${document.documentType.toLowerCase()}`;
      const existing = await tx.salesDocumentNumberBlock.findFirst({ where: { provider: "MOCK", externalId } });
      const data = {
        provider: "MOCK" as const,
        externalId,
        country,
        documentType: document.documentType,
        prefix: `${document.prefix}${country}-`,
        firstSequence: document.firstSequence,
        lastSequence: document.firstSequence + 499,
        nextSequence: document.firstSequence,
        padding: 5,
        status: "ACTIVE" as const,
        sourceVersion: "mock-uat-v1",
        sourceUpdatedAt: new Date("2026-07-17T08:00:00.000Z"),
      };
      if (existing) await tx.salesDocumentNumberBlock.update({ where: { id: existing.id }, data });
      else await tx.salesDocumentNumberBlock.create({ data });
    }
  }
}

function eventFor(resource: SalesErpBootstrapResource, item: SalesErpMockDataset[SalesErpBootstrapResource][number]): SalesErpEvent {
  const eventTypeByResource = {
    customers: "customer.upserted",
    appointments: "appointment.upserted",
    articles: "article.upserted",
    commercialHistory: "commercial-history.upserted",
    replenishments: "replenishment.upserted",
    cashBalances: "cash-balance.upserted",
    appointmentOutcomeReasons: "appointment-outcome-reason.upserted",
    documentCategories: "document-category.upserted",
    paymentMethods: "payment-method.upserted",
    customerLocations: "customer-location.upserted",
    carrierBalances: "carrier-balance.upserted",
  } as const;
  return {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    provider: "MOCK",
    messageId: `mock-uat-seed:${resource}:${item.externalId}`,
    eventType: eventTypeByResource[resource],
    entityExternalId: item.externalId,
    sourceVersion: item.sourceVersion,
    occurredAt: item.sourceUpdatedAt,
    payload: item,
  } as SalesErpEvent;
}

async function enqueueOpenPreviousDayCommand(
  prisma: Awaited<typeof import("../lib/server/db")>["prisma"],
  enqueueSalesErpCommand: typeof import("../lib/server/integrations/sales-erp/ledger").enqueueSalesErpCommand,
  mapping: RepresentativeMapping,
) {
  const deMapping = mapping[salesErpMockUatScenario.representativeExternalIds.DE];
  if (!deMapping) return;
  const representative = await prisma.user.findUnique({ where: { id: deMapping.userId } });
  if (!representative) return;
  const command = buildSalesErpCommand({
    commandId: "mock-uat-open-day-minus-one-command",
    issuedAt: "2026-07-16T18:00:00.000Z",
    commandType: "follow-up.create",
    businessKey: "mock-uat:blocker:day-minus-one",
    context: {
      actorUserId: representative.id,
      representativeExternalId: representative.representativeId ?? representative.id,
      deviceId: "mock-uat-device",
      country: representative.country,
      appointmentExternalId: "mock-appointment-de-today-001",
    },
    payload: {
      appointmentExternalId: "mock-appointment-de-today-001",
      localFollowUpId: "mock-uat-day-minus-one-follow-up",
      customerExternalId: "mock-customer-de-001",
      type: "UAT_BLOCKER",
      description: "Mock/UAT open dag-1 sync voor gate-test.",
    },
  });
  await enqueueSalesErpCommand({ provider: "MOCK", command, businessDate: salesErpMockUatScenario.generatedForBusinessDates.previousBusinessDate });
}
