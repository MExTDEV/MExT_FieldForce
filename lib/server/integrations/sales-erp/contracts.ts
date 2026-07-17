export const SALES_ERP_SCHEMA_VERSION = "sales-erp.v1" as const;

export type SalesErpSchemaVersion = typeof SALES_ERP_SCHEMA_VERSION;
export type SalesErpProvider = "MOCK" | "BC_NAV" | "ODOO";
export type SalesErpCountryCode = "BE" | "NL" | "DE";
export type SalesErpLanguageCode = "nl" | "fr" | "de";
export type SalesErpCurrencyCode = "EUR";
export type IsoDate = string;
export type IsoDateTime = string;
export type DecimalString = string;

export type SalesErpSourceIdentity = {
  externalId: string;
  sourceVersion: string;
  sourceUpdatedAt: IsoDateTime;
};

export type SalesErpScopeReference = {
  country: SalesErpCountryCode;
  representativeExternalId?: string;
  teamExternalId?: string;
};

export type SalesErpContact = SalesErpSourceIdentity & {
  type: "PERSON" | "DEPARTMENT";
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  primary: boolean;
  active: boolean;
};

export type SalesErpAddress = SalesErpSourceIdentity & {
  type: "LEGAL" | "BILLING" | "DELIVERY" | "VISIT";
  street: string;
  houseNumber?: string;
  postalCode: string;
  city: string;
  country: SalesErpCountryCode;
  primary: boolean;
  active: boolean;
};

export type SalesErpBillingValidation = {
  status: "NOT_CHECKED" | "PENDING" | "VALID" | "INVALID";
  modulo97Valid?: boolean;
  viesCheckedAt?: IsoDateTime;
  peppolCheckedAt?: IsoDateTime;
  officialLegalName?: string;
  officialBillingAddress?: SalesErpAddress;
};

export type SalesErpCustomer = SalesErpSourceIdentity & {
  relationType: "CUSTOMER" | "PROSPECT";
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  legalName: string;
  displayName: string;
  vatNumber?: string;
  preferredLanguage: SalesErpLanguageCode;
  scope: SalesErpScopeReference;
  contacts: SalesErpContact[];
  addresses: SalesErpAddress[];
  billingValidation: SalesErpBillingValidation;
  isDemo: boolean;
};

export type SalesErpAppointmentStatus =
  | "PLANNED"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "MOVED"
  | "CANCELLED";

export type SalesErpAppointment = SalesErpSourceIdentity & {
  businessDate: IsoDate;
  startsAt?: IsoDateTime;
  endsAt?: IsoDateTime;
  timeZone: string;
  sequence: number;
  status: SalesErpAppointmentStatus;
  customerExternalId: string;
  representativeExternalId: string;
  teamExternalId?: string;
  country: SalesErpCountryCode;
  outcomeReasonExternalId?: string;
  outcomeComment?: string;
};

export type SalesErpPrice = SalesErpSourceIdentity & {
  country: SalesErpCountryCode;
  currency: SalesErpCurrencyCode;
  type: "SALES" | "CONTRACT";
  amount: DecimalString;
  validFrom: IsoDate;
  validUntil?: IsoDate;
};

export type SalesErpArticle = SalesErpSourceIdentity & {
  articleNumber: string;
  stemNumber?: string;
  descriptionNl: string;
  descriptionFr: string;
  descriptionDe: string;
  unit: string;
  vatRate: DecimalString;
  active: boolean;
  carrierBound: boolean;
  lotTrackingRequired: boolean;
  expiryTrackingRequired: boolean;
  prices: SalesErpPrice[];
};

export type SalesErpHistoryLine = {
  lineNumber: number;
  articleExternalId: string;
  articleNumberSnapshot: string;
  descriptionSnapshot: string;
  quantity: DecimalString;
  unitSnapshot: string;
  unitPriceSnapshot: DecimalString;
  vatRateSnapshot: DecimalString;
  lineAmountExcludingVat: DecimalString;
  carrierExternalId?: string;
};

export type SalesErpCommercialHistoryDocument = SalesErpSourceIdentity & {
  documentType: "QUOTE" | "ORDER" | "DELIVERY" | "INVOICE" | "CREDIT_NOTE";
  documentNumber: string;
  documentDate: IsoDate;
  customerExternalId: string;
  representativeExternalId?: string;
  currency: SalesErpCurrencyCode;
  amountExcludingVat: DecimalString;
  amountIncludingVat: DecimalString;
  paymentStatus: "NOT_APPLICABLE" | "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  openAmount: DecimalString;
  lines: SalesErpHistoryLine[];
};

export type SalesErpReplenishmentLine = {
  externalId: string;
  articleExternalId: string;
  articleNumberSnapshot: string;
  expectedQuantity: DecimalString;
  unitSnapshot: string;
  lotNumber?: string;
  expiryDate?: IsoDate;
};

export type SalesErpReplenishment = SalesErpSourceIdentity & {
  shipmentNumber: string;
  status: "IN_TRANSIT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  country: SalesErpCountryCode;
  representativeExternalId: string;
  shippedAt: IsoDateTime;
  lines: SalesErpReplenishmentLine[];
};

export type SalesErpCashBalance = SalesErpSourceIdentity & {
  representativeExternalId: string;
  country: SalesErpCountryCode;
  currency: SalesErpCurrencyCode;
  balance: DecimalString;
  lastDepositConfirmedAt?: IsoDateTime;
};

export type SalesErpReferenceItem = SalesErpSourceIdentity & {
  code: string;
  labelNl: string;
  labelFr: string;
  labelDe: string;
  country?: SalesErpCountryCode;
  active: boolean;
  requiresComment: boolean;
};

export type SalesErpPaymentMethod = SalesErpReferenceItem & {
  affectsCashBalance: boolean;
};

export type SalesErpCustomerLocation = SalesErpSourceIdentity & {
  customerExternalId: string;
  parentLocationExternalId?: string;
  type: "LOCATION" | "SUBLOCATION" | "CARRIER";
  name: string;
  linkedArticleExternalId?: string;
  archived: boolean;
};

export type SalesErpCarrierBalance = SalesErpSourceIdentity & {
  carrierExternalId: string;
  articleExternalId: string;
  quantity: DecimalString;
  unit: string;
  lotNumber?: string;
  expiryDate?: IsoDate;
};

export type SalesErpBootstrapResource =
  | "customers"
  | "appointments"
  | "articles"
  | "commercialHistory"
  | "replenishments"
  | "cashBalances"
  | "appointmentOutcomeReasons"
  | "documentCategories"
  | "paymentMethods"
  | "customerLocations"
  | "carrierBalances";

export type SalesErpBootstrapPayloadByResource = {
  customers: SalesErpCustomer;
  appointments: SalesErpAppointment;
  articles: SalesErpArticle;
  commercialHistory: SalesErpCommercialHistoryDocument;
  replenishments: SalesErpReplenishment;
  cashBalances: SalesErpCashBalance;
  appointmentOutcomeReasons: SalesErpReferenceItem;
  documentCategories: SalesErpReferenceItem;
  paymentMethods: SalesErpPaymentMethod;
  customerLocations: SalesErpCustomerLocation;
  carrierBalances: SalesErpCarrierBalance;
};

export type SalesErpBootstrapRequest<K extends SalesErpBootstrapResource = SalesErpBootstrapResource> = {
  resource: K;
  country: SalesErpCountryCode;
  representativeExternalId: string;
  effectiveTeamExternalIds: string[];
  cursor?: string;
  pageSize?: number;
};

export type SalesErpBootstrapPage<K extends SalesErpBootstrapResource = SalesErpBootstrapResource> = {
  schemaVersion: SalesErpSchemaVersion;
  provider: SalesErpProvider;
  resource: K;
  generatedAt: IsoDateTime;
  sourceCheckpoint: string;
  items: SalesErpBootstrapPayloadByResource[K][];
  nextCursor?: string;
};

export type SalesErpEventType =
  | "customer.upserted"
  | "appointment.upserted"
  | "article.upserted"
  | "commercial-history.upserted"
  | "replenishment.upserted"
  | "cash-balance.upserted"
  | "appointment-outcome-reason.upserted"
  | "document-category.upserted"
  | "payment-method.upserted"
  | "customer-location.upserted"
  | "carrier-balance.upserted";

export type SalesErpEventPayloadByType = {
  "customer.upserted": SalesErpCustomer;
  "appointment.upserted": SalesErpAppointment;
  "article.upserted": SalesErpArticle;
  "commercial-history.upserted": SalesErpCommercialHistoryDocument;
  "replenishment.upserted": SalesErpReplenishment;
  "cash-balance.upserted": SalesErpCashBalance;
  "appointment-outcome-reason.upserted": SalesErpReferenceItem;
  "document-category.upserted": SalesErpReferenceItem;
  "payment-method.upserted": SalesErpPaymentMethod;
  "customer-location.upserted": SalesErpCustomerLocation;
  "carrier-balance.upserted": SalesErpCarrierBalance;
};

export type SalesErpEventEnvelope<K extends SalesErpEventType = SalesErpEventType> = {
  schemaVersion: SalesErpSchemaVersion;
  provider: SalesErpProvider;
  messageId: string;
  eventType: K;
  entityExternalId: string;
  sourceVersion: string;
  occurredAt: IsoDateTime;
  payload: SalesErpEventPayloadByType[K];
};

export type SalesErpEvent = {
  [K in SalesErpEventType]: SalesErpEventEnvelope<K>;
}[SalesErpEventType];

export type SalesErpEventPage = {
  schemaVersion: SalesErpSchemaVersion;
  provider: SalesErpProvider;
  events: SalesErpEvent[];
  nextCursor: string;
  hasMore: boolean;
};

export type SalesErpCommandContext = {
  actorUserId: string;
  representativeExternalId: string;
  deviceId: string;
  country: SalesErpCountryCode;
  appointmentExternalId?: string;
};

export type SalesErpCustomerUpsertCommand = {
  localRelationId: string;
  externalId?: string;
  relationType: "CUSTOMER" | "PROSPECT";
  expectedSourceVersion?: string;
  legalName: string;
  displayName: string;
  vatNumber?: string;
  preferredLanguage: SalesErpLanguageCode;
  contacts: Omit<SalesErpContact, keyof SalesErpSourceIdentity>[];
  addresses: Omit<SalesErpAddress, keyof SalesErpSourceIdentity>[];
  validation: SalesErpBillingValidation;
};

export type SalesErpAppointmentUpsertCommand = {
  localAppointmentId?: string;
  externalId?: string;
  expectedSourceVersion?: string;
  businessDate: IsoDate;
  startsAt?: IsoDateTime;
  endsAt?: IsoDateTime;
  timeZone: string;
  sequence: number;
  customerExternalId: string;
  representativeExternalId: string;
};

export type SalesErpAppointmentOutcomeCommand = {
  localAppointmentId?: string;
  appointmentExternalId?: string;
  expectedSourceVersion?: string;
  outcome: "COMPLETED" | "NOT_COMPLETED" | "MOVED" | "CANCELLED";
  reasonExternalId?: string;
  comment?: string;
  completedAt: IsoDateTime;
};

export type SalesErpVisitReportCommand = {
  localAppointmentId?: string;
  appointmentExternalId?: string;
  localReportId?: string;
  html: string;
  closedAt: IsoDateTime;
};

export type SalesErpVisitReportAddendumCommand = {
  localAppointmentId?: string;
  appointmentExternalId?: string;
  localReportId?: string;
  reportExternalId?: string;
  localAddendumId: string;
  reason: string;
  html: string;
  createdAt: IsoDateTime;
};

export type SalesErpLeadCommand = {
  localAppointmentId?: string;
  appointmentExternalId?: string;
  localLeadId: string;
  customerExternalId: string;
  title: string;
  description?: string;
};

export type SalesErpFollowUpCommand = {
  localAppointmentId?: string;
  appointmentExternalId?: string;
  localFollowUpId: string;
  customerExternalId: string;
  type: string;
  description: string;
};

export type SalesErpReferenceCommand = {
  localAppointmentId?: string;
  appointmentExternalId?: string;
  localReferenceId: string;
  referringCustomerExternalId: string;
  proposedName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  comment?: string;
};

export type SalesErpSalesDocumentLineCommand = {
  lineId: string;
  articleExternalId: string;
  articleNumberSnapshot: string;
  descriptionSnapshot: string;
  quantity: DecimalString;
  unitSnapshot: string;
  unitPriceSnapshot: DecimalString;
  vatRateSnapshot: DecimalString;
  customerCarrierExternalId?: string;
};

export type SalesErpSignatureEvidence = {
  signed: boolean;
  signedByName?: string;
  signedAt: IsoDateTime;
  documentSha256: string;
  signatureUploadToken?: string;
  exceptionReasonCode?: string;
  exceptionComment?: string;
};

export type SalesErpSalesDocumentCommand = {
  localDocumentId: string;
  documentType: "ORDER" | "ORDER_ALREADY_DELIVERED" | "INVOICE";
  reservedDocumentNumber: string;
  customerExternalId: string;
  appointmentExternalId: string;
  documentDate: IsoDate;
  language: SalesErpLanguageCode;
  currency: SalesErpCurrencyCode;
  proposedDocumentType: "ORDER" | "ORDER_ALREADY_DELIVERED" | "INVOICE";
  overrideReasonCode?: string;
  overrideComment?: string;
  lines: SalesErpSalesDocumentLineCommand[];
  signature: SalesErpSignatureEvidence;
};

export type SalesErpCustomerLocationCommand = {
  localLocationId: string;
  externalId?: string;
  expectedSourceVersion?: string;
  customerExternalId: string;
  parentLocationExternalId?: string;
  type: "LOCATION" | "SUBLOCATION" | "CARRIER";
  name: string;
  linkedArticleExternalId?: string;
  archived: boolean;
  archiveReasonCode?: string;
};

export type SalesErpCarrierCountLine = {
  articleExternalId: string;
  countedQuantity: DecimalString;
  theoreticalQuantity: DecimalString;
  unit: string;
  reasonCode?: string;
  lotNumber?: string;
  expiryDate?: IsoDate;
};

export type SalesErpCarrierCountCommand = {
  localCountId: string;
  carrierExternalId: string;
  countedAt: IsoDateTime;
  lines: SalesErpCarrierCountLine[];
};

export type SalesErpReceiptLineCommand = {
  replenishmentLineExternalId: string;
  actualQuantity: DecimalString;
  damagedQuantity: DecimalString;
  unit: string;
  discrepancyComment?: string;
};

export type SalesErpReplenishmentReceiptCommand = {
  localReceiptId: string;
  replenishmentExternalId: string;
  receivedAt: IsoDateTime;
  lines: SalesErpReceiptLineCommand[];
  representativeSignatureUploadToken: string;
  photoUploadTokens: string[];
};

export type SalesErpConsumablesRequestLine = {
  articleExternalId: string;
  quantity: DecimalString;
  unit: string;
};

export type SalesErpConsumablesRequestCommand = {
  localRequestId: string;
  requestedAt: IsoDateTime;
  lines: SalesErpConsumablesRequestLine[];
};

export type SalesErpDayCloseCommand = {
  localDayCloseId: string;
  businessDate: IsoDate;
  closedAt: IsoDateTime;
  appointmentExternalIds: string[];
  localAppointmentIds?: string[];
};

export type SalesErpAttachmentCommand = {
  localAttachmentId: string;
  targetType: "APPOINTMENT" | "CUSTOMER";
  targetExternalId: string;
  categoryExternalId: string;
  uploadToken: string;
  fileName: string;
  mimeType: string;
  sha256: string;
};

export type SalesErpCommandType =
  | "customer.upsert"
  | "appointment.upsert"
  | "appointment.outcome"
  | "visit-report.submit"
  | "visit-report.addendum"
  | "lead.create"
  | "follow-up.create"
  | "reference.create"
  | "sales-document.create"
  | "customer-location.upsert"
  | "carrier-count.submit"
  | "replenishment-receipt.submit"
  | "consumables-request.create"
  | "day-close.submit"
  | "attachment.submit";

export type SalesErpCommandPayloadByType = {
  "customer.upsert": SalesErpCustomerUpsertCommand;
  "appointment.upsert": SalesErpAppointmentUpsertCommand;
  "appointment.outcome": SalesErpAppointmentOutcomeCommand;
  "visit-report.submit": SalesErpVisitReportCommand;
  "visit-report.addendum": SalesErpVisitReportAddendumCommand;
  "lead.create": SalesErpLeadCommand;
  "follow-up.create": SalesErpFollowUpCommand;
  "reference.create": SalesErpReferenceCommand;
  "sales-document.create": SalesErpSalesDocumentCommand;
  "customer-location.upsert": SalesErpCustomerLocationCommand;
  "carrier-count.submit": SalesErpCarrierCountCommand;
  "replenishment-receipt.submit": SalesErpReplenishmentReceiptCommand;
  "consumables-request.create": SalesErpConsumablesRequestCommand;
  "day-close.submit": SalesErpDayCloseCommand;
  "attachment.submit": SalesErpAttachmentCommand;
};

export type SalesErpCommandEnvelope<K extends SalesErpCommandType = SalesErpCommandType> = {
  schemaVersion: SalesErpSchemaVersion;
  commandId: string;
  commandType: K;
  businessKey: string;
  idempotencyKey: string;
  issuedAt: IsoDateTime;
  conflictPriority: "FIELDFORCE";
  dependsOnCommandIds: string[];
  context: SalesErpCommandContext;
  payload: SalesErpCommandPayloadByType[K];
};

export type SalesErpCommand = {
  [K in SalesErpCommandType]: SalesErpCommandEnvelope<K>;
}[SalesErpCommandType];

export type SalesErpCommandAcknowledgement = {
  schemaVersion: SalesErpSchemaVersion;
  provider: SalesErpProvider;
  commandId: string;
  idempotencyKey: string;
  status: "ACCEPTED" | "REJECTED" | "RETRYABLE";
  acknowledgedAt: IsoDateTime;
  externalEntityId?: string;
  sourceVersion?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type SalesErpReconciliationRequest = {
  commandIds: string[];
  since?: IsoDateTime;
};

export type SalesErpReconciliationResult = {
  schemaVersion: SalesErpSchemaVersion;
  provider: SalesErpProvider;
  checkedAt: IsoDateTime;
  acknowledgements: SalesErpCommandAcknowledgement[];
  unknownCommandIds: string[];
};

export type SalesErpCapabilities = {
  schemaVersion: SalesErpSchemaVersion;
  provider: SalesErpProvider;
  supportsPushEvents: boolean;
  supportsReservedDocumentNumbers: boolean;
  supportsCustomerWritePriority: boolean;
  supportsAppointmentWritePriority: boolean;
  supportedBootstrapResources: SalesErpBootstrapResource[];
  supportedCommands: SalesErpCommandType[];
};
