import { badRequest, forbidden, handleApi, notFound } from "@/lib/server/api";
import { requireAuthenticatedUser, requirePermission } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { sanitizeApprovalReflection, approvalReflectionErrors } from "@/lib/coaching/approval-reflection";
import { loadWorkflowStateFromDatabase } from "@/lib/server/workflows";
import { buildVisibleCoachingWhere } from "@/lib/server/coaching-visibility";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/approvals/reflection", async () => {
    const { id } = await context.params;
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    requirePermission(actor, "moduleVisitRecord");

    const payload = await request.json() as {
      reflectionKpiHtml?: string;
      reflectionLearningHtml?: string;
      reflectionGoalHtml?: string;
    };
    const sanitized = sanitizeApprovalReflection(payload);
    const errors = approvalReflectionErrors(sanitized);
    if (errors.reflectionKpiHtml || errors.reflectionLearningHtml || errors.reflectionGoalHtml) {
      badRequest("Alle drie de reflectievragen zijn verplicht.");
    }

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        intervention: {
          select: {
            id: true,
            status: true,
            type: true,
            representativeId: true,
          },
        },
      },
    });
    if (!approval || approval.intervention.type !== "BEGELEIDING") notFound("Akkoordtaak niet gevonden.");
    if (approval.status || approval.confirmedAt) {
      forbidden("De reflectie kan niet meer aangepast worden nadat akkoord of niet-akkoord werd ingediend.");
    }
    if (!["VERZONDEN_TER_AKKOORD", "WACHT_OP_AKKOORD"].includes(approval.intervention.status)) {
      forbidden("Deze begeleiding staat niet klaar voor reflectie en akkoord.");
    }
    const actorIds = [actor.id, actor.representativeId].filter(Boolean);
    if (!actorIds.includes(approval.representativeId) || !actorIds.includes(approval.intervention.representativeId)) {
      forbidden("Je mag alleen je eigen reflectievragen invullen.");
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id },
        data: {
          ...sanitized,
          reflectionCompletedAt: now,
          reflectionCompletedByUserId: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          entityType: "Approval",
          entityId: id,
          action: "coaching.approval_reflection_saved",
          newValue: JSON.stringify({
            interventionId: approval.interventionId,
            completedAt: now.toISOString(),
          }),
        },
      });
    });

    const state = await loadWorkflowStateFromDatabase({
      interventionWhere: buildVisibleCoachingWhere(actor, { id: approval.interventionId }),
    });
    return {
      approval: state.approvals.find((item) => item.id === id),
      intervention: state.interventions.find((item) => item.id === approval.interventionId),
    };
  }, "De reflectievragen konden niet worden opgeslagen.");
}
