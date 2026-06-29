import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import {
  listOutlookCalendarEvents,
  requireMicrosoftAccessToken,
} from "@/lib/server/microsoft-graph";

const MAX_RANGE_MS = 93 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  return handleApi("api/outlook/events:get", async () => {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const start = new Date(url.searchParams.get("start") ?? "");
    const end = new Date(url.searchParams.get("end") ?? "");
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      badRequest("Geef een geldige start- en einddatum op.");
    }
    if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
      badRequest("De opgevraagde kalenderperiode is te groot.");
    }
    const accessToken = await requireMicrosoftAccessToken(request);
    return { events: await listOutlookCalendarEvents(accessToken, start, end) };
  }, "Outlook-agenda kon niet worden geladen.");
}
