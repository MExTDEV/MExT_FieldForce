export type Role =
  | "REPRESENTATIVE"
  | "SALES_LEADER"
  | "SERVICE_OPERATOR"
  | "COUNTRY_MANAGER"
  | "GROUP_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type Country = "BE" | "NL" | "DE";
export type Language = "nl" | "fr" | "de";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  country: Country;
  language: Language;
  teamId?: string;
  representativeId?: string;
};

export type FieldForcePermissionKey =
  | "moduleDashboard"
  | "moduleAgenda"
  | "modulePreparation"
  | "moduleVisitRecord"
  | "moduleMyTeam"
  | "moduleReporting"
  | "modulePdfExport"
  | "moduleUserManagement"
  | "moduleTechnicalManagement"
  | "performanceView"
  | "performanceCompare"
  | "performanceScoresView"
  | "performanceScoresExport"
  | "performanceScoresManage"
  | "usersView"
  | "usersCreate"
  | "usersEdit"
  | "usersDeactivate"
  | "usersRolesEdit"
  | "usersPermissionsEdit"
  | "reportingOwn"
  | "reportingTeam"
  | "reportingAll"
  | "reportingExport"
  | "technicalTables"
  | "technicalParameters"
  | "technicalBranding"
  | "technicalImportExport";

export type AppModuleCode =
  | "PLANNING"
  | "BEGELEIDINGEN"
  | "CONTACTMOMENTEN"
  | "RETRAININGEN"
  | "SALESTRAININGEN"
  | "HULPAANVRAGEN"
  | "ACTIEPUNTEN"
  | "RAPPORTERING";

export type AppModuleConfig = {
  id: string;
  code: AppModuleCode;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CoachingFrameworkFocus = {
  id: string;
  code: string;
  name: string;
  color: string;
  criteria: string[];
};

export type FieldForceConfiguration = {
  coachingFramework: CoachingFrameworkFocus[];
  kpiDefinitions: string[];
};

export type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  language: Language;
  country: Country;
  teamId: string;
  teamName: string;
  role: Role;
  teamSupervisor: boolean;
  branchNumber: string;
  active: boolean;
  avatarUrl: string;
  permissions: Record<FieldForcePermissionKey, boolean>;
  representativeId?: string;
};

export type Representative = {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  country: Country;
  team: string;
  teamId: string;
  level: "Starter" | "Vertegenwoordiger" | "Professional" | "Expert";
  levelColor: string;
  lastCoaching: string;
  openActions: number;
  email: string;
  phone: string;
  kpis: { label: string; value: string; target: string; trend: number }[];
};

export type InterventionKind =
  | "begeleiding"
  | "contactmoment"
  | "retraining"
  | "sales_training"
  | "hulpaanvraag";

export type Status =
  | "concept"
  | "gepland"
  | "in_uitvoering"
  | "gesloten"
  | "gefinaliseerd"
  | "wacht_op_vt"
  | "wacht_op_akkoord"
  | "afgesloten"
  | "geannuleerd";

export type ScoreValue = 100 | 75 | 50 | 25 | 0 | "NVT";
export type ReflectionStatus = "niet_gestart" | "ingediend";
export type ApprovalStatus = "gelezen_akkoord" | "gelezen_niet_akkoord";
export type ContactMomentStatus =
  | "concept"
  | "wacht_op_vt_input"
  | "gepland"
  | "in_uitvoering"
  | "afgesloten";
export type HelpRequestStatus =
  | "nieuw"
  | "in_behandeling"
  | "vervolgactie_gepland"
  | "afgesloten"
  | "geannuleerd";
export type HelpUrgency = "laag" | "normaal" | "hoog";
export type TrainingStatus =
  | "concept"
  | "gepland"
  | "in_uitvoering"
  | "afgerond"
  | "geannuleerd";
export type FollowUpType =
  | "begeleiding"
  | "contactmoment"
  | "retraining"
  | "sales_training"
  | "enkel_opvolging"
  | "geen_actie";

export type WorkflowScore = {
  criterion: string;
  focus: string;
  value: ScoreValue;
  previousScore?: number;
  criterionId?: string;
  criterionKind?: "fixed" | "personal";
  description?: string;
};

export type PersonalCoachingCriterion = {
  id: string;
  title: string;
  description: string;
  focusName: string;
  representativeId: string;
  createdByUserId: string;
  teamId: string;
  country: Country;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowActionPoint = {
  id: string;
  title: string;
  type: "kpi" | "vaardigheid" | "gedrag";
  due: string;
  status: "open" | "nieuw" | "in_uitvoering" | "afgerond" | "behaald" | "niet_behaald" | "geannuleerd";
  owner?: string;
  priority?: "laag" | "normaal" | "hoog";
};

export type CoachingSimpleScore = {
  criterion: string;
  score: 0 | 1 | 2 | 3 | 4 | 5 | "nvt";
  comment: string;
};

export type CoachingAppointment = {
  id: string;
  customer: string;
  customerNumber?: string;
  place?: string;
  relationType: "prospect" | "klant";
  appointmentType: "vast" | "rood";
  arrivalTime: string;
  departureTime: string;
  activity: string;
  scores: CoachingSimpleScore[];
  remarks: string;
  isDeleted?: boolean;
};

export type CoachingDossier = {
  arrivalTime: string;
  departureTime: string;
  kilometers: string;
  area: string;
  sector: string;
  groupAttentionPoints: string[];
  individualAttentionPoint: string;
  generalScores: CoachingSimpleScore[];
  personalityScores: CoachingSimpleScore[];
};

export type AuditEntry = {
  id: string;
  at: string;
  userId: string;
  action: string;
  summary: string;
};

export type CoachingIntervention = {
  id: string;
  representativeId: string;
  initiatorId: string;
  ownerId: string;
  country: Country;
  teamId: string;
  title: string;
  status: Status;
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  deletedAt?: string;
  focusNames: string[];
  scores: WorkflowScore[];
  actionPoints: WorkflowActionPoint[];
  dossier?: CoachingDossier;
  appointments?: CoachingAppointment[];
  auditTrail?: AuditEntry[];
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
};

export type WorkflowReflection = {
  id: string;
  interventionId: string;
  representativeId: string;
  status: ReflectionStatus;
  learnedText: string;
  workOnText: string;
  concreteGoalText: string;
  createdAt: string;
  submittedAt?: string;
};

export type WorkflowApproval = {
  id: string;
  interventionId: string;
  representativeId: string;
  status?: ApprovalStatus;
  comment: string;
  createdAt: string;
  confirmedAt?: string;
};

export type ContactMoment = {
  id: string;
  representativeId: string;
  initiatorId: string;
  ownerId: string;
  country: Country;
  teamId: string;
  status: ContactMomentStatus;
  reason: string;
  reportedProblems: string;
  leaderThemes: string[];
  representativeKpis: string[];
  representativeThemes: string[];
  discussedThemes: string[];
  conclusion: string;
  actionPoints: WorkflowActionPoint[];
  sourceHelpRequestId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Retraining = {
  id: string;
  representativeId: string;
  initiatorId: string;
  country: Country;
  teamId: string;
  theme: string;
  reason: string;
  desiredImprovement: string;
  kpi?: string;
  frameworkPhase?: string;
  date: string;
  trainer: string;
  result: string;
  actionPoints: WorkflowActionPoint[];
  status: TrainingStatus;
  sourceHelpRequestId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type AssignedWorkflowActionPoint = WorkflowActionPoint & {
  representativeIds: string[];
  scope: "individual" | "group";
};

export type SalesTraining = {
  id: string;
  initiatorId: string;
  country: Country;
  theme: string;
  reason: string;
  targetAudience: string;
  participantIds: string[];
  kpi?: string;
  frameworkPhase?: string;
  date: string;
  trainer: string;
  conclusion: string;
  followUpAction: string;
  createIndividualActions: boolean;
  createGroupAction: boolean;
  actionDue: string;
  actionPoints: AssignedWorkflowActionPoint[];
  status: TrainingStatus;
  sourceHelpRequestId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type HelpRequest = {
  id: string;
  requesterId: string;
  representativeId: string;
  country: Country;
  teamId: string;
  subject: string;
  difficulty: string;
  desiredResult: string;
  urgency: HelpUrgency;
  explanation: string;
  status: HelpRequestStatus;
  followUpType?: FollowUpType;
  linkedInterventionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type LinkedIntervention = {
  id: string;
  representativeId: string;
  country: Country;
  teamId: string;
  type: Exclude<FollowUpType, "contactmoment" | "enkel_opvolging" | "geen_actie">;
  title: string;
  status: "gepland";
  sourceHelpRequestId: string;
  createdAt: string;
};

export type WorkflowState = {
  interventions: CoachingIntervention[];
  reflections: WorkflowReflection[];
  approvals: WorkflowApproval[];
  contactMoments: ContactMoment[];
  helpRequests: HelpRequest[];
  linkedInterventions: LinkedIntervention[];
  retrainings: Retraining[];
  salesTrainings: SalesTraining[];
};
