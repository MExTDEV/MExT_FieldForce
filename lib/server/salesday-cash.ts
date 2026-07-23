import { Prisma, type ErpIntegrationProvider } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import {
  SalesErpError,
  type SalesErpCashBalance,
  type SalesErpPaymentMethod,
  type SalesErpProvider,
} from "@/lib/server/integrations/sales-erp";
import {
  firstEffectiveWorkdayOfWeek,
  weekRange,
} from "@/lib/salesday/cash";
import { isSalesDayManagementRole, scopedSalesDayRepresentativeUserWhere } from "@/lib/server/salesday-scope";
import type { Country, MockUser } from "@/lib/types";

export type SalesDayCashBlock = {
  firstEffectiveBusinessDate: string;
  currency: string | null;
  confirmedBalance: string | null;
  lastDepositConfirmedAt: string | null;
  missingCashBalance: boolean;
};

export async function applySalesErpPaymentMethod(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  paymentMethod: SalesErpPaymentMethod,
) {
  const prismaProvider = provider as ErpIntegrationProvider;
  return tx.salesPaymentMethod.upsert({
    where: { provider_externalId: { provider: prismaProvider, externalId: paymentMethod.externalId } },
    update: {
      sourceVersion: paymentMethod.sourceVersion,
      sourceUpdatedAt: new Date(paymentMethod.sourceUpdatedAt),
      code: paymentMethod.code,
      labelNl: paymentMethod.labelNl,
      labelFr: paymentMethod.labelFr,
      labelDe: paymentMethod.labelDe,
      country: paymentMethod.country ?? null,
      active: paymentMethod.active,
      requiresComment: paymentMethod.requiresComment,
      affectsCashBalance: paymentMethod.affectsCashBalance,
    },
    create: {
      provider: prismaProvider,
      externalId: paymentMethod.externalId,
      sourceVersion: paymentMethod.sourceVersion,
      sourceUpdatedAt: new Date(paymentMethod.sourceUpdatedAt),
      code: paymentMethod.code,
      labelNl: paymentMethod.labelNl,
      labelFr: paymentMethod.labelFr,
      labelDe: paymentMethod.labelDe,
      country: paymentMethod.country ?? null,
      active: paymentMethod.active,
      requiresComment: paymentMethod.requiresComment,
      affectsCashBalance: paymentMethod.affectsCashBalance,
    },
  });
}

export async function applySalesErpCashBalance(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  cashBalance: SalesErpCashBalance,
) {
  const prismaProvider = provider as ErpIntegrationProvider;
  const representative = await tx.user.findFirst({
    where: {
      role: "REPRESENTATIVE",
      OR: [
        { representativeId: cashBalance.representativeExternalId },
        { id: cashBalance.representativeExternalId },
      ],
    },
  });
  if (!representative) invalid("ERP-kassaldo verwijst naar een onbekende vertegenwoordiger.");
  const previous = await tx.salesCashBalance.findUnique({
    where: { provider_representativeExternalId_currency: { provider: prismaProvider, representativeExternalId: cashBalance.representativeExternalId, currency: cashBalance.currency } },
  });
  const confirmedBalance = decimal(cashBalance.balance, "Kassaldo");
  const saved = await tx.salesCashBalance.upsert({
    where: { provider_externalId: { provider: prismaProvider, externalId: cashBalance.externalId } },
    update: {
      sourceVersion: cashBalance.sourceVersion,
      sourceUpdatedAt: new Date(cashBalance.sourceUpdatedAt),
      representativeUserId: representative.id,
      representativeExternalId: cashBalance.representativeExternalId,
      country: cashBalance.country as Country,
      currency: cashBalance.currency,
      confirmedBalance,
      lastDepositConfirmedAt: cashBalance.lastDepositConfirmedAt ? new Date(cashBalance.lastDepositConfirmedAt) : null,
    },
    create: {
      provider: prismaProvider,
      externalId: cashBalance.externalId,
      sourceVersion: cashBalance.sourceVersion,
      sourceUpdatedAt: new Date(cashBalance.sourceUpdatedAt),
      representativeUserId: representative.id,
      representativeExternalId: cashBalance.representativeExternalId,
      country: cashBalance.country as Country,
      currency: cashBalance.currency,
      confirmedBalance,
      lastDepositConfirmedAt: cashBalance.lastDepositConfirmedAt ? new Date(cashBalance.lastDepositConfirmedAt) : null,
    },
  });
  const previousAmount = previous?.confirmedBalance ?? new Prisma.Decimal(0);
  const delta = confirmedBalance.minus(previousAmount);
  const entryType = cashBalance.lastDepositConfirmedAt ? "ERP_DEPOSIT_CONFIRMATION" : "ERP_CORRECTION";
  await tx.salesCashEntry.upsert({
    where: { entryKey: `erp-cash-balance:${provider}:${cashBalance.externalId}:${cashBalance.sourceVersion}` },
    update: {
      balanceAfter: confirmedBalance,
      sourceVersion: cashBalance.sourceVersion,
    },
    create: {
      entryKey: `erp-cash-balance:${provider}:${cashBalance.externalId}:${cashBalance.sourceVersion}`,
      type: entryType,
      provider: prismaProvider,
      representativeUserId: representative.id,
      cashBalanceId: saved.id,
      country: cashBalance.country as Country,
      currency: cashBalance.currency,
      occurredAt: cashBalance.lastDepositConfirmedAt
        ? new Date(cashBalance.lastDepositConfirmedAt)
        : new Date(cashBalance.sourceUpdatedAt),
      amount: delta,
      balanceAfter: confirmedBalance,
      externalId: cashBalance.externalId,
      sourceVersion: cashBalance.sourceVersion,
    },
  });
  return saved;
}

export async function resolveSalesPaymentMethod(
  tx: Prisma.TransactionClient,
  input: {
    provider: SalesErpProvider;
    country: Country;
    paymentMethodExternalId?: string;
  },
) {
  const externalId = input.paymentMethodExternalId?.trim();
  if (!externalId) return null;
  const method = await tx.salesPaymentMethod.findFirst({
    where: {
      provider: input.provider as ErpIntegrationProvider,
      externalId,
      active: true,
      OR: [{ country: null }, { country: input.country }],
    },
  });
  if (!method) invalid("De gekozen ERP-betaalmethode is niet actief voor dit land.");
  return method;
}

export async function createDocumentCashEntryInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    document: {
      id: string;
      representativeUserId: string;
      provider: ErpIntegrationProvider;
      documentType: "ORDER" | "ORDER_ALREADY_DELIVERED" | "INVOICE";
      businessDate: Date;
      currency: string;
      amountIncludingVat: Prisma.Decimal;
      paymentMethodId: string | null;
      paymentMethodExternalId: string | null;
    };
    paymentMethod: { id: string; affectsCashBalance: boolean } | null;
    actor: MockUser;
    occurredAt: Date;
    commandId: string;
  },
) {
  if (!input.paymentMethod?.affectsCashBalance) return null;
  if (input.document.documentType === "ORDER") return null;
  return tx.salesCashEntry.upsert({
    where: { entryKey: `sales-document-cash:${input.document.id}` },
    update: {},
    create: {
      entryKey: `sales-document-cash:${input.document.id}`,
      type: "DOCUMENT_CASH_PAYMENT",
      provider: input.document.provider,
      representativeUserId: input.document.representativeUserId,
      salesDocumentId: input.document.id,
      paymentMethodId: input.paymentMethod.id,
      country: input.actor.country,
      currency: input.document.currency,
      businessDate: input.document.businessDate,
      occurredAt: input.occurredAt,
      amount: input.document.amountIncludingVat,
      commandId: input.commandId,
      comment: "Cash-effect uit SalesDay-document.",
    },
  });
}

export async function getSalesDayCashBlock(input: {
  actor: MockUser;
  businessDate: string;
}) {
  if (input.actor.role !== "REPRESENTATIVE") return null;
  const firstEffectiveBusinessDate = await resolveFirstEffectiveBusinessDate(input.actor, input.businessDate);
  if (input.businessDate !== firstEffectiveBusinessDate) return null;
  const balances = await prisma.salesCashBalance.findMany({
    where: { representativeUserId: input.actor.id },
    orderBy: [{ currency: "asc" }, { updatedAt: "desc" }],
  });
  if (!balances.length) {
    return {
      firstEffectiveBusinessDate,
      currency: null,
      confirmedBalance: null,
      lastDepositConfirmedAt: null,
      missingCashBalance: true,
    } satisfies SalesDayCashBlock;
  }
  const blocking = balances.find((balance) => !balance.confirmedBalance.eq(0));
  if (!blocking) return null;
  return {
    firstEffectiveBusinessDate,
    currency: blocking.currency,
    confirmedBalance: blocking.confirmedBalance.toFixed(4),
    lastDepositConfirmedAt: blocking.lastDepositConfirmedAt?.toISOString() ?? null,
    missingCashBalance: false,
  } satisfies SalesDayCashBlock;
}

export async function getSalesDayCashSheet(input: {
  actor: MockUser;
  provider: SalesErpProvider;
  businessDate?: string;
}) {
  if (input.actor.role !== "REPRESENTATIVE" && !isSalesDayManagementRole(input.actor)) {
    denied("Je hebt geen recht om het kasblad te bekijken.");
  }
  const businessDate = input.businessDate ?? (
    input.actor.role === "REPRESENTATIVE"
      ? await resolveFirstEffectiveBusinessDate(input.actor)
      : countryBusinessDate(input.actor)
  );
  const methods = await prisma.salesPaymentMethod.findMany({
    where: {
      provider: input.provider as ErpIntegrationProvider,
      active: true,
      OR: [{ country: null }, { country: input.actor.country }],
    },
    orderBy: [{ affectsCashBalance: "desc" }, { code: "asc" }],
  });
  const balances = await prisma.salesCashBalance.findMany({
    where: input.actor.role === "REPRESENTATIVE"
      ? { representativeUserId: input.actor.id }
      : { representative: { is: scopedSalesDayRepresentativeUserWhere(input.actor) } },
    include: { representative: { select: { id: true, firstName: true, lastName: true, country: true } } },
    orderBy: [{ currency: "asc" }, { updatedAt: "desc" }],
  });
  const entries = await prisma.salesCashEntry.findMany({
    where: {
      ...(input.actor.role === "REPRESENTATIVE"
        ? { representativeUserId: input.actor.id }
        : { representative: { is: scopedSalesDayRepresentativeUserWhere(input.actor) } }),
      OR: [{ businessDate: null }, { businessDate: dateOnly(businessDate) }],
    },
    include: {
      representative: { select: { id: true, firstName: true, lastName: true, country: true } },
      salesDocument: { select: { documentNumber: true, documentType: true } },
      paymentMethod: true,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  const block = input.actor.role === "REPRESENTATIVE"
    ? await getSalesDayCashBlock({ actor: input.actor, businessDate })
    : null;
  return {
    businessDate,
    firstEffectiveBusinessDate: input.actor.role === "REPRESENTATIVE"
      ? await resolveFirstEffectiveBusinessDate(input.actor, businessDate)
      : businessDate,
    block,
    readOnly: input.actor.role !== "REPRESENTATIVE",
    scope: input.actor.role === "REPRESENTATIVE" ? "OWN" as const : "MANAGEMENT" as const,
    methods,
    balances,
    entries,
  };
}

export async function resolveFirstEffectiveBusinessDate(actor: MockUser, businessDate?: string) {
  const referenceDate = businessDate ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: countryTimeZone(actor.country),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const range = weekRange(referenceDate);
  const [holidays, appointments] = await Promise.all([
    prisma.holiday.findMany({
      where: {
        country: actor.country,
        active: true,
        date: { gte: dateOnly(range.start), lte: dateOnly(range.end) },
      },
      select: { date: true },
    }),
    prisma.salesAppointment.findMany({
      where: {
        representativeUserId: actor.id,
        businessDate: { gte: dateOnly(range.start), lte: dateOnly(range.end) },
        status: { not: "CANCELLED" },
      },
      select: { businessDate: true },
    }),
  ]);
  return firstEffectiveWorkdayOfWeek({
    businessDate: referenceDate,
    holidays: holidays.map((holiday) => holiday.date),
    plannedBusinessDates: appointments.map((appointment) => appointment.businessDate.toISOString().slice(0, 10)),
  });
}

function countryTimeZone(country: Country) {
  if (country === "NL") return "Europe/Amsterdam";
  if (country === "DE") return "Europe/Berlin";
  return "Europe/Brussels";
}

function countryBusinessDate(actor: MockUser) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: countryTimeZone(actor.country),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function decimal(value: string | Prisma.Decimal, label: string) {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) invalid(`${label} is ongeldig.`);
    return parsed;
  } catch {
    invalid(`${label} is ongeldig.`);
  }
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function denied(message: string): never {
  throw new SalesErpError({ code: "PERMISSION_REVOKED", message });
}

function invalid(message: string): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message });
}
