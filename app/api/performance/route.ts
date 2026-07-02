import { handleApi } from "@/lib/server/api";
import { loadPerformanceDatasetFromDatabase } from "@/lib/server/performance";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { getVisibleRepresentatives } from "@/lib/data-access";
import { buildCoachingVisibilityFilter } from "@/lib/server/coaching-visibility";

export async function GET(request: Request) {
  return handleApi("api/performance:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    const dataset = await loadPerformanceDatasetFromDatabase({
      coachingWhere: buildCoachingVisibilityFilter(actor),
    });

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
