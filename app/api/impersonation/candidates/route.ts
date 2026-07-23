import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listImpersonationCandidates } from "@/lib/server/impersonation";

export async function GET() {
  return handleApi("api/impersonation/candidates:get", async () => {
    const { actor } = await requireAuthenticatedUserContext();
    return { users: await listImpersonationCandidates(actor) };
  }, "De beschikbare gebruikers konden niet worden geladen.");
}
