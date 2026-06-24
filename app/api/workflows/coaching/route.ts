import { persistWorkflowPatch } from "@/app/api/workflows/persist-route";

export async function POST(request: Request) {
  return persistWorkflowPatch(request, "coaching", (payload) => ({
    interventions: payload.interventions,
    reflections: payload.reflections,
  }));
}
