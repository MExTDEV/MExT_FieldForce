import {
  saveWorkflowPatchToDatabase,
  type WorkflowPersistencePatch,
} from "@/lib/server/workflows";
import { forbidden, handleApi } from "@/lib/server/api";
import { writeAuditLogs } from "@/lib/server/audit";
import { buildVisibleCoachingWhere } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import {
  requireAuthenticatedUser,
  requireCoachingParticipantScope,
  requireCoachingOwnerScope,
  requirePermission,
  requireRepresentativeScope,
  requireRole,
} from "@/lib/server/authenticated-user";
import {
  recordOutlookSyncFailure,
  requireMicrosoftAccessToken,
  syncCoachingsToOutlook,
  transferCoachingsBetweenOwners,
} from "@/lib/server/microsoft-graph";

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
    if (routeName === "coaching") {
      await requireCoachingParticipantScope(actor, selectedPatch.interventions?.map((item) => item.representativeId) ?? []);
      await requireCoachingOwnerScope(actor, selectedPatch.interventions?.map((item) => item.ownerId) ?? []);
    } else {
      await requireRepresentativeScope(actor, representativeIdsFromPatch(selectedPatch));
    }
    if (selectedPatch.interventions?.length) {
      await requireExistingCoachingsMutable(actor, selectedPatch.interventions);
    }
    const coachingBefore = routeName === "coaching"
      ? await loadCoachingSnapshots(selectedPatch.interventions?.map((item) => item.id) ?? [])
      : new Map<string, Record<string, unknown>>();
    const patch = await applyAuthenticatedActor(selectedPatch, actor.id);
    await saveWorkflowPatchToDatabase(patch);
    if (routeName === "coaching") {
      await writeCoachingChangeLogs(actor.id, patch.interventions ?? [], coachingBefore);
    }
    await writeAuditLogs(auditEntriesFromWorkflowPatch(routeName, patch, actor.id, coachingBefore));
    let outlookSync = undefined;
    if (routeName === "coaching" && patch.interventions?.length) {
      try {
        const accessToken = await requireMicrosoftAccessToken(request);
        await transferCoachingsBetweenOwners(accessToken, actor.id, patch.interventions.flatMap((item) => {
          const old = coachingBefore.get(item.id);
          const oldOwnerId = typeof old?.ownerId === "string" ? old.ownerId : item.ownerId;
          return oldOwnerId !== item.ownerId ? [{ interventionId: item.id, oldOwnerId, newOwnerId: item.ownerId, outlookEventId: typeof old?.outlookEventId === "string" ? old.outlookEventId : undefined }] : [];
        }));
        outlookSync = await syncCoachingsToOutlook(accessToken, actor.id, patch.interventions);
      } catch (error) {
        console.error("[outlook-sync] Fieldforce-opslag is behouden.", error);
        outlookSync = await recordOutlookSyncFailure(actor.id, patch.interventions, error);
      }
    }
    return { ok: true, outlookSync };
  }, "Workflowgegevens konden niet worden opgeslagen.");
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
      id: true, status: true, representativeId: true, ownerId: true, plannedAt: true,
      representative: { select: { representativeId: true } },
      startTime: true, endTime: true, notifyRepresentative: true,
      scores: { select: { id: true, score: true, comment: true } },
      coachingDetail: { select: { id: true, arrivalTime: true, departureTime: true, kilometers: true, area: true, sector: true, groupAttentionPoints: true, individualAttentionPoint: true, appointments: { select: { id: true, remarks: true, scoreRows: { select: { score: true, comment: true } } } } } },
    },
    distinct: ["id"],
  });
  if (existing.length === 0) return;
  for (const stored of existing) {
    const next = incoming.find((item) => item.id === stored.id)!;
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
  if (["coaching", "contact-moments"].includes(routeName)) {
    requirePermission(actor, "intervention:create");
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
  return ["SALES_LEADER", "ADMIN", "SUPER_ADMIN"].includes(actor.role);
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
  return patch.interventions?.[0]?.ownerId ??
    patch.contactMoments?.[0]?.ownerId ??
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
    contactMoments: patch.contactMoments?.map((item) => ({ ...item, initiatorId: actorId, ownerId: actorId })),
    helpRequests: patch.helpRequests?.map((item) => ({ ...item, requesterId: actorId })),
    retrainings: patch.retrainings?.map((item) => ({ ...item, initiatorId: actorId })),
    salesTrainings: patch.salesTrainings?.map((item) => ({ ...item, initiatorId: actorId })),
  };
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
