import { canCreateCoachingIntervention } from "@/lib/permissions";
import { badRequest, forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { loadCoachingPreparationReferences } from "@/lib/server/coaching-preparation";

export async function GET(request: Request) {
  return handleApi("api/workflows/coaching/preparation-references:get", async () => {
    const params = new URL(request.url).searchParams;
    const actor = await requireAuthenticatedUser(params.get("actorId"));
    if (!canCreateCoachingIntervention(actor)) {
      forbidden("Je mag de voorbereidingsflow niet gebruiken.");
    }
    const representativeId = params.get("representativeId");
    if (!representativeId) badRequest("Selecteer eerst een begeleide persoon.");
    return loadCoachingPreparationReferences({
      actor,
      representativeId,
      currentId: params.get("currentId"),
      referenceId: params.get("referenceId"),
    });
  }, "Historische voorbereidingsgegevens konden niet worden geladen.");
}
