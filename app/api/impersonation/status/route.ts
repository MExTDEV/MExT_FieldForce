import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getImpersonationStatus } from "@/lib/server/impersonation";

export async function GET() {
  return handleApi("api/impersonation/status:get", async () => {
    const context = await requireAuthenticatedUserContext();
    if (!context.loginSessionDatabaseId) return { impersonation: { active: false } };
    return { impersonation: await getImpersonationStatus(context.loginSessionDatabaseId) };
  }, "De impersonatiestatus kon niet worden geladen.");
}
