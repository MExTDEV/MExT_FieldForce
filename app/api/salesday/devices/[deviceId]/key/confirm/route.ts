import { handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { rethrowDeviceSecurityError } from "@/lib/server/salesday-device-api";
import { completeDeviceKeyProvisioning } from "@/lib/server/salesday-device-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  return handleApi("api/salesday/devices/:deviceId/key/confirm", async () => {
    const { deviceId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(
      typeof body.actorId === "string" ? body.actorId : undefined,
    );
    try {
      const provisioned = await completeDeviceKeyProvisioning(actor, deviceId, loginSessionId, {
        challengeId: String(body.challengeId ?? ""),
        token: String(body.token ?? ""),
        keyFingerprint: String(body.keyFingerprint ?? ""),
      });
      await writeAuditLog({
        actorId: actor.id,
        entityType: "DeviceRegistration",
        entityId: deviceId,
        action: "salesday.device.key.provision",
        newValue: {
          keyVersion: provisioned.keyVersion,
          keyFingerprint: provisioned.keyFingerprint,
          keyProvisionedAt: provisioned.keyProvisionedAt,
        },
      });
      return provisioned;
    } catch (error) {
      rethrowDeviceSecurityError(error);
    }
  }, "Sleutelprovisioning kon niet worden voltooid.");
}
