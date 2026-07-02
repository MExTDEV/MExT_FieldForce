import { getVisibleRepresentatives } from "@/lib/data-access";
import { emptyPerformanceDataset, type PerformanceDataset } from "@/lib/performance-data";
import type {
  Country,
  InterventionKind,
  MockUser,
  ManagedUser,
  Representative,
  WorkflowActionPoint,
  WorkflowState,
} from "@/lib/types";

export type ReportingLeader = {
  id: string;
  name: string;
  country: Country;
  teamIds: string[];
};

export function reportingLeaders(users: ManagedUser[]): ReportingLeader[] {
  return users
    .filter((user) => user.active && user.role === "SALES_LEADER")
    .map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      country: user.country,
      teamIds: user.teamId ? [user.teamId] : [],
    }));
}

export type ReportingIntervention = {
  id: string;
  type: InterventionKind;
  status: string;
  title: string;
  representativeIds: string[];
  country: Country;
  teamIds: string[];
  initiatorId: string;
  ownerId: string;
  date: string;
  actionCount: number;
  approvalStatus?: string;
  finalizedAt?: string;
};

export type ReportingAction = {
  id: string;
  representativeId: string;
  title: string;
  type: WorkflowActionPoint["type"];
  linkedKpi: string;
  startValue: string;
  targetValue: string;
  currentValue: string;
  due: string;
  status: WorkflowActionPoint["status"];
  ownerId: string;
  updatedAt: string;
};

export type ReportingKpi = {
  representativeId: string;
  kpi: string;
  previousValue: string;
  currentValue: string;
  target: string;
  trend: number;
};

export type ReportingDataset = {
  representatives: Representative[];
  interventions: ReportingIntervention[];
  actions: ReportingAction[];
  kpis: ReportingKpi[];
};

export type ReportingFilters = {
  from: string;
  to: string;
  country: string;
  teamId: string;
  leaderId: string;
  level: string;
  interventionType: string;
  status: string;
};

export const emptyReportingFilters: ReportingFilters = {
  from: "",
  to: "",
  country: "",
  teamId: "",
  leaderId: "",
  level: "",
  interventionType: "",
  status: "",
};

function leaderForTeam(teamId: string, users: ManagedUser[]) {
  return reportingLeaders(users).find((leader) => leader.teamIds.includes(teamId));
}

function actionToReporting(
  action: WorkflowActionPoint,
  representativeId: string,
  ownerId: string,
  updatedAt: string,
  representatives: Representative[],
  linkedKpi = ""
): ReportingAction {
  const representative = representatives.find((item) => item.id === representativeId);
  const kpi = representative?.kpis.find((item) =>
    linkedKpi ? item.label === linkedKpi : action.title.toLowerCase().includes(item.label.toLowerCase())
  );
  return {
    id: action.id,
    representativeId,
    title: action.title,
    type: action.type,
    linkedKpi: linkedKpi || kpi?.label || "",
    startValue: kpi ? previousKpiValue(kpi.value, kpi.trend) : "-",
    targetValue: kpi?.target ?? "-",
    currentValue: kpi?.value ?? "-",
    due: action.due,
    status: action.status,
    ownerId,
    updatedAt,
  };
}

export function buildReportingDataset(
  state: WorkflowState,
  representatives: Representative[],
  performance: PerformanceDataset = emptyPerformanceDataset,
  users: ManagedUser[] = []
): ReportingDataset {
  const workflowInterventions: ReportingIntervention[] = [
    ...state.interventions.map((item) => ({
      id: item.id,
      type: "begeleiding" as const,
      status: item.status,
      title: item.title,
      representativeIds: [item.representativeId],
      country: item.country,
      teamIds: [item.teamId],
      initiatorId: item.initiatorId,
      ownerId: item.ownerId,
      date: item.plannedDate ?? item.updatedAt.slice(0, 10),
      actionCount: item.actionPoints.length,
      approvalStatus: state.approvals.find((approval) => approval.interventionId === item.id)?.status,
      finalizedAt: item.finalizedAt,
    })),
    ...state.contactMoments.map((item) => ({
      id: item.id,
      type: "contactmoment" as const,
      status: item.status,
      title: item.reason,
      representativeIds: [item.representativeId],
      country: item.country,
      teamIds: [item.teamId],
      initiatorId: item.initiatorId,
      ownerId: item.ownerId,
      date: item.updatedAt.slice(0, 10),
      actionCount: item.actionPoints.length,
    })),
    ...state.retrainings.map((item) => ({
      id: item.id,
      type: "retraining" as const,
      status: item.status,
      title: item.theme,
      representativeIds: [item.representativeId],
      country: item.country,
      teamIds: [item.teamId],
      initiatorId: item.initiatorId,
      ownerId: item.initiatorId,
      date: item.date || item.updatedAt.slice(0, 10),
      actionCount: item.actionPoints.length,
      finalizedAt: item.completedAt,
    })),
    ...state.salesTrainings.map((item) => ({
      id: item.id,
      type: "sales_training" as const,
      status: item.status,
      title: item.theme,
      representativeIds: item.participantIds,
      country: item.country,
      teamIds: [...new Set(item.participantIds.map((id) => representatives.find((person) => person.id === id)?.teamId).filter(Boolean))] as string[],
      initiatorId: item.initiatorId,
      ownerId: item.initiatorId,
      date: item.date || item.updatedAt.slice(0, 10),
      actionCount: item.actionPoints.length,
      finalizedAt: item.completedAt,
    })),
    ...state.helpRequests.map((item) => ({
      id: item.id,
      type: "hulpaanvraag" as const,
      status: item.status,
      title: item.subject,
      representativeIds: [item.representativeId],
      country: item.country,
      teamIds: [item.teamId],
      initiatorId: item.requesterId,
      ownerId: leaderForTeam(item.teamId, users)?.id ?? item.requesterId,
      date: item.updatedAt.slice(0, 10),
      actionCount: 0,
    })),
  ];

  const historicalInterventions: ReportingIntervention[] = [
    ...performance.historicalCoachings.flatMap((item) => {
      const representative = representatives.find((person) => person.id === item.representativeId);
      if (!representative) return [];
      return [{
        id: item.id,
        type: "begeleiding" as const,
        status: item.status,
        title: `Historische begeleiding ${representative.firstName} ${representative.lastName}`,
        representativeIds: [item.representativeId],
        country: representative.country,
        teamIds: [representative.teamId],
        initiatorId: item.ownerId,
        ownerId: item.ownerId,
        date: item.date,
        actionCount: 0,
        finalizedAt: `${item.date}T16:00:00.000Z`,
      }];
    }),
    ...performance.historicalContactMoments.flatMap((item) => {
      const representative = representatives.find((person) => person.id === item.representativeId);
      if (!representative) return [];
      return [{
        id: item.id,
        type: "contactmoment" as const,
        status: item.status,
        title: item.reason,
        representativeIds: [item.representativeId],
        country: representative.country,
        teamIds: [representative.teamId],
        initiatorId: item.ownerId,
        ownerId: item.ownerId,
        date: item.date,
        actionCount: 0,
      }];
    }),
  ];
  const uniqueInterventions = new Map<string, ReportingIntervention>();
  for (const intervention of [...workflowInterventions, ...historicalInterventions]) {
    const key = `${intervention.type}:${intervention.id}`;
    if (!uniqueInterventions.has(key)) uniqueInterventions.set(key, intervention);
  }

  const workflowActions: ReportingAction[] = [
    ...state.interventions.flatMap((item) => item.actionPoints.map((action) =>
      actionToReporting(action, item.representativeId, item.ownerId, item.updatedAt, representatives)
    )),
    ...state.contactMoments.flatMap((item) => item.actionPoints.map((action) =>
      actionToReporting(action, item.representativeId, item.ownerId, item.updatedAt, representatives)
    )),
    ...state.retrainings.flatMap((item) => item.actionPoints.map((action) =>
      actionToReporting(action, item.representativeId, item.initiatorId, item.updatedAt, representatives, item.kpi)
    )),
    ...state.salesTrainings.flatMap((item) => item.actionPoints.flatMap((action) =>
      action.representativeIds.map((representativeId) =>
        actionToReporting(action, representativeId, item.initiatorId, item.updatedAt, representatives, item.kpi)
      )
    )),
  ];

  const performanceActions: ReportingAction[] = performance.historicalActionPoints.flatMap((action) => {
    const representative = representatives.find((person) => person.id === action.representativeId);
    if (!representative) return [];
    const linkedKpi = action.type === "kpi" ? representative.kpis[0]?.label ?? "" : "";
    return [{
      id: action.id,
      representativeId: action.representativeId,
      title: action.title,
      type: action.type,
      linkedKpi,
      startValue: linkedKpi ? previousKpiValue(representative.kpis[0].value, representative.kpis[0].trend) : "-",
      targetValue: linkedKpi ? representative.kpis[0].target : "-",
      currentValue: linkedKpi ? representative.kpis[0].value : "-",
      due: action.due,
      status: action.status === "achterstallig" ? "in_uitvoering" : action.status,
      ownerId: leaderForTeam(representative.teamId, users)?.id ?? "",
      updatedAt: action.updatedAt,
    }];
  });

  const kpis = representatives.flatMap((representative) => {
    const snapshots = performance.monthlyKpiSnapshots.filter((item) => item.representativeId === representative.id);
    const current = snapshots.at(-1);
    const previous = snapshots.at(-2);
    return current?.values.map((value) => {
      const previousValue = previous?.values.find((item) => item.label === value.label)?.value ?? value.value;
      return {
        representativeId: representative.id,
        kpi: value.label,
        previousValue: formatKpiValue(previousValue, value.unit),
        currentValue: formatKpiValue(value.value, value.unit),
        target: formatKpiValue(value.target, value.unit),
        trend: value.value > previousValue ? 1 : value.value < previousValue ? -1 : 0,
      };
    }) ?? [];
  });

  return {
    representatives,
    interventions: [...uniqueInterventions.values()],
    actions: [...workflowActions, ...performanceActions],
    kpis,
  };
}

export function scopedRepresentatives(
  user: MockUser,
  representatives: Representative[]
) {
  return getVisibleRepresentatives(user, representatives);
}

export function filterReportingDataset(
  dataset: ReportingDataset,
  scoped: Representative[],
  filters: ReportingFilters,
  users: ManagedUser[] = []
): ReportingDataset {
  const filteredRepresentatives = scoped.filter((item) =>
    (!filters.country || item.country === filters.country) &&
    (!filters.teamId || item.teamId === filters.teamId) &&
    (!filters.level || item.level === filters.level) &&
    (!filters.leaderId || leaderForTeam(item.teamId, users)?.id === filters.leaderId)
  );
  const ids = new Set(filteredRepresentatives.map((item) => item.id));
  const inPeriod = (date: string) =>
    (!filters.from || date >= filters.from) &&
    (!filters.to || date <= filters.to);
  const filteredInterventions = dataset.interventions.filter((item) =>
    item.representativeIds.some((id) => ids.has(id)) &&
    inPeriod(item.date) &&
    (!filters.interventionType || item.type === filters.interventionType) &&
    (!filters.status || item.status === filters.status)
  );
  const filteredActions = dataset.actions.filter((item) =>
    ids.has(item.representativeId) &&
    inPeriod(item.updatedAt.slice(0, 10)) &&
    (!filters.status || item.status === filters.status)
  );
  return {
    representatives: filteredRepresentatives,
    interventions: filteredInterventions,
    actions: filteredActions,
    kpis: dataset.kpis.filter((item) => ids.has(item.representativeId)),
  };
}

export function reportingLeaderForTeam(teamId: string, users: ManagedUser[] = []) {
  return leaderForTeam(teamId, users);
}

export function reportingUserName(id: string, users: ManagedUser[] = []) {
  return users.find((user) => user.id === id)
    ? `${users.find((user) => user.id === id)!.firstName} ${users.find((user) => user.id === id)!.lastName}`.trim()
    : reportingLeaders(users).find((leader) => leader.id === id)?.name ??
    "Onbekend";
}

export function isOverdue(due: string, status: string) {
  return Boolean(due) && due < new Date().toISOString().slice(0, 10) && !["behaald", "afgerond", "geannuleerd"].includes(status);
}

function previousKpiValue(current: string, trend: number) {
  const numeric = Number.parseFloat(current.replace(/[^\d.,-]/g, "").replace(",", "."));
  if (Number.isNaN(numeric)) return current;
  const previous = numeric - trend * Math.max(1, numeric * 0.03);
  const prefix = current.includes("EUR") || current.includes("€") ? "EUR " : "";
  const suffix = current.includes("%") ? "%" : "";
  return `${prefix}${previous.toLocaleString("nl-BE", { maximumFractionDigits: 1 })}${suffix}`;
}

function formatKpiValue(value: number, unit: "%" | "EUR" | "number") {
  if (unit === "%") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 1 })}%`;
  if (unit === "EUR") return `EUR ${value.toLocaleString("nl-BE", { maximumFractionDigits: 0 })}`;
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}
