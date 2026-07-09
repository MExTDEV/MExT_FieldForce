import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { markNotificationAsRead } from "@/lib/server/notifications";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/notifications/read", async () => {
    const { id } = await context.params;
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const notification = await markNotificationAsRead(actor, id);
    return { notification };
  }, "Melding kon niet als gelezen worden gemarkeerd.");
}
