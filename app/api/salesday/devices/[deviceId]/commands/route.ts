import { handleApi, unauthorized } from "@/lib/server/api";
import { rethrowDeviceSecurityError } from "@/lib/server/salesday-device-api";
import { pollDeviceControls } from "@/lib/server/salesday-device-security";

export async function GET(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  return handleApi("api/salesday/devices/:deviceId/commands", async () => {
    const { deviceId } = await context.params;
    const deviceToken = request.headers.get("x-fieldforce-device-token");
    if (!deviceToken) unauthorized("Toestelautorisatie ontbreekt.");
    try {
      return { commands: await pollDeviceControls(deviceId, deviceToken) };
    } catch (error) {
      rethrowDeviceSecurityError(error);
    }
  }, "Toestelopdrachten konden niet worden geladen.");
}
