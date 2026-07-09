import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { markAllNotificationsAsRead } from "@/lib/server/notifications";

export async function POST(request: Request) {
  return handleApi("api/notifications/read-all", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const notifications = await markAllNotificationsAsRead(actor);
    return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    };
  }, "Meldingen konden niet als gelezen worden gemarkeerd.");
}
