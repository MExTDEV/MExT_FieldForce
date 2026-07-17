import { validateBillingIdentity } from "@/lib/salesday/billing-validation";
import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function POST(request: Request) {
  return handleApi("api/salesday/customers/billing-validation", async () => {
    const body = await request.json() as { actorId?: string; country?: string; vatNumber?: string };
    const actor = await requireAuthenticatedUser(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      if (!body.country || !["BE", "NL", "DE"].includes(body.country) || !body.vatNumber) {
        badRequest("Land en btw-nummer zijn verplicht.");
      }
      return validateBillingIdentity({
        country: body.country as "BE" | "NL" | "DE",
        vatNumber: body.vatNumber,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De facturatiegegevens konden niet worden gevalideerd.");
}
