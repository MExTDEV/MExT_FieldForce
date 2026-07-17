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
import { dedupeById, dedupeWorkflowState } from "@/lib/coaching/visibility";
import { toPriority as toActionDefinitionPriority } from "@/lib/server/action-definitions";
import {
  ensureCriterionSnapshotsForIntervention,
  listCriterionSnapshotsForInterventions,
  sortApplicableCriteria,
  type CriterionSnapshotRow,
} from "@/lib/server/criterion-scopes";
import { richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";
import { loadContactMomentPhotosByInterventionIds } from "@/lib/server/contact-moment-photos";

type JsonArray = string[];

function createEmptyWorkflowState(): WorkflowState {
  return {
    interventions: [],
    reflections: [],
    approvals: [],
    contactMoments: [],
    helpRequests: [],
    linkedInterventions: [],
    retrainings: [],
    salesTrainings: [],
  };
}

export async function loadWorkflowStateFromDatabase(
  options: { interventionWhere?: Prisma.InterventionWhereInput } = {}
): Promise<WorkflowState> {
  const [interventions, helpRequests] = await Promise.all([
    prisma.intervention.findMany({
      where: options.interventionWhere,
      distinct: ["id"],
      include: {
        representative: { include: { team: { select: { id: true, name: true } } } },
        focuses: { include: { focus: true } },
        scores: true,
        contactMoment: true,
        coachingDetail: { include: { appointments: { include: { scoreRows: true } } } },
        trainingDetail: true,
        trainingParticipants: { include: { representative: true } },
        actionPoints: { include: { assignments: { include: { representative: true } } } },
        coachingActions: true,
        reflection: true,
        approval: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.helpRequest.findMany({
      include: {
        representative: { include: { team: { select: { id: true, name: true } } } },
        answers: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const state = createEmptyWorkflowState();
  const coachingIds = interventions
    .filter((item) => item.type === "BEGELEIDING")
    .map((item) => item.id);
  const contactPhotoByIntervention = await loadContactMomentPhotosByInterventionIds(
    interventions.filter((item) => item.type === "CONTACTMOMENT").map((item) => item.id)
  );
  const [auditLogs, changeLogs, criterionSnapshots] = coachingIds.length
    ? await Promise.all([prisma.auditLog.findMany({
        where: { entityType: "Intervention", entityId: { in: coachingIds } },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      }), prisma.coachingChangeLog.findMany({
        where: { interventionId: { in: coachingIds } },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      }), listCriterionSnapshotsForInterventions(coachingIds)])
    : [[], [], []];
  const auditByIntervention = new Map<string, CoachingIntervention["auditTrail"]>();
  const snapshotsByIntervention = new Map<string, CriterionSnapshotRow[]>();
  for (const snapshot of criterionSnapshots) {
    const current = snapshotsByIntervention.get(snapshot.interventionId) ?? [];
    current.push(snapshot);
    snapshotsByIntervention.set(snapshot.interventionId, current);
  }
  for (const audit of auditLogs) {
    const entries = auditByIntervention.get(audit.entityId) ?? [];
    entries.push({
      id: audit.id,
      at: audit.createdAt.toISOString(),
      userId: audit.userId,
      userName: `${audit.user.firstName} ${audit.user.lastName}`.trim(),
      action: audit.action,
      summary: auditSummary(audit.action),
      oldValue: parseAuditValue(audit.oldValue),
      newValue: parseAuditValue(audit.newValue),
    });
    auditByIntervention.set(audit.entityId, entries);
  }
  for (const change of changeLogs) {
    const entries = auditByIntervention.get(change.interventionId) ?? [];
    entries.push({
      id: change.id, at: change.createdAt.toISOString(), userId: change.userId,
      userName: `${change.user.firstName} ${change.user.lastName}`.trim(), action: `coaching.changed.${change.field}`,
      summary: `${change.field} gewijzigd.`,
      oldValue: { value: parseChangeLogValue(change.oldValue) }, newValue: { value: parseChangeLogValue(change.newValue) },
    });
    auditByIntervention.set(change.interventionId, entries);
  }
  for (const item of interventions) {
    const snapshots = snapshotsByIntervention.get(item.id) ?? [];
    const storedGeneralScores = item.scores
      .filter((score) => score.category === "Dossier:Algemeen")
      .map(toSimpleScore);
    const storedPersonalityScores = item.scores
      .filter((score) => score.category === "Dossier:Persoonlijkheid")
      .map(toSimpleScore);
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
        subject: {
          id: representativeId,
          userId: item.representative.id,
          firstName: item.representative.firstName,
          lastName: item.representative.lastName,
          initials: `${item.representative.firstName[0] ?? ""}${item.representative.lastName[0] ?? ""}`,
          role: item.representative.role as "REPRESENTATIVE" | "SALES_LEADER",
          country: item.representative.country as Country,
          teamId: item.representative.teamId ?? "",
          team: item.representative.team?.name ?? "Geen team",
        },
        status: fromInterventionStatus(item.status),
        plannedDate: dateOnly(item.plannedAt),
        startTime: item.startTime ?? undefined,
        endTime: item.endTime ?? undefined,
        notifyRepresentative: item.notifyRepresentative,
        notifyCoachedRepresentative: item.notifyCoachedRepresentative,
        notifyCoachedTeamLeaders: item.notifyCoachedTeamLeaders,
        notifyExecutorTeamLeaders: item.notifyExecutorTeamLeaders,
        peerCoach: item.peerCoach,
        teamDeviation: item.teamDeviation,
        countryDeviation: item.countryDeviation,
        deviationReason: item.deviationReason ?? undefined,
        deviationRecordedById: item.deviationRecordedById ?? undefined,
        deviationRecordedAt: item.deviationRecordedAt?.toISOString(),
        actualStartedAt: item.actualStartedAt?.toISOString(),
        executionDeadlineAt: item.executionDeadlineAt?.toISOString(),
        approvalDeadlineAt: item.approvalDeadlineAt?.toISOString(),
        finalApprovalDeadlineAt: item.finalApprovalDeadlineAt?.toISOString(),
        performerAccessExpiresAt: item.performerAccessExpiresAt?.toISOString(),
        lateCompletion: item.lateCompletion,
        lateCompletionReason: item.lateCompletionReason ?? undefined,
        administrativelyClosedAt: item.administrativelyClosedAt?.toISOString(),
        administrativelyClosedById: item.administrativelyClosedById ?? undefined,
        administrativeCloseReason: item.administrativeCloseReason ?? undefined,
        copiedFromInterventionId: item.copiedFromInterventionId ?? undefined,
        preparationReferenceCoachingId: item.preparationReferenceCoachingId ?? undefined,
        historicAccessSettings: item.historicAccessSettings ?? undefined,
        deletedAt: item.deletedAt?.toISOString(),
        outlookEventId: item.outlookEventId ?? undefined,
        outlookICalUId: item.outlookICalUId ?? undefined,
        outlookSyncStatus: item.outlookSyncStatus,
        lastSyncedAt: item.lastSyncedAt?.toISOString(),
        syncError: item.syncError ?? undefined,
        internalNotes: item.description ?? undefined,
        focusNames: item.focuses.map((focus) => focus.focus.name),
        scores: item.scores.filter((score) => !score.category?.startsWith("Dossier:")).map(toWorkflowScore),
        actionPoints: item.coachingActions.length
          ? item.coachingActions.map(toCoachingWorkflowAction)
          : item.actionPoints.map(toWorkflowActionPoint),
        dossier: item.coachingDetail
          ? {
              arrivalTime: item.coachingDetail.arrivalTime ?? "",
              departureTime: item.coachingDetail.departureTime ?? "",
              kilometers: item.coachingDetail.kilometers?.toString() ?? "",
              area: item.coachingDetail.area ?? "",
              sector: item.coachingDetail.sector ?? "",
              groupAttentionPoints: parseJsonArray(item.coachingDetail.groupAttentionPoints),
              individualAttentionPoint: item.coachingDetail.individualAttentionPoint ?? "",
              generalScores: storedGeneralScores.length
                ? storedGeneralScores
                : snapshotsToSimpleScores(snapshots, "GENERAL_EVALUATION"),
              personalityScores: storedPersonalityScores.length
                ? storedPersonalityScores
                : snapshotsToSimpleScores(snapshots, "PERSONALITY"),
            }
          : undefined,
        appointments: dedupeById(item.coachingDetail?.appointments ?? []).map((appointment) => ({
          id: appointment.id,
          customer: appointment.customer,
          customerNumber: appointment.customerNumber ?? "",
          place: appointment.place ?? "",
          relationType: appointment.relationType as "prospect" | "klant",
          appointmentType: appointment.appointmentType as "vast" | "rood",
          arrivalTime: appointment.arrivalTime,
          departureTime: appointment.departureTime,
          activity: appointment.activity,
          scores: [...new Map(appointment.scoreRows
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((score) => [score.criterion, {
              criterion: score.criterion,
              score: toSimpleScoreValue(score.score, score.notApplicable),
              comment: score.comment,
            }] as const)).values()],
          remarks: appointment.remarks,
          isDeleted: Boolean(appointment.deletedAt),
        })),
        auditTrail: auditByIntervention.get(item.id) ?? [],
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        finalizedAt: item.finalizedAt?.toISOString() ?? item.completedAt?.toISOString(),
        sentForApprovalAt: item.sentForApprovalAt?.toISOString(),
        sentForApprovalById: item.sentForApprovalById ?? undefined,
        approvedByRepAt: item.approvedByRepAt?.toISOString(),
        approvedByRepId: item.approvedByRepId ?? undefined,
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
        plannedDate: dateOnly(item.plannedAt),
        startTime: item.startTime ?? undefined,
        endTime: item.endTime ?? undefined,
        notifyRepresentative: item.notifyRepresentative,
        subject: item.contactMoment.subject ?? undefined,
        contactType: item.contactMoment.contactType ?? undefined,
        location: item.contactMoment.location ?? undefined,
        internalNotes: item.contactMoment.internalNotes ?? item.description ?? undefined,
        outlookEventId: item.outlookEventId ?? undefined,
        outlookICalUId: item.outlookICalUId ?? undefined,
        outlookSyncStatus: item.outlookSyncStatus,
        lastSyncedAt: item.lastSyncedAt?.toISOString(),
        syncError: item.syncError ?? undefined,
        reason: item.contactMoment.reason,
        reportedProblems: item.contactMoment.reportedProblems ?? "",
        leaderThemes: parseJsonArray(item.contactMoment.leaderThemes),
        representativeKpis: parseJsonArray(item.contactMoment.representativeKpis),
        representativeThemes: parseJsonArray(item.contactMoment.representativeThemes),
        discussedThemes: parseJsonArray(item.contactMoment.discussedThemes),
        conclusion: item.contactMoment.conclusion ?? "",
        reportHtml: item.contactMoment.reportHtml ?? item.contactMoment.conclusion ?? "",
        actionPoints: item.actionPoints.map(toWorkflowActionPoint),
        finalSnapshot: item.contactMoment.finalSnapshot ?? undefined,
        sharedAt: item.contactMoment.sharedAt?.toISOString(),
        sharedById: item.contactMoment.sharedById ?? undefined,
        closedReason: item.contactMoment.closedReason ?? undefined,
        closedAt: item.contactMoment.closedAt?.toISOString(),
        closedById: item.contactMoment.closedById ?? undefined,
        previousStatus: item.contactMoment.previousStatus ? fromContactStatus(item.contactMoment.previousStatus) : undefined,
        sourceHelpRequestId: item.contactMoment.sourceHelpRequestId ?? undefined,
        photos: contactPhotoByIntervention.get(item.id) ?? [],
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
        reflectionKpiHtml: item.approval.reflectionKpiHtml ?? undefined,
        reflectionLearningHtml: item.approval.reflectionLearningHtml ?? undefined,
        reflectionGoalHtml: item.approval.reflectionGoalHtml ?? undefined,
        reflectionCompletedAt: item.approval.reflectionCompletedAt?.toISOString(),
        reflectionCompletedByUserId: item.approval.reflectionCompletedByUserId ?? undefined,
        createdAt: item.approval.createdAt.toISOString(),
        confirmedAt: item.approval.confirmedAt?.toISOString(),
      });
    }
  }

  state.helpRequests = helpRequests.map((item) => ({
    id: item.id,
    requesterId: item.requesterId,
    representativeId: publicRepresentativeId(item.representative),
    responsibleUserId: item.responsibleUserId ?? undefined,
    country: item.representative.country as Country,
    teamId: item.representative.teamId ?? "",
    subject: item.subject,
    descriptionHtml: item.descriptionHtml ?? item.explanation ?? item.difficulty,
    descriptionText: item.descriptionText ?? item.explanation ?? item.difficulty,
    difficulty: item.difficulty,
    desiredResult: item.desiredResult,
    urgency: item.urgency === "HIGH" ? "hoog" : item.urgency === "LOW" ? "laag" : "normaal",
    explanation: item.explanation ?? "",
    status: fromHelpStatus(item.status),
    firstHandledAt: item.firstHandledAt?.toISOString(),
    firstHandledByUserId: item.firstHandledByUserId ?? undefined,
    withdrawnAt: item.withdrawnAt?.toISOString(),
    withdrawnByUserId: item.withdrawnByUserId ?? undefined,
    answers: item.answers.map((answer) => ({
      id: answer.id,
      helpRequestId: answer.helpRequestId,
      authorId: answer.authorId,
      bodyHtml: answer.bodyHtml,
      bodyText: answer.bodyText,
      closesRequest: answer.closesRequest,
      createdAt: answer.createdAt.toISOString(),
    })),
    followUpType: item.followUpType ? fromFollowUpType(item.followUpType) : undefined,
    linkedInterventionId: item.linkedInterventionId ?? item.interventionId ?? undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return dedupeWorkflowState(state);
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
    update: {
      ...interventionUpdateData(data),
      outlookSyncStatus: "NOT_SYNCED",
      syncError: null,
    },
  });
  await ensureCriterionSnapshotsForIntervention(tx, item.id, representative.id);
  await replaceInterventionFocuses(tx, item.id, item.focusNames);
  await replaceScores(tx, item.id, item.scores, item.dossier);
  await upsertCoachingDetail(tx, item.id, item);
  await replaceActionPoints(tx, item.id, item.actionPoints, item.representativeId, item.ownerId);
  await syncCoachingActions(tx, item, representative);
}

async function syncCoachingActions(tx: Transaction, item: CoachingIntervention, user: { id: string; country: Country; teamId: string | null }) {
  const userId = user.id;
  const plannedAt = dateFromString(item.plannedDate) ?? new Date();
  const existingCount = await tx.coachingAction.count({ where: { interventionId: item.id } });
  if (existingCount === 0 && item.status === "gepland") {
    await tx.actionDefinition.updateMany({
      where: { userId, active: true, deletedAt: null, validUntil: null, validFrom: { lt: plannedAt } },
      data: { validUntil: plannedAt },
    });
    const keys = ["GLOBAL", `COUNTRY:${user.country}`, ...(user.teamId ? [`TEAM:${user.teamId}`] : []), `USER:${userId}`];
    const definitions = await tx.actionDefinition.findMany({
      where: { active: true, deletedAt: null, scopeKey: { in: keys }, validFrom: { lte: plannedAt }, OR: [{ validUntil: null }, { validUntil: { gte: plannedAt } }] },
      select: {
        id: true,
        title: true,
        description: true,
        tipsAndTricks: true,
        targetValue: true,
        priority: true,
        targetOverrides: {
          where: { scopeKey: { in: keys } },
          select: { scopeKey: true, targetValue: true },
        },
      },
      orderBy: [{ priority: "desc" }, { title: "asc" }],
    });
    const inherited = definitions.map((definition) => {
      const override = [`USER:${userId}`, ...(user.teamId ? [`TEAM:${user.teamId}`] : []), `COUNTRY:${user.country}`].map((key) => definition.targetOverrides.find((item) => item.scopeKey === key)).find(Boolean);
      return { ...definition, targetValue: override?.targetValue ?? definition.targetValue };
    });
    if (inherited.length) {
      await tx.coachingAction.createMany({ data: inherited.map((action) => ({
        interventionId: item.id, actionDefinitionId: action.id, userId, title: action.title,
        description: action.description, tipsAndTricks: action.tipsAndTricks, targetValue: action.targetValue,
        priority: action.priority, isNew: false,
      })) });
    }
  }
  if (!item.actionPoints.length) return;
  await tx.coachingAction.deleteMany({ where: { interventionId: item.id } });
  for (const action of item.actionPoints.filter((entry) => entry.title.trim())) {
    let definitionId = action.definitionId;
    if (action.isNew && ["voltooid", "gefinaliseerd", "gesloten"].includes(item.status)) {
      const definition = await tx.actionDefinition.create({
        data: {
          title: action.title.trim(), description: action.description?.trim() ?? "", tipsAndTricks: sanitizeRichText(action.tipsAndTricks ?? ""),
          targetValue: action.targetValue, priority: toActionDefinitionPriority(action.priority ?? "normaal"), scope: "USER",
          scopeKey: `USER:${userId}`, userId, country: item.country, teamId: item.teamId,
          active: true, validFrom: plannedAt, createdById: item.ownerId, updatedById: item.ownerId,
        },
        select: { id: true },
      });
      definitionId = definition.id;
    }
    await tx.coachingAction.create({ data: {
      interventionId: item.id, actionDefinitionId: definitionId, userId, title: action.title,
      description: action.description ?? "", tipsAndTricks: sanitizeRichText(action.tipsAndTricks ?? ""),
      targetValue: action.targetValue, achievedScore: action.achievedScore,
      priority: toActionDefinitionPriority(action.priority ?? "normaal"), isNew: Boolean(action.isNew),
      reviewStatus: toCoachingActionReviewStatus(action.reviewStatus),
      originalTitle: action.originalTitle,
      originalDescription: action.originalDescription,
      originalTipsAndTricks: action.originalTipsAndTricks,
      rejectionReason: action.rejectionReason,
      reviewComment: action.reviewComment,
      reviewedById: action.reviewedById,
      reviewedAt: dateFromString(action.reviewedAt),
      activatedAt: dateFromString(action.activatedAt),
    } });
  }
}

async function upsertContactMoment(tx: Transaction, item: ContactMoment) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  const data = interventionData(item.id, "CONTACTMOMENT", item, representative.id);
  await tx.intervention.upsert({
    where: { id: item.id },
    create: data,
    update: {
      ...interventionUpdateData(data),
      outlookSyncStatus: "NOT_SYNCED",
      syncError: null,
    },
  });
  await tx.contactMomentDetail.upsert({
    where: { interventionId: item.id },
    create: {
      interventionId: item.id,
      reason: item.reason,
      subject: item.subject,
      contactType: item.contactType,
      location: item.location,
      internalNotes: item.internalNotes,
      reportedProblems: item.reportedProblems,
      leaderThemes: JSON.stringify(item.leaderThemes),
      representativeKpis: JSON.stringify(item.representativeKpis),
      representativeThemes: JSON.stringify(item.representativeThemes),
      discussedThemes: JSON.stringify(item.discussedThemes),
      conclusion: item.conclusion,
      reportHtml: sanitizeRichText(item.reportHtml ?? item.conclusion ?? ""),
      finalSnapshot: item.finalSnapshot,
      sharedAt: dateFromString(item.sharedAt),
      sharedById: item.sharedById,
      closedReason: item.closedReason,
      closedAt: dateFromString(item.closedAt),
      closedById: item.closedById,
      previousStatus: item.previousStatus ? toInterventionStatus(item.previousStatus) : undefined,
      sourceHelpRequestId: item.sourceHelpRequestId,
    },
    update: {
      reason: item.reason,
      subject: item.subject,
      contactType: item.contactType,
      location: item.location,
      internalNotes: item.internalNotes,
      reportedProblems: item.reportedProblems,
      leaderThemes: JSON.stringify(item.leaderThemes),
      representativeKpis: JSON.stringify(item.representativeKpis),
      representativeThemes: JSON.stringify(item.representativeThemes),
      discussedThemes: JSON.stringify(item.discussedThemes),
      conclusion: item.conclusion,
      reportHtml: sanitizeRichText(item.reportHtml ?? item.conclusion ?? ""),
      finalSnapshot: item.finalSnapshot,
      sharedAt: dateFromString(item.sharedAt),
      sharedById: item.sharedById,
      closedReason: item.closedReason,
      closedAt: dateFromString(item.closedAt),
      closedById: item.closedById,
      previousStatus: item.previousStatus ? toInterventionStatus(item.previousStatus) : undefined,
      sourceHelpRequestId: item.sourceHelpRequestId,
    },
  });
  await replaceActionPoints(tx, item.id, item.actionPoints, item.representativeId, item.ownerId);
}

async function upsertHelpRequest(tx: Transaction, item: HelpRequest) {
  const representative = await findRepresentativeUser(tx, item.representativeId);
  const responsibleUserId = item.responsibleUserId || await resolveHelpRequestResponsibleUserId(tx, representative.id, representative.teamId, representative.country as Country);
  const descriptionHtml = sanitizeRichText(item.descriptionHtml ?? item.explanation ?? item.difficulty);
  const descriptionText = item.descriptionText ?? richTextToPlainText(descriptionHtml);
  await tx.helpRequest.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      requesterId: item.requesterId,
      representativeId: representative.id,
      responsibleUserId,
      subject: item.subject,
      descriptionHtml,
      descriptionText,
      difficulty: item.difficulty,
      desiredResult: item.desiredResult,
      explanation: item.explanation,
      urgency: toPriority(item.urgency),
      status: toHelpStatus(item.status),
      firstHandledAt: dateFromString(item.firstHandledAt),
      firstHandledByUserId: item.firstHandledByUserId,
      withdrawnAt: dateFromString(item.withdrawnAt),
      withdrawnByUserId: item.withdrawnByUserId,
      followUpType: item.followUpType ? toFollowUpType(item.followUpType) : undefined,
      linkedInterventionId: item.linkedInterventionId,
    },
    update: {
      representativeId: representative.id,
      responsibleUserId,
      subject: item.subject,
      descriptionHtml,
      descriptionText,
      difficulty: item.difficulty,
      desiredResult: item.desiredResult,
      explanation: item.explanation,
      urgency: toPriority(item.urgency),
      status: toHelpStatus(item.status),
      firstHandledAt: dateFromString(item.firstHandledAt),
      firstHandledByUserId: item.firstHandledByUserId,
      withdrawnAt: dateFromString(item.withdrawnAt),
      withdrawnByUserId: item.withdrawnByUserId,
      followUpType: item.followUpType ? toFollowUpType(item.followUpType) : undefined,
      linkedInterventionId: item.linkedInterventionId,
    },
  });
  for (const answer of item.answers ?? []) {
    await tx.helpRequestAnswer.upsert({
      where: { id: answer.id },
      create: {
        id: answer.id,
        helpRequestId: item.id,
        authorId: answer.authorId,
        bodyHtml: sanitizeRichText(answer.bodyHtml),
        bodyText: answer.bodyText || richTextToPlainText(answer.bodyHtml),
        closesRequest: answer.closesRequest,
        createdAt: dateFromString(answer.createdAt),
      },
      update: {},
    });
  }
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
        score: typeof score.score === "number" ? score.score : null,
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
      reflectionKpiHtml: item.reflectionKpiHtml ? sanitizeRichText(item.reflectionKpiHtml) : undefined,
      reflectionLearningHtml: item.reflectionLearningHtml ? sanitizeRichText(item.reflectionLearningHtml) : undefined,
      reflectionGoalHtml: item.reflectionGoalHtml ? sanitizeRichText(item.reflectionGoalHtml) : undefined,
      reflectionCompletedAt: dateFromString(item.reflectionCompletedAt),
      reflectionCompletedByUserId: item.reflectionCompletedByUserId,
      confirmedAt: dateFromString(item.confirmedAt),
    },
    update: {
      status: item.status ? toApprovalStatus(item.status) : undefined,
      comment: item.comment,
      reflectionKpiHtml: item.reflectionKpiHtml ? sanitizeRichText(item.reflectionKpiHtml) : undefined,
      reflectionLearningHtml: item.reflectionLearningHtml ? sanitizeRichText(item.reflectionLearningHtml) : undefined,
      reflectionGoalHtml: item.reflectionGoalHtml ? sanitizeRichText(item.reflectionGoalHtml) : undefined,
      reflectionCompletedAt: dateFromString(item.reflectionCompletedAt),
      reflectionCompletedByUserId: item.reflectionCompletedByUserId,
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
        description: action.description ?? "",
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
            status: toActionStatus(action.status),
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
    description: "internalNotes" in item ? item.internalNotes : undefined,
    plannedAt: dateFromString(baseDate),
    startTime: "startTime" in item ? item.startTime : undefined,
    endTime: "endTime" in item ? item.endTime : undefined,
    notifyRepresentative: "notifyRepresentative" in item ? item.notifyRepresentative ?? false : false,
    notifyCoachedRepresentative: "notifyCoachedRepresentative" in item ? item.notifyCoachedRepresentative ?? false : false,
    notifyCoachedTeamLeaders: "notifyCoachedTeamLeaders" in item ? item.notifyCoachedTeamLeaders ?? false : false,
    notifyExecutorTeamLeaders: "notifyExecutorTeamLeaders" in item ? item.notifyExecutorTeamLeaders ?? false : false,
    notifyCoachedLeaderIntent: "notifyCoachedTeamLeaders" in item ? item.notifyCoachedTeamLeaders ?? false : false,
    notifyExecutorLeaderIntent: "notifyExecutorTeamLeaders" in item ? item.notifyExecutorTeamLeaders ?? false : false,
    peerCoach: "peerCoach" in item ? item.peerCoach ?? false : false,
    teamDeviation: "teamDeviation" in item ? item.teamDeviation ?? false : false,
    countryDeviation: "countryDeviation" in item ? item.countryDeviation ?? false : false,
    deviationReason: "deviationReason" in item ? item.deviationReason || undefined : undefined,
    deviationRecordedById: "deviationRecordedById" in item ? item.deviationRecordedById : undefined,
    deviationRecordedAt: "deviationRecordedAt" in item ? dateFromString(item.deviationRecordedAt) : undefined,
    actualStartedAt: "actualStartedAt" in item ? dateFromString(item.actualStartedAt) : undefined,
    executionDeadlineAt: "executionDeadlineAt" in item ? dateFromString(item.executionDeadlineAt) : undefined,
    approvalDeadlineAt: "approvalDeadlineAt" in item ? dateFromString(item.approvalDeadlineAt) : undefined,
    finalApprovalDeadlineAt: "finalApprovalDeadlineAt" in item ? dateFromString(item.finalApprovalDeadlineAt) : undefined,
    performerAccessExpiresAt: "performerAccessExpiresAt" in item ? dateFromString(item.performerAccessExpiresAt) : undefined,
    lateCompletion: "lateCompletion" in item ? item.lateCompletion ?? false : false,
    lateCompletionReason: "lateCompletionReason" in item ? item.lateCompletionReason || undefined : undefined,
    administrativelyClosedAt: "administrativelyClosedAt" in item ? dateFromString(item.administrativelyClosedAt) : undefined,
    administrativelyClosedById: "administrativelyClosedById" in item ? item.administrativelyClosedById : undefined,
    administrativeCloseReason: "administrativeCloseReason" in item ? item.administrativeCloseReason || undefined : undefined,
    copiedFromInterventionId: "copiedFromInterventionId" in item ? item.copiedFromInterventionId : undefined,
    preparationReferenceCoachingId: "preparationReferenceCoachingId" in item ? item.preparationReferenceCoachingId : undefined,
    historicAccessSettings: "historicAccessSettings" in item ? item.historicAccessSettings : undefined,
    completedAt: "completedAt" in item ? dateFromString(item.completedAt) : undefined,
    finalizedAt: "finalizedAt" in item ? dateFromString(item.finalizedAt) : undefined,
    sentForApprovalAt: "sentForApprovalAt" in item ? dateFromString(item.sentForApprovalAt) : undefined,
    sentForApprovalById: "sentForApprovalById" in item ? item.sentForApprovalById : undefined,
    approvedByRepAt: "approvedByRepAt" in item ? dateFromString(item.approvedByRepAt) : undefined,
    approvedByRepId: "approvedByRepId" in item ? item.approvedByRepId : undefined,
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

async function resolveHelpRequestResponsibleUserId(
  tx: Transaction,
  representativeUserId: string,
  teamId: string | null,
  country: Country
) {
  if (teamId) {
    const team = await tx.team.findUnique({
      where: { id: teamId },
      select: { primaryLeaderId: true },
    });
    if (team?.primaryLeaderId) return team.primaryLeaderId;
    const linkedLeader = await tx.teamLeader.findFirst({
      where: { teamId, type: "PRIMARY", user: { active: true } },
      select: { userId: true },
    });
    if (linkedLeader?.userId) return linkedLeader.userId;
  }
  const fallback = await tx.user.findFirst({
    where: {
      active: true,
      country,
      role: { in: ["SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "SUPER_ADMIN"] },
      id: { not: representativeUserId },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback?.id;
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

function parseAuditValue(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function auditSummary(action: string) {
  const labels: Record<string, string> = {
    "coaching.reopened": "Afgewerkte begeleiding opnieuw geopend voor aanpassing.",
    "coaching.sent_for_approval": "Begeleiding naar de vertegenwoordiger verstuurd ter akkoord.",
    "coaching.approved_by_representative": "Vertegenwoordiger bevestigde voor akkoord.",
    "workflow.coaching.save": "Begeleiding aangepast en opgeslagen.",
  };
  return labels[action] ?? action.replaceAll("_", " ").replaceAll(".", " · ");
}

function toWorkflowActionPoint(item: {
  id: string;
  title: string;
  type: string;
  dueDate: Date | null;
  status: string;
  ownerId: string;
  priority: string;
  description: string;
  closedAt?: Date | null;
  closedByUserId?: string | null;
}): WorkflowActionPoint {
  return {
    id: item.id,
    title: item.title,
    type: fromActionType(item.type),
    due: dateOnly(item.dueDate) ?? "",
    status: fromActionStatus(item.status),
    owner: item.ownerId,
    priority: fromPriority(item.priority),
    description: item.description || undefined,
    closedAt: item.closedAt?.toISOString(),
    closedByUserId: item.closedByUserId ?? undefined,
  };
}

function parseChangeLogValue(value: string | null) {
  if (value === null) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function toCoachingWorkflowAction(item: {
  id: string; actionDefinitionId: string | null; title: string; description: string; tipsAndTricks: string;
  targetValue: { toString(): string } | null; achievedScore: { toString(): string } | null;
  priority: DbPriority; isNew: boolean; reviewStatus: string; originalTitle: string | null;
  originalDescription: string | null; originalTipsAndTricks: string | null; rejectionReason: string | null;
  reviewComment: string | null; reviewedById: string | null; reviewedAt: Date | null; activatedAt: Date | null;
}): WorkflowActionPoint {
  return {
    id: item.id, definitionId: item.actionDefinitionId ?? undefined, title: item.title,
    description: item.description, tipsAndTricks: item.tipsAndTricks,
    targetValue: item.targetValue === null ? undefined : Number(item.targetValue),
    achievedScore: item.achievedScore === null ? undefined : Number(item.achievedScore),
    type: "vaardigheid", due: "", status: "open", priority: fromPriority(item.priority), isNew: item.isNew,
    reviewStatus: fromCoachingActionReviewStatus(item.reviewStatus),
    originalTitle: item.originalTitle ?? undefined,
    originalDescription: item.originalDescription ?? undefined,
    originalTipsAndTricks: item.originalTipsAndTricks ?? undefined,
    rejectionReason: item.rejectionReason ?? undefined,
    reviewComment: item.reviewComment ?? undefined,
    reviewedById: item.reviewedById ?? undefined,
    reviewedAt: item.reviewedAt?.toISOString(),
    activatedAt: item.activatedAt?.toISOString(),
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

function snapshotsToSimpleScores(
  snapshots: CriterionSnapshotRow[],
  criterionType: "GENERAL_EVALUATION" | "PERSONALITY"
): CoachingSimpleScore[] {
  return sortApplicableCriteria(
    snapshots.filter((snapshot) => snapshot.criterionType === criterionType)
  ).map((snapshot) => ({
    criterion: snapshot.title,
    score: null,
    comment: "",
  }));
}

function toSimpleScoreValue(value: number | null, notApplicable: boolean): CoachingSimpleScore["score"] {
  if (notApplicable) return "nvt";
  if (value !== null && [0, 1, 2, 3, 4, 5].includes(value)) return value as CoachingSimpleScore["score"];
  return null;
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
  if (status === "open") return "OPEN" as DbHelpRequestStatus;
  if (status === "begeleiding") return "BEGELEIDING" as DbHelpRequestStatus;
  if (status === "contactmoment") return "CONTACTMOMENT" as DbHelpRequestStatus;
  if (status === "retraining") return "RETRAINING" as DbHelpRequestStatus;
  if (status === "salestraining") return "SALESTRAINING" as DbHelpRequestStatus;
  if (status === "gesloten") return "GESLOTEN" as DbHelpRequestStatus;
  if (status === "ingetrokken") return "INGETROKKEN" as DbHelpRequestStatus;
  return status.toUpperCase() as DbHelpRequestStatus;
}

function fromHelpStatus(status: string) {
  if (status === "NIEUW") return "open";
  if (status === "VERVOLGACTIE_GEPLAND") return "in_behandeling";
  if (status === "AFGESLOTEN") return "gesloten";
  if (status === "GEANNULEERD") return "ingetrokken";
  if (status === "SALESTRAINING") return "salestraining";
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

function fromCoachingActionReviewStatus(status: string): NonNullable<WorkflowActionPoint["reviewStatus"]> {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "ACTIVE") return "active";
  return "proposed";
}

function toCoachingActionReviewStatus(status?: WorkflowActionPoint["reviewStatus"]) {
  if (status === "approved") return "APPROVED";
  if (status === "rejected") return "REJECTED";
  if (status === "active") return "ACTIVE";
  return "PROPOSED";
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
