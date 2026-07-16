import { ApiRequestError } from "@/lib/server/api";
import { SalesErpError } from "@/lib/server/integrations/sales-erp";

export function rethrowSalesDaySyncError(error: unknown): never {
  if (!(error instanceof SalesErpError)) throw error;
  const status = error.code === "PERMISSION_REVOKED"
    ? 403
    : error.retryable
      ? 503
      : error.code === "IDEMPOTENCY_CONFLICT"
        ? 409
        : 400;
  throw new ApiRequestError(error.message, status);
}
