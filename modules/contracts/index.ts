/**
 * Stable cross-module contracts for FieldForce.
 *
 * This file intentionally contains types only. It must not import module
 * implementations, Prisma models or UI components.
 */

export type ModuleId =
  | "coaching"
  | "sales"
  | "inventory"
  | "service"
  | "pst"
  | "contract";

export type CountryCode = "BE" | "NL" | "DE";
export type LanguageCode = "nl" | "fr" | "de";

export type ModuleRole =
  | "REPRESENTATIVE"
  | "SALES_LEADER"
  | "COUNTRY_MANAGER"
  | "SALES_MANAGER"
  | "GROUP_MANAGER"
  | "SERVICE_OPERATOR"
  | "ADMIN"
  | "SUPER_ADMIN";

export type EntityRef<TType extends string = string> = {
  type: TType;
  id: string;
  version?: string | null;
};

export type ModuleActorContext = {
  userId: string;
  role: ModuleRole;
  country: CountryCode;
  language: LanguageCode;
  teamIds: string[];
  permissions: string[];
  sessionId?: string | null;
  deviceId?: string | null;
};

export type ModuleRequestContext = {
  actor: ModuleActorContext;
  correlationId: string;
  idempotencyKey?: string | null;
  requestedAt: string;
  offline: boolean;
};

export type IntegrationCommand<
  TType extends string = string,
  TPayload = unknown,
> = {
  commandId: string;
  commandType: TType;
  version: number;
  context: ModuleRequestContext;
  aggregate: EntityRef;
  dependsOnCommandIds: string[];
  payload: TPayload;
};

export type IntegrationEvent<
  TType extends string = string,
  TPayload = unknown,
> = {
  eventId: string;
  eventType: TType;
  version: number;
  occurredAt: string;
  sourceModule: ModuleId;
  aggregate: EntityRef;
  actor: ModuleActorContext;
  payload: TPayload;
};

export type ContractAccess = {
  allowed: boolean;
  reasonCode?: string;
  reason?: string;
};

export type SalesInventoryPort = {
  getRepresentativeStockSnapshot(input: {
    actor: ModuleActorContext;
    representativeId: string;
    articleIds: string[];
  }): Promise<{
    articleId: string;
    availableQuantity: string;
    unit: string;
    lotNumber?: string | null;
    expiryDate?: string | null;
  }[]>;
  requestMovement(input: IntegrationCommand<"inventory.movement.request", {
    articleId: string;
    quantity: string;
    unit: string;
    sourceLocationId: string;
    destinationLocationId?: string | null;
    reason: "SALE" | "SERVICE" | "REPLENISHMENT";
    sourceDocument: EntityRef;
  }>): Promise<{ commandId: string; accepted: boolean }>;
};

export type SalesContractPort = {
  getContractContext(input: {
    actor: ModuleActorContext;
    customerId: string;
    articleIds: string[];
    at: string;
  }): Promise<{
    access: ContractAccess;
    contractId?: string | null;
    allowedArticleIds: string[];
    priceListId?: string | null;
    currency: string;
  }>;
};

export type ServiceInventoryPort = {
  recordConsumption(input: IntegrationCommand<"inventory.consumption.record", {
    serviceInterventionId: string;
    lines: Array<{
      articleId: string;
      quantity: string;
      unit: string;
      lotNumber?: string | null;
    }>;
  }>): Promise<{ commandId: string; accepted: boolean }>;
};

export type ServiceContractPort = {
  getServiceEntitlement(input: {
    actor: ModuleActorContext;
    customerId: string;
    assetId?: string | null;
    at: string;
  }): Promise<{
    access: ContractAccess;
    contractId?: string | null;
    entitlementType?: string | null;
    validUntil?: string | null;
  }>;
};

export type PstSalesPort = {
  resolveProspect(input: {
    actor: ModuleActorContext;
    prospectId: string;
  }): Promise<{
    prospectId: string;
    customerId?: string | null;
    displayName: string;
    country: CountryCode;
  }>;
  recordVisitOutcome(input: IntegrationCommand<"sales.visit.outcome", {
    appointmentId: string;
    outcome: "COMPLETED" | "NOT_COMPLETED" | "MOVED" | "CANCELLED";
    reasonExternalId?: string | null;
  }>): Promise<{ commandId: string; accepted: boolean }>;
};

export type PlatformModuleAccessPort = {
  assertAccess(input: {
    actor: ModuleActorContext;
    module: ModuleId;
    operation: string;
  }): ContractAccess;
};

export type ModuleAuditPort = {
  record(input: {
    actor: ModuleActorContext;
    module: ModuleId;
    action: string;
    aggregate: EntityRef;
    correlationId: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<void>;
};


export type SourceSystem =
  | "FIELD_FORCE"
  | "BUSINESS_CENTRAL_140"
  | "ODOO";

export type SyncState =
  | "LOCAL_ONLY"
  | "PENDING_SYNC"
  | "SYNCED"
  | "REJECTED"
  | "CONFLICT";

export type DataFreshness = {
  sourceSystem: SourceSystem;
  capturedAt: string;
  sourceVersion?: string | null;
  validUntil?: string | null;
};

export type OfflineRecord<TPayload> = {
  entity: EntityRef;
  payload: TPayload;
  syncState: SyncState;
  source: DataFreshness;
  localRevision: number;
  localUpdatedAt: string;
  remoteUpdatedAt?: string | null;
  idempotencyKey: string;
  lastSyncError?: string | null;
};

export type OfflineMutation<
  TType extends string = string,
  TPayload = unknown,
> = IntegrationCommand<TType, TPayload> & {
  sourceSystem: "FIELD_FORCE";
  operation: "CREATE" | "UPDATE" | "CANCEL" | "COMPLETE";
  expectedRemoteVersion?: string | null;
};

export type SyncReceipt = {
  commandId: string;
  accepted: boolean;
  state: SyncState;
  remoteEntity?: EntityRef | null;
  remoteVersion?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type SyncConflict = {
  entity: EntityRef;
  localRevision: number;
  remoteVersion?: string | null;
  detectedAt: string;
  reasonCode:
    | "REMOTE_CHANGED"
    | "STALE_REFERENCE_DATA"
    | "DUPLICATE_IDEMPOTENCY_KEY"
    | "VALIDATION_REJECTED";
  resolution:
    | "KEEP_LOCAL"
    | "KEEP_REMOTE"
    | "MERGE"
    | "MANUAL_REVIEW";
};

export type OfflineDataPolicy = {
  entityType: string;
  canReadOffline: boolean;
  canCreateOffline: boolean;
  canUpdateOffline: boolean;
  requiresRemoteConfirmation: boolean;
  maxReferenceAgeHours?: number | null;
};

export type ErpAdapterPort = {
  system: Exclude<SourceSystem, "FIELD_FORCE">;
  pullReferenceData(input: {
    actor: ModuleActorContext;
    entityTypes: string[];
    changedSince?: string | null;
    cursor?: string | null;
  }): Promise<{
    records: Array<OfflineRecord<unknown>>;
    nextCursor?: string | null;
  }>;
  pushMutations(input: {
    actor: ModuleActorContext;
    mutations: Array<OfflineMutation>;
  }): Promise<{
    receipts: SyncReceipt[];
  }>;
};
