import type { Prisma } from "@prisma/client";
import { can } from "@/lib/permissions";
import { forbidden } from "@/lib/server/api";
import { actorCanAccessCountry } from "@/lib/server/authenticated-user";
import type { MockUser } from "@/lib/types";

export function requireContractAccess(actor: MockUser) {
  if (!can(actor, "menu.contract.enabled") || !can(actor, "menu.contract.open")) {
    forbidden("Contractcalculatie is niet beschikbaar voor jouw huidige rechten.");
  }
}

export function requireContractManagement(actor: MockUser, permission: "contractArticlesManage" | "contractImportsManage" | "contractModelsManage") {
  requireContractAccess(actor);
  if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role) || !can(actor, permission)) {
    forbidden("Contractbeheer is alleen beschikbaar voor Admin en Super Admin.");
  }
}

export function contractOwnerWhere(actor: MockUser): Prisma.ContractCalculationWhereInput {
  if (actor.role === "SUPER_ADMIN" || actor.role === "GROUP_MANAGER") return {};
  if (actor.role === "REPRESENTATIVE") return { ownerUserId: actor.id };
  if (actor.role === "SALES_LEADER") {
    return actor.teamId
      ? { OR: [{ ownerUserId: actor.id }, { teamIdSnapshot: actor.teamId }] }
      : { ownerUserId: actor.id };
  }
  const countries = actor.role === "SALES_MANAGER" || actor.role === "ADMIN"
    ? actor.countryAccess?.length ? actor.countryAccess : [actor.country]
    : [actor.country];
  return { countrySnapshot: { in: countries } };
}

export function contractCustomerWhere(actor: MockUser): Prisma.ContractCustomerWhereInput {
  const calculationWhere = contractOwnerWhere(actor);
  if ("ownerUserId" in calculationWhere && typeof calculationWhere.ownerUserId === "string") {
    return { ownerUserId: calculationWhere.ownerUserId };
  }
  if (actor.role === "SALES_LEADER" && actor.teamId) {
    return { OR: [{ ownerUserId: actor.id }, { teamIdSnapshot: actor.teamId }] };
  }
  if (actor.role === "SUPER_ADMIN" || actor.role === "GROUP_MANAGER") return {};
  const countries = actor.role === "SALES_MANAGER" || actor.role === "ADMIN"
    ? actor.countryAccess?.length ? actor.countryAccess : [actor.country]
    : [actor.country];
  return { countrySnapshot: { in: countries } };
}

export function canAccessContractCountry(actor: MockUser, country: string) {
  return actorCanAccessCountry(actor, country);
}
