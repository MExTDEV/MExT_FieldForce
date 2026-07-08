import type { ReportingDataset, ReportingIntervention } from "@/lib/reporting";
import { reportingLeaderForTeam } from "@/lib/reporting";
import type { ManagedUser, Representative, WorkflowState } from "@/lib/types";

export type RiskLevel = "green" | "orange" | "red";

export type CoachingRecommendation = {
  id: string;
  representativeId: string;
  title: string;
  reason: string;
  href: string;
  priority: RiskLevel;
};

export type RepresentativeCoachingInsight = {
  representative: Representative;
  risk: RiskLevel;
  score: number;
  reasons: string[];
  coachingDays: number;
  contactDays: number;
  openActionCount: number;
  overdueActionCount: number;
  negativeKpiCount: number;
  openHelpRequestCount: number;
  recommendations: CoachingRecommendation[];
};

export type TeamHeatmapRow = {
  teamId: string;
  team: string;
  country: string;
  leader: string;
  openActionCount: number;
  interventionCount: number;
  riskUserCount: number;
  notAgreedCount: number;
  risk: RiskLevel;
};

export type CoachingTrend = {
  label: string;
  count: number;
};

export type ManagementAlert = {
  id: string;
  category: "coaching" | "action" | "help" | "retraining";
  representativeId?: string;
  title: string;
  detail: string;
  href: string;
  severity: "orange" | "red";
};

export type SmartCoachingResult = {
  insights: RepresentativeCoachingInsight[];
  heatmap: TeamHeatmapRow[];
  trends: {
    workPoints: CoachingTrend[];
    focusPhases: CoachingTrend[];
    helpRequests: CoachingTrend[];
    retrainings: CoachingTrend[];
  };
  alerts: ManagementAlert[];
};

export function buildSmartCoaching(
  dataset: ReportingDataset,
  state: WorkflowState,
  referenceDate = currentDateKey(),
  users: ManagedUser[] = []
): SmartCoachingResult {
  const insights = dataset.representatives
    .map((representative) => analyzeRepresentative(representative, dataset, state, referenceDate))
    .sort((a, b) => b.score - a.score || a.representative.lastName.localeCompare(b.representative.lastName));

  return {
    insights,
    heatmap: buildTeamHeatmap(dataset, insights, users),
    trends: buildCoachingTrends(dataset, state),
    alerts: buildManagementAlerts(dataset, state, insights, referenceDate),
  };
}

export function analyzeRepresentative(
  representative: Representative,
  dataset: ReportingDataset,
  state: WorkflowState,
  referenceDate = currentDateKey()
): RepresentativeCoachingInsight {
  const actions = dataset.actions.filter((item) => item.representativeId === representative.id);
  const openActions = actions.filter((item) => isOpenActionStatus(item.status));
  const overdueActions = openActions.filter((item) => isActionOverdue(item.due, item.status, referenceDate));
  const kpis = dataset.kpis.filter((item) => item.representativeId === representative.id);
  const negativeKpis = kpis.filter((item) => item.trend < 0);
  const helpRequests = state.helpRequests.filter((item) =>
    item.representativeId === representative.id &&
    !["afgesloten", "geannuleerd"].includes(item.status)
  );
  const helpWithoutFollowUp = helpRequests.filter((item) => !item.followUpType);
  const coachingDays = daysSinceLatest(
    dataset.interventions.filter((item) =>
      item.type === "begeleiding" &&
      item.representativeIds.includes(representative.id) &&
      item.date <= referenceDate &&
      !["concept", "gepland"].includes(item.status)
    ),
    representative.lastCoaching,
    referenceDate
  );
  const contactDays = daysSinceLatest(
    dataset.interventions.filter((item) =>
      item.type === "contactmoment" &&
      item.representativeIds.includes(representative.id) &&
      item.date <= referenceDate
    ),
    "Nog niet",
    referenceDate
  );

  const reasons: string[] = [];
  let score = 0;
  let risk: RiskLevel = "green";

  if (coachingDays > 90) {
    risk = "red";
    score += 45;
    reasons.push(coachingDays >= 999
      ? "nog geen geregistreerde begeleiding"
      : `geen begeleiding sinds ${coachingDays} dagen`);
  } else if (coachingDays > 60) {
    risk = "orange";
    score += 25;
    reasons.push(`geen begeleiding sinds ${coachingDays} dagen`);
  }

  if (overdueActions.length > 3) {
    risk = "red";
    score += 40;
    reasons.push(`${overdueActions.length} achterstallige actiepunten`);
  } else if (overdueActions.length > 0) {
    if (risk === "green") risk = "orange";
    score += overdueActions.length * 12;
    reasons.push(`${overdueActions.length} achterstallige actiepunten`);
  }

  if (negativeKpis.length > 0) {
    risk = "red";
    score += 30 + negativeKpis.length * 4;
    reasons.push(`negatieve KPI-trend: ${negativeKpis.map((item) => item.kpi).join(", ")}`);
  }

  if (helpWithoutFollowUp.length > 0) {
    risk = "red";
    score += 35;
    reasons.push(`${helpWithoutFollowUp.length} hulpaanvraag zonder opvolging`);
  }

  if (openActions.length >= 4) {
    score += 10;
    reasons.push(`${openActions.length} open actiepunten`);
  }

  if (reasons.length === 0) reasons.push("alles op schema");

  return {
    representative,
    risk,
    score,
    reasons,
    coachingDays,
    contactDays,
    openActionCount: openActions.length,
    overdueActionCount: overdueActions.length,
    negativeKpiCount: negativeKpis.length,
    openHelpRequestCount: helpRequests.length,
    recommendations: buildRecommendations({
      representative,
      risk,
      coachingDays,
      contactDays,
      openActions,
      overdueActions,
      negativeKpis,
      helpWithoutFollowUp,
      dataset,
    }),
  };
}

function buildRecommendations({
  representative,
  risk,
  coachingDays,
  contactDays,
  openActions,
  overdueActions,
  negativeKpis,
  helpWithoutFollowUp,
  dataset,
}: {
  representative: Representative;
  risk: RiskLevel;
  coachingDays: number;
  contactDays: number;
  openActions: ReportingDataset["actions"];
  overdueActions: ReportingDataset["actions"];
  negativeKpis: ReportingDataset["kpis"];
  helpWithoutFollowUp: WorkflowState["helpRequests"];
  dataset: ReportingDataset;
}) {
  const recommendations: CoachingRecommendation[] = [];
  const add = (title: string, reason: string, href: string, priority: RiskLevel = risk) => {
    if (!recommendations.some((item) => item.title === title)) {
      recommendations.push({
        id: `${representative.id}-${recommendations.length + 1}`,
        representativeId: representative.id,
        title,
        reason,
        href,
        priority,
      });
    }
  };

  if (coachingDays > 60) {
    add(
      "Plan een nieuwe begeleiding",
      coachingDays >= 999
        ? "Er is nog geen geregistreerde begeleiding."
        : `De laatste begeleiding is ${coachingDays} dagen geleden.`,
      "/begeleidingen/nieuw",
      coachingDays > 90 ? "red" : "orange"
    );
  }
  if (helpWithoutFollowUp.length > 0) {
    add(
      "Plan een retraining",
      "Er staat een hulpaanvraag open zonder gekozen vervolgactie.",
      `/hulpaanvragen/${helpWithoutFollowUp[0].id}`,
      "red"
    );
  } else if (negativeKpis.length >= 2) {
    add(
      "Plan een retraining",
      `${negativeKpis.length} KPI's evolueren negatief.`,
      "/retrainingen/nieuw",
      "red"
    );
  }
  if (
    overdueActions.length > 0 ||
    openActions.length >= 4 ||
    (contactDays > 45 && openActions.length > 0) ||
    negativeKpis.length === 1
  ) {
    add(
      "Plan een contactmoment",
      overdueActions.length
        ? `${overdueActions.length} actiepunten zijn over deadline.`
        : negativeKpis.length === 1
          ? `${negativeKpis[0].kpi} evolueert negatief en vraagt gerichte opvolging.`
        : contactDays > 45
          ? contactDays >= 999
            ? "Er is nog geen geregistreerd contactmoment terwijl actiepunten openstaan."
            : `Er was ${contactDays} dagen geen contactmoment terwijl actiepunten openstaan.`
          : `${openActions.length} actiepunten vragen actieve opvolging.`,
      "/contactmomenten/nieuw",
      overdueActions.length > 3 ? "red" : "orange"
    );
  }

  const sourceText = [
    ...openActions.map((item) => item.title),
    ...dataset.interventions
      .filter((item) => item.representativeIds.includes(representative.id))
      .map((item) => item.title),
  ].join(" ").toLowerCase();
  if (/behoefte|open vragen|analyse/.test(sourceText)) {
    add("Focus op behoefteanalyse", "Recente werkpunten verwijzen naar vragen stellen en behoefteanalyse.", "/begeleidingen/nieuw", "orange");
  }
  if (/koppelverkoop|brede verkoop|cross.?sell/.test(sourceText)) {
    add("Focus op koppelverkoop", "Koppelverkoop komt terug in de open werkpunten.", "/begeleidingen/nieuw", "orange");
  }
  if (/afsluit|bezwaar|prijsverdediging|prijs verdedigen/.test(sourceText)) {
    add("Focus op afsluittechnieken", "Afsluiten of prijsverdediging vraagt extra aandacht.", "/begeleidingen/nieuw", "orange");
  }
  if (recommendations.length === 0) {
    add("Blijf de huidige aanpak opvolgen", "Er zijn geen urgente afwijkingen binnen de huidige gegevens.", `/vertegenwoordigers/${representative.id}`, "green");
  }
  return recommendations.slice(0, 4);
}

function buildTeamHeatmap(
  dataset: ReportingDataset,
  insights: RepresentativeCoachingInsight[],
  users: ManagedUser[]
): TeamHeatmapRow[] {
  const teams = [...new Map(dataset.representatives.map((item) => [item.teamId, item.team])).entries()];
  return teams.map(([teamId, team]) => {
    const representatives = dataset.representatives.filter((item) => item.teamId === teamId);
    const ids = new Set(representatives.map((item) => item.id));
    const teamInsights = insights.filter((item) => ids.has(item.representative.id));
    const openActionCount = dataset.actions.filter((item) =>
      ids.has(item.representativeId) &&
      isOpenActionStatus(item.status)
    ).length;
    const interventionCount = dataset.interventions.filter((item) =>
      item.representativeIds.some((id) => ids.has(id))
    ).length;
    const riskUserCount = teamInsights.filter((item) => item.risk !== "green").length;
    const notAgreedCount = dataset.interventions.filter((item) =>
      item.approvalStatus === "gelezen_niet_akkoord" &&
      item.representativeIds.some((id) => ids.has(id))
    ).length;
    const risk = teamInsights.some((item) => item.risk === "red")
      ? "red"
      : teamInsights.some((item) => item.risk === "orange")
        ? "orange"
        : "green";
    return {
      teamId,
      team,
      country: representatives[0]?.country ?? "",
      leader: reportingLeaderForTeam(teamId, users)?.name ?? "Niet toegewezen",
      openActionCount,
      interventionCount,
      riskUserCount,
      notAgreedCount,
      risk,
    };
  });
}

function buildCoachingTrends(dataset: ReportingDataset, state: WorkflowState) {
  const representativeIds = new Set(dataset.representatives.map((item) => item.id));
  const interventionIds = new Set(dataset.interventions.map((item) => item.id));
  const workPoints = topCounts(dataset.actions.map((item) => classifyWorkPoint(item.title)));
  const focusPhases = topCounts(state.interventions
    .filter((item) => representativeIds.has(item.representativeId) || interventionIds.has(item.id))
    .flatMap((item) => item.focusNames));
  const helpRequests = topCounts(state.helpRequests
    .filter((item) => representativeIds.has(item.representativeId))
    .map((item) => classifyTheme(item.subject)));
  const retrainings = topCounts([
    ...state.retrainings
      .filter((item) => representativeIds.has(item.representativeId))
      .map((item) => classifyTheme(item.theme)),
    ...dataset.interventions.filter((item) => item.type === "retraining").map((item) => classifyTheme(item.title)),
  ]);
  return { workPoints, focusPhases, helpRequests, retrainings };
}

function buildManagementAlerts(
  dataset: ReportingDataset,
  state: WorkflowState,
  insights: RepresentativeCoachingInsight[],
  referenceDate: string
): ManagementAlert[] {
  const alerts: ManagementAlert[] = [];
  const representativeIds = new Set(dataset.representatives.map((item) => item.id));
  for (const insight of insights) {
    if (insight.coachingDays > 60) {
      alerts.push({
        id: `coaching-${insight.representative.id}`,
        category: "coaching",
        representativeId: insight.representative.id,
        title: `${insight.representative.firstName} ${insight.representative.lastName} zonder recente begeleiding`,
        detail: insight.coachingDays >= 999
          ? "Nog geen geregistreerde begeleiding."
          : `${insight.coachingDays} dagen sinds de laatste begeleiding.`,
        href: `/vertegenwoordigers/${insight.representative.id}`,
        severity: insight.coachingDays > 90 ? "red" : "orange",
      });
    }
  }
  for (const action of dataset.actions.filter((item) =>
    isActionOverdue(item.due, item.status, referenceDate)
  )) {
    alerts.push({
      id: `action-${action.id}-${action.representativeId}`,
      category: "action",
      representativeId: action.representativeId,
      title: "Actiepunt verlopen",
      detail: `${action.title} · deadline ${formatDate(action.due)}.`,
      href: "/actiepunten",
      severity: "orange",
    });
  }
  for (const request of state.helpRequests.filter((item) =>
    representativeIds.has(item.representativeId) &&
    !item.followUpType && !["afgesloten", "geannuleerd"].includes(item.status)
  )) {
    alerts.push({
      id: `help-${request.id}`,
      category: "help",
      representativeId: request.representativeId,
      title: "Hulpaanvraag zonder eigenaar",
      detail: request.subject,
      href: `/hulpaanvragen/${request.id}`,
      severity: "red",
    });
  }
  for (const retraining of state.retrainings.filter((item) =>
    representativeIds.has(item.representativeId) &&
    item.status === "afgerond" && item.actionPoints.length === 0
  )) {
    alerts.push({
      id: `retraining-${retraining.id}`,
      category: "retraining",
      representativeId: retraining.representativeId,
      title: "Retraining zonder opvolging",
      detail: retraining.theme,
      href: `/retrainingen/${retraining.id}`,
      severity: "orange",
    });
  }
  return alerts.sort((a, b) => Number(b.severity === "red") - Number(a.severity === "red"));
}

function daysSinceLatest(
  interventions: ReportingIntervention[],
  fallback: string,
  referenceDate: string
) {
  const latest = [...interventions].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  if (latest) return daysBetween(latest, referenceDate);
  if (fallback === "Nog niet") return 999;
  const parsed = fallback.match(/^(\d{1,2})\s+mei\s+2026$/);
  return parsed ? daysBetween(`2026-05-${parsed[1].padStart(2, "0")}`, referenceDate) : 999;
}

function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000
  ));
}

function isActionOverdue(due: string, status: string, referenceDate: string) {
  return Boolean(due) &&
    due < referenceDate &&
    isOpenActionStatus(status);
}

function isOpenActionStatus(status: string) {
  return !["afgerond", "behaald", "niet_behaald", "geannuleerd"].includes(status);
}

function currentDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function classifyWorkPoint(value: string) {
  const text = value.toLowerCase();
  if (/behoefte|open vragen|analyse/.test(text)) return "Behoefteanalyse";
  if (/koppelverkoop|brede verkoop/.test(text)) return "Koppelverkoop";
  if (/afsluit|bezwaar|prijs/.test(text)) return "Afsluittechnieken";
  if (/tablet|planning|organisatie/.test(text)) return "Werkorganisatie";
  return value.length > 42 ? `${value.slice(0, 39)}...` : value;
}

function classifyTheme(value: string) {
  return classifyWorkPoint(value.replace(/^(retraining|sales training):\s*/i, ""));
}

function topCounts(values: string[], limit = 5): CoachingTrend[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("nl-BE");
}
