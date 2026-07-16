export type Role =
  | "REPRESENTATIVE"
  | "SALES_LEADER"
  | "SALES_MANAGER"
  | "SERVICE_OPERATOR"
  | "COUNTRY_MANAGER"
  | "GROUP_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type Country = "BE" | "NL" | "DE";
export type Language = "nl" | "fr" | "de";
export type RepresentativeLevel =
  | "STARTER"
  | "SALES_EXECUTIVE"
  | "PROFESSIONAL"
  | "EXPERT";
export type KpiEvaluationDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "TARGET";
export type KpiUnit = "%" | "EUR" | "count" | "minutes" | "hours" | "km" | "number";
export type KpiValueType = "NUMBER" | "DECIMAL" | "CURRENCY" | "BOOLEAN" | "SCORE";
export type KpiTargetScope = "GLOBAL" | "COUNTRY" | "TEAM" | "USER" | "ROLE";
export type KpiPeriodType = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  country: Country;
  countryAccess?: Country[];
  language: Language;
  teamId?: string;
  representativeId?: string;
  permissions?: Partial<Record<FieldForcePermissionKey, boolean>>;
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
  | "actionPointsCreate"
  | "actionPointsManage"
  | "actionPointsClose"
  | "starterEvaluationsExecute"
  | "starterEvaluationsManage"
  | "kpisView"
  | "kpisCreate"
  | "kpisManage"
  | "kpiTargetsManage"
  | "kpiCategoriesManage"
  | "technicalTables"
  | "technicalParameters"
  | "technicalBranding"
  | "technicalImportExport"
  | "contractArticlesManage"
  | "contractImportsManage"
  | "contractModelsManage"
  | "menu.coaching.enabled"
  | "menu.coaching.dashboard"
  | "menu.coaching.planning"
  | "menu.coaching.coachings"
  | "menu.coaching.contacts"
  | "menu.coaching.retrainings"
  | "menu.coaching.trainings"
  | "menu.coaching.help"
  | "menu.coaching.starterEvaluations"
  | "menu.coaching.myTeam"
  | "menu.coaching.actionPoints"
  | "menu.coaching.reporting"
  | "menu.coaching.users"
  | "menu.coaching.teams"
  | "menu.coaching.modules"
  | "menu.coaching.roles"
  | "menu.coaching.kpis"
  | "menu.coaching.framework"
  | "menu.coaching.settings"
  | "menu.coaching.log"
  | "menu.salesday.enabled"
  | "menu.salesday.preparation"
  | "menu.salesday.agenda"
  | "menu.salesday.team"
  | "menu.salesday.stock"
  | "menu.pst.enabled"
  | "menu.pst.dashboard"
  | "menu.pst.planning"
  | "menu.pst.segments"
  | "menu.pst.routes"
  | "menu.pst.prospecting"
  | "menu.contract.enabled"
  | "menu.contract.open"
  | "menu.service.enabled"
  | "menu.service.myDay"
  | "menu.service.planning"
  | "menu.service.interventions";

export type AppModuleCode =
  | "PLANNING"
  | "BEGELEIDINGEN"
  | "CONTACTMOMENTEN"
  | "RETRAININGEN"
  | "SALESTRAININGEN"
  | "HULPAANVRAGEN"
  | "TUSSENTIJDSE_EVALUATIES"
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

export type ManagementTeam = {
  id: string;
  name: string;
  country: Country;
  primaryLeaderId: string | null;
  primaryLeaderName: string;
  active: boolean;
  memberCount: number;
};

export type ManagementKpi = {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryId: string | null;
  typeId: string | null;
  targetTypeId: string | null;
  country: Country | null;
  teamId: string | null;
  userId: string | null;
  targetRole: Role | null;
  unit: KpiUnit;
  targetValue: number;
  minValue: number | null;
  maxValue: number | null;
  weight: number | null;
  countsForReporting: boolean;
  countsForPerformanceCircle: boolean;
  includeInStarterEvaluations: boolean;
  sortOrder: number;
  validFrom: string;
  validUntil: string | null;
  evaluationDirection: KpiEvaluationDirection;
  active: boolean;
  targets: ManagementKpiTarget[];
};

export type ManagementKpiCategory = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

export type ManagementKpiType = {
  id: string;
  code: string;
  name: string;
  description: string;
  valueType: KpiValueType;
  isActive: boolean;
  sortOrder: number;
};

export type ManagementKpiTargetType = {
  id: string;
  code: KpiTargetScope;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

export type ManagementKpiTarget = {
  id: string;
  kpiDefinitionId: string;
  targetTypeId: string;
  scope: KpiTargetScope;
  scopeKey: string;
  country: Country | null;
  teamId: string | null;
  userId: string | null;
  role: Role | null;
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  active: boolean;
  conflict: boolean;
};

export type CriterionScopeType = "GLOBAL" | "COUNTRY" | "TEAM" | "USER";

export type ManagementCriterionScopeLink = {
  id: string;
  scopeType: CriterionScopeType;
  scopeKey: string;
  country: Country | null;
  teamId: string | null;
  teamName: string | null;
  userId: string | null;
  userName: string | null;
  sortOrder: number;
};

export type ManagementCriterion = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  scopeLinks: ManagementCriterionScopeLink[];
};

export type ManagementStarterEvaluationQuestionScopeLink = {
  id: string;
  scopeType: CriterionScopeType;
  scopeKey: string;
  country: Country | null;
  teamId: string | null;
  teamName: string | null;
  userId: string | null;
  userName: string | null;
  sortOrder: number;
};

export type ManagementStarterEvaluationQuestion = {
  id: string;
  key: string;
  sectionId: string;
  sectionTitle: string;
  textNl: string;
  helpNl: string;
  answerType: string;
  optionsJson: string;
  assignee: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  scopeLinks: ManagementStarterEvaluationQuestionScopeLink[];
};

export type ManagementFocus = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  criteria: ManagementCriterion[];
};

export type ManagementRole = {
  role: Role;
  label: string;
  userCount: number;
  active: boolean;
  permissions: Record<FieldForcePermissionKey, boolean>;
};

export type ManagementConfiguration = {
  teams: ManagementTeam[];
  kpis: ManagementKpi[];
  kpiCategories: ManagementKpiCategory[];
  kpiTypes: ManagementKpiType[];
  kpiTargetTypes: ManagementKpiTargetType[];
  focuses: ManagementFocus[];
  starterEvaluationQuestions: ManagementStarterEvaluationQuestion[];
  roles: ManagementRole[];
};

export type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  language: Language;
  country: Country;
  countryAccess: Country[];
  teamId: string;
  teamName: string;
  role: Role;
  representativeLevel: RepresentativeLevel;
  starterStartDate?: string;
  teamSupervisor: boolean;
  branchNumber: string;
  active: boolean;
  avatarUrl: string;
  profilePhotoSyncStatus?: "SYNCED" | "NO_PHOTO" | "SKIPPED" | "ERROR";
  profilePhotoSyncedAt?: string;
  profilePhotoSyncError?: string;
  permissions: Record<FieldForcePermissionKey, boolean>;
  representativeId?: string;
  microsoftLinked?: boolean;
  entraId?: string;
  microsoftEmail?: string;
  lastLoginAt?: string;
};

export type UserLoginSessionRecord = {
  id: string;
  sessionId: string;
  loginAt: string;
  logoutAt?: string | null;
  lastActivityAt: string;
  expiresAt: string;
  durationSeconds: number;
  provider: string;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  operatingSystem?: string | null;
  deviceType?: string | null;
  status: "active" | "logged-out" | "expired";
};

export type UserLoginSessionPage = {
  sessions: UserLoginSessionRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type Representative = {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  country: Country;
  team: string;
  teamId: string;
  representativeLevel?: RepresentativeLevel;
  level: "Starter" | "Sales Executive" | "Vertegenwoordiger" | "Professional" | "Expert";
  levelColor: string;
  lastCoaching: string;
  openActions: number;
  email: string;
  phone: string;
  kpis: { label: string; value: string; target: string; trend: number }[];
};

export type CoachingParticipant = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: "REPRESENTATIVE" | "SALES_LEADER";
  representativeLevel?: RepresentativeLevel;
  country: Country;
  teamId: string;
  team: string;
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
  | "voltooid"
  | "verzonden_ter_akkoord"
  | "akkoord_door_vertegenwoordiger"
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
  | "afgesloten"
  | "geannuleerd"
  | "niet_uitgevoerd";
export type HelpRequestStatus =
  | "nieuw"
  | "open"
  | "in_behandeling"
  | "vervolgactie_gepland"
  | "begeleiding"
  | "contactmoment"
  | "retraining"
  | "salestraining"
  | "gesloten"
  | "ingetrokken"
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
  description?: string;
  tipsAndTricks?: string;
  targetValue?: number;
  achievedScore?: number;
  definitionId?: string;
  isNew?: boolean;
  reviewStatus?: "proposed" | "approved" | "rejected" | "active";
  originalTitle?: string;
  originalDescription?: string;
  originalTipsAndTricks?: string;
  rejectionReason?: string;
  reviewComment?: string;
  reviewedById?: string;
  reviewedAt?: string;
  activatedAt?: string;
  closedAt?: string;
  closedByUserId?: string;
};

export type ScopedActionDefinition = {
  id: string;
  title: string;
  description: string;
  tipsAndTricks: string;
  targetTypeId?: string;
  targetTypeCode?: "GLOBAL" | "COUNTRY" | "TEAM" | "USER";
  targetValue?: number;
  priority: "laag" | "normaal" | "hoog";
  scope: "GLOBAL" | "COUNTRY" | "TEAM" | "USER";
  scopeKey: string;
  country?: Country;
  teamId?: string;
  userId?: string;
  productIds?: string[];
  products?: ActionPointProductOption[];
  createdById?: string;
  updatedById?: string;
  active: boolean;
  validFrom: string;
  validUntil?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ActionPointTargetTypeOption = {
  id: string;
  code: ScopedActionDefinition["scope"];
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
};

export type ActionPointProductOption = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type CoachingSimpleScore = {
  criterion: string;
  score: 0 | 1 | 2 | 3 | 4 | 5 | "nvt";
  comment: string;
  previousScore?: number;
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
  userName?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
};

export type CoachingIntervention = {
  id: string;
  representativeId: string;
  initiatorId: string;
  ownerId: string;
  country: Country;
  teamId: string;
  title: string;
  subject?: CoachingParticipant;
  status: Status;
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  notifyCoachedRepresentative?: boolean;
  notifyCoachedTeamLeaders?: boolean;
  notifyExecutorTeamLeaders?: boolean;
  peerCoach?: boolean;
  teamDeviation?: boolean;
  countryDeviation?: boolean;
  deviationReason?: string;
  deviationRecordedById?: string;
  deviationRecordedAt?: string;
  actualStartedAt?: string;
  executionDeadlineAt?: string;
  approvalDeadlineAt?: string;
  finalApprovalDeadlineAt?: string;
  performerAccessExpiresAt?: string;
  lateCompletion?: boolean;
  lateCompletionReason?: string;
  administrativelyClosedAt?: string;
  administrativelyClosedById?: string;
  administrativeCloseReason?: string;
  copiedFromInterventionId?: string;
  historicAccessSettings?: string;
  deletedAt?: string;
  outlookEventId?: string;
  outlookICalUId?: string;
  outlookSyncStatus: "NOT_SYNCED" | "SYNCED" | "ERROR";
  lastSyncedAt?: string;
  syncError?: string;
  internalNotes?: string;
  focusNames: string[];
  scores: WorkflowScore[];
  actionPoints: WorkflowActionPoint[];
  dossier?: CoachingDossier;
  appointments?: CoachingAppointment[];
  auditTrail?: AuditEntry[];
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  sentForApprovalAt?: string;
  sentForApprovalById?: string;
  approvedByRepAt?: string;
  approvedByRepId?: string;
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
  reflectionKpiHtml?: string;
  reflectionLearningHtml?: string;
  reflectionGoalHtml?: string;
  reflectionCompletedAt?: string;
  reflectionCompletedByUserId?: string;
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
  plannedDate?: string;
  startTime?: string;
  endTime?: string;
  notifyRepresentative?: boolean;
  subject?: string;
  contactType?: string;
  location?: string;
  internalNotes?: string;
  outlookEventId?: string;
  outlookICalUId?: string;
  outlookSyncStatus?: "NOT_SYNCED" | "SYNCED" | "ERROR";
  lastSyncedAt?: string;
  syncError?: string;
  reason: string;
  reportedProblems: string;
  leaderThemes: string[];
  representativeKpis: string[];
  representativeThemes: string[];
  discussedThemes: string[];
  conclusion: string;
  reportHtml?: string;
  actionPoints: WorkflowActionPoint[];
  finalSnapshot?: string;
  sharedAt?: string;
  sharedById?: string;
  closedReason?: string;
  closedAt?: string;
  closedById?: string;
  previousStatus?: ContactMomentStatus;
  sourceHelpRequestId?: string;
  photos?: ContactMomentPhoto[];
  createdAt: string;
  updatedAt: string;
};

export type ContactMomentPhoto = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  uploadedAt: string;
  sortOrder: number;
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
  responsibleUserId?: string;
  country: Country;
  teamId: string;
  subject: string;
  descriptionHtml?: string;
  descriptionText?: string;
  difficulty: string;
  desiredResult: string;
  urgency: HelpUrgency;
  explanation: string;
  status: HelpRequestStatus;
  firstHandledAt?: string;
  firstHandledByUserId?: string;
  withdrawnAt?: string;
  withdrawnByUserId?: string;
  answers?: HelpRequestAnswer[];
  followUpType?: FollowUpType;
  linkedInterventionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type HelpRequestAnswer = {
  id: string;
  helpRequestId: string;
  authorId: string;
  bodyHtml: string;
  bodyText: string;
  closesRequest: boolean;
  createdAt: string;
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
