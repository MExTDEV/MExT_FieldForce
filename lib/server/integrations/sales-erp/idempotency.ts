import { createHash, randomUUID } from "node:crypto";

import {
  SALES_ERP_SCHEMA_VERSION,
  type SalesErpCommand,
  type SalesErpCommandContext,
  type SalesErpCommandEnvelope,
  type SalesErpCommandPayloadByType,
  type SalesErpCommandType,
} from "./contracts";
import { invalidSalesErpContract } from "./errors";

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function canonicalizeValue(value: unknown): CanonicalJson | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) invalidSalesErpContract("Idempotency input contains an invalid date");
    return value.toISOString();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalidSalesErpContract("Idempotency input contains a non-finite number");
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const canonicalItem = canonicalizeValue(item);
      return canonicalItem === undefined ? null : canonicalItem;
    });
  }

  if (typeof value === "object") {
    const result: { [key: string]: CanonicalJson } = {};
    for (const key of Object.keys(value).sort()) {
      const canonicalItem = canonicalizeValue((value as Record<string, unknown>)[key]);
      if (canonicalItem !== undefined) result[key] = canonicalItem;
    }
    return result;
  }

  invalidSalesErpContract(`Unsupported idempotency input type: ${typeof value}`);
}

export function canonicalSalesErpJson(value: unknown): string {
  const canonicalValue = canonicalizeValue(value);
  if (canonicalValue === undefined) invalidSalesErpContract("Idempotency input cannot be undefined");
  return JSON.stringify(canonicalValue);
}

export function hashSalesErpContract(value: unknown): string {
  return createHash("sha256").update(canonicalSalesErpJson(value), "utf8").digest("hex");
}

export function createSalesErpIdempotencyKey<K extends SalesErpCommandType>(input: {
  commandType: K;
  businessKey: string;
  context: SalesErpCommandContext;
  payload: SalesErpCommandPayloadByType[K];
}): string {
  if (!input.businessKey.trim()) invalidSalesErpContract("A Sales ERP command requires a business key");

  return `sales-erp:v1:${input.commandType}:${hashSalesErpContract({
    businessKey: input.businessKey,
    context: input.context,
    payload: input.payload,
  })}`;
}

export function fingerprintSalesErpCommand(command: SalesErpCommand): string {
  return hashSalesErpContract({
    schemaVersion: command.schemaVersion,
    commandType: command.commandType,
    businessKey: command.businessKey,
    conflictPriority: command.conflictPriority,
    dependsOnCommandIds: [...command.dependsOnCommandIds].sort(),
    context: command.context,
    payload: command.payload,
  });
}

export function buildSalesErpCommand<K extends SalesErpCommandType>(input: {
  commandType: K;
  businessKey: string;
  context: SalesErpCommandContext;
  payload: SalesErpCommandPayloadByType[K];
  commandId?: string;
  issuedAt?: string;
  dependsOnCommandIds?: string[];
}): SalesErpCommandEnvelope<K> {
  const commandId = input.commandId ?? randomUUID();
  if (!commandId.trim()) invalidSalesErpContract("A Sales ERP command requires a command id");

  return {
    schemaVersion: SALES_ERP_SCHEMA_VERSION,
    commandId,
    commandType: input.commandType,
    businessKey: input.businessKey,
    idempotencyKey: createSalesErpIdempotencyKey(input),
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    conflictPriority: "FIELDFORCE",
    dependsOnCommandIds: [...(input.dependsOnCommandIds ?? [])].sort(),
    context: input.context,
    payload: input.payload,
  };
}
