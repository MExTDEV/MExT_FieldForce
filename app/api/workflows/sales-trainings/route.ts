import { persistWorkflowPatch } from "@/app/api/workflows/persist-route";

export async function POST(request: Request) {
  return persistWorkflowPatch(request, "sales-trainings", (payload) => ({
    salesTrainings: payload.salesTrainings,
  }));
}
