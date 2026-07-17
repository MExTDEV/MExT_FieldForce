import {
  ErpIntegrationProvider,
  type Prisma,
} from "@prisma/client";

import type {
  SalesErpCustomer,
  SalesErpEvent,
  SalesErpProvider,
} from "@/lib/server/integrations/sales-erp/contracts";
import { SalesErpError } from "@/lib/server/integrations/sales-erp/errors";

type NormalizedContact = {
  type: "PERSON" | "DEPARTMENT";
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  primary: boolean;
  active: boolean;
  sourceExternalId: string;
  sourceVersion: string;
  sourceUpdatedAt: Date;
};

type NormalizedAddress = {
  type: "LEGAL" | "BILLING" | "DELIVERY" | "VISIT";
  street: string;
  houseNumber: string | null;
  postalCode: string;
  city: string;
  country: "BE" | "NL" | "DE";
  primary: boolean;
  active: boolean;
  sourceExternalId: string;
  sourceVersion: string;
  sourceUpdatedAt: Date;
};

export type NormalizedSalesErpCustomer = {
  type: "CUSTOMER" | "PROSPECT";
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  legalName: string;
  displayName: string;
  vatNumber: string | null;
  preferredLanguage: "nl" | "fr" | "de";
  country: "BE" | "NL" | "DE";
  representativeExternalId: string | null;
  teamExternalId: string | null;
  isDemo: boolean;
  contacts: NormalizedContact[];
  addresses: NormalizedAddress[];
  billingValidation: {
    status: "NOT_CHECKED" | "PENDING" | "VALID" | "INVALID";
    modulo97Valid: boolean | null;
    viesCheckedAt: Date | null;
    peppolCheckedAt: Date | null;
    officialLegalName: string | null;
    officialBillingAddressJson: string | null;
  };
  sourceVersion: string;
  sourceUpdatedAt: Date;
};

export function normalizeSalesErpCustomer(customer: SalesErpCustomer): NormalizedSalesErpCustomer {
  if (!customer.externalId.trim() || !customer.sourceVersion.trim()) {
    invalidCustomer("Customer source identity is incomplete");
  }
  if (!customer.legalName.trim() || !customer.displayName.trim()) {
    invalidCustomer("Customer name is required");
  }
  const activePrimaryContacts = customer.contacts.filter((item) => item.active && item.primary);
  if (activePrimaryContacts.length > 1) invalidCustomer("Customer has more than one active primary contact");
  for (const type of ["LEGAL", "BILLING", "DELIVERY", "VISIT"] as const) {
    if (customer.addresses.filter((item) => item.type === type && item.active && item.primary).length > 1) {
      invalidCustomer(`Customer has more than one active primary ${type.toLowerCase()} address`);
    }
  }

  return {
    type: customer.relationType,
    status: customer.status,
    legalName: customer.legalName.trim(),
    displayName: customer.displayName.trim(),
    vatNumber: customer.vatNumber?.trim() || null,
    preferredLanguage: customer.preferredLanguage,
    country: customer.scope.country,
    representativeExternalId: customer.scope.representativeExternalId?.trim() || null,
    teamExternalId: customer.scope.teamExternalId?.trim() || null,
    isDemo: customer.isDemo,
    contacts: customer.contacts.map((contact) => ({
      type: contact.type,
      name: required(contact.name, "Contact name"),
      email: contact.email?.trim() || null,
      phone: contact.phone?.trim() || null,
      mobile: contact.mobile?.trim() || null,
      primary: contact.primary,
      active: contact.active,
      sourceExternalId: required(contact.externalId, "Contact external ID"),
      sourceVersion: required(contact.sourceVersion, "Contact source version"),
      sourceUpdatedAt: sourceDate(contact.sourceUpdatedAt, "contact"),
    })),
    addresses: customer.addresses.map((address) => ({
      type: address.type,
      street: required(address.street, "Address street"),
      houseNumber: address.houseNumber?.trim() || null,
      postalCode: required(address.postalCode, "Address postal code"),
      city: required(address.city, "Address city"),
      country: address.country,
      primary: address.primary,
      active: address.active,
      sourceExternalId: required(address.externalId, "Address external ID"),
      sourceVersion: required(address.sourceVersion, "Address source version"),
      sourceUpdatedAt: sourceDate(address.sourceUpdatedAt, "address"),
    })),
    billingValidation: {
      status: customer.billingValidation.status,
      modulo97Valid: customer.billingValidation.modulo97Valid ?? null,
      viesCheckedAt: optionalSourceDate(customer.billingValidation.viesCheckedAt, "VIES"),
      peppolCheckedAt: optionalSourceDate(customer.billingValidation.peppolCheckedAt, "Peppol"),
      officialLegalName: customer.billingValidation.officialLegalName?.trim() || null,
      officialBillingAddressJson: customer.billingValidation.officialBillingAddress
        ? JSON.stringify(customer.billingValidation.officialBillingAddress)
        : null,
    },
    sourceVersion: customer.sourceVersion.trim(),
    sourceUpdatedAt: sourceDate(customer.sourceUpdatedAt, "customer"),
  };
}

export async function applySalesErpCustomer(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  customer: SalesErpCustomer,
  syncedAt = new Date(),
) {
  const normalized = normalizeSalesErpCustomer(customer);
  const prismaProvider = provider as ErpIntegrationProvider;
  const existingLink = await tx.businessRelationExternalLink.findUnique({
    where: { provider_externalId: { provider: prismaProvider, externalId: customer.externalId } },
    include: { relation: { include: { contractCustomer: true } } },
  });
  const compatibility = existingLink
    ? null
    : await tx.contractCustomer.findFirst({
        where: { externalSource: provider, externalId: customer.externalId, businessRelationId: { not: null } },
        select: { businessRelationId: true },
      });
  const relationId = existingLink?.relationId ?? compatibility?.businessRelationId ?? null;

  if (existingLink?.relation.pendingFieldForceEdit) {
    return { status: "PRESERVED_PENDING_FIELD_FORCE_EDIT" as const, relationId: existingLink.relationId };
  }

  const relation = relationId
    ? await updateExistingRelation(tx, relationId, provider, customer.externalId, normalized, syncedAt)
    : await createRelation(tx, provider, customer.externalId, normalized, syncedAt);

  await updateContractCompatibility(tx, relation.id, provider, customer.externalId, normalized, syncedAt);
  return { status: relationId ? "UPDATED" as const : "CREATED" as const, relationId: relation.id };
}

export async function applySalesDayReplicaEvent(tx: Prisma.TransactionClient, event: SalesErpEvent) {
  if (event.eventType === "customer.upserted") {
    return applySalesErpCustomer(tx, event.provider, event.payload, new Date(event.occurredAt));
  }
  return { status: "IGNORED_UNOWNED_RESOURCE" as const, eventType: event.eventType };
}

async function createRelation(
  tx: Prisma.TransactionClient,
  provider: SalesErpProvider,
  externalId: string,
  customer: NormalizedSalesErpCustomer,
  syncedAt: Date,
) {
  return tx.businessRelation.create({
    data: {
      ...relationValues(customer),
      contacts: { create: customer.contacts },
      addresses: { create: customer.addresses },
      billingValidation: { create: customer.billingValidation },
      externalLinks: {
        create: {
          provider: provider as ErpIntegrationProvider,
          externalId,
          sourceVersion: customer.sourceVersion,
          sourceUpdatedAt: customer.sourceUpdatedAt,
          lastSyncedAt: syncedAt,
        },
      },
    },
  });
}

async function updateExistingRelation(
  tx: Prisma.TransactionClient,
  relationId: string,
  provider: SalesErpProvider,
  externalId: string,
  customer: NormalizedSalesErpCustomer,
  syncedAt: Date,
) {
  await tx.businessRelation.update({
    where: { id: relationId },
    data: relationValues(customer),
  });
  await tx.businessRelationContact.deleteMany({ where: { relationId } });
  await tx.businessRelationAddress.deleteMany({ where: { relationId } });
  if (customer.contacts.length) {
    await tx.businessRelationContact.createMany({
      data: customer.contacts.map((contact) => ({ relationId, ...contact })),
    });
  }
  if (customer.addresses.length) {
    await tx.businessRelationAddress.createMany({
      data: customer.addresses.map((address) => ({ relationId, ...address })),
    });
  }
  await tx.businessRelationBillingValidation.upsert({
    where: { relationId },
    update: customer.billingValidation,
    create: { relationId, ...customer.billingValidation },
  });
  await tx.businessRelationExternalLink.upsert({
    where: { provider_externalId: { provider: provider as ErpIntegrationProvider, externalId } },
    update: {
      relationId,
      sourceVersion: customer.sourceVersion,
      sourceUpdatedAt: customer.sourceUpdatedAt,
      lastSyncedAt: syncedAt,
    },
    create: {
      relationId,
      provider: provider as ErpIntegrationProvider,
      externalId,
      sourceVersion: customer.sourceVersion,
      sourceUpdatedAt: customer.sourceUpdatedAt,
      lastSyncedAt: syncedAt,
    },
  });
  return tx.businessRelation.findUniqueOrThrow({ where: { id: relationId } });
}

function relationValues(customer: NormalizedSalesErpCustomer) {
  return {
    type: customer.type,
    status: customer.status,
    legalName: customer.legalName,
    displayName: customer.displayName,
    vatNumber: customer.vatNumber,
    preferredLanguage: customer.preferredLanguage,
    country: customer.country,
    representativeExternalId: customer.representativeExternalId,
    teamExternalId: customer.teamExternalId,
    isDemo: customer.isDemo,
    pendingFieldForceEdit: false,
  };
}

async function updateContractCompatibility(
  tx: Prisma.TransactionClient,
  relationId: string,
  provider: SalesErpProvider,
  externalId: string,
  customer: NormalizedSalesErpCustomer,
  syncedAt: Date,
) {
  const primaryContact = customer.contacts.find((item) => item.active && item.primary) ?? customer.contacts.find((item) => item.active);
  const primaryAddress = customer.addresses.find((item) => item.active && item.primary && item.type === "LEGAL")
    ?? customer.addresses.find((item) => item.active && item.primary)
    ?? customer.addresses.find((item) => item.active);
  await tx.contractCustomer.updateMany({
    where: { businessRelationId: relationId },
    data: {
      companyName: customer.legalName,
      contactName: primaryContact?.name ?? null,
      email: primaryContact?.email ?? null,
      phone: primaryContact?.phone ?? primaryContact?.mobile ?? null,
      address: primaryAddress ? formatAddress(primaryAddress) : null,
      street: primaryAddress?.street ?? null,
      houseNumber: primaryAddress?.houseNumber ?? null,
      postalCode: primaryAddress?.postalCode ?? null,
      city: primaryAddress?.city ?? null,
      countryCode: customer.country,
      countrySnapshot: customer.country,
      vatNumber: customer.vatNumber,
      preferredLanguage: customer.preferredLanguage,
      externalSource: provider,
      externalId,
      lastSyncedAt: syncedAt,
      isDemo: customer.isDemo,
    },
  });
}

function formatAddress(address: NormalizedAddress) {
  return [address.street, address.houseNumber, address.postalCode, address.city].filter(Boolean).join(" ");
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) invalidCustomer(`${label} is required`);
  return normalized;
}

function sourceDate(value: string, label: string) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) invalidCustomer(`Invalid ${label} source timestamp`);
  return parsed;
}

function optionalSourceDate(value: string | undefined, label: string) {
  return value ? sourceDate(value, label) : null;
}

function invalidCustomer(message: string): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message });
}
