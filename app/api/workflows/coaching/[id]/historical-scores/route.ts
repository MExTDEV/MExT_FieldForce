import { handleApi } from "@/lib/server/api";
import {
  requireAuthenticatedUser,
  requirePermission,
} from "@/lib/server/authenticated-user";
import { loadHistoricalScoreComparison } from "@/lib/server/coaching-historical-comparison";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/coaching/historical-scores:get", async () => {
    const { id } = await context.params;
    const params = new URL(request.url).searchParams;
    const actor = await requireAuthenticatedUser(params.get("actorId"));
    requirePermission(actor, "moduleVisitRecord");
    return loadHistoricalScoreComparison({
      actor,
      currentId: id,
      compareId: params.get("compareId"),
    });
  }, "Historische scores konden niet worden geladen.");
}
