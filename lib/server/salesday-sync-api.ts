import { ApiRequestError } from "@/lib/server/api";
import { SalesErpError } from "@/lib/server/integrations/sales-erp";
import { SalesDayDayAccessError } from "@/lib/server/salesday-day-access";
import { SalesDayEmergencyModeError } from "@/lib/server/salesday-emergency-mode";
import { SalesDayFeatureError } from "@/lib/server/salesday-feature-flags";

export function rethrowSalesDaySyncError(error: unknown): never {
  if (error instanceof SalesDayFeatureError) {
    const status = error.code === "FEATURE_DISABLED" || error.code === "PERMISSION_REQUIRED"
      ? 403
      : error.code === "TARGET_NOT_FOUND"
        ? 404
        : 400;
    throw new ApiRequestError(error.message, status);
  }
  if (error instanceof SalesDayDayAccessError) throw new ApiRequestError(error.message, 423);
  if (error instanceof SalesDayEmergencyModeError) {
    const status = error.code === "PERMISSION_REQUIRED"
      ? 403
      : error.code === "NOT_FOUND"
        ? 404
        : error.code === "ALREADY_OPEN"
          ? 409
          : 400;
    throw new ApiRequestError(error.message, status);
  }
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
