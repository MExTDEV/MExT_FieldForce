import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listSalesDayAppointmentOutcomeReasons } from "@/lib/server/salesday-appointments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/appointments/outcome-reasons:get", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      const runtime = await getSalesDayRuntimeConfiguration();
      return { reasons: await listSalesDayAppointmentOutcomeReasons(actor, runtime.provider) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De afspraakredenen konden niet worden geladen.");
}
