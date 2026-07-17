import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { listSalesArticles } from "@/lib/server/salesday-commercial-documents";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request) {
  return handleApi("api/salesday/articles:get", async () => {
    const query = new URL(request.url).searchParams;
    const { actor } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      const runtime = await getSalesDayRuntimeConfiguration();
      return { articles: await listSalesArticles({ actor, provider: runtime.provider, query: query.get("q") ?? undefined }) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  });
}
