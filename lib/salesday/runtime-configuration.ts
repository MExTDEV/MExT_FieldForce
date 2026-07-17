import type { SalesErpProvider } from "@/lib/server/integrations/sales-erp/contracts";

export const salesDayNotificationTypes = [
  "APPOINTMENT_CHANGED",
  "PREPARATION_AVAILABLE",
  "SYNC_FAILED",
  "CASH_BLOCKED",
  "DOCUMENT_STATUS",
] as const;

export type SalesDayNotificationType = (typeof salesDayNotificationTypes)[number];

export type SalesDayRuntimeConfiguration = {
  provider: SalesErpProvider;
  mockSeedEnabled: boolean;
  enabledNotifications: SalesDayNotificationType[];
};

export class SalesDayRuntimeConfigurationError extends Error {
  constructor(
    readonly code: "CONFIGURATION_MISSING" | "CONFIGURATION_INVALID" | "PRODUCTION_MOCK_FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "SalesDayRuntimeConfigurationError";
  }
}

export function defaultSalesDayRuntimeConfiguration(
  runtimeEnvironment: string | undefined = process.env.NODE_ENV,
): SalesDayRuntimeConfiguration {
  if (runtimeEnvironment === "production") {
    throw new SalesDayRuntimeConfigurationError(
      "CONFIGURATION_MISSING",
      "SalesDay production runtime configuration must be stored explicitly",
    );
  }
  return {
    provider: "MOCK",
    mockSeedEnabled: true,
    enabledNotifications: [...salesDayNotificationTypes],
  };
}

export function parseSalesDayRuntimeConfiguration(
  value: string | null | undefined,
  runtimeEnvironment: string | undefined = process.env.NODE_ENV,
): SalesDayRuntimeConfiguration {
  if (!value) return defaultSalesDayRuntimeConfiguration(runtimeEnvironment);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new SalesDayRuntimeConfigurationError(
      "CONFIGURATION_INVALID",
      "SalesDay runtime configuration is not valid JSON",
    );
  }
  if (!isRecord(parsed)) {
    throw new SalesDayRuntimeConfigurationError(
      "CONFIGURATION_INVALID",
      "SalesDay runtime configuration must be an object",
    );
  }
  const provider = parsed.provider;
  const notifications = parsed.enabledNotifications;
  if (
    !["MOCK", "BC_NAV", "ODOO"].includes(String(provider)) ||
    typeof parsed.mockSeedEnabled !== "boolean" ||
    !Array.isArray(notifications) ||
    notifications.some((type) => !salesDayNotificationTypes.includes(String(type) as SalesDayNotificationType))
  ) {
    throw new SalesDayRuntimeConfigurationError(
      "CONFIGURATION_INVALID",
      "SalesDay runtime configuration contains unsupported values",
    );
  }
  const configuration: SalesDayRuntimeConfiguration = {
    provider: provider as SalesErpProvider,
    mockSeedEnabled: parsed.mockSeedEnabled,
    enabledNotifications: [...new Set(notifications as SalesDayNotificationType[])],
  };
  assertSalesDayRuntimeConfiguration(configuration, runtimeEnvironment);
  return configuration;
}

export function assertSalesDayRuntimeConfiguration(
  configuration: SalesDayRuntimeConfiguration,
  runtimeEnvironment: string | undefined = process.env.NODE_ENV,
) {
  if (
    runtimeEnvironment === "production" &&
    (configuration.provider === "MOCK" || configuration.mockSeedEnabled)
  ) {
    throw new SalesDayRuntimeConfigurationError(
      "PRODUCTION_MOCK_FORBIDDEN",
      "SalesDay mock provider and mock seed are disabled in production",
    );
  }
  return configuration;
}

export function assertSalesDayMockSeedAllowed(
  runtimeEnvironment: string | undefined = process.env.NODE_ENV,
) {
  if (runtimeEnvironment === "production") {
    throw new SalesDayRuntimeConfigurationError(
      "PRODUCTION_MOCK_FORBIDDEN",
      "SalesDay mock seed is disabled in production",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
