import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import { SalesErpError } from "@/lib/server/integrations/sales-erp/errors";
import type { MockUser } from "@/lib/types";

const countryTimeZones: Record<MockUser["country"], string> = {
  BE: "Europe/Brussels",
  NL: "Europe/Amsterdam",
  DE: "Europe/Berlin",
};

export function salesDayCustomerScopeWhere(actor: MockUser): Prisma.BusinessRelationWhereInput {
  if (actor.role === "SUPER_ADMIN" || actor.role === "GROUP_MANAGER") return {};
  if (actor.role === "REPRESENTATIVE") {
    return {
      OR: [
        { ownerUserId: actor.id },
        { representativeExternalId: actor.representativeId ?? actor.id },
        ...(actor.teamId ? [{ teamId: actor.teamId }] : []),
      ],
    };
  }
  if (actor.role === "SALES_LEADER") {
    return actor.teamId ? { teamId: actor.teamId } : { id: "__no_salesday_scope__" };
  }
  const countries = actor.role === "SALES_MANAGER" || actor.role === "ADMIN"
    ? actor.countryAccess?.length ? actor.countryAccess : [actor.country]
    : [actor.country];
  return { country: { in: countries } };
}

export function salesDayBusinessDate(actor: MockUser, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: countryTimeZones[actor.country],
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function searchSalesDayCustomers(actor: MockUser, query: string, limit = 40) {
  const trimmed = query.trim();
  const take = Math.max(1, Math.min(100, limit));
  const relations = await prisma.businessRelation.findMany({
    where: {
      AND: [
        salesDayCustomerScopeWhere(actor),
        { status: { in: ["ACTIVE", "BLOCKED"] } },
        ...(trimmed
          ? [{
              OR: [
                { displayName: { contains: trimmed } },
                { legalName: { contains: trimmed } },
                { vatNumber: { contains: trimmed } },
                { addresses: { some: { OR: [{ postalCode: { contains: trimmed } }, { city: { contains: trimmed } }] } } },
              ],
            }]
          : []),
      ],
    },
    select: {
      id: true,
      type: true,
      status: true,
      displayName: true,
      legalName: true,
      vatNumber: true,
      country: true,
      addresses: {
        where: { active: true, primary: true },
        orderBy: { type: "asc" },
        take: 1,
        select: { postalCode: true, city: true },
      },
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take,
  });
  return relations.map((relation) => ({
    id: relation.id,
    type: relation.type,
    status: relation.status,
    displayName: relation.displayName,
    legalName: relation.legalName,
    vatNumber: relation.vatNumber,
    country: relation.country,
    postalCode: relation.addresses[0]?.postalCode ?? null,
    city: relation.addresses[0]?.city ?? null,
  }));
}

export async function getSalesDayCustomerDetail(actor: MockUser, relationId: string, now = new Date()) {
  const relation = await prisma.businessRelation.findFirst({
    where: { id: relationId, ...salesDayCustomerScopeWhere(actor) },
    include: {
      contacts: { where: { active: true }, orderBy: [{ primary: "desc" }, { name: "asc" }] },
      addresses: { where: { active: true }, orderBy: [{ primary: "desc" }, { type: "asc" }] },
      billingValidation: true,
      externalLinks: true,
    },
  });
  if (!relation) denied("Deze klant valt buiten je SalesDay-scope.");
  if (actor.role === "REPRESENTATIVE") {
    const appointment = await findTodayAppointment(actor, relation.id, now);
    if (!appointment) denied("Volledige klantgegevens zijn alleen zichtbaar via een afspraak van vandaag.");
  }
  return relation;
}

export async function requireSalesDayCustomerMutationAppointment(
  actor: MockUser,
  relationId: string,
  appointmentId: string,
  now = new Date(),
) {
  if (actor.role !== "REPRESENTATIVE") {
    denied("Managementtoegang tot SalesDay is alleen-lezen.");
  }
  const appointment = await prisma.salesAppointment.findFirst({
    where: {
      id: appointmentId,
      relationId,
      representativeUserId: actor.id,
      businessDate: dateOnly(salesDayBusinessDate(actor, now)),
      status: { notIn: ["CANCELLED"] },
    },
  });
  if (!appointment) denied("De klant kan alleen tijdens de eigen afspraak van vandaag worden gewijzigd.");
  return appointment;
}

export async function requireSalesDayProspectScope(actor: MockUser, country: MockUser["country"]) {
  if (actor.role !== "REPRESENTATIVE" || actor.country !== country) {
    denied("Alleen de vertegenwoordiger kan een prospect in de eigen landenscope maken.");
  }
}

async function findTodayAppointment(actor: MockUser, relationId: string, now: Date) {
  return prisma.salesAppointment.findFirst({
    where: {
      relationId,
      representativeUserId: actor.id,
      businessDate: dateOnly(salesDayBusinessDate(actor, now)),
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function denied(message: string): never {
  throw new SalesErpError({ code: "PERMISSION_REVOKED", message });
}
