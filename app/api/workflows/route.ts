import { handleApi } from "@/lib/server/api";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import { requireAuthenticatedRead } from "@/lib/server/authenticated-user";
import { getVisibleWorkflowState } from "@/lib/data-access";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";

export async function GET() {
  return handleApi("api/workflows:get", async () => {
    const actor = await requireAuthenticatedRead();
    const state = await loadWorkflowStateFromDatabase();
    if (!actor) return { state };
    const representatives = await listRepresentativesFromDatabase();
    return { state: getVisibleWorkflowState(actor, state, representatives) };
  }, "Workflowgegevens konden niet worden geladen.");
}
