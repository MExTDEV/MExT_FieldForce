import { salesDayNotificationTypes } from "@/lib/salesday/runtime-configuration";
import type { SalesErpMockDataset } from "@/lib/server/integrations/sales-erp/fixtures";
import type { SalesErpCountryCode } from "@/lib/server/integrations/sales-erp/contracts";

export type SalesDayMockUatSeedDatabaseInfo = {
  scheme: string;
  host: string;
  database: string;
};

export type SalesDayMockUatSeedGuardInput = {
  databaseUrl?: string;
  nodeEnv?: string;
  appEnv?: string;
  allowNonTestDatabase?: boolean;
  allowProductionMock?: boolean;
};

export type SalesDayMockUatRepresentative = {
  id: string;
  representativeExternalId: string;
  country: SalesErpCountryCode;
  teamExternalId?: string | null;
};

const safeDatabaseNamePattern = /(test|uat|dev|demo|mock|sandbox|local)/i;

export function parseSalesDayMockUatDatabaseUrl(databaseUrl: string | undefined): SalesDayMockUatSeedDatabaseInfo | null {
  if (!databaseUrl) return null;
  try {
    const parsed = new URL(databaseUrl);
    return {
      scheme: parsed.protocol.replace(/:$/, ""),
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\/+/, ""),
    };
  } catch {
    return null;
  }
}

export function isSalesDayMockUatDatabaseNameAllowed(databaseName: string) {
  return safeDatabaseNamePattern.test(databaseName);
}

export function assertSalesDayMockUatSeedAllowed(input: SalesDayMockUatSeedGuardInput) {
  if ((input.nodeEnv === "production" || input.appEnv === "production") && !input.allowProductionMock) {
    throw new Error("SalesDay mock/UAT seed is forbidden in production runtime.");
  }

  const info = parseSalesDayMockUatDatabaseUrl(input.databaseUrl);
  if (!info?.database) {
    throw new Error("SalesDay mock/UAT seed requires a valid DATABASE_URL.");
  }
  if (!isSalesDayMockUatDatabaseNameAllowed(info.database) && !input.allowNonTestDatabase) {
    throw new Error(
      `SalesDay mock/UAT seed refused database '${info.database}'. ` +
      "Use a database name containing test, uat, dev, demo, mock, sandbox or local.",
    );
  }
  return info;
}

export function buildSalesDayMockUatDatasetForRepresentatives(
  dataset: SalesErpMockDataset,
  representatives: readonly SalesDayMockUatRepresentative[],
): SalesErpMockDataset {
  const result: SalesErpMockDataset = {
    articles: structuredClone(dataset.articles),
    appointmentOutcomeReasons: structuredClone(dataset.appointmentOutcomeReasons),
    documentCategories: structuredClone(dataset.documentCategories),
    paymentMethods: structuredClone(dataset.paymentMethods),
    customers: [],
    appointments: [],
    commercialHistory: [],
    replenishments: [],
    cashBalances: [],
    customerLocations: [],
    carrierBalances: [],
  };

  for (const representative of representatives) {
    const suffix = mockSeedSuffix(representative.id);
    const sourceCustomers = dataset.customers.filter((item) => item.scope.country === representative.country);
    const customerIds = new Map(sourceCustomers.map((item) => [item.externalId, suffixed(item.externalId, suffix)]));
    const sourceLocations = dataset.customerLocations.filter((item) => customerIds.has(item.customerExternalId));
    const locationIds = new Map(sourceLocations.map((item) => [item.externalId, suffixed(item.externalId, suffix)]));

    result.customers.push(...sourceCustomers.map((item) => ({
      ...structuredClone(item),
      externalId: customerIds.get(item.externalId)!,
      scope: {
        ...item.scope,
        representativeExternalId: representative.representativeExternalId,
        teamExternalId: representative.teamExternalId ?? item.scope.teamExternalId,
      },
      contacts: item.contacts.map((contact) => ({
        ...structuredClone(contact),
        externalId: suffixed(contact.externalId, suffix),
      })),
      addresses: item.addresses.map((address) => ({
        ...structuredClone(address),
        externalId: suffixed(address.externalId, suffix),
      })),
    })));
    result.appointments.push(...dataset.appointments
      .filter((item) => item.country === representative.country && customerIds.has(item.customerExternalId))
      .map((item) => ({
        ...structuredClone(item),
        externalId: suffixed(item.externalId, suffix),
        customerExternalId: customerIds.get(item.customerExternalId)!,
        representativeExternalId: representative.representativeExternalId,
        teamExternalId: representative.teamExternalId ?? item.teamExternalId,
      })));
    result.commercialHistory.push(...dataset.commercialHistory
      .filter((item) => customerIds.has(item.customerExternalId))
      .map((item) => ({
        ...structuredClone(item),
        externalId: suffixed(item.externalId, suffix),
        documentNumber: suffixed(item.documentNumber, suffix),
        customerExternalId: customerIds.get(item.customerExternalId)!,
        representativeExternalId: representative.representativeExternalId,
      })));
    result.replenishments.push(...dataset.replenishments
      .filter((item) => item.country === representative.country)
      .map((item) => ({
        ...structuredClone(item),
        externalId: suffixed(item.externalId, suffix),
        shipmentNumber: suffixed(item.shipmentNumber, suffix),
        representativeExternalId: representative.representativeExternalId,
        lines: item.lines.map((line) => ({
          ...structuredClone(line),
          externalId: suffixed(line.externalId, suffix),
        })),
      })));
    const cashBalance = dataset.cashBalances.find((item) => item.country === representative.country);
    if (cashBalance) {
      result.cashBalances.push({
        ...structuredClone(cashBalance),
        externalId: suffixed(cashBalance.externalId, suffix),
        representativeExternalId: representative.representativeExternalId,
      });
    }
    result.customerLocations.push(...sourceLocations.map((item) => ({
      ...structuredClone(item),
      externalId: locationIds.get(item.externalId)!,
      customerExternalId: customerIds.get(item.customerExternalId)!,
      parentLocationExternalId: item.parentLocationExternalId
        ? locationIds.get(item.parentLocationExternalId)
        : undefined,
    })));
    result.carrierBalances.push(...dataset.carrierBalances
      .filter((item) => locationIds.has(item.carrierExternalId))
      .map((item) => ({
        ...structuredClone(item),
        externalId: suffixed(item.externalId, suffix),
        carrierExternalId: locationIds.get(item.carrierExternalId)!,
      })));
  }

  return result;
}

export function moveSalesDayMockUatAppointmentsToBusinessDate(
  dataset: SalesErpMockDataset,
  businessDate: string,
): SalesErpMockDataset {
  const sourceDates = [...new Set(dataset.appointments.map((item) => item.businessDate))].sort();
  const nextDate = nextWeekday(businessDate);
  const dateMap = new Map<string, string>([
    [sourceDates[0] ?? businessDate, businessDate],
    [sourceDates[1] ?? nextDate, nextDate],
  ]);
  return {
    ...structuredClone(dataset),
    appointments: dataset.appointments.map((item) => {
      const targetDate = dateMap.get(item.businessDate) ?? businessDate;
      return {
        ...structuredClone(item),
        businessDate: targetDate,
        startsAt: replaceIsoDate(item.startsAt, targetDate),
        endsAt: replaceIsoDate(item.endsAt, targetDate),
      };
    }),
  };
}

export function copySalesDayMockUatAppointmentsToBusinessDates(
  dataset: SalesErpMockDataset,
  businessDates: readonly string[],
): SalesErpMockDataset {
  const uniqueDates = [...new Set(businessDates)].sort();
  if (!uniqueDates.length) return structuredClone(dataset);

  const sequenceByRepresentativeAndDate = new Map<string, number>();
  return {
    ...structuredClone(dataset),
    appointments: uniqueDates.flatMap((targetDate) => dataset.appointments.map((item) => {
      const key = `${item.representativeExternalId}:${targetDate}`;
      const sequence = (sequenceByRepresentativeAndDate.get(key) ?? 0) + 1;
      sequenceByRepresentativeAndDate.set(key, sequence);
      return {
        ...structuredClone(item),
        externalId: dated(item.externalId, targetDate),
        sourceVersion: dated(item.sourceVersion, targetDate),
        businessDate: targetDate,
        startsAt: replaceIsoDate(item.startsAt, targetDate),
        endsAt: replaceIsoDate(item.endsAt, targetDate),
        sequence,
      };
    })),
  };
}

function mockSeedSuffix(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function suffixed(value: string, suffix: string) {
  return `${value}-user-${suffix}`;
}

function dated(value: string, date: string) {
  return `${value}-date-${date.replaceAll("-", "")}`;
}

function replaceIsoDate(value: string | undefined, targetDate: string) {
  return value ? `${targetDate}${value.slice(10)}` : undefined;
}

function nextWeekday(date: string) {
  const next = new Date(`${date}T12:00:00.000Z`);
  do next.setUTCDate(next.getUTCDate() + 1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
  return next.toISOString().slice(0, 10);
}

export function buildSalesDayMockUatRuntimeConfiguration() {
  return {
    provider: "MOCK" as const,
    mockSeedEnabled: true,
    enabledNotifications: [...salesDayNotificationTypes],
  };
}

export function buildSalesDayMockUatSummary(dataset: SalesErpMockDataset) {
  const countries = Array.from(
    new Set<SalesErpCountryCode>(dataset.customers.map((customer) => customer.scope.country)),
  ).sort();
  const appointmentDates = [...new Set(dataset.appointments.map((appointment) => appointment.businessDate))].sort();
  const nonZeroCashBalances = dataset.cashBalances.filter((balance) => Number(balance.balance) !== 0);
  const requiredCountries: SalesErpCountryCode[] = ["BE", "NL", "DE"];
  return {
    countries,
    appointmentDates,
    counts: {
      customers: dataset.customers.length,
      appointments: dataset.appointments.length,
      articles: dataset.articles.length,
      commercialHistory: dataset.commercialHistory.length,
      replenishments: dataset.replenishments.length,
      cashBalances: dataset.cashBalances.length,
      paymentMethods: dataset.paymentMethods.length,
      customerLocations: dataset.customerLocations.length,
      carrierBalances: dataset.carrierBalances.length,
    },
    scenarios: {
      allCustomersAreDemo: dataset.customers.every((customer) => customer.isDemo),
      coversAllCountries: requiredCountries.every((country) => countries.includes(country)),
      hasTodayAndPreparationAppointments: appointmentDates.length >= 2,
      hasInvalidOrMissingVat: dataset.customers.some(
        (customer) => !customer.vatNumber || customer.billingValidation.status === "INVALID",
      ),
      hasNotCompletedAppointment: dataset.appointments.some((appointment) => appointment.status === "NOT_COMPLETED"),
      hasNonZeroCashBalance: nonZeroCashBalances.length > 0,
      hasCarrierStock: dataset.carrierBalances.length > 0,
      hasReplenishment: dataset.replenishments.length > 0,
    },
  };
}
