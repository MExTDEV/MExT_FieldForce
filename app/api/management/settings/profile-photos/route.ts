import { canAccessManagementSection } from "@/lib/management-access";
import { forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import {
  getLatestProfilePhotoSyncRun,
  startProfilePhotoSyncRun,
} from "@/lib/server/profile-photo-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(
    "api/management/settings/profile-photos:get",
    async () => {
      const url = new URL(request.url);
      const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
      requireSettingsAccess(actor);
      return { run: await getLatestProfilePhotoSyncRun() };
    },
    "Microsoft-profielfotosynchronisatie kon niet worden geladen."
  );
}

export async function POST(request: Request) {
  return handleApi(
    "api/management/settings/profile-photos:post",
    async () => {
      const payload = await readActorPayload(request);
      const actor = await requireAuthenticatedUser(payload.actorId);
      requireSettingsAccess(actor);
      return startProfilePhotoSyncRun({
        trigger: "MANUAL",
        actorId: actor.id,
        runInBackground: false,
      });
    },
    "Microsoft-profielfotosynchronisatie kon niet worden gestart."
  );
}

function requireSettingsAccess(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>
) {
  if (!canAccessManagementSection(actor, "profiel")) {
    forbidden("Je hebt geen toegang tot de algemene instellingen.");
  }
}

async function readActorPayload(request: Request): Promise<{ actorId?: string }> {
  try {
    const payload = await request.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as { actorId?: string }
      : {};
  } catch {
    return {};
  }
}
