import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { rethrowSalesDeviceRegistrationError } from "@/lib/server/salesday-device-api";
import {
  refreshOwnSalesDevice,
  toSalesDeviceRegistrationResponse,
} from "@/lib/server/salesday-device-registration";

export async function POST(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  return handleApi("api/salesday/devices/:deviceId/heartbeat", async () => {
    const { deviceId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const actor = await requireAuthenticatedUser(typeof body.actorId === "string" ? body.actorId : undefined);
    try {
      const registration = await refreshOwnSalesDevice(actor, deviceId, {
        deviceLabel: optionalString(body.deviceLabel),
        operatingSystemVersion: optionalString(body.operatingSystemVersion),
        appVersion: optionalString(body.appVersion),
      });
      return { registration: toSalesDeviceRegistrationResponse(registration) };
    } catch (error) {
      rethrowSalesDeviceRegistrationError(error);
    }
  }, "Toestelstatus kon niet worden bijgewerkt.");
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : value === null ? null : undefined;
}
