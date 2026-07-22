import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma, type Country, type Language, type Role } from "@prisma/client";

import {
  assertSalesDayMockUatSeedAllowed,
  buildSalesDayMockUatDatasetForRepresentatives,
  buildSalesDayMockUatRuntimeConfiguration,
  buildSalesDayMockUatSummary,
  copySalesDayMockUatAppointmentsToBusinessDates,
  moveSalesDayMockUatAppointmentsToBusinessDate,
  type SalesDayMockUatRepresentative,
} from "../lib/salesday/mock-uat-seed";
import { salesDayFeatureKeys, salesDayFeatureScopeKey } from "../lib/salesday/feature-flags";
import { isSalesDayProductionMockModeEnabled } from "../lib/salesday/runtime-configuration";
import {
  SALES_ERP_SCHEMA_VERSION,
  salesErpMockDataset,
  salesErpMockUatScenario,
  type SalesErpBootstrapResource,
  type SalesErpEvent,
  type SalesErpMockDataset,
} from "../lib/server/integrations/sales-erp";

type SeedUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  country: Country;
  language: Language;
  teamId: string | null;
  representativeId: string | null;
};

type RepresentativeSeedUser = SeedUser & { role: "REPRESENTATIVE" };

const defaultAppointmentSeedDays = 30;
const maxAppointmentSeedDays = 90;

loadEnvironment();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includeBlockers = args.has("--include-blockers");
const allowNonTestDatabase =
  args.has("--allow-non-test-db") &&
  process.env.SALESDAY_UAT_SEED_ALLOW_NON_TEST_DATABASE === "true";
const allowProductionMock =
  args.has("--allow-production") &&
  isSalesDayProductionMockModeEnabled();
const businessDate = readBusinessDate(args);
const appointmentSeedDays = readAppointmentSeedDays(args);
const appointmentSeedDates = buildDailyDateWindow(businessDate, appointmentSeedDays);

async function main() {
  const databaseInfo = assertSalesDayMockUatSeedAllowed({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    appEnv: process.env.APP_ENV,
    allowNonTestDatabase,
    allowProductionMock,
  });
  const baseline = copySalesDayMockUatAppointmentsToBusinessDates(
    moveSalesDayMockUatAppointmentsToBusinessDate(salesErpMockDataset, businessDate),
    appointmentSeedDates,
  );
  if (dryRun) {
    console.log(JSON.stringify({
      mode: "dry-run",
      database: databaseInfo,
      allowProductionMock,
      includeBlockers,
      businessDate,
      appointmentSeedDays,
      appointmentSeedDates,
      summary: buildSalesDayMockUatSummary(baseline),
    }, null, 2));
    return;
  }

  const { prisma } = await import("../lib/server/db");
  const { applySalesDayReplicaEvent } = await import("../lib/server/salesday-business-relations");
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      orderBy: [{ country: "asc" }, { role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        country: true,
        language: true,
        teamId: true,
        representativeId: true,
      },
    });
    if (!users.length) throw new Error("System mock seed requires at least one active user.");
    const representatives = users.filter(isRepresentative);
    assertRepresentativeCoverage(users, representatives);
    const targets = representatives.map(toRepresentativeTarget);
    const fullDataset = withWalkthroughBalances(
      copySalesDayMockUatAppointmentsToBusinessDates(
        moveSalesDayMockUatAppointmentsToBusinessDate(
          buildSalesDayMockUatDatasetForRepresentatives(salesErpMockDataset, targets),
          businessDate,
        ),
        appointmentSeedDates,
      ),
    );
    const applied: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      await seedRuntimeAndFeatureFlags(tx, users);
      await seedSalesDocumentReasons(tx);
      await seedInventoryReasonsAndSettings(tx);
      await seedDocumentNumberBlocks(tx);
      await seedInventoryForUsers(tx, users, businessDate);
      await seedContractForUsers(tx, users);
      for (const resource of ["paymentMethods", "appointmentOutcomeReasons", "articles"] as const) {
        applied[resource] = await applyResource(tx, resource, fullDataset, applySalesDayReplicaEvent);
      }
    }, { timeout: 120_000 });

    const userResources: SalesErpBootstrapResource[] = [
      "customers",
      "appointments",
      "commercialHistory",
      "replenishments",
      "cashBalances",
      "customerLocations",
      "carrierBalances",
    ];
    for (const target of targets) {
      const dataset = withWalkthroughBalances(
        copySalesDayMockUatAppointmentsToBusinessDates(
          moveSalesDayMockUatAppointmentsToBusinessDate(
            buildSalesDayMockUatDatasetForRepresentatives(salesErpMockDataset, [target]),
            businessDate,
          ),
          appointmentSeedDates,
        ),
      );
      await prisma.$transaction(async (tx) => {
        for (const resource of userResources) {
          applied[resource] = (applied[resource] ?? 0) +
            await applyResource(tx, resource, dataset, applySalesDayReplicaEvent);
        }
      }, { timeout: 60_000 });
    }

    console.log(JSON.stringify({
      mode: "applied",
      database: databaseInfo,
      allowProductionMock,
      includeBlockers,
      businessDate,
      appointmentSeedDays,
      appointmentSeedDates,
      usersSeeded: users.length,
      representativesSeeded: representatives.length,
      applied,
      summary: buildSalesDayMockUatSummary(fullDataset),
      unavailableModules: {
        pst: "placeholder-without-persistent-domain-model",
        service: "placeholder-without-persistent-domain-model",
      },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function loadEnvironment() {
  for (const fileName of [".env", ".env.local"]) {
    const path = join(process.cwd(), fileName);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!match || match[1].startsWith("#")) continue;
      const [, key, raw] = match;
      const value = raw.trim().replace(/^[\'"]|[\'"]$/g, "");
      if (fileName === ".env.local" || process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function readBusinessDate(values: Set<string>) {
  const explicit = [...values].find((value) => value.startsWith("--business-date="))?.split("=")[1];
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readAppointmentSeedDays(values: Set<string>) {
  const explicit = [...values].find((value) => value.startsWith("--days="))?.split("=")[1];
  if (!explicit) return defaultAppointmentSeedDays;
  const parsed = Number(explicit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxAppointmentSeedDays) {
    throw new Error(`--days must be a whole number between 1 and ${maxAppointmentSeedDays}.`);
  }
  return parsed;
}

function buildDailyDateWindow(startDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function isRepresentative(user: SeedUser): user is RepresentativeSeedUser {
  return user.role === "REPRESENTATIVE";
}

function assertRepresentativeCoverage(users: readonly SeedUser[], representatives: readonly RepresentativeSeedUser[]) {
  const activeCountries = [...new Set(users.map((user) => user.country))];
  const representedCountries = new Set(representatives.map((user) => user.country));
  const missing = activeCountries.filter((country) => !representedCountries.has(country));
  if (missing.length) {
    throw new Error(
      `System mock seed requires an active Representative in every country with active users. Missing: ${missing.join(", ")}.`,
    );
  }
}

function toRepresentativeTarget(user: RepresentativeSeedUser): SalesDayMockUatRepresentative {
  return {
    id: user.id,
    representativeExternalId: user.representativeId ?? user.id,
    country: user.country,
    teamExternalId: user.teamId,
  };
}

function withWalkthroughBalances(dataset: SalesErpMockDataset): SalesErpMockDataset {
  if (includeBlockers) return dataset;
  return {
    ...dataset,
    cashBalances: dataset.cashBalances.map((balance) => ({
      ...balance,
      balance: "0.00",
      lastDepositConfirmedAt: `${businessDate}T07:00:00.000Z`,
    })),
  };
}

async function applyResource(
  tx: Prisma.TransactionClient,
  resource: SalesErpBootstrapResource,
  dataset: SalesErpMockDataset,
  apply: typeof import("../lib/server/salesday-business-relations").applySalesDayReplicaEvent,
) {
  let count = 0;
  for (const item of dataset[resource]) {
    await apply(tx, eventFor(resource, item));
    count += 1;
  }
  return count;
}

async function seedRuntimeAndFeatureFlags(tx: Prisma.TransactionClient, users: readonly SeedUser[]) {
  const value = JSON.stringify(buildSalesDayMockUatRuntimeConfiguration());
  await tx.appSetting.upsert({
    where: { key: "salesday.runtime.v1" },
    update: { value },
    create: { key: "salesday.runtime.v1", value },
  });
  const countries = [...new Set(users.map((user) => user.country))];
  for (const key of salesDayFeatureKeys) {
    await tx.salesDayFeatureFlag.upsert({
      where: { scopeKey: salesDayFeatureScopeKey(key, "GLOBAL") },
      update: { enabled: true },
      create: { key, scope: "GLOBAL", scopeKey: salesDayFeatureScopeKey(key, "GLOBAL"), enabled: true },
    });
    for (const country of countries) {
      await tx.salesDayFeatureFlag.upsert({
        where: { scopeKey: salesDayFeatureScopeKey(key, "COUNTRY", country) },
        update: { enabled: true, country },
        create: {
          key,
          scope: "COUNTRY",
          scopeKey: salesDayFeatureScopeKey(key, "COUNTRY", country),
          enabled: true,
          country,
        },
      });
    }
    for (const user of users) {
      await tx.salesDayFeatureFlag.upsert({
        where: { scopeKey: salesDayFeatureScopeKey(key, "USER", user.id) },
        update: { enabled: true, userId: user.id },
        create: {
          key,
          scope: "USER",
          scopeKey: salesDayFeatureScopeKey(key, "USER", user.id),
          enabled: true,
          userId: user.id,
        },
      });
    }
  }
}

async function seedSalesDocumentReasons(tx: Prisma.TransactionClient) {
  const reasons = [
    { kind: "OVERRIDE" as const, code: "CUSTOMER_CONFIRMED", labelNl: "Klant bevestigt afwijking", labelFr: "Client confirme l'?cart", labelDe: "Kunde best?tigt Abweichung", requiresComment: true, sortOrder: 10 },
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
    { kind: "ARCHIVE" as const, code: "CUSTOMER_REQUEST", labelNl: "Op vraag van klant", labelFr: "? la demande du client", labelDe: "Auf Kundenwunsch", requiresComment: true, sortOrder: 10 },
    { kind: "CARRIER_COUNT_DISCREPANCY" as const, code: "CUSTOMER_USED", labelNl: "Door klant gebruikt", labelFr: "Utilis? par le client", labelDe: "Vom Kunden verwendet", requiresComment: false, sortOrder: 10 },
    { kind: "RECEIPT_DISCREPANCY" as const, code: "DAMAGED", labelNl: "Beschadigd ontvangen", labelFr: "Re?u endommag?", labelDe: "Besch?digt erhalten", requiresComment: true, sortOrder: 10 },
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
      const externalId = `mock-system-number-block-${country.toLowerCase()}-${document.documentType.toLowerCase()}`;
      const existing = await tx.salesDocumentNumberBlock.findFirst({ where: { provider: "MOCK", externalId } });
      const data = {
        provider: "MOCK" as const,
        externalId,
        country,
        documentType: document.documentType,
        prefix: `${document.prefix}${country}-`,
        firstSequence: document.firstSequence,
        lastSequence: document.firstSequence + 9999,
        nextSequence: document.firstSequence,
        padding: 5,
        status: "ACTIVE" as const,
        sourceVersion: "mock-system-v1",
        sourceUpdatedAt: new Date(`${businessDate}T06:00:00.000Z`),
      };
      if (existing) await tx.salesDocumentNumberBlock.update({ where: { id: existing.id }, data });
      else await tx.salesDocumentNumberBlock.create({ data });
    }
  }
}

async function seedInventoryForUsers(tx: Prisma.TransactionClient, users: readonly SeedUser[], date: string) {
  const expiryDate = addDays(date, 120);
  const balances = [
    { articleExternalId: "mock-article-ehbo-001", unit: "ST", quantity: "4.000", lotNumber: "MOCK-EHBO-LIVE" },
    { articleExternalId: "mock-article-pleister-001", unit: "ST", quantity: "24.000", lotNumber: "MOCK-PLEISTER-LIVE" },
    { articleExternalId: "mock-article-handschoen-001", unit: "DOOS", quantity: "8.000", lotNumber: null },
  ];
  for (const user of users) {
    const systemKey = `mock-system:user:${user.id}:vehicle`;
    const location = await tx.inventoryLocation.upsert({
      where: { systemKey },
      update: {
        type: "REPRESENTATIVE_VEHICLE",
        country: user.country,
        representativeUserId: user.id,
        name: `Mockvoorraad ${user.firstName} ${user.lastName}`,
        archived: false,
      },
      create: {
        type: "REPRESENTATIVE_VEHICLE",
        provider: "MOCK",
        externalId: `mock-system-vehicle-${user.id}`,
        sourceVersion: "mock-system-v1",
        sourceUpdatedAt: new Date(`${date}T06:00:00.000Z`),
        systemKey,
        country: user.country,
        representativeUserId: user.id,
        name: `Mockvoorraad ${user.firstName} ${user.lastName}`,
      },
    });
    for (const balance of balances) {
      const balanceKey = `mock-system:${user.id}:${balance.articleExternalId}`;
      await tx.inventoryBalance.upsert({
        where: { balanceKey },
        update: {
          locationId: location.id,
          unit: balance.unit,
          quantity: balance.quantity,
          lotNumber: balance.lotNumber,
          expiryDate: balance.lotNumber ? new Date(`${expiryDate}T00:00:00.000Z`) : null,
          sourceVersion: "mock-system-v1",
        },
        create: {
          balanceKey,
          locationId: location.id,
          articleExternalId: balance.articleExternalId,
          unit: balance.unit,
          quantity: balance.quantity,
          lotNumber: balance.lotNumber,
          expiryDate: balance.lotNumber ? new Date(`${expiryDate}T00:00:00.000Z`) : null,
          sourceVersion: "mock-system-v1",
        },
      });
    }
  }
}

async function seedContractForUsers(tx: Prisma.TransactionClient, users: readonly SeedUser[]) {
  const mockModelId = "mock-system-contract-model-v1";
  const otherActiveModel = await tx.contractModelVersion.findFirst({
    where: { status: "ACTIVE", id: { not: mockModelId } },
    select: { id: true },
  });
  const modelStatus = otherActiveModel ? "DRAFT" as const : "ACTIVE" as const;
  const model = await tx.contractModelVersion.upsert({
    where: { id: mockModelId },
    update: {
      label: "Mock systeemtestmodel",
      status: modelStatus,
      sourceWorkbookVersion: "mock-system-v1",
      calculationEngineVersion: "contract-engine-v1",
      notes: "Fictief model voor gecontroleerde systeemtests.",
      activatedAt: modelStatus === "ACTIVE" ? new Date() : null,
    },
    create: {
      id: mockModelId,
      code: "MOCK-SYSTEM",
      label: "Mock systeemtestmodel",
      status: modelStatus,
      sourceFileName: "mock-system-contract.invalid.xlsx",
      sourceFileSha256: "1f4f0b243ac8db99f77a26f8a53b6235e8140a1f91b2ea12f99a15844080ffde",
      sourceWorkbookVersion: "mock-system-v1",
      calculationEngineVersion: "contract-engine-v1",
      notes: "Fictief model voor gecontroleerde systeemtests.",
      activatedAt: modelStatus === "ACTIVE" ? new Date() : null,
    },
  });
  await tx.contractTermRule.upsert({
    where: { modelVersionId_durationYears: { modelVersionId: model.id, durationYears: 3 } },
    update: { discountPercentage: "10.00", priceMultiplier: "1.0000", active: true, sortOrder: 10 },
    create: {
      modelVersionId: model.id,
      durationYears: 3,
      discountPercentage: "10.00",
      priceMultiplier: "1.0000",
      active: true,
      sortOrder: 10,
    },
  });
  const article = await tx.contractArticle.upsert({
    where: { articleNumber: "MOCK-CONTRACT-EHBO-001" },
    update: {
      stemNumber: "MOCK-CONTRACT-EHBO",
      descriptionNl: "Mock EHBO-servicepakket",
      descriptionFr: "Pack service premiers secours fictif",
      descriptionDe: "Mock-Erste-Hilfe-Servicepaket",
      unitPrice: "120.00",
      unitCost: "55.00",
      active: true,
      externalSource: "MOCK_SYSTEM_SEED",
      externalId: "mock-contract-ehbo-001",
      sourceModelVersionId: model.id,
    },
    create: {
      articleNumber: "MOCK-CONTRACT-EHBO-001",
      stemNumber: "MOCK-CONTRACT-EHBO",
      descriptionNl: "Mock EHBO-servicepakket",
      descriptionFr: "Pack service premiers secours fictif",
      descriptionDe: "Mock-Erste-Hilfe-Servicepaket",
      unitPrice: "120.00",
      unitCost: "55.00",
      unit: "pakket",
      vatRate: "21.00",
      active: true,
      externalSource: "MOCK_SYSTEM_SEED",
      externalId: "mock-contract-ehbo-001",
      sourceModelVersionId: model.id,
    },
  });

  for (const user of users) {
    const customerId = `mock-system-contract-customer-${user.id}`;
    const customer = await tx.contractCustomer.upsert({
      where: { id: customerId },
      update: {
        companyName: `Mockklant ${user.firstName} ${user.lastName}`,
        contactName: `${user.firstName} ${user.lastName}`,
        countryCode: user.country,
        preferredLanguage: user.language,
        ownerUserId: user.id,
        teamIdSnapshot: user.teamId,
        countrySnapshot: user.country,
        isDemo: true,
      },
      create: {
        id: customerId,
        companyName: `Mockklant ${user.firstName} ${user.lastName}`,
        contactName: `${user.firstName} ${user.lastName}`,
        email: `mock-contract-${user.id}@example.invalid`,
        phone: "+32000000000",
        address: "Voorbeeldstraat 1, 1000 Teststad",
        street: "Voorbeeldstraat",
        houseNumber: "1",
        postalCode: "1000",
        city: "Teststad",
        countryCode: user.country,
        preferredLanguage: user.language,
        ownerUserId: user.id,
        teamIdSnapshot: user.teamId,
        countrySnapshot: user.country,
        externalSource: "MOCK_SYSTEM_SEED",
        externalId: `mock-contract-customer-${user.id}`,
        isDemo: true,
      },
    });
    const calculationId = `mock-system-contract-calculation-${user.id}`;
    const calculation = await tx.contractCalculation.upsert({
      where: { id: calculationId },
      update: {
        name: `Mockberekening ${user.firstName} ${user.lastName}`,
        status: "DRAFT",
        customerId: customer.id,
        ownerUserId: user.id,
        teamIdSnapshot: user.teamId,
        countrySnapshot: user.country,
        customerLanguage: user.language,
        modelVersionId: model.id,
        durationYears: 3,
        discountPercentageSnapshot: "10.00",
        subtotal: "240.00",
        discountAmount: "24.00",
        annualPrice: "216.00",
        totalCost: "110.00",
      },
      create: {
        id: calculationId,
        calculationNumber: `MOCK-${user.id}`,
        name: `Mockberekening ${user.firstName} ${user.lastName}`,
        status: "DRAFT",
        customerId: customer.id,
        ownerUserId: user.id,
        teamIdSnapshot: user.teamId,
        countrySnapshot: user.country,
        customerLanguage: user.language,
        modelVersionId: model.id,
        durationYears: 3,
        discountPercentageSnapshot: "10.00",
        subtotal: "240.00",
        discountAmount: "24.00",
        annualPrice: "216.00",
        totalCost: "110.00",
      },
    });
    await tx.contractCalculationLine.upsert({
      where: { id: `mock-system-contract-line-${user.id}` },
      update: {
        calculationId: calculation.id,
        articleId: article.id,
        quantity: "2.000",
        unitPriceSnapshot: "120.0000",
        unitCostSnapshot: "55.0000",
        lineAmount: "240.00",
        lineCost: "110.00",
      },
      create: {
        id: `mock-system-contract-line-${user.id}`,
        calculationId: calculation.id,
        articleId: article.id,
        articleNumberSnapshot: article.articleNumber,
        stemNumberSnapshot: article.stemNumber,
        descriptionNlSnapshot: article.descriptionNl,
        descriptionFrSnapshot: article.descriptionFr,
        descriptionDeSnapshot: article.descriptionDe,
        quantity: "2.000",
        unitPriceSnapshot: "120.0000",
        unitCostSnapshot: "55.0000",
        lineAmount: "240.00",
        lineCost: "110.00",
        sortOrder: 0,
      },
    });
  }
}

function eventFor(
  resource: SalesErpBootstrapResource,
  item: SalesErpMockDataset[SalesErpBootstrapResource][number],
): SalesErpEvent {
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
    messageId: `mock-system-seed:${resource}:${item.externalId}`,
    eventType: eventTypeByResource[resource],
    entityExternalId: item.externalId,
    sourceVersion: item.sourceVersion,
    occurredAt: item.sourceUpdatedAt,
    payload: item,
  } as SalesErpEvent;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
