import { ErpIntegrationProvider } from "@prisma/client";

import type { SalesErpProvider } from "./contracts";
import { SalesErpError, type SalesErpErrorCode } from "./errors";

export type SalesErpWorkerPolicy = {
  leaseMs?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  repeatedFailureThreshold?: number;
};

export type NormalizedSalesErpWorkerPolicy = {
  leaseMs: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  repeatedFailureThreshold: number;
};

export function normalizeSalesErpWorkerPolicy(
  policy: SalesErpWorkerPolicy = {},
): NormalizedSalesErpWorkerPolicy {
  const normalized = {
    leaseMs: policy.leaseMs ?? 60_000,
    baseRetryDelayMs: policy.baseRetryDelayMs ?? 5_000,
    maxRetryDelayMs: policy.maxRetryDelayMs ?? 15 * 60_000,
    repeatedFailureThreshold: policy.repeatedFailureThreshold ?? 5,
  };
  if (
    normalized.leaseMs < 1_000 ||
    normalized.baseRetryDelayMs < 0 ||
    normalized.maxRetryDelayMs < normalized.baseRetryDelayMs ||
    normalized.repeatedFailureThreshold < 1
  ) {
    throw new SalesErpError({ code: "INVALID_CONTRACT", message: "Invalid Sales ERP worker policy" });
  }
  return normalized;
}

export function nextSalesErpRetryAt(
  now: Date,
  attemptCount: number,
  policy: NormalizedSalesErpWorkerPolicy,
): Date {
  const exponent = Math.max(0, Math.min(attemptCount - 1, 20));
  const delay = Math.min(policy.maxRetryDelayMs, policy.baseRetryDelayMs * 2 ** exponent);
  return new Date(now.getTime() + delay);
}

export function salesErpErrorDetails(error: unknown): {
  code: SalesErpErrorCode | "UNEXPECTED_ERROR";
  message: string;
  retryable: boolean;
} {
  if (error instanceof SalesErpError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : "Unknown Sales ERP worker error",
    retryable: true,
  };
}

export function prismaSalesErpProvider(provider: SalesErpProvider): ErpIntegrationProvider {
  return provider as ErpIntegrationProvider;
}
