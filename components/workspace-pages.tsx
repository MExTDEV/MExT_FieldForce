"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Contact,
  Filter,
  Gauge,
  GraduationCap,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useConfiguration } from "@/components/configuration-provider";
import { useWorkflow } from "@/components/workflow-provider";
import { usePersonalCriteria } from "@/components/personal-criteria-provider";
import { usePerformance } from "@/components/performance-provider";
import { useModules } from "@/components/module-provider";
import { useRepresentatives } from "@/components/representatives-provider";
import { MyReflectionsPage, MyReportsPage } from "@/components/representative-workflow-pages";
import { ContactMomentsPage, HelpRequestsWorkflowPage } from "@/components/contact-help-workflows";
import { TrainingWorkflowPage } from "@/components/training-workflows";
import { ReportingDashboard } from "@/components/reporting-dashboard";
import { SmartDashboardPanel, SmartManagementSections } from "@/components/smart-coaching-dashboard";
import { PerformanceEvolution } from "@/components/performance-evolution";
import { UsersManagementPage } from "@/components/user-management";
import { PlanningCalendar } from "@/components/planning-calendar";
import { ConfigurationManagement } from "@/components/configuration-management";
import { Avatar, EmptyState, PageHeader, StatusBadge, Trend } from "@/components/ui";
import { branding } from "@/config/branding";
import {
  can,
  canAccessRepresentative,
  canAccessTechnicalManagement,
  canAccessUserManagement,
  canManageSystem,
  canViewTeamDashboard,
} from "@/lib/permissions";
import { buildReportingDataset, filterReportingDataset, emptyReportingFilters, reportingUserName } from "@/lib/reporting";
import { buildSmartCoaching } from "@/lib/smart-coaching";
import {
  getVisibleRepresentatives,
  getVisibleWorkflowState,
} from "@/lib/data-access";
import { moduleForRoute } from "@/lib/modules";
import {
  coachingById,
  coachingsForRepresentative,
  latestHistoricalCoaching,
  performanceTrend,
  representativeForCoaching,
} from "@/lib/performance-data";
import type { HistoricalCoaching } from "@/lib/performance-data";
import type { CoachingAppointment, CoachingDossier, PersonalCoachingCriterion, Representative } from "@/lib/types";

export function WorkspacePage({ segments }: { segments: string[] }) {
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const { isModuleEnabled } = useModules();
  const path = segments.join("/");
  const routeModule = moduleForRoute(segments[0] ?? "");

  if (sessionLoading) {
    return <EmptyState title="Gebruikerssessie laden" description="De actieve gebruiker en rechten worden uit MariaDB opgehaald." />;
  }
  if (sessionError || !user.id) {
    return <EmptyState title="Gebruikerssessie niet beschikbaar" description={sessionError ?? "Er is geen actieve databasegebruiker beschikbaar."} />;
  }
  if (routeModule && !isModuleEnabled(routeModule.code)) {
    return <ModuleInactive moduleName={routeModule.name} />;
  }

  if (path === "dashboard") return <Dashboard />;
  if (segments[0] === "mijn-reflecties") return <MyReflectionsPage id={segments[1]} />;
  if (segments[0] === "mijn-verslagen") return <MyReportsPage id={segments[1]} />;
  if (segments[0] === "contactmomenten") return <ContactMomentsPage id={segments[1] === "nieuw" ? undefined : segments[1]} isNew={segments[1] === "nieuw"} />;
  if (segments[0] === "hulpaanvragen") return <HelpRequestsWorkflowPage id={segments[1] === "nieuw" ? undefined : segments[1]} isNew={segments[1] === "nieuw"} />;
  if (segments[0] === "retrainingen") return <TrainingWorkflowPage kind="retraining" id={segments[1] === "nieuw" ? undefined : segments[1]} isNew={segments[1] === "nieuw"} />;
  if (segments[0] === "sales-trainingen") return <TrainingWorkflowPage kind="sales_training" id={segments[1] === "nieuw" ? undefined : segments[1]} isNew={segments[1] === "nieuw"} />;
  if (segments[0] === "rapportering") return <ReportingDashboard section={segments[1]} />;
  if (segments[0] === "vertegenwoordigers" && segments[1]) return <RepresentativeDetail id={segments[1]} />;
  if (segments[0] === "begeleidingen" && segments[1]) return <CoachingDetail id={segments[1]} />;
  if (path === "vertegenwoordigers") {
    if (user.role === "REPRESENTATIVE") {
      return user.representativeId
        ? <RepresentativeDetail id={user.representativeId} />
        : <EmptyState title="Geen persoonlijke fiche" description="Er is geen vertegenwoordigersprofiel gekoppeld aan deze gebruiker." />;
    }
    return <RepresentativesList />;
  }
  if (path === "actiepunten") return <ActionPoints />;
  if (path === "planning") return <Planning />;
  if (segments[0] === "beheer") return <Management section={segments[1] ?? "gebruikers"} />;
  if (path === "begeleidingen") {
    return <InterventionList kind={path} />;
  }

  return <EmptyState title="Pagina in voorbereiding" description="Deze route is technisch beschikbaar en wordt in een volgende functionele iteratie verder ingevuld." />;
}

function Dashboard() {
  const { user, managedUsers } = useSession();
  const { isModuleEnabled } = useModules();
  const { representatives } = useRepresentatives();
  const { dataset: performanceDataset } = usePerformance();
  const {
    visibleInterventions,
    openReflections,
    pendingApprovals,
    visibleContactMoments,
    visibleHelpRequests,
    visibleRetrainings,
    visibleSalesTrainings,
    state,
  } = useWorkflow();
  const scopedRepresentatives = useMemo(
    () => getVisibleRepresentatives(user, representatives),
    [representatives, user]
  );
  const teamDashboardAllowed = canViewTeamDashboard(user);
  const teamDashboardRepresentatives = useMemo(
    () => teamDashboardAllowed ? getVisibleRepresentatives(user, representatives) : [],
    [representatives, teamDashboardAllowed, user]
  );
  const coachingEnabled = isModuleEnabled("BEGELEIDINGEN");
  const planningEnabled = isModuleEnabled("PLANNING");
  const contactsEnabled = isModuleEnabled("CONTACTMOMENTEN");
  const helpEnabled = isModuleEnabled("HULPAANVRAGEN");
  const retrainingEnabled = isModuleEnabled("RETRAININGEN");
  const salesTrainingEnabled = isModuleEnabled("SALESTRAININGEN");
  const actionPointsEnabled = isModuleEnabled("ACTIEPUNTEN");
  const scopedInterventions = coachingEnabled ? visibleInterventions(user) : [];
  const scopedContacts = contactsEnabled ? visibleContactMoments(user) : [];
  const scopedHelpRequests = helpEnabled ? visibleHelpRequests(user) : [];
  const scopedRetrainings = retrainingEnabled ? visibleRetrainings(user) : [];
  const scopedSalesTrainings = salesTrainingEnabled ? visibleSalesTrainings(user) : [];
  const scopedState = useMemo(
    () => getVisibleWorkflowState(user, state, representatives),
    [representatives, state, user]
  );
  const smartResult = useMemo(() => {
    const dataset = buildReportingDataset(scopedState, representatives, performanceDataset, managedUsers);
    const scopedDataset = filterReportingDataset(dataset, scopedRepresentatives, emptyReportingFilters, managedUsers);
    return buildSmartCoaching(scopedDataset, scopedState, undefined, managedUsers);
  }, [managedUsers, performanceDataset, representatives, scopedState, scopedRepresentatives]);
  const scopedOtherMoments = planningEnabled ? [
    ...scopedContacts.map((item) => ({ id: item.id, type: "contactmoment", person: representatives.find((person) => person.id === item.representativeId)?.firstName ?? "Onbekend", date: new Date(item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), owner: item.ownerId, status: item.status })),
    ...scopedRetrainings.map((item) => ({ id: item.id, type: "retraining", person: representatives.find((person) => person.id === item.representativeId)?.firstName ?? "Onbekend", date: new Date(item.date || item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), owner: item.trainer || item.initiatorId, status: item.status })),
    ...scopedSalesTrainings.map((item) => ({ id: item.id, type: "sales_training", person: `${item.participantIds.length} deelnemers`, date: new Date(item.date || item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), owner: item.trainer || item.initiatorId, status: item.status })),
    ...scopedHelpRequests.map((item) => ({ id: item.id, type: "hulpaanvraag", person: representatives.find((person) => person.id === item.representativeId)?.firstName ?? "Onbekend", date: new Date(item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), owner: item.requesterId, status: item.status })),
  ] : [];
  const openActionCount = actionPointsEnabled ? smartResult.insights.reduce((total, insight) => total + insight.openActionCount, 0) : 0;
  const reflectionCount = user.role === "REPRESENTATIVE"
    ? openReflections(user).length
    : scopedInterventions.filter((item) => item.status === "wacht_op_vt").length;
  const approvalCount = user.role === "REPRESENTATIVE"
    ? pendingApprovals(user).length
    : scopedInterventions.filter((item) => item.status === "wacht_op_akkoord").length;
  const metrics = [
    coachingEnabled && user.role === "REPRESENTATIVE" && { label: "Mijn Begeleidingen", value: scopedInterventions.length, icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700", href: "/begeleidingen" },
    coachingEnabled && { label: "Geplande begeleidingen", value: scopedInterventions.filter((item) => item.status === "gepland").length, icon: CalendarCheck, tone: "bg-blue-50 text-blue-700", href: "/begeleidingen" },
    actionPointsEnabled && { label: "Open actiepunten", value: openActionCount, icon: Target, tone: "bg-amber-50 text-amber-700", href: "/actiepunten" },
    contactsEnabled && { label: "Open contactmomenten", value: scopedContacts.filter((item) => item.status !== "afgesloten").length, icon: Phone, tone: "bg-sky-50 text-sky-700", href: "/contactmomenten" },
    contactsEnabled && { label: "Wachtend op VT-input", value: scopedContacts.filter((item) => item.status === "wacht_op_vt_input").length, icon: Contact, tone: "bg-violet-50 text-violet-700", href: "/contactmomenten" },
    helpEnabled && { label: "Nieuwe hulpaanvragen", value: scopedHelpRequests.filter((item) => item.status === "nieuw").length, icon: CircleHelp, tone: "bg-rose-50 text-rose-700", href: "/hulpaanvragen" },
    helpEnabled && { label: "Zonder vervolgactie", value: scopedHelpRequests.filter((item) => !item.followUpType && !["afgesloten", "geannuleerd"].includes(item.status)).length, icon: Clock3, tone: "bg-amber-50 text-amber-700", href: "/hulpaanvragen" },
    coachingEnabled && { label: "Reflecties wachtend op VT", value: reflectionCount, icon: Clock3, tone: "bg-cyan-50 text-cyan-700", href: user.role === "REPRESENTATIVE" && actionPointsEnabled ? "/mijn-reflecties" : "/begeleidingen" },
    coachingEnabled && { label: "Verslagen wachtend op akkoord", value: approvalCount, icon: ClipboardCheck, tone: "bg-fuchsia-50 text-fuchsia-700", href: user.role === "REPRESENTATIVE" && actionPointsEnabled ? "/mijn-verslagen" : "/begeleidingen" },
    retrainingEnabled && { label: "Geplande retrainingen", value: scopedRetrainings.filter((item) => item.status === "gepland").length, icon: GraduationCap, tone: "bg-indigo-50 text-indigo-700", href: "/retrainingen" },
    salesTrainingEnabled && { label: "Geplande sales trainingen", value: scopedSalesTrainings.filter((item) => item.status === "gepland").length, icon: Sparkles, tone: "bg-cyan-50 text-cyan-700", href: "/sales-trainingen" },
    (retrainingEnabled || salesTrainingEnabled) && { label: "Openstaande trainingen", value: [...scopedRetrainings, ...scopedSalesTrainings].filter((item) => !["afgerond", "geannuleerd"].includes(item.status)).length, icon: BookOpenCheck, tone: "bg-blue-50 text-blue-700", href: salesTrainingEnabled ? "/sales-trainingen" : "/retrainingen" },
    (retrainingEnabled || salesTrainingEnabled) && { label: "Trainingen zonder opvolgactie", value: scopedRetrainings.filter((item) => item.actionPoints.length === 0).length + scopedSalesTrainings.filter((item) => !item.followUpAction.trim()).length, icon: Target, tone: "bg-amber-50 text-amber-700", href: salesTrainingEnabled ? "/sales-trainingen" : "/retrainingen" },
    actionPointsEnabled && { label: "Aandacht vereist", value: user.role === "REPRESENTATIVE" ? Number(smartResult.insights[0]?.risk !== "green") : smartResult.alerts.length, icon: CircleHelp, tone: "bg-rose-50 text-rose-700", href: "#smart-alerts" },
  ].filter(Boolean) as { label: string; value: number; icon: typeof CalendarCheck; tone: string; href: string }[];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={branding.fullAppName}
        title={`Welkom terug in ${branding.appName}`}
        description={`${user.name.split(" ")[0]}, hier zie je wat vandaag aandacht vraagt en welke coachingmomenten eraan komen.`}
        compact
        actions={coachingEnabled && can(user, "intervention:create") ? (
          <Link href="/begeleidingen/nieuw" className="btn-primary py-2">
            <Plus className="h-4 w-4" /> Nieuwe begeleiding
          </Link>
        ) : undefined}
      />

      {actionPointsEnabled && <SmartDashboardPanel result={smartResult} personal={user.role === "REPRESENTATIVE"} />}

      <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link
              key={metric.label}
              href={metric.href}
              className="card group flex min-h-[72px] items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:border-brand-100"
            >
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${metric.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold leading-none tracking-tight text-slate-950">{metric.value}</p>
                <p className="mt-1 text-xs leading-4 text-slate-500">{metric.label}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
            </Link>
          );
        })}
      </section>

      {teamDashboardAllowed && actionPointsEnabled && <SmartManagementSections result={smartResult} />}

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {planningEnabled && <div className="card overflow-hidden">
          <SectionTitle title="Eerstvolgende momenten" subtitle="Planning voor je huidige scope" link="/planning" />
          <div className="divide-y divide-slate-100">
            {[...scopedInterventions.map((item) => {
              const representative = representatives.find((person) => person.id === item.representativeId);
              return {
                id: item.id,
                type: "begeleiding",
                person: representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend",
                date: new Date(item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }),
                owner: user.name,
                status: item.status,
              };
            }), ...scopedOtherMoments].slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                <div className="hidden h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 sm:flex">
                  <span className="text-xs font-bold uppercase text-slate-400">{item.date.split(" ")[1]}</span>
                  <span className="text-lg font-bold leading-none text-slate-800">{item.date.split(" ")[0]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{item.person}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">{item.type.replace("_", " ")} · {item.owner}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </div>}

        {teamDashboardAllowed && actionPointsEnabled && (
          <div className="card overflow-hidden">
            <SectionTitle title="Team in beeld" subtitle={`${teamDashboardRepresentatives.length} vertegenwoordigers zichtbaar`} link="/vertegenwoordigers" />
            <div className="space-y-1 p-3">
              {teamDashboardRepresentatives.slice(0, 5).map((representative) => (
                <Link key={representative.id} href={`/vertegenwoordigers/${representative.id}`} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-slate-50">
                  <Avatar initials={representative.initials} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{representative.firstName} {representative.lastName}</p>
                    <p className="truncate text-xs text-slate-500">{representative.team}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${representative.levelColor}`}>{representative.level}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function RepresentativesList() {
  const { user } = useSession();
  const { error, loading, representatives } = useRepresentatives();
  const { dataset: performanceDataset } = usePerformance();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [team, setTeam] = useState("all");
  const [level, setLevel] = useState("all");

  const available = representatives.filter((representative) => canAccessRepresentative(user, representative));
  const filtered = available.filter((representative) => {
    const fullName = `${representative.firstName} ${representative.lastName}`.toLowerCase();
    return (
      fullName.includes(search.toLowerCase()) &&
      (country === "all" || representative.country === country) &&
      (team === "all" || representative.team === team) &&
      (level === "all" || representative.level === level)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mensen"
        title="Vertegenwoordigers"
        description="Bekijk ontwikkeling, KPI's en volledige coachinghistoriek binnen jouw scope."
        actions={<button className="btn-secondary"><Filter className="h-4 w-4" /> Exporteer selectie</button>}
      />
      {loading && <p className="text-sm text-slate-500">Vertegenwoordigers laden...</p>}
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      <div className="card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_160px_200px_200px]">
          <label className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-10" placeholder="Zoek op naam..." />
          </label>
          <select className="field" value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="all">Alle landen</option>
            <option value="BE">België</option>
            <option value="NL">Nederland</option>
            <option value="DE">Duitsland</option>
          </select>
          <select className="field" value={team} onChange={(event) => setTeam(event.target.value)}>
            <option value="all">Alle teams</option>
            {[...new Set(available.map((item) => item.team))].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="all">Alle niveaus</option>
            {["Starter", "Vertegenwoordiger", "Professional", "Expert"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(220px,1.5fr)_1fr_80px_145px_110px_110px_40px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Vertegenwoordiger</span><span>Team</span><span>Land</span><span>Laatste begeleiding</span><span>Evolutie</span><span>Actiepunten</span><span />
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.map((representative) => (
            <Link
              key={representative.id}
              href={`/vertegenwoordigers/${representative.id}`}
              className="grid gap-3 p-4 transition hover:bg-slate-50 md:grid-cols-[minmax(220px,1.5fr)_1fr_80px_145px_110px_110px_40px] md:items-center md:gap-4 md:px-5"
            >
              <div className="flex items-center gap-3">
                <Avatar initials={representative.initials} />
                <div>
                  <p className="font-semibold text-slate-900">{representative.firstName} {representative.lastName}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${representative.levelColor}`}>{representative.level}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600">{representative.team}</p>
              <p className="text-sm font-semibold text-slate-700">{representative.country}</p>
              <p className="text-sm text-slate-600">{formatShortDate(latestHistoricalCoaching(performanceDataset, representative.id)?.date)}</p>
              <PerformanceTrendLabel value={performanceTrend(performanceDataset, representative.id)} />
              <p className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">
                  {performanceDataset.historicalActionPoints.filter((item) =>
                    item.representativeId === representative.id &&
                    !["behaald", "niet_behaald"].includes(item.status)
                  ).length}
                </span> open
              </p>
              <ChevronRight className="hidden h-5 w-5 text-slate-300 md:block" />
            </Link>
          ))}
          {filtered.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Geen vertegenwoordigers gevonden met deze filters.</p>}
        </div>
      </div>
    </div>
  );
}

function RepresentativeDetail({ id }: { id: string }) {
  const { user } = useSession();
  const { error, loading, representatives } = useRepresentatives();
  const { dataset: performanceDataset, error: performanceError } = usePerformance();
  const representative = representatives.find((item) => item.id === id);
  const [tab, setTab] = useState("overzicht");

  if (loading) {
    return <EmptyState title="Vertegenwoordiger laden" description="De gegevens worden uit MariaDB opgehaald." />;
  }

  if (error) {
    return <EmptyState title="Database niet bereikbaar" description={error} />;
  }

  if (!representative || !canAccessRepresentative(user, representative)) {
    return <EmptyState title="Geen toegang" description="Deze vertegenwoordiger valt niet binnen jouw huidige rol- of teamscope." />;
  }

  const tabs = ["overzicht", "Prestatiecirkel", "persoonlijke criteria", "KPI's", "begeleidingen", "contactmomenten", "retrainingen", "sales trainingen", "hulpaanvragen", "actiepunten", "productanalyse", "tijdlijn"];

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-brand-800 via-brand-700 to-blue-500" />
        <div className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-end sm:px-7">
          <Avatar initials={representative.initials} className="-mt-10 h-24 w-24 border-4 border-white bg-brand-100 text-2xl shadow-lg" />
          <div className="min-w-0 flex-1 sm:pb-1">
            <h1 className="text-2xl font-bold text-slate-950">{representative.firstName} {representative.lastName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {representative.team}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {representative.country}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${representative.levelColor}`}>{representative.level}</span>
              <PerformanceTrendLabel value={performanceTrend(performanceDataset, representative.id)} />
            </div>
          </div>
          <Link href="/begeleidingen/nieuw" className="btn-primary"><Plus className="h-4 w-4" /> Begeleiding</Link>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 pt-2">
          {tabs.map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold capitalize ${tab === item ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {tab === "overzicht" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {representative.kpis.map((kpi) => (
              <div key={kpi.label} className="card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-500">{kpi.label}</p>
                  <Trend value={kpi.trend} />
                </div>
                <p className="mt-4 text-2xl font-bold text-slate-950">{kpi.value}</p>
                <p className="mt-1 text-xs text-slate-400">Doel {kpi.target}</p>
              </div>
            ))}
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <div className="card overflow-hidden">
              <SectionTitle title="Open actiepunten" subtitle="Concrete afspraken in opvolging" link="/actiepunten" />
              {performanceDataset.historicalActionPoints
                .filter((action) =>
                  action.representativeId === representative.id &&
                  !["behaald", "niet_behaald"].includes(action.status)
                )
                .slice(0, 3)
                .map((action) => (
                <div key={action.id} className="border-t border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold text-slate-900">{action.title}</p><p className="mt-1 text-xs text-slate-500">Tegen {formatShortDate(action.due)}</p></div>
                    <StatusBadge status={action.status} />
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-700" style={{ width: `${action.progress}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="card p-5">
              <h2 className="font-bold text-slate-900">Contactgegevens</h2>
              <div className="mt-5 space-y-4">
                <p className="flex items-center gap-3 text-sm text-slate-600"><Mail className="h-4 w-4 text-brand-700" /> {representative.email}</p>
                <p className="flex items-center gap-3 text-sm text-slate-600"><Phone className="h-4 w-4 text-brand-700" /> {representative.phone}</p>
                <p className="flex items-center gap-3 text-sm text-slate-600"><CalendarDays className="h-4 w-4 text-brand-700" /> Laatste begeleiding: {formatShortDate(latestHistoricalCoaching(performanceDataset, representative.id)?.date)}</p>
              </div>
            </div>
          </section>
        </>
      )}
      {performanceError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{performanceError}</p>}
      {tab === "Prestatiecirkel" && (
        <PerformanceEvolution
          coachings={coachingsForRepresentative(performanceDataset, representative.id)}
          representativeName={`${representative.firstName} ${representative.lastName}`}
        />
      )}
      {tab === "persoonlijke criteria" && <PersonalCriteriaPanel representative={representative} />}
      {tab === "KPI's" && <KpiPanel representativeId={representative.id} />}
      {!["overzicht", "Prestatiecirkel", "persoonlijke criteria", "KPI's"].includes(tab) && <TimelinePanel title={tab} representativeId={representative.id} representativeName={representative.firstName} />}
    </div>
  );
}

function PersonalCriteriaPanel({ representative }: { representative: Representative }) {
  const { user } = useSession();
  const { coachingFramework } = useConfiguration();
  const personalCriteria = usePersonalCriteria();
  const active = personalCriteria.activeForRepresentative(user, representative.id);
  const inactive = personalCriteria
    .visibleCriteria(user)
    .filter((criterion) => criterion.representativeId === representative.id && !criterion.isActive);
  const canManage = personalCriteria.canManageForRepresentative(user, representative);
  const [editing, setEditing] = useState<PersonalCoachingCriterion | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    focusName: coachingFramework[0]?.name ?? "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string }>();

  function openCreate() {
    setEditing(null);
    setForm({ title: "", description: "", focusName: coachingFramework[0]?.name ?? "" });
    setMessage(undefined);
    setFormOpen(true);
  }

  function openEdit(criterion: PersonalCoachingCriterion) {
    setEditing(criterion);
    setForm({
      title: criterion.title,
      description: criterion.description,
      focusName: criterion.focusName,
    });
    setMessage(undefined);
    setFormOpen(true);
  }

  function saveCriterion() {
    const input = {
      ...form,
      representativeId: representative.id,
    };
    const result = editing
      ? personalCriteria.updateCriterion(user, editing.id, input)
      : personalCriteria.createCriterion(user, input);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: editing ? "Persoonlijk criterium bijgewerkt." : "Persoonlijk criterium toegevoegd." });
    setEditing(null);
    setForm({ title: "", description: "", focusName: coachingFramework[0]?.name ?? "" });
    setFormOpen(false);
  }

  function deactivateCriterion(id: string) {
    const result = personalCriteria.deactivateCriterion(user, id);
    setMessage(result.ok
      ? { type: "success", text: "Persoonlijk criterium gedeactiveerd. Historische scores blijven bewaard." }
      : { type: "error", text: result.error }
    );
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="eyebrow">Kapstok</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Persoonlijke criteria voor {representative.firstName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Vaste criteria blijven centraal beheerd. Persoonlijke criteria zijn extra coachingspunten voor alleen deze vertegenwoordiger en worden meegenomen in nieuwe begeleidingen wanneer de bijhorende fase gekozen wordt.
            </p>
          </div>
          {canManage && (
            <button type="button" onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" /> Criterium toevoegen
            </button>
          )}
        </div>
        {message && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {formOpen && canManage && (
        <div className="card p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Naam criterium</span>
              <input
                className="field"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Bijvoorbeeld: Doorvragen op verborgen bezwaar"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Kapstokfase</span>
              <select
                className="field"
                value={form.focusName}
                onChange={(event) => setForm((current) => ({ ...current, focusName: event.target.value }))}
              >
                {coachingFramework.map((focus) => <option key={focus.name}>{focus.name}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Beschrijving</span>
            <textarea
              className="field min-h-28"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optionele toelichting voor de begeleiding."
            />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Annuleren</button>
            <button type="button" onClick={saveCriterion} className="btn-primary">Opslaan</button>
          </div>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="card overflow-hidden">
          <SectionTitle title="Vaste criteria" subtitle="Centraal beheerd door Admin/Super Admin" />
          <div className="grid gap-3 p-5">
            {coachingFramework.map((focus) => (
              <div key={focus.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-7 w-1.5 rounded-full ${focus.color}`} />
                  <p className="font-bold text-brand-800">{focus.name}</p>
                  <span className="ml-auto rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{focus.criteria.length} vast</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {focus.criteria.map((criterion) => (
                    <span key={criterion} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {criterion}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <SectionTitle title="Persoonlijke criteria" subtitle={`${active.length} actieve criteria voor deze vertegenwoordiger`} />
            <div className="grid gap-3 p-5">
              {active.map((criterion) => (
                <PersonalCriterionCard
                  key={criterion.id}
                  criterion={criterion}
                  canManage={canManage}
                  onEdit={() => openEdit(criterion)}
                  onDeactivate={() => deactivateCriterion(criterion.id)}
                />
              ))}
              {active.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Geen actieve persoonlijke criteria voor deze vertegenwoordiger.
                </div>
              )}
            </div>
          </div>

          {inactive.length > 0 && (
            <div className="card overflow-hidden opacity-80">
              <SectionTitle title="Historisch bewaard" subtitle="Gedeactiveerde criteria blijven beschikbaar voor oude scores" />
              <div className="grid gap-3 p-5">
                {inactive.map((criterion) => (
                  <PersonalCriterionCard
                    key={criterion.id}
                    criterion={criterion}
                    canManage={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PersonalCriterionCard({
  criterion,
  canManage,
  onEdit,
  onDeactivate,
}: {
  criterion: PersonalCoachingCriterion;
  canManage: boolean;
  onEdit?: () => void;
  onDeactivate?: () => void;
}) {
  return (
    <article className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-700 px-2.5 py-1 text-xs font-bold text-white">Persoonlijk criterium</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700">{criterion.focusName}</span>
            {!criterion.isActive && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">Inactief</span>}
          </div>
          <h3 className="mt-3 font-bold text-slate-950">{criterion.title}</h3>
          {criterion.description && <p className="mt-1 text-sm leading-6 text-slate-600">{criterion.description}</p>}
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onEdit} className="btn-secondary py-2 text-xs">Bewerken</button>
            <button type="button" onClick={onDeactivate} className="btn-secondary py-2 text-xs text-rose-700">Deactiveren</button>
          </div>
        )}
      </div>
    </article>
  );
}

function KpiPanel({ representativeId }: { representativeId: string }) {
  const { dataset: performanceDataset } = usePerformance();
  const snapshots = performanceDataset.monthlyKpiSnapshots.filter((item) => item.representativeId === representativeId);
  const latest = snapshots.at(-1);
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><p className="eyebrow">Laatste 6 maanden</p><h2 className="mt-1 text-xl font-bold">KPI-ontwikkeling</h2></div>
        <select className="field max-w-48"><option>Mei 2026</option><option>April 2026</option></select>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(latest?.values ?? []).map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex items-center justify-between"><p className="font-semibold">{kpi.label}</p><p className="text-lg font-bold">{formatKpiValue(kpi.value, kpi.unit)}</p></div>
            <div className="mt-6 flex h-24 items-end gap-2">
              {snapshots.map((snapshot) => {
                const value = snapshot.values.find((item) => item.label === kpi.label)?.value ?? 0;
                const percentage = Math.min(100, Math.max(15, (value / kpi.target) * 82));
                return <div key={snapshot.month} title={`${snapshot.month}: ${formatKpiValue(value, kpi.unit)}`} className="flex-1 self-end rounded-t-md bg-brand-700 opacity-80" style={{ height: `${percentage}%` }} />;
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>jul 2025</span><span>jun 2026</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelinePanel({ title, representativeId, representativeName }: { title: string; representativeId: string; representativeName: string }) {
  const { state } = useWorkflow();
  const { dataset: performanceDataset } = usePerformance();
  const workflowItems = [
    ...performanceDataset.historicalCoachings.filter((item) => item.representativeId === representativeId).map((item) => ({ id: item.id, type: "begeleiding", date: item.date, owner: item.ownerName, status: item.status })),
    ...performanceDataset.historicalContactMoments.filter((item) => item.representativeId === representativeId).map((item) => ({ id: item.id, type: "contactmoment", date: item.date, owner: item.reason, status: item.status })),
    ...state.interventions.filter((item) => item.representativeId === representativeId).map((item) => ({ id: item.id, type: "begeleiding", date: item.updatedAt, owner: "Coaching", status: item.status })),
    ...state.contactMoments.filter((item) => item.representativeId === representativeId).map((item) => ({ id: item.id, type: "contactmoment", date: item.updatedAt, owner: item.reason, status: item.status })),
    ...state.helpRequests.filter((item) => item.representativeId === representativeId).map((item) => ({ id: item.id, type: "hulpaanvraag", date: item.updatedAt, owner: item.subject, status: item.status })),
    ...state.retrainings.filter((item) => item.representativeId === representativeId).map((item) => ({ id: item.id, type: "retraining", date: item.updatedAt, owner: item.theme, status: item.status })),
    ...state.salesTrainings.filter((item) => item.participantIds.includes(representativeId)).map((item) => ({ id: item.id, type: "sales_training", date: item.updatedAt, owner: item.theme, status: item.status })),
    ...state.linkedInterventions.filter((item) => item.representativeId === representativeId).map((item) => ({ id: item.id, type: item.type, date: item.createdAt, owner: item.title, status: item.status })),
  ].filter((item) => {
    if (title === "contactmomenten") return item.type === "contactmoment";
    if (title === "hulpaanvragen") return item.type === "hulpaanvraag";
    if (title === "begeleidingen") return item.type === "begeleiding";
    if (title === "retrainingen") return item.type === "retraining";
    if (title === "sales trainingen") return item.type === "sales_training";
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="card overflow-hidden">
      <SectionTitle title={`${title[0].toUpperCase()}${title.slice(1)}`} subtitle={`Historiek en geplande items voor ${representativeName}`} />
      <div className="divide-y divide-slate-100">
        {workflowItems.map((item) => (
          <div key={item.id} className="flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><ClipboardCheck className="h-5 w-5" /></div>
            <div className="flex-1"><p className="font-semibold capitalize text-slate-900">{item.type.replace("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.date).toLocaleDateString("nl-BE")} · {item.owner}</p></div>
            <StatusBadge status={item.status} />
          </div>
        ))}
        {workflowItems.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nog geen items in deze historiek.</p>}
      </div>
    </div>
  );
}

function CoachingDetail({ id }: { id: string }) {
  const { user, managedUsers } = useSession();
  const { coachingFramework } = useConfiguration();
  const { representatives } = useRepresentatives();
  const { dataset: performanceDataset } = usePerformance();
  const workflowApi = useWorkflow();
  const { state } = workflowApi;
  const historical = coachingById(performanceDataset, id);
  const workflow = state.interventions.find((item) => item.id === id);
  const representativeId = historical?.representativeId ?? workflow?.representativeId;
  const representative = representatives.find((item) => item.id === representativeId);

  if (!representative || !canAccessRepresentative(user, representative)) {
    return <EmptyState title="Begeleiding niet gevonden" description="Deze begeleiding bestaat niet of valt buiten jouw huidige scope." />;
  }

  if (workflow) {
    return <CoachingDossierDetail intervention={workflow} representative={representative} workflowApi={workflowApi} />;
  }

  const history = coachingsForRepresentative(performanceDataset, representative.id);
  const selected = historical ?? (workflow ? workflowCoachingAsHistory(workflow, coachingFramework, managedUsers, history.at(-1)) : undefined);
  if (!selected) {
    return <EmptyState title="Geen scores beschikbaar" description="Voor deze begeleiding zijn nog geen prestatiescores bewaard." />;
  }
  const coachings = historical
    ? history
    : [...history, selected].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/begeleidingen" className="text-sm font-semibold text-brand-700">← Terug naar begeleidingen</Link>
        <StatusBadge status={historical?.status ?? "afgesloten"} />
      </div>
      <PageHeader
        eyebrow="Begeleiding"
        title={`${representative.firstName} ${representative.lastName}`}
        description={`${formatShortDate(selected.date)} · ${selected.ownerName} · ${selected.focusNames.join(", ")}`}
      />
      <PerformanceEvolution
        coachings={coachings}
        initialCoachingId={selected.id}
        representativeName={`${representative.firstName} ${representative.lastName}`}
        compact
      />
      <section className="card overflow-hidden">
        <SectionTitle title="Scores per criterium" subtitle="Detail van de geselecteerde begeleiding" />
        <div className="grid gap-3 p-5 md:grid-cols-2">
          {selected.criterionScores.map((score) => (
            <div key={`${score.focus}-${score.criterion}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{score.focus}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{score.criterion}</p>
              </div>
              <span className="text-lg font-bold text-slate-950">{score.score}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type WorkflowApi = ReturnType<typeof useWorkflow>;
type CoachingWorkflowItem = WorkflowApi["state"]["interventions"][number];

const dossierGeneralCriteria = [
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

const dossierPersonalityCriteria = [
  "Uitstraling",
  "Zelfzekerheid",
  "Leiding in gesprek",
  "Verstaanbaarheid",
  "Overtuigend",
  "Respect",
  "Persoonlijke verzorging",
];

function defaultDossierState() {
  return {
    arrivalTime: "",
    departureTime: "",
    kilometers: "",
    area: "",
    sector: "",
    groupAttentionPoints: ["", "", ""],
    individualAttentionPoint: "",
    generalScores: dossierGeneralCriteria.map((criterion) => ({ criterion, score: "nvt" as const, comment: "" })),
    personalityScores: dossierPersonalityCriteria.map((criterion) => ({ criterion, score: "nvt" as const, comment: "" })),
  };
}

function emptyAppointment(appointmentCriteria: string[]) {
  return {
    id: `appointment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    customer: "",
    customerNumber: "",
    place: "",
    relationType: "prospect" as const,
    appointmentType: "vast" as const,
    arrivalTime: "",
    departureTime: "",
    activity: "",
    scores: appointmentCriteria.map((criterion) => ({ criterion, score: "nvt" as const, comment: "" })),
    remarks: "",
  };
}

function CoachingDossierDetail({
  intervention,
  representative,
  workflowApi,
}: {
  intervention: CoachingWorkflowItem;
  representative: Representative;
  workflowApi: WorkflowApi;
}) {
  const { user, managedUsers } = useSession();
  const { coachingFramework } = useConfiguration();
  const appointmentCriteria = coachingFramework.flatMap((focus) =>
    focus.criteria.map((criterion) => `${focus.name} - ${criterion}`)
  );
  const readOnly = ["gefinaliseerd", "afgesloten"].includes(intervention.status) || user.role === "REPRESENTATIVE";
  const [local, setLocal] = useState(intervention);
  const [message, setMessage] = useState<string>();
  const [openAppointmentId, setOpenAppointmentId] = useState<string>();

  const dossier = local.dossier ?? defaultDossierState();
  const appointments = (local.appointments ?? []).filter((item) => !item.isDeleted);
  const totalCoachingScore = calculateTotalCoachingScore(dossier, appointments);

  function persist(status: "in_uitvoering" | "gesloten" | "gefinaliseerd") {
    const saved = workflowApi.saveCoachingStatus({
      id: local.id,
      representativeId: local.representativeId,
      initiatorId: user.id,
      plannedDate: local.plannedDate,
      startTime: local.startTime,
      endTime: local.endTime,
      notifyRepresentative: local.notifyRepresentative,
      focusNames: local.focusNames,
      scores: local.scores,
      actionPoints: local.actionPoints.map((action) => ({
        title: action.title,
        type: action.type,
        due: action.due,
        owner: action.owner,
        priority: action.priority,
      })),
      dossier: local.dossier,
      appointments: local.appointments,
    }, status);
    setLocal(saved);
    setMessage(status === "gefinaliseerd" ? "Begeleiding gefinaliseerd. Scores, opmerkingen en actiepunten zijn zichtbaar voor de vertegenwoordiger." : `Begeleiding opgeslagen als ${status.replace("_", " ")}.`);
  }

  function updateDossier(partial: Partial<typeof dossier>) {
    setLocal((current) => ({ ...current, dossier: { ...(current.dossier ?? defaultDossierState()), ...partial } }));
  }

  function updateSimpleScore(group: "generalScores" | "personalityScores", index: number, patch: Partial<typeof dossier.generalScores[number]>) {
    setLocal((current) => ({
      ...current,
      dossier: {
        ...(current.dossier ?? defaultDossierState()),
        [group]: (current.dossier ?? defaultDossierState())[group].map((score, scoreIndex) => scoreIndex === index ? { ...score, ...patch } : score),
      },
    }));
  }

  function addActionPoint() {
    setLocal((current) => ({
      ...current,
      actionPoints: [
        ...current.actionPoints,
        { id: `action-${Date.now()}`, title: "", type: "vaardigheid", due: "", status: "open", owner: user.id, priority: "normaal" },
      ],
    }));
  }

  function addAppointment() {
    const appointment = emptyAppointment(appointmentCriteria);
    setLocal((current) => ({ ...current, appointments: [...(current.appointments ?? []), appointment] }));
    setOpenAppointmentId(appointment.id);
  }

  function updateAppointment(id: string, patch: Partial<CoachingAppointment>) {
    setLocal((current) => ({
      ...current,
      appointments: (current.appointments ?? []).map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  }

  function updateAppointmentScore(id: string, index: number, patch: { score?: 0 | 1 | 2 | 3 | 4 | 5 | "nvt"; comment?: string }) {
    setLocal((current) => ({
      ...current,
      appointments: (current.appointments ?? []).map((item) =>
        item.id === id
          ? { ...item, scores: item.scores.map((score, scoreIndex) => scoreIndex === index ? { ...score, ...patch } : score) }
          : item
      ),
    }));
  }

  function removeAppointment(id: string) {
    setLocal((current) => ({
      ...current,
      appointments: (current.appointments ?? []).map((item) => item.id === id ? { ...item, isDeleted: true } : item),
    }));
    setOpenAppointmentId((current) => current === id ? undefined : current);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/begeleidingen" className="text-sm font-semibold text-brand-700">← Terug naar begeleidingen</Link>
        <StatusBadge status={local.status} />
      </div>
      <PageHeader
        eyebrow="Begeleidingsdossier"
        title={`${representative.firstName} ${representative.lastName}`}
        description={`${formatShortDate(local.plannedDate)} · ${local.startTime ?? ""}-${local.endTime ?? ""} · ${reportingUserName(local.ownerId, managedUsers)}`}
      />
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}

      <section className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Totale begeleiding</p>
        <p className="mt-1 text-3xl font-black text-brand-950">{formatPercentage(totalCoachingScore)}</p>
        <p className="mt-1 text-sm text-brand-800">Automatisch berekend uit 80% afspraken en 20% hoofdformulier.</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-950">Algemene gegevens</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ReadOnlyField label="Datum" value={formatShortDate(local.plannedDate)} />
          <ReadOnlyField label="Vertegenwoordiger" value={`${representative.firstName} ${representative.lastName}`} />
          <ReadOnlyField label="Team" value={representative.team} />
          <TextField label="Gebied" value={dossier.area} disabled={readOnly} onChange={(area) => updateDossier({ area })} />
          <TextField label="Sector" value={dossier.sector} disabled={readOnly} onChange={(sector) => updateDossier({ sector })} />
          <ReadOnlyField label="Niveau" value={representative.level} />
          <ReadOnlyField label="Verkoopleider" value={reportingUserName(local.ownerId, managedUsers)} />
          <TextField label="Aankomsttijd" type="time" value={dossier.arrivalTime} disabled={readOnly} onChange={(arrivalTime) => updateDossier({ arrivalTime })} />
          <TextField label="Vertrektijd" type="time" value={dossier.departureTime} disabled={readOnly} onChange={(departureTime) => updateDossier({ departureTime })} />
          <TextField label="Aantal kilometers" value={dossier.kilometers} disabled={readOnly} onChange={(kilometers) => updateDossier({ kilometers })} />
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-950">I. Voorbereiding</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {representative.kpis.map((kpi) => <ReadOnlyField key={kpi.label} label={kpi.label} value={`${kpi.value} / doel ${kpi.target}`} />)}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {dossier.groupAttentionPoints.map((value, index) => (
            <TextField key={index} label={`Groepsaandachtspunt ${index + 1}`} value={value} disabled={readOnly} onChange={(next) => updateDossier({ groupAttentionPoints: dossier.groupAttentionPoints.map((item, itemIndex) => itemIndex === index ? next : item) })} />
          ))}
          <TextField label="Individueel aandachtspunt" value={dossier.individualAttentionPoint} disabled={readOnly} onChange={(individualAttentionPoint) => updateDossier({ individualAttentionPoint })} />
        </div>
      </section>

      <ScoreSection title="II. Evaluatie algemene punten" scores={dossier.generalScores} readOnly={readOnly} onChange={(index, patch) => updateSimpleScore("generalScores", index, patch)} />
      <ScoreSection title="III. Persoonlijkheid" scores={dossier.personalityScores} readOnly={readOnly} onChange={(index, patch) => updateSimpleScore("personalityScores", index, patch)} />

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Afspraken</h2>
          {!readOnly && <button type="button" className="btn-secondary" onClick={addAppointment}><Plus className="h-4 w-4" /> Afspraak toevoegen</button>}
        </div>
        <div className="mt-4 space-y-3">
          {appointments.map((appointment, index) => (
            <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Afspraak {index + 1}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{appointment.customer || "Nieuwe afspraak"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{appointment.arrivalTime || "--:--"} - {appointment.departureTime || "--:--"} · Gemiddelde score: {formatAppointmentAverage(appointment)} / 5</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary py-2 text-xs" onClick={() => setOpenAppointmentId((current) => current === appointment.id ? undefined : appointment.id)}>
                    {openAppointmentId === appointment.id ? "Sluiten" : "Openen"}
                  </button>
                  {!readOnly && <button type="button" className="btn-secondary py-2 text-xs" onClick={() => setOpenAppointmentId(appointment.id)}>Wijzigen</button>}
                  {!readOnly && <button type="button" className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50" onClick={() => removeAppointment(appointment.id)}>Verwijderen</button>}
                </div>
              </div>
              {openAppointmentId === appointment.id && (
                <AppointmentEditor
                  appointment={appointment}
                  readOnly={readOnly}
                  onChange={(patch) => updateAppointment(appointment.id, patch)}
                  onScoreChange={(scoreIndex, patch) => updateAppointmentScore(appointment.id, scoreIndex, patch)}
                />
              )}
              <div className="hidden">
                <TextField label="Klant" value={appointment.customer} disabled={readOnly} onChange={(customer) => setLocal((current) => ({ ...current, appointments: current.appointments!.map((item) => item.id === appointment.id ? { ...item, customer } : item) }))} />
                <ReadOnlyField label="Type" value={`${appointment.relationType} · ${appointment.appointmentType}`} />
                <TextField label="Activiteit" value={appointment.activity} disabled={readOnly} onChange={(activity) => setLocal((current) => ({ ...current, appointments: current.appointments!.map((item) => item.id === appointment.id ? { ...item, activity } : item) }))} />
              </div>
            </div>
          ))}
          {appointments.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nog geen afspraken toegevoegd.</p>}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Actiepunten</h2>
          {!readOnly && <button type="button" className="btn-secondary" onClick={addActionPoint}><Plus className="h-4 w-4" /> Actiepunt</button>}
        </div>
        <div className="mt-4 grid gap-3">
          {local.actionPoints.map((action, index) => (
            <div key={action.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_160px_150px_140px]">
              <TextField label="Omschrijving" value={action.title} disabled={readOnly} onChange={(title) => setLocal((current) => ({ ...current, actionPoints: current.actionPoints.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) }))} />
              <TextField label="Deadline" type="date" value={action.due} disabled={readOnly} onChange={(due) => setLocal((current) => ({ ...current, actionPoints: current.actionPoints.map((item, itemIndex) => itemIndex === index ? { ...item, due } : item) }))} />
              <ReadOnlyField label="Prioriteit" value={action.priority ?? "normaal"} />
              <StatusBadge status={action.status} />
            </div>
          ))}
          {local.actionPoints.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nog geen actiepunten.</p>}
        </div>
      </section>

      {!readOnly && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => persist("in_uitvoering")}>Opslaan</button>
          <button type="button" className="btn-secondary" onClick={() => persist("gesloten")}>Sluiten</button>
          <button type="button" className="btn-primary" onClick={() => persist("gefinaliseerd")}>Finaliseren</button>
        </div>
      )}
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><input type={type} className="field" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-900">{value || "-"}</p></div>;
}

function ScoreSection({ title, scores, readOnly, onChange }: { title: string; scores: { criterion: string; score: 0 | 1 | 2 | 3 | 4 | 5 | "nvt"; comment: string }[]; readOnly: boolean; onChange: (index: number, patch: { score?: 0 | 1 | 2 | 3 | 4 | 5 | "nvt"; comment?: string }) => void }) {
  const options = [0, 1, 2, 3, 4, 5, "nvt"] as const;
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">
        {scores.map((item, index) => (
          <div key={item.criterion} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[220px_1fr_1.4fr] lg:items-center">
            <p className="font-semibold text-slate-900">{item.criterion}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <button key={option} type="button" disabled={readOnly} onClick={() => onChange(index, { score: option })} className={`rounded-lg border px-3 py-2 text-sm font-bold ${item.score === option ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{option === "nvt" ? "NVT" : option}</button>
              ))}
            </div>
            <input className="field" disabled={readOnly} placeholder="Opmerking" value={item.comment} onChange={(event) => onChange(index, { comment: event.target.value })} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AppointmentEditor({
  appointment,
  readOnly,
  onChange,
  onScoreChange,
}: {
  appointment: CoachingAppointment;
  readOnly: boolean;
  onChange: (patch: Partial<CoachingAppointment>) => void;
  onScoreChange: (index: number, patch: { score?: 0 | 1 | 2 | 3 | 4 | 5 | "nvt"; comment?: string }) => void;
}) {
  const options = [1, 2, 3, 4, 5, "nvt"] as const;
  return (
    <div className="mb-4 rounded-2xl border border-brand-100 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-5">
        <TextField label="Klantnaam" value={appointment.customer} disabled={readOnly} onChange={(customer) => onChange({ customer })} />
        <TextField label="Klantnummer" value={appointment.customerNumber ?? ""} disabled={readOnly} onChange={(customerNumber) => onChange({ customerNumber })} />
        <TextField label="Plaats" value={appointment.place ?? ""} disabled={readOnly} onChange={(place) => onChange({ place })} />
        <TextField label="Startuur" type="time" value={appointment.arrivalTime} disabled={readOnly} onChange={(arrivalTime) => onChange({ arrivalTime })} />
        <TextField label="Einduur" type="time" value={appointment.departureTime} disabled={readOnly} onChange={(departureTime) => onChange({ departureTime })} />
      </div>
      <div className="mt-4 grid gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Beoordeling afspraak</p>
        {appointment.scores.map((score, index) => (
          <div key={`${score.criterion}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(180px,1fr)_260px_minmax(220px,1fr)] lg:items-center">
            <p className="text-sm font-semibold text-slate-900">{score.criterion}</p>
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onScoreChange(index, { score: option })}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${score.score === option ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {option === "nvt" ? "NVT" : option}
                </button>
              ))}
            </div>
            <input className="field" disabled={readOnly} placeholder="Opmerking per criterium" value={score.comment} onChange={(event) => onScoreChange(index, { comment: event.target.value })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function numericScore(value: 0 | 1 | 2 | 3 | 4 | 5 | "nvt") {
  return value === "nvt" ? undefined : value;
}

function averageFive(scores: { score: 0 | 1 | 2 | 3 | 4 | 5 | "nvt" }[]) {
  const values: number[] = scores.flatMap((item) => {
    const score = numericScore(item.score);
    return score === undefined ? [] : [score];
  });
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function formatAppointmentAverage(appointment: { scores: { score: 0 | 1 | 2 | 3 | 4 | 5 | "nvt" }[] }) {
  const average = averageFive(appointment.scores);
  return average === undefined ? "-" : average.toLocaleString("nl-BE", { maximumFractionDigits: 1 });
}

function calculateTotalCoachingScore(dossier: CoachingDossier, appointments: CoachingAppointment[]) {
  const appointmentAverages = appointments.flatMap((appointment) => {
    const average = averageFive(appointment.scores);
    return average === undefined ? [] : [average];
  });
  const appointmentScore = appointmentAverages.length
    ? appointmentAverages.reduce((sum, value) => sum + value, 0) / appointmentAverages.length
    : undefined;
  const mainScore = averageFive([...dossier.generalScores, ...dossier.personalityScores]);
  if (appointmentScore === undefined && mainScore === undefined) return undefined;
  if (appointmentScore === undefined) return (mainScore ?? 0) * 20;
  if (mainScore === undefined) return appointmentScore * 20;
  return (appointmentScore * 20 * 0.8) + (mainScore * 20 * 0.2);
}

function formatPercentage(value?: number) {
  return value === undefined ? "-" : `${Math.round(value)}%`;
}

function InterventionList({ kind }: { kind: string }) {
  const { user, managedUsers } = useSession();
  const { visibleInterventions } = useWorkflow();
  const { representatives } = useRepresentatives();
  const { dataset: performanceDataset } = usePerformance();
  const labels: Record<string, { title: string; description: string; icon: typeof ClipboardCheck }> = {
    begeleidingen: { title: "Begeleidingen", description: "Bereid coaching voor, scoor gericht en volg afspraken op.", icon: ClipboardCheck },
    contactmomenten: { title: "Contactmomenten", description: "Korte, gestructureerde opvolging tussen begeleidingen.", icon: Phone },
    retrainingen: { title: "Retrainingen", description: "Gerichte bijscholing gekoppeld aan concrete ontwikkelbehoeften.", icon: GraduationCap },
    "sales-trainingen": { title: "Sales trainingen", description: "Plan en registreer trainingen voor personen of teams.", icon: Sparkles },
  };
  const current = labels[kind];
  const Icon = current.icon;
  const todayKey = new Date().toISOString().slice(0, 10);
  const historicalRows = kind === "begeleidingen"
    ? performanceDataset.historicalCoachings
      .filter((item) => {
        const representative = representatives.find((person) => person.id === item.representativeId);
        return representative ? canAccessRepresentative(user, representative) : false;
      })
      .map((item) => {
        const representative = representativeForCoaching(item, representatives)!;
        return {
          id: item.id,
          type: "begeleiding",
          person: `${representative.firstName} ${representative.lastName}`,
          date: formatShortDate(item.date),
          owner: item.ownerName,
          status: item.status,
          editable: false,
          detailHref: `/begeleidingen/${item.id}`,
          plannedDate: item.date,
          startTime: "",
          endTime: "",
          executionAt: executionTimestamp(item.date),
        };
      })
    : [];
  const workflowRows = kind === "begeleidingen"
    ? visibleInterventions(user).map((item) => {
      const representative = representatives.find((person) => person.id === item.representativeId);
      return {
        id: item.id,
        type: "begeleiding",
        person: representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend",
        date: formatShortDate(item.plannedDate ?? item.updatedAt.slice(0, 10)),
        owner: reportingUserName(item.ownerId, managedUsers),
        status: item.status,
        editable: !["gefinaliseerd", "afgesloten"].includes(item.status),
        detailHref: `/begeleidingen/${item.id}`,
        plannedDate: item.plannedDate ?? item.updatedAt.slice(0, 10),
        startTime: item.startTime ?? "",
        endTime: item.endTime ?? "",
        executionAt: executionTimestamp(`${item.plannedDate ?? item.updatedAt.slice(0, 10)}T${item.startTime ?? "00:00"}`),
      };
    })
    : [];
  const workflowIds = new Set(workflowRows.map((item) => item.id));
  const allRows = [
    ...workflowRows,
    ...historicalRows.filter((item) => !workflowIds.has(item.id)),
  ];
  const todayRows = allRows
    .filter((item) => !["gefinaliseerd", "afgesloten"].includes(item.status) && item.plannedDate === todayKey)
    .sort((left, right) => left.executionAt - right.executionAt);
  const plannedRows = allRows
    .filter((item) => !["gefinaliseerd", "afgesloten"].includes(item.status) && item.plannedDate > todayKey)
    .sort((left, right) => left.executionAt - right.executionAt);
  const completedRows = allRows
    .filter((item) => ["gefinaliseerd", "afgesloten"].includes(item.status))
    .sort((left, right) => right.executionAt - left.executionAt);

  function renderRows(items: typeof allRows, emptyMessage: string) {
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="card p-5">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{item.person}</p><p className="mt-1 text-sm text-slate-500">{item.date} · {item.owner}</p></div>
              <StatusBadge status={item.status} />
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Begeleidingsdossier</span>
              {item.editable ? (
                <Link href={item.detailHref} className="text-sm font-semibold text-brand-700">Open dossier</Link>
              ) : item.detailHref ? (
                <Link href={item.detailHref} className="text-sm font-semibold text-brand-700">Bekijk verslag</Link>
              ) : (
                <span className="text-sm font-semibold text-slate-400">Bewaard</span>
              )}
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Interventies"
        title={current.title}
        description={current.description}
        actions={can(user, "intervention:create") ? <Link href={kind === "begeleidingen" ? "/begeleidingen/nieuw" : "#"} className="btn-primary"><Plus className="h-4 w-4" /> Nieuwe begeleiding</Link> : undefined}
      />
      <div className="card p-4"><div className="grid gap-3 md:grid-cols-[1fr_180px_180px]"><label className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="field pl-10" placeholder="Zoeken..." /></label><select className="field"><option>Alle statussen</option><option>Gepland</option><option>Afgesloten</option></select><select className="field"><option>Komende 30 dagen</option><option>Dit kwartaal</option></select></div></div>
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Vandaag</p>
            <h2 className="text-xl font-bold text-slate-950">Begeleidingen van vandaag</h2>
            <p className="mt-1 text-sm text-slate-500">Gesorteerd op beginuur.</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{todayRows.length}</span>
        </div>
        {renderRows(todayRows, "Er zijn vandaag geen begeleidingen gepland.")}
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Toekomst</p>
            <h2 className="text-xl font-bold text-slate-950">Toekomstige begeleidingen</h2>
            <p className="mt-1 text-sm text-slate-500">Datum en uur oplopend.</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{plannedRows.length}</span>
        </div>
        {renderRows(plannedRows, "Er zijn momenteel geen toekomstige begeleidingen.")}
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Historiek</p>
            <h2 className="text-xl font-bold text-slate-950">Uitgevoerde begeleidingen</h2>
            <p className="mt-1 text-sm text-slate-500">Historiek, nieuwste eerst.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{completedRows.length}</span>
        </div>
        {renderRows(completedRows, "Er zijn nog geen afgesloten begeleidingen.")}
      </section>
    </div>
  );
}

function workflowCoachingAsHistory(
  intervention: ReturnType<typeof useWorkflow>["state"]["interventions"][number],
  coachingFramework: ReturnType<typeof useConfiguration>["coachingFramework"],
  managedUsers: ReturnType<typeof useSession>["managedUsers"],
  previous?: HistoricalCoaching
): HistoricalCoaching {
  const scoreByFocus = new Map<string, number[]>();
  const appointmentCriterionScores = appointmentScoresAsCriterionScores(intervention.appointments ?? []);
  for (const score of appointmentCriterionScores.length ? [] : intervention.scores) {
    if (score.value === "NVT") continue;
    scoreByFocus.set(score.focus, [...(scoreByFocus.get(score.focus) ?? []), score.value]);
  }
  const phaseScores = coachingFramework.map((focus) => {
    const values = scoreByFocus.get(focus.name);
    const fallback = previous?.phaseScores.find((item) => item.label === focus.name)?.score ?? 50;
    return {
      label: focus.name,
      score: values?.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : fallback,
    };
  });
  return {
    id: intervention.id,
    representativeId: intervention.representativeId,
    date: intervention.updatedAt.slice(0, 10),
    ownerId: intervention.ownerId,
    ownerName: reportingUserName(intervention.ownerId, managedUsers),
    status: "afgesloten",
    focusNames: intervention.focusNames,
    phaseScores,
    generalScores: previous?.generalScores ?? [],
    criterionScores: appointmentCriterionScores.length
      ? appointmentCriterionScores
      : intervention.scores
        .filter((score) => score.value !== "NVT")
        .map((score) => ({ focus: score.focus, criterion: score.criterion, score: score.value as number })),
  };
}

function appointmentScoresAsCriterionScores(appointments: NonNullable<ReturnType<typeof useWorkflow>["state"]["interventions"][number]["appointments"]>) {
  const grouped = new Map<string, { focus: string; criterion: string; values: number[] }>();
  for (const appointment of appointments.filter((item) => !item.isDeleted)) {
    for (const score of appointment.scores) {
      const value = numericScore(score.score);
      if (value === undefined) continue;
      const [focus, ...criterionParts] = score.criterion.split(" - ");
      const criterion = criterionParts.join(" - ") || score.criterion;
      const key = `${focus}::${criterion}`;
      const current = grouped.get(key) ?? { focus, criterion, values: [] };
      current.values.push(value * 20);
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].map((item) => ({
    focus: item.focus,
    criterion: item.criterion,
    score: Math.round(item.values.reduce((sum, value) => sum + value, 0) / item.values.length),
  }));
}

function ActionPoints() {
  const { user } = useSession();
  const { visibleInterventions, visibleContactMoments, visibleRetrainings, visibleSalesTrainings } = useWorkflow();
  const { representatives } = useRepresentatives();
  const { dataset: performanceDataset } = usePerformance();
  const [status, setStatus] = useState("all");
  const seededActions = performanceDataset.historicalActionPoints.flatMap((action) => {
    const representative = representatives.find((item) => item.id === action.representativeId);
    if (!representative || !canAccessRepresentative(user, representative)) return [];
    return [{
      id: action.id,
      person: `${representative.firstName} ${representative.lastName}`,
      title: action.title,
      type: action.type,
      priority: action.status === "achterstallig" ? "hoog" : "normaal",
      status: action.status,
      due: formatShortDate(action.due),
      progress: action.progress,
    }];
  });
  const workflowActions = visibleInterventions(user).flatMap((intervention) => {
    const representative = representatives.find((item) => item.id === intervention.representativeId);
    return intervention.actionPoints.map((action) => ({
      id: action.id,
      person: representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend",
      title: action.title,
      type: action.type,
      priority: "normaal",
      status: action.status,
      due: action.due || "Geen datum",
      progress: action.status === "behaald" ? 100 : action.status === "in_uitvoering" ? 50 : 10,
    }));
  });
  const contactActions = visibleContactMoments(user).flatMap((contact) => {
    const representative = representatives.find((item) => item.id === contact.representativeId);
    return contact.actionPoints.map((action) => ({
      id: action.id,
      person: representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend",
      title: action.title,
      type: action.type,
      priority: "normaal",
      status: action.status,
      due: action.due || "Geen datum",
      progress: action.status === "behaald" ? 100 : action.status === "in_uitvoering" ? 50 : 10,
    }));
  });
  const retrainingActions = visibleRetrainings(user).flatMap((retraining) => {
    const representative = representatives.find((item) => item.id === retraining.representativeId);
    return retraining.actionPoints.map((action) => ({
      id: action.id,
      person: representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend",
      title: action.title,
      type: action.type,
      priority: "normaal",
      status: action.status,
      due: action.due || "Geen datum",
      progress: action.status === "behaald" ? 100 : action.status === "in_uitvoering" ? 50 : 10,
    }));
  });
  const trainingActions = visibleSalesTrainings(user).flatMap((training) =>
    training.actionPoints.map((action) => ({
      id: action.id,
      person: action.scope === "group"
        ? `${action.representativeIds.length} deelnemers`
        : (() => {
            const representative = representatives.find((item) => item.id === action.representativeIds[0]);
            return representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend";
          })(),
      title: action.title,
      type: action.type,
      priority: "normaal",
      status: action.status,
      due: action.due || "Geen datum",
      progress: action.status === "behaald" ? 100 : action.status === "in_uitvoering" ? 50 : 10,
    }))
  );
  const visible = [...workflowActions, ...contactActions, ...retrainingActions, ...trainingActions, ...seededActions].filter((item) => status === "all" || item.status === status);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Opvolging" title="Actiepunten" description="Concrete KPI-, vaardigheids- en gedragsafspraken met duidelijke eigenaars en deadlines." actions={<button className="btn-primary"><Plus className="h-4 w-4" /> Actiepunt</button>} />
      <div className="card flex flex-col gap-3 p-4 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="field pl-10" placeholder="Zoek actiepunt of vertegenwoordiger..." /></label>
        <select className="field sm:max-w-52" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Alle statussen</option><option value="nieuw">Nieuw</option><option value="in_uitvoering">In uitvoering</option><option value="behaald">Behaald</option><option value="niet_behaald">Niet behaald</option><option value="achterstallig">Achterstallig</option></select>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((item) => (
          <article key={item.id} className="card p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">{item.type} · {item.priority}</p><h2 className="mt-2 font-bold text-slate-950">{item.title}</h2><p className="mt-1 text-sm text-slate-500">{item.person} · tegen {item.due}</p></div><StatusBadge status={item.status} /></div>
            <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>Voortgang</span><span>{item.progress}%</span></div><div className="h-2.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-700 transition-all" style={{ width: `${item.progress}%` }} /></div></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Planning() {
  return <PlanningCalendar />;
}

function Management({ section }: { section: string }) {
  const { user } = useSession();
  if (section === "gebruikers") {
    return canAccessUserManagement(user)
      ? <UsersManagementPage />
      : <ManagementRedirect />;
  }
  if (!canAccessTechnicalManagement(user)) return <ManagementRedirect />;

  const superOnly = ["rollen", "kapstok", "modules", "instellingen"].includes(section);
  if (superOnly && !canManageSystem(user)) return <EmptyState title="Super Admin vereist" description="Deze systeemconfiguratie is bewust alleen beschikbaar voor de Super Admin." />;

  if (section === "modules") return <ModuleManagement />;
  if (["teams", "rollen", "kpis", "kapstok"].includes(section)) {
    return <ConfigurationManagement section={section as "teams" | "rollen" | "kpis" | "kapstok"} />;
  }
  return <EmptyState title="Instellingen" description="Deze instellingen worden in een volgende beheeriteratie toegevoegd." />;
}

function ManagementRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}

function SimpleManagementList({ items, icon: Icon }: { items: string[]; icon: typeof Users }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => <div key={item} className="card flex items-center gap-4 p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold">{item}</p><p className="mt-1 text-xs text-slate-500">Actief · volgorde {index + 1}</p></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><MoreHorizontal className="h-5 w-5" /></button></div>)}</div>;
}

function FrameworkManagement({ coachingFramework }: { coachingFramework: ReturnType<typeof useConfiguration>["coachingFramework"] }) {
  return <div className="space-y-4">{coachingFramework.map((focus) => <div key={focus.name} className="card overflow-hidden"><div className="flex items-center gap-3 p-5"><div className={`h-10 w-2 rounded-full ${focus.color}`} /><div className="flex-1"><p className="font-bold">{focus.name}</p><p className="text-sm text-slate-500">{focus.criteria.length} criteria</p></div><button className="btn-secondary">Bewerken</button></div><div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">{focus.criteria.map((criterion, index) => <div key={criterion} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><span className="mr-2 font-bold text-slate-400">{index + 1}.</span>{criterion}</div>)}</div></div>)}</div>;
}

function ModuleManagement() {
  const { error, loading, modules, setModuleEnabled } = useModules();

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <p className="font-bold text-slate-950">Gefaseerde activatie</p>
        <p className="mt-1 text-sm text-slate-500">
          Schakel modules aan of uit zonder codewijziging. Inactieve modules verdwijnen uit menu, dashboard en routes.
        </p>
        {loading && <p className="mt-2 text-sm text-slate-500">Modules laden...</p>}
        {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
      </div>
      <div className="divide-y divide-slate-100">
        {modules.map((module) => (
          <div key={module.code} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">{module.name}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{module.code}</p>
            </div>
            <ModuleToggle
              checked={module.enabled}
              onChange={(checked) => setModuleEnabled(module.code, checked)}
              label={module.name}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} ${checked ? "deactiveren" : "activeren"}`}
      onClick={() => onChange(!checked)}
      className={`flex w-fit items-center gap-3 rounded-full border px-2 py-1 transition ${
        checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-100"
      }`}
    >
      <span className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-emerald-600" : "bg-slate-300"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </span>
      <span className={`pr-2 text-sm font-bold ${checked ? "text-emerald-700" : "text-slate-500"}`}>
        {checked ? "Actief" : "Inactief"}
      </span>
    </button>
  );
}

function ModuleInactive({ moduleName }: { moduleName: string }) {
  return (
    <EmptyState
      title="Module niet actief"
      description={`${moduleName} is momenteel gedeactiveerd in FieldForce. Een Super Admin kan deze module opnieuw activeren via Technisch Beheer > Modules.`}
    />
  );
}

function PerformanceTrendLabel({ value }: { value: -1 | 0 | 1 }) {
  const label = value > 0 ? "Stijgend" : value < 0 ? "Dalend" : "Stabiel";
  const style = value > 0
    ? "bg-emerald-50 text-emerald-700"
    : value < 0
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      <Trend value={value} /> {label}
    </span>
  );
}

function formatShortDate(value?: string) {
  if (!value) return "Nog niet";
  return new Date(`${value}T12:00:00`).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function executionTimestamp(value?: string) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (value.toLowerCase() === "vandaag") return new Date(2026, 5, 15, 12).getTime();

  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) return directDate.getTime();

  const match = value.toLowerCase().match(
    /^(\d{1,2})\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\s+(\d{4})$/
  );
  if (!match) return Number.MAX_SAFE_INTEGER;

  const monthIndex: Record<string, number> = {
    jan: 0,
    feb: 1,
    mrt: 2,
    apr: 3,
    mei: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    okt: 9,
    nov: 10,
    dec: 11,
  };
  return new Date(Number(match[3]), monthIndex[match[2]], Number(match[1]), 12).getTime();
}

function formatKpiValue(value: number, unit: "%" | "EUR" | "number") {
  if (unit === "%") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 1 })}%`;
  if (unit === "EUR") return `€ ${value.toLocaleString("nl-BE", { maximumFractionDigits: 0 })}`;
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}

function SectionTitle({ title, subtitle, link }: { title: string; subtitle: string; link?: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></div>{link && <Link href={link} className="flex items-center gap-1 text-sm font-semibold text-brand-700">Alles <ArrowRight className="h-4 w-4" /></Link>}</div>;
}
