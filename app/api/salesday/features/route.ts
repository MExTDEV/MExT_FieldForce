import { can } from "@/lib/permissions";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  getSalesDayFeatureAccess,
  getSalesDayRuntimeConfiguration,
  listSalesDayFeatureFlags,
  setSalesDayFeatureFlag,
  setSalesDayRuntimeConfiguration,
} from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";
import type { SalesDayFeatureKey, SalesDayFeatureScope } from "@/lib/salesday/feature-flags";
import type { SalesDayRuntimeConfiguration } from "@/lib/salesday/runtime-configuration";
import type { Country } from "@/lib/types";

export async function GET(request: Request) {
  return handleApi("api/salesday/features:get", async () => {
    const parameters = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(parameters.get("actorId"));
    try {
      const access = await getSalesDayFeatureAccess(actor);
      const runtime = await getSalesDayRuntimeConfiguration();
      if (parameters.get("view") !== "management") {
        return { access, enabledNotifications: runtime.enabledNotifications };
      }
      return {
        access,
        runtime,
        flags: await listSalesDayFeatureFlags(actor),
        canManage: can(actor, "salesday.settings.manage"),
      };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De SalesDay-activatie kon niet worden geladen.");
}

export async function PUT(request: Request) {
  return handleApi("api/salesday/features:put", async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await requireAuthenticatedUserContext(
      typeof body.actorId === "string" ? body.actorId : undefined,
    );
    try {
      if (body.action === "SET_FLAG") {
        return {
          flag: await setSalesDayFeatureFlag(actor, {
            key: String(body.key) as SalesDayFeatureKey,
            scope: String(body.scope) as SalesDayFeatureScope,
            enabled: body.enabled === true,
            country: typeof body.country === "string" ? body.country as Country : undefined,
            teamId: typeof body.teamId === "string" ? body.teamId : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
          }),
        };
      }
      if (body.action === "SET_RUNTIME") {
        return {
          runtime: await setSalesDayRuntimeConfiguration(
            actor,
            body.configuration as SalesDayRuntimeConfiguration,
          ),
        };
      }
      throw new Error("Ongeldige SalesDay-configuratieactie.");
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De SalesDay-activatie kon niet worden gewijzigd.");
}
