import {
  SALES_ERP_SCHEMA_VERSION,
  type SalesErpBootstrapPage,
  type SalesErpBootstrapPayloadByResource,
  type SalesErpBootstrapRequest,
  type SalesErpBootstrapResource,
  type SalesErpCapabilities,
  type SalesErpCommand,
  type SalesErpCommandAcknowledgement,
  type SalesErpCommandType,
  type SalesErpEvent,
  type SalesErpEventPage,
  type SalesErpReconciliationRequest,
  type SalesErpReconciliationResult,
} from "./contracts";
import { SalesErpError, invalidSalesErpContract } from "./errors";
import { salesErpMockDataset, salesErpMockEvents, type SalesErpMockDataset } from "./fixtures";
import {
  createSalesErpIdempotencyKey,
  fingerprintSalesErpCommand,
} from "./idempotency";
import type { SalesErpEventRequest, SalesErpPort } from "./port";

const bootstrapResources: SalesErpBootstrapResource[] = [
  "customers",
  "appointments",
  "articles",
  "commercialHistory",
  "replenishments",
  "cashBalances",
  "appointmentOutcomeReasons",
  "documentCategories",
  "paymentMethods",
  "customerLocations",
  "carrierBalances",
];

const supportedCommands: SalesErpCommandType[] = [
  "customer.upsert",
  "appointment.upsert",
  "appointment.outcome",
  "visit-report.submit",
  "visit-report.addendum",
  "lead.create",
  "follow-up.create",
  "reference.create",
  "sales-document.create",
  "customer-location.upsert",
  "carrier-count.submit",
  "replenishment-receipt.submit",
  "consumables-request.create",
  "day-close.submit",
  "attachment.submit",
];

type MockOutcome = SalesErpCommandAcknowledgement["status"];

export type SalesErpMockAdapterOptions = {
  now?: () => Date;
  defaultPageSize?: number;
  dataset?: SalesErpMockDataset;
  events?: SalesErpEvent[];
  commandOutcomes?: Partial<Record<SalesErpCommandType, MockOutcome>>;
};

function pageSize(requested: number | undefined, fallback: number): number {
  const value = requested ?? fallback;
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    invalidSalesErpContract("Page size must be an integer between 1 and 500");
  }
  return value;
}

function parseCursor(cursor: string | undefined, prefix: string): number {
  if (!cursor) return 0;
  const match = new RegExp(`^${prefix}:(\\d+)$`).exec(cursor);
  if (!match) {
    throw new SalesErpError({
      code: "CURSOR_INVALID",
      message: `Invalid Sales ERP cursor for ${prefix}`,
      details: { cursor },
    });
  }
  return Number(match[1]);
}

export class SalesErpMockAdapter implements SalesErpPort {
  readonly provider = "MOCK" as const;

  private readonly now: () => Date;
  private readonly defaultPageSize: number;
  private readonly dataset: SalesErpMockDataset;
  private readonly events: SalesErpEvent[];
  private readonly commandOutcomes: Partial<Record<SalesErpCommandType, MockOutcome>>;
  private readonly acknowledgementsByCommandId = new Map<string, SalesErpCommandAcknowledgement>();
  private readonly commandsByIdempotencyKey = new Map<
    string,
    { fingerprint: string; acknowledgement: SalesErpCommandAcknowledgement }
  >();
  private readonly submittedCommands: SalesErpCommand[] = [];

  constructor(options: SalesErpMockAdapterOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.defaultPageSize = pageSize(options.defaultPageSize, 100);
    this.dataset = options.dataset ?? salesErpMockDataset;
    this.events = options.events ?? salesErpMockEvents;
    this.commandOutcomes = options.commandOutcomes ?? {};
  }

  async getCapabilities(): Promise<SalesErpCapabilities> {
    return {
      schemaVersion: SALES_ERP_SCHEMA_VERSION,
      provider: this.provider,
      supportsPushEvents: false,
      supportsReservedDocumentNumbers: false,
      supportsCustomerWritePriority: true,
      supportsAppointmentWritePriority: true,
      supportedBootstrapResources: [...bootstrapResources],
      supportedCommands: [...supportedCommands],
    };
  }

  async getBootstrapPage<K extends SalesErpBootstrapResource>(
    request: SalesErpBootstrapRequest<K>,
  ): Promise<SalesErpBootstrapPage<K>> {
    const offset = parseCursor(request.cursor, `bootstrap-${request.resource}`);
    const limit = pageSize(request.pageSize, this.defaultPageSize);
    const source = this.getVisibleItems(request);
    const items = source.slice(offset, offset + limit);
    const nextOffset = offset + items.length;

    return {
      schemaVersion: SALES_ERP_SCHEMA_VERSION,
      provider: this.provider,
      resource: request.resource,
      generatedAt: this.now().toISOString(),
      sourceCheckpoint: `mock-checkpoint-${request.resource}-${source.length}`,
      items,
      nextCursor:
        nextOffset < source.length ? `bootstrap-${request.resource}:${nextOffset}` : undefined,
    };
  }

  async getEvents(request: SalesErpEventRequest = {}): Promise<SalesErpEventPage> {
    const offset = parseCursor(request.cursor, "events");
    const limit = pageSize(request.limit, this.defaultPageSize);
    const events = this.events.slice(offset, offset + limit);
    const nextOffset = offset + events.length;

    return {
      schemaVersion: SALES_ERP_SCHEMA_VERSION,
      provider: this.provider,
      events,
      nextCursor: `events:${nextOffset}`,
      hasMore: nextOffset < this.events.length,
    };
  }

  async submitCommand(command: SalesErpCommand): Promise<SalesErpCommandAcknowledgement> {
    if (command.schemaVersion !== SALES_ERP_SCHEMA_VERSION) {
      invalidSalesErpContract(`Unsupported Sales ERP schema version: ${command.schemaVersion}`);
    }

    const fingerprint = fingerprintSalesErpCommand(command);
    const previous = this.commandsByIdempotencyKey.get(command.idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new SalesErpError({
          code: "IDEMPOTENCY_CONFLICT",
          message: "An idempotency key was reused for a different command payload",
          details: { commandId: command.commandId, idempotencyKey: command.idempotencyKey },
        });
      }
      return previous.acknowledgement;
    }

    const expectedIdempotencyKey = createSalesErpIdempotencyKey({
      commandType: command.commandType,
      businessKey: command.businessKey,
      context: command.context,
      payload: command.payload,
    });
    if (command.idempotencyKey !== expectedIdempotencyKey) {
      invalidSalesErpContract("Command idempotency key does not match its semantic payload", {
        commandId: command.commandId,
      });
    }

    const unresolvedDependency = command.dependsOnCommandIds.find(
      (commandId) => this.acknowledgementsByCommandId.get(commandId)?.status !== "ACCEPTED",
    );
    if (unresolvedDependency) {
      return this.createAcknowledgement(command, "RETRYABLE", {
        errorCode: "DEPENDENCY_NOT_ACKNOWLEDGED",
        errorMessage: `Dependency ${unresolvedDependency} is not acknowledged`,
      });
    }

    const outcome = this.commandOutcomes[command.commandType] ?? "ACCEPTED";
    if (outcome === "RETRYABLE") {
      return this.createAcknowledgement(command, outcome, {
        errorCode: "MOCK_RETRYABLE",
        errorMessage: "Deterministic mock retry requested",
      });
    }

    const acknowledgement = this.createAcknowledgement(
      command,
      outcome,
      outcome === "ACCEPTED"
        ? {
            externalEntityId: `mock:${command.commandType}:${command.businessKey}`,
            sourceVersion: `mock-command-v${this.submittedCommands.length + 1}`,
          }
        : { errorCode: "MOCK_REJECTED", errorMessage: "Deterministic mock rejection requested" },
    );

    this.submittedCommands.push(command);
    this.acknowledgementsByCommandId.set(command.commandId, acknowledgement);
    this.commandsByIdempotencyKey.set(command.idempotencyKey, { fingerprint, acknowledgement });
    return acknowledgement;
  }

  async getCommandStatus(commandId: string): Promise<SalesErpCommandAcknowledgement | undefined> {
    return this.acknowledgementsByCommandId.get(commandId);
  }

  async reconcile(request: SalesErpReconciliationRequest): Promise<SalesErpReconciliationResult> {
    const acknowledgements = request.commandIds.flatMap((commandId) => {
      const acknowledgement = this.acknowledgementsByCommandId.get(commandId);
      return acknowledgement ? [acknowledgement] : [];
    });
    const acknowledgedIds = new Set(acknowledgements.map((item) => item.commandId));

    return {
      schemaVersion: SALES_ERP_SCHEMA_VERSION,
      provider: this.provider,
      checkedAt: this.now().toISOString(),
      acknowledgements,
      unknownCommandIds: request.commandIds.filter((commandId) => !acknowledgedIds.has(commandId)),
    };
  }

  inspectSubmittedCommands(): readonly SalesErpCommand[] {
    return [...this.submittedCommands];
  }

  private createAcknowledgement(
    command: SalesErpCommand,
    status: MockOutcome,
    extra: Partial<SalesErpCommandAcknowledgement> = {},
  ): SalesErpCommandAcknowledgement {
    return {
      schemaVersion: SALES_ERP_SCHEMA_VERSION,
      provider: this.provider,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      status,
      acknowledgedAt: this.now().toISOString(),
      ...extra,
    };
  }

  private getVisibleItems<K extends SalesErpBootstrapResource>(
    request: SalesErpBootstrapRequest<K>,
  ): SalesErpBootstrapPayloadByResource[K][] {
    const visibleCustomerIds = new Set(
      this.dataset.customers
        .filter(
          (customer) =>
            customer.scope.country === request.country &&
            (customer.scope.representativeExternalId === request.representativeExternalId ||
              (customer.scope.teamExternalId !== undefined &&
                request.effectiveTeamExternalIds.includes(customer.scope.teamExternalId))),
        )
        .map((customer) => customer.externalId),
    );
    const visibleLocationIds = new Set(
      this.dataset.customerLocations
        .filter((location) => visibleCustomerIds.has(location.customerExternalId))
        .map((location) => location.externalId),
    );

    switch (request.resource) {
      case "customers":
        return this.dataset.customers.filter((item) => visibleCustomerIds.has(item.externalId)) as SalesErpBootstrapPayloadByResource[K][];
      case "appointments":
        return this.dataset.appointments.filter(
          (item) =>
            item.country === request.country &&
            (item.representativeExternalId === request.representativeExternalId ||
              (item.teamExternalId !== undefined && request.effectiveTeamExternalIds.includes(item.teamExternalId))),
        ) as SalesErpBootstrapPayloadByResource[K][];
      case "articles":
        return this.dataset.articles.filter((item) => item.prices.some((price) => price.country === request.country)) as SalesErpBootstrapPayloadByResource[K][];
      case "commercialHistory":
        return this.dataset.commercialHistory.filter((item) => visibleCustomerIds.has(item.customerExternalId)) as SalesErpBootstrapPayloadByResource[K][];
      case "replenishments":
        return this.dataset.replenishments.filter(
          (item) => item.country === request.country && item.representativeExternalId === request.representativeExternalId,
        ) as SalesErpBootstrapPayloadByResource[K][];
      case "cashBalances":
        return this.dataset.cashBalances.filter(
          (item) => item.country === request.country && item.representativeExternalId === request.representativeExternalId,
        ) as SalesErpBootstrapPayloadByResource[K][];
      case "appointmentOutcomeReasons":
        return this.dataset.appointmentOutcomeReasons.filter((item) => !item.country || item.country === request.country) as SalesErpBootstrapPayloadByResource[K][];
      case "documentCategories":
        return this.dataset.documentCategories.filter((item) => !item.country || item.country === request.country) as SalesErpBootstrapPayloadByResource[K][];
      case "paymentMethods":
        return this.dataset.paymentMethods.filter((item) => !item.country || item.country === request.country) as SalesErpBootstrapPayloadByResource[K][];
      case "customerLocations":
        return this.dataset.customerLocations.filter((item) => visibleCustomerIds.has(item.customerExternalId)) as SalesErpBootstrapPayloadByResource[K][];
      case "carrierBalances":
        return this.dataset.carrierBalances.filter((item) => visibleLocationIds.has(item.carrierExternalId)) as SalesErpBootstrapPayloadByResource[K][];
    }
  }
}
