import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listImpersonationHistory } from "@/lib/server/impersonation";
import type { Country } from "@/lib/types";

export async function GET(request: Request) {
  return handleApi("api/admin/impersonation-history:get", async () => {
    const { actor } = await requireAuthenticatedUserContext();
    const params = new URL(request.url).searchParams;
    const country = params.get("country") || undefined;
    if (country && !["BE", "NL", "DE"].includes(country)) badRequest("Ongeldige landfilter.");
    const status = params.get("status") || undefined;
    if (status && !["ACTIVE", "ENDED"].includes(status)) badRequest("Ongeldige statusfilter.");
    return { sessions: await listImpersonationHistory(actor, {
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
      actorUserId: params.get("actorUserId") || undefined,
      impersonatedUserId: params.get("impersonatedUserId") || undefined,
      country: country as Country | undefined,
      teamId: params.get("teamId") || undefined,
      status: status as "ACTIVE" | "ENDED" | undefined,
      reasonType: params.get("reasonType") || undefined,
    }) };
  }, "De impersonatiehistoriek kon niet worden geladen.");
}
