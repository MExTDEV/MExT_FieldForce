import { salesDayNotificationTypes } from "@/lib/salesday/runtime-configuration";
import type { SalesErpMockDataset } from "@/lib/server/integrations/sales-erp/fixtures";

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
  if (input.nodeEnv === "production" || input.appEnv === "production") {
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

export function buildSalesDayMockUatRuntimeConfiguration() {
  return {
    provider: "MOCK" as const,
    mockSeedEnabled: true,
    enabledNotifications: [...salesDayNotificationTypes],
  };
}

export function buildSalesDayMockUatSummary(dataset: SalesErpMockDataset) {
  const countries = [...new Set(dataset.customers.map((customer) => customer.scope.country))].sort();
  const appointmentDates = [...new Set(dataset.appointments.map((appointment) => appointment.businessDate))].sort();
  const nonZeroCashBalances = dataset.cashBalances.filter((balance) => Number(balance.balance) !== 0);
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
      coversAllCountries: ["BE", "NL", "DE"].every((country) => countries.includes(country)),
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
