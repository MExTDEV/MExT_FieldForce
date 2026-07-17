import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  createSalesDocumentNumberBlock,
  listSalesDocumentSettings,
  reconcileSalesDocumentNumberBlock,
  upsertSalesDocumentReason,
  type SalesCommercialDocumentType,
} from "@/lib/server/salesday-commercial-documents";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";
import type { Country } from "@/lib/types";

type Body =
  | {
      action: "upsertReason";
      actorId?: string;
      id?: string;
      kind: "OVERRIDE" | "UNSIGNED_EXCEPTION";
      code: string;
      labelNl: string;
      labelFr: string;
      labelDe: string;
      country?: Country | null;
      active?: boolean;
      requiresComment?: boolean;
      sortOrder?: number;
    }
  | {
      action: "createNumberBlock";
      actorId?: string;
      country: Country;
      documentType: SalesCommercialDocumentType;
      prefix?: string;
      firstSequence: number;
      lastSequence: number;
      nextSequence?: number;
      padding?: number;
      externalId?: string;
      sourceVersion?: string;
      sourceUpdatedAt?: string;
      expiresAt?: string;
    }
  | {
      action: "reconcileNumberBlock";
      actorId?: string;
      blockId: string;
      acceptedNumbers?: string[];
      skippedNumbers?: string[];
      voidedNumbers?: string[];
    };

export async function GET(request: Request) {
  return handleApi("api/salesday/settings/commercial-documents:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return listSalesDocumentSettings(actor);
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  });
}

export async function POST(request: Request) {
  return handleApiCreated("api/salesday/settings/commercial-documents:post", async () => {
    const body = await request.json() as Body;
    const { actor } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      const runtime = await getSalesDayRuntimeConfiguration();
      if (body.action === "upsertReason") return upsertSalesDocumentReason({ actor, ...body });
      if (body.action === "createNumberBlock") return createSalesDocumentNumberBlock({ actor, provider: runtime.provider, ...body });
      if (body.action === "reconcileNumberBlock") return reconcileSalesDocumentNumberBlock({ actor, ...body });
      badRequest("Onbekende SalesDay-documentinstelling.");
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "De SalesDay-documentinstelling kon niet worden opgeslagen.");
}
