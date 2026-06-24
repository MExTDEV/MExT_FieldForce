import { prisma } from "@/lib/server/db";
import type {
  ActionPointStatus as DbActionPointStatus,
  ActionPointType as DbActionPointType,
  ApprovalStatus as DbApprovalStatus,
  HelpRequestStatus as DbHelpRequestStatus,
  InterventionStatus as DbInterventionStatus,
  InterventionType as DbInterventionType,
  Prisma,
  Priority as DbPriority,
} from "@prisma/client";
import type {
  ApprovalStatus,
  AssignedWorkflowActionPoint,
  CoachingIntervention,
  ContactMoment,
  HelpRequest,
  Retraining,
  SalesTraining,
  WorkflowActionPoint,
  WorkflowApproval,
  WorkflowReflection,
  WorkflowScore,
  WorkflowState,
  CoachingSimpleScore,
} from "@/lib/types";
import type { Country } from "@/lib/types";

type JsonArray = string[];

const emptyState: WorkflowState = {
  interventions: [],
  reflections: [],
  approvals: [],
  contactMoments: [],
  helpRequests: [],
  linkedInterventions: [],
  retrainings: [],
  salesTrainings: [],
};

export async function loadWorkflowStateFromDatabase(): Promise<WorkflowState> {
  const [interventions, helpRequests] = await Promise.all([
    prisma.intervention.findMany({
      include: {
        representative: { include: { team: true } },
        focuses: { include: { focus: true } },
        scores: true,
        contactMoment: true,
        coachingDetail: { include: { appointments: { include: { scoreRows: true } } } },
        trainingDetail: true,
        trainingParticipants: { include: { representative: true } },
        actionPoints: { include: { assignments: { include: { representative: true } } } },
        reflection: true,
        approval: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.helpRequest.findMany({
      include: {
        representative: { include: { team: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const state: WorkflowState = { ...emptyState };
  for (const item of interventions) {
    const representativeId = publicRepresentativeId(item.representative);
    if (item.type === "BEGELEIDING") {
      state.interventions.push({
        id: item.id,
        representativeId,
        initiatorId: item.initiatorId,
        ownerId: item.ownerId,
        country: item.country as Country,
        teamId: item.teamId ?? item.representative.teamId ?? "",
        title: item.title,
        status: fromInterventionStatus(item.status),
        plannedDate: dateOnly(item.plannedAt),
        startTime: item.startTime ?? undefined,
        endTime: item.endTime ?? undefined,
        notifyRepresentative: item.notifyRepresentative,
        deletedAt: item.deletedAt?.toISOString(),
        focusNames: item.focuses.map((focus) => focus.focus.name),
        scores: item.scores.filter((score) => !score.category?.startsWith("Dossier:")).map(toWorkflowScore),
        actionPoints: item.actionPoints.map(toWorkflowActionPoint),
        dossier: item.coachingDetail
          ? {
              arrivalTime: item.coachingDetail.arrivalTime ?? "",
              departureTime: item.coachingDetail.departureTime ?? "",
              kilometers: item.coachingDetail.kilometers?.toString() ?? "",
              area: item.coachingDetail.area ?? "",
              sector: item.coachingDetail.sector ?? "",
              groupAttentionPoints: parseJsonArray(item.coachingDetail.groupAttentionPoints),
              individualAttentionPoint: item.coachingDetail.individualAttentionPoint ?? "",
              generalScores: item.scores.filter((score) => score.category === "Dossier:Algemeen").map(toSimpleScore),
              personalityScores: item.scores.filter((score) => score.category === "Dossier:Persoonlijkheid").map(toSimpleScore),
            }
          : undefined,
        appointments: item.coachingDetail?.appointments.map((appointment) => ({
          id: appointment.id,
          customer: appointment.customer,
          customerNumber: appointment.customerNumber ?? "",
          place: appointment.place ?? "",
          relationType: appointment.relationType as "prospect" | "klant",
          appointmentType: appointment.appointmentType as "vast" | "rood",
          arrivalTime: appointment.arrivalTime,
          departureTime: appointment.departureTime,
          activity: appointment.activity,
          scores: appointment.scoreRows
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((score) => ({
              criterion: score.criterion,
              score: toSimpleScoreValue(score.score, score.notApplicable),
              comment: score.comment,
            })),
          remarks: appointment.remarks,
          isDeleted: Boolean(appointment.deletedAt),
        })),
        auditTrail: [],
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        finalizedAt: item.finalizedAt?.toISOString() ?? item.completedAt?.toISOString(),
      });
    }

    if (item.type === "CONTACTMOMENT" && item.contactMoment) {
      state.contactMoments.push({
        id: item.id,
        representativeId,
        initiatorId: item.initiatorId,
        ownerId: item.ownerId,
        country: item.country as Country,
        teamId: item.teamId ?? item.representative.teamId ?? "",
        status: fromContactStatus(item.status),
        reason: item.contactMoment.reason,
        reportedProblems: item.contactMoment.reportedProblems ?? "",
        leaderThemes: parseJsonArray(item.contactMoment.leaderThemes),
        representativeKpis: parseJsonArray(item.contactMoment.representativeKpis),
        representativeThemes: parseJsonArray(item.contactMoment.representativeThemes),
        discussedThemes: parseJsonArray(item.contactMoment.discussedThemes),
        conclusion: item.contactMoment.conclusion ?? "",
        actionPoints: item.actionPoints.map(toWorkflowActionPoint),
        sourceHelpRequestId: item.contactMoment.sourceHelpRequestId ?? undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
    }

    if ((item.type === "RETRAINING" || item.type === "SALES_TRAINING") && item.trainingDetail) {
      if (item.type === "RETRAINING") {
        state.retrainings.push({
          id: item.id,
          representativeId,
          initiatorId: item.initiatorId,
          country: item.country as Country,
          teamId: item.teamId ?? item.representative.teamId ?? "",
          theme: item.trainingDetail.theme,
          reason: item.trainingDetail.reason,
          desiredImprovement: item.trainingDetail.desiredImprovement ?? "",
          kpi: item.trainingDetail.kpi ?? undefined,
          frameworkPhase: item.trainingDetail.frameworkPhase ?? undefined,
          date: dateOnly(item.plannedAt) ?? "",
          trainer: item.trainingDetail.trainer ?? "",
          result: item.trainingDetail.result ?? "",
          actionPoints: item.actionPoints.map(toWorkflowActionPoint),
          status: fromTrainingStatus(item.status),
          sourceHelpRequestId: item.trainingDetail.sourceHelpRequestId ?? undefined,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          completedAt: item.completedAt?.toISOString(),
        });
      } else {
        state.salesTrainings.push({
          id: item.id,
          initiatorId: item.initiatorId,
          country: item.country as Country,
          theme: item.trainingDetail.theme,
          reason: item.trainingDetail.reason,
          targetAudience: item.trainingDetail.targetAudience ?? "",
          participantIds: item.trainingParticipants.map((participant) => publicRepresentativeId(participant.representative)),
          kpi: item.trainingDetail.kpi ?? undefined,
          frameworkPhase: item.trainingDetail.frameworkPhase ?? undefined,
          date: dateOnly(item.plannedAt) ?? "",
          trainer: item.trainingDetail.trainer ?? "",
          conclusion: item.trainingDetail.conclusion ?? "",
          followUpAction: item.trainingDetail.followUpAction ?? "",
          createIndividualActions: item.trainingDetail.createIndividualActions,
          createGroupAction: item.trainingDetail.createGroupAction,
          actionDue: dateOnly(item.trainingDetail.actionDue) ?? "",
          actionPoints: item.actionPoints.map(toAssignedWorkflowActionPoint),
          status: fromTrainingStatus(item.status),
          sourceHelpRequestId: item.trainingDetail.sourceHelpRequestId ?? undefined,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          completedAt: item.completedAt?.toISOString(),
        });
      }
    }

    if (item.reflection) {
      state.reflections.push({
        id: item.reflection.id,
        interventionId: item.id,
        representativeId,
        status: item.reflection.status === "INGEDIEND" ? "ingediend" : "niet_gestart",
        learnedText: item.reflection.learnedText,
        workOnText: item.reflection.workOnText,
        concreteGoalText: item.reflection.concreteGoalText,
        createdAt: item.reflection.createdAt.toISOString(),
        submittedAt: item.reflection.submittedAt?.toISOString(),
      });
    }

    if (item.approval) {
      state.approvals.push({
        id: item.approval.id,
        interventionId: item.id,
        representativeId,
        status: item.approval.status ? fromApprovalStatus(item.approval.status) : undefined,
        comment: item.approval.comment ?? "",
        createdAt: item.approval.createdAt.toISOString(),
        confirmedAt: item.approval.confirmedAt?.toISOString(),
      });
    }
  }

  state.helpRequests = helpRequests.map((item) => ({
    id: item.id,
    requesterId: item.requesterId,
    representativeId: publicRepresentativeId(item.representative),
    country: item.representative.country as Country,
    teamId: item.representative.teamId ?? "",
    subject: item.subject,
    difficulty: item.difficulty,
    desiredResult: item.desiredResult,
    urgency: item.urgency === "HIGH" ? "hoog" : item.urgency === "LOW" ? "laag" : "normaal",
    explanation: item.explanation ?? "",
    status: fromHelpStatus(item.status),
    followUpType: item.followUpType ? fromFollowUpType(item.followUpType) : undefined,
    linkedInterventionId: item.linkedInterventionId ?? item.interventionId ?? undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return state;
}

export async function saveWorkflowStateToDatabase(state: WorkflowState) {
  await prisma.$transaction(async (tx) => {
    for (const item of state.interventions) await upsertCoaching(tx, item);
    for (const item of state.contactMoments) await upsertContactMoment(tx, item);
    for (const item of state.helpRequests) await upsertHelpRequest(tx, item);
    for (const item of state.retrainings) await upsertRetraining(tx, item);
    for (const item of state.salesTrainings) await upsertSalesTraining(tx, item);
    for (const item of state.reflections) await upsertReflection(tx, item);
    for (const item of state.approvals) await upsertApproval(tx, item);
  });
}

export type WorkflowPersistencePatch = Partial<Pick<
  WorkflowState,
  | "interventions"
  | "reflections"
  | "approvals"
  | "contactMoments"
  | "helpRequests"
  | "retrainings"
  | "salesTrainings"
>>;

export async function saveWorkflowPatchToDatabase(patch: WorkflowPersistencePatch) {
  await prisma.$transaction(async (tx) => {
    for (const item of patch.interventions ?? []) await upsertCoaching(tx, item);
    for (const item of patch.contactMoments ?? []) await upsertContactMoment(tx, item);
    for (const item of patch.helpRequests ?? []) await upsertHelpRequest(tx, item);
    for (const item of patch.retrainings ?? []) await upsertRetraining(tx, item);
    for (const item of patch.salesTrainings ?? []) await upsertSalesTraining(tx, item);
    for (const item of patch.reflections ?? []) await upsertReflection(tx, item);
    for (const item of patch.approvals ?? []) await upsertApproval(tx, item);
  });
}

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function upsertCoaching(tx: Transaction, item: CoachingIntervention) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  const data = interventionData(item.id, "BEGELEIDING", item, representative.id);
  await tx.intervention.upsert({
    where: { id: item.id },
    create: data,
    update: interventionUpdateData(data),
  });
  await replaceInterventionFocuses(tx, item.id, item.focusNames);
  await replaceScores(tx, item.id, item.scores, item.dossier);
  await upsertCoachingDetail(tx, item.id, item);
  await replaceActionPoints(tx, item.id, item.actionPoints, item.representativeId, item.ownerId);
}

async function upsertContactMoment(tx: Transaction, item: ContactMoment) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  const data = interventionData(item.id, "CONTACTMOMENT", item, representative.id);
  await tx.intervention.upsert({
    where: { id: item.id },
    create: data,
    update: interventionUpdateData(data),
  });
  await tx.contactMomentDetail.upsert({
    where: { interventionId: item.id },
    create: {
      interventionId: item.id,
      reason: item.reason,
      reportedProblems: item.reportedProblems,
      leaderThemes: JSON.stringify(item.leaderThemes),
      representativeKpis: JSON.stringify(item.representativeKpis),
      representativeThemes: JSON.stringify(item.representativeThemes),
      discussedThemes: JSON.stringify(item.discussedThemes),
      conclusion: item.conclusion,
      sourceHelpRequestId: item.sourceHelpRequestId,
    },
    update: {
      reason: item.reason,
      reportedProblems: item.reportedProblems,
      leaderThemes: JSON.stringify(item.leaderThemes),
      representativeKpis: JSON.stringify(item.representativeKpis),
      representativeThemes: JSON.stringify(item.representativeThemes),
      discussedThemes: JSON.stringify(item.discussedThemes),
      conclusion: item.conclusion,
      sourceHelpRequestId: item.sourceHelpRequestId,
    },
  });
  await replaceActionPoints(tx, item.id, item.actionPoints, item.representativeId, item.ownerId);
}

async function upsertHelpRequest(tx: Transaction, item: HelpRequest) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  await tx.helpRequest.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      requesterId: item.requesterId,
      representativeId: representative.id,
      subject: item.subject,
      difficulty: item.difficulty,
      desiredResult: item.desiredResult,
      explanation: item.explanation,
      urgency: toPriority(item.urgency),
      status: toHelpStatus(item.status),
      followUpType: item.followUpType ? toFollowUpType(item.followUpType) : undefined,
      linkedInterventionId: item.linkedInterventionId,
    },
    update: {
      representativeId: representative.id,
      subject: item.subject,
      difficulty: item.difficulty,
      desiredResult: item.desiredResult,
      explanation: item.explanation,
      urgency: toPriority(item.urgency),
      status: toHelpStatus(item.status),
      followUpType: item.followUpType ? toFollowUpType(item.followUpType) : undefined,
      linkedInterventionId: item.linkedInterventionId,
    },
  });
}

async function upsertRetraining(tx: Transaction, item: Retraining) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  const data = interventionData(item.id, "RETRAINING", item, representative.id, item.date);
  await tx.intervention.upsert({
    where: { id: item.id },
    create: data,
    update: interventionUpdateData(data),
  });
  await upsertTrainingDetail(tx, item.id, {
    theme: item.theme,
    reason: item.reason,
    desiredImprovement: item.desiredImprovement,
    kpi: item.kpi,
    frameworkPhase: item.frameworkPhase,
    trainer: item.trainer,
    result: item.result,
    sourceHelpRequestId: item.sourceHelpRequestId,
  });
  await replaceActionPoints(tx, item.id, item.actionPoints, item.representativeId, item.initiatorId);
}

async function upsertSalesTraining(tx: Transaction, item: SalesTraining) {
  const firstParticipant = await findRepresentativeUser(tx, item.participantIds[0]);
  const data = interventionData(item.id, "SALES_TRAINING", item, firstParticipant.id, item.date);
  await tx.intervention.upsert({
    where: { id: item.id },
    create: data,
    update: interventionUpdateData(data),
  });
  await upsertTrainingDetail(tx, item.id, {
    theme: item.theme,
    reason: item.reason,
    targetAudience: item.targetAudience,
    kpi: item.kpi,
    frameworkPhase: item.frameworkPhase,
    trainer: item.trainer,
    conclusion: item.conclusion,
    followUpAction: item.followUpAction,
    createIndividualActions: item.createIndividualActions,
    createGroupAction: item.createGroupAction,
    actionDue: dateFromString(item.actionDue),
    sourceHelpRequestId: item.sourceHelpRequestId,
  });
  await tx.trainingParticipant.deleteMany({ where: { interventionId: item.id } });
  for (const representativeId of item.participantIds) {
    const representative = await findRepresentativeUser(tx, representativeId);
    await tx.trainingParticipant.create({
      data: { interventionId: item.id, representativeId: representative.id },
    });
  }
  await replaceAssignedActionPoints(tx, item.id, item.actionPoints, item.initiatorId);
}

async function upsertTrainingDetail(tx: Transaction, interventionId: string, data: Record<string, unknown>) {
  await tx.trainingDetail.upsert({
    where: { interventionId },
    create: { interventionId, ...data } as never,
    update: data as never,
  });
}

async function replaceInterventionFocuses(
  tx: Transaction,
  interventionId: string,
  focusNames: string[]
) {
  await tx.interventionFocus.deleteMany({ where: { interventionId } });
  if (focusNames.length === 0) return;
  const focuses = await tx.coachingFocus.findMany({
    where: { name: { in: focusNames } },
    select: { id: true, name: true },
  });
  for (const focus of focuses) {
    await tx.interventionFocus.create({
      data: { interventionId, focusId: focus.id },
    });
  }
}

async function replaceScores(
  tx: Transaction,
  interventionId: string,
  scores: WorkflowScore[],
  dossier?: CoachingIntervention["dossier"]
) {
  await tx.score.deleteMany({ where: { interventionId } });
  const focusNames = [...new Set(scores.map((score) => score.focus).filter(Boolean))];
  const focuses = await tx.coachingFocus.findMany({
    where: { name: { in: focusNames } },
    include: { criteria: true, personalCriteria: true },
  });

  for (const score of scores) {
    const focus = focuses.find((item) => item.name === score.focus);
    const fixedCriterion = focus?.criteria.find((criterion) => criterion.name === score.criterion);
    const personalCriterion = score.criterionId
      ? focus?.personalCriteria.find((criterion) => criterion.id === score.criterionId)
      : undefined;
    await tx.score.create({
      data: {
        interventionId,
        criterionId: score.criterionKind === "fixed" ? fixedCriterion?.id : undefined,
        personalCriterionId: score.criterionKind === "personal" ? personalCriterion?.id ?? score.criterionId : undefined,
        category: score.focus,
        label: score.criterion,
        score: score.value === "NVT" ? null : score.value,
        notApplicable: score.value === "NVT",
        previousScore: score.previousScore,
        comment: score.description ?? "",
      },
    });
  }

  const dossierScores = [
    ...(dossier?.generalScores ?? []).map((score) => ({ ...score, category: "Dossier:Algemeen" })),
    ...(dossier?.personalityScores ?? []).map((score) => ({ ...score, category: "Dossier:Persoonlijkheid" })),
  ];
  for (const score of dossierScores) {
    await tx.score.create({
      data: {
        interventionId,
        category: score.category,
        label: score.criterion,
        score: score.score === "nvt" ? null : score.score,
        notApplicable: score.score === "nvt",
        comment: score.comment,
      },
    });
  }
}

async function upsertCoachingDetail(
  tx: Transaction,
  interventionId: string,
  item: CoachingIntervention
) {
  if (!item.dossier && !item.appointments?.length) return;
  const detail = await tx.coachingDetail.upsert({
    where: { interventionId },
    create: {
      interventionId,
      arrivalTime: item.dossier?.arrivalTime ?? "",
      departureTime: item.dossier?.departureTime ?? "",
      kilometers: item.dossier?.kilometers ? Number(item.dossier.kilometers) : undefined,
      area: item.dossier?.area ?? "",
      sector: item.dossier?.sector ?? "",
      groupAttentionPoints: JSON.stringify(item.dossier?.groupAttentionPoints ?? []),
      individualAttentionPoint: item.dossier?.individualAttentionPoint ?? "",
    },
    update: {
      arrivalTime: item.dossier?.arrivalTime ?? "",
      departureTime: item.dossier?.departureTime ?? "",
      kilometers: item.dossier?.kilometers ? Number(item.dossier.kilometers) : undefined,
      area: item.dossier?.area ?? "",
      sector: item.dossier?.sector ?? "",
      groupAttentionPoints: JSON.stringify(item.dossier?.groupAttentionPoints ?? []),
      individualAttentionPoint: item.dossier?.individualAttentionPoint ?? "",
    },
  });

  await tx.coachingAppointment.deleteMany({ where: { coachingDetailId: detail.id } });
  for (const [index, appointment] of (item.appointments ?? []).entries()) {
    const created = await tx.coachingAppointment.create({
      data: {
        id: appointment.id,
        coachingDetailId: detail.id,
        customer: appointment.customer,
        customerNumber: appointment.customerNumber,
        place: appointment.place,
        relationType: appointment.relationType,
        appointmentType: appointment.appointmentType,
        arrivalTime: appointment.arrivalTime,
        departureTime: appointment.departureTime,
        activity: appointment.activity,
        scores: JSON.stringify(appointment.scores),
        remarks: appointment.remarks,
        deletedAt: appointment.isDeleted ? new Date() : undefined,
        scoreRows: {
          create: appointment.scores.map((score, scoreIndex) => ({
            criterion: score.criterion,
            score: score.score === "nvt" ? null : score.score,
            notApplicable: score.score === "nvt",
            comment: score.comment,
            sortOrder: index * 100 + scoreIndex + 1,
          })),
        },
      },
    });
    void created;
  }
}

async function upsertReflection(tx: Transaction, item: WorkflowReflection) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  await tx.reflection.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      interventionId: item.interventionId,
      representativeId: representative.id,
      learnedText: item.learnedText,
      workOnText: item.workOnText,
      concreteGoalText: item.concreteGoalText,
      status: item.status === "ingediend" ? "INGEDIEND" : "NIET_GESTART",
      submittedAt: dateFromString(item.submittedAt),
    },
    update: {
      learnedText: item.learnedText,
      workOnText: item.workOnText,
      concreteGoalText: item.concreteGoalText,
      status: item.status === "ingediend" ? "INGEDIEND" : "NIET_GESTART",
      submittedAt: dateFromString(item.submittedAt),
    },
  });
}

async function upsertApproval(tx: Transaction, item: WorkflowApproval) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  await tx.approval.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      interventionId: item.interventionId,
      representativeId: representative.id,
      status: item.status ? toApprovalStatus(item.status) : undefined,
      comment: item.comment,
      confirmedAt: dateFromString(item.confirmedAt),
    },
    update: {
      status: item.status ? toApprovalStatus(item.status) : undefined,
      comment: item.comment,
      confirmedAt: dateFromString(item.confirmedAt),
    },
  });
}

async function replaceActionPoints(
  tx: Transaction,
  interventionId: string,
  actions: WorkflowActionPoint[],
  representativeId: string,
  ownerId: string
) {
  await tx.actionPoint.deleteMany({ where: { interventionId } });
  const representative = await findRepresentativeUser(tx, representativeId);
  for (const action of actions) {
    await tx.actionPoint.create({
      data: {
        id: action.id,
        interventionId,
        representativeId: representative.id,
        ownerId: action.owner ?? ownerId,
        title: action.title,
        description: "",
        type: toActionType(action.type),
        status: toActionStatus(action.status),
        priority: toPriority(action.priority ?? "normaal"),
        dueDate: dateFromString(action.due),
      },
    });
  }
}

async function replaceAssignedActionPoints(
  tx: Transaction,
  interventionId: string,
  actions: AssignedWorkflowActionPoint[],
  ownerId: string
) {
  await tx.actionPoint.deleteMany({ where: { interventionId } });
  for (const action of actions) {
    const representative = await findRepresentativeUser(tx, action.representativeIds[0]);
    await tx.actionPoint.create({
      data: {
        id: action.id,
        interventionId,
        representativeId: representative.id,
        ownerId,
        title: action.title,
        description: "",
        type: toActionType(action.type),
        status: toActionStatus(action.status),
        priority: toPriority(action.priority ?? "normaal"),
        dueDate: dateFromString(action.due),
        assignments: {
          create: await Promise.all(action.representativeIds.map(async (id) => ({
            representativeId: (await findRepresentativeUser(tx, id)).id,
            scope: action.scope,
          }))),
        },
      },
    });
  }
}

function interventionData(
  id: string,
  type: DbInterventionType,
  item: CoachingIntervention | ContactMoment | Retraining | SalesTraining,
  representativeUserId: string,
  date?: string
): Prisma.InterventionUncheckedCreateInput {
  const baseDate =
    date ??
    ("plannedDate" in item ? item.plannedDate : undefined) ??
    ("date" in item ? item.date : undefined);
  return {
    id,
    type,
    status: "status" in item ? toInterventionStatus(item.status) : "CONCEPT",
    representativeId: representativeUserId,
    initiatorId: item.initiatorId,
    ownerId: "ownerId" in item ? item.ownerId : item.initiatorId,
    teamId: "teamId" in item ? item.teamId : undefined,
    country: item.country,
    title:
      "title" in item
        ? item.title
        : "theme" in item
          ? item.theme
          : "reason" in item
            ? item.reason
            : "Interventie",
    plannedAt: dateFromString(baseDate),
    startTime: "startTime" in item ? item.startTime : undefined,
    endTime: "endTime" in item ? item.endTime : undefined,
    notifyRepresentative: "notifyRepresentative" in item ? item.notifyRepresentative ?? false : false,
    completedAt: "completedAt" in item ? dateFromString(item.completedAt) : undefined,
    finalizedAt: "finalizedAt" in item ? dateFromString(item.finalizedAt) : undefined,
    deletedAt: "deletedAt" in item ? dateFromString(item.deletedAt) : undefined,
  };
}

function interventionUpdateData(data: Prisma.InterventionUncheckedCreateInput) {
  const updateData: Prisma.InterventionUncheckedUpdateInput = { ...data };
  delete updateData.id;
  delete updateData.initiatorId;
  delete updateData.ownerId;
  return updateData;
}

async function findRepresentativeUser(tx: Transaction, representativeId?: string) {
  const user = await tx.user.findFirst({
    where: {
      OR: [
        { id: representativeId },
        { representativeId },
      ],
    },
  });
  if (!user) throw new Error("Vertegenwoordiger niet gevonden.");
  return user;
}

function publicRepresentativeId(user: { id: string; representativeId: string | null }) {
  return user.representativeId ?? user.id;
}

function parseJsonArray(value: string): JsonArray {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toWorkflowActionPoint(item: {
  id: string;
  title: string;
  type: string;
  dueDate: Date | null;
  status: string;
  ownerId: string;
  priority: string;
}): WorkflowActionPoint {
  return {
    id: item.id,
    title: item.title,
    type: fromActionType(item.type),
    due: dateOnly(item.dueDate) ?? "",
    status: fromActionStatus(item.status),
    owner: item.ownerId,
    priority: fromPriority(item.priority),
  };
}

function toAssignedWorkflowActionPoint(item: Parameters<typeof toWorkflowActionPoint>[0] & {
  assignments: { representativeId: string; scope: string }[];
}): AssignedWorkflowActionPoint {
  return {
    ...toWorkflowActionPoint(item),
    representativeIds: item.assignments.map((assignment) => assignment.representativeId),
    scope: item.assignments[0]?.scope === "group" ? "group" : "individual",
  };
}

function toWorkflowScore(item: {
  id: string;
  criterionId: string | null;
  personalCriterionId: string | null;
  category: string | null;
  label: string | null;
  score: number | null;
  notApplicable: boolean;
  previousScore: number | null;
  comment: string | null;
}): WorkflowScore {
  return {
    criterion: item.label ?? "",
    focus: item.category ?? "",
    value: item.notApplicable ? "NVT" : (item.score as WorkflowScore["value"]) ?? "NVT",
    previousScore: item.previousScore ?? undefined,
    criterionId: item.personalCriterionId ?? item.criterionId ?? undefined,
    criterionKind: item.personalCriterionId ? "personal" : "fixed",
    description: item.comment ?? undefined,
  };
}

function toSimpleScore(item: {
  label: string | null;
  score: number | null;
  notApplicable: boolean;
  comment: string | null;
}): CoachingSimpleScore {
  return {
    criterion: item.label ?? "",
    score: toSimpleScoreValue(item.score, item.notApplicable),
    comment: item.comment ?? "",
  };
}

function toSimpleScoreValue(value: number | null, notApplicable: boolean): CoachingSimpleScore["score"] {
  if (notApplicable || value === null) return "nvt";
  if ([0, 1, 2, 3, 4, 5].includes(value)) return value as CoachingSimpleScore["score"];
  return "nvt";
}

function dateFromString(value?: string | Date | null) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateOnly(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function toInterventionStatus(status: string) {
  return status.toUpperCase() as DbInterventionStatus;
}

function fromInterventionStatus(status: string) {
  return status.toLowerCase() as CoachingIntervention["status"];
}

function fromContactStatus(status: string) {
  return status.toLowerCase() as ContactMoment["status"];
}

function fromTrainingStatus(status: string) {
  return status.toLowerCase() as Retraining["status"];
}

function toHelpStatus(status: HelpRequest["status"]) {
  return status.toUpperCase() as DbHelpRequestStatus;
}

function fromHelpStatus(status: string) {
  return status.toLowerCase() as HelpRequest["status"];
}

function toFollowUpType(type: Exclude<HelpRequest["followUpType"], undefined>) {
  if (type === "sales_training") return "SALES_TRAINING";
  if (type === "contactmoment") return "CONTACTMOMENT";
  return type.toUpperCase() as DbInterventionType;
}

function fromFollowUpType(type: string) {
  if (type === "SALES_TRAINING") return "sales_training";
  if (type === "CONTACTMOMENT") return "contactmoment";
  return type.toLowerCase() as HelpRequest["followUpType"];
}

function toApprovalStatus(status: ApprovalStatus) {
  return status.toUpperCase() as DbApprovalStatus;
}

function fromApprovalStatus(status: string) {
  return status.toLowerCase() as ApprovalStatus;
}

function toActionType(type: WorkflowActionPoint["type"]) {
  return type.toUpperCase() as DbActionPointType;
}

function fromActionType(type: string) {
  return type.toLowerCase() as WorkflowActionPoint["type"];
}

function toActionStatus(status: WorkflowActionPoint["status"]) {
  return status.toUpperCase() as DbActionPointStatus;
}

function fromActionStatus(status: string) {
  return status.toLowerCase() as WorkflowActionPoint["status"];
}

function toPriority(priority: string) {
  if (priority === "hoog") return "HIGH" as DbPriority;
  if (priority === "laag") return "LOW" as DbPriority;
  return "NORMAL" as DbPriority;
}

function fromPriority(priority: string) {
  if (priority === "HIGH") return "hoog";
  if (priority === "LOW") return "laag";
  return "normaal";
}
