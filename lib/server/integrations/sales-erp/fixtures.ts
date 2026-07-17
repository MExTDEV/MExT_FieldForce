import {
  SALES_ERP_SCHEMA_VERSION,
  type SalesErpArticle,
  type SalesErpBootstrapPayloadByResource,
  type SalesErpBootstrapResource,
  type SalesErpCarrierBalance,
  type SalesErpCashBalance,
  type SalesErpCommercialHistoryDocument,
  type SalesErpCustomer,
  type SalesErpCustomerLocation,
  type SalesErpEvent,
  type SalesErpReplenishment,
  type SalesErpReferenceItem,
} from "./contracts";

export type SalesErpMockDataset = {
  [K in SalesErpBootstrapResource]: SalesErpBootstrapPayloadByResource[K][];
};

type CountryFixture = {
  country: "BE" | "NL" | "DE";
  lower: "be" | "nl" | "de";
  representativeExternalId: string;
  teamExternalId: string;
  language: "nl" | "fr" | "de";
  normalVat?: string;
  normalLegalName: string;
  normalDisplayName: string;
  missingVatName: string;
  stockCustomerName: string;
  prospectName: string;
  street: string;
  postalCode: string;
  city: string;
  timeZone: string;
  cashBalance: string;
};

const sourceUpdatedAt = "2026-07-17T08:00:00.000Z";
const today = "2026-07-17";
const nextEffectiveWorkday = "2026-07-20";
const previousBusinessDate = "2026-07-16";

const countries: CountryFixture[] = [
  {
    country: "BE",
    lower: "be",
    representativeExternalId: "mock-rep-be-001",
    teamExternalId: "mock-team-be",
    language: "nl",
    normalVat: "BE0000000097",
    normalLegalName: "Demo Veiligheid Brussel",
    normalDisplayName: "Demo Brussel",
    missingVatName: "Demo Facturatie Controle BE",
    stockCustomerName: "Demo Stocktekort Antwerpen",
    prospectName: "Demo Nieuwe Prospect BE",
    street: "Voorbeeldstraat",
    postalCode: "1000",
    city: "Brussel",
    timeZone: "Europe/Brussels",
    cashBalance: "0.00",
  },
  {
    country: "NL",
    lower: "nl",
    representativeExternalId: "mock-rep-nl-001",
    teamExternalId: "mock-team-nl",
    language: "nl",
    normalVat: "NL001234567B01",
    normalLegalName: "Demo Veiligheid Nederland",
    normalDisplayName: "Demo Nederland",
    missingVatName: "Demo BTW Ontbreekt NL",
    stockCustomerName: "Demo Voorraadtekort Rotterdam",
    prospectName: "Demo Nieuwe Prospect NL",
    street: "Voorbeeldweg",
    postalCode: "1011 AA",
    city: "Amsterdam",
    timeZone: "Europe/Amsterdam",
    cashBalance: "125.50",
  },
  {
    country: "DE",
    lower: "de",
    representativeExternalId: "mock-rep-de-001",
    teamExternalId: "mock-team-de",
    language: "de",
    normalVat: "DE123456789",
    normalLegalName: "Demo Sicherheit Deutschland",
    normalDisplayName: "Demo Deutschland",
    missingVatName: "Demo Peppol Pruefung DE",
    stockCustomerName: "Demo Bestandsproblem Berlin",
    prospectName: "Demo Neuer Interessent DE",
    street: "Beispielstrasse",
    postalCode: "10115",
    city: "Berlin",
    timeZone: "Europe/Berlin",
    cashBalance: "0.00",
  },
];

function identity(externalId: string, sourceVersion = "mock-uat-v1") {
  return {
    externalId,
    sourceVersion,
    sourceUpdatedAt,
  };
}

function customer(
  fixture: CountryFixture,
  suffix: string,
  input: {
    relationType?: "CUSTOMER" | "PROSPECT";
    legalName: string;
    displayName?: string;
    vatNumber?: string;
    validationStatus?: "NOT_CHECKED" | "PENDING" | "VALID" | "INVALID";
    modulo97Valid?: boolean;
    streetNumber: string;
    addressType?: "LEGAL" | "BILLING" | "VISIT";
  },
): SalesErpCustomer {
  const externalId = input.relationType === "PROSPECT"
    ? `mock-prospect-${fixture.lower}-${suffix}`
    : `mock-customer-${fixture.lower}-${suffix}`;
  const displayName = input.displayName ?? input.legalName.replace(/^Demo\s+/, "");
  return {
    ...identity(externalId),
    relationType: input.relationType ?? "CUSTOMER",
    status: "ACTIVE",
    legalName: input.legalName,
    displayName,
    vatNumber: input.vatNumber,
    preferredLanguage: fixture.language,
    scope: {
      country: fixture.country,
      representativeExternalId: fixture.representativeExternalId,
      teamExternalId: fixture.teamExternalId,
    },
    contacts: [
      {
        ...identity(`mock-contact-${fixture.lower}-${suffix}`),
        type: "PERSON",
        name: `Contact ${displayName}`,
        email: `${fixture.lower}-${suffix}@example.invalid`,
        phone: "+32000000000",
        primary: true,
        active: true,
      },
    ],
    addresses: [
      {
        ...identity(`mock-address-${fixture.lower}-${suffix}`),
        type: input.addressType ?? "LEGAL",
        street: fixture.street,
        houseNumber: input.streetNumber,
        postalCode: fixture.postalCode,
        city: fixture.city,
        country: fixture.country,
        primary: true,
        active: true,
      },
    ],
    billingValidation: {
      status: input.validationStatus ?? "VALID",
      modulo97Valid: input.modulo97Valid,
      viesCheckedAt: input.validationStatus === "VALID" ? sourceUpdatedAt : undefined,
      peppolCheckedAt: input.validationStatus === "VALID" ? sourceUpdatedAt : undefined,
      officialLegalName: input.validationStatus === "VALID" ? input.legalName : undefined,
    },
    isDemo: true,
  };
}

const customers: SalesErpMockDataset["customers"] = countries.flatMap((fixture) => [
  customer(fixture, "001", {
    legalName: fixture.normalLegalName,
    displayName: fixture.normalDisplayName,
    vatNumber: fixture.normalVat,
    validationStatus: "VALID",
    modulo97Valid: true,
    streetNumber: "1",
  }),
  customer(fixture, "002", {
    legalName: fixture.missingVatName,
    vatNumber: fixture.country === "BE" ? "BE0000000098" : undefined,
    validationStatus: fixture.country === "BE" ? "INVALID" : "NOT_CHECKED",
    modulo97Valid: fixture.country === "BE" ? false : undefined,
    streetNumber: "2",
    addressType: "BILLING",
  }),
  customer(fixture, "003", {
    legalName: fixture.stockCustomerName,
    vatNumber: fixture.normalVat,
    validationStatus: "VALID",
    modulo97Valid: true,
    streetNumber: "3",
  }),
  customer(fixture, "001", {
    relationType: "PROSPECT",
    legalName: fixture.prospectName,
    displayName: fixture.prospectName,
    validationStatus: "PENDING",
    streetNumber: "4",
  }),
]);

function appointment(
  fixture: CountryFixture,
  suffix: string,
  customerExternalId: string,
  businessDate: string,
  sequence: number,
  status: "PLANNED" | "COMPLETED" | "NOT_COMPLETED" | "MOVED" | "CANCELLED" = "PLANNED",
  hour = 8 + sequence,
): SalesErpMockDataset["appointments"][number] {
  return {
    ...identity(`mock-appointment-${fixture.lower}-${suffix}`),
    businessDate,
    startsAt: `${businessDate}T${String(hour).padStart(2, "0")}:00:00.000Z`,
    endsAt: `${businessDate}T${String(hour + 1).padStart(2, "0")}:00:00.000Z`,
    timeZone: fixture.timeZone,
    sequence,
    status,
    customerExternalId,
    representativeExternalId: fixture.representativeExternalId,
    teamExternalId: fixture.teamExternalId,
    country: fixture.country,
    outcomeReasonExternalId: status === "NOT_COMPLETED" ? "mock-outcome-reason-closed" : undefined,
    outcomeComment: status === "NOT_COMPLETED" ? "Demo: klant was gesloten tijdens UAT." : undefined,
  };
}

const appointments: SalesErpMockDataset["appointments"] = countries.flatMap((fixture) => [
  appointment(fixture, fixture.country === "BE" ? "001" : "today-001", `mock-customer-${fixture.lower}-001`, today, 1, "PLANNED", 8),
  appointment(fixture, "today-002", `mock-customer-${fixture.lower}-002`, today, 2, "PLANNED", 10),
  appointment(fixture, "today-003", `mock-customer-${fixture.lower}-003`, today, 3, "NOT_COMPLETED", 13),
  appointment(fixture, "prep-001", `mock-customer-${fixture.lower}-001`, nextEffectiveWorkday, 1, "PLANNED", 8),
  appointment(fixture, "prep-002", `mock-customer-${fixture.lower}-003`, nextEffectiveWorkday, 2, "PLANNED", 10),
]);

function article(input: {
  externalId: string;
  articleNumber: string;
  stemNumber?: string;
  descriptionNl: string;
  descriptionFr: string;
  descriptionDe: string;
  unit?: string;
  vatRate?: string;
  carrierBound?: boolean;
  lotTrackingRequired?: boolean;
  expiryTrackingRequired?: boolean;
  basePrice: string;
}): SalesErpArticle {
  return {
    ...identity(input.externalId),
    articleNumber: input.articleNumber,
    stemNumber: input.stemNumber,
    descriptionNl: input.descriptionNl,
    descriptionFr: input.descriptionFr,
    descriptionDe: input.descriptionDe,
    unit: input.unit ?? "ST",
    vatRate: input.vatRate ?? "21.00",
    active: true,
    carrierBound: input.carrierBound ?? false,
    lotTrackingRequired: input.lotTrackingRequired ?? false,
    expiryTrackingRequired: input.expiryTrackingRequired ?? false,
    prices: countries.flatMap((fixture) => [
      {
        ...identity(`mock-price-${fixture.lower}-${input.articleNumber.toLowerCase()}-sales`),
        country: fixture.country,
        currency: "EUR",
        type: "SALES",
        amount: input.basePrice,
        validFrom: "2026-01-01",
      },
      {
        ...identity(`mock-price-${fixture.lower}-${input.articleNumber.toLowerCase()}-contract`),
        country: fixture.country,
        currency: "EUR",
        type: "CONTRACT",
        amount: input.basePrice,
        validFrom: "2026-01-01",
      },
    ]),
  };
}

const articles: SalesErpMockDataset["articles"] = [
  article({
    externalId: "mock-article-ehbo-001",
    articleNumber: "MOCK-EHBO-001",
    stemNumber: "MOCK-EHBO",
    descriptionNl: "Demo EHBO-koffer",
    descriptionFr: "Trousse de secours demo",
    descriptionDe: "Demo-Erste-Hilfe-Koffer",
    carrierBound: true,
    lotTrackingRequired: true,
    expiryTrackingRequired: true,
    basePrice: "49.95",
  }),
  article({
    externalId: "mock-article-pleister-001",
    articleNumber: "MOCK-PLEISTER-001",
    stemNumber: "MOCK-PLEISTER",
    descriptionNl: "Demo pleister navulling",
    descriptionFr: "Recharge pansements demo",
    descriptionDe: "Demo-Pflaster-Nachfuellung",
    lotTrackingRequired: true,
    expiryTrackingRequired: true,
    basePrice: "12.50",
  }),
  article({
    externalId: "mock-article-oogspoeling-001",
    articleNumber: "MOCK-OOG-001",
    stemNumber: "MOCK-OOG",
    descriptionNl: "Demo oogspoeling",
    descriptionFr: "Rince-oeil demo",
    descriptionDe: "Demo-Augenspuelung",
    lotTrackingRequired: true,
    expiryTrackingRequired: true,
    basePrice: "18.75",
  }),
  article({
    externalId: "mock-article-handschoen-001",
    articleNumber: "MOCK-HANDSCHOEN-001",
    stemNumber: "MOCK-HANDSCHOEN",
    descriptionNl: "Demo nitril handschoenen",
    descriptionFr: "Gants nitrile demo",
    descriptionDe: "Demo-Nitrilhandschuhe",
    basePrice: "8.95",
  }),
  article({
    externalId: "mock-article-aed-sticker-001",
    articleNumber: "MOCK-AED-001",
    stemNumber: "MOCK-AED",
    descriptionNl: "Demo AED-keursticker",
    descriptionFr: "Autocollant AED demo",
    descriptionDe: "Demo-AED-Pruefplakette",
    basePrice: "6.25",
  }),
];

const commercialHistory: SalesErpCommercialHistoryDocument[] = countries.flatMap((fixture) => [
  {
    ...identity(`mock-invoice-${fixture.lower}-001`),
    documentType: "INVOICE",
    documentNumber: `MOCK-${fixture.country}-INV-0001`,
    documentDate: "2026-06-30",
    customerExternalId: `mock-customer-${fixture.lower}-001`,
    representativeExternalId: fixture.representativeExternalId,
    currency: "EUR",
    amountExcludingVat: "62.45",
    amountIncludingVat: "75.56",
    paymentStatus: "PAID",
    openAmount: "0.00",
    lines: [
      {
        lineNumber: 1,
        articleExternalId: "mock-article-ehbo-001",
        articleNumberSnapshot: "MOCK-EHBO-001",
        descriptionSnapshot: "Demo EHBO-koffer",
        quantity: "1.000",
        unitSnapshot: "ST",
        unitPriceSnapshot: "49.95",
        vatRateSnapshot: "21.00",
        lineAmountExcludingVat: "49.95",
      },
      {
        lineNumber: 2,
        articleExternalId: "mock-article-pleister-001",
        articleNumberSnapshot: "MOCK-PLEISTER-001",
        descriptionSnapshot: "Demo pleister navulling",
        quantity: "1.000",
        unitSnapshot: "ST",
        unitPriceSnapshot: "12.50",
        vatRateSnapshot: "21.00",
        lineAmountExcludingVat: "12.50",
      },
    ],
  },
  {
    ...identity(`mock-invoice-${fixture.lower}-overdue`),
    documentType: "INVOICE",
    documentNumber: `MOCK-${fixture.country}-INV-OPEN`,
    documentDate: "2026-05-15",
    customerExternalId: `mock-customer-${fixture.lower}-002`,
    representativeExternalId: fixture.representativeExternalId,
    currency: "EUR",
    amountExcludingVat: "18.75",
    amountIncludingVat: "22.69",
    paymentStatus: "OVERDUE",
    openAmount: "22.69",
    lines: [
      {
        lineNumber: 1,
        articleExternalId: "mock-article-oogspoeling-001",
        articleNumberSnapshot: "MOCK-OOG-001",
        descriptionSnapshot: "Demo oogspoeling",
        quantity: "1.000",
        unitSnapshot: "ST",
        unitPriceSnapshot: "18.75",
        vatRateSnapshot: "21.00",
        lineAmountExcludingVat: "18.75",
      },
    ],
  },
]);

const replenishments: SalesErpReplenishment[] = countries.map((fixture) => ({
  ...identity(`mock-replenishment-${fixture.lower}-001`),
  shipmentNumber: `MOCK-${fixture.country}-SHIP-0001`,
  status: "IN_TRANSIT",
  country: fixture.country,
  representativeExternalId: fixture.representativeExternalId,
  shippedAt: "2026-07-16T08:00:00.000Z",
  lines: [
    {
      externalId: `mock-replenishment-line-${fixture.lower}-001`,
      articleExternalId: "mock-article-ehbo-001",
      articleNumberSnapshot: "MOCK-EHBO-001",
      expectedQuantity: "3.000",
      unitSnapshot: "ST",
      lotNumber: `MOCK-${fixture.country}-LOT-EHBO`,
      expiryDate: "2027-12-31",
    },
    {
      externalId: `mock-replenishment-line-${fixture.lower}-002`,
      articleExternalId: "mock-article-pleister-001",
      articleNumberSnapshot: "MOCK-PLEISTER-001",
      expectedQuantity: "12.000",
      unitSnapshot: "ST",
      lotNumber: `MOCK-${fixture.country}-LOT-PLEISTER`,
      expiryDate: "2026-10-31",
    },
  ],
}));

const cashBalances: SalesErpCashBalance[] = countries.map((fixture) => ({
  ...identity(`mock-cash-balance-${fixture.lower}-001`),
  representativeExternalId: fixture.representativeExternalId,
  country: fixture.country,
  currency: "EUR",
  balance: fixture.cashBalance,
  lastDepositConfirmedAt: fixture.cashBalance === "0.00" ? "2026-07-13T07:00:00.000Z" : "2026-07-10T16:00:00.000Z",
}));

const referenceBase = {
  sourceVersion: "mock-uat-v1",
  sourceUpdatedAt,
  active: true,
};

const appointmentOutcomeReasons: SalesErpReferenceItem[] = [
  {
    ...referenceBase,
    externalId: "mock-outcome-reason-closed",
    code: "CLOSED",
    labelNl: "Klant gesloten",
    labelFr: "Client ferme",
    labelDe: "Kunde geschlossen",
    requiresComment: false,
  },
  {
    ...referenceBase,
    externalId: "mock-outcome-reason-other",
    code: "OTHER",
    labelNl: "Andere reden",
    labelFr: "Autre raison",
    labelDe: "Anderer Grund",
    requiresComment: true,
  },
  {
    ...referenceBase,
    externalId: "mock-outcome-reason-customer-refused",
    code: "CUSTOMER_REFUSED",
    labelNl: "Klant weigert bezoek",
    labelFr: "Client refuse la visite",
    labelDe: "Kunde lehnt Besuch ab",
    requiresComment: true,
  },
  {
    ...referenceBase,
    externalId: "mock-outcome-reason-safety",
    code: "SAFETY",
    labelNl: "Veiligheidssituatie ter plaatse",
    labelFr: "Situation de securite sur place",
    labelDe: "Sicherheitslage vor Ort",
    requiresComment: true,
  },
];

const documentCategories: SalesErpReferenceItem[] = [
  {
    ...referenceBase,
    externalId: "mock-document-category-photo",
    code: "PHOTO",
    labelNl: "Foto",
    labelFr: "Photo",
    labelDe: "Foto",
    requiresComment: false,
  },
  {
    ...referenceBase,
    externalId: "mock-document-category-signature",
    code: "SIGNATURE",
    labelNl: "Handtekeningbewijs",
    labelFr: "Preuve de signature",
    labelDe: "Unterschriftsnachweis",
    requiresComment: false,
  },
  {
    ...referenceBase,
    externalId: "mock-document-category-compliance",
    code: "COMPLIANCE",
    labelNl: "Controlebewijs",
    labelFr: "Preuve de controle",
    labelDe: "Pruefnachweis",
    requiresComment: true,
  },
];

const paymentMethods: SalesErpMockDataset["paymentMethods"] = [
  {
    ...referenceBase,
    externalId: "mock-payment-method-cash",
    code: "CASH",
    labelNl: "Contant",
    labelFr: "Especes",
    labelDe: "Bar",
    requiresComment: false,
    affectsCashBalance: true,
  },
  {
    ...referenceBase,
    externalId: "mock-payment-method-card",
    code: "CARD",
    labelNl: "Kaart",
    labelFr: "Carte",
    labelDe: "Karte",
    requiresComment: false,
    affectsCashBalance: false,
  },
  {
    ...referenceBase,
    externalId: "mock-payment-method-invoice",
    code: "INVOICE",
    labelNl: "Factuur",
    labelFr: "Facture",
    labelDe: "Rechnung",
    requiresComment: false,
    affectsCashBalance: false,
  },
];

const customerLocations: SalesErpCustomerLocation[] = countries.flatMap((fixture) => [
  {
    ...identity(`mock-location-${fixture.lower}-001`),
    customerExternalId: `mock-customer-${fixture.lower}-001`,
    type: "LOCATION",
    name: "Demo magazijn",
    archived: false,
  },
  {
    ...identity(`mock-carrier-${fixture.lower}-001`),
    customerExternalId: `mock-customer-${fixture.lower}-001`,
    parentLocationExternalId: `mock-location-${fixture.lower}-001`,
    type: "CARRIER",
    name: "Demo EHBO-koffer inkomhal",
    linkedArticleExternalId: "mock-article-ehbo-001",
    archived: false,
  },
  {
    ...identity(`mock-location-${fixture.lower}-002`),
    customerExternalId: `mock-customer-${fixture.lower}-003`,
    type: "LOCATION",
    name: "Demo productiezone",
    archived: false,
  },
  {
    ...identity(`mock-carrier-${fixture.lower}-002`),
    customerExternalId: `mock-customer-${fixture.lower}-003`,
    parentLocationExternalId: `mock-location-${fixture.lower}-002`,
    type: "CARRIER",
    name: "Demo EHBO-koffer met stockverschil",
    linkedArticleExternalId: "mock-article-ehbo-001",
    archived: false,
  },
]);

const carrierBalances: SalesErpCarrierBalance[] = countries.flatMap((fixture) => [
  {
    ...identity(`mock-carrier-balance-${fixture.lower}-001`),
    carrierExternalId: `mock-carrier-${fixture.lower}-001`,
    articleExternalId: "mock-article-ehbo-001",
    quantity: "2.000",
    unit: "ST",
    lotNumber: `MOCK-${fixture.country}-LOT-EHBO`,
    expiryDate: "2027-12-31",
  },
  {
    ...identity(`mock-carrier-balance-${fixture.lower}-002`),
    carrierExternalId: `mock-carrier-${fixture.lower}-002`,
    articleExternalId: "mock-article-pleister-001",
    quantity: "0.000",
    unit: "ST",
    lotNumber: `MOCK-${fixture.country}-LOT-PLEISTER`,
    expiryDate: "2026-10-31",
  },
]);

export const salesErpMockDataset: SalesErpMockDataset = {
  customers,
  appointments,
  articles,
  commercialHistory,
  replenishments,
  cashBalances,
  appointmentOutcomeReasons,
  documentCategories,
  paymentMethods,
  customerLocations,
  carrierBalances,
};

function event<K extends SalesErpEvent["eventType"]>(
  eventType: K,
  entityExternalId: string,
  payload: Extract<SalesErpEvent, { eventType: K }>["payload"],
): Extract<SalesErpEvent, { eventType: K }> {
  return {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    provider: "MOCK",
    messageId: `mock-event-${entityExternalId}`,
    eventType,
    entityExternalId,
    sourceVersion: payload.sourceVersion,
    occurredAt: sourceUpdatedAt,
    payload,
  } as Extract<SalesErpEvent, { eventType: K }>;
}

export const salesErpMockEvents: SalesErpEvent[] = [
  {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    provider: "MOCK",
    messageId: "mock-event-customer-be-001",
    eventType: "customer.upserted",
    entityExternalId: customers[0].externalId,
    sourceVersion: customers[0].sourceVersion,
    occurredAt: sourceUpdatedAt,
    payload: customers[0],
  },
  {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    provider: "MOCK",
    messageId: "mock-event-appointment-be-001",
    eventType: "appointment.upserted",
    entityExternalId: appointments[0].externalId,
    sourceVersion: appointments[0].sourceVersion,
    occurredAt: sourceUpdatedAt,
    payload: appointments[0],
  },
  {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    provider: "MOCK",
    messageId: "mock-event-article-001",
    eventType: "article.upserted",
    entityExternalId: articles[0].externalId,
    sourceVersion: articles[0].sourceVersion,
    occurredAt: sourceUpdatedAt,
    payload: articles[0],
  },
  ...customers.slice(1).map((item) => event("customer.upserted", item.externalId, item)),
  ...appointments.slice(1).map((item) => event("appointment.upserted", item.externalId, item)),
  ...articles.slice(1).map((item) => event("article.upserted", item.externalId, item)),
  ...commercialHistory.map((item) => event("commercial-history.upserted", item.externalId, item)),
  ...replenishments.map((item) => event("replenishment.upserted", item.externalId, item)),
  ...cashBalances.map((item) => event("cash-balance.upserted", item.externalId, item)),
  ...appointmentOutcomeReasons.map((item) => event("appointment-outcome-reason.upserted", item.externalId, item)),
  ...documentCategories.map((item) => event("document-category.upserted", item.externalId, item)),
  ...paymentMethods.map((item) => event("payment-method.upserted", item.externalId, item)),
  ...customerLocations.map((item) => event("customer-location.upserted", item.externalId, item)),
  ...carrierBalances.map((item) => event("carrier-balance.upserted", item.externalId, item)),
];

export const salesErpMockUatScenario = {
  generatedForBusinessDates: {
    previousBusinessDate,
    today,
    nextEffectiveWorkday,
  },
  countries: countries.map((item) => item.country),
  representativeExternalIds: Object.fromEntries(
    countries.map((item) => [item.country, item.representativeExternalId]),
  ) as Record<"BE" | "NL" | "DE", string>,
  scenarios: [
    "normal-customer-valid-billing",
    "missing-or-invalid-vat",
    "not-completed-appointment-with-erp-reason",
    "next-workday-preparation",
    "stock-shortage-and-customer-carrier",
    "cash-gate-non-zero-balance",
    "commercial-history-open-invoice",
    "replenishment-in-transit",
  ],
} as const;
