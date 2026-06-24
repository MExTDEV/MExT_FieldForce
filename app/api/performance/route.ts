import { handleApi } from "@/lib/server/api";
import { loadPerformanceDatasetFromDatabase } from "@/lib/server/performance";
import { requireAuthenticatedRead } from "@/lib/server/authenticated-user";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { getVisibleRepresentatives } from "@/lib/data-access";

export async function GET() {
  return handleApi("api/performance:get", async () => {
    const actor = await requireAuthenticatedRead();
    const dataset = await loadPerformanceDatasetFromDatabase();
    if (!actor) return { dataset };

    const representatives = await listRepresentativesFromDatabase();
    const representativeIds = new Set(
      getVisibleRepresentatives(actor, representatives).map((item) => item.id)
    );
    return {
      dataset: {
        historicalCoachings: dataset.historicalCoachings.filter((item) =>
          representativeIds.has(item.representativeId)
        ),
        historicalContactMoments: dataset.historicalContactMoments.filter((item) =>
          representativeIds.has(item.representativeId)
        ),
        historicalActionPoints: dataset.historicalActionPoints.filter((item) =>
          representativeIds.has(item.representativeId)
        ),
        monthlyKpiSnapshots: dataset.monthlyKpiSnapshots.filter((item) =>
          representativeIds.has(item.representativeId)
        ),
      },
    };
  }, "Performancegegevens konden niet worden geladen.");
}
