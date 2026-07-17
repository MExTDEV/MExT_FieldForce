import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesDayCustomerDetail } from "@/lib/server/salesday-customer-access";
import { updateSalesDayCustomer, type SalesDayCustomerInput } from "@/lib/server/salesday-customer-operations";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { requireActiveSalesDayDevice } from "@/lib/server/salesday-offline-sync";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(
  request: Request,
  context: { params: Promise<{ relationId: string }> },
) {
  return handleApi("api/salesday/customers/:relationId:get", async () => {
    const { relationId } = await context.params;
    const parameters = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return { customer: await getSalesDayCustomerDetail(actor, relationId) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De klantgegevens konden niet worden geladen.");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ relationId: string }> },
) {
  return handleApi("api/salesday/customers/:relationId:patch", async () => {
    const { relationId } = await context.params;
    const body = await request.json() as {
      actorId?: string;
      deviceId?: string;
      appointmentId?: string;
      customer?: SalesDayCustomerInput;
    };
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const device = await requireActiveSalesDayDevice({ actor, loginSessionId, deviceId: body.deviceId ?? "" });
      if (!body.customer || !body.appointmentId) badRequest("Klant- of afspraakgegevens ontbreken.");
      const runtime = await getSalesDayRuntimeConfiguration();
      return updateSalesDayCustomer({
        actor,
        deviceId: device.deviceId,
        provider: runtime.provider,
        relationId,
        appointmentId: body.appointmentId,
        customer: body.customer,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De klantgegevens konden niet worden gewijzigd.");
}
