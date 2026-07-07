import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser, requireRole } from "@/lib/server/authenticated-user";
import { listVisibleMyTeamMembers } from "@/lib/server/my-team";

export async function GET(request: Request) {
  return handleApi("api/my-team:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    requireRole(actor, ["SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"]);
    return { members: await listVisibleMyTeamMembers(actor) };
  }, "Teamleden konden niet worden geladen.");
}
