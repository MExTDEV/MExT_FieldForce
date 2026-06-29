import type {
  ApprovalStatus,
  CoachingIntervention,
  ContactMoment,
  ContactMomentStatus,
  FollowUpType,
  HelpRequest,
  HelpUrgency,
  LinkedIntervention,
  Retraining,
  SalesTraining,
  TrainingStatus,
  WorkflowActionPoint,
  WorkflowReflection,
  WorkflowScore,
  WorkflowState,
  Status,
  CoachingDossier,
  CoachingAppointment,
  Representative,
} from "@/lib/types";

export type CoachingWorkflowInput = {
  id?: string;
  representativeId: string;
  initiatorId: string;
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  focusNames: string[];
  scores: WorkflowScore[];
  actionPoints: Omit<WorkflowActionPoint, "id" | "status">[];
  dossier?: CoachingDossier;
  appointments?: CoachingAppointment[];
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const generalCriteria = [
  "Stiptheid",
  "Vertrekuur",
  "Demokoffer",
  "Draagtas met kofferproducten",
  "Netheid wagen",
  "Stockbeheer",
  "Voorbereiding",
  "Administratie",
  "Tempo",
  "Gebruik laptop",
];

const personalityCriteria = [
  "Uitstraling",
  "Zelfzekerheid",
  "Leiding in gesprek",
  "Verstaanbaarheid",
  "Overtuigend",
  "Respect",
  "Persoonlijke verzorging",
];

function defaultSimpleScores(criteria: string[]) {
  return criteria.map((criterion) => ({
    criterion,
    score: "nvt" as const,
    comment: "",
  }));
}

function defaultDossier(previous?: CoachingIntervention): CoachingDossier {
  return previous?.dossier ?? {
    arrivalTime: "",
    departureTime: "",
    kilometers: "",
    area: "",
    sector: "",
    groupAttentionPoints: ["", "", ""],
    individualAttentionPoint: "",
    generalScores: defaultSimpleScores(generalCriteria),
    personalityScores: defaultSimpleScores(personalityCriteria),
  };
}

function auditEntry(userId: string, action: string, summary: string) {
  return {
    id: createId("audit"),
    at: new Date().toISOString(),
    userId,
    action,
    summary,
  };
}

export type ContactMomentInput = {
  id?: string;
  representativeId: string;
  initiatorId: string;
  reason: string;
  reportedProblems: string;
  leaderThemes: string[];
  representativeKpis?: string[];
  representativeThemes?: string[];
  discussedThemes?: string[];
  conclusion?: string;
  actionPoints?: Omit<WorkflowActionPoint, "id" | "status">[];
  sourceHelpRequestId?: string;
};

export type HelpRequestInput = {
  representativeId: string;
  requesterId: string;
  subject: string;
  difficulty: string;
  desiredResult: string;
  urgency: HelpUrgency;
  explanation: string;
};

export type RetrainingInput = {
  id?: string;
  representativeId: string;
  initiatorId: string;
  theme: string;
  reason: string;
  desiredImprovement: string;
  kpi?: string;
  frameworkPhase?: string;
  date: string;
  trainer: string;
  result?: string;
  actionPoints?: Omit<WorkflowActionPoint, "id" | "status">[];
  sourceHelpRequestId?: string;
};

export type SalesTrainingInput = {
  id?: string;
  initiatorId: string;
  participantIds: string[];
  theme: string;
  reason: string;
  targetAudience: string;
  kpi?: string;
  frameworkPhase?: string;
  date: string;
  trainer: string;
  conclusion?: string;
  followUpAction?: string;
  createIndividualActions?: boolean;
  createGroupAction?: boolean;
  actionDue?: string;
  sourceHelpRequestId?: string;
};

function mapActionPoints(
  id: string,
  previous: WorkflowActionPoint[],
  actions: Omit<WorkflowActionPoint, "id" | "status">[]
) {
  return actions
    .filter((action) => action.title.trim())
    .map((action, index) => ({
      ...action,
      id: previous[index]?.id ?? `${id}-action-${index + 1}`,
      status: previous[index]?.status ?? "nieuw" as const,
    }));
}

export function saveRetraining(
  current: WorkflowState,
  input: RetrainingInput,
  status: TrainingStatus,
  representatives: Representative[]
): { state: WorkflowState; retraining: Retraining } {
  const representative = representatives.find((item) => item.id === input.representativeId);
  if (!representative) throw new Error("Vertegenwoordiger niet gevonden.");
  const now = new Date().toISOString();
  const id = input.id ?? createId("retraining");
  const previous = current.retrainings.find((item) => item.id === id);
  const retraining: Retraining = {
    id,
    representativeId: representative.id,
    initiatorId: input.initiatorId,
    country: representative.country,
    teamId: representative.teamId,
    theme: input.theme,
    reason: input.reason,
    desiredImprovement: input.desiredImprovement,
    kpi: input.kpi || undefined,
    frameworkPhase: input.frameworkPhase || undefined,
    date: input.date,
    trainer: input.trainer,
    result: input.result ?? previous?.result ?? "",
    actionPoints: mapActionPoints(id, previous?.actionPoints ?? [], input.actionPoints ?? previous?.actionPoints ?? []),
    status,
    sourceHelpRequestId: input.sourceHelpRequestId ?? previous?.sourceHelpRequestId,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    completedAt: status === "afgerond" ? now : previous?.completedAt,
  };
  return {
    retraining,
    state: {
      ...current,
      retrainings: [...current.retrainings.filter((item) => item.id !== id), retraining],
    },
  };
}

export function saveSalesTraining(
  current: WorkflowState,
  input: SalesTrainingInput,
  status: TrainingStatus,
  representatives: Representative[]
): { state: WorkflowState; salesTraining: SalesTraining } {
  const participants = representatives.filter((item) => input.participantIds.includes(item.id));
  if (participants.length !== input.participantIds.length || participants.length === 0) {
    throw new Error("Selecteer minstens één geldige deelnemer.");
  }
  const countries = new Set(participants.map((item) => item.country));
  if (countries.size > 1) throw new Error("Een sales training kan deelnemers uit slechts één land bevatten.");
  const now = new Date().toISOString();
  const id = input.id ?? createId("sales-training");
  const previous = current.salesTrainings.find((item) => item.id === id);
  const followUpAction = input.followUpAction ?? previous?.followUpAction ?? "";
  const createIndividualActions = input.createIndividualActions ?? previous?.createIndividualActions ?? false;
  const createGroupAction = input.createGroupAction ?? previous?.createGroupAction ?? false;
  const actionDue = input.actionDue ?? previous?.actionDue ?? "";
  const generatedActions = status === "afgerond" && followUpAction.trim()
    ? [
        ...(createIndividualActions
          ? participants.map((participant) => ({
              id: `${id}-action-${participant.id}`,
              title: followUpAction,
              type: "vaardigheid" as const,
              due: actionDue,
              status: previous?.actionPoints.find((action) => action.id === `${id}-action-${participant.id}`)?.status ?? "nieuw" as const,
              representativeIds: [participant.id],
              scope: "individual" as const,
            }))
          : []),
        ...(createGroupAction
          ? [{
              id: `${id}-action-group`,
              title: followUpAction,
              type: "vaardigheid" as const,
              due: actionDue,
              status: previous?.actionPoints.find((action) => action.id === `${id}-action-group`)?.status ?? "nieuw" as const,
              representativeIds: participants.map((participant) => participant.id),
              scope: "group" as const,
            }]
          : []),
      ]
    : previous?.actionPoints ?? [];
  const salesTraining: SalesTraining = {
    id,
    initiatorId: input.initiatorId,
    country: participants[0].country,
    theme: input.theme,
    reason: input.reason,
    targetAudience: input.targetAudience,
    participantIds: input.participantIds,
    kpi: input.kpi || undefined,
    frameworkPhase: input.frameworkPhase || undefined,
    date: input.date,
    trainer: input.trainer,
    conclusion: input.conclusion ?? previous?.conclusion ?? "",
    followUpAction,
    createIndividualActions,
    createGroupAction,
    actionDue,
    actionPoints: generatedActions,
    status,
    sourceHelpRequestId: input.sourceHelpRequestId ?? previous?.sourceHelpRequestId,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    completedAt: status === "afgerond" ? now : previous?.completedAt,
  };
  return {
    salesTraining,
    state: {
      ...current,
      salesTrainings: [...current.salesTrainings.filter((item) => item.id !== id), salesTraining],
    },
  };
}

export function saveContactMoment(
  current: WorkflowState,
  input: ContactMomentInput,
  status: ContactMomentStatus,
  representatives: Representative[]
): { state: WorkflowState; contactMoment: ContactMoment } {
  const representative = representatives.find((item) => item.id === input.representativeId);
  if (!representative) throw new Error("Vertegenwoordiger niet gevonden.");
  const now = new Date().toISOString();
  const id = input.id ?? createId("contact");
  const previous = current.contactMoments.find((item) => item.id === id);
  const contactMoment: ContactMoment = {
    id,
    representativeId: representative.id,
    initiatorId: input.initiatorId,
    ownerId: input.initiatorId,
    country: representative.country,
    teamId: representative.teamId,
    status,
    reason: input.reason,
    reportedProblems: input.reportedProblems,
    leaderThemes: input.leaderThemes,
    representativeKpis: input.representativeKpis ?? previous?.representativeKpis ?? [],
    representativeThemes: input.representativeThemes ?? previous?.representativeThemes ?? [],
    discussedThemes: input.discussedThemes ?? previous?.discussedThemes ?? [],
    conclusion: input.conclusion ?? previous?.conclusion ?? "",
    actionPoints: input.actionPoints
      ? input.actionPoints
          .filter((action) => action.title.trim())
          .map((action, index) => ({
            ...action,
            id: previous?.actionPoints[index]?.id ?? `${id}-action-${index + 1}`,
            status: previous?.actionPoints[index]?.status ?? "nieuw",
          }))
      : previous?.actionPoints ?? [],
    sourceHelpRequestId: input.sourceHelpRequestId ?? previous?.sourceHelpRequestId,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  return {
    contactMoment,
    state: {
      ...current,
      contactMoments: [...current.contactMoments.filter((item) => item.id !== id), contactMoment],
    },
  };
}

export function submitContactMomentInput(
  current: WorkflowState,
  id: string,
  representativeId: string,
  representativeKpis: string[],
  representativeThemes: string[]
): WorkflowState {
  const contact = current.contactMoments.find((item) => item.id === id);
  if (!contact || contact.representativeId !== representativeId) {
    throw new Error("Contactmoment niet beschikbaar.");
  }
  const now = new Date().toISOString();
  return {
    ...current,
    contactMoments: current.contactMoments.map((item) =>
      item.id === id
        ? { ...item, representativeKpis, representativeThemes, status: "gepland", updatedAt: now }
        : item
    ),
  };
}

export function createHelpRequest(
  current: WorkflowState,
  input: HelpRequestInput,
  representatives: Representative[]
): { state: WorkflowState; helpRequest: HelpRequest } {
  const representative = representatives.find((item) => item.id === input.representativeId);
  if (!representative) throw new Error("Vertegenwoordiger niet gevonden.");
  const now = new Date().toISOString();
  const helpRequest: HelpRequest = {
    id: createId("help"),
    requesterId: input.requesterId,
    representativeId: representative.id,
    country: representative.country,
    teamId: representative.teamId,
    subject: input.subject,
    difficulty: input.difficulty,
    desiredResult: input.desiredResult,
    urgency: input.urgency,
    explanation: input.explanation,
    status: "nieuw",
    createdAt: now,
    updatedAt: now,
  };
  return {
    helpRequest,
    state: { ...current, helpRequests: [...current.helpRequests, helpRequest] },
  };
}

export function planHelpRequestFollowUp(
  current: WorkflowState,
  helpRequestId: string,
  actorId: string,
  followUpType: FollowUpType,
  representatives: Representative[]
): WorkflowState {
  const request = current.helpRequests.find((item) => item.id === helpRequestId);
  if (!request) throw new Error("Hulpaanvraag niet gevonden.");
  const now = new Date().toISOString();
  let linkedInterventionId: string | undefined;
  let contactMoments = current.contactMoments;
  let linkedInterventions = current.linkedInterventions;
  let retrainings = current.retrainings;
  let salesTrainings = current.salesTrainings;

  if (followUpType === "contactmoment") {
    const result = saveContactMoment(current, {
      representativeId: request.representativeId,
      initiatorId: actorId,
      reason: `Vervolg op hulpaanvraag: ${request.subject}`,
      reportedProblems: request.difficulty,
      leaderThemes: [request.desiredResult],
      sourceHelpRequestId: request.id,
    }, "gepland", representatives);
    linkedInterventionId = result.contactMoment.id;
    contactMoments = result.state.contactMoments;
  } else if (followUpType === "retraining") {
    const result = saveRetraining(current, {
      representativeId: request.representativeId,
      initiatorId: actorId,
      theme: request.subject,
      reason: request.difficulty,
      desiredImprovement: request.desiredResult,
      date: "",
      trainer: "",
      sourceHelpRequestId: request.id,
    }, "concept", representatives);
    linkedInterventionId = result.retraining.id;
    retrainings = result.state.retrainings;
  } else if (followUpType === "sales_training") {
    const representative = representatives.find((item) => item.id === request.representativeId)!;
    const result = saveSalesTraining(current, {
      initiatorId: actorId,
      participantIds: [request.representativeId],
      theme: request.subject,
      reason: request.difficulty,
      targetAudience: representative.team,
      date: "",
      trainer: "",
      followUpAction: request.desiredResult,
      sourceHelpRequestId: request.id,
    }, "concept", representatives);
    linkedInterventionId = result.salesTraining.id;
    salesTrainings = result.state.salesTrainings;
  } else if (followUpType === "begeleiding") {
    const linked: LinkedIntervention = {
      id: createId("followup"),
      representativeId: request.representativeId,
      country: request.country,
      teamId: request.teamId,
      type: followUpType as LinkedIntervention["type"],
      title: `${followUpType.replace("_", " ")}: ${request.subject}`,
      status: "gepland",
      sourceHelpRequestId: request.id,
      createdAt: now,
    };
    linkedInterventionId = linked.id;
    linkedInterventions = [...current.linkedInterventions, linked];
  }

  const closesImmediately = followUpType === "geen_actie";
  return {
    ...current,
    contactMoments,
    linkedInterventions,
    retrainings,
    salesTrainings,
    helpRequests: current.helpRequests.map((item) =>
      item.id === helpRequestId
        ? {
            ...item,
            followUpType,
            linkedInterventionId,
            status: closesImmediately ? "afgesloten" : "vervolgactie_gepland",
            updatedAt: now,
          }
        : item
    ),
  };
}

export function setHelpRequestStatus(
  current: WorkflowState,
  helpRequestId: string,
  status: HelpRequest["status"]
): WorkflowState {
  if (!current.helpRequests.some((item) => item.id === helpRequestId)) {
    throw new Error("Hulpaanvraag niet gevonden.");
  }
  return {
    ...current,
    helpRequests: current.helpRequests.map((item) =>
      item.id === helpRequestId
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item
    ),
  };
}

export function saveCoaching(
  current: WorkflowState,
  input: CoachingWorkflowInput,
  status: Status,
  representatives: Representative[]
): { state: WorkflowState; intervention: CoachingIntervention } {
  const representative = representatives.find((item) => item.id === input.representativeId);
  if (!representative) throw new Error("Vertegenwoordiger niet gevonden.");

  const now = new Date().toISOString();
  const id = input.id ?? createId("coaching");
  const previous = current.interventions.find((item) => item.id === id);
  const intervention: CoachingIntervention = {
    id,
    representativeId: representative.id,
    initiatorId: input.initiatorId,
    ownerId: input.initiatorId,
    country: representative.country,
    teamId: representative.teamId,
    title: `Begeleiding ${representative.firstName} ${representative.lastName}`,
    status,
    plannedDate: input.plannedDate ?? previous?.plannedDate ?? now.slice(0, 10),
    startTime: input.startTime ?? previous?.startTime ?? "09:00",
    endTime: input.endTime ?? previous?.endTime ?? "11:00",
    notifyRepresentative: input.notifyRepresentative ?? previous?.notifyRepresentative ?? false,
    outlookEventId: previous?.outlookEventId,
    outlookICalUId: previous?.outlookICalUId,
    outlookSyncStatus: "NOT_SYNCED",
    lastSyncedAt: previous?.lastSyncedAt,
    syncError: undefined,
    focusNames: input.focusNames,
    scores: input.scores,
    actionPoints: input.actionPoints
      .filter((action) => action.title.trim())
      .map((action, index) => ({
        ...action,
        id: previous?.actionPoints[index]?.id ?? `${id}-action-${index + 1}`,
        owner: action.owner ?? previous?.actionPoints[index]?.owner ?? input.initiatorId,
        priority: action.priority ?? previous?.actionPoints[index]?.priority ?? "normaal",
        status: previous?.actionPoints[index]?.status ?? "open",
      })),
    dossier: input.dossier ?? defaultDossier(previous),
    appointments: input.appointments ?? previous?.appointments ?? [],
    auditTrail: [
      ...(previous?.auditTrail ?? []),
      auditEntry(input.initiatorId, status, status === "gefinaliseerd" ? "Begeleiding gefinaliseerd." : `Begeleiding opgeslagen als ${status}.`),
    ],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    finalizedAt: status === "wacht_op_vt" || status === "gefinaliseerd" ? now : previous?.finalizedAt,
  };
  const interventions = [
    ...current.interventions.filter((item) => item.id !== id),
    intervention,
  ];

  if (status !== "wacht_op_vt" && status !== "gefinaliseerd") {
    return { intervention, state: { ...current, interventions } };
  }

  const existingReflection = current.reflections.find((item) => item.interventionId === id);
  const reflection: WorkflowReflection = existingReflection ?? {
    id: createId("reflection"),
    interventionId: id,
    representativeId: representative.id,
    status: "niet_gestart",
    learnedText: "",
    workOnText: "",
    concreteGoalText: "",
    createdAt: now,
  };
  return {
    intervention,
    state: {
      ...current,
      interventions,
      reflections: [
        ...current.reflections.filter((item) => item.interventionId !== id),
        reflection,
      ],
    },
  };
}

export function submitWorkflowReflection(
  current: WorkflowState,
  reflectionId: string,
  answers: Pick<WorkflowReflection, "learnedText" | "workOnText" | "concreteGoalText">
): WorkflowState {
  const reflection = current.reflections.find((item) => item.id === reflectionId);
  if (!reflection) throw new Error("Reflectie niet gevonden.");
  const now = new Date().toISOString();
  const approval = current.approvals.find((item) => item.interventionId === reflection.interventionId) ?? {
    id: createId("approval"),
    interventionId: reflection.interventionId,
    representativeId: reflection.representativeId,
    comment: "",
    createdAt: now,
  };
  return {
    ...current,
    interventions: current.interventions.map((item) =>
      item.id === reflection.interventionId
        ? { ...item, status: "wacht_op_akkoord", updatedAt: now }
        : item
    ),
    reflections: current.reflections.map((item) =>
      item.id === reflectionId
        ? { ...item, ...answers, status: "ingediend", submittedAt: now }
        : item
    ),
    approvals: [
      ...current.approvals.filter((item) => item.interventionId !== reflection.interventionId),
      approval,
    ],
  };
}

export function confirmWorkflowApproval(
  current: WorkflowState,
  approvalId: string,
  status: ApprovalStatus,
  comment: string
): WorkflowState {
  const approval = current.approvals.find((item) => item.id === approvalId);
  if (!approval) throw new Error("Approval niet gevonden.");
  if (status === "gelezen_niet_akkoord" && comment.trim().length < 3) {
    throw new Error("Commentaar is verplicht bij niet akkoord.");
  }
  const now = new Date().toISOString();
  return {
    ...current,
    interventions: current.interventions.map((item) =>
      item.id === approval.interventionId
        ? { ...item, status: "afgesloten", updatedAt: now }
        : item
    ),
    approvals: current.approvals.map((item) =>
      item.id === approvalId ? { ...item, status, comment, confirmedAt: now } : item
    ),
  };
}
