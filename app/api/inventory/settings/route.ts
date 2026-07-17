import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  getInventoryRuntimeSettings,
  listInventoryReasons,
  saveInventoryRuntimeSettings,
  upsertInventoryReason,
  type InventoryRuntimeSettings,
} from "@/lib/server/inventory/service";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

type Body = {
  actorId?: string;
  settings?: InventoryRuntimeSettings;
  reason?: Parameters<typeof upsertInventoryReason>[0] extends { actor: never } ? never : Omit<Parameters<typeof upsertInventoryReason>[0], "actor">;
};

export async function GET(request: Request) {
  return handleApi("api/inventory/settings:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      return {
        settings: await getInventoryRuntimeSettings(),
        reasons: await listInventoryReasons(actor),
      };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De Inventory-instellingen konden niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/inventory/settings:post", async () => {
    const body = await request.json() as Body;
    const { actor } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "INVENTORY");
      if (body.settings) return { settings: await saveInventoryRuntimeSettings(actor, body.settings) };
      if (body.reason) return { reason: await upsertInventoryReason({ actor, ...body.reason }) };
      badRequest("Instellingen of reden ontbreken.");
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De Inventory-instellingen konden niet worden opgeslagen.");
}
