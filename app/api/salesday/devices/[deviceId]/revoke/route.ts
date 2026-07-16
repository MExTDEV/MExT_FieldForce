import { handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { rethrowSalesDeviceRegistrationError } from "@/lib/server/salesday-device-api";
import {
  revokeSalesDevice,
  toSalesDeviceRegistrationResponse,
} from "@/lib/server/salesday-device-registration";

export async function POST(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  return handleApi("api/salesday/devices/:deviceId/revoke", async () => {
    const { deviceId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const actor = await requireAuthenticatedUser(typeof body.actorId === "string" ? body.actorId : undefined);
    try {
      const registration = await revokeSalesDevice(actor, deviceId, String(body.reason ?? ""));
      await writeAuditLog({
        actorId: actor.id,
        entityType: "DeviceRegistration",
        entityId: registration.id,
        action: "salesday.device.revoke",
        oldValue: { status: "ACTIVE" },
        newValue: {
          status: registration.status,
          revokedAt: registration.revokedAt,
          revocationReason: registration.revocationReason,
        },
      });
      return { registration: toSalesDeviceRegistrationResponse(registration) };
    } catch (error) {
      rethrowSalesDeviceRegistrationError(error);
    }
  }, "Toestelregistratie kon niet worden ingetrokken.");
}
