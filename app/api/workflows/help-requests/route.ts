import { persistWorkflowPatch } from "@/app/api/workflows/persist-route";

export async function POST(request: Request) {
  return persistWorkflowPatch(request, "help-requests", (payload) => ({
    helpRequests: payload.helpRequests,
    contactMoments: payload.contactMoments,
    retrainings: payload.retrainings,
    salesTrainings: payload.salesTrainings,
  }));
}
