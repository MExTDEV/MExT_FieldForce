import { handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { rethrowDeviceSecurityError } from "@/lib/server/salesday-device-api";
import { requestDeviceControl, type DeviceControlType } from "@/lib/server/salesday-device-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  return handleApi("api/salesday/devices/:deviceId/control", async () => {
    const { deviceId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const actor = await requireAuthenticatedUser(typeof body.actorId === "string" ? body.actorId : undefined);
    try {
      const result = await requestDeviceControl(
        actor,
        deviceId,
        String(body.type ?? "") as DeviceControlType,
        String(body.reason ?? ""),
      );
      await writeAuditLog({
        actorId: actor.id,
        entityType: "DeviceControlCommand",
        entityId: result.command.commandId,
        action: `salesday.device.${result.command.type.toLowerCase()}.request`,
        newValue: {
          deviceId,
          type: result.command.type,
          reason: result.command.reason,
          invalidatedSessionCount: result.invalidatedSessionCount,
          reused: result.reused,
        },
      });
      return result;
    } catch (error) {
      rethrowDeviceSecurityError(error);
    }
  }, "Toestelopdracht kon niet worden aangemaakt.");
}
