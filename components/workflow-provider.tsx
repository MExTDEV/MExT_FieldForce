"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getVisibleWorkflowState } from "@/lib/data-access";
import type {
  ApprovalStatus,
  CoachingIntervention,
  ContactMoment,
  ContactMomentStatus,
  FollowUpType,
  HelpRequest,
  MockUser,
  Retraining,
  SalesTraining,
  Status,
  TrainingStatus,
  WorkflowReflection,
  WorkflowState,
} from "@/lib/types";
import {
  confirmWorkflowApproval,
  saveCoaching,
  saveContactMoment,
  saveRetraining,
  saveSalesTraining,
  createHelpRequest,
  planHelpRequestFollowUp,
  setHelpRequestStatus,
  submitContactMomentInput,
  submitWorkflowReflection,
  type CoachingWorkflowInput,
  type ContactMomentInput,
  type HelpRequestInput,
  type RetrainingInput,
  type SalesTrainingInput,
} from "@/lib/workflow-engine";

const STORAGE_KEY = "mext:workflow-state:v1";

const initialState: WorkflowState = {
  interventions: [],
  reflections: [],
  approvals: [],
  contactMoments: [],
  helpRequests: [],
  linkedInterventions: [],
  retrainings: [],
  salesTrainings: [],
};

type WorkflowContextValue = {
  hydrated: boolean;
  state: WorkflowState;
  saveConcept: (input: CoachingWorkflowInput) => CoachingIntervention;
  finalizeCoaching: (input: CoachingWorkflowInput) => CoachingIntervention;
  saveCoachingStatus: (input: CoachingWorkflowInput, status: Status) => CoachingIntervention;
  submitReflection: (
    reflectionId: string,
    answers: Pick<WorkflowReflection, "learnedText" | "workOnText" | "concreteGoalText">
  ) => void;
  confirmApproval: (approvalId: string, status: ApprovalStatus, comment: string) => void;
  visibleInterventions: (user: MockUser) => CoachingIntervention[];
  openReflections: (user: MockUser) => WorkflowReflection[];
  pendingApprovals: (user: MockUser) => WorkflowState["approvals"];
  saveContactMoment: (input: ContactMomentInput, status: ContactMomentStatus) => ContactMoment;
  submitContactInput: (id: string, representativeId: string, kpis: string[], themes: string[]) => void;
  createHelpRequest: (input: HelpRequestInput) => HelpRequest;
  planHelpFollowUp: (id: string, actorId: string, type: FollowUpType) => void;
  setHelpStatus: (id: string, status: HelpRequest["status"]) => void;
  visibleContactMoments: (user: MockUser) => ContactMoment[];
  visibleHelpRequests: (user: MockUser) => HelpRequest[];
  saveRetraining: (input: RetrainingInput, status: TrainingStatus) => Retraining;
  saveSalesTraining: (input: SalesTrainingInput, status: TrainingStatus) => SalesTraining;
  visibleRetrainings: (user: MockUser) => Retraining[];
  visibleSalesTrainings: (user: MockUser) => SalesTraining[];
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

function persist(state: WorkflowState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkflowState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<WorkflowState>;
        setState({
          interventions: parsed.interventions ?? [],
          reflections: parsed.reflections ?? [],
          approvals: parsed.approvals ?? [],
          contactMoments: parsed.contactMoments ?? [],
          helpRequests: parsed.helpRequests ?? [],
          linkedInterventions: parsed.linkedInterventions ?? [],
          retrainings: parsed.retrainings ?? [],
          salesTrainings: parsed.salesTrainings ?? [],
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  const updateState = useCallback((updater: (current: WorkflowState) => WorkflowState) => {
    setState((current) => {
      const next = updater(current);
      persist(next);
      return next;
    });
  }, []);

  const upsertIntervention = useCallback((input: CoachingWorkflowInput, status: Status) => {
    const result = saveCoaching(state, input, status);
    setState(result.state);
    persist(result.state);
    return result.intervention;
  }, [state]);

  const submitReflection = useCallback((
    reflectionId: string,
    answers: Pick<WorkflowReflection, "learnedText" | "workOnText" | "concreteGoalText">
  ) => {
    updateState((current) => submitWorkflowReflection(current, reflectionId, answers));
  }, [updateState]);

  const confirmApproval = useCallback((approvalId: string, status: ApprovalStatus, comment: string) => {
    updateState((current) => confirmWorkflowApproval(current, approvalId, status, comment));
  }, [updateState]);

  const visibleInterventions = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state).interventions,
    [state]
  );

  const openReflections = useCallback((user: MockUser) =>
    state.reflections.filter((reflection) =>
      user.role === "REPRESENTATIVE" &&
      reflection.representativeId === user.representativeId &&
      reflection.status === "niet_gestart"
    ), [state.reflections]);

  const pendingApprovals = useCallback((user: MockUser) =>
    state.approvals.filter((approval) => {
      const intervention = state.interventions.find((item) => item.id === approval.interventionId);
      return user.role === "REPRESENTATIVE" &&
        approval.representativeId === user.representativeId &&
        !approval.status &&
        intervention?.status === "wacht_op_akkoord";
    }), [state.approvals, state.interventions]);

  const visibleContactMoments = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state).contactMoments,
    [state]
  );

  const visibleHelpRequests = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state).helpRequests,
    [state]
  );

  const visibleRetrainings = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state).retrainings,
    [state]
  );

  const visibleSalesTrainings = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state).salesTrainings,
    [state]
  );

  const value = useMemo<WorkflowContextValue>(() => ({
    hydrated,
    state,
    saveConcept: (input) => upsertIntervention(input, "concept"),
    finalizeCoaching: (input) => upsertIntervention(input, "gefinaliseerd"),
    saveCoachingStatus: upsertIntervention,
    submitReflection,
    confirmApproval,
    visibleInterventions,
    openReflections,
    pendingApprovals,
    saveContactMoment: (input, status) => {
      const result = saveContactMoment(state, input, status);
      setState(result.state);
      persist(result.state);
      return result.contactMoment;
    },
    submitContactInput: (id, representativeId, kpis, themes) => {
      updateState((current) => submitContactMomentInput(current, id, representativeId, kpis, themes));
    },
    createHelpRequest: (input) => {
      const result = createHelpRequest(state, input);
      setState(result.state);
      persist(result.state);
      return result.helpRequest;
    },
    planHelpFollowUp: (id, actorId, type) => {
      updateState((current) => planHelpRequestFollowUp(current, id, actorId, type));
    },
    setHelpStatus: (id, status) => {
      updateState((current) => setHelpRequestStatus(current, id, status));
    },
    saveRetraining: (input, status) => {
      const result = saveRetraining(state, input, status);
      setState(result.state);
      persist(result.state);
      return result.retraining;
    },
    saveSalesTraining: (input, status) => {
      const result = saveSalesTraining(state, input, status);
      setState(result.state);
      persist(result.state);
      return result.salesTraining;
    },
    visibleContactMoments,
    visibleHelpRequests,
    visibleRetrainings,
    visibleSalesTrainings,
  }), [
    confirmApproval,
    hydrated,
    openReflections,
    pendingApprovals,
    visibleContactMoments,
    visibleHelpRequests,
    visibleRetrainings,
    visibleSalesTrainings,
    state,
    submitReflection,
    upsertIntervention,
    updateState,
    visibleInterventions,
  ]);

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) throw new Error("useWorkflow must be used within WorkflowProvider");
  return context;
}
