import { persistWorkflowPatch } from "@/app/api/workflows/persist-route";

export async function POST(request: Request) {
  return persistWorkflowPatch(request, "contact-moments", (payload) => ({
    contactMoments: payload.contactMoments,
  }));
}
