import { Prisma } from "@prisma/client";

import type { MockUser } from "@/lib/types";
import { prisma } from "@/lib/server/db";
import { SalesErpError } from "@/lib/server/integrations/sales-erp";
import { salesDayBusinessDate } from "@/lib/server/salesday-customer-access";

/**
 * Read-only SalesDay team projection.  The query is deliberately separate
 * from the coaching Mijn Team projection: it exposes only operational status
 * and never returns a mutation capability or customer dossier.
 */
export async function getSalesDayTeam(input: { actor: MockUser; now?: Date }) {
  assertTeamReader(input.actor);
  const businessDate = salesDayBusinessDate(input.actor, input.now);
  const users = await prisma.user.findMany({
    where: {
      active: true,
      role: "REPRESENTATIVE",
      ...teamScopeWhere(input.actor),
    },
    select: {
      id: true,
      representativeId: true,
      firstName: true,
      lastName: true,
      country: true,
      teamId: true,
      team: { select: { id: true, name: true, country: true } },
      salesAppointments: {
        where: { businessDate: dateOnly(businessDate) },
        select: { id: true, status: true, sequence: true, visitReport: { select: { id: true } } },
        orderBy: { sequence: "asc" },
      },
      salesDayClosures: {
        where: { businessDate: dateOnly(businessDate) },
        select: { id: true, closedAt: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return {
    businessDate,
    readOnly: true as const,
    members: users.map((user) => ({
      id: user.id,
      representativeId: user.representativeId,
      firstName: user.firstName,
      lastName: user.lastName,
      country: user.country,
      team: user.team,
      appointmentCount: user.salesAppointments.length,
      completedCount: user.salesAppointments.filter((item) => item.status === "COMPLETED").length,
      unresolvedCount: user.salesAppointments.filter((item) => ["PLANNED", "IN_PROGRESS"].includes(item.status)).length,
      reportCount: user.salesAppointments.filter((item) => Boolean(item.visitReport)).length,
      sequence: user.salesAppointments.map((item) => ({ id: item.id, sequence: item.sequence, status: item.status })),
      dayClosedAt: user.salesDayClosures[0]?.closedAt.toISOString() ?? null,
    })),
  };
}

function teamScopeWhere(actor: MockUser): Prisma.UserWhereInput {
  if (actor.role === "SALES_LEADER") return actor.teamId ? { teamId: actor.teamId } : { id: "__no_team__" };
  if (actor.role === "SALES_MANAGER") {
    const countries = actor.countryAccess ?? [];
    return countries.length ? { country: { in: countries } } : { id: "__no_country__" };
  }
  if (actor.role === "COUNTRY_MANAGER" || actor.role === "ADMIN") return { country: actor.country };
  if (actor.role === "GROUP_MANAGER" || actor.role === "SUPER_ADMIN") return {};
  return { id: "__no_access__" };
}

function assertTeamReader(actor: MockUser): void {
  if (!["SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    throw new SalesErpError({ code: "PERMISSION_REVOKED", message: "Mijn Team is alleen-lezen voor managementrollen." });
  }
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
