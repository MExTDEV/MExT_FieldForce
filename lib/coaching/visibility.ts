import type {
  CoachingIntervention,
  MockUser,
  WorkflowState,
} from "@/lib/types";

export const completedCoachingStatuses = new Set([
  "gesloten",
  "gefinaliseerd",
  "afgesloten",
  "voltooid",
  "verzonden_ter_akkoord",
  "akkoord_door_vertegenwoordiger",
]);

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const unique = new Map<string, T>();
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

export function canViewCoaching(
  currentUser: MockUser,
  intervention: CoachingIntervention
) {
  if (currentUser.role === "SUPER_ADMIN") return true;
  if (currentUser.role === "GROUP_MANAGER") return true;
  if (currentUser.role === "SALES_MANAGER") {
    return (currentUser.countryAccess ?? []).includes(intervention.country);
  }
  if (currentUser.role === "SALES_LEADER") {
    return intervention.initiatorId === currentUser.id ||
      intervention.ownerId === currentUser.id ||
      intervention.teamId === currentUser.teamId;
  }
  if (currentUser.role === "REPRESENTATIVE") {
    return [currentUser.id, currentUser.representativeId].includes(intervention.representativeId) &&
      ["verzonden_ter_akkoord", "akkoord_door_vertegenwoordiger"].includes(intervention.status);
  }
  return intervention.country === currentUser.country;
}

export function visibleCoachings(
  currentUser: MockUser,
  interventions: CoachingIntervention[]
) {
  return dedupeById(interventions).filter((intervention) =>
    canViewCoaching(currentUser, intervention)
  );
}

export function dedupeWorkflowState(state: WorkflowState): WorkflowState {
  return {
    interventions: dedupeById(state.interventions),
    reflections: dedupeById(state.reflections),
    approvals: dedupeById(state.approvals),
    contactMoments: dedupeById(state.contactMoments),
    helpRequests: dedupeById(state.helpRequests),
    linkedInterventions: dedupeById(state.linkedInterventions),
    retrainings: dedupeById(state.retrainings),
    salesTrainings: dedupeById(state.salesTrainings),
  };
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
