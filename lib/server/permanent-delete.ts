import { prisma } from "@/lib/server/db";

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type PermanentDeleteSummary = {
  entity: "user" | "team" | "kpi" | "focus" | "criterion";
  id: string;
  name: string;
  deletedRecords: number;
};

export async function permanentlyDeleteUser(
  actorId: string,
  userId: string,
  confirmation: string
): Promise<PermanentDeleteSummary> {
  if (actorId === userId) throw new Error("Je kunt je eigen Super Admin-account niet verwijderen.");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
    assertConfirmation(user.email, confirmation);
    if (user.role === "SUPER_ADMIN") {
      const remaining = await tx.user.count({
        where: { role: "SUPER_ADMIN", active: true, id: { not: user.id } },
      });
      if (!remaining) throw new Error("De laatste actieve Super Admin kan niet worden verwijderd.");
    }

    const interventions = await tx.intervention.findMany({
      where: {
        OR: [
          { representativeId: user.id },
          { initiatorId: user.id },
          { ownerId: user.id },
        ],
      },
      select: { id: true },
    });
    const interventionIds = interventions.map((item) => item.id);
    const personalCriteria = await tx.personalCoachingCriterion.findMany({
      where: { OR: [{ representativeId: user.id }, { createdByUserId: user.id }] },
      select: { id: true },
    });
    const personalCriterionIds = personalCriteria.map((item) => item.id);

    let deletedRecords = 0;
    if (personalCriterionIds.length) {
      deletedRecords += (await tx.score.deleteMany({ where: { personalCriterionId: { in: personalCriterionIds } } })).count;
      deletedRecords += (await tx.personalCoachingCriterion.deleteMany({ where: { id: { in: personalCriterionIds } } })).count;
    }
    deletedRecords += (await tx.reflection.deleteMany({ where: { representativeId: user.id } })).count;
    deletedRecords += (await tx.approval.deleteMany({ where: { representativeId: user.id } })).count;
    deletedRecords += (await tx.helpRequest.deleteMany({
      where: {
        OR: [
          { requesterId: user.id },
          { representativeId: user.id },
          ...(interventionIds.length
            ? [{ interventionId: { in: interventionIds } }, { linkedInterventionId: { in: interventionIds } }]
            : []),
        ],
      },
    })).count;
    deletedRecords += (await tx.actionPoint.deleteMany({
      where: {
        OR: [
          { representativeId: user.id },
          { ownerId: user.id },
          ...(interventionIds.length ? [{ interventionId: { in: interventionIds } }] : []),
        ],
      },
    })).count;
    deletedRecords += (await tx.auditLog.deleteMany({ where: { userId: user.id } })).count;
    deletedRecords += await deleteInterventions(tx, interventionIds);
    await tx.user.delete({ where: { id: user.id } });
    deletedRecords += 1;
    return {
      entity: "user",
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      deletedRecords,
    };
  });
}

export async function permanentlyDeleteTeam(
  id: string,
  confirmation: string
): Promise<PermanentDeleteSummary> {
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.findUniqueOrThrow({ where: { id } });
    assertConfirmation(team.name, confirmation);
    const interventions = await tx.intervention.findMany({ where: { teamId: id }, select: { id: true } });
    const interventionIds = interventions.map((item) => item.id);
    const criteria = await tx.personalCoachingCriterion.findMany({ where: { teamId: id }, select: { id: true } });
    const criterionIds = criteria.map((item) => item.id);
    let deletedRecords = 0;
    if (criterionIds.length) {
      deletedRecords += (await tx.score.deleteMany({ where: { personalCriterionId: { in: criterionIds } } })).count;
      deletedRecords += (await tx.personalCoachingCriterion.deleteMany({ where: { id: { in: criterionIds } } })).count;
    }
    deletedRecords += await deleteInterventions(tx, interventionIds);
    await tx.user.updateMany({ where: { teamId: id }, data: { teamId: null, teamSupervisor: false } });
    await tx.team.delete({ where: { id } });
    return { entity: "team", id, name: team.name, deletedRecords: deletedRecords + 1 };
  });
}

export async function permanentlyDeleteKpi(
  id: string,
  confirmation: string
): Promise<PermanentDeleteSummary> {
  return prisma.$transaction(async (tx) => {
    const kpi = await tx.kpiDefinition.findUniqueOrThrow({ where: { id } });
    assertConfirmation(kpi.name, confirmation);
    let deletedRecords = (await tx.kpiTargetOverride.deleteMany({ where: { kpiDefinitionId: id } })).count;
    deletedRecords += (await tx.actionPoint.deleteMany({ where: { kpiDefinitionId: id } })).count;
    deletedRecords += (await tx.kpiSnapshot.deleteMany({ where: { kpiDefinitionId: id } })).count;
    await tx.kpiDefinition.delete({ where: { id } });
    return { entity: "kpi", id, name: kpi.name, deletedRecords: deletedRecords + 1 };
  });
}

export async function permanentlyDeleteFocus(
  id: string,
  confirmation: string
): Promise<PermanentDeleteSummary> {
  return prisma.$transaction(async (tx) => {
    const focus = await tx.coachingFocus.findUniqueOrThrow({
      where: { id },
      include: { criteria: { select: { id: true } }, personalCriteria: { select: { id: true } } },
    });
    assertConfirmation(focus.name, confirmation);
    const criterionIds = focus.criteria.map((item) => item.id);
    const personalCriterionIds = focus.personalCriteria.map((item) => item.id);
    let deletedRecords = 0;
    if (criterionIds.length || personalCriterionIds.length) {
      deletedRecords += (await tx.score.deleteMany({
        where: {
          OR: [
            ...(criterionIds.length ? [{ criterionId: { in: criterionIds } }] : []),
            ...(personalCriterionIds.length ? [{ personalCriterionId: { in: personalCriterionIds } }] : []),
          ],
        },
      })).count;
    }
    deletedRecords += (await tx.interventionFocus.deleteMany({ where: { focusId: id } })).count;
    deletedRecords += (await tx.personalCoachingCriterion.deleteMany({ where: { focusId: id } })).count;
    await tx.coachingFocus.delete({ where: { id } });
    return { entity: "focus", id, name: focus.name, deletedRecords: deletedRecords + criterionIds.length + 1 };
  });
}

export async function permanentlyDeleteCriterion(
  id: string,
  confirmation: string
): Promise<PermanentDeleteSummary> {
  return prisma.$transaction(async (tx) => {
    const criterion = await tx.coachingCriterion.findUniqueOrThrow({ where: { id } });
    assertConfirmation(criterion.name, confirmation);
    const deletedScores = await tx.score.deleteMany({ where: { criterionId: id } });
    await tx.coachingCriterion.delete({ where: { id } });
    return { entity: "criterion", id, name: criterion.name, deletedRecords: deletedScores.count + 1 };
  });
}

async function deleteInterventions(tx: Transaction, ids: string[]) {
  if (!ids.length) return 0;
  let deleted = 0;
  deleted += (await tx.helpRequest.deleteMany({
    where: { OR: [{ interventionId: { in: ids } }, { linkedInterventionId: { in: ids } }] },
  })).count;
  deleted += (await tx.actionPoint.deleteMany({ where: { interventionId: { in: ids } } })).count;
  deleted += (await tx.intervention.deleteMany({ where: { id: { in: ids } } })).count;
  return deleted;
}

function assertConfirmation(expected: string, actual: string) {
  if (expected.trim().toLocaleLowerCase("nl-BE") !== actual.trim().toLocaleLowerCase("nl-BE")) {
    throw new Error("De bevestiging komt niet overeen. Typ de exacte naam of het exacte e-mailadres.");
  }
}
