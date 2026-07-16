import { ApiRequestError } from "@/lib/server/api";
import { SalesDeviceRegistrationError } from "@/lib/server/salesday-device-registration";

export function rethrowSalesDeviceRegistrationError(error: unknown): never {
  if (!(error instanceof SalesDeviceRegistrationError)) throw error;
  const status = error.code === "DEVICE_NOT_FOUND"
    ? 404
    : error.code === "ROLE_NOT_ALLOWED" ||
        error.code === "MANAGE_PERMISSION_REQUIRED" ||
        error.code === "OUTSIDE_SCOPE"
      ? 403
      : error.code === "ACTIVE_DEVICE_EXISTS" ||
          error.code === "DEVICE_ALREADY_BOUND" ||
          error.code === "DEVICE_REVOKED"
        ? 409
        : 400;
  throw new ApiRequestError(error.message, status);
}
