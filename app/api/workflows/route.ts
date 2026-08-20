import { handleApi } from "@/lib/server/api";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getVisibleWorkflowState } from "@/lib/data-access";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { buildWorkflowInterventionVisibilityFilter } from "@/lib/server/coaching-visibility";
import { canAccessCoachingModuleNavigation } from "@/lib/navigation-access";
import { listAppModules } from "@/lib/server/modules";
import { filterWorkflowStateByActiveModules } from "@/lib/coaching/workflow-module-access";

export async function GET(request: Request) {
  return handleApi("api/workflows:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const modules = await listAppModules();
    const coachingEnabled = modules.some((module) => module.code === "BEGELEIDINGEN" && module.enabled);
    const interventionWhere = coachingEnabled && canAccessCoachingModuleNavigation(actor, "BEGELEIDINGEN")
      ? buildWorkflowInterventionVisibilityFilter(actor)
      : { id: "__geen_toegang__" };
    const state = await loadWorkflowStateFromDatabase({
      interventionWhere,
    });
    const representatives = await listRepresentativesFromDatabase();
    return {
      state: filterWorkflowStateByActiveModules(
        getVisibleWorkflowState(actor, state, representatives),
        modules,
      ),
    };
  }, "Workflowgegevens konden niet worden geladen.");
}
