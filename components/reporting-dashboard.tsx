"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  ClipboardCheck,
  Clock3,
  Filter,
  GraduationCap,
  CircleHelp,
  MessageSquareText,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { usePerformance } from "@/components/performance-provider";
import { useRepresentatives } from "@/components/representatives-provider";
import { EmptyState, PageHeader, StatusBadge, Trend } from "@/components/ui";
import { useWorkflow } from "@/components/workflow-provider";
import { SmartReportingSections } from "@/components/smart-coaching-dashboard";
import {
  buildReportingDataset,
  emptyReportingFilters,
  filterReportingDataset,
  isOverdue,
  reportingLeaderForTeam,
  reportingLeaders,
  reportingUserName,
  scopedRepresentatives,
  type ReportingAction,
  type ReportingDataset,
  type ReportingFilters,
  type ReportingIntervention,
} from "@/lib/reporting";
import { canViewTeamDashboard } from "@/lib/permissions";
import { buildSmartCoaching } from "@/lib/smart-coaching";
import type { Representative } from "@/lib/types";
import { translate, type TranslationKey } from "@/lib/i18n";

type ReportSection =
  | "overzicht"
  | "verkoopleiders"
  | "teams"
  | "vertegenwoordigers"
  | "actiepunten"
  | "interventies"
  | "kpi-evolutie";

const reportLinks: { section: ReportSection; key: TranslationKey }[] = [
  { section: "overzicht", key: "coaching.reporting.overview" },
  { section: "verkoopleiders", key: "coaching.reporting.leaders" },
  { section: "teams", key: "coaching.reporting.teams" },
  { section: "vertegenwoordigers", key: "coaching.reporting.representatives" },
  { section: "actiepunten", key: "coaching.reporting.actions" },
  { section: "interventies", key: "coaching.reporting.interventions" },
  { section: "kpi-evolutie", key: "coaching.reporting.kpiEvolution" },
];

const helpRequestHandledStatuses = new Set([
  "begeleiding",
  "contactmoment",
  "retraining",
  "salestraining",
  "gesloten",
  "afgesloten",
  "vervolgactie_gepland",
]);
const helpRequestOpenStatuses = new Set(["open", "nieuw", "in_behandeling"]);
const helpRequestTerminalStatuses = new Set(["gesloten", "ingetrokken", "afgesloten", "geannuleerd"]);

export function ReportingDashboard({ section = "overzicht" }: { section?: string }) {
  const { user, managedUsers, language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const { state } = useWorkflow();
  const { representatives } = useRepresentatives();
  const { dataset: performanceDataset, error: performanceError } = usePerformance();
  const [filters, setFilters] = useState<ReportingFilters>(emptyReportingFilters);
  const normalizedSection = reportLinks.some((item) => item.section === section)
    ? section as ReportSection
    : "overzicht";
  const dataset = useMemo(
    () => buildReportingDataset(state, representatives, performanceDataset, managedUsers),
    [managedUsers, performanceDataset, representatives, state]
  );
  const scope = useMemo(() => scopedRepresentatives(user, representatives), [representatives, user]);
  const filtered = useMemo(
    () => filterReportingDataset(dataset, scope, filters, managedUsers),
    [dataset, filters, managedUsers, scope]
  );
  const smartResult = useMemo(
    () => buildSmartCoaching(filtered, state, undefined, managedUsers),
    [filtered, managedUsers, state]
  );

  if (user.role === "REPRESENTATIVE") {
    return <PersonalReporting dataset={filtered} representative={scope[0]} />;
  }
  if (!canViewTeamDashboard(user)) {
    return <EmptyState title={t("coaching.reporting.accessTitle")} description={t("coaching.reporting.accessDescription")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("coaching.reporting.managementInsight")}
        title={t("coaching.reporting.title")}
        description={t("coaching.reporting.description")}
        actions={(
          <button type="button" className="btn-secondary" title={t("coaching.reporting.exportTitle")}>
            <BarChart3 className="h-4 w-4" /> {t("coaching.reporting.exportPreparing")}
          </button>
        )}
      />
      <ReportNavigation active={normalizedSection} />
      {performanceError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{performanceError}</p>}
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        scope={scope}
        userRole={user.role}
      />
      {normalizedSection === "overzicht" && (
        <>
          <SmartReportingSections result={smartResult} />
          <OverviewReport dataset={filtered} state={state} />
        </>
      )}
      {normalizedSection === "verkoopleiders" && <LeaderReport dataset={filtered} />}
      {normalizedSection === "teams" && <TeamReport dataset={filtered} />}
      {normalizedSection === "vertegenwoordigers" && <RepresentativeReport dataset={filtered} state={state} />}
      {normalizedSection === "actiepunten" && <ActionReport dataset={filtered} />}
      {normalizedSection === "interventies" && <InterventionReport dataset={filtered} />}
      {normalizedSection === "kpi-evolutie" && <KpiReport dataset={filtered} />}
    </div>
  );
}

function ReportNavigation({ active }: { active: ReportSection }) {
  const { language } = useSession();
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {reportLinks.map((item) => (
        <Link
          key={item.section}
          href={item.section === "overzicht" ? "/rapportering" : `/rapportering/${item.section}`}
          className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            active === item.section
              ? "bg-brand-700 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200"
          }`}
        >
          {translate(language, item.key)}
        </Link>
      ))}
    </nav>
  );
}

function ReportFilterBar({
  filters,
  onChange,
  scope,
  userRole,
}: {
  filters: ReportingFilters;
  onChange: (filters: ReportingFilters) => void;
  scope: Representative[];
  userRole: string;
}) {
  const { managedUsers } = useSession();
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const countries = [...new Set(scope.map((item) => item.country))];
  const teams = [...new Map(
    scope
      .filter((item) => !filters.country || item.country === filters.country)
      .map((item) => [item.teamId, item.team])
  ).entries()];
  const leaders = reportingLeaders(managedUsers).filter((leader) =>
    scope.some((representative) => leader.teamIds.includes(representative.teamId))
  );
  const levels = [...new Set(scope.map((item) => item.level))];

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-brand-700" />
          <h2 className="text-sm font-bold text-slate-950">{t("coaching.reporting.filters")}</h2>
        </div>
        <button
          type="button"
          onClick={() => onChange(emptyReportingFilters)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <X className="h-4 w-4" /> {t("coaching.reporting.clear")}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <FilterField label={t("coaching.reporting.from")}>
          <input type="date" className="field" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} />
        </FilterField>
        <FilterField label={t("coaching.reporting.to")}>
          <input type="date" className="field" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} />
        </FilterField>
        <FilterField label={t("coaching.reporting.country")}>
          <select className="field" value={filters.country} onChange={(event) => onChange({ ...filters, country: event.target.value, teamId: "" })}>
            <option value="">{t("coaching.reporting.allCountries")}</option>
            {countries.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("coaching.reporting.team")}>
          <select className="field" value={filters.teamId} onChange={(event) => onChange({ ...filters, teamId: event.target.value })}>
            <option value="">{t("coaching.reporting.allTeams")}</option>
            {teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("coaching.reporting.leader")}>
          <select className="field" value={filters.leaderId} onChange={(event) => onChange({ ...filters, leaderId: event.target.value })} disabled={userRole === "SALES_LEADER"}>
            <option value="">{t("coaching.reporting.allLeaders")}</option>
            {leaders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("coaching.reporting.level")}>
          <select className="field" value={filters.level} onChange={(event) => onChange({ ...filters, level: event.target.value })}>
            <option value="">{t("coaching.reporting.allLevels")}</option>
            {levels.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("coaching.reporting.interventionType")}>
          <select className="field" value={filters.interventionType} onChange={(event) => onChange({ ...filters, interventionType: event.target.value })}>
            <option value="">{t("coaching.reporting.allTypes")}</option>
            <option value="begeleiding">{t("coaching.reporting.coaching")}</option>
            <option value="contactmoment">{t("coaching.reporting.contact")}</option>
            <option value="retraining">{t("coaching.reporting.retraining")}</option>
            <option value="sales_training">{t("coaching.reporting.salesTraining")}</option>
            <option value="hulpaanvraag">{t("coaching.reporting.helpRequest")}</option>
          </select>
        </FilterField>
        <FilterField label={t("coaching.reporting.status")}>
          <select className="field" value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
            <option value="">{t("coaching.reporting.allStatuses")}</option>
            {["concept", "gepland", "in_uitvoering", "wacht_op_vt", "wacht_op_akkoord", "afgerond", "afgesloten", "open", "nieuw", "in_behandeling", "begeleiding", "contactmoment", "retraining", "salestraining", "gesloten", "ingetrokken", "vervolgactie_gepland", "behaald", "niet_behaald", "geannuleerd"].map((item) => (
              <option key={item} value={item}>{translate(language, `status.${item}` as TranslationKey)}</option>
            ))}
          </select>
        </FilterField>
      </div>
    </section>
  );
}

function OverviewReport({ dataset, state }: { dataset: ReportingDataset; state: ReturnType<typeof useWorkflow>["state"] }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const typeCount = (type: string) => dataset.interventions.filter((item) => item.type === type).length;
  const openActions = dataset.actions.filter((item) => !["behaald", "niet_behaald", "geannuleerd"].includes(item.status));
  const scopedIds = new Set(dataset.representatives.map((item) => item.id));
  const tiles = [
    { label: t("coaching.list.coachings"), value: typeCount("begeleiding"), icon: ClipboardCheck },
    { label: t("contactHelp.contact.pageTitle"), value: typeCount("contactmoment"), icon: MessageSquareText },
    { label: t("coaching.list.retrainings"), value: typeCount("retraining"), icon: GraduationCap },
    { label: t("coaching.list.salesTrainings"), value: typeCount("sales_training"), icon: Sparkles },
    { label: t("contactHelp.help.pageTitle"), value: typeCount("hulpaanvraag"), icon: CircleHelp },
    { label: t("coaching.reporting.openActions"), value: openActions.length, icon: Target },
    { label: t("coaching.reporting.overdueActions"), value: openActions.filter((item) => isOverdue(item.due, item.status)).length, icon: CircleHelp },
    { label: t("coaching.reporting.missingReflections"), value: state.reflections.filter((item) => scopedIds.has(item.representativeId) && item.status === "niet_gestart").length, icon: Clock3 },
    { label: t("coaching.reporting.waitingApproval"), value: dataset.interventions.filter((item) => item.status === "wacht_op_akkoord").length, icon: ClipboardCheck },
    { label: t("coaching.reporting.readNotAgreed"), value: dataset.interventions.filter((item) => item.approvalStatus === "gelezen_niet_akkoord").length, icon: CircleHelp },
  ];
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div>
                <p className="text-3xl font-bold text-slate-950">{tile.value}</p>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-600">{tile.label}</p>
            </div>
          );
        })}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="card p-5 sm:p-6">
          <SectionTitle title={t("coaching.reporting.interventionsByType")} subtitle={t("coaching.reporting.activeFilterDistribution")} />
          <div className="mt-6 space-y-4">
            {[
              [t("coaching.reporting.coaching"), typeCount("begeleiding"), "bg-brand-700"],
              [t("contactHelp.contact.pageTitle"), typeCount("contactmoment"), "bg-sky-500"],
              [t("coaching.reporting.retraining"), typeCount("retraining"), "bg-indigo-500"],
              [t("coaching.reporting.salesTraining"), typeCount("sales_training"), "bg-cyan-500"],
              [t("coaching.reporting.helpRequest"), typeCount("hulpaanvraag"), "bg-amber-500"],
            ].map(([label, value, tone]) => {
              const numericValue = Number(value);
              const maximum = Math.max(1, dataset.interventions.length);
              return (
                <div key={String(label)}>
                  <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span>{numericValue}</span></div>
                  <div className="h-3 rounded-full bg-slate-100"><div className={`h-3 rounded-full ${tone}`} style={{ width: `${Math.max(4, (numericValue / maximum) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <SectionTitle title={t("coaching.reporting.attentionNeeded")} subtitle={t("coaching.reporting.highestPriority")} />
          <div className="mt-5 space-y-3">
            {openActions.filter((item) => isOverdue(item.due, item.status)).slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-rose-700">{representativeName(dataset, item.representativeId)} · deadline {formatDate(item.due)}</p>
              </div>
            ))}
            {openActions.filter((item) => isOverdue(item.due, item.status)).length === 0 && <EmptyRow text={t("coaching.reporting.noOverdueActions")} />}
          </div>
        </section>
      </div>
    </>
  );
}

function LeaderReport({ dataset }: { dataset: ReportingDataset }) {
  const { managedUsers, language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const leaders = reportingLeaders(managedUsers).filter((leader) =>
    dataset.representatives.some((representative) => leader.teamIds.includes(representative.teamId))
  );
  return (
    <ReportTable title={t("coaching.reporting.leaderReport")} subtitle={t("coaching.reporting.leaderReportDescription")}>
      <thead><TableRowHead labels={[t("coaching.reporting.leader"), t("coaching.list.coachings"), t("coaching.reporting.contact"), t("coaching.reporting.retraining"), t("coaching.reporting.salesTraining"), t("coaching.reporting.helpHandled"), t("coaching.reporting.openActions"), t("coaching.reporting.overdue"), t("coaching.reporting.averageFinalization"), t("coaching.reporting.vtNoRecentCoaching")]} /></thead>
      <tbody>
        {leaders.map((leader) => {
          const teamRepresentativeIds = new Set(dataset.representatives.filter((item) => leader.teamIds.includes(item.teamId)).map((item) => item.id));
          const rows = dataset.interventions.filter((item) => item.representativeIds.some((id) => teamRepresentativeIds.has(id)));
          const actions = dataset.actions.filter((item) => teamRepresentativeIds.has(item.representativeId));
          const coachings = rows.filter((item) => item.type === "begeleiding");
          const finalizationDays = coachings.flatMap((item) => item.finalizedAt ? [Math.max(0, daysBetween(item.date, item.finalizedAt.slice(0, 10)))] : []);
          return (
            <tr key={leader.id} className="border-t border-slate-100">
              <Cell strong>{leader.name}<span className="block text-xs font-normal text-slate-400">{leader.country}</span></Cell>
              <Cell>{countType(rows, "begeleiding")}</Cell><Cell>{countType(rows, "contactmoment")}</Cell>
              <Cell>{countType(rows, "retraining")}</Cell><Cell>{countType(rows, "sales_training")}</Cell>
              <Cell>{rows.filter((item) => item.type === "hulpaanvraag" && helpRequestHandledStatuses.has(item.status)).length}</Cell>
              <Cell>{actions.filter(isOpenAction).length}</Cell>
              <Cell alert={actions.some((item) => isOverdue(item.due, item.status))}>{actions.filter((item) => isOverdue(item.due, item.status)).length}</Cell>
              <Cell>{finalizationDays.length ? `${Math.round(average(finalizationDays))} d` : "—"}</Cell>
              <Cell>{dataset.representatives.filter((item) => leader.teamIds.includes(item.teamId) && coachingAge(item.lastCoaching) > 45).length}</Cell>
            </tr>
          );
        })}
      </tbody>
    </ReportTable>
  );
}

function TeamReport({ dataset }: { dataset: ReportingDataset }) {
  const { managedUsers, language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const teams = [...new Map(dataset.representatives.map((item) => [item.teamId, item.team])).entries()];
  return (
    <ReportTable title={t("coaching.reporting.teamReport")} subtitle={t("coaching.reporting.teamReportDescription")}>
      <thead><TableRowHead labels={[t("coaching.reporting.team"), t("coaching.reporting.representativeCount"), t("coaching.reporting.interventions"), t("coaching.reporting.openActions"), t("coaching.reporting.overdue"), t("coaching.reporting.helpRequest"), t("coaching.reporting.kpiTrend"), t("coaching.reporting.starter"), t("coaching.reporting.vt"), t("coaching.reporting.professional"), t("coaching.reporting.expert")]} /></thead>
      <tbody>
        {teams.map(([teamId, team]) => {
          const reps = dataset.representatives.filter((item) => item.teamId === teamId);
          const ids = new Set(reps.map((item) => item.id));
          const rows = dataset.interventions.filter((item) => item.representativeIds.some((id) => ids.has(id)));
          const actions = dataset.actions.filter((item) => ids.has(item.representativeId));
          const trend = average(dataset.kpis.filter((item) => ids.has(item.representativeId)).map((item) => item.trend));
          return (
            <tr key={teamId} className="border-t border-slate-100">
              <Cell strong>{team}<span className="block text-xs font-normal text-slate-400">{reportingLeaderForTeam(teamId, managedUsers)?.name}</span></Cell>
              <Cell>{reps.length}</Cell><Cell>{rows.length}</Cell><Cell>{actions.filter(isOpenAction).length}</Cell>
              <Cell alert={actions.some((item) => isOverdue(item.due, item.status))}>{actions.filter((item) => isOverdue(item.due, item.status)).length}</Cell>
              <Cell>{countType(rows, "hulpaanvraag")}</Cell>
              <Cell><TrendLabel value={trend} /></Cell>
              {["Starter", "Vertegenwoordiger", "Professional", "Expert"].map((level) => <Cell key={level}>{reps.filter((item) => item.level === level).length}</Cell>)}
            </tr>
          );
        })}
      </tbody>
    </ReportTable>
  );
}

function RepresentativeReport({ dataset, state }: { dataset: ReportingDataset; state: ReturnType<typeof useWorkflow>["state"] }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <ReportTable title={t("coaching.reporting.representativeReport")} subtitle={t("coaching.reporting.representativeReportDescription")}>
      <thead><TableRowHead labels={[t("coaching.reporting.representatives"), t("coaching.reporting.team"), t("coaching.reporting.latestCoaching"), t("coaching.reporting.daysAgo"), t("coaching.reporting.openActions"), t("coaching.reporting.overdue"), t("coaching.reporting.openHelpRequests"), t("coaching.reporting.latestKpi"), t("coaching.reporting.latestReport")]} /></thead>
      <tbody>
        {dataset.representatives.map((representative) => {
          const actions = dataset.actions.filter((item) => item.representativeId === representative.id);
          const latestCoaching = dataset.interventions
            .filter((item) => item.type === "begeleiding" && item.representativeIds.includes(representative.id))
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          const latestApproval = state.approvals
            .filter((item) => item.representativeId === representative.id && item.status)
            .sort((a, b) => (b.confirmedAt ?? "").localeCompare(a.confirmedAt ?? ""))[0];
          const latestKpi = dataset.kpis.find((item) => item.representativeId === representative.id);
          return (
            <tr key={representative.id} className="border-t border-slate-100">
              <Cell strong>{representative.firstName} {representative.lastName}<span className="block text-xs font-normal text-slate-400">{representative.level}</span></Cell>
              <Cell>{representative.team}</Cell>
              <Cell>{latestCoaching ? formatDate(latestCoaching.date) : representative.lastCoaching}</Cell>
              <Cell>{latestCoaching ? daysBetween(latestCoaching.date, "2026-06-11") : coachingAge(representative.lastCoaching)}</Cell>
              <Cell>{actions.filter(isOpenAction).length}</Cell>
              <Cell alert={actions.some((item) => isOverdue(item.due, item.status))}>{actions.filter((item) => isOverdue(item.due, item.status)).length}</Cell>
              <Cell>{dataset.interventions.filter((item) => item.type === "hulpaanvraag" && item.representativeIds.includes(representative.id) && helpRequestOpenStatuses.has(item.status) && !helpRequestTerminalStatuses.has(item.status)).length}</Cell>
              <Cell>{latestKpi ? `${latestKpi.kpi}: ${latestKpi.currentValue}` : "—"}</Cell>
              <Cell>{latestApproval ? <StatusBadge status={latestApproval.status ?? "concept"} /> : "Nog geen"}</Cell>
            </tr>
          );
        })}
      </tbody>
    </ReportTable>
  );
}

function ActionReport({ dataset }: { dataset: ReportingDataset }) {
  const { managedUsers, language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const [local, setLocal] = useState({ type: "", deadline: "", ownerId: "", representativeId: "" });
  const rows = dataset.actions.filter((item) =>
    (!local.type || item.type === local.type) &&
    (!local.deadline || item.due <= local.deadline) &&
    (!local.ownerId || item.ownerId === local.ownerId) &&
    (!local.representativeId || item.representativeId === local.representativeId)
  );
  const owners = [...new Set(dataset.actions.map((item) => item.ownerId))];
  return (
    <>
      <LocalFilters>
        <select className="field" value={local.type} onChange={(event) => setLocal({ ...local, type: event.target.value })}><option value="">{t("coaching.reporting.allTypes")}</option><option value="kpi">KPI</option><option value="vaardigheid">{t("coaching.actionEditor.skill")}</option><option value="gedrag">{t("coaching.actionEditor.behaviour")}</option></select>
        <input className="field" type="date" value={local.deadline} onChange={(event) => setLocal({ ...local, deadline: event.target.value })} title={t("coaching.reporting.deadlineUntil")} />
        <select className="field" value={local.ownerId} onChange={(event) => setLocal({ ...local, ownerId: event.target.value })}><option value="">{t("coaching.reporting.owners")}</option>{owners.map((id) => <option key={id} value={id}>{reportingUserName(id, managedUsers)}</option>)}</select>
        <select className="field" value={local.representativeId} onChange={(event) => setLocal({ ...local, representativeId: event.target.value })}><option value="">{t("coaching.reporting.allRepresentatives")}</option>{dataset.representatives.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select>
      </LocalFilters>
      <ReportTable title={t("coaching.reporting.reportActions")} subtitle={`${rows.length} ${t("coaching.reporting.actionsInFilters")}`}>
        <thead><TableRowHead labels={[t("coaching.reporting.vt"), t("coaching.actionEditor.title"), t("coaching.reporting.typeStatus"), t("coaching.reporting.linkedKpi"), t("coaching.reporting.start"), t("coaching.reporting.goal"), t("coaching.reporting.currentValue"), t("coaching.reporting.deadlineUntil"), t("coaching.reporting.status"), t("coaching.reporting.owner"), t("coaching.reporting.lastUpdate")]} /></thead>
        <tbody>{rows.map((item) => (
          <tr key={`${item.id}-${item.representativeId}`} className="border-t border-slate-100">
            <Cell strong>{representativeName(dataset, item.representativeId)}</Cell><Cell>{item.title}</Cell><Cell>{item.type}</Cell>
            <Cell>{item.linkedKpi || "—"}</Cell><Cell>{item.startValue}</Cell><Cell>{item.targetValue}</Cell><Cell>{item.currentValue}</Cell>
            <Cell alert={isOverdue(item.due, item.status)}>{formatDate(item.due)}</Cell><Cell><StatusBadge status={item.status} /></Cell>
            <Cell>{reportingUserName(item.ownerId, managedUsers)}</Cell><Cell>{formatDate(item.updatedAt.slice(0, 10))}</Cell>
          </tr>
        ))}</tbody>
      </ReportTable>
    </>
  );
}

function InterventionReport({ dataset }: { dataset: ReportingDataset }) {
  const { managedUsers, language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <ReportTable title={t("coaching.reporting.reportInterventions")} subtitle={`${dataset.interventions.length} ${t("coaching.reporting.interventionsInFilters")}`}>
      <thead><TableRowHead labels={[t("coaching.reporting.typeStatus"), t("coaching.reporting.status"), t("coaching.reporting.reporterOrParticipants"), t("coaching.reporting.initiator"), t("coaching.reporting.executor"), t("coaching.reporting.country"), t("coaching.reporting.team"), t("coaching.reporting.date"), t("coaching.reporting.actionPointsColumn"), t("coaching.reporting.approvalStatus")]} /></thead>
      <tbody>{dataset.interventions.map((item) => (
        <tr key={item.id} className="border-t border-slate-100">
          <Cell strong>{item.type.replaceAll("_", " ")}</Cell><Cell><StatusBadge status={item.status} /></Cell>
          <Cell>{item.representativeIds.map((id) => representativeName(dataset, id)).join(", ")}</Cell>
          <Cell>{reportingUserName(item.initiatorId, managedUsers)}</Cell><Cell>{reportingUserName(item.ownerId, managedUsers)}</Cell>
          <Cell>{item.country}</Cell><Cell>{item.teamIds.map((id) => teamName(dataset, id)).join(", ")}</Cell><Cell>{formatDate(item.date)}</Cell>
          <Cell>{item.actionCount}</Cell><Cell>{item.approvalStatus ? <StatusBadge status={item.approvalStatus} /> : "—"}</Cell>
        </tr>
      ))}</tbody>
    </ReportTable>
  );
}

function KpiReport({ dataset }: { dataset: ReportingDataset }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const [representativeId, setRepresentativeId] = useState(dataset.representatives[0]?.id ?? "");
  const selectedId = dataset.representatives.some((item) => item.id === representativeId)
    ? representativeId
    : dataset.representatives[0]?.id ?? "";
  const representative = dataset.representatives.find((item) => item.id === selectedId);
  const kpis = dataset.kpis.filter((item) => item.representativeId === selectedId);
  return (
    <div className="space-y-5">
      <div className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div><p className="eyebrow">{t("coaching.reporting.kpiEvolutionTitle")}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{representative ? `${representative.firstName} ${representative.lastName}` : t("coaching.reporting.noRepresentative")}</h2></div>
        <select className="field sm:max-w-72" value={selectedId} onChange={(event) => setRepresentativeId(event.target.value)}>
          {dataset.representatives.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.team}</option>)}
        </select>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <article key={item.kpi} className="card p-5">
            <div className="flex items-center justify-between"><p className="font-bold text-slate-950">{item.kpi}</p><Trend value={item.trend} /></div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <KpiValue label={t("coaching.reporting.previous")} value={item.previousValue} />
              <KpiValue label={t("coaching.reporting.current")} value={item.currentValue} highlight />
              <KpiValue label={t("coaching.reporting.target")} value={item.target} />
            </div>
            <div className="mt-5"><TrendLabel value={item.trend} /></div>
          </article>
        ))}
      </section>
    </div>
  );
}

function PersonalReporting({ dataset, representative }: { dataset: ReportingDataset; representative?: Representative }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  if (!representative) return <EmptyRow text={t("coaching.reporting.noProfile")} />;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("coaching.reporting.personalInsights")} title={t("coaching.reporting.myKpisActions")} description={t("coaching.reporting.personalDescription")} />
      <KpiReport dataset={dataset} />
      <ReportTable title={t("coaching.reporting.myActions")} subtitle={t("coaching.reporting.personalActionsOnly")}>
        <thead><TableRowHead labels={[t("coaching.actionEditor.title"), t("coaching.reporting.typeStatus"), "KPI", t("coaching.reporting.deadlineUntil"), t("coaching.reporting.status"), t("coaching.reporting.currentValue"), t("coaching.reporting.goal")]} /></thead>
        <tbody>{dataset.actions.map((item) => (
          <tr key={item.id} className="border-t border-slate-100">
            <Cell strong>{item.title}</Cell><Cell>{item.type}</Cell><Cell>{item.linkedKpi || "—"}</Cell>
            <Cell alert={isOverdue(item.due, item.status)}>{formatDate(item.due)}</Cell><Cell><StatusBadge status={item.status} /></Cell>
            <Cell>{item.currentValue}</Cell><Cell>{item.targetValue}</Cell>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

function ReportTable({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5"><SectionTitle title={title} subtitle={subtitle} /></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">{children}</table></div>
    </section>
  );
}

function TableRowHead({ labels }: { labels: string[] }) {
  return <tr className="bg-slate-50">{labels.map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</th>)}</tr>;
}

function Cell({ children, strong = false, alert = false }: { children: React.ReactNode; strong?: boolean; alert?: boolean }) {
  return <td className={`min-w-28 px-4 py-4 align-top ${strong ? "font-semibold text-slate-900" : alert ? "font-semibold text-rose-700" : "text-slate-600"}`}>{children}</td>;
}

function LocalFilters({ children }: { children: React.ReactNode }) {
  return <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>{children}</label>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>;
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function KpiValue({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-xl p-3 ${highlight ? "bg-brand-700 text-white" : "bg-slate-50"}`}><p className={`text-[10px] font-bold uppercase ${highlight ? "text-blue-100" : "text-slate-400"}`}>{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>;
}

function TrendLabel({ value }: { value: number }) {
  const label = value > 0 ? "Positief" : value < 0 ? "Negatief" : "Neutraal";
  const style = value > 0 ? "bg-emerald-100 text-emerald-800" : value < 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{label}</span>;
}

function countType(rows: ReportingIntervention[], type: string) {
  return rows.filter((item) => item.type === type).length;
}

function isOpenAction(item: ReportingAction) {
  return !["behaald", "niet_behaald", "geannuleerd"].includes(item.status);
}

function representativeName(dataset: ReportingDataset, id: string) {
  const representative = dataset.representatives.find((item) => item.id === id);
  return representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend";
}

function teamName(dataset: ReportingDataset, id: string) {
  return dataset.representatives.find((item) => item.teamId === id)?.team ?? id;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("nl-BE");
}

function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000));
}

function coachingAge(value: string) {
  if (value === "Nog niet") return 999;
  const parsed = value.match(/^(\d{1,2})\s+mei\s+2026$/);
  return parsed ? daysBetween(`2026-05-${parsed[1].padStart(2, "0")}`, "2026-06-11") : 999;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
