import { persistWorkflowPatch } from "@/app/api/workflows/persist-route";

export async function POST(request: Request) {
  return persistWorkflowPatch(request, "reflections", (payload) => ({
    interventions: payload.interventions,
    reflections: payload.reflections,
    approvals: payload.approvals,
  }));
}
