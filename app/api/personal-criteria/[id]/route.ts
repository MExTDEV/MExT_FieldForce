import {
  deactivatePersonalCriterionInDatabase,
  getPersonalCriterionFromDatabase,
  updatePersonalCriterionInDatabase,
} from "@/lib/server/personal-criteria";
import { badRequest, handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import type { PersonalCoachingCriterion } from "@/lib/types";
import {
  requireAuthenticatedUser,
  requireRepresentativeScope,
  requireRole,
} from "@/lib/server/authenticated-user";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("api/personal-criteria:patch", async () => {
    const { id } = await params;
    const payload = (await request.json()) as {
      criterion?: Pick<PersonalCoachingCriterion, "title" | "description" | "focusName">;
    };
    if (!payload.criterion) {
      badRequest("Geen criterium ontvangen.");
    }
    const input = payload.criterion;
    const previous = await getPersonalCriterionFromDatabase(id);
    const actor = await requireAuthenticatedUser(previous?.createdByUserId);
    requireRole(actor, ["SALES_LEADER", "ADMIN", "SUPER_ADMIN"]);
    if (previous) await requireRepresentativeScope(actor, [previous.representativeId]);
    const criterion = await updatePersonalCriterionInDatabase(id, input);
    await writeAuditLog({
      actorId: actor.id,
      entityType: "PersonalCoachingCriterion",
      entityId: id,
      action: "personalCriterion.update",
      oldValue: previous,
      newValue: criterion,
    });
    return { criterion };
  }, "Persoonlijk criterium kon niet worden gewijzigd.");
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("api/personal-criteria:delete", async () => {
    const { id } = await params;
    const previous = await getPersonalCriterionFromDatabase(id);
    const actor = await requireAuthenticatedUser(previous?.createdByUserId);
    requireRole(actor, ["SALES_LEADER", "ADMIN", "SUPER_ADMIN"]);
    if (previous) await requireRepresentativeScope(actor, [previous.representativeId]);
    await deactivatePersonalCriterionInDatabase(id);
    await writeAuditLog({
      actorId: actor.id,
      entityType: "PersonalCoachingCriterion",
      entityId: id,
      action: "personalCriterion.deactivate",
      oldValue: previous,
      newValue: { active: false },
    });
    return { ok: true };
  }, "Persoonlijk criterium kon niet worden gedeactiveerd.");
}
