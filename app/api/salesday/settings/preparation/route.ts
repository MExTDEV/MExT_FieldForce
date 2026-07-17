import type { SalesPreparationConfiguration } from "@/lib/salesday/preparation";
import { can } from "@/lib/permissions";
import { forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import {
  getSalesPreparationConfiguration,
  setSalesPreparationConfiguration,
} from "@/lib/server/salesday-preparation";

export async function GET(request: Request) {
  return handleApi("api/salesday/settings/preparation:get", async () => {
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    if (!can(actor, "salesday.settings.manage")) forbidden("Je hebt geen recht om SalesDay-voorbereiding te beheren.");
    return { configuration: await getSalesPreparationConfiguration() };
  }, "De voorbereidingsinstellingen konden niet worden geladen.");
}

export async function PUT(request: Request) {
  return handleApi("api/salesday/settings/preparation:put", async () => {
    const body = await request.json() as { actorId?: string; configuration: SalesPreparationConfiguration };
    const actor = await requireAuthenticatedUser(body.actorId);
    return { configuration: await setSalesPreparationConfiguration(actor, body.configuration) };
  }, "De voorbereidingsinstellingen konden niet worden opgeslagen.");
}
