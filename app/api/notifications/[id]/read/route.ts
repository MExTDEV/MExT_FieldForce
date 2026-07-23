import { forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { markNotificationAsRead } from "@/lib/server/notifications";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/notifications/read", async () => {
    const { id } = await context.params;
    const actorId = new URL(request.url).searchParams.get("actorId");
    const authContext = await requireAuthenticatedUserContext(actorId);
    if (authContext.impersonationSessionId) forbidden("Persoonlijke meldingen kunnen tijdens impersonating niet als gelezen worden gemarkeerd.");
    const actor = authContext.actor;
    const notification = await markNotificationAsRead(actor, id);
    return { notification };
  }, "Melding kon niet als gelezen worden gemarkeerd.");
}
