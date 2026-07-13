"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getVisibleWorkflowState } from "@/lib/data-access";
import { notificationRefreshEventName } from "@/lib/notifications";
import { dedupeWorkflowState } from "@/lib/coaching/visibility";
import {
  applyOutlookSyncToWorkflowStatePatch,
  mergeWorkflowStatePatch,
  type WorkflowStatePatch,
} from "@/lib/workflow-state-patch";
import { useRepresentatives } from "@/components/representatives-provider";
import { useSession } from "@/components/session-provider";
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
  scheduleHelpRequestCoaching as scheduleHelpRequestCoachingState,
  sendHelpRequestAnswer,
  setHelpRequestStatus,
  submitContactMomentInput,
  submitWorkflowReflection,
  updateHelpRequest,
  withdrawHelpRequest,
  type CoachingWorkflowInput,
  type ContactMomentInput,
  type HelpRequestInput,
  type HelpRequestAnswerInput,
  type HelpRequestUpdateInput,
  type RetrainingInput,
  type SalesTrainingInput,
} from "@/lib/workflow-engine";

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
  saveError: string | null;
  retrySave: () => void;
  clearSaveError: () => void;
  state: WorkflowState;
  saveConcept: (input: CoachingWorkflowInput) => Promise<CoachingIntervention>;
  finalizeCoaching: (input: CoachingWorkflowInput) => Promise<CoachingIntervention>;
  saveCoachingStatus: (input: CoachingWorkflowInput, status: Status) => Promise<CoachingIntervention>;
  transitionCoaching: (id: string, action: "reopen" | "send_for_approval" | "approve") => Promise<CoachingIntervention>;
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
  updateHelpRequest: (input: HelpRequestUpdateInput) => HelpRequest;
  withdrawHelpRequest: (id: string, requesterId: string) => void;
  sendHelpAnswer: (input: HelpRequestAnswerInput) => HelpRequest;
  planHelpFollowUp: (id: string, actorId: string, type: FollowUpType, answerHtml?: string) => void;
  scheduleHelpRequestCoaching: (id: string, actorId: string, input: CoachingWorkflowInput) => Promise<CoachingIntervention>;
  setHelpStatus: (id: string, status: HelpRequest["status"]) => void;
  visibleContactMoments: (user: MockUser) => ContactMoment[];
  visibleHelpRequests: (user: MockUser) => HelpRequest[];
  saveRetraining: (input: RetrainingInput, status: TrainingStatus) => Retraining;
  saveSalesTraining: (input: SalesTrainingInput, status: TrainingStatus) => SalesTraining;
  visibleRetrainings: (user: MockUser) => Retraining[];
  visibleSalesTrainings: (user: MockUser) => SalesTraining[];
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

type WorkflowPatch = WorkflowStatePatch;

type WorkflowPersistResponse = {
  error?: string;
  patch?: WorkflowPatch;
  outlookSync?: Array<{
    interventionId: string;
    outlookEventId?: string;
    outlookICalUId?: string;
    outlookSyncStatus: "NOT_SYNCED" | "SYNCED" | "ERROR";
    lastSyncedAt?: string;
    syncError?: string;
  }>;
};

async function postWorkflowPatch(endpoint: string, patch: WorkflowPatch): Promise<WorkflowPersistResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = (await response.json()) as WorkflowPersistResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Workflowgegevens konden niet worden opgeslagen.");
  }
  return payload;
}

function applyPersistedPatch(patch: WorkflowPatch, payload: WorkflowPersistResponse): WorkflowPatch {
  return applyOutlookSyncToWorkflowStatePatch(payload.patch ?? patch, payload.outlookSync);
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, user } = useSession();
  const { representatives } = useRepresentatives();
  const [state, setState] = useState<WorkflowState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [failedSave, setFailedSave] = useState<{ endpoint: string; patch: WorkflowPatch } | null>(null);

  useEffect(() => {
    if (sessionLoading || !user.id) {
      setState(initialState);
      setHydrated(!sessionLoading);
      return;
    }
    setHydrated(false);
    let active = true;
    async function loadWorkflowState() {
      try {
        const response = await fetch(
          `/api/workflows?actorId=${encodeURIComponent(user.id)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as {
          state?: Partial<WorkflowState>;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Workflowgegevens konden niet worden geladen.");
        }
        if (!active) return;
        setState(dedupeWorkflowState({
          interventions: payload.state?.interventions ?? [],
          reflections: payload.state?.reflections ?? [],
          approvals: payload.state?.approvals ?? [],
          contactMoments: payload.state?.contactMoments ?? [],
          helpRequests: payload.state?.helpRequests ?? [],
          linkedInterventions: payload.state?.linkedInterventions ?? [],
          retrainings: payload.state?.retrainings ?? [],
          salesTrainings: payload.state?.salesTrainings ?? [],
        }));
      } catch (error) {
        console.error("[workflow-provider]", error);
      } finally {
        if (active) setHydrated(true);
      }
    }
    loadWorkflowState();
    return () => {
      active = false;
    };
  }, [sessionLoading, user.id]);

  const persistOrThrow = useCallback(async (endpoint: string, patch: WorkflowPatch) => {
    try {
      setSaveError(null);
      setFailedSave(null);
      const payload = await postWorkflowPatch(endpoint, patch);
      const persistedPatch = applyPersistedPatch(patch, payload);
      window.dispatchEvent(new Event(notificationRefreshEventName));
      return persistedPatch;
    } catch (error) {
      setFailedSave({ endpoint, patch });
      setSaveError("Wijzigingen konden niet in de database worden opgeslagen. Probeer opnieuw of vernieuw de pagina.");
      throw error;
    }
  }, []);

  const persist = useCallback(async (endpoint: string, patch: WorkflowPatch) => {
    try {
      const persistedPatch = await persistOrThrow(endpoint, patch);
      setState((current) => mergeWorkflowStatePatch(current, persistedPatch));
    } catch (error) {
      console.error("[workflow-provider:persist]", error);
    }
  }, [persistOrThrow]);

  const retrySave = useCallback(() => {
    if (!failedSave) return;
    void persist(failedSave.endpoint, failedSave.patch);
  }, [failedSave, persist]);

  const updateState = useCallback((
    updater: (current: WorkflowState) => WorkflowState,
    endpoint: string,
    patch: (next: WorkflowState) => WorkflowPatch
  ) => {
    setState((current) => {
      const next = dedupeWorkflowState(updater(current));
      void persist(endpoint, patch(next));
      return next;
    });
  }, [persist]);

  const upsertIntervention = useCallback(async (input: CoachingWorkflowInput, status: Status) => {
    const result = saveCoaching(state, input, status, representatives);
    const patch: WorkflowPatch = {
      interventions: [result.intervention],
      reflections: result.state.reflections.filter((item) => item.interventionId === result.intervention.id),
    };
    const persistedPatch = await persistOrThrow("/api/workflows/coaching", patch);
    const saved = persistedPatch.interventions?.find((item) => item.id === result.intervention.id) ?? result.intervention;
    setState((current) => mergeWorkflowStatePatch(current, persistedPatch));
    return saved;
  }, [persistOrThrow, representatives, state]);

  const transitionCoaching = useCallback(async (
    id: string,
    action: "reopen" | "send_for_approval" | "approve"
  ) => {
    const response = await fetch(
      `/api/workflows/coaching/${encodeURIComponent(id)}/transition?actorId=${encodeURIComponent(user.id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }
    );
    const payload = await response.json() as { intervention?: CoachingIntervention; error?: string };
    if (!response.ok || !payload.intervention) {
      throw new Error(payload.error ?? "De status kon niet worden aangepast.");
    }
    setState((current) => dedupeWorkflowState({
      ...current,
      interventions: [
        ...current.interventions.filter((item) => item.id !== payload.intervention!.id),
        payload.intervention!,
      ],
    }));
    window.dispatchEvent(new Event(notificationRefreshEventName));
    return payload.intervention;
  }, [user.id]);

  const submitReflection = useCallback((
    reflectionId: string,
    answers: Pick<WorkflowReflection, "learnedText" | "workOnText" | "concreteGoalText">
  ) => {
    updateState(
      (current) => submitWorkflowReflection(current, reflectionId, answers),
      "/api/workflows/reflections",
      (next) => {
        const reflection = next.reflections.find((item) => item.id === reflectionId);
        return {
          reflections: reflection ? [reflection] : [],
          approvals: reflection ? next.approvals.filter((item) => item.interventionId === reflection.interventionId) : [],
          interventions: reflection ? next.interventions.filter((item) => item.id === reflection.interventionId) : [],
        };
      }
    );
  }, [updateState]);

  const confirmApproval = useCallback((approvalId: string, status: ApprovalStatus, comment: string) => {
    updateState(
      (current) => confirmWorkflowApproval(current, approvalId, status, comment),
      "/api/workflows/approvals",
      (next) => {
        const approval = next.approvals.find((item) => item.id === approvalId);
        return {
          approvals: approval ? [approval] : [],
          interventions: approval ? next.interventions.filter((item) => item.id === approval.interventionId) : [],
        };
      }
    );
  }, [updateState]);

  const visibleInterventions = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state, representatives).interventions,
    [representatives, state]
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
    (user: MockUser) => getVisibleWorkflowState(user, state, representatives).contactMoments,
    [representatives, state]
  );

  const visibleHelpRequests = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state, representatives).helpRequests,
    [representatives, state]
  );

  const visibleRetrainings = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state, representatives).retrainings,
    [representatives, state]
  );

  const visibleSalesTrainings = useCallback(
    (user: MockUser) => getVisibleWorkflowState(user, state, representatives).salesTrainings,
    [representatives, state]
  );

  const value = useMemo<WorkflowContextValue>(() => ({
    hydrated,
    saveError,
    retrySave,
    clearSaveError: () => setSaveError(null),
    state,
    saveConcept: (input) => upsertIntervention(input, "concept"),
    finalizeCoaching: (input) => upsertIntervention(input, "voltooid"),
    saveCoachingStatus: upsertIntervention,
    transitionCoaching,
    submitReflection,
    confirmApproval,
    visibleInterventions,
    openReflections,
    pendingApprovals,
    saveContactMoment: (input, status) => {
      const result = saveContactMoment(state, input, status, representatives);
      setState(dedupeWorkflowState(result.state));
      void persist("/api/workflows/contact-moments", { contactMoments: [result.contactMoment] });
      return result.contactMoment;
    },
    submitContactInput: (id, representativeId, kpis, themes) => {
      updateState(
        (current) => submitContactMomentInput(current, id, representativeId, kpis, themes),
        "/api/workflows/contact-moments",
        (next) => ({ contactMoments: next.contactMoments.filter((item) => item.id === id) })
      );
    },
    createHelpRequest: (input) => {
      const result = createHelpRequest(state, input, representatives);
      setState(dedupeWorkflowState(result.state));
      void persist("/api/workflows/help-requests", { helpRequests: [result.helpRequest] });
      return result.helpRequest;
    },
    updateHelpRequest: (input) => {
      const result = updateHelpRequest(state, input);
      setState(dedupeWorkflowState(result.state));
      void persist("/api/workflows/help-requests", { helpRequests: [result.helpRequest] });
      return result.helpRequest;
    },
    withdrawHelpRequest: (id, requesterId) => {
      updateState(
        (current) => withdrawHelpRequest(current, id, requesterId),
        "/api/workflows/help-requests",
        (next) => ({ helpRequests: next.helpRequests.filter((item) => item.id === id) })
      );
    },
    sendHelpAnswer: (input) => {
      const result = sendHelpRequestAnswer(state, input);
      setState(dedupeWorkflowState(result.state));
      void persist("/api/workflows/help-requests", { helpRequests: [result.helpRequest] });
      return result.helpRequest;
    },
    planHelpFollowUp: (id, actorId, type, answerHtml) => {
      updateState(
        (current) => planHelpRequestFollowUp(current, id, actorId, type, representatives, answerHtml),
        "/api/workflows/help-requests",
        (next) => ({
          helpRequests: next.helpRequests.filter((item) => item.id === id),
          contactMoments: next.contactMoments.filter((item) => item.sourceHelpRequestId === id),
          retrainings: next.retrainings.filter((item) => item.sourceHelpRequestId === id),
          salesTrainings: next.salesTrainings.filter((item) => item.sourceHelpRequestId === id),
        })
      );
    },
    scheduleHelpRequestCoaching: async (id, actorId, input) => {
      const result = scheduleHelpRequestCoachingState(state, id, actorId, input, representatives);
      const patch = {
        helpRequests: [result.helpRequest],
        interventions: [result.intervention],
      };
      try {
        const persistedPatch = await persistOrThrow("/api/workflows/help-requests", patch);
        const intervention = persistedPatch.interventions?.find((item) => item.id === result.intervention.id) ?? result.intervention;
        setState((current) => mergeWorkflowStatePatch(current, persistedPatch));
        return intervention;
      } catch (error) {
        console.error("[workflow-provider:schedule-help-coaching]", error);
        throw error;
      }
    },
    setHelpStatus: (id, status) => {
      updateState(
        (current) => setHelpRequestStatus(current, id, status),
        "/api/workflows/help-requests",
        (next) => ({ helpRequests: next.helpRequests.filter((item) => item.id === id) })
      );
    },
    saveRetraining: (input, status) => {
      const result = saveRetraining(state, input, status, representatives);
      setState(dedupeWorkflowState(result.state));
      void persist("/api/workflows/retrainings", { retrainings: [result.retraining] });
      return result.retraining;
    },
    saveSalesTraining: (input, status) => {
      const result = saveSalesTraining(state, input, status, representatives);
      setState(dedupeWorkflowState(result.state));
      void persist("/api/workflows/sales-trainings", { salesTrainings: [result.salesTraining] });
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
    retrySave,
    representatives,
    persist,
    persistOrThrow,
    saveError,
    visibleContactMoments,
    visibleHelpRequests,
    visibleRetrainings,
    visibleSalesTrainings,
    state,
    submitReflection,
    transitionCoaching,
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
