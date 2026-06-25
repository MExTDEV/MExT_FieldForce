import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedRead } from "@/lib/server/authenticated-user";
import { listManagementTeams } from "@/lib/server/management";
import type { Country } from "@/lib/types";

const countries = new Set<Country>(["BE", "NL", "DE"]);

export async function GET(request: Request) {
  return handleApi("api/management/teams:get", async () => {
    const actor = await requireAuthenticatedRead();
    if (!actor) badRequest("Beheer vereist een aangemelde gebruiker.");

    const requested = new URL(request.url).searchParams.get("country");
    const country =
      requested && countries.has(requested as Country)
        ? requested as Country
        : undefined;
    const teams = await listManagementTeams(actor, {
      activeOnly: true,
      country,
    });
    return { teams };
  }, "Actieve teams konden niet uit MariaDB worden geladen.");
}
