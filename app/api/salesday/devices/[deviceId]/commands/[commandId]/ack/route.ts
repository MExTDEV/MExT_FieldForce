import { handleApi, unauthorized } from "@/lib/server/api";
import { rethrowDeviceSecurityError } from "@/lib/server/salesday-device-api";
import { acknowledgeDeviceControl } from "@/lib/server/salesday-device-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ deviceId: string; commandId: string }> },
) {
  return handleApi("api/salesday/devices/:deviceId/commands/:commandId/ack", async () => {
    const { deviceId, commandId } = await context.params;
    const deviceToken = request.headers.get("x-fieldforce-device-token");
    if (!deviceToken) unauthorized("Toestelautorisatie ontbreekt.");
    try {
      return { command: await acknowledgeDeviceControl(deviceId, deviceToken, commandId) };
    } catch (error) {
      rethrowDeviceSecurityError(error);
    }
  }, "Toestelopdracht kon niet worden bevestigd.");
}
