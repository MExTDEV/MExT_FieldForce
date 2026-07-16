import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { rethrowDeviceSecurityError } from "@/lib/server/salesday-device-api";
import { startDeviceKeyProvisioning } from "@/lib/server/salesday-device-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  return handleApi("api/salesday/devices/:deviceId/key/challenge", async () => {
    const { deviceId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(
      typeof body.actorId === "string" ? body.actorId : undefined,
    );
    try {
      return await startDeviceKeyProvisioning(actor, deviceId, loginSessionId);
    } catch (error) {
      rethrowDeviceSecurityError(error);
    }
  }, "Sleutelprovisioning kon niet worden gestart.");
}
