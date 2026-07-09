import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getNotificationsForCurrentUser } from "@/lib/server/notifications";

export async function GET(request: Request) {
  return handleApi("api/notifications:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const notifications = await getNotificationsForCurrentUser(actor);
    return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    };
  }, "Meldingen konden niet worden geladen.");
}
