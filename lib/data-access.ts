import type {
  MockUser,
  Representative,
  SalesTraining,
  WorkflowState,
} from "@/lib/types";
import {
  dedupeWorkflowState,
  visibleCoachings,
} from "@/lib/coaching/visibility";

export type VisibleUserScope = {
  representativeIds: Set<string>;
  teamIds: Set<string>;
  countries: Set<string>;
  isGlobal: boolean;
};

export function getVisibleRepresentatives(
  currentUser: MockUser,
  source: Representative[]
) {
  if (["ADMIN", "SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) {
    return source;
  }
  if (currentUser.role === "REPRESENTATIVE") {
    return source.filter(
      (representative) => representative.id === currentUser.representativeId
    );
  }
  if (currentUser.role === "SALES_LEADER") {
    return source.filter(
      (representative) =>
        representative.teamId === currentUser.teamId ||
        representative.id === currentUser.representativeId
    );
  }
  return source.filter(
    (representative) => representative.country === currentUser.country
  );
}

export function getVisibleUserScope(
  currentUser: MockUser,
  source: Representative[]
): VisibleUserScope {
  const visible = getVisibleRepresentatives(currentUser, source);
  return {
    representativeIds: new Set(visible.map((item) => item.id)),
    teamIds: new Set(visible.map((item) => item.teamId)),
    countries: new Set(visible.map((item) => item.country)),
    isGlobal:
      currentUser.role === "ADMIN" ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "GROUP_MANAGER",
  };
}

export function canAccessRepresentativeData(
  currentUser: MockUser,
  representative: Representative
) {
  if (["ADMIN", "SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) return true;
  if (currentUser.role === "REPRESENTATIVE") {
    return representative.id === currentUser.representativeId;
  }
  if (currentUser.role === "SALES_LEADER") {
    return representative.teamId === currentUser.teamId ||
      representative.id === currentUser.representativeId;
  }
  return representative.country === currentUser.country;
}

export function scopeSalesTraining(
  currentUser: MockUser,
  training: SalesTraining,
  representatives: Representative[]
): SalesTraining | undefined {
  const scope = getVisibleUserScope(currentUser, representatives);
  const participantIds = training.participantIds.filter((id) =>
    scope.representativeIds.has(id)
  );
  if (participantIds.length === 0) return undefined;
  return {
    ...training,
    participantIds,
    actionPoints: training.actionPoints.flatMap((action) => {
      const representativeIds = action.representativeIds.filter((id) =>
        scope.representativeIds.has(id)
      );
      return representativeIds.length ? [{ ...action, representativeIds }] : [];
    }),
  };
}

export function getVisibleWorkflowState(
  currentUser: MockUser,
  state: WorkflowState,
  representatives: Representative[]
): WorkflowState {
  const uniqueState = dedupeWorkflowState(state);
  const scope = getVisibleUserScope(currentUser, representatives);
  const interventions = visibleCoachings(currentUser, uniqueState.interventions);
  const visibleInterventionIds = new Set(
    interventions.map((item) => item.id)
  );
  return {
    interventions,
    reflections: uniqueState.reflections.filter(
      (item) =>
        scope.representativeIds.has(item.representativeId) &&
        visibleInterventionIds.has(item.interventionId)
    ),
    approvals: uniqueState.approvals.filter(
      (item) =>
        scope.representativeIds.has(item.representativeId) &&
        visibleInterventionIds.has(item.interventionId)
    ),
    contactMoments: uniqueState.contactMoments.filter((item) =>
      scope.representativeIds.has(item.representativeId)
    ),
    helpRequests: uniqueState.helpRequests.filter((item) =>
      scope.representativeIds.has(item.representativeId)
    ),
    linkedInterventions: uniqueState.linkedInterventions.filter((item) =>
      scope.representativeIds.has(item.representativeId)
    ),
    retrainings: uniqueState.retrainings.filter((item) =>
      scope.representativeIds.has(item.representativeId)
    ),
    salesTrainings: uniqueState.salesTrainings.flatMap((item) => {
      const scoped = scopeSalesTraining(currentUser, item, representatives);
      return scoped ? [scoped] : [];
    }),
  };
}
