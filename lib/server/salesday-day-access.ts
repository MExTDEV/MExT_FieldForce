import { ErpOutboxStatus } from "@prisma/client";

import type { MockUser } from "@/lib/types";
import { prisma } from "@/lib/server/db";
import { getSalesDayCashBlock } from "@/lib/server/salesday-cash";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { getActiveSalesDayEmergencyMode } from "@/lib/server/salesday-emergency-mode";
import { assertBusinessDate, type SalesDayServerDayGate } from "@/lib/salesday/day-access";

export async function getSalesDayServerDayGate(input: {
  actor: MockUser;
  loginSessionId: string | null;
  deviceId: string;
  businessDate: string;
  now?: Date;
}): Promise<SalesDayServerDayGate> {
  assertBusinessDate(input.businessDate);
  await requireActiveSalesDayDevice(input);
  const businessDate = new Date(`${input.businessDate}T00:00:00.000Z`);
  const [openPrevious, emergency, cashBlock] = await Promise.all([
    prisma.erpOutboxCommand.aggregate({
      where: {
        actorUserId: input.actor.id,
        businessDate: { lt: businessDate },
        status: { not: ErpOutboxStatus.ACCEPTED },
      },
      _count: { _all: true },
      _min: { businessDate: true },
    }),
    getActiveSalesDayEmergencyMode({ now: () => input.now ?? new Date() }),
    getSalesDayCashBlock({ actor: input.actor, businessDate: input.businessDate }),
  ]);
  if (cashBlock) {
    return {
      businessDate: input.businessDate,
      mode: "BLOCKED",
      reason: "CASH_BALANCE_NOT_ZERO",
      serverOpenPreviousCommandCount: openPrevious._count._all,
      oldestServerOpenBusinessDate: toBusinessDate(openPrevious._min.businessDate),
      cashBlock,
      emergency: null,
    };
  }
  if (emergency) {
    return {
      businessDate: input.businessDate,
      mode: "EMERGENCY",
      reason: "EMERGENCY_ACTIVE",
      serverOpenPreviousCommandCount: openPrevious._count._all,
      oldestServerOpenBusinessDate: toBusinessDate(openPrevious._min.businessDate),
      cashBlock: null,
      emergency: {
        id: emergency.id,
        reason: emergency.reason,
        startsAt: emergency.startsAt.toISOString(),
        endsAt: emergency.endsAt.toISOString(),
      },
    };
  }
  const blocked = openPrevious._count._all > 0;
  return {
    businessDate: input.businessDate,
    mode: blocked ? "BLOCKED" : "NORMAL",
    reason: blocked ? "DAY_MINUS_ONE_PENDING" : "NONE",
    serverOpenPreviousCommandCount: openPrevious._count._all,
    oldestServerOpenBusinessDate: toBusinessDate(openPrevious._min.businessDate),
    cashBlock: null,
    emergency: null,
  };
}

export async function assertSalesDayServerDayAccess(input: Parameters<typeof getSalesDayServerDayGate>[0]) {
  const gate = await getSalesDayServerDayGate(input);
  if (gate.mode === "BLOCKED") {
    if (gate.reason === "CASH_BALANCE_NOT_ZERO") {
      throw new SalesDayDayAccessError(
        "CASH_BALANCE_NOT_ZERO",
        "De werkdag blijft geblokkeerd tot het ERP of backoffice een exact nul kassaldo heeft bevestigd.",
      );
    }
    throw new SalesDayDayAccessError(
      "DAY_MINUS_ONE_PENDING",
      "De werkdag blijft geblokkeerd tot alle wijzigingen van een vorige werkdag door het ERP zijn bevestigd.",
    );
  }
  return gate;
}

export class SalesDayDayAccessError extends Error {
  constructor(public readonly code: "DAY_MINUS_ONE_PENDING" | "CASH_BALANCE_NOT_ZERO", message: string) {
    super(message);
    this.name = "SalesDayDayAccessError";
  }
}

function toBusinessDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}
