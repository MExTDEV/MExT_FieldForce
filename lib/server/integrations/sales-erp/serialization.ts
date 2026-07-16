import type { ErpInboxMessage, ErpOutboxCommand, ErpOutboxDependency } from "@prisma/client";

import {
  SALES_ERP_SCHEMA_VERSION,
  type SalesErpCommand,
  type SalesErpCommandContext,
  type SalesErpCommandType,
  type SalesErpCountryCode,
  type SalesErpEvent,
  type SalesErpEventType,
  type SalesErpProvider,
} from "./contracts";
import { invalidSalesErpContract } from "./errors";
import {
  canonicalSalesErpJson,
  createSalesErpIdempotencyKey,
  fingerprintSalesErpCommand,
  hashSalesErpContract,
} from "./idempotency";

const providers = new Set<SalesErpProvider>(["MOCK", "BC_NAV", "ODOO"]);
const countries = new Set<SalesErpCountryCode>(["BE", "NL", "DE"]);
const commandTypes = new Set<SalesErpCommandType>([
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
]);
const eventTypes = new Set<SalesErpEventType>([
  "customer.upserted",
  "appointment.upserted",
  "article.upserted",
  "commercial-history.upserted",
  "replenishment.upserted",
  "cash-balance.upserted",
  "appointment-outcome-reason.upserted",
  "document-category.upserted",
  "payment-method.upserted",
  "customer-location.upserted",
  "carrier-balance.upserted",
]);

export type PersistedOutboxCommand = ErpOutboxCommand & {
  dependencies: Pick<ErpOutboxDependency, "dependsOnCommandId">[];
};

function parseObject(json: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      invalidSalesErpContract(`${label} must contain a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) invalidSalesErpContract(`${label} contains invalid JSON`);
    throw error;
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) invalidSalesErpContract(`${label} must be a non-empty string`);
  return value;
}

export function assertSalesErpProvider(value: string): asserts value is SalesErpProvider {
  if (!providers.has(value as SalesErpProvider)) invalidSalesErpContract(`Unsupported ERP provider: ${value}`);
}

export function serializeSalesErpCommand(command: SalesErpCommand) {
  if (command.schemaVersion !== SALES_ERP_SCHEMA_VERSION) {
    invalidSalesErpContract(`Unsupported Sales ERP schema version: ${command.schemaVersion}`);
  }
  if (!commandTypes.has(command.commandType)) invalidSalesErpContract(`Unsupported command type: ${command.commandType}`);
  const issuedAt = new Date(command.issuedAt);
  if (Number.isNaN(issuedAt.getTime()) || issuedAt.toISOString() !== command.issuedAt) {
    invalidSalesErpContract("Command issuedAt must be an ISO-8601 UTC timestamp");
  }
  const expectedKey = createSalesErpIdempotencyKey({
    commandType: command.commandType,
    businessKey: command.businessKey,
    context: command.context,
    payload: command.payload,
  });
  if (expectedKey !== command.idempotencyKey) invalidSalesErpContract("Command idempotency key is invalid");

  return {
    contextJson: canonicalSalesErpJson(command.context),
    payloadJson: canonicalSalesErpJson(command.payload),
    commandFingerprint: fingerprintSalesErpCommand(command),
  };
}

export function deserializeSalesErpCommand(row: PersistedOutboxCommand): SalesErpCommand {
  if (row.schemaVersion !== SALES_ERP_SCHEMA_VERSION) {
    invalidSalesErpContract(`Unsupported persisted Sales ERP schema version: ${row.schemaVersion}`);
  }
  if (!commandTypes.has(row.commandType as SalesErpCommandType)) {
    invalidSalesErpContract(`Unsupported persisted command type: ${row.commandType}`);
  }

  const context = parseObject(row.contextJson, "Persisted command context");
  const country = requireString(context.country, "Persisted command country");
  if (!countries.has(country as SalesErpCountryCode)) invalidSalesErpContract(`Unsupported country: ${country}`);
  const typedContext: SalesErpCommandContext = {
    actorUserId: requireString(context.actorUserId, "Persisted command actor"),
    representativeExternalId: requireString(
      context.representativeExternalId,
      "Persisted command Representative",
    ),
    deviceId: requireString(context.deviceId, "Persisted command device"),
    country: country as SalesErpCountryCode,
    appointmentExternalId:
      context.appointmentExternalId === undefined
        ? undefined
        : requireString(context.appointmentExternalId, "Persisted command appointment"),
  };
  if (
    typedContext.actorUserId !== row.actorUserId ||
    typedContext.representativeExternalId !== row.representativeExternalId ||
    typedContext.deviceId !== row.deviceId ||
    typedContext.country !== row.country ||
    typedContext.appointmentExternalId !== (row.appointmentExternalId ?? undefined) ||
    row.conflictPriority !== "FIELDFORCE"
  ) {
    invalidSalesErpContract("Persisted command context does not match its indexed fields", {
      commandId: row.commandId,
    });
  }
  const payload = parseObject(row.payloadJson, "Persisted command payload");
  const command = {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    commandId: row.commandId,
    commandType: row.commandType as SalesErpCommandType,
    businessKey: row.businessKey,
    idempotencyKey: row.idempotencyKey,
    issuedAt: row.issuedAt.toISOString(),
    conflictPriority: "FIELDFORCE" as const,
    dependsOnCommandIds: row.dependencies.map((item) => item.dependsOnCommandId),
    context: typedContext,
    payload,
  } as SalesErpCommand;

  const serialized = serializeSalesErpCommand(command);
  if (serialized.commandFingerprint !== row.commandFingerprint) {
    invalidSalesErpContract("Persisted command fingerprint does not match its content", {
      commandId: row.commandId,
    });
  }
  return command;
}

export function serializeSalesErpEvent(event: SalesErpEvent) {
  if (event.schemaVersion !== SALES_ERP_SCHEMA_VERSION) {
    invalidSalesErpContract(`Unsupported Sales ERP event schema version: ${event.schemaVersion}`);
  }
  if (!eventTypes.has(event.eventType)) invalidSalesErpContract(`Unsupported event type: ${event.eventType}`);
  return {
    payloadJson: canonicalSalesErpJson(event.payload),
    eventFingerprint: hashSalesErpContract(event),
  };
}

export function deserializeSalesErpEvent(row: ErpInboxMessage): SalesErpEvent {
  assertSalesErpProvider(row.provider);
  if (row.schemaVersion !== SALES_ERP_SCHEMA_VERSION) {
    invalidSalesErpContract(`Unsupported persisted event schema version: ${row.schemaVersion}`);
  }
  if (!eventTypes.has(row.eventType as SalesErpEventType)) {
    invalidSalesErpContract(`Unsupported persisted event type: ${row.eventType}`);
  }

  const event = {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    provider: row.provider,
    messageId: row.messageId,
    eventType: row.eventType as SalesErpEventType,
    entityExternalId: row.entityExternalId,
    sourceVersion: row.sourceVersion,
    occurredAt: row.occurredAt.toISOString(),
    payload: parseObject(row.payloadJson, "Persisted event payload"),
  } as SalesErpEvent;
  const serialized = serializeSalesErpEvent(event);
  if (serialized.eventFingerprint !== row.eventFingerprint) {
    invalidSalesErpContract("Persisted event fingerprint does not match its content", {
      messageId: row.messageId,
    });
  }
  return event;
}
