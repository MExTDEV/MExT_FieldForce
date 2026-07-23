import { type Country as PrismaCountry, Prisma } from "@prisma/client";

import type { MockUser } from "@/lib/types";

export function scopedSalesDayRepresentativeUserWhere(actor: MockUser): Prisma.UserWhereInput {
  if (actor.role === "REPRESENTATIVE") return { id: actor.id, role: "REPRESENTATIVE" };
  if (actor.role === "SALES_LEADER") {
    return actor.teamId ? { teamId: actor.teamId, role: "REPRESENTATIVE" } : noUsers();
  }
  if (actor.role === "SALES_MANAGER") {
    const countries = actor.countryAccess ?? [];
    return countries.length ? { country: { in: countries as PrismaCountry[] }, role: "REPRESENTATIVE" } : noUsers();
  }
  if (actor.role === "COUNTRY_MANAGER" || actor.role === "ADMIN") {
    return { country: actor.country as PrismaCountry, role: "REPRESENTATIVE" };
  }
  if (actor.role === "GROUP_MANAGER" || actor.role === "SUPER_ADMIN") {
    return { role: "REPRESENTATIVE" };
  }
  return noUsers();
}

export function isSalesDayManagementRole(actor: MockUser) {
  return ["SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(actor.role);
}

function noUsers(): Prisma.UserWhereInput {
  return { id: "__no_salesday_scope__" };
}
