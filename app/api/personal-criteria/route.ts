import {
  createPersonalCriterionInDatabase,
  listPersonalCriteriaFromDatabase,
} from "@/lib/server/personal-criteria";
import { badRequest, handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import type { PersonalCoachingCriterion } from "@/lib/types";
import {
  requireAuthenticatedRead,
  requireAuthenticatedUser,
  requireRepresentativeScope,
  requireRole,
} from "@/lib/server/authenticated-user";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import { visiblePersonalCriteria } from "@/lib/personal-criteria";

export async function GET() {
  return handleApi("api/personal-criteria:get", async () => {
    const actor = await requireAuthenticatedRead();
    const criteria = await listPersonalCriteriaFromDatabase();
    if (!actor) return { criteria };
    const representatives = await listRepresentativesFromDatabase();
    return { criteria: visiblePersonalCriteria(actor, criteria, representatives) };
  }, "Persoonlijke criteria konden niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/personal-criteria:post", async () => {
    const payload = (await request.json()) as { criterion?: PersonalCoachingCriterion };
    if (!payload.criterion) {
      badRequest("Geen criterium ontvangen.");
    }
    const actor = await requireAuthenticatedUser(payload.criterion.createdByUserId);
    requireRole(actor, ["SALES_LEADER", "ADMIN", "SUPER_ADMIN"]);
    await requireRepresentativeScope(actor, [payload.criterion.representativeId]);
    const input = { ...payload.criterion, createdByUserId: actor.id };
    const criterion = await createPersonalCriterionInDatabase(input);
    await writeAuditLog({
      actorId: actor.id,
      entityType: "PersonalCoachingCriterion",
      entityId: criterion.id,
      action: "personalCriterion.create",
      newValue: criterion,
    });
    return { criterion };
  }, "Persoonlijk criterium kon niet worden opgeslagen.");
}
