export type SalesDayOperationalIndicatorStatus = "OK" | "ATTENTION" | "BLOCKED";

export type SalesDayPowerBiLink = {
  configured: boolean;
  label: string | null;
  href: string | null;
  updatedAt?: string | null;
};

export type SalesDayPowerBiLinkInput = {
  label?: string;
  href?: string | null;
};

export type SalesDayProductionReadinessCode =
  | "FEATURE_FLAGS_READY"
  | "RUNTIME_PROVIDER_READY"
  | "POWER_BI_LINK_READY"
  | "OPEN_RECONCILIATION_INCIDENTS"
  | "OPEN_OUTBOX_COMMANDS"
  | "MOCK_PROVIDER_DISABLED"
  | "REAL_ERP_ACCEPTANCE"
  | "UAT_SIGNOFF"
  | "MIGRATION_REHEARSAL"
  | "BACKUP_RESTORE_EXERCISE"
  | "MDM_DEVICE_LOSS_EXERCISE";

export type SalesDayProductionReadinessStatus = "PASS" | "WARN" | "FAIL" | "EXTERNAL";

export type SalesDayProductionReadinessCheck = {
  code: SalesDayProductionReadinessCode;
  status: SalesDayProductionReadinessStatus;
  label: string;
  detail: string;
};

export type SalesDayProductionReadinessInput = {
  salesdayFeatureEnabled: boolean;
  inventoryFeatureEnabled: boolean;
  offlineCommandsEnabled: boolean;
  erpWritesEnabled: boolean;
  runtimeProvider: "MOCK" | "BC_NAV" | "ODOO";
  powerBiConfigured: boolean;
  openIncidentCount: number;
  openOutboxCommandCount: number;
  runtimeEnvironment?: string;
  externalEvidence?: Partial<Record<"realErp" | "uat" | "migration" | "backupRestore" | "mdmDeviceLoss", boolean>>;
};

const allowedPowerBiHosts = new Set([
  "app.powerbi.com",
  "powerbi.microsoft.com",
]);

export function normalizeSalesDayPowerBiLink(input: SalesDayPowerBiLinkInput): SalesDayPowerBiLink {
  const href = input.href?.trim() || null;
  if (!href) return { configured: false, label: null, href: null };
  const url = parseHttpsUrl(href);
  if (!isAllowedPowerBiHost(url.hostname)) {
    throw new Error("Power BI-link moet naar een toegelaten Microsoft Power BI host verwijzen.");
  }
  return {
    configured: true,
    label: normalizePowerBiLabel(input.label),
    href: url.toString(),
  };
}

export function parseSalesDayPowerBiSetting(value: string | null | undefined): SalesDayPowerBiLink {
  if (!value) return { configured: false, label: null, href: null };
  try {
    const parsed = JSON.parse(value) as SalesDayPowerBiLinkInput & { updatedAt?: string | null };
    return {
      ...normalizeSalesDayPowerBiLink(parsed),
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { configured: false, label: null, href: null };
  }
}

export function serializeSalesDayPowerBiSetting(input: SalesDayPowerBiLinkInput, now = new Date()) {
  const normalized = normalizeSalesDayPowerBiLink(input);
  return JSON.stringify({ ...normalized, updatedAt: now.toISOString() });
}

export function evaluateSalesDayProductionReadiness(input: SalesDayProductionReadinessInput): SalesDayProductionReadinessCheck[] {
  const production = input.runtimeEnvironment === "production";
  return [
    {
      code: "FEATURE_FLAGS_READY",
      status: input.salesdayFeatureEnabled && input.inventoryFeatureEnabled && input.offlineCommandsEnabled && input.erpWritesEnabled ? "PASS" : "FAIL",
      label: "SalesDay feature flags",
      detail: "SALESDAY, INVENTORY, OFFLINE_COMMANDS en ERP_WRITES moeten bewust geactiveerd zijn voor de pilootscope.",
    },
    {
      code: "RUNTIME_PROVIDER_READY",
      status: input.runtimeProvider === "MOCK" ? "FAIL" : "PASS",
      label: "ERP runtime provider",
      detail: "De productie-runtime mag niet op de mock-adapter staan.",
    },
    {
      code: "POWER_BI_LINK_READY",
      status: input.powerBiConfigured ? "PASS" : "WARN",
      label: "Power BI-link",
      detail: "Een veilige Power BI-link is voldoende; embedding blijft buiten scope tot apart goedgekeurd.",
    },
    {
      code: "OPEN_RECONCILIATION_INCIDENTS",
      status: input.openIncidentCount === 0 ? "PASS" : "FAIL",
      label: "Open reconciliation incidents",
      detail: `${input.openIncidentCount} open incident(en) moeten opgelost zijn voor productieactivatie.`,
    },
    {
      code: "OPEN_OUTBOX_COMMANDS",
      status: input.openOutboxCommandCount === 0 ? "PASS" : "WARN",
      label: "Open ERP outbox",
      detail: `${input.openOutboxCommandCount} commando('s) staan nog niet terminal ACK/REJECTED.`,
    },
    {
      code: "MOCK_PROVIDER_DISABLED",
      status: production && input.runtimeProvider === "MOCK" ? "FAIL" : "PASS",
      label: "Mockdata in productie",
      detail: "Productie mag geen mock businessdata of mock adapter activeren.",
    },
    externalCheck("REAL_ERP_ACCEPTANCE", "Real ERP end-to-end", "Elke command/event type moet tegen de echte ERP-testtenant bewezen zijn.", input.externalEvidence?.realErp),
    externalCheck("UAT_SIGNOFF", "All-country UAT sign-off", "Elke landengroep moet de acceptatiescenario's formeel aftekenen.", input.externalEvidence?.uat),
    externalCheck("MIGRATION_REHEARSAL", "Migration rehearsal", "Forward-compatible migratie en rollback moeten gerepeteerd zijn.", input.externalEvidence?.migration),
    externalCheck("BACKUP_RESTORE_EXERCISE", "Backup/restore exercise", "Backup en restore moeten met SalesDay-data getest zijn.", input.externalEvidence?.backupRestore),
    externalCheck("MDM_DEVICE_LOSS_EXERCISE", "Device-loss exercise", "MDM lock/wipe, toestelintrekking en herbootstrap moeten bewezen zijn.", input.externalEvidence?.mdmDeviceLoss),
  ];
}

export function summarizeReadiness(checks: SalesDayProductionReadinessCheck[]) {
  if (checks.some((check) => check.status === "FAIL")) return "BLOCKED" as const;
  if (checks.some((check) => check.status === "WARN" || check.status === "EXTERNAL")) return "ATTENTION" as const;
  return "OK" as const;
}

function externalCheck(
  code: SalesDayProductionReadinessCode,
  label: string,
  detail: string,
  evidence?: boolean,
): SalesDayProductionReadinessCheck {
  return { code, label, detail, status: evidence ? "PASS" : "EXTERNAL" };
}

function normalizePowerBiLabel(value?: string) {
  const label = value?.trim() || "Power BI";
  return label.slice(0, 120);
}

function parseHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Power BI-link is geen geldige URL.");
  }
  if (url.protocol !== "https:") throw new Error("Power BI-link moet HTTPS gebruiken.");
  url.hash = "";
  return url;
}

function isAllowedPowerBiHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return allowedPowerBiHosts.has(normalized) || normalized.endsWith(".powerbi.com");
}
