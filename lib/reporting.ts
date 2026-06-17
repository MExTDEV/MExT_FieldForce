import { actionPoints, interventions, mockUsers, representatives } from "@/lib/mock-data";
import {
  historicalActionPoints,
  historicalCoachings,
  historicalContactMoments,
  monthlyKpiSnapshots,
} from "@/lib/performance-data";
import type {
  Country,
  InterventionKind,
  MockUser,
  Representative,
  WorkflowActionPoint,
  WorkflowState,
} from "@/lib/types";
import { getVisibleRepresentatives } from "@/lib/data-access";

export type ReportingLeader = {
  id: string;
  name: string;
  country: Country;
  teamIds: string[];
};

export const reportingLeaders: ReportingLeader[] = [
  { id: "user-leader-be", name: "Sophie Vermeulen", country: "BE", teamIds: ["be-1"] },
  { id: "leader-be-2", name: "Thomas Martens", country: "BE", teamIds: ["be-2", "be-3"] },
  { id: "leader-nl-1", name: "Eva De Vries", country: "NL", teamIds: ["nl-1", "nl-2", "nl-3"] },
  { id: "leader-de-1", name: "Felix Bauer", country: "DE", teamIds: ["de-1", "de-2"] },
  { id: "leader-de-2", name: "Nina Hoffmann", country: "DE", teamIds: ["de-3", "de-4"] },
];

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

function leaderForTeam(teamId: string) {
  return reportingLeaders.find((leader) => leader.teamIds.includes(teamId));
}

function ownerIdByName(name: string, teamId: string) {
  return mockUsers.find((user) => user.name === name)?.id ?? leaderForTeam(teamId)?.id ?? "user-super";
}

function isoDate(value: string) {
  if (value === "Vandaag") return "2026-06-11";
  const match = value.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (!match) return "2026-06-11";
  const months: Record<string, string> = {
    jan: "01", feb: "02", mrt: "03", apr: "04", mei: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", okt: "10", nov: "11", dec: "12",
  };
  return `${match[3]}-${months[match[2].toLowerCase()] ?? "01"}-${match[1].padStart(2, "0")}`;
}

function actionToReporting(
  action: WorkflowActionPoint,
  representativeId: string,
  ownerId: string,
  updatedAt: string,
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
    startValue: kpi ? previousKpiValue(kpi.value, kpi.trend) : "—",
    targetValue: kpi?.target ?? "—",
    currentValue: kpi?.value ?? "—",
    due: action.due,
    status: action.status,
    ownerId,
    updatedAt,
  };
}

export function buildReportingDataset(state: WorkflowState): ReportingDataset {
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
      date: item.updatedAt.slice(0, 10),
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
      ownerId: leaderForTeam(item.teamId)?.id ?? item.requesterId,
      date: item.updatedAt.slice(0, 10),
      actionCount: 0,
    })),
  ];

  const staticInterventions: ReportingIntervention[] = interventions.flatMap((item) => {
    const representative = representatives.find((person) => `${person.firstName} ${person.lastName}` === item.person);
    const participants = representative
      ? [representative]
      : representatives.filter((person) => person.team === item.person);
    if (participants.length === 0) return [];
    const type = item.type as InterventionKind;
    return [{
      id: `mock-${item.id}`,
      type,
      status: item.status,
      title: `${type.replaceAll("_", " ")} ${item.person}`,
      representativeIds: participants.map((person) => person.id),
      country: participants[0].country,
      teamIds: [...new Set(participants.map((person) => person.teamId))],
      initiatorId: ownerIdByName(item.owner, participants[0].teamId),
      ownerId: ownerIdByName(item.owner, participants[0].teamId),
      date: isoDate(item.date),
      actionCount: 0,
    }];
  });

  const historicalInterventions: ReportingIntervention[] = [
    ...historicalCoachings.map((item) => {
      const representative = representatives.find((person) => person.id === item.representativeId)!;
      return {
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
      };
    }),
    ...historicalContactMoments.map((item) => {
      const representative = representatives.find((person) => person.id === item.representativeId)!;
      return {
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
      };
    }),
  ];

  const workflowActions: ReportingAction[] = [
    ...state.interventions.flatMap((item) => item.actionPoints.map((action) =>
      actionToReporting(action, item.representativeId, item.ownerId, item.updatedAt)
    )),
    ...state.contactMoments.flatMap((item) => item.actionPoints.map((action) =>
      actionToReporting(action, item.representativeId, item.ownerId, item.updatedAt)
    )),
    ...state.retrainings.flatMap((item) => item.actionPoints.map((action) =>
      actionToReporting(action, item.representativeId, item.initiatorId, item.updatedAt, item.kpi)
    )),
    ...state.salesTrainings.flatMap((item) => item.actionPoints.flatMap((action) =>
      action.representativeIds.map((representativeId) =>
        actionToReporting(action, representativeId, item.initiatorId, item.updatedAt, item.kpi)
      )
    )),
  ];

  const staticActions: ReportingAction[] = actionPoints.flatMap((action) => {
    const representative = representatives.find((person) => `${person.firstName} ${person.lastName}` === action.person);
    if (!representative) return [];
    const linkedKpi = action.type === "kpi" ? representative.kpis[0]?.label ?? "" : "";
    return [{
      id: `mock-${action.id}`,
      representativeId: representative.id,
      title: action.title,
      type: action.type as WorkflowActionPoint["type"],
      linkedKpi,
      startValue: linkedKpi ? previousKpiValue(representative.kpis[0].value, representative.kpis[0].trend) : "—",
      targetValue: linkedKpi ? representative.kpis[0].target : "—",
      currentValue: linkedKpi ? representative.kpis[0].value : "—",
      due: isoDate(action.due),
      status: action.status as WorkflowActionPoint["status"],
      ownerId: leaderForTeam(representative.teamId)?.id ?? "user-super",
      updatedAt: "2026-06-10",
    }];
  });

  const seededActions: ReportingAction[] = historicalActionPoints.map((action) => {
    const representative = representatives.find((person) => person.id === action.representativeId)!;
    const linkedKpi = action.type === "kpi" ? representative.kpis[0]?.label ?? "" : "";
    return {
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
      ownerId: leaderForTeam(representative.teamId)?.id ?? "user-super",
      updatedAt: action.updatedAt,
    };
  });

  const kpis = representatives.flatMap((representative) => {
    const snapshots = monthlyKpiSnapshots.filter((item) => item.representativeId === representative.id);
    const current = snapshots.at(-1);
    const previous = snapshots.at(-2);
    return current?.values.map((value) => {
      const previousValue = previous?.values.find((item) => item.label === value.label)?.value ?? value.value;
      return {
        representativeId: representative.id,
        kpi: value.label,
        previousValue: formatSeedKpi(previousValue, value.unit),
        currentValue: formatSeedKpi(value.value, value.unit),
        target: formatSeedKpi(value.target, value.unit),
        trend: value.value > previousValue ? 1 : value.value < previousValue ? -1 : 0,
      };
    }) ?? [];
  });

  return {
    representatives,
    interventions: [...workflowInterventions, ...staticInterventions, ...historicalInterventions],
    actions: [...workflowActions, ...staticActions, ...seededActions],
    kpis,
  };
}

export function scopedRepresentatives(user: MockUser) {
  return getVisibleRepresentatives(user);
}

export function filterReportingDataset(
  dataset: ReportingDataset,
  scoped: Representative[],
  filters: ReportingFilters
): ReportingDataset {
  const filteredRepresentatives = scoped.filter((item) =>
    (!filters.country || item.country === filters.country) &&
    (!filters.teamId || item.teamId === filters.teamId) &&
    (!filters.level || item.level === filters.level) &&
    (!filters.leaderId || leaderForTeam(item.teamId)?.id === filters.leaderId)
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

export function reportingLeaderForTeam(teamId: string) {
  return leaderForTeam(teamId);
}

export function reportingUserName(id: string) {
  return mockUsers.find((user) => user.id === id)?.name ??
    reportingLeaders.find((leader) => leader.id === id)?.name ??
    "Onbekend";
}

export function isOverdue(due: string, status: string) {
  return Boolean(due) && due < "2026-06-11" && !["behaald", "geannuleerd"].includes(status);
}

function previousKpiValue(current: string, trend: number) {
  const numeric = Number.parseFloat(current.replace(/[^\d.,-]/g, "").replace(",", "."));
  if (Number.isNaN(numeric)) return current;
  const previous = numeric - trend * Math.max(1, numeric * 0.03);
  const prefix = current.includes("€") ? "€ " : "";
  const suffix = current.includes("%") ? "%" : "";
  return `${prefix}${previous.toLocaleString("nl-BE", { maximumFractionDigits: 1 })}${suffix}`;
}

function formatSeedKpi(value: number, unit: "%" | "EUR" | "number") {
  if (unit === "%") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 1 })}%`;
  if (unit === "EUR") return `€ ${value.toLocaleString("nl-BE", { maximumFractionDigits: 0 })}`;
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}
