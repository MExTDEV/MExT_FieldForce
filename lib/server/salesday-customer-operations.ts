import { randomUUID } from "node:crypto";

import { Prisma, type Country, type Language } from "@prisma/client";

import {
  normalizeVatNumber,
  validateBillingIdentity,
  validateVatLocally,
  type AuthoritativeBillingIdentity,
} from "@/lib/salesday/billing-validation";
import { prisma } from "@/lib/server/db";
import {
  buildSalesErpCommand,
  canonicalSalesErpJson,
  enqueueSalesErpCommandInTransaction,
  SalesErpError,
  type SalesErpBillingValidation,
  type SalesErpProvider,
} from "@/lib/server/integrations/sales-erp";
import {
  requireSalesDayCustomerMutationAppointment,
  requireSalesDayProspectScope,
  salesDayBusinessDate,
} from "@/lib/server/salesday-customer-access";
import type { MockUser } from "@/lib/types";

export type SalesDayCustomerInput = {
  legalName: string;
  displayName?: string;
  vatNumber?: string;
  preferredLanguage?: Language;
  country: Country;
  contacts?: Array<{
    type?: "PERSON" | "DEPARTMENT";
    name: string;
    email?: string;
    phone?: string;
    mobile?: string;
    primary?: boolean;
  }>;
  addresses?: Array<{
    type?: "LEGAL" | "BILLING" | "DELIVERY" | "VISIT";
    street: string;
    houseNumber?: string;
    postalCode: string;
    city: string;
    country?: Country;
    primary?: boolean;
  }>;
};

export async function createSalesDayProspect(input: {
  actor: MockUser;
  deviceId: string;
  provider: SalesErpProvider;
  customer: SalesDayCustomerInput;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await requireSalesDayProspectScope(input.actor, input.customer.country);
  const prepared = await prepareCustomerInput(input.customer);
  const commandId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const relation = await tx.businessRelation.create({
      data: {
        type: "PROSPECT",
        status: "ACTIVE",
        ...relationData(prepared),
        ownerUserId: input.actor.id,
        teamId: input.actor.teamId ?? null,
        representativeExternalId: input.actor.representativeId ?? input.actor.id,
        teamExternalId: input.actor.teamId ?? null,
        localRevision: 1,
        pendingFieldForceEdit: true,
        contacts: prepared.contacts.length ? { create: prepared.contacts } : undefined,
        addresses: prepared.addresses.length ? { create: prepared.addresses } : undefined,
        billingValidation: { create: prepared.billingRecord },
      },
    });
    const command = buildCustomerCommand({
      commandId,
      actor: input.actor,
      deviceId: input.deviceId,
      provider: input.provider,
      relationId: relation.id,
      relationType: "PROSPECT",
      revision: 1,
      prepared,
      now,
    });
    await enqueueSalesErpCommandInTransaction(tx, {
      provider: input.provider,
      command,
      businessDate: salesDayBusinessDate(input.actor, now),
    });
    await tx.businessRelationChange.create({
      data: {
        relationId: relation.id,
        actorUserId: input.actor.id,
        deviceId: input.deviceId,
        oldValueJson: canonicalSalesErpJson({}),
        proposedValueJson: canonicalSalesErpJson(prepared.snapshot),
        validationJson: canonicalSalesErpJson(prepared.validation),
        commandId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: input.actor.id,
        entityType: "BusinessRelation",
        entityId: relation.id,
        action: "salesday.prospect.created",
        newValue: canonicalSalesErpJson({ commandId, ...prepared.snapshot }),
      },
    });
    return { relationId: relation.id, commandId, validation: prepared.validation };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateSalesDayCustomer(input: {
  actor: MockUser;
  deviceId: string;
  provider: SalesErpProvider;
  relationId: string;
  appointmentId: string;
  customer: SalesDayCustomerInput;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const appointment = await requireSalesDayCustomerMutationAppointment(
    input.actor,
    input.relationId,
    input.appointmentId,
    now,
  );
  const prepared = await prepareCustomerInput(input.customer);
  const commandId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const lockedAppointment = await tx.salesAppointment.findFirst({
      where: {
        id: appointment.id,
        relationId: input.relationId,
        representativeUserId: input.actor.id,
        businessDate: appointment.businessDate,
        status: { not: "CANCELLED" },
      },
    });
    if (!lockedAppointment) {
      throw new SalesErpError({
        code: "PERMISSION_REVOKED",
        message: "De klant kan alleen tijdens de eigen afspraak van vandaag worden gewijzigd.",
      });
    }
    const relation = await tx.businessRelation.findUniqueOrThrow({
      where: { id: input.relationId },
      include: {
        contacts: true,
        addresses: true,
        billingValidation: true,
        externalLinks: { where: { provider: input.provider }, take: 1 },
        contractCustomer: true,
        changes: { orderBy: { createdAt: "desc" }, take: 1, select: { commandId: true } },
      },
    });
    const oldSnapshot = relationSnapshot(relation);
    const revision = relation.localRevision + 1;
    await tx.businessRelation.update({
      where: { id: relation.id },
      data: {
        ...relationData(prepared),
        localRevision: revision,
        pendingFieldForceEdit: true,
      },
    });
    await tx.businessRelationContact.deleteMany({ where: { relationId: relation.id } });
    await tx.businessRelationAddress.deleteMany({ where: { relationId: relation.id } });
    if (prepared.contacts.length) {
      await tx.businessRelationContact.createMany({
        data: prepared.contacts.map((contact) => ({ relationId: relation.id, ...contact })),
      });
    }
    if (prepared.addresses.length) {
      await tx.businessRelationAddress.createMany({
        data: prepared.addresses.map((address) => ({ relationId: relation.id, ...address })),
      });
    }
    await tx.businessRelationBillingValidation.upsert({
      where: { relationId: relation.id },
      update: prepared.billingRecord,
      create: { relationId: relation.id, ...prepared.billingRecord },
    });

    const link = relation.externalLinks[0];
    const dependencies = !link?.externalId && relation.changes[0]?.commandId
      ? [relation.changes[0].commandId]
      : [];
    const command = buildCustomerCommand({
      commandId,
      actor: input.actor,
      deviceId: input.deviceId,
      provider: input.provider,
      relationId: relation.id,
      relationType: relation.type,
      revision,
      prepared,
      now,
      externalId: link?.externalId,
      expectedSourceVersion: link?.sourceVersion,
      appointmentExternalId: lockedAppointment.externalId ?? undefined,
      dependsOnCommandIds: dependencies,
    });
    await enqueueSalesErpCommandInTransaction(tx, {
      provider: input.provider,
      command,
      businessDate: salesDayBusinessDate(input.actor, now),
    });
    await tx.businessRelationChange.create({
      data: {
        relationId: relation.id,
        actorUserId: input.actor.id,
        deviceId: input.deviceId,
        appointmentExternalId: lockedAppointment.externalId,
        oldValueJson: canonicalSalesErpJson(oldSnapshot),
        proposedValueJson: canonicalSalesErpJson(prepared.snapshot),
        validationJson: canonicalSalesErpJson(prepared.validation),
        commandId,
      },
    });
    if (relation.contractCustomer) {
      await tx.contractCustomer.update({
        where: { id: relation.contractCustomer.id },
        data: contractProjection(prepared),
      });
    }
    await tx.auditLog.create({
      data: {
        userId: input.actor.id,
        entityType: "BusinessRelation",
        entityId: relation.id,
        action: "salesday.customer.updated",
        oldValue: canonicalSalesErpJson(oldSnapshot),
        newValue: canonicalSalesErpJson({ commandId, ...prepared.snapshot }),
      },
    });
    return { relationId: relation.id, commandId, revision, validation: prepared.validation };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function prepareCustomerInput(input: SalesDayCustomerInput) {
  const legalName = required(input.legalName, "Klantnaam");
  const displayName = input.displayName?.trim() || legalName;
  const localVat = input.vatNumber
    ? validateVatLocally(input.country, input.vatNumber)
    : { vatNumber: "", formatValid: true, modulo97Valid: null };
  const validation = input.vatNumber
    ? await validateBillingIdentity({ country: input.country, vatNumber: input.vatNumber })
    : {
        local: localVat,
        status: "UNAVAILABLE" as const,
        authorities: [],
        authoritativeIdentity: null,
        authoritativeConflict: false,
      };
  const authoritative = validation.status === "VALID" ? validation.authoritativeIdentity : null;
  const contacts = normalizeContacts(input.contacts ?? [], legalName);
  let addresses = normalizeAddresses(input.addresses ?? [], input.country);
  if (authoritative) addresses = applyAuthoritativeAddress(addresses, authoritative);
  const vatNumber = authoritative?.vatNumber
    ? normalizeVatNumber(authoritative.vatNumber)
    : localVat.vatNumber || null;
  const effectiveLegalName = authoritative?.legalName?.trim() || legalName;
  const billingStatus: SalesErpBillingValidation["status"] = validation.status === "VALID"
    ? "VALID"
    : validation.status === "INVALID" || validation.status === "CONFLICT"
      ? "INVALID"
      : input.vatNumber ? "PENDING" : "NOT_CHECKED";
  const billingRecord = {
    status: billingStatus,
    modulo97Valid: localVat.modulo97Valid,
    viesCheckedAt: authorityCheckedAt(validation.authorities, "VIES"),
    peppolCheckedAt: authorityCheckedAt(validation.authorities, "PEPPOL"),
    officialLegalName: authoritative?.legalName?.trim() || null,
    officialBillingAddressJson: authoritative ? canonicalSalesErpJson(authoritative) : null,
  };
  const snapshot = {
    legalName: effectiveLegalName,
    displayName,
    vatNumber,
    preferredLanguage: input.preferredLanguage ?? "nl",
    country: input.country,
    contacts,
    addresses,
  };
  return {
    legalName: effectiveLegalName,
    displayName,
    vatNumber,
    preferredLanguage: input.preferredLanguage ?? "nl",
    country: input.country,
    contacts,
    addresses,
    billingRecord,
    validation,
    snapshot,
  };
}

function buildCustomerCommand(input: {
  commandId: string;
  actor: MockUser;
  deviceId: string;
  provider: SalesErpProvider;
  relationId: string;
  relationType: "CUSTOMER" | "PROSPECT";
  revision: number;
  prepared: Awaited<ReturnType<typeof prepareCustomerInput>>;
  now: Date;
  externalId?: string;
  expectedSourceVersion?: string;
  appointmentExternalId?: string;
  dependsOnCommandIds?: string[];
}) {
  return buildSalesErpCommand({
    commandId: input.commandId,
    issuedAt: input.now.toISOString(),
    commandType: "customer.upsert",
    businessKey: `business-relation:${input.relationId}:revision:${input.revision}`,
    dependsOnCommandIds: input.dependsOnCommandIds,
    context: {
      actorUserId: input.actor.id,
      representativeExternalId: input.actor.representativeId ?? input.actor.id,
      deviceId: input.deviceId,
      country: input.actor.country,
      appointmentExternalId: input.appointmentExternalId,
    },
    payload: {
      localRelationId: input.relationId,
      externalId: input.externalId,
      relationType: input.relationType,
      expectedSourceVersion: input.expectedSourceVersion,
      legalName: input.prepared.legalName,
      displayName: input.prepared.displayName,
      vatNumber: input.prepared.vatNumber ?? undefined,
      preferredLanguage: input.prepared.preferredLanguage,
      contacts: input.prepared.contacts.map((contact) => ({
        ...contact,
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
        mobile: contact.mobile ?? undefined,
      })),
      addresses: input.prepared.addresses.map((address) => ({
        ...address,
        houseNumber: address.houseNumber ?? undefined,
      })),
      validation: {
        status: input.prepared.billingRecord.status,
        modulo97Valid: input.prepared.billingRecord.modulo97Valid ?? undefined,
        viesCheckedAt: input.prepared.billingRecord.viesCheckedAt?.toISOString(),
        peppolCheckedAt: input.prepared.billingRecord.peppolCheckedAt?.toISOString(),
        officialLegalName: input.prepared.billingRecord.officialLegalName ?? undefined,
        officialBillingAddress: input.prepared.billingRecord.officialBillingAddressJson
          ? JSON.parse(input.prepared.billingRecord.officialBillingAddressJson)
          : undefined,
      },
    },
  });
}

function relationData(prepared: Awaited<ReturnType<typeof prepareCustomerInput>>) {
  return {
    legalName: prepared.legalName,
    displayName: prepared.displayName,
    vatNumber: prepared.vatNumber,
    preferredLanguage: prepared.preferredLanguage,
    country: prepared.country,
  };
}

function normalizeContacts(contacts: NonNullable<SalesDayCustomerInput["contacts"]>, fallbackName: string) {
  if (contacts.filter((contact) => contact.primary).length > 1) throw invalid("Er kan maar één primair contact zijn.");
  const hasExplicitPrimary = contacts.some((contact) => contact.primary === true);
  return contacts.map((contact, index) => ({
    type: contact.type ?? "PERSON" as const,
    name: contact.name.trim() || fallbackName,
    email: contact.email?.trim() || null,
    phone: contact.phone?.trim() || null,
    mobile: contact.mobile?.trim() || null,
    primary: contact.primary ?? (!hasExplicitPrimary && index === 0),
    active: true,
  }));
}

function normalizeAddresses(addresses: NonNullable<SalesDayCustomerInput["addresses"]>, country: Country) {
  for (const type of ["LEGAL", "BILLING", "DELIVERY", "VISIT"] as const) {
    if (addresses.filter((address) => (address.type ?? "LEGAL") === type && address.primary).length > 1) {
      throw invalid(`Er kan maar één primair ${type.toLowerCase()} adres zijn.`);
    }
  }
  return addresses.map((address, index) => ({
    type: address.type ?? "LEGAL" as const,
    street: required(address.street, "Straat"),
    houseNumber: address.houseNumber?.trim() || null,
    postalCode: required(address.postalCode, "Postcode"),
    city: required(address.city, "Plaats"),
    country: address.country ?? country,
    primary: address.primary ?? isImplicitPrimaryAddress(addresses, index),
    active: true,
  }));
}

function isImplicitPrimaryAddress(
  addresses: NonNullable<SalesDayCustomerInput["addresses"]>,
  index: number,
) {
  const type = addresses[index].type ?? "LEGAL";
  const sameType = addresses.filter((address) => (address.type ?? "LEGAL") === type);
  return !sameType.some((address) => address.primary === true)
    && addresses.findIndex((address) => (address.type ?? "LEGAL") === type) === index;
}

function applyAuthoritativeAddress(
  addresses: ReturnType<typeof normalizeAddresses>,
  identity: AuthoritativeBillingIdentity,
) {
  if (!identity.street || !identity.postalCode || !identity.city) return addresses;
  const official = {
    type: "BILLING" as const,
    street: identity.street,
    houseNumber: identity.houseNumber ?? null,
    postalCode: identity.postalCode,
    city: identity.city,
    country: identity.country,
    primary: true,
    active: true,
  };
  return [...addresses.filter((address) => address.type !== "BILLING"), official];
}

function authorityCheckedAt(
  results: Awaited<ReturnType<typeof validateBillingIdentity>>["authorities"],
  authority: "VIES" | "PEPPOL",
) {
  const result = results.find((item) => item.authority === authority);
  return result && result.status !== "UNAVAILABLE" ? new Date(result.checkedAt) : null;
}

function contractProjection(prepared: Awaited<ReturnType<typeof prepareCustomerInput>>) {
  const contact = prepared.contacts.find((item) => item.primary) ?? prepared.contacts[0];
  const address = prepared.addresses.find((item) => item.type === "LEGAL" && item.primary)
    ?? prepared.addresses.find((item) => item.primary)
    ?? prepared.addresses[0];
  return {
    companyName: prepared.legalName,
    contactName: contact?.name ?? null,
    email: contact?.email ?? null,
    phone: contact?.phone ?? contact?.mobile ?? null,
    address: address ? [address.street, address.houseNumber, address.postalCode, address.city].filter(Boolean).join(" ") : null,
    street: address?.street ?? null,
    houseNumber: address?.houseNumber ?? null,
    postalCode: address?.postalCode ?? null,
    city: address?.city ?? null,
    countryCode: prepared.country,
    countrySnapshot: prepared.country,
    vatNumber: prepared.vatNumber,
    preferredLanguage: prepared.preferredLanguage,
  };
}

function relationSnapshot(relation: {
  legalName: string;
  displayName: string;
  vatNumber: string | null;
  preferredLanguage: Language;
  country: Country;
  contacts: unknown[];
  addresses: unknown[];
  billingValidation: unknown;
}) {
  return {
    legalName: relation.legalName,
    displayName: relation.displayName,
    vatNumber: relation.vatNumber,
    preferredLanguage: relation.preferredLanguage,
    country: relation.country,
    contacts: relation.contacts,
    addresses: relation.addresses,
    billingValidation: relation.billingValidation,
  };
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw invalid(`${label} is verplicht.`);
  return normalized;
}

function invalid(message: string) {
  return new SalesErpError({ code: "INVALID_CONTRACT", message });
}
