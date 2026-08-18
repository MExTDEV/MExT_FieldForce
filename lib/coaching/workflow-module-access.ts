import type { AppModuleCode, AppModuleConfig, WorkflowState } from "@/lib/types";

export type WorkflowPersistenceRoute =
  | "approvals"
  | "coaching"
  | "contact-moments"
  | "help-requests"
  | "reflections"
  | "retrainings"
  | "sales-trainings";

const workflowRouteModules: Record<WorkflowPersistenceRoute, AppModuleCode> = {
  approvals: "BEGELEIDINGEN",
  coaching: "BEGELEIDINGEN",
  "contact-moments": "CONTACTMOMENTEN",
  "help-requests": "HULPAANVRAGEN",
  reflections: "ACTIEPUNTEN",
  retrainings: "RETRAININGEN",
  "sales-trainings": "SALESTRAININGEN",
};

export function moduleForWorkflowRoute(route: string): AppModuleCode | undefined {
  return workflowRouteModules[route as WorkflowPersistenceRoute];
}

export function filterWorkflowStateByActiveModules(
  state: WorkflowState,
  modules: Pick<AppModuleConfig, "code" | "enabled">[],
): WorkflowState {
  const enabled = new Set(modules.filter((module) => module.enabled).map((module) => module.code));
  const coachingEnabled = enabled.has("BEGELEIDINGEN");

  return {
    interventions: coachingEnabled ? state.interventions : [],
    approvals: coachingEnabled ? state.approvals : [],
    reflections: coachingEnabled && enabled.has("ACTIEPUNTEN") ? state.reflections : [],
    contactMoments: enabled.has("CONTACTMOMENTEN") ? state.contactMoments : [],
    helpRequests: enabled.has("HULPAANVRAGEN") ? state.helpRequests : [],
    retrainings: enabled.has("RETRAININGEN") ? state.retrainings : [],
    salesTrainings: enabled.has("SALESTRAININGEN") ? state.salesTrainings : [],
    linkedInterventions: state.linkedInterventions.filter((item) => {
      if (item.type === "begeleiding") return coachingEnabled;
      if (item.type === "retraining") return enabled.has("RETRAININGEN");
      if (item.type === "sales_training") return enabled.has("SALESTRAININGEN");
      return false;
    }),
  };
}
