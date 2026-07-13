import type {
  ApprovalStatus,
  CoachingIntervention,
  ContactMoment,
  ContactMomentStatus,
  FollowUpType,
  HelpRequest,
  HelpUrgency,
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
  CoachingParticipant,
  Representative,
} from "@/lib/types";
import { isBlankRichText, richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";

export type CoachingWorkflowInput = {
  id?: string;
  representativeId: string;
  initiatorId: string;
  ownerId?: string;
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  subject?: CoachingParticipant;
  internalNotes?: string;
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
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  subject?: string;
  contactType?: string;
  location?: string;
  internalNotes?: string;
  reason: string;
  reportedProblems: string;
  leaderThemes: string[];
  representativeKpis?: string[];
  representativeThemes?: string[];
  discussedThemes?: string[];
  conclusion?: string;
  reportHtml?: string;
  actionPoints?: Omit<WorkflowActionPoint, "id" | "status">[];
  closedReason?: string;
  sourceHelpRequestId?: string;
  photos?: ContactMoment["photos"];
};

export type HelpRequestInput = {
  id?: string;
  representativeId: string;
  requesterId: string;
  responsibleUserId?: string;
  subject: string;
  descriptionHtml?: string;
  difficulty?: string;
  desiredResult?: string;
  urgency?: HelpUrgency;
  explanation?: string;
};

export type HelpRequestUpdateInput = {
  id: string;
  requesterId: string;
  subject: string;
  descriptionHtml: string;
};

export type HelpRequestAnswerInput = {
  helpRequestId: string;
  authorId: string;
  bodyHtml: string;
  closesRequest?: boolean;
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
  if (previous && isFinalContactMomentStatus(previous.status)) {
    if (isSameFinalContactMomentSave(previous, input, status)) {
      return { state: current, contactMoment: previous };
    }
    throw new Error("Een definitief contactmoment kan niet meer aangepast worden.");
  }
  assertValidContactMomentTransition(previous?.status, status);
  assertValidContactMomentPlanning(input, previous);
  if (status === "afgesloten" && isBlankRichText(input.reportHtml ?? input.conclusion ?? previous?.reportHtml ?? previous?.conclusion)) {
    throw new Error("Een verslag is verplicht voordat het contactmoment gedeeld kan worden.");
  }
  if ((status === "geannuleerd" || status === "niet_uitgevoerd") && !(input.closedReason ?? "").trim()) {
    throw new Error("Geef een reden op voor annuleren of niet uitvoeren.");
  }
  const reportHtml = sanitizeRichText(input.reportHtml ?? previous?.reportHtml ?? input.conclusion ?? previous?.conclusion ?? "");
  const nextActions = input.actionPoints
    ? input.actionPoints
        .filter((action) => action.title.trim())
        .map((action, index) => ({
          ...action,
          id: previous?.actionPoints[index]?.id ?? `${id}-action-${index + 1}`,
          status: previous?.actionPoints[index]?.status ?? "nieuw",
          owner: representative.id,
        }))
    : previous?.actionPoints ?? [];
  const sharedAt = status === "afgesloten" ? previous?.sharedAt ?? now : previous?.sharedAt;
  const contactMoment: ContactMoment = {
    id,
    representativeId: representative.id,
    initiatorId: input.initiatorId,
    ownerId: input.initiatorId,
    country: representative.country,
    teamId: representative.teamId,
    status,
    plannedDate: input.plannedDate ?? previous?.plannedDate,
    startTime: input.startTime ?? previous?.startTime,
    endTime: input.endTime ?? previous?.endTime,
    notifyRepresentative: input.notifyRepresentative ?? previous?.notifyRepresentative ?? false,
    subject: input.subject ?? previous?.subject,
    contactType: input.contactType ?? previous?.contactType,
    location: input.location ?? previous?.location,
    internalNotes: input.internalNotes ?? previous?.internalNotes,
    outlookEventId: previous?.outlookEventId,
    outlookICalUId: previous?.outlookICalUId,
    outlookSyncStatus: previous?.outlookSyncStatus ?? "NOT_SYNCED",
    lastSyncedAt: previous?.lastSyncedAt,
    syncError: previous?.syncError,
    reason: input.reason,
    reportedProblems: input.reportedProblems,
    leaderThemes: input.leaderThemes,
    representativeKpis: input.representativeKpis ?? previous?.representativeKpis ?? [],
    representativeThemes: input.representativeThemes ?? previous?.representativeThemes ?? [],
    discussedThemes: input.discussedThemes ?? previous?.discussedThemes ?? [],
    conclusion: input.conclusion ?? previous?.conclusion ?? "",
    reportHtml,
    actionPoints: nextActions,
    finalSnapshot: status === "afgesloten"
      ? previous?.finalSnapshot ?? buildContactMomentSnapshot(id, representative, input, nextActions, reportHtml, sharedAt, input.initiatorId)
      : previous?.finalSnapshot,
    sharedAt,
    sharedById: status === "afgesloten" ? previous?.sharedById ?? input.initiatorId : previous?.sharedById,
    closedReason: (status === "geannuleerd" || status === "niet_uitgevoerd")
      ? input.closedReason?.trim()
      : previous?.closedReason,
    closedAt: (status === "geannuleerd" || status === "niet_uitgevoerd") ? previous?.closedAt ?? now : previous?.closedAt,
    closedById: (status === "geannuleerd" || status === "niet_uitgevoerd") ? previous?.closedById ?? input.initiatorId : previous?.closedById,
    previousStatus: (status === "geannuleerd" || status === "niet_uitgevoerd") ? previous?.status : previous?.previousStatus,
    sourceHelpRequestId: input.sourceHelpRequestId ?? previous?.sourceHelpRequestId,
    photos: input.photos ?? previous?.photos ?? [],
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
  const descriptionSource = firstFilled(input.descriptionHtml, input.explanation, input.difficulty, input.desiredResult);
  assertValidHelpRequestContent(input.subject, descriptionSource);
  const now = new Date().toISOString();
  const descriptionHtml = sanitizeRichText(descriptionSource);
  const descriptionText = richTextToPlainText(descriptionHtml);
  const helpRequest: HelpRequest = {
    id: input.id ?? createId("help"),
    requesterId: input.requesterId,
    representativeId: representative.id,
    responsibleUserId: input.responsibleUserId,
    country: representative.country,
    teamId: representative.teamId,
    subject: input.subject.trim(),
    descriptionHtml,
    descriptionText,
    difficulty: input.difficulty ?? descriptionText,
    desiredResult: input.desiredResult ?? "",
    urgency: input.urgency ?? "normaal",
    explanation: input.explanation ?? descriptionHtml,
    status: "open",
    answers: [],
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
  if (!canHandleHelpRequest(request)) throw new Error("Deze hulpaanvraag kan niet meer behandeld worden.");
  if (followUpType === "begeleiding") {
    throw new Error("Een begeleiding wordt pas na bevestiging in de planningswizard ingepland.");
  }
  const now = new Date().toISOString();
  let linkedInterventionId: string | undefined;
  let contactMoments = current.contactMoments;
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
  }

  const closesImmediately = followUpType === "geen_actie";
  const followUpStatus = statusForHelpFollowUp(followUpType);
  return {
    ...current,
    contactMoments,
    retrainings,
    salesTrainings,
    helpRequests: current.helpRequests.map((item) =>
      item.id === helpRequestId
        ? {
            ...item,
            followUpType,
            linkedInterventionId,
            status: closesImmediately ? "gesloten" : followUpStatus,
            firstHandledAt: item.firstHandledAt ?? now,
            firstHandledByUserId: item.firstHandledByUserId ?? actorId,
            updatedAt: now,
          }
        : item
    ),
  };
}

export function scheduleHelpRequestCoaching(
  current: WorkflowState,
  helpRequestId: string,
  actorId: string,
  input: CoachingWorkflowInput,
  representatives: Representative[]
): { state: WorkflowState; intervention: CoachingIntervention; helpRequest: HelpRequest } {
  const request = current.helpRequests.find((item) => item.id === helpRequestId);
  if (!request) throw new Error("Hulpaanvraag niet gevonden.");
  if (!canHandleHelpRequest(request)) throw new Error("Deze hulpaanvraag kan niet meer behandeld worden.");
  if (input.id) throw new Error("Een hulpaanvraag kan alleen een nieuwe begeleiding plannen.");
  if (input.representativeId && input.representativeId !== request.representativeId) {
    throw new Error("De begeleiding moet gekoppeld blijven aan de vertegenwoordiger van de hulpaanvraag.");
  }
  assertValidCoachingPlanning(input);
  if (!input.focusNames.length) {
    throw new Error("Selecteer minstens een focusfase voor de begeleiding.");
  }

  const now = new Date().toISOString();
  const result = saveCoaching(current, {
    ...input,
    id: undefined,
    representativeId: request.representativeId,
    initiatorId: actorId,
  }, "gepland", representatives);
  const updatedHelpRequest: HelpRequest = {
    ...request,
    status: "begeleiding",
    followUpType: "begeleiding",
    linkedInterventionId: result.intervention.id,
    firstHandledAt: request.firstHandledAt ?? now,
    firstHandledByUserId: request.firstHandledByUserId ?? actorId,
    updatedAt: now,
  };

  return {
    intervention: result.intervention,
    helpRequest: updatedHelpRequest,
    state: {
      ...result.state,
      helpRequests: result.state.helpRequests.map((item) =>
        item.id === helpRequestId ? updatedHelpRequest : item
      ),
    },
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
  const request = current.helpRequests.find((item) => item.id === helpRequestId)!;
  if ((status === "gesloten" || status === "afgesloten") && !(request.answers ?? []).some((answer) => answer.closesRequest)) {
    throw new Error("Een hulpaanvraag kan niet zonder inhoudelijk antwoord gesloten worden.");
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
  const representative =
    representatives.find((item) => item.id === input.representativeId) ??
    (input.subject ? coachingParticipantAsRepresentative(input.subject) : undefined);
  if (!representative) throw new Error("Begeleide persoon niet gevonden.");

  const now = new Date().toISOString();
  const id = input.id ?? createId("coaching");
  const previous = current.interventions.find((item) => item.id === id);
  const intervention: CoachingIntervention = {
    id,
    representativeId: representative.id,
    initiatorId: input.initiatorId,
    ownerId: input.ownerId ?? input.initiatorId,
    country: representative.country,
    teamId: representative.teamId,
    title: `Begeleiding ${representative.firstName} ${representative.lastName}`,
    subject: input.subject ?? previous?.subject,
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
    internalNotes: input.internalNotes ?? previous?.internalNotes,
    sentForApprovalAt: previous?.sentForApprovalAt,
    sentForApprovalById: previous?.sentForApprovalById,
    approvedByRepAt: previous?.approvedByRepAt,
    approvedByRepId: previous?.approvedByRepId,
    deletedAt: status === "geannuleerd" ? now : previous?.deletedAt,
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
      auditEntry(input.initiatorId, status, ["gefinaliseerd", "voltooid"].includes(status) ? "Begeleiding afgewerkt." : `Begeleiding opgeslagen als ${status}.`),
    ],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    finalizedAt: ["wacht_op_vt", "gefinaliseerd", "voltooid"].includes(status) ? now : previous?.finalizedAt,
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

export function canEditOrWithdrawHelpRequest(request: HelpRequest) {
  return (request.status === "open" || request.status === "nieuw") &&
    !request.firstHandledAt &&
    !(request.answers ?? []).length &&
    !request.followUpType &&
    !request.linkedInterventionId;
}

export function canHandleHelpRequest(request: HelpRequest) {
  return ["open", "nieuw", "in_behandeling"].includes(request.status) &&
    !request.linkedInterventionId &&
    request.status !== "ingetrokken" &&
    request.status !== "gesloten" &&
    request.status !== "afgesloten";
}

function statusForHelpFollowUp(followUpType: FollowUpType): HelpRequest["status"] {
  if (followUpType === "begeleiding") return "begeleiding";
  if (followUpType === "contactmoment") return "contactmoment";
  if (followUpType === "retraining") return "retraining";
  if (followUpType === "sales_training") return "salestraining";
  if (followUpType === "geen_actie") return "gesloten";
  return "in_behandeling";
}

function assertValidHelpRequestContent(subject: string, descriptionHtml: string) {
  if (!subject.trim()) throw new Error("Onderwerp is verplicht.");
  if (isBlankRichText(descriptionHtml)) throw new Error("Omschrijving is verplicht.");
}

function assertValidCoachingPlanning(input: CoachingWorkflowInput) {
  if (!input.plannedDate || Number.isNaN(new Date(`${input.plannedDate}T12:00:00`).getTime())) {
    throw new Error("Kies een geldige datum voor de begeleiding.");
  }
  if (!input.startTime || !input.endTime || !/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    throw new Error("Kies een geldig begin- en einduur.");
  }
  if (input.endTime <= input.startTime) {
    throw new Error("Het einduur moet later zijn dan het beginuur.");
  }
  if (!input.ownerId) {
    throw new Error("Kies een begeleider voor de begeleiding.");
  }
}

function firstFilled(...values: Array<string | undefined>) {
  return values.find((value) => value && !isBlankRichText(value)) ?? "";
}

function coachingParticipantAsRepresentative(subject: CoachingParticipant): Representative {
  return {
    id: subject.id,
    firstName: subject.firstName,
    lastName: subject.lastName,
    initials: subject.initials,
    country: subject.country,
    team: subject.team,
    teamId: subject.teamId,
    level: "Vertegenwoordiger",
    levelColor: subject.role === "SALES_LEADER" ? "bg-brand-100 text-brand-800" : "bg-sky-100 text-sky-800",
    lastCoaching: "Nog niet",
    openActions: 0,
    email: "",
    phone: "",
    kpis: [],
  };
}

export function updateHelpRequest(
  current: WorkflowState,
  input: HelpRequestUpdateInput
): { state: WorkflowState; helpRequest: HelpRequest } {
  const request = current.helpRequests.find((item) => item.id === input.id);
  if (!request) throw new Error("Hulpaanvraag niet gevonden.");
  if (request.requesterId !== input.requesterId) throw new Error("Je mag deze hulpaanvraag niet aanpassen.");
  if (!canEditOrWithdrawHelpRequest(request)) {
    throw new Error("Deze hulpaanvraag werd ondertussen behandeld en kan niet meer worden aangepast.");
  }
  assertValidHelpRequestContent(input.subject, input.descriptionHtml);
  const now = new Date().toISOString();
  const descriptionHtml = sanitizeRichText(input.descriptionHtml);
  const updated: HelpRequest = {
    ...request,
    subject: input.subject.trim(),
    descriptionHtml,
    descriptionText: richTextToPlainText(descriptionHtml),
    difficulty: richTextToPlainText(descriptionHtml),
    explanation: descriptionHtml,
    updatedAt: now,
  };
  return {
    helpRequest: updated,
    state: {
      ...current,
      helpRequests: current.helpRequests.map((item) => item.id === input.id ? updated : item),
    },
  };
}

export function withdrawHelpRequest(
  current: WorkflowState,
  helpRequestId: string,
  requesterId: string
): WorkflowState {
  const request = current.helpRequests.find((item) => item.id === helpRequestId);
  if (!request) throw new Error("Hulpaanvraag niet gevonden.");
  if (request.requesterId !== requesterId) throw new Error("Je mag deze hulpaanvraag niet intrekken.");
  if (!canEditOrWithdrawHelpRequest(request)) {
    throw new Error("Een behandelde hulpaanvraag kan niet meer worden ingetrokken.");
  }
  const now = new Date().toISOString();
  return {
    ...current,
    helpRequests: current.helpRequests.map((item) =>
      item.id === helpRequestId
        ? { ...item, status: "ingetrokken", withdrawnAt: now, withdrawnByUserId: requesterId, updatedAt: now }
        : item
    ),
  };
}

export function sendHelpRequestAnswer(
  current: WorkflowState,
  input: HelpRequestAnswerInput
): { state: WorkflowState; helpRequest: HelpRequest } {
  const request = current.helpRequests.find((item) => item.id === input.helpRequestId);
  if (!request) throw new Error("Hulpaanvraag niet gevonden.");
  if (!canHandleHelpRequest(request)) throw new Error("Deze hulpaanvraag kan niet meer behandeld worden.");
  if (isBlankRichText(input.bodyHtml)) throw new Error("Een inhoudelijk antwoord is verplicht.");
  const now = new Date().toISOString();
  const bodyHtml = sanitizeRichText(input.bodyHtml);
  const answer = {
    id: createId("help-answer"),
    helpRequestId: request.id,
    authorId: input.authorId,
    bodyHtml,
    bodyText: richTextToPlainText(bodyHtml),
    closesRequest: Boolean(input.closesRequest),
    createdAt: now,
  };
  const updated: HelpRequest = {
    ...request,
    status: input.closesRequest ? "gesloten" : "in_behandeling",
    firstHandledAt: request.firstHandledAt ?? now,
    firstHandledByUserId: request.firstHandledByUserId ?? input.authorId,
    answers: [...(request.answers ?? []), answer],
    updatedAt: now,
  };
  return {
    helpRequest: updated,
    state: {
      ...current,
      helpRequests: current.helpRequests.map((item) => item.id === request.id ? updated : item),
    },
  };
}

export function isFinalContactMomentStatus(status: ContactMomentStatus) {
  return status === "afgesloten" || status === "geannuleerd" || status === "niet_uitgevoerd";
}

function assertValidContactMomentTransition(previous: ContactMomentStatus | undefined, next: ContactMomentStatus) {
  if (!previous) return;
  const allowed: Record<ContactMomentStatus, ContactMomentStatus[]> = {
    concept: ["concept", "gepland", "wacht_op_vt_input", "geannuleerd", "niet_uitgevoerd"],
    wacht_op_vt_input: ["wacht_op_vt_input", "gepland", "geannuleerd", "niet_uitgevoerd"],
    gepland: ["gepland", "in_uitvoering", "afgesloten", "geannuleerd", "niet_uitgevoerd"],
    in_uitvoering: ["in_uitvoering", "afgesloten", "geannuleerd", "niet_uitgevoerd"],
    afgesloten: ["afgesloten"],
    geannuleerd: ["geannuleerd"],
    niet_uitgevoerd: ["niet_uitgevoerd"],
  };
  if (!allowed[previous].includes(next)) {
    throw new Error("Deze statusovergang is niet toegestaan voor een contactmoment.");
  }
}

function assertValidContactMomentPlanning(input: ContactMomentInput, previous?: ContactMoment) {
  const plannedDate = input.plannedDate ?? previous?.plannedDate;
  const startTime = input.startTime ?? previous?.startTime;
  const endTime = input.endTime ?? previous?.endTime;
  if (!plannedDate && !startTime && !endTime) return;
  if (!plannedDate || Number.isNaN(new Date(`${plannedDate}T12:00:00`).getTime())) {
    throw new Error("Kies een geldige datum voor het contactmoment.");
  }
  if (!startTime || !endTime || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new Error("Kies een geldig begin- en einduur.");
  }
  if (endTime <= startTime) {
    throw new Error("Het einduur moet later zijn dan het beginuur.");
  }
}

function isSameFinalContactMomentSave(previous: ContactMoment, input: ContactMomentInput, status: ContactMomentStatus) {
  return previous.status === status &&
    previous.representativeId === input.representativeId &&
    previous.reason === input.reason &&
    previous.reportHtml === sanitizeRichText(input.reportHtml ?? previous.reportHtml ?? "") &&
    (previous.closedReason ?? "") === (input.closedReason ?? previous.closedReason ?? "");
}

function buildContactMomentSnapshot(
  id: string,
  representative: Representative,
  input: ContactMomentInput,
  actionPoints: WorkflowActionPoint[],
  reportHtml: string,
  sharedAt: string | undefined,
  sharedById: string
) {
  return JSON.stringify({
    id,
    representative: {
      id: representative.id,
      firstName: representative.firstName,
      lastName: representative.lastName,
      country: representative.country,
      teamId: representative.teamId,
    },
    planning: {
      plannedDate: input.plannedDate,
      startTime: input.startTime,
      endTime: input.endTime,
      subject: input.subject,
      contactType: input.contactType,
      location: input.location,
    },
    reportHtml,
    actionPoints: actionPoints.map((action) => ({
      id: action.id,
      title: action.title,
      type: action.type,
      due: action.due,
      status: action.status,
      priority: action.priority,
      description: action.description,
    })),
    sharedAt,
    sharedById,
  });
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
