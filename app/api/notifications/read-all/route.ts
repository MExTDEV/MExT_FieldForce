import { forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { markAllNotificationsAsRead } from "@/lib/server/notifications";

export async function POST(request: Request) {
  return handleApi("api/notifications/read-all", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const authContext = await requireAuthenticatedUserContext(actorId);
    if (authContext.impersonationSessionId) forbidden("Persoonlijke meldingen kunnen tijdens impersonating niet als gelezen worden gemarkeerd.");
    const actor = authContext.actor;
    const notifications = await markAllNotificationsAsRead(actor);
    return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    };
  }, "Meldingen konden niet als gelezen worden gemarkeerd.");
}
