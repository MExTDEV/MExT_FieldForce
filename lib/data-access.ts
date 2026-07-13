import type {
  MockUser,
  Representative,
  SalesTraining,
  WorkflowState,
} from "@/lib/types";
import {
  dedupeWorkflowState,
  visibleContactMoments,
  visibleCoachings,
} from "@/lib/coaching/visibility";

export type VisibleUserScope = {
  representativeIds: Set<string>;
  teamIds: Set<string>;
  countries: Set<string>;
  isGlobal: boolean;
};

export function scopedCountries(currentUser: MockUser): Set<string> | undefined {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) return undefined;
  if (currentUser.role === "SALES_MANAGER") return new Set(currentUser.countryAccess ?? []);
  return new Set([currentUser.country]);
}

export function canAccessCountryScope(currentUser: MockUser, country: string) {
  const countries = scopedCountries(currentUser);
  return countries === undefined || countries.has(country);
}

export function getVisibleRepresentatives(
  currentUser: MockUser,
  source: Representative[]
) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) {
    return source;
  }
  if (currentUser.role === "SALES_MANAGER") {
    const countries = scopedCountries(currentUser) ?? new Set<string>();
    return source.filter((representative) => countries.has(representative.country));
  }
  if (currentUser.role === "REPRESENTATIVE") {
    const ownRepresentativeId = representativeIdForActor(currentUser);
    return source.filter(
      (representative) => representative.id === ownRepresentativeId
    );
  }
  if (currentUser.role === "SALES_LEADER") {
    const ownRepresentativeId = representativeIdForActor(currentUser);
    return source.filter(
      (representative) =>
        representative.teamId === currentUser.teamId ||
        (ownRepresentativeId ? representative.id === ownRepresentativeId : false)
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
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "GROUP_MANAGER",
  };
}

export function canAccessRepresentativeData(
  currentUser: MockUser,
  representative: Representative
) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(currentUser.role)) return true;
  if (currentUser.role === "SALES_MANAGER") return canAccessCountryScope(currentUser, representative.country);
  if (currentUser.role === "REPRESENTATIVE") {
    return representative.id === representativeIdForActor(currentUser);
  }
  if (currentUser.role === "SALES_LEADER") {
    const ownRepresentativeId = representativeIdForActor(currentUser);
    return representative.teamId === currentUser.teamId ||
      (ownRepresentativeId ? representative.id === ownRepresentativeId : false);
  }
  return representative.country === currentUser.country;
}

function representativeIdForActor(currentUser: MockUser) {
  if (currentUser.representativeId) return currentUser.representativeId;
  return currentUser.role === "REPRESENTATIVE" ? currentUser.id : undefined;
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
  const contactMoments = visibleContactMoments(currentUser, uniqueState.contactMoments).filter((item) =>
    scope.representativeIds.has(item.representativeId)
  );
  const visibleContactIds = new Set(contactMoments.map((item) => item.id));
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
    contactMoments,
    helpRequests: uniqueState.helpRequests
      .filter((item) => scope.representativeIds.has(item.representativeId))
      .map((item) => {
        if (
          currentUser.role === "REPRESENTATIVE" &&
          item.followUpType === "contactmoment" &&
          item.linkedInterventionId &&
          !visibleContactIds.has(item.linkedInterventionId)
        ) {
          return { ...item, status: "in_behandeling", followUpType: undefined, linkedInterventionId: undefined };
        }
        return item;
      }),
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
