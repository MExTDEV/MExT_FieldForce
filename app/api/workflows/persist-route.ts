import {
  saveWorkflowPatchToDatabase,
  type WorkflowPersistencePatch,
} from "@/lib/server/workflows";
import { handleApi } from "@/lib/server/api";
import { writeAuditLogs } from "@/lib/server/audit";
import {
  requireAuthenticatedUser,
  requirePermission,
  requireRepresentativeScope,
  requireRole,
} from "@/lib/server/authenticated-user";
import {
  recordOutlookSyncFailure,
  requireMicrosoftAccessToken,
  syncCoachingsToOutlook,
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
    await requireRepresentativeScope(actor, representativeIdsFromPatch(selectedPatch));
    const patch = applyAuthenticatedActor(selectedPatch, actor.id);
    await saveWorkflowPatchToDatabase(patch);
    await writeAuditLogs(auditEntriesFromWorkflowPatch(routeName, patch, actor.id));
    let outlookSync = undefined;
    if (routeName === "coaching" && patch.interventions?.length) {
      try {
        const accessToken = await requireMicrosoftAccessToken(request);
        outlookSync = await syncCoachingsToOutlook(accessToken, actor.id, patch.interventions);
      } catch (error) {
        console.error("[outlook-sync] Fieldforce-opslag is behouden.", error);
        outlookSync = await recordOutlookSyncFailure(actor.id, patch.interventions, error);
      }
    }
    return { ok: true, outlookSync };
  }, "Workflowgegevens konden niet worden opgeslagen.");
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

function applyAuthenticatedActor(patch: WorkflowPersistencePatch, actorId: string): WorkflowPersistencePatch {
  return {
    ...patch,
    interventions: patch.interventions?.map((item) => ({ ...item, initiatorId: actorId, ownerId: actorId })),
    contactMoments: patch.contactMoments?.map((item) => ({ ...item, initiatorId: actorId, ownerId: actorId })),
    helpRequests: patch.helpRequests?.map((item) => ({ ...item, requesterId: actorId })),
    retrainings: patch.retrainings?.map((item) => ({ ...item, initiatorId: actorId })),
    salesTrainings: patch.salesTrainings?.map((item) => ({ ...item, initiatorId: actorId })),
  };
}

function auditEntriesFromWorkflowPatch(
  routeName: string,
  patch: WorkflowPersistencePatch,
  authenticatedActorId: string
) {
  return [
    ...(patch.interventions ?? []).map((item) => ({
      actorId: authenticatedActorId,
      entityType: "Intervention",
      entityId: item.id,
      action: `workflow.${routeName}.save`,
      newValue: { status: item.status, representativeId: item.representativeId },
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
}
