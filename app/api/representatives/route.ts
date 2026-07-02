import { handleApi } from "@/lib/server/api";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getVisibleRepresentatives } from "@/lib/data-access";

export async function GET(request: Request) {
  return handleApi("api/representatives:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const representatives = await listRepresentativesFromDatabase();
    return {
      representatives: getVisibleRepresentatives(actor, representatives),
    };
  }, "Vertegenwoordigers konden niet worden geladen.");
}
