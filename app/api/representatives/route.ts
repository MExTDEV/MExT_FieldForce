import { handleApi } from "@/lib/server/api";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { requireAuthenticatedRead } from "@/lib/server/authenticated-user";
import { getVisibleRepresentatives } from "@/lib/data-access";

export async function GET() {
  return handleApi("api/representatives:get", async () => {
    const actor = await requireAuthenticatedRead();
    const representatives = await listRepresentativesFromDatabase();
    return {
      representatives: actor
        ? getVisibleRepresentatives(actor, representatives)
        : representatives,
    };
  }, "Vertegenwoordigers konden niet worden geladen.");
}
