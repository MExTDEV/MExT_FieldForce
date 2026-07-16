import type { DeviceSyncQueueSummary } from "@/lib/device/sync-queue";

export type SalesDayServerDayGate = {
  businessDate: string;
  mode: "NORMAL" | "BLOCKED" | "EMERGENCY";
  reason: "NONE" | "DAY_MINUS_ONE_PENDING" | "EMERGENCY_ACTIVE";
  serverOpenPreviousCommandCount: number;
  oldestServerOpenBusinessDate: string | null;
  emergency: null | {
    id: string;
    reason: string;
    startsAt: string;
    endsAt: string;
  };
};

export type SalesDayEffectiveDayGate = SalesDayServerDayGate & {
  localOpenPreviousCommandCount: number;
  oldestLocalOpenBusinessDate: string | null;
};

export function combineSalesDayDayGate(
  server: SalesDayServerDayGate,
  local: Pick<DeviceSyncQueueSummary, "openBusinessDates">,
): SalesDayEffectiveDayGate {
  assertBusinessDate(server.businessDate);
  const previousDates = local.openBusinessDates.filter((date) => {
    assertBusinessDate(date);
    return date < server.businessDate;
  }).sort();
  if (server.mode === "EMERGENCY") {
    return {
      ...server,
      localOpenPreviousCommandCount: previousDates.length,
      oldestLocalOpenBusinessDate: previousDates[0] ?? null,
    };
  }
  const blocked = server.mode === "BLOCKED" || previousDates.length > 0;
  return {
    ...server,
    mode: blocked ? "BLOCKED" : "NORMAL",
    reason: blocked ? "DAY_MINUS_ONE_PENDING" : "NONE",
    localOpenPreviousCommandCount: previousDates.length,
    oldestLocalOpenBusinessDate: previousDates[0] ?? null,
  };
}

export function assertBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("businessDate moet YYYY-MM-DD gebruiken.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("businessDate is geen geldige kalenderdatum.");
  }
}

export function isSalesDayOperationalPathAllowedWhileBlocked(path: string) {
  const normalized = `/${path}`.replaceAll(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return normalized === "/salesday" ||
    normalized.startsWith("/salesday/sync") ||
    normalized.startsWith("/salesday/support");
}
