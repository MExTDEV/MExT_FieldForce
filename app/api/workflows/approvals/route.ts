import { persistWorkflowPatch } from "@/app/api/workflows/persist-route";

export async function POST(request: Request) {
  return persistWorkflowPatch(request, "approvals", (payload) => ({
    interventions: payload.interventions,
    approvals: payload.approvals,
  }));
}
