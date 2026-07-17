import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesDayPowerBiLink, setSalesDayPowerBiLink } from "@/lib/server/salesday-operational-dashboard";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

type Body = {
  actorId?: string;
  label?: string;
  href?: string | null;
};

export async function GET(request: Request) {
  return handleApi("api/salesday/power-bi-link:get", async () => {
    const query = new URL(request.url).searchParams;
    await requireAuthenticatedUserContext(query.get("actorId"));
    return getSalesDayPowerBiLink();
  }, "De Power BI-link kon niet worden geladen.");
}

export async function PUT(request: Request) {
  return handleApi("api/salesday/power-bi-link:put", async () => {
    const body = await request.json() as Body;
    const { actor } = await requireAuthenticatedUserContext(body.actorId);
    try {
      return { powerBi: await setSalesDayPowerBiLink(actor, { label: body.label, href: body.href }) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De Power BI-link kon niet worden opgeslagen.");
}
