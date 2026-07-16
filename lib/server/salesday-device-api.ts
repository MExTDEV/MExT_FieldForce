import { ApiRequestError } from "@/lib/server/api";
import { SalesDeviceRegistrationError } from "@/lib/server/salesday-device-registration";
import { DeviceSecurityError } from "@/lib/server/salesday-device-security";

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

export function rethrowDeviceSecurityError(error: unknown): never {
  if (!(error instanceof DeviceSecurityError)) throw error;
  const status = error.code === "DEVICE_NOT_FOUND" ||
      error.code === "CHALLENGE_NOT_FOUND" ||
      error.code === "CONTROL_NOT_FOUND"
    ? 404
    : error.code === "ROLE_NOT_ALLOWED" ||
        error.code === "MANAGE_PERMISSION_REQUIRED" ||
        error.code === "OUTSIDE_SCOPE"
      ? 403
      : error.code === "DEVICE_TOKEN_INVALID"
        ? 401
        : error.code === "DEVICE_REVOKED" ||
            error.code === "CHALLENGE_EXPIRED" ||
            error.code === "CHALLENGE_CONSUMED" ||
            error.code === "CHALLENGE_MISMATCH" ||
            error.code === "SESSION_MISMATCH" ||
            error.code === "SESSION_NOT_FOUND" ||
            error.code === "FINGERPRINT_IN_USE"
          ? 409
          : 400;
  throw new ApiRequestError(error.message, status);
}
