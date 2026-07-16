import { handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { rethrowSalesDeviceRegistrationError } from "@/lib/server/salesday-device-api";
import {
  getOwnActiveSalesDevice,
  registerOwnSalesDevice,
  toSalesDeviceRegistrationResponse,
  type SalesDevicePlatform,
} from "@/lib/server/salesday-device-registration";

export async function GET(request: Request) {
  return handleApi("api/salesday/devices:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    try {
      return {
        registration: toSalesDeviceRegistrationResponse(await getOwnActiveSalesDevice(actor)),
      };
    } catch (error) {
      rethrowSalesDeviceRegistrationError(error);
    }
  }, "Toestelregistratie kon niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/salesday/devices:post", async () => {
    const body = await request.json() as Record<string, unknown>;
    const actor = await requireAuthenticatedUser(typeof body.actorId === "string" ? body.actorId : undefined);
    try {
      const registration = await registerOwnSalesDevice(actor, {
        deviceId: String(body.deviceId ?? ""),
        platform: String(body.platform ?? "") as SalesDevicePlatform,
        deviceLabel: optionalString(body.deviceLabel),
        operatingSystemVersion: optionalString(body.operatingSystemVersion),
        appVersion: optionalString(body.appVersion),
      });
      await writeAuditLog({
        actorId: actor.id,
        entityType: "DeviceRegistration",
        entityId: registration.id,
        action: "salesday.device.register",
        newValue: {
          deviceId: registration.deviceId,
          platform: registration.platform,
          status: registration.status,
        },
      });
      return { registration: toSalesDeviceRegistrationResponse(registration) };
    } catch (error) {
      rethrowSalesDeviceRegistrationError(error);
    }
  }, "Toestel kon niet worden geregistreerd.");
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : value === null ? null : undefined;
}
