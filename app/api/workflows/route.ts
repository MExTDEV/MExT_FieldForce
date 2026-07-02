import { handleApi } from "@/lib/server/api";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getVisibleWorkflowState } from "@/lib/data-access";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { buildWorkflowInterventionVisibilityFilter } from "@/lib/server/coaching-visibility";

export async function GET(request: Request) {
  return handleApi("api/workflows:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const state = await loadWorkflowStateFromDatabase({
      interventionWhere: buildWorkflowInterventionVisibilityFilter(actor),
    });
    const representatives = await listRepresentativesFromDatabase();
    return { state: getVisibleWorkflowState(actor, state, representatives) };
  }, "Workflowgegevens konden niet worden geladen.");
}
