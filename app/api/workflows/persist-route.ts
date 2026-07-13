import {
  saveWorkflowPatchToDatabase,
  type WorkflowPersistencePatch,
} from "@/lib/server/workflows";
import { forbidden, handleApi } from "@/lib/server/api";
import { writeAuditLogs } from "@/lib/server/audit";
import { buildVisibleCoachingWhere, canManageStoredCoaching } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import {
  requireAuthenticatedUser,
  actorCanAccessCountry,
  requireCoachingParticipantScope,
  requireCoachingOwnerScope,
  requirePermission,
  requireRepresentativeScope,
  requireRole,
} from "@/lib/server/authenticated-user";
import {
  canCreateCoachingIntervention,
  canCreateIntervention,
} from "@/lib/permissions";
import { isBlankRichText } from "@/lib/rich-text";
import { assertCanPlanPeerCoaching, canExecutePeerCoaching } from "@/lib/coaching/peer-execution";
import {
  recordOutlookSyncFailure,
  requireMicrosoftAccessToken,
  syncCoachingsToOutlook,
  syncContactMomentsToOutlook,
  transferCoachingsBetweenOwners,
} from "@/lib/server/microsoft-graph";
import { sendWorkflowEventMail } from "@/lib/server/mail-service";
import { createInAppNotification } from "@/lib/server/notifications";
import { applyOutlookSyncToWorkflowStatePatch } from "@/lib/workflow-state-patch";
import {
  buildCoachingApprovalConfirmedEntityTitle,
  buildCoachingApprovalConfirmedEventKey,
  coachingApprovalConfirmedNotificationType,
  resolveCoachingApprovalConfirmedRecipients,
} from "@/lib/coaching/approval-notifications";

export async function persistWorkflowPatch(
  request: Request,
  routeName: string,
  selectPatch: (payload: WorkflowPersistencePatch) => WorkflowPersistencePatch
) {
  return handleApi(`api/workflows/${routeName}`, async () => {
    const payload = (await request.json()) as WorkflowPersistencePatch;
    const selectedPatch = selectPatch(payload);
    const actor = await requireAuthenticatedUser(actorIdFromPatch(selectedPatch));
    requireWorkflowPermission(routeName, actor);
    const interventionPatch = selectedPatch.interventions ?? [];
    const hasCoachings = interventionPatch.length > 0;
    if (routeName !== "coaching" && hasCoachings && !canCreateCoachingIntervention(actor)) {
      forbidden("Je mag geen begeleiding inplannen.");
    }
    if (hasCoachings) {
      const peerScopeValidated = await validatePeerCoachingScope(actor, interventionPatch);
      if (!peerScopeValidated) {
        await requireCoachingParticipantScope(actor, interventionPatch.map((item) => item.representativeId));
      }
      await requireCoachingOwnerScope(actor, interventionPatch.map((item) => item.ownerId));
    }
    if (routeName !== "coaching") {
      await requireRepresentativeScope(actor, representativeIdsFromPatch(selectedPatch));
    }
    if (selectedPatch.interventions?.length) {
      await requireExistingCoachingsMutable(actor, selectedPatch.interventions);
    }
    if (selectedPatch.contactMoments?.length) {
      await requireExistingContactMomentsMutable(actor, selectedPatch.contactMoments);
    }
    if (selectedPatch.helpRequests?.length) {
      await requireHelpRequestsMutable(actor, selectedPatch.helpRequests);
    }
    if (routeName === "help-requests") {
      await requireHelpRequestCoachingFollowUps(actor, selectedPatch);
    }
    const coachingBefore = hasCoachings
      ? await loadCoachingSnapshots(selectedPatch.interventions?.map((item) => item.id) ?? [])
      : new Map<string, Record<string, unknown>>();
    const patch = await applyAuthenticatedActor(selectedPatch, actor.id);
    await saveWorkflowPatchToDatabase(patch);
    await createWorkflowInAppNotifications(routeName, patch, actor.id);
    if (patch.interventions?.length) {
      await writeCoachingChangeLogs(actor.id, patch.interventions ?? [], coachingBefore);
    }
    await writeAuditLogs(auditEntriesFromWorkflowPatch(routeName, patch, actor.id, coachingBefore));
    let outlookSync = undefined;
    if (patch.interventions?.length || patch.contactMoments?.length) {
      try {
        const accessToken = await requireMicrosoftAccessToken(request);
        await transferCoachingsBetweenOwners(accessToken, actor.id, (patch.interventions ?? []).flatMap((item) => {
          const old = coachingBefore.get(item.id);
          const oldOwnerId = typeof old?.ownerId === "string" ? old.ownerId : item.ownerId;
          return oldOwnerId !== item.ownerId ? [{ interventionId: item.id, oldOwnerId, newOwnerId: item.ownerId, outlookEventId: typeof old?.outlookEventId === "string" ? old.outlookEventId : undefined }] : [];
        }));
        outlookSync = [
          ...await syncCoachingsToOutlook(accessToken, actor.id, patch.interventions ?? []),
          ...await syncContactMomentsToOutlook(accessToken, actor.id, patch.contactMoments ?? []),
        ];
      } catch (error) {
        console.error("[outlook-sync] Fieldforce-opslag is behouden.", error);
        outlookSync = [
          ...await recordOutlookSyncFailure(actor.id, patch.interventions ?? [], error),
          ...await recordOutlookSyncFailure(actor.id, patch.contactMoments ?? [], error, "CONTACTMOMENT"),
        ];
      }
    }
    return { ok: true, patch: applyOutlookSyncToWorkflowStatePatch(patch, outlookSync), outlookSync };
  }, "Workflowgegevens konden niet worden opgeslagen.");
}

async function createWorkflowInAppNotifications(
  routeName: string,
  patch: WorkflowPersistencePatch,
  actorId: string
) {
  await createCoachingApprovalConfirmedNotifications(patch, actorId);

  for (const request of patch.helpRequests ?? []) {
    if (
      request.status === "open" &&
      request.responsibleUserId &&
      request.responsibleUserId !== actorId &&
      !(request.answers ?? []).length &&
      !request.followUpType &&
      !request.withdrawnAt
    ) {
      await createInAppNotification(prisma, {
        type: "HELP_REQUEST_CREATED",
        recipientUserId: request.responsibleUserId,
        entityId: request.id,
        eventKey: `HELP_REQUEST_CREATED:helpRequest:${request.id}`,
        triggeredByUserId: actorId,
        sourceModule: "HULPAANVRAGEN",
      });
      await sendWorkflowMailSafely({
        type: "HELP_REQUEST_CREATED",
        recipientUserId: request.responsibleUserId,
        triggeredByUserId: actorId,
        entityTitle: request.subject,
        linkUrl: `/hulpaanvragen/${request.id}`,
        contentHtml: request.descriptionHtml ?? request.explanation ?? request.difficulty,
        context: {
          sourceModule: "HULPAANVRAGEN",
          entityType: "HelpRequest",
          entityId: request.id,
          eventKey: `HELP_REQUEST_CREATED:helpRequest:${request.id}`,
          reason: "Nieuwe hulpaanvraag",
        },
      });
    }

    const lastAnswer = request.answers?.at(-1);
    if (lastAnswer?.authorId === actorId && (!request.followUpType || lastAnswer.closesRequest)) {
      const recipientUserId = lastAnswer.authorId === request.requesterId
        ? request.responsibleUserId
        : request.requesterId;
      if (recipientUserId && recipientUserId !== actorId) {
        const type = lastAnswer.closesRequest ? "HELP_REQUEST_CLOSED" : "HELP_REQUEST_ANSWERED";
        await createInAppNotification(prisma, {
          type,
          recipientUserId,
          entityId: request.id,
          eventKey: `${type}:helpRequest:${request.id}:answer:${lastAnswer.id}`,
          triggeredByUserId: actorId,
          sourceModule: "HULPAANVRAGEN",
        });
        await sendWorkflowMailSafely({
          type,
          recipientUserId,
          triggeredByUserId: actorId,
          entityTitle: request.subject,
          linkUrl: `/hulpaanvragen/${request.id}`,
          contentHtml: lastAnswer.bodyHtml,
          context: {
            sourceModule: "HULPAANVRAGEN",
            entityType: "HelpRequest",
            entityId: request.id,
            eventKey: `${type}:helpRequest:${request.id}:answer:${lastAnswer.id}`,
            reason: lastAnswer.closesRequest ? "Hulpaanvraag gesloten" : "Antwoord op hulpaanvraag",
          },
        });
      }
    }

    if (request.followUpType && request.followUpType !== "geen_actie" && request.status !== "open" && request.status !== "in_behandeling") {
      const recipientUserId = request.requesterId !== actorId ? request.requesterId : request.representativeId;
      if (recipientUserId && recipientUserId !== actorId) {
        await createInAppNotification(prisma, {
          type: "HELP_REQUEST_FOLLOW_UP",
          recipientUserId,
          entityId: request.id,
          eventKey: `HELP_REQUEST_FOLLOW_UP:helpRequest:${request.id}:${request.followUpType}:${request.linkedInterventionId ?? request.updatedAt}`,
          triggeredByUserId: actorId,
          sourceModule: "HULPAANVRAGEN",
        });
        await sendWorkflowMailSafely({
          type: "HELP_REQUEST_FOLLOW_UP",
          recipientUserId,
          triggeredByUserId: actorId,
          entityTitle: request.subject,
          linkUrl: `/hulpaanvragen/${request.id}`,
          contentHtml: lastAnswer?.bodyHtml,
          context: {
            sourceModule: "HULPAANVRAGEN",
            entityType: "HelpRequest",
            entityId: request.id,
            eventKey: `HELP_REQUEST_FOLLOW_UP:helpRequest:${request.id}:${request.followUpType}:${request.linkedInterventionId ?? request.updatedAt}`,
            reason: "Opvolging voor hulpaanvraag",
          },
        });
      }
    }
  }

  for (const contactMoment of patch.contactMoments ?? []) {
    const recipientUserId = contactMoment.representativeId;
    if (!recipientUserId || recipientUserId === actorId) continue;

    const visibleToRepresentative = Boolean(contactMoment.notifyRepresentative || contactMoment.sharedAt);
    if (!visibleToRepresentative) continue;

    const type =
      contactMoment.status === "afgesloten"
        ? "CONTACT_MOMENT_SHARED"
        : contactMoment.status === "geannuleerd"
          ? "CONTACT_MOMENT_CANCELLED"
          : contactMoment.status === "niet_uitgevoerd"
            ? "CONTACT_MOMENT_NOT_EXECUTED"
            : routeName === "contact-moments" && contactMoment.createdAt === contactMoment.updatedAt
              ? "CONTACT_MOMENT_PLANNED"
              : "CONTACT_MOMENT_UPDATED";

    await createInAppNotification(prisma, {
      type,
      recipientUserId,
      entityId: contactMoment.id,
      eventKey: `${type}:contactMoment:${contactMoment.id}:${contactMoment.sharedAt ?? contactMoment.closedAt ?? contactMoment.updatedAt}`,
      triggeredByUserId: actorId,
      sourceModule: "CONTACTMOMENTEN",
    });
    await sendWorkflowMailSafely({
      type,
      recipientUserId,
      triggeredByUserId: actorId,
      entityTitle: contactMoment.subject || contactMoment.reason,
      linkUrl: `/contactmomenten/${contactMoment.id}`,
      context: {
        sourceModule: "CONTACTMOMENTEN",
        entityType: "Intervention",
        entityId: contactMoment.id,
        eventKey: `${type}:contactMoment:${contactMoment.id}:${contactMoment.sharedAt ?? contactMoment.closedAt ?? contactMoment.updatedAt}`,
        reason: "Contactmoment update",
      },
    });
  }
}

async function createCoachingApprovalConfirmedNotifications(
  patch: WorkflowPersistencePatch,
  actorId: string
) {
  const confirmedApprovals = (patch.approvals ?? []).filter((approval) => approval.status === "gelezen_akkoord");
  if (!confirmedApprovals.length) return;

  const coachings = await prisma.intervention.findMany({
    where: {
      id: { in: [...new Set(confirmedApprovals.map((approval) => approval.interventionId))] },
      type: "BEGELEIDING",
    },
    select: {
      id: true,
      title: true,
      plannedAt: true,
      ownerId: true,
      initiatorId: true,
      sentForApprovalById: true,
      representative: { select: { firstName: true, lastName: true } },
    },
  });
  const coachingsById = new Map(coachings.map((coaching) => [coaching.id, coaching]));

  for (const approval of confirmedApprovals) {
    const coaching = coachingsById.get(approval.interventionId);
    if (!coaching) continue;

    const eventKey = buildCoachingApprovalConfirmedEventKey(coaching.id, approval.id);
    const entityTitle = buildCoachingApprovalConfirmedEntityTitle({
      id: coaching.id,
      title: coaching.title,
      ownerId: coaching.ownerId,
      initiatorId: coaching.initiatorId,
      sentForApprovalById: coaching.sentForApprovalById ?? undefined,
      plannedDate: coaching.plannedAt?.toISOString().slice(0, 10),
      representativeName: `${coaching.representative.firstName} ${coaching.representative.lastName}`.trim(),
    });
    const recipientUserIds = resolveCoachingApprovalConfirmedRecipients({
      id: coaching.id,
      title: coaching.title,
      ownerId: coaching.ownerId,
      initiatorId: coaching.initiatorId,
      sentForApprovalById: coaching.sentForApprovalById ?? undefined,
      plannedDate: coaching.plannedAt?.toISOString().slice(0, 10),
    }, actorId);

    for (const recipientUserId of recipientUserIds) {
      await createInAppNotification(prisma, {
        type: coachingApprovalConfirmedNotificationType,
        recipientUserId,
        entityId: coaching.id,
        eventKey,
        triggeredByUserId: actorId,
        sourceModule: "BEGELEIDINGEN",
      });
      await sendWorkflowMailSafely({
        type: coachingApprovalConfirmedNotificationType,
        recipientUserId,
        triggeredByUserId: actorId,
        entityTitle,
        linkUrl: `/begeleidingen/${coaching.id}`,
        context: {
          sourceModule: "BEGELEIDINGEN",
          entityType: "Intervention",
          entityId: coaching.id,
          eventKey,
          reason: "Begeleiding voor akkoord bevestigd",
          sentAt: approval.confirmedAt ? new Date(approval.confirmedAt) : new Date(),
        },
      });
    }
  }
}

async function sendWorkflowMailSafely(input: Parameters<typeof sendWorkflowEventMail>[0]) {
  try {
    await sendWorkflowEventMail(input);
  } catch (error) {
    console.error("[mail] Workflowmail kon niet worden verzonden.", error);
  }
}

async function validatePeerCoachingScope(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  interventions: NonNullable<WorkflowPersistencePatch["interventions"]>
) {
  const peerCandidates = interventions.filter((item) => item.peerCoach || item.ownerId !== actor.id);
  if (!peerCandidates.length) return false;
  const ownerIds = [...new Set(peerCandidates.map((item) => item.ownerId).filter(Boolean))];
  const representativeIds = [...new Set(peerCandidates.map((item) => item.representativeId).filter(Boolean))];
  const [owners, targets] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ownerIds }, active: true },
      select: { id: true, role: true, representativeLevel: true, active: true, country: true, teamId: true },
    }),
    prisma.user.findMany({
      where: {
        active: true,
        role: "REPRESENTATIVE",
        OR: [{ id: { in: representativeIds } }, { representativeId: { in: representativeIds } }],
      },
      select: { id: true, representativeId: true, role: true, representativeLevel: true, active: true, country: true, teamId: true },
    }),
  ]);
  const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
  const targetsById = new Map(targets.flatMap((target) => [[target.id, target], ...(target.representativeId ? [[target.representativeId, target] as const] : [])]));

  for (const item of peerCandidates) {
    const executor = ownersById.get(item.ownerId);
    const target = targetsById.get(item.representativeId);
    if (!executor || !target || !canExecutePeerCoaching(executor)) return false;
    const deviation = assertCanPlanPeerCoaching({
      actor,
      executor,
      target,
      deviationReason: item.deviationReason,
    });
    item.peerCoach = true;
    item.teamDeviation = deviation.teamDeviation;
    item.countryDeviation = deviation.countryDeviation;
    item.deviationRecordedById = deviation.requiresReason ? actor.id : undefined;
    item.deviationRecordedAt = deviation.requiresReason ? new Date().toISOString() : undefined;
  }
  return true;
}

async function requireExistingCoachingsMutable(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  incoming: NonNullable<WorkflowPersistencePatch["interventions"]>
) {
  const interventionIds = incoming.map((item) => item.id);
  const ids = [...new Set(interventionIds)];
  const existing = await prisma.intervention.findMany({
    where: { id: { in: ids }, type: "BEGELEIDING" },
    select: {
      id: true, status: true, representativeId: true, initiatorId: true, ownerId: true, teamId: true, country: true, plannedAt: true,
      representative: { select: { representativeId: true, role: true } },
      startTime: true, endTime: true, notifyRepresentative: true,
      scores: { select: { id: true, score: true, comment: true } },
      coachingDetail: { select: { id: true, arrivalTime: true, departureTime: true, kilometers: true, area: true, sector: true, groupAttentionPoints: true, individualAttentionPoint: true, appointments: { select: { id: true, remarks: true, scoreRows: { select: { score: true, comment: true } } } } } },
    },
    distinct: ["id"],
  });
  if (existing.length === 0) return;
  for (const stored of existing) {
    const next = incoming.find((item) => item.id === stored.id)!;
    if (!canManageStoredCoaching(actor, stored)) {
      forbidden("Je mag deze begeleiding niet beheren.");
    }
    if (["VOLTOOID", "GEFINALISEERD", "GESLOTEN", "AFGESLOTEN", "VERZONDEN_TER_AKKOORD", "AKKOORD_DOOR_VERTEGENWOORDIGER"].includes(stored.status)) {
      forbidden("Een uitgevoerde begeleiding is volledig read-only.");
    }
    let groupAttentionFilled = false;
    try { groupAttentionFilled = JSON.parse(stored.coachingDetail?.groupAttentionPoints ?? "[]").some((value: unknown) => typeof value === "string" && value.trim()); } catch { groupAttentionFilled = false; }
    const hasData = stored.scores.some((score) => score.score !== null || score.comment?.trim()) || Boolean(stored.coachingDetail && (
      stored.coachingDetail.arrivalTime || stored.coachingDetail.departureTime || stored.coachingDetail.kilometers ||
      stored.coachingDetail.area || stored.coachingDetail.sector || stored.coachingDetail.individualAttentionPoint ||
      groupAttentionFilled || stored.coachingDetail.appointments.some((appointment) =>
        appointment.remarks.trim() || appointment.scoreRows.some((score) => score.score !== null || score.comment.trim())
      )
    ));
    const storedParticipantId = stored.representative.representativeId ?? stored.representativeId;
    const planningChanged = storedParticipantId !== next.representativeId ||
      stored.plannedAt?.toISOString().slice(0, 10) !== next.plannedDate ||
      stored.startTime !== next.startTime || stored.endTime !== next.endTime ||
      stored.notifyRepresentative !== Boolean(next.notifyRepresentative);
    if ((next.status === "geannuleerd" || planningChanged) && (stored.status !== "GEPLAND" || hasData)) {
      forbidden("Alleen een lege, geplande begeleiding kan gewijzigd of verwijderd worden.");
    }
    if (["voltooid", "gefinaliseerd", "gesloten"].includes(next.status) && next.actionPoints.filter((item) => item.isNew && item.title.trim()).length < 1) {
      forbidden("Voeg minstens één nieuw actiepunt toe voordat je de begeleiding afsluit.");
    }
    if (["voltooid", "gefinaliseerd", "gesloten"].includes(next.status) && next.actionPoints.some((item) => item.isNew && (!item.title.trim() || !item.tipsAndTricks?.trim() || !item.priority))) {
      forbidden("Titel, prioriteit en Tips & Tricks zijn verplicht voor nieuwe actiepunten.");
    }
  }

  const visible = await prisma.intervention.findMany({
    where: buildVisibleCoachingWhere(actor, { id: { in: existing.map((item) => item.id) } }),
    select: { id: true },
    distinct: ["id"],
  });
  if (visible.length !== existing.length) {
    forbidden("Deze begeleiding bestaat niet binnen je toegestane zichtbaarheid.");
  }
}

async function writeCoachingChangeLogs(
  actorId: string,
  interventions: NonNullable<WorkflowPersistencePatch["interventions"]>,
  before: Map<string, Record<string, unknown>>
) {
  const tracked = ["status", "representativeId", "ownerId", "plannedDate", "startTime", "endTime", "notifyRepresentative", "deletedAt"] as const;
  const rows = interventions.flatMap((item) => {
    const old = before.get(item.id) ?? {};
    return tracked.flatMap((field) => {
      const newValue = item[field as keyof typeof item];
      const oldKey = field === "plannedDate" ? "plannedAt" : field;
      const oldValue = old[oldKey];
      const normalizedOld = typeof oldValue === "string" && field === "plannedDate" ? oldValue.slice(0, 10) : oldValue;
      return JSON.stringify(normalizedOld ?? null) === JSON.stringify(newValue ?? null) ? [] : [{
        interventionId: item.id,
        userId: actorId,
        field,
        oldValue: normalizedOld === undefined ? null : JSON.stringify(normalizedOld),
        newValue: newValue === undefined ? null : JSON.stringify(newValue),
      }];
    });
  });
  if (rows.length) await prisma.coachingChangeLog.createMany({ data: rows });
}

async function loadCoachingSnapshots(ids: string[]) {
  if (!ids.length) return new Map<string, Record<string, unknown>>();
  const rows = await prisma.intervention.findMany({
    where: { id: { in: [...new Set(ids)] }, type: "BEGELEIDING" },
    select: {
      id: true,
      status: true,
      plannedAt: true,
      startTime: true,
      endTime: true,
      notifyRepresentative: true,
      deletedAt: true,
      representativeId: true,
      representative: { select: { representativeId: true } },
      ownerId: true,
      outlookEventId: true,
      updatedAt: true,
      scores: { select: { category: true, label: true, score: true, comment: true } },
      actionPoints: { select: { id: true, title: true, status: true, description: true } },
      coachingDetail: {
        select: {
          appointments: {
            where: { deletedAt: null },
            select: { id: true, remarks: true, scoreRows: { select: { criterion: true, score: true, comment: true } } },
          },
        },
      },
    },
  });
  return new Map(rows.map((item) => [item.id, {
    status: item.status,
    plannedAt: item.plannedAt?.toISOString(),
    startTime: item.startTime,
    endTime: item.endTime,
    notifyRepresentative: item.notifyRepresentative,
    deletedAt: item.deletedAt?.toISOString(),
    representativeId: item.representative.representativeId ?? item.representativeId,
    ownerId: item.ownerId,
    outlookEventId: item.outlookEventId,
    updatedAt: item.updatedAt.toISOString(),
    scores: Object.fromEntries(item.scores.map((score) => [
      `${score.category ?? ""}::${score.label ?? ""}`,
      { score: score.score, comment: score.comment ?? "" },
    ])),
    actionPoints: Object.fromEntries(item.actionPoints.map((action) => [action.id, {
      title: action.title,
      status: action.status,
      description: action.description,
    }])),
    appointmentScores: Object.fromEntries((item.coachingDetail?.appointments ?? []).flatMap((appointment) =>
      appointment.scoreRows.map((score) => [
        `${appointment.id}::${score.criterion}`,
        { score: score.score, comment: score.comment },
      ])
    )),
    appointmentRemarks: Object.fromEntries((item.coachingDetail?.appointments ?? []).map((appointment) => [appointment.id, appointment.remarks])),
  }]));
}

function requireWorkflowPermission(
  routeName: string,
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>
) {
  if (routeName === "coaching") {
    if (!canCreateCoachingIntervention(actor)) forbidden("Je mag geen begeleidingen aanmaken of uitvoeren.");
    return;
  }
  if (routeName === "contact-moments") {
    if (!canCreateIntervention(actor)) forbidden("Je mag geen interventies aanmaken of uitvoeren.");
    return;
  }
  if (routeName === "help-requests") {
    if (!canCreateHelpWorkflow(actor)) requirePermission(actor, "help-request:create");
    return;
  }
  if (["retrainings", "sales-trainings"].includes(routeName)) {
    requireRole(actor, [
      "REPRESENTATIVE",
      "SALES_LEADER",
      "SALES_MANAGER",
      "COUNTRY_MANAGER",
      "GROUP_MANAGER",
      "SUPER_ADMIN",
    ]);
    return;
  }
  if (["reflections", "approvals"].includes(routeName)) {
    requireRole(actor, ["REPRESENTATIVE", "SUPER_ADMIN"]);
  }
}

function canCreateHelpWorkflow(actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>) {
  return ["REPRESENTATIVE", "SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "ADMIN", "GROUP_MANAGER", "SUPER_ADMIN"].includes(actor.role);
}

function representativeIdsFromPatch(patch: WorkflowPersistencePatch) {
  return [
    ...(patch.interventions ?? []).map((item) => item.representativeId),
    ...(patch.contactMoments ?? []).map((item) => item.representativeId),
    ...(patch.helpRequests ?? []).map((item) => item.representativeId),
    ...(patch.retrainings ?? []).map((item) => item.representativeId),
    ...(patch.salesTrainings ?? []).flatMap((item) => item.participantIds),
    ...(patch.reflections ?? []).map((item) => item.representativeId),
    ...(patch.approvals ?? []).map((item) => item.representativeId),
  ];
}

function actorIdFromPatch(patch: WorkflowPersistencePatch) {
  return patch.interventions?.[0]?.initiatorId ??
    patch.interventions?.[0]?.ownerId ??
    patch.contactMoments?.[0]?.ownerId ??
    patch.helpRequests?.[0]?.firstHandledByUserId ??
    patch.helpRequests?.[0]?.answers?.at(-1)?.authorId ??
    patch.helpRequests?.[0]?.withdrawnByUserId ??
    patch.helpRequests?.[0]?.requesterId ??
    patch.retrainings?.[0]?.initiatorId ??
    patch.salesTrainings?.[0]?.initiatorId ??
    patch.reflections?.[0]?.representativeId ??
    patch.approvals?.[0]?.representativeId;
}

async function applyAuthenticatedActor(patch: WorkflowPersistencePatch, actorId: string): Promise<WorkflowPersistencePatch> {
  const coachingIds = patch.interventions?.map((item) => item.id) ?? [];
  const existingCoachings = coachingIds.length
    ? await prisma.intervention.findMany({
        where: { id: { in: coachingIds }, type: "BEGELEIDING" },
        select: { id: true, initiatorId: true, ownerId: true },
      })
    : [];
  const existingById = new Map(existingCoachings.map((item) => [item.id, item]));
  const contactIds = patch.contactMoments?.map((item) => item.id) ?? [];
  const existingContacts = contactIds.length
    ? await prisma.intervention.findMany({
        where: { id: { in: contactIds }, type: "CONTACTMOMENT" },
        select: { id: true, initiatorId: true, ownerId: true },
      })
    : [];
  const existingContactById = new Map(existingContacts.map((item) => [item.id, item]));
  const helpIds = patch.helpRequests?.map((item) => item.id) ?? [];
  const existingHelpRequests = helpIds.length
    ? await prisma.helpRequest.findMany({
        where: { id: { in: helpIds } },
        select: { id: true, requesterId: true },
      })
    : [];
  const existingHelpById = new Map(existingHelpRequests.map((item) => [item.id, item]));
  return {
    ...patch,
    interventions: patch.interventions?.map((item) => {
      const existing = existingById.get(item.id);
      return {
        ...item,
        initiatorId: existing?.initiatorId ?? actorId,
        ownerId: item.ownerId || existing?.ownerId || actorId,
      };
    }),
    contactMoments: patch.contactMoments?.map((item) => {
      const existing = existingContactById.get(item.id);
      return {
        ...item,
        initiatorId: existing?.initiatorId ?? actorId,
        ownerId: item.ownerId || existing?.ownerId || actorId,
      };
    }),
    helpRequests: patch.helpRequests?.map((item) => {
      const existing = existingHelpById.get(item.id);
      return {
        ...item,
        requesterId: existing?.requesterId ?? actorId,
      };
    }),
    retrainings: patch.retrainings?.map((item) => ({ ...item, initiatorId: actorId })),
    salesTrainings: patch.salesTrainings?.map((item) => ({ ...item, initiatorId: actorId })),
  };
}

async function requireExistingContactMomentsMutable(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  incoming: NonNullable<WorkflowPersistencePatch["contactMoments"]>
) {
  const ids = [...new Set(incoming.map((item) => item.id).filter(Boolean))];
  const existing = await prisma.intervention.findMany({
    where: { id: { in: ids }, type: "CONTACTMOMENT" },
    select: {
      id: true,
      status: true,
      representativeId: true,
      initiatorId: true,
      ownerId: true,
      teamId: true,
      country: true,
      notifyRepresentative: true,
      representative: { select: { representativeId: true, role: true } },
      contactMoment: {
        select: {
          reportHtml: true,
          conclusion: true,
          finalSnapshot: true,
          sharedAt: true,
        },
      },
    },
    distinct: ["id"],
  });

  const existingById = new Map(existing.map((item) => [item.id, item]));
  const newRepresentativeIds = incoming
    .filter((item) => !existingById.has(item.id))
    .map((item) => item.representativeId);
  if (newRepresentativeIds.length) {
    const activeRepresentatives = await prisma.user.findMany({
      where: {
        active: true,
        role: "REPRESENTATIVE",
        OR: [
          { id: { in: newRepresentativeIds } },
          { representativeId: { in: newRepresentativeIds } },
        ],
      },
      select: { id: true, representativeId: true },
    });
    const activeIds = new Set(activeRepresentatives.flatMap((item) => [item.id, item.representativeId].filter(Boolean)));
    if (!newRepresentativeIds.every((id) => activeIds.has(id))) {
      forbidden("Inactieve gebruikers kunnen niet geselecteerd worden voor nieuwe contactmomenten.");
    }
  }
  for (const next of incoming) {
    const stored = existingById.get(next.id);
    if (next.status === "afgesloten" && isBlankRichText(next.reportHtml ?? next.conclusion)) {
      forbidden("Een verslag is verplicht voordat het contactmoment gedeeld kan worden.");
    }
    if ((next.status === "geannuleerd" || next.status === "niet_uitgevoerd") && !next.closedReason?.trim()) {
      forbidden("Geef een reden op voor annuleren of niet uitvoeren.");
    }
    if ((next.startTime || next.endTime) && (!next.startTime || !next.endTime || next.endTime <= next.startTime)) {
      forbidden("Het einduur moet later zijn dan het beginuur.");
    }
    if (!stored) continue;
    if (!isAllowedContactMomentStatusTransition(stored.status, next.status)) {
      forbidden("Deze statusovergang is niet toegestaan voor een contactmoment.");
    }
    if (!canManageStoredContactMoment(actor, stored)) {
      forbidden("Je mag dit contactmoment niet beheren.");
    }
    if (["AFGESLOTEN", "GEANNULEERD", "NIET_UITGEVOERD"].includes(stored.status)) {
      const idempotentFinalSave = stored.status === next.status.toUpperCase() &&
        stored.contactMoment?.finalSnapshot &&
        JSON.stringify({
          representativeId: stored.representative.representativeId ?? stored.representativeId,
          status: stored.status,
          report: stored.contactMoment.reportHtml ?? stored.contactMoment.conclusion ?? "",
        }) === JSON.stringify({
          representativeId: next.representativeId,
          status: next.status.toUpperCase(),
          report: next.reportHtml ?? next.conclusion ?? "",
        });
      if (!idempotentFinalSave) forbidden("Een definitief contactmoment is volledig read-only.");
    }
  }
}

async function requireHelpRequestsMutable(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  incoming: NonNullable<WorkflowPersistencePatch["helpRequests"]>
) {
  const ids = [...new Set(incoming.map((item) => item.id).filter(Boolean))];
  const existing = ids.length
    ? await prisma.helpRequest.findMany({
        where: { id: { in: ids } },
        include: { answers: { select: { id: true, authorId: true, closesRequest: true }, orderBy: { createdAt: "asc" } } },
      })
    : [];
  const existingById = new Map(existing.map((item) => [item.id, item]));

  for (const next of incoming) {
    const stored = existingById.get(next.id);
    const answerCount = next.answers?.length ?? 0;
    if (!stored) {
      if (actor.role !== "REPRESENTATIVE") forbidden("Alleen een vertegenwoordiger kan een eigen hulpaanvraag indienen.");
      if (![actor.id, actor.representativeId].includes(next.representativeId)) {
        forbidden("Een vertegenwoordiger kan alleen voor zichzelf een hulpaanvraag indienen.");
      }
      if (!next.subject.trim() || isBlankRichText(next.descriptionHtml ?? next.explanation ?? next.difficulty)) {
        forbidden("Onderwerp en omschrijving zijn verplicht.");
      }
      if (!["open", "nieuw"].includes(next.status)) forbidden("Nieuwe hulpaanvragen starten altijd als open.");
      continue;
    }

    const storedRequesterMatchesActor = stored.requesterId === actor.id;
    const storedIsUntreated = ["NIEUW", "OPEN"].includes(stored.status) &&
      !stored.firstHandledAt &&
      stored.answers.length === 0 &&
      !stored.linkedInterventionId &&
      !stored.followUpType;
    const requestChanged = stored.subject !== next.subject ||
      (stored.descriptionHtml ?? stored.explanation ?? stored.difficulty ?? "") !== (next.descriptionHtml ?? next.explanation ?? next.difficulty ?? "");

    const nextAnswer = next.answers?.at(-1);
    const addsOneAnswer = answerCount === stored.answers.length + 1;
    const lastStoredAnswer = stored.answers.at(-1);
    const representativeRespondsToManager = actor.role === "REPRESENTATIVE" &&
      storedRequesterMatchesActor &&
      addsOneAnswer &&
      nextAnswer?.authorId === actor.id &&
      !nextAnswer.closesRequest &&
      !lastStoredAnswer?.closesRequest &&
      lastStoredAnswer &&
      lastStoredAnswer.authorId !== actor.id &&
      next.status === "in_behandeling" &&
      !next.followUpType &&
      !next.linkedInterventionId;

    if (actor.role === "REPRESENTATIVE") {
      if (!storedRequesterMatchesActor) forbidden("Je mag alleen je eigen hulpaanvragen beheren.");
      if (representativeRespondsToManager) {
        if (requestChanged) forbidden("De oorspronkelijke hulpaanvraag kan tijdens een respons niet gewijzigd worden.");
        if (isBlankRichText(nextAnswer?.bodyHtml)) forbidden("Een inhoudelijk antwoord is verplicht.");
        continue;
      }
      if (!storedIsUntreated) forbidden("Deze hulpaanvraag werd ondertussen behandeld en kan niet meer worden aangepast of ingetrokken.");
      if (next.status === "ingetrokken") continue;
      if (!["open", "nieuw"].includes(next.status)) forbidden("Een vertegenwoordiger mag de behandelingsstatus niet wijzigen.");
      if (!next.subject.trim() || isBlankRichText(next.descriptionHtml ?? next.explanation ?? next.difficulty)) {
        forbidden("Onderwerp en omschrijving zijn verplicht.");
      }
      continue;
    }

    if (requestChanged) forbidden("Een manager mag de oorspronkelijke hulpaanvraag niet wijzigen.");
    if (["GESLOTEN", "AFGESLOTEN", "INGETROKKEN", "GEANNULEERD", "BEGELEIDING", "CONTACTMOMENT", "RETRAINING", "SALESTRAINING"].includes(stored.status)) {
      forbidden("Deze hulpaanvraag kan niet meer behandeld worden.");
    }
    if (next.status === "gesloten" && !(next.answers ?? []).some((answer) => answer.closesRequest)) {
      forbidden("Sluiten kan alleen samen met een inhoudelijk antwoord.");
    }
    if (answerCount > stored.answers.length && next.answers?.at(-1)?.authorId !== actor.id) {
      forbidden("Een antwoord moet door de ingelogde gebruiker worden verstuurd.");
    }
    if (answerCount > stored.answers.length && isBlankRichText(next.answers?.at(-1)?.bodyHtml)) {
      forbidden("Een inhoudelijk antwoord is verplicht.");
    }
    if (next.linkedInterventionId && !["begeleiding", "contactmoment", "retraining", "sales_training"].includes(next.followUpType ?? "")) {
      forbidden("Een gekoppelde vervolgactie vereist een geldig type.");
    }
  }
}

async function requireHelpRequestCoachingFollowUps(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  patch: WorkflowPersistencePatch
) {
  const coachings = patch.interventions ?? [];
  const helpRequests = patch.helpRequests ?? [];
  const coachingLinks = helpRequests.filter((item) =>
    item.followUpType === "begeleiding" || item.status === "begeleiding"
  );

  if (!coachings.length && !coachingLinks.length) return;
  if (!coachings.length || coachings.length !== coachingLinks.length) {
    forbidden("Een begeleiding vanuit een hulpaanvraag moet via de planningswizard worden bevestigd.");
  }

  const coachingsById = new Map(coachings.map((item) => [item.id, item]));
  const linkedIds = new Set<string>();
  for (const request of coachingLinks) {
    if (!request.linkedInterventionId) {
      forbidden("Een gekoppelde begeleiding vereist een echte begeleiding.");
    }
    if (linkedIds.has(request.linkedInterventionId) || !coachingsById.has(request.linkedInterventionId)) {
      forbidden("De gekoppelde begeleiding hoort niet bij deze hulpaanvraag.");
    }
    linkedIds.add(request.linkedInterventionId);
  }
  if (coachings.some((item) => !linkedIds.has(item.id))) {
    forbidden("De help-request route mag alleen de gekoppelde begeleiding bewaren.");
  }

  const existingCoachings = await prisma.intervention.findMany({
    where: { id: { in: coachings.map((item) => item.id) } },
    select: { id: true },
  });
  if (existingCoachings.length) {
    forbidden("De gekoppelde begeleiding bestaat al.");
  }

  const storedRequests = await prisma.helpRequest.findMany({
    where: { id: { in: coachingLinks.map((item) => item.id) } },
    include: {
      representative: { select: { id: true, representativeId: true, country: true, teamId: true } },
    },
  });
  const storedById = new Map(storedRequests.map((item) => [item.id, item]));

  for (const request of coachingLinks) {
    const stored = storedById.get(request.id);
    if (!stored) forbidden("Hulpaanvraag niet gevonden.");
    if (!["OPEN", "NIEUW", "IN_BEHANDELING"].includes(stored.status)) {
      forbidden("Deze hulpaanvraag kan niet meer behandeld worden.");
    }
    if (stored.linkedInterventionId || stored.followUpType) {
      forbidden("Deze hulpaanvraag heeft al een vervolgactie.");
    }
    if (request.status !== "begeleiding" || request.followUpType !== "begeleiding") {
      forbidden("De hulpaanvraag moet als begeleiding worden gekoppeld.");
    }
    if (request.firstHandledByUserId && request.firstHandledByUserId !== actor.id) {
      forbidden("De behandelaar van de hulpaanvraag moet de aangemelde gebruiker zijn.");
    }

    const coaching = coachingsById.get(request.linkedInterventionId!);
    if (!coaching) forbidden("De gekoppelde begeleiding hoort niet bij deze hulpaanvraag.");
    const representativeId = stored.representative.representativeId ?? stored.representativeId;
    if (request.representativeId !== representativeId || coaching.representativeId !== representativeId) {
      forbidden("De begeleiding moet gekoppeld blijven aan de vertegenwoordiger van de hulpaanvraag.");
    }
    if (coaching.initiatorId !== actor.id) {
      forbidden("De planner van de begeleiding moet de aangemelde gebruiker zijn.");
    }
    if (coaching.status !== "gepland") {
      forbidden("Een hulpaanvraag kan alleen een geplande begeleiding aanmaken.");
    }
    if (!coaching.ownerId) {
      forbidden("Kies een begeleider voor de begeleiding.");
    }
    if (!coaching.plannedDate || Number.isNaN(new Date(`${coaching.plannedDate}T12:00:00`).getTime())) {
      forbidden("Kies een geldige datum voor de begeleiding.");
    }
    if (!coaching.startTime || !coaching.endTime || coaching.endTime <= coaching.startTime) {
      forbidden("Kies een geldig begin- en einduur voor de begeleiding.");
    }
    if (!coaching.focusNames.length) {
      forbidden("Selecteer minstens een focusfase voor de begeleiding.");
    }
  }
}

function isAllowedContactMomentStatusTransition(previous: string, next: string) {
  const allowed: Record<string, string[]> = {
    CONCEPT: ["concept", "gepland", "wacht_op_vt_input", "geannuleerd", "niet_uitgevoerd"],
    WACHT_OP_VT_INPUT: ["wacht_op_vt_input", "gepland", "geannuleerd", "niet_uitgevoerd"],
    GEPLAND: ["gepland", "in_uitvoering", "afgesloten", "geannuleerd", "niet_uitgevoerd"],
    IN_UITVOERING: ["in_uitvoering", "afgesloten", "geannuleerd", "niet_uitgevoerd"],
    AFGESLOTEN: ["afgesloten"],
    GEANNULEERD: ["geannuleerd"],
    NIET_UITGEVOERD: ["niet_uitgevoerd"],
  };
  return (allowed[previous] ?? []).includes(next);
}

function canManageStoredContactMoment(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  contactMoment: {
    representativeId: string;
    initiatorId: string;
    ownerId: string;
    teamId: string | null;
    country: string;
    representative: { representativeId: string | null; role: string };
  }
) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return true;
  if (actor.role === "SALES_MANAGER" || actor.role === "COUNTRY_MANAGER" || actor.role === "ADMIN") {
    return actorCanAccessCountry(actor, contactMoment.country);
  }
  if (actor.role === "SALES_LEADER") {
    return contactMoment.ownerId === actor.id ||
      contactMoment.initiatorId === actor.id ||
      Boolean(actor.teamId && contactMoment.teamId === actor.teamId);
  }
  return false;
}

function auditEntriesFromWorkflowPatch(
  routeName: string,
  patch: WorkflowPersistencePatch,
  authenticatedActorId: string,
  coachingBefore = new Map<string, Record<string, unknown>>()
) {
  const baseEntries = [
    ...(patch.interventions ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "Intervention",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      oldValue: coachingBefore.get(item.id),
      newValue: {
        status: item.status,
        representativeId: item.representativeId,
        plannedDate: item.plannedDate,
        startTime: item.startTime,
        endTime: item.endTime,
        notifyRepresentative: item.notifyRepresentative,
      },
    })),
    ...(patch.contactMoments ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "Intervention",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      newValue: { status: item.status, representativeId: item.representativeId },
    })),
    ...(patch.helpRequests ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "HelpRequest",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      newValue: { status: item.status, representativeId: item.representativeId },
    })),
    ...(patch.retrainings ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "Intervention",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      newValue: { status: item.status, representativeId: item.representativeId },
    })),
    ...(patch.salesTrainings ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "Intervention",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      newValue: { status: item.status, participantCount: item.participantIds.length },
    })),
    ...(patch.reflections ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "Reflection",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      newValue: { status: item.status, interventionId: item.interventionId },
    })),
    ...(patch.approvals ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "Approval",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      newValue: { status: item.status, interventionId: item.interventionId },
    })),
  ];
  const coachingDetails = (patch.interventions ?? []).flatMap((item) => {
    const before = coachingBefore.get(item.id);
    if (!before) return [];
    const entries: { actorId: string; entityType: string; entityId: string; action: string; oldValue?: unknown; newValue?: unknown }[] = [];
    const oldScores = asAuditMap(before.scores);
    const newScores: Record<string, { score: number | null; comment: string }> = Object.fromEntries([
      ...item.scores.map((score) => [`${score.focus}::${score.criterion}`, { score: score.value === "NVT" ? null : score.value, comment: score.description ?? "" }] as const),
      ...(item.dossier?.generalScores ?? []).map((score) => [`Dossier:Algemeen::${score.criterion}`, { score: score.score === "nvt" ? null : score.score, comment: score.comment }] as const),
      ...(item.dossier?.personalityScores ?? []).map((score) => [`Dossier:Persoonlijkheid::${score.criterion}`, { score: score.score === "nvt" ? null : score.score, comment: score.comment }] as const),
    ]);
    for (const [key, value] of Object.entries(newScores)) {
      const previous = asScoreSnapshot(oldScores[key]);
      if (previous.score !== value.score) {
        entries.push(detailAudit(authenticatedActorId, item.id, "coaching.score_changed", {
          label: key.split("::").at(-1),
          description: `Score gewijzigd voor ${key.split("::").at(-1)}: ${displayScore(previous.score)} → ${displayScore(value.score)}`,
        }));
      }
      if (value.comment.trim() && value.comment.trim() !== previous.comment.trim()) {
        entries.push(detailAudit(authenticatedActorId, item.id, "coaching.comment_added", {
          label: key.split("::").at(-1),
          description: `Opmerking toegevoegd bij ${key.split("::").at(-1)}: ${value.comment.trim()}`,
        }));
      }
    }

    const oldActions = asAuditMap(before.actionPoints);
    for (const action of item.actionPoints) {
      const previous = asActionSnapshot(oldActions[action.id]);
      if (!oldActions[action.id]) {
        entries.push(detailAudit(authenticatedActorId, item.id, "coaching.action_point_added", { description: action.title }));
      } else if (!["AFGEROND", "BEHAALD"].includes(previous.status) && ["afgerond", "behaald"].includes(action.status)) {
        entries.push(detailAudit(authenticatedActorId, item.id, "coaching.action_point_completed", { description: action.title }));
      }
    }

    const oldAppointmentScores = asAuditMap(before.appointmentScores);
    const oldAppointmentRemarks = asStringMap(before.appointmentRemarks);
    for (const appointment of item.appointments ?? []) {
      if (appointment.remarks.trim() && appointment.remarks.trim() !== (oldAppointmentRemarks[appointment.id] ?? "").trim()) {
        entries.push(detailAudit(authenticatedActorId, item.id, "coaching.comment_added", {
          description: `Opmerking toegevoegd bij ${appointment.customer}: ${appointment.remarks.trim()}`,
        }));
      }
      for (const score of appointment.scores) {
        const key = `${appointment.id}::${score.criterion}`;
        const previous = asScoreSnapshot(oldAppointmentScores[key]);
        const nextScore = score.score === "nvt" ? null : score.score;
        if (previous.score !== nextScore) {
          entries.push(detailAudit(authenticatedActorId, item.id, "coaching.score_changed", {
            description: `Afspraakscore gewijzigd voor ${score.criterion}: ${displayScore(previous.score)} → ${displayScore(nextScore)}`,
          }));
        }
        if (score.comment.trim() && score.comment.trim() !== previous.comment.trim()) {
          entries.push(detailAudit(authenticatedActorId, item.id, "coaching.comment_added", {
            description: `Opmerking toegevoegd bij ${score.criterion}: ${score.comment.trim()}`,
          }));
        }
      }
    }
    return entries;
  });
  return [...baseEntries, ...coachingDetails];
}

function detailAudit(actorId: string, interventionId: string, action: string, newValue: unknown) {
  return { actorId, entityType: "Intervention", entityId: interventionId, action, newValue };
}

function asAuditMap(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringMap(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(asAuditMap(value)).map(([key, entry]) => [key, typeof entry === "string" ? entry : ""]));
}

function asScoreSnapshot(value: unknown) {
  const item = asAuditMap(value);
  return { score: typeof item.score === "number" ? item.score : null, comment: typeof item.comment === "string" ? item.comment : "" };
}

function asActionSnapshot(value: unknown) {
  const item = asAuditMap(value);
  return { status: typeof item.status === "string" ? item.status : "", title: typeof item.title === "string" ? item.title : "" };
}

function displayScore(value: number | null) {
  return value === null ? "niet beoordeeld" : String(value);
}
