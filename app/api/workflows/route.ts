import { handleApi } from "@/lib/server/api";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getVisibleWorkflowState } from "@/lib/data-access";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { buildWorkflowInterventionVisibilityFilter } from "@/lib/server/coaching-visibility";
import { canAccessCoachingModuleNavigation } from "@/lib/navigation-access";

export async function GET(request: Request) {
  return handleApi("api/workflows:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const interventionWhere = canAccessCoachingModuleNavigation(actor, "BEGELEIDINGEN")
      ? buildWorkflowInterventionVisibilityFilter(actor)
      : { id: "__geen_toegang__" };
    const state = await loadWorkflowStateFromDatabase({
      interventionWhere,
    });
    const representatives = await listRepresentativesFromDatabase();
    return { state: getVisibleWorkflowState(actor, state, representatives) };
  }, "Workflowgegevens konden niet worden geladen.");
}
