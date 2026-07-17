import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getSalesDocumentPrintShareDescriptor } from "@/lib/server/salesday-commercial-documents";
import { assertSalesDayFeatureEnabled } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  return handleApi("api/salesday/documents/:documentId/print:get", async () => {
    const { documentId } = await context.params;
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      return getSalesDocumentPrintShareDescriptor({ actor, documentId });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  });
}
