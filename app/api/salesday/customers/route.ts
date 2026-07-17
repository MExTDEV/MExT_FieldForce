import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { searchSalesDayCustomers } from "@/lib/server/salesday-customer-access";
import { createSalesDayProspect, type SalesDayCustomerInput } from "@/lib/server/salesday-customer-operations";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/customers:get", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return { customers: await searchSalesDayCustomers(actor, parameters.get("q") ?? "") };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "Klanten zoeken is niet gelukt.");
}

export async function POST(request: Request) {
  return handleApiCreated("api/salesday/customers:post", async () => {
    const body = await request.json() as {
      actorId?: string;
      deviceId?: string;
      customer?: SalesDayCustomerInput;
    };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      if (!body.customer) badRequest("Prospectgegevens ontbreken.");
      const runtime = await getSalesDayRuntimeConfiguration();
      return createSalesDayProspect({
        actor,
        deviceId: device.deviceId,
        provider: runtime.provider,
        customer: body.customer,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De prospect kon niet worden aangemaakt.");
}
