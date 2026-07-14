"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Contact,
  FileDown,
  Filter,
  GraduationCap,
  LoaderCircle,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
  Target,
  Users,
  UsersRound,
  X,
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
import { SmartDashboardPanel, SmartTeamHeatmap } from "@/components/smart-coaching-dashboard";
import { ActivityHistoryCard } from "@/components/activity-history-card";
import { PerformanceEvolution } from "@/components/performance-evolution";
import { PerformanceWheel } from "@/components/charts/PerformanceWheel";
import { UsersManagementPage } from "@/components/user-management";
import { PlanningCalendar } from "@/components/planning-calendar";
import { ConfigurationManagement } from "@/components/configuration-management";
import { SettingsManagement } from "@/components/settings-management";
import { SessionFailure } from "@/components/session-state";
import { Avatar, EmptyState, PageHeader, StatusBadge, Trend } from "@/components/ui";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import { branding } from "@/config/branding";
import {
  can,
  canAccessRepresentative,
  canViewTeamDashboard,
  roleLabels,
} from "@/lib/permissions";
import {
  canAccessManagementSection,
  getDefaultManagementSection,
} from "@/lib/management-access";
import {
  canAccessCoachingModuleNavigation,
  canAccessDashboard,
  canAccessMyTeamNavigation,
} from "@/lib/navigation-access";
import { buildReportingDataset, filterReportingDataset, emptyReportingFilters, reportingUserName } from "@/lib/reporting";
import { buildSmartCoaching } from "@/lib/smart-coaching";
import {
  buildDashboardAttentionSections,
  type DashboardAttentionItem,
  type DashboardAttentionSections,
} from "@/lib/dashboard-attention";
import {
  getVisibleRepresentatives,
  getVisibleWorkflowState,
} from "@/lib/data-access";
import { moduleForRoute } from "@/lib/modules";
import {
  getFicheTimelineItemTypes,
  getVisibleFicheSections,
  getVisibleFicheTabs,
  type FicheSectionId,
  type FicheTimelineItemType,
} from "@/lib/my-team-fiche-visibility";
import {
  coachingById,
  coachingsForRepresentative,
  criterionScoresFromRows,
  hasCoachingScoreData,
  latestHistoricalCoaching,
  latestScoredCoaching,
  mergeCriterionScores,
  normalizePerformanceScore,
  performanceTrend,
  representativeForCoaching,
} from "@/lib/performance-data";
import type { HistoricalCoaching } from "@/lib/performance-data";
import {
  buildHistoricalScoreLookup,
  historicalScoreKey,
  type HistoricalComparisonResponse,
  type HistoricalScoreReference,
} from "@/lib/coaching/historical-comparison";
import { translate, type TranslationKey } from "@/lib/i18n";
import {
  canShowPlannedCoachingIndicator,
  type MyTeamMember,
} from "@/lib/my-team";
import type { ActionPointProductOption, ActionPointTargetTypeOption, CoachingAppointment, CoachingDossier, CoachingIntervention, CoachingSimpleScore, PersonalCoachingCriterion, Representative, ScopedActionDefinition, WorkflowScore } from "@/lib/types";
import {
  canEditFutureCoachingPlanning,
  canManageCoaching,
  coachingOpenHref,
} from "@/lib/coaching/access";
import {
  buildCoachingScopeGroups,
  type CoachingScopeCountryGroup,
  type CoachingScopeGroupItem,
  type CoachingScopeTeamGroup,
} from "@/lib/coaching/scope-groups";
import {
  canOpenCoachingDetail,
  completedCoachingStatuses,
  dedupeById,
  localDateKey,
} from "@/lib/coaching/visibility";
import { approvalHasCompletedReflection } from "@/lib/coaching/approval-reflection";
import { toPersistableCoachingActionPoints } from "@/lib/coaching/action-point-persistence";
import {
  hasHtmlMarkup,
  isBlankRichText,
  richTextToPlainText,
} from "@/lib/rich-text";
import {
  actionPointScopeLabel,
  canAccessActionPointsOverview,
  canCloseConcreteActionPoint,
  canCreateActionPointDefinition,
  canManageActionPointDefinitions,
  canManageScopedActionDefinition,
  canViewActionPointUserTab,
  groupActionPointsByRepresentative,
  groupActionPointsByScope,
  splitActionPointSections,
  type ActionPointOverviewItem,
  type ActionPointScopeGroup,
  type ActionPointUserGroup,
} from "@/lib/action-points/visibility";

const newHelpRequestStatuses = new Set(["open", "nieuw"]);
const untreatedHelpRequestStatuses = new Set(["open", "nieuw", "in_behandeling"]);
const handledHelpRequestStatuses = new Set([
  "begeleiding",
  "contactmoment",
  "retraining",
  "salestraining",
  "gesloten",
  "ingetrokken",
  "afgesloten",
  "geannuleerd",
  "vervolgactie_gepland",
]);

export function WorkspacePage({ segments }: { segments: string[] }) {
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const { isModuleEnabled } = useModules();
  const path = segments.join("/");
  const routeModule = moduleForRoute(segments[0] ?? "");

  if (sessionLoading) {
    return <EmptyState title="Gebruikerssessie laden" description="De actieve gebruiker en rechten worden uit MariaDB opgehaald." />;
  }
  if (sessionError) {
    return <SessionFailure />;
  }
  if (!user.id) {
    return <EmptyState title="Aanmelden vereist" description="Je wordt doorgestuurd naar de loginpagina." />;
  }
  if (routeModule && !isModuleEnabled(routeModule.code)) {
    return <ModuleInactive moduleName={routeModule.name} />;
  }
  if (routeModule && !canAccessCoachingModuleNavigation(user, routeModule.code)) {
    return <EmptyState title="Geen toegang" description={`${routeModule.name} is niet beschikbaar voor jouw huidige rechten.`} />;
  }

  if (path === "dashboard") {
    return canAccessDashboard(user)
      ? <Dashboard />
      : <EmptyState title="Geen toegang" description="Dashboard is niet beschikbaar voor jouw huidige rechten." />;
  }
  if (path === "mijn-gegevens") return <MyProfilePage />;
  if (path === "taken-vandaag") return <TodayTasksPage />;
  if (segments[0] === "salesday") return <PlaceholderWorkspace title="Salesday" description="Deze module wordt later geïntegreerd in FieldForce. De menu-link is al voorbereid als tijdelijke route." />;
  if (segments[0] === "pst") return <PlaceholderWorkspace title="PST" description="Deze module wordt later geïntegreerd in FieldForce. De menu-link is al voorbereid als tijdelijke route." />;
  if (segments[0] === "contract") return <PlaceholderWorkspace title="Contract" description="Deze module wordt later geïntegreerd in FieldForce. De menu-link is al voorbereid als tijdelijke route." />;
  if (segments[0] === "service") return <PlaceholderWorkspace title="Service" description="Deze module wordt later geïntegreerd in FieldForce. De menu-link is al voorbereid als tijdelijke route." />;
  if (segments[0] === "mijn-team") {
    if (!isModuleEnabled("BEGELEIDINGEN") || !canAccessMyTeamNavigation(user)) {
      return <EmptyState title="Geen toegang" description="Mijn Team is alleen beschikbaar voor gebruikers met een team- of beheerscope." />;
    }
    if (segments[1] === "gebruiker" && segments[2]) {
      return <TeamMemberDetail id={segments[2]} />;
    }
    return segments[1]
      ? <RepresentativeDetail id={segments[1]} teamMode />
      : <MyTeamPage />;
  }
  if (segments[0] === "mijn-reflecties") return <MyReflectionsPage id={segments[1]} />;
  if (segments[0] === "mijn-verslagen") return <MyReportsPage id={segments[1]} />;
  if (segments[0] === "contactmomenten") return <ContactMomentsPage id={segments[1] === "nieuw" ? undefined : segments[1]} isNew={segments[1] === "nieuw"} />;
  if (segments[0] === "hulpaanvragen") return <HelpRequestsWorkflowPage id={segments[1] === "nieuw" ? undefined : segments[1]} isNew={segments[1] === "nieuw"} />;
  if (segments[0] === "tussentijdse-evaluaties") return <StarterEvaluationsPage />;
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
  if (path === "actiepunten") {
    if (!can(user, "modulePreparation") || !can(user, "menu.coaching.actionPoints")) {
      return <EmptyState title="Geen toegang" description="Actiepunten zijn niet beschikbaar voor jouw huidige rechten." />;
    }
    return <ActionPoints />;
  }
  if (path === "planning") return <Planning />;
  if (segments[0] === "beheer") return <Management section={segments[1]} />;
  if (path === "begeleidingen") {
    return <InterventionList kind={path} />;
  }

  return <EmptyState title="Pagina in voorbereiding" description="Deze route is technisch beschikbaar en wordt in een volgende functionele iteratie verder ingevuld." />;
}

function StarterEvaluationsPage() {
  const milestones = [
    ["1,5 maand", "Verkoopleider plant en bereidt samen met de starter voor."],
    ["3 maanden", "Vervolg op vorige evaluatie, actiepunten en KPI-evolutie."],
    ["5 maanden", "Verkoopleider en Country Manager evalueren samen."],
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Tussentijdse evaluaties"
        description="Startersevaluaties na 1,5 maand, 3 maanden en 5 maanden."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {milestones.map(([title, description]) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-950">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">Automatische aanmaak</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          De serverjob maakt ontbrekende evaluaties idempotent aan voor actieve Starters met een ingevulde startdatum verkoopfunctie. De formulierstructuur wordt per evaluatie gesnapshot zodat latere beheerwijzigingen historische evaluaties niet aanpassen.
        </p>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          Vul in gebruikersbeheer de startdatum verkoopfunctie in bij elke Starter. Zonder die datum worden geen evaluaties gegenereerd.
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, managedUsers } = useSession();
  const { isModuleEnabled, modules } = useModules();
  const { representatives } = useRepresentatives();
  const { dataset: performanceDataset } = usePerformance();
  const [dashboardDefinitions, setDashboardDefinitions] = useState<ScopedActionDefinition[]>([]);
  const {
    visibleInterventions,
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
  const scopedInterventions = useMemo(
    () => coachingEnabled ? dedupeById(visibleInterventions(user)) : [],
    [coachingEnabled, user, visibleInterventions],
  );
  const scopedContacts = useMemo(
    () => contactsEnabled ? visibleContactMoments(user) : [],
    [contactsEnabled, user, visibleContactMoments],
  );
  const scopedHelpRequests = useMemo(
    () => helpEnabled ? visibleHelpRequests(user) : [],
    [helpEnabled, user, visibleHelpRequests],
  );
  const scopedRetrainings = useMemo(
    () => retrainingEnabled ? visibleRetrainings(user) : [],
    [retrainingEnabled, user, visibleRetrainings],
  );
  const scopedSalesTrainings = useMemo(
    () => salesTrainingEnabled ? visibleSalesTrainings(user) : [],
    [salesTrainingEnabled, user, visibleSalesTrainings],
  );
  const attentionEnabled = coachingEnabled || contactsEnabled || helpEnabled || retrainingEnabled || salesTrainingEnabled;
  const attentionSections = useMemo(
    () => buildDashboardAttentionSections({
      currentUser: user,
      interventions: scopedInterventions,
      contactMoments: scopedContacts,
      helpRequests: scopedHelpRequests,
      retrainings: scopedRetrainings,
      salesTrainings: scopedSalesTrainings,
      representativeName: (id) => {
        const representative = representatives.find((person) => person.id === id);
        return representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend";
      },
      ownerName: (id) => id ? reportingUserName(id, managedUsers) : undefined,
    }),
    [
      managedUsers,
      representatives,
      scopedContacts,
      scopedHelpRequests,
      scopedInterventions,
      scopedRetrainings,
      scopedSalesTrainings,
      user,
    ],
  );
  const scopedState = useMemo(
    () => getVisibleWorkflowState(user, state, representatives),
    [representatives, state, user]
  );
  const smartResult = useMemo(() => {
    const dataset = buildReportingDataset(scopedState, representatives, performanceDataset, managedUsers);
    const scopedDataset = filterReportingDataset(dataset, scopedRepresentatives, emptyReportingFilters, managedUsers);
    return buildSmartCoaching(scopedDataset, scopedState, undefined, managedUsers);
  }, [managedUsers, performanceDataset, representatives, scopedState, scopedRepresentatives]);
  useEffect(() => {
    if (!actionPointsEnabled || !canAccessActionPointsOverview(user, modules)) {
      setDashboardDefinitions([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/action-definitions?actorId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { definitions?: ScopedActionDefinition[] };
        if (!response.ok) throw new Error("Actiepunten konden niet worden geladen.");
        if (!cancelled) setDashboardDefinitions(payload.definitions ?? []);
      })
      .catch(() => {
        if (!cancelled) setDashboardDefinitions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [actionPointsEnabled, modules, user]);
  const definitionOpenActionCount = useMemo(
    () => splitActionPointSections(dashboardDefinitions.map((definition) => ({ ...definition, source: "definition" as const })))
      .find((section) => section.id === "open")?.items.length ?? 0,
    [dashboardDefinitions],
  );
  const scopedOtherMoments = planningEnabled ? [
    ...scopedContacts.map((item) => ({ id: `contact-${item.id}`, type: "contactmoment", person: representatives.find((person) => person.id === item.representativeId)?.firstName ?? "Onbekend", date: new Date(item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), sortAt: item.updatedAt, owner: item.ownerId, status: item.status })),
    ...scopedRetrainings.map((item) => ({ id: `retraining-${item.id}`, type: "retraining", person: representatives.find((person) => person.id === item.representativeId)?.firstName ?? "Onbekend", date: new Date(item.date || item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), sortAt: item.date || item.updatedAt, owner: item.trainer || item.initiatorId, status: item.status })),
    ...scopedSalesTrainings.map((item) => ({ id: `sales-${item.id}`, type: "sales_training", person: `${item.participantIds.length} deelnemers`, date: new Date(item.date || item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), sortAt: item.date || item.updatedAt, owner: item.trainer || item.initiatorId, status: item.status })),
    ...scopedHelpRequests.map((item) => ({ id: `help-${item.id}`, type: "hulpaanvraag", person: representatives.find((person) => person.id === item.representativeId)?.firstName ?? "Onbekend", date: new Date(item.updatedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }), sortAt: item.updatedAt, owner: item.requesterId, status: item.status })),
  ] : [];
  const upcomingMoments = dedupeById([
    ...scopedInterventions
      .filter((item) =>
        !completedCoachingStatuses.has(item.status) &&
        item.status !== "geannuleerd" &&
        (item.plannedDate ?? item.updatedAt.slice(0, 10)) >= localDateKey()
      )
      .map((item) => {
        const representative = representatives.find((person) => person.id === item.representativeId);
        const sortAt = `${item.plannedDate ?? item.updatedAt.slice(0, 10)}T${item.startTime ?? "00:00"}`;
        const personName = representative
          ? `${representative.firstName} ${representative.lastName}`
          : item.subject
            ? `${item.subject.firstName} ${item.subject.lastName}`
            : "Onbekend";
        return {
          id: `coaching-${item.id}`,
          type: "begeleiding",
          person: personName,
          date: new Date(sortAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }),
          sortAt,
          owner: reportingUserName(item.ownerId, managedUsers),
          status: item.status,
        };
      }),
    ...scopedOtherMoments,
  ])
    .sort((left, right) => left.sortAt.localeCompare(right.sortAt))
    .slice(0, 5);
  const openActionCount = actionPointsEnabled
    ? smartResult.insights.reduce((total, insight) => total + insight.openActionCount, 0) + definitionOpenActionCount
    : 0;
  const awaitingApproval = scopedInterventions.filter((item) => ["wacht_op_akkoord", "verzonden_ter_akkoord"].includes(item.status));
  const approvalCount = awaitingApproval.length;
  const attentionRequiredCount = attentionSections.todo.length;
  const metrics = [
    coachingEnabled && user.role === "REPRESENTATIVE" && { label: "Mijn Begeleidingen", value: scopedInterventions.length, icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700", href: "/begeleidingen" },
    coachingEnabled && { label: "Geplande begeleidingen", value: scopedInterventions.filter((item) => item.status === "gepland").length, icon: CalendarCheck, tone: "bg-blue-50 text-blue-700", href: "/begeleidingen" },
    actionPointsEnabled && { label: "Open actiepunten", value: openActionCount, icon: Target, tone: "bg-amber-50 text-amber-700", href: "/actiepunten" },
    contactsEnabled && { label: "Open contactmomenten", value: scopedContacts.filter((item) => item.status !== "afgesloten").length, icon: Phone, tone: "bg-sky-50 text-sky-700", href: "/contactmomenten" },
    contactsEnabled && { label: "Wachtend op VT-input", value: scopedContacts.filter((item) => item.status === "wacht_op_vt_input").length, icon: Contact, tone: "bg-violet-50 text-violet-700", href: "/contactmomenten" },
    helpEnabled && { label: "Nieuwe hulpaanvragen", value: scopedHelpRequests.filter((item) => newHelpRequestStatuses.has(item.status)).length, icon: CircleHelp, tone: "bg-rose-50 text-rose-700", href: "/hulpaanvragen" },
    helpEnabled && { label: "Zonder vervolgactie", value: scopedHelpRequests.filter((item) => !item.followUpType && untreatedHelpRequestStatuses.has(item.status) && !handledHelpRequestStatuses.has(item.status)).length, icon: Clock3, tone: "bg-amber-50 text-amber-700", href: "/hulpaanvragen" },
    coachingEnabled && { label: "Verslagen wachtend op akkoord", value: approvalCount, icon: ClipboardCheck, tone: "bg-fuchsia-50 text-fuchsia-700", href: user.role === "REPRESENTATIVE" && actionPointsEnabled ? "/mijn-verslagen" : "/begeleidingen" },
    retrainingEnabled && { label: "Geplande retrainingen", value: scopedRetrainings.filter((item) => item.status === "gepland").length, icon: GraduationCap, tone: "bg-indigo-50 text-indigo-700", href: "/retrainingen" },
    salesTrainingEnabled && { label: "Geplande sales trainingen", value: scopedSalesTrainings.filter((item) => item.status === "gepland").length, icon: Sparkles, tone: "bg-cyan-50 text-cyan-700", href: "/sales-trainingen" },
    (retrainingEnabled || salesTrainingEnabled) && { label: "Openstaande trainingen", value: [...scopedRetrainings, ...scopedSalesTrainings].filter((item) => !["afgerond", "geannuleerd"].includes(item.status)).length, icon: BookOpenCheck, tone: "bg-blue-50 text-blue-700", href: salesTrainingEnabled ? "/sales-trainingen" : "/retrainingen" },
    (retrainingEnabled || salesTrainingEnabled) && { label: "Trainingen zonder opvolgactie", value: scopedRetrainings.filter((item) => item.actionPoints.length === 0).length + scopedSalesTrainings.filter((item) => !item.followUpAction.trim()).length, icon: Target, tone: "bg-amber-50 text-amber-700", href: salesTrainingEnabled ? "/sales-trainingen" : "/retrainingen" },
    attentionEnabled && { label: "Aandacht vereist", value: attentionRequiredCount, icon: CircleHelp, tone: "bg-rose-50 text-rose-700", href: "/taken-vandaag" },
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

      {attentionEnabled && <DashboardAttentionCard sections={attentionSections} />}

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

      {teamDashboardAllowed && actionPointsEnabled && <SmartTeamHeatmap result={smartResult} />}

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {planningEnabled && <div className="card overflow-hidden">
          <SectionTitle title="Eerstvolgende momenten" subtitle="Planning voor je huidige scope" link="/planning" />
          <div className="divide-y divide-slate-100">
            {upcomingMoments.map((item) => (
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

const attentionIcons: Record<DashboardAttentionItem["type"], typeof ClipboardCheck> = {
  begeleiding: ClipboardCheck,
  contactmoment: Phone,
  retraining: GraduationCap,
  sales_training: Sparkles,
  hulpaanvraag: CircleHelp,
};

function DashboardAttentionCard({ sections, link = "/taken-vandaag" }: { sections: DashboardAttentionSections; link?: string | null }) {
  return (
    <section className="card overflow-hidden">
      <SectionTitle title="Vandaag vraagt aandacht" subtitle="Uit te voeren en uitgevoerd vandaag binnen je toegelaten scope" link={link ?? undefined} />
      <div className="grid gap-0 lg:grid-cols-2">
        <DashboardAttentionColumn
          title="Uit te voeren"
          count={sections.todo.length}
          items={sections.todo}
          emptyMessage="Er staat vandaag niets meer open in jouw scope."
        />
        <DashboardAttentionColumn
          title="Uitgevoerd"
          count={sections.done.length}
          items={sections.done}
          emptyMessage="Er is vandaag nog niets uitgevoerd binnen jouw scope."
          done
        />
      </div>
    </section>
  );
}

function DashboardAttentionColumn({
  title,
  count,
  items,
  emptyMessage,
  done = false,
}: {
  title: string;
  count: number;
  items: DashboardAttentionItem[];
  emptyMessage: string;
  done?: boolean;
}) {
  return (
    <section className={`min-w-0 ${done ? "border-t border-slate-100 lg:border-l lg:border-t-0" : ""}`}>
      <div className="flex items-center justify-between gap-3 bg-slate-50/70 px-5 py-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${done ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {count}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length > 0 ? (
          items.map((item) => <DashboardAttentionRow key={item.id} item={item} />)
        ) : (
          <p className="px-5 py-4 text-sm text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function DashboardAttentionRow({ item }: { item: DashboardAttentionItem }) {
  const Icon = attentionIcons[item.type];
  const content = (
    <>
      <div className="flex w-20 shrink-0 items-center gap-2 text-xs font-bold text-slate-500">
        <Clock3 className="h-3.5 w-3.5" />
        <span className="truncate">{item.timeLabel}</span>
      </div>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {item.typeLabel} · {item.subtitle}{item.owner ? ` · ${item.owner}` : ""}
        </p>
      </div>
      <StatusBadge status={item.status} />
    </>
  );
  const className = "flex min-h-[68px] items-center gap-3 px-5 py-3 transition hover:bg-slate-50";

  if (item.href) {
    return <Link href={item.href} className={className}>{content}</Link>;
  }

  return <div className={className}>{content}</div>;
}

function MyTeamPage() {
  const { user } = useSession();
  const { modules } = useModules();
  const { error, loading, members } = useMyTeamMembers();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const countries = useMemo(() => groupMyTeamMembers(members), [members]);
  const showPlannedCoachingIndicator = canShowPlannedCoachingIndicator(user, modules);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`mext:my-team:collapsed:${user.id}`);
      if (stored) setCollapsed(new Set(JSON.parse(stored) as string[]));
    } catch {
      setCollapsed(new Set());
    }
  }, [user.id]);

  function toggle(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      window.localStorage.setItem(`mext:my-team:collapsed:${user.id}`, JSON.stringify([...next]));
      return next;
    });
  }

  if (loading) return <EmptyState title="Mijn Team laden" description="De toegestane teamleden worden veilig opgehaald." />;
  if (error) return <EmptyState title="Mijn Team kon niet worden geladen" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mensen"
        title="Mijn Team"
        description="Actieve teamleden binnen jouw toegestane team- en landscope, gegroepeerd per land en team."
      />
      {members.length === 0 && <EmptyState title="Geen teamleden gevonden" description="Er zijn geen actieve teamleden binnen jouw huidige scope." />}

      {countries.map(({ country, teams, count }) => {
        const countryKey = `country:${country}`;
        const countryOpen = !collapsed.has(countryKey);
        return <section key={country} className="card overflow-hidden">
          <button type="button" onClick={() => toggle(countryKey)} aria-expanded={countryOpen} className="flex w-full items-center gap-3 bg-slate-50/80 px-4 py-3.5 text-left transition hover:bg-brand-50/60 sm:px-5">
            {countryOpen ? <ChevronDown className="h-5 w-5 text-brand-700" /> : <ChevronRight className="h-5 w-5 text-brand-700" />}
            <div className="min-w-0 flex-1"><p className="eyebrow">Land</p><h2 className="truncate text-lg font-bold text-slate-950">{countryName(country)}</h2></div>
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">{count} {count === 1 ? "persoon" : "personen"}</span>
          </button>
          {countryOpen && <div className="space-y-3 border-t border-slate-100 p-3 sm:p-4">
            {teams.map((team) => {
              const teamKey = `team:${team.id}`;
              const teamOpen = !collapsed.has(teamKey);
              return <section key={team.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button type="button" onClick={() => toggle(teamKey)} aria-expanded={teamOpen} className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition hover:bg-slate-50 sm:px-4">
                  {teamOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  <UsersRound className="h-4 w-4 text-brand-700" />
                  <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{team.name}</h3>
                  <span className="text-xs font-semibold text-slate-500">{team.members.length} {team.members.length === 1 ? "persoon" : "personen"}</span>
                </button>
                {teamOpen && <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {team.members.map((member) => (
                    <MyTeamMemberRow
                      key={member.id}
                      member={member}
                      showPlannedCoachingIndicator={showPlannedCoachingIndicator}
                    />
                  ))}
                </div>}
              </section>;
            })}
          </div>}
        </section>;
      })}
    </div>
  );
}

function MyTeamMemberRow({
  member,
  showPlannedCoachingIndicator,
}: {
  member: MyTeamMember;
  showPlannedCoachingIndicator: boolean;
}) {
  const hasPlannedCoaching = showPlannedCoachingIndicator && member.hasPlannedCoaching;
  return <Link href={member.profileHref} className={`grid gap-3 p-3.5 transition sm:grid-cols-[minmax(210px,1.4fr)_minmax(125px,0.7fr)_minmax(145px,0.8fr)_auto] sm:items-center sm:px-4 ${hasPlannedCoaching ? "bg-sky-50/80 hover:bg-sky-50" : "hover:bg-brand-50/40"}`}>
    <div className="flex min-w-0 items-center gap-3">
      <Avatar initials={member.initials} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-sm font-semibold text-slate-900">{member.firstName} {member.lastName}</p>{member.isTeamLeader && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">Verkoopleider</span>}{hasPlannedCoaching && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">Begeleiding gepland</span>}</div>
        <p className="mt-0.5 text-xs text-slate-500">{roleLabels[member.role]}</p>
      </div>
    </div>
    <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Algemene score</p><p className="mt-1 text-sm font-bold text-slate-800">{member.role !== "REPRESENTATIVE" ? "—" : member.overallScore === undefined ? "Nog geen score" : `${member.overallScore.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`}</p></div>
    <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Laatste begeleiding</p><p className="mt-1 text-sm text-slate-700">{member.role !== "REPRESENTATIVE" ? "Niet van toepassing" : member.lastCoaching ? formatShortDate(member.lastCoaching) : "Nog geen begeleiding"}</p></div>
    <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-700">Fiche <ChevronRight className="h-4 w-4" /></span>
  </Link>;
}

function useMyTeamMembers() {
  const { user } = useSession();
  const [members, setMembers] = useState<MyTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    fetch(`/api/my-team?actorId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { members?: MyTeamMember[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Teamleden konden niet worden geladen.");
        if (active) setMembers(payload.members ?? []);
      })
      .catch((cause) => {
        if (!active) return;
        setMembers([]);
        setError(cause instanceof Error ? cause.message : "Teamleden konden niet worden geladen.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id]);
  return { members, loading, error };
}

function groupMyTeamMembers(members: MyTeamMember[]) {
  const countries = new Map<string, Map<string, { id: string; name: string; members: MyTeamMember[] }>>();
  for (const member of members) {
    const teams = countries.get(member.country) ?? new Map();
    const team = teams.get(member.teamId) ?? { id: member.teamId, name: member.team, members: [] };
    team.members.push(member);
    teams.set(member.teamId, team);
    countries.set(member.country, teams);
  }
  return [...countries.entries()].map(([country, teams]) => ({
    country,
    teams: [...teams.values()],
    count: new Set([...teams.values()].flatMap((team) => team.members.map((member) => member.id))).size,
  }));
}

function TeamMemberDetail({ id }: { id: string }) {
  const { members, loading, error } = useMyTeamMembers();
  const member = members.find((item) => item.id === id);
  if (loading) return <EmptyState title="Gebruikersfiche laden" description="Het teamlid wordt veilig opgehaald." />;
  if (error || !member) return <EmptyState title="Geen toegang" description={error ?? "Dit teamlid valt niet binnen jouw huidige scope."} />;
  return <div className="space-y-5">
    <Link href="/mijn-team" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">← Terug naar Mijn Team</Link>
    <div className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar initials={member.initials} className="h-16 w-16 text-lg" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold text-slate-950">{member.firstName} {member.lastName}</h1>{member.isTeamLeader && <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">Verkoopleider</span>}</div><p className="mt-1 text-sm text-slate-500">{roleLabels[member.role]} · {member.team} · {countryName(member.country)}</p></div>
      </div>
    </div>
  </div>;
}

function countryName(country: string) {
  return country === "BE" ? "België" : country === "NL" ? "Nederland" : country === "DE" ? "Duitsland" : country;
}

function coachingScoreOutOfFive(coaching: HistoricalCoaching) {
  if (coaching.overallScore !== undefined) return coaching.overallScore / 20;
  const scores = coaching.phaseScores.length ? coaching.phaseScores : coaching.generalScores;
  if (!scores.length) return undefined;
  return scores.reduce((total, item) => total + item.score, 0) / scores.length / 20;
}

function coachingPerformanceStatus(coaching: HistoricalCoaching, representativeView = false) {
  if (coaching.status === "akkoord_door_vertegenwoordiger") return "Akkoord gegeven";
  if (coaching.status === "verzonden_ter_akkoord") return representativeView ? "Te bevestigen" : "Voor akkoord verzonden";
  if (coaching.wasReopened || coaching.status === "in_uitvoering") return "Aangepast na afwerking";
  return "Afgewerkt – wacht op akkoord vertegenwoordiger";
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

function RepresentativeDetail({ id, teamMode = false }: { id: string; teamMode?: boolean }) {
  const { user } = useSession();
  const { error, loading, representatives } = useRepresentatives();
  const { dataset: performanceDataset, error: performanceError } = usePerformance();
  const { modules } = useModules();
  const representative = representatives.find((item) => item.id === id);
  const [tab, setTab] = useState("overzicht");
  const visibleSections = useMemo(
    () => representative
      ? getVisibleFicheSections({ user, representative, modules })
      : new Set<FicheSectionId>(),
    [modules, representative, user]
  );
  const visibleTabs = useMemo(
    () => representative
      ? getVisibleFicheTabs({ user, representative, modules })
      : [],
    [modules, representative, user]
  );
  const activeTab = visibleTabs.some((item) => item.label === tab)
    ? tab
    : visibleTabs[0]?.label ?? "overzicht";
  const timelineItemTypes = useMemo(
    () => getFicheTimelineItemTypes(visibleSections),
    [visibleSections]
  );
  const showCoachings = visibleSections.has("coachings");
  const showActionPoints = visibleSections.has("actionPoints");
  const showPerformance = visibleSections.has("performanceCircle");
  const showKpis = visibleSections.has("kpis");

  if (loading) {
    return <EmptyState title="Vertegenwoordiger laden" description="De gegevens worden uit MariaDB opgehaald." />;
  }

  if (error) {
    return <EmptyState title="Database niet bereikbaar" description={error} />;
  }

  if (!representative || !canAccessRepresentative(user, representative)) {
    return <EmptyState title="Geen toegang" description="Deze vertegenwoordiger valt niet binnen jouw huidige rol- of teamscope." />;
  }

  const latestCompletedCoaching = latestHistoricalCoaching(performanceDataset, representative.id);
  const latestCoaching = latestScoredCoaching(performanceDataset, representative.id);
  const latestScore = latestCoaching ? coachingScoreOutOfFive(latestCoaching) : undefined;
  const scoredCoachings = coachingsForRepresentative(performanceDataset, representative.id).filter(hasCoachingScoreData);
  const representativeRoleLabel = roleLabels.REPRESENTATIVE;
  const showLevelBadge = representative.level.localeCompare(
    representativeRoleLabel,
    "nl-BE",
    { sensitivity: "base" }
  ) !== 0;

  return (
    <div className="space-y-6">
      {teamMode && <Link href="/mijn-team" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">← Terug naar Mijn Team</Link>}
      <div className="card overflow-hidden">
        <div className="flex min-h-32 items-center bg-gradient-to-r from-brand-800 via-brand-700 to-blue-500 px-5 pb-8 pt-6 sm:min-h-36 sm:px-7 sm:pb-10 sm:pt-8">
          <h1 className="ml-24 min-w-0 break-words text-2xl font-extrabold leading-tight text-white drop-shadow-sm sm:ml-32 sm:text-3xl lg:text-[34px]">
            {representative.firstName} {representative.lastName}
          </h1>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-start sm:gap-5 sm:px-7">
          <Avatar initials={representative.initials} className="-mt-10 h-24 w-24 shrink-0 border-4 border-white bg-brand-100 text-2xl shadow-lg sm:h-28 sm:w-28" />
          <div className="min-w-0 flex-1 sm:pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {representative.team}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {representative.country}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{representativeRoleLabel}</span>
              {showLevelBadge && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${representative.levelColor}`}>{representative.level}</span>}
              {showPerformance && <PerformanceTrendLabel value={performanceTrend(performanceDataset, representative.id)} />}
            </div>
          </div>
          {showCoachings && can(user, "intervention:create") && <Link href="/begeleidingen/nieuw" className="btn-primary w-full shrink-0 sm:mt-2 sm:w-auto"><Plus className="h-4 w-4" /> Begeleiding</Link>}
        </div>
        <div className="mext-horizontal-scrollbar flex min-h-[58px] gap-1 overflow-x-auto border-t border-slate-100 px-4 pt-2">
          {visibleTabs.map((item) => (
            <button key={item.id} onClick={() => setTab(item.label)} className={`min-h-12 shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold capitalize transition-colors ${activeTab === item.label ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overzicht" && (
        <>
          {(showCoachings || showPerformance) && (
            <section className={`grid gap-4 ${showCoachings && showPerformance ? "lg:grid-cols-[220px_1fr]" : ""}`}>
              {showPerformance && (
                <div className="card grid place-items-center p-5 text-center">
                  {latestCoaching && latestScore !== undefined ? <div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(#003B83 ${Math.max(0, Math.min(100, latestScore * 20))}%, #e2e8f0 0)` }}>
                    <div className="grid h-28 w-28 place-items-center rounded-full bg-white"><div><p className="text-3xl font-black text-brand-950">{latestScore.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-500">van 5</p></div></div>
                  </div> : <div><CircleHelp className="mx-auto h-10 w-10 text-amber-500" /><p className="mt-3 text-sm font-semibold text-slate-700">{latestCompletedCoaching ? "Er is een afgewerkte begeleiding, maar er werd nog geen score geregistreerd." : "Nog geen afgewerkte begeleiding beschikbaar."}</p></div>}
                </div>
              )}
              {showCoachings && (
                <div className="card p-5 sm:p-6">
                  <p className="eyebrow">Laatste begeleiding</p>
                  {latestCoaching ? <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold text-slate-950">{showPerformance && latestScore !== undefined ? `Algemene score ${latestScore.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5` : "Laatste begeleiding"}</h2><p className="mt-2 text-sm text-slate-500">{formatShortDate(latestCoaching.date)} · {latestCoaching.ownerName}</p><div className="mt-3"><StatusBadge status={latestCoaching.status} label={coachingPerformanceStatus(latestCoaching, user.role === "REPRESENTATIVE")} /></div></div><Link href={`/begeleidingen/${latestCoaching.id}`} className="btn-secondary">Begeleiding openen <ChevronRight className="h-4 w-4" /></Link></div> : latestCompletedCoaching ? <div className="mt-3"><p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{showPerformance ? "Er is een afgewerkte begeleiding, maar er werd nog geen score geregistreerd." : "Er is een afgewerkte begeleiding beschikbaar."}</p><div className="mt-3"><StatusBadge status={latestCompletedCoaching.status} label={coachingPerformanceStatus(latestCompletedCoaching, user.role === "REPRESENTATIVE")} /></div></div> : <EmptyState title="Nog geen begeleidingen beschikbaar" description="Voor deze vertegenwoordiger is nog geen afgewerkte begeleiding gevonden." />}
                </div>
              )}
            </section>
          )}
          {showKpis && (
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
          )}
          <section className={`grid gap-5 ${showActionPoints ? "xl:grid-cols-[1.3fr_1fr]" : ""}`}>
            {showActionPoints && (
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
            )}
            <div className="card p-5">
              <h2 className="font-bold text-slate-900">Contactgegevens</h2>
              <div className="mt-5 space-y-4">
                <p className="flex items-center gap-3 text-sm text-slate-600"><Mail className="h-4 w-4 text-brand-700" /> {representative.email}</p>
                <p className="flex items-center gap-3 text-sm text-slate-600"><Phone className="h-4 w-4 text-brand-700" /> {representative.phone}</p>
                {showCoachings && <p className="flex items-center gap-3 text-sm text-slate-600"><CalendarDays className="h-4 w-4 text-brand-700" /> Laatste begeleiding: {formatShortDate(latestHistoricalCoaching(performanceDataset, representative.id)?.date)}</p>}
              </div>
            </div>
          </section>
        </>
      )}
      {performanceError && (showCoachings || showActionPoints || showPerformance || showKpis) && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{performanceError}</p>}
      {activeTab === "Prestatiecirkel" && (
        scoredCoachings.length ? <PerformanceEvolution
          coachings={scoredCoachings}
          representativeName={`${representative.firstName} ${representative.lastName}`}
        /> : <EmptyState title="Geen score beschikbaar" description={latestCompletedCoaching ? "Er is een afgewerkte begeleiding, maar er werd nog geen score geregistreerd." : "Nog geen afgewerkte begeleiding beschikbaar."} />
      )}
      {activeTab === "persoonlijke criteria" && <PersonalCriteriaPanel representative={representative} />}
      {activeTab === "KPI's" && <KpiPanel representativeId={representative.id} />}
      {activeTab === "actiepunten" && <RepresentativeActionPointsPanel representativeId={representative.id} />}
      {["begeleidingen", "contactmomenten", "retrainingen", "sales trainingen", "hulpaanvragen", "tijdlijn"].includes(activeTab) && <TimelinePanel title={activeTab} representativeId={representative.id} representativeName={representative.firstName} itemTypes={timelineItemTypesForTab(activeTab, timelineItemTypes)} />}
      {activeTab === "productanalyse" && <TimelinePanel title={activeTab} representativeId={representative.id} representativeName={representative.firstName} itemTypes={[]} />}
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
    <div id="overzicht" className="space-y-5 scroll-mt-24">
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

function timelineItemTypesForTab(
  tab: string,
  visibleItemTypes: FicheTimelineItemType[]
): FicheTimelineItemType[] {
  if (tab === "begeleidingen") return visibleItemTypes.includes("begeleiding") ? ["begeleiding"] : [];
  if (tab === "contactmomenten") return visibleItemTypes.includes("contactmoment") ? ["contactmoment"] : [];
  if (tab === "retrainingen") return visibleItemTypes.includes("retraining") ? ["retraining"] : [];
  if (tab === "sales trainingen") return visibleItemTypes.includes("sales_training") ? ["sales_training"] : [];
  if (tab === "hulpaanvragen") return visibleItemTypes.includes("hulpaanvraag") ? ["hulpaanvraag"] : [];
  if (tab === "tijdlijn") return visibleItemTypes;
  return [];
}

function TimelinePanel({
  title,
  representativeId,
  representativeName,
  itemTypes,
}: {
  title: string;
  representativeId: string;
  representativeName: string;
  itemTypes: FicheTimelineItemType[];
}) {
  const { user } = useSession();
  const workflowApi = useWorkflow();
  const { dataset: performanceDataset } = usePerformance();
  const allowedTypes = new Set(itemTypes);
  const workflowItems = [...new Map([
    ...(allowedTypes.has("begeleiding")
      ? [
          ...performanceDataset.historicalCoachings
            .filter((item) => item.representativeId === representativeId)
            .map((item) => ({ id: item.id, type: "begeleiding" as const, date: item.date, owner: item.ownerName, status: item.status })),
          ...workflowApi.visibleInterventions(user)
            .filter((item) => item.representativeId === representativeId)
            .map((item) => ({ id: item.id, type: "begeleiding" as const, date: item.plannedDate ?? item.updatedAt, owner: "Coaching", status: item.status })),
        ]
      : []),
    ...(allowedTypes.has("contactmoment")
      ? [
          ...performanceDataset.historicalContactMoments
            .filter((item) => item.representativeId === representativeId)
            .map((item) => ({ id: item.id, type: "contactmoment" as const, date: item.date, owner: item.reason, status: item.status })),
          ...workflowApi.visibleContactMoments(user)
            .filter((item) => item.representativeId === representativeId)
            .map((item) => ({ id: item.id, type: "contactmoment" as const, date: item.updatedAt, owner: item.reason, status: item.status })),
        ]
      : []),
    ...(allowedTypes.has("hulpaanvraag")
      ? workflowApi.visibleHelpRequests(user)
          .filter((item) => item.representativeId === representativeId)
          .map((item) => ({ id: item.id, type: "hulpaanvraag" as const, date: item.updatedAt, owner: item.subject, status: item.status }))
      : []),
    ...(allowedTypes.has("retraining")
      ? workflowApi.visibleRetrainings(user)
          .filter((item) => item.representativeId === representativeId)
          .map((item) => ({ id: item.id, type: "retraining" as const, date: item.updatedAt, owner: item.theme, status: item.status }))
      : []),
    ...(allowedTypes.has("sales_training")
      ? workflowApi.visibleSalesTrainings(user)
          .filter((item) => item.participantIds.includes(representativeId))
          .map((item) => ({ id: item.id, type: "sales_training" as const, date: item.updatedAt, owner: item.theme, status: item.status }))
      : []),
    ...workflowApi.state.linkedInterventions
      .filter((item) =>
        item.representativeId === representativeId &&
        allowedTypes.has(item.type)
      )
      .map((item) => ({ id: item.id, type: item.type, date: item.createdAt, owner: item.title, status: item.status })),
  ].map((item) => [`${item.type}:${item.id}`, item])).values()]
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="card overflow-hidden">
      <SectionTitle title={`${title[0].toUpperCase()}${title.slice(1)}`} subtitle={`Historiek en geplande items voor ${representativeName}`} />
      <div className="divide-y divide-slate-100">
        {workflowItems.map((item) => (
          <Link key={`${item.type}:${item.id}`} href={timelineItemHref(item.type, item.id)} className="flex items-center gap-4 p-5 transition hover:bg-slate-50">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><ClipboardCheck className="h-5 w-5" /></div>
            <div className="flex-1"><p className="font-semibold capitalize text-slate-900">{item.type.replace("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.date).toLocaleDateString("nl-BE")} · {item.owner}</p></div>
            <StatusBadge status={item.status} />
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </Link>
        ))}
        {workflowItems.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{title === "begeleidingen" ? "Nog geen begeleidingen beschikbaar" : "Nog geen items in deze historiek."}</p>}
      </div>
    </div>
  );
}

function timelineItemHref(type: string, id: string) {
  if (type === "begeleiding") return `/begeleidingen/${id}`;
  if (type === "contactmoment") return `/contactmomenten/${id}`;
  if (type === "hulpaanvraag") return `/hulpaanvragen/${id}`;
  if (type === "retraining") return `/retrainingen/${id}`;
  if (type === "sales_training") return `/sales-trainingen/${id}`;
  return "/mijn-team";
}

function RepresentativeActionPointsPanel({ representativeId }: { representativeId: string }) {
  const { user } = useSession();
  const workflowApi = useWorkflow();
  const { dataset } = usePerformance();
  const workflowActions = workflowApi.visibleInterventions(user)
    .filter((item) => item.representativeId === representativeId)
    .flatMap((item) => item.actionPoints);
  const historicalActions = dataset.historicalActionPoints.filter((item) => item.representativeId === representativeId);
  const actions = dedupeById([...workflowActions, ...historicalActions])
    .sort((left, right) => (left.due || "9999-12-31").localeCompare(right.due || "9999-12-31"));
  return (
    <div className="card overflow-hidden">
      <SectionTitle title="Actiepunten" subtitle="Open en afgewerkte opvolgacties voor deze vertegenwoordiger" />
      <div className="divide-y divide-slate-100">
        {actions.map((action) => <div key={action.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{action.title}</p><p className="mt-1 text-xs text-slate-500">Deadline {action.due ? formatShortDate(action.due) : "niet ingesteld"}</p></div><StatusBadge status={action.status} /></div>)}
        {actions.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Geen actiepunten gevonden.</p>}
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
  const historical = coachingById(performanceDataset, id);
  const workflow = workflowApi.visibleInterventions(user).find((item) => item.id === id);
  const representativeId = historical?.representativeId ?? workflow?.representativeId;
  const representative = representatives.find((item) => item.id === representativeId) ?? (workflow?.subject ? coachingSubjectAsRepresentative(workflow.subject) : undefined);

  if (!representative || (!workflow && !canAccessRepresentative(user, representative))) {
    return <EmptyState title="Begeleiding niet gevonden" description="Deze begeleiding bestaat niet of valt buiten jouw huidige scope." />;
  }

  if (workflow) {
    if (!canOpenCoachingDetail(user, workflow)) {
      return <EmptyState title="Begeleiding niet beschikbaar" description="Deze begeleiding is nog niet openbaar voor jouw rol of status." />;
    }
    if (canEditFutureCoachingPlanning(user, workflow)) {
      return <CoachingPlanningRedirect id={workflow.id} />;
    }
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

function CoachingPlanningRedirect({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/begeleidingen/nieuw?id=${encodeURIComponent(id)}`);
  }, [id, router]);

  return <EmptyState title="Planning openen" description="Deze toekomstige begeleiding wordt geopend in de planning- en voorbereidingsflow." />;
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
  const [local, setLocal] = useState(intervention);
  const [message, setMessage] = useState<string>();
  const [openAppointmentId, setOpenAppointmentId] = useState<string>();
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState<{ type: "success" | "error"; text: string }>();
  const [transitioning, setTransitioning] = useState(false);
  const [historicalComparison, setHistoricalComparison] = useState<HistoricalComparisonResponse>({ options: [] });
  const [historicalComparisonId, setHistoricalComparisonId] = useState("none");
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string>();
  const t = useCallback((key: TranslationKey) => translate(user.language, key), [user.language]);
  const approval = workflowApi.state.approvals.find((item) => item.interventionId === local.id);
  const updateActionTips = useCallback((actionId: string, tipsAndTricks: string) => {
    setLocal((current) => ({
      ...current,
      actionPoints: current.actionPoints.map((item) => item.id === actionId ? { ...item, tipsAndTricks } : item),
    }));
  }, []);
  const appointmentCriteria = coachingFramework
    .filter((focus) => local.focusNames.includes(focus.name))
    .flatMap((focus) => focus.criteria.map((criterion) => `${focus.name} - ${criterion}`));

  const dossier = local.dossier ?? defaultDossierState();
  const appointments = (local.appointments ?? []).filter((item) => !item.isDeleted);
  const totalCoachingScore = calculateTotalCoachingScore(dossier, appointments);
  const isCompleted = ["voltooid", "gefinaliseerd", "gesloten", "afgesloten"].includes(local.status);
  const isApprovalLocked = ["verzonden_ter_akkoord", "akkoord_door_vertegenwoordiger"].includes(local.status);
  const canManageCurrentCoaching = canManageCoaching(user, local);
  const canManageCompleted = canManageCurrentCoaching;
  const readOnly = !canManageCurrentCoaching || isApprovalLocked || isCompleted || local.status === "geannuleerd";
  const historicalScoreLookup = useMemo(
    () => buildHistoricalScoreLookup(historicalComparison.selected?.scores ?? []),
    [historicalComparison.selected?.scores]
  );
  const currentHistoricalCoaching = useMemo(
    () => coachingInterventionAsHistory(local, dossier, appointments, reportingUserName(local.ownerId, managedUsers), totalCoachingScore),
    [appointments, dossier, local, managedUsers, totalCoachingScore]
  );
  const comparisonWheelCoachings = historicalComparison.selected
    ? [historicalComparison.selected.history, currentHistoricalCoaching]
    : [currentHistoricalCoaching];

  const loadHistoricalComparison = useCallback(async (compareId?: string) => {
    setHistoricalLoading(true);
    setHistoricalError(undefined);
    try {
      const params = new URLSearchParams({ actorId: user.id });
      if (compareId) params.set("compareId", compareId);
      const response = await fetch(
        `/api/workflows/coaching/${encodeURIComponent(local.id)}/historical-scores?${params.toString()}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as HistoricalComparisonResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? t("coaching.scores.loadHistoricalError"));
      }
      setHistoricalComparison(payload);
      setHistoricalComparisonId(payload.selectedId ?? "none");
    } catch (error) {
      setHistoricalComparison((current) => ({ ...current, selected: undefined, selectedId: undefined }));
      setHistoricalError(error instanceof Error ? error.message : t("coaching.scores.loadHistoricalError"));
      setHistoricalComparisonId("none");
    } finally {
      setHistoricalLoading(false);
    }
  }, [local.id, t, user.id]);

  useEffect(() => {
    void loadHistoricalComparison();
  }, [loadHistoricalComparison]);

  async function transition(action: "reopen" | "send_for_approval" | "approve") {
    setTransitioning(true);
    setMessage(undefined);
    try {
      const updated = await workflowApi.transitionCoaching(local.id, action);
      setLocal(updated);
      if (action === "send_for_approval") {
        setMessage("De begeleiding is verstuurd naar de vertegenwoordiger en is nu definitief vergrendeld.");
      } else {
        setMessage("Je hebt deze begeleiding voor akkoord bevestigd.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "De status kon niet worden aangepast.");
    } finally {
      setTransitioning(false);
    }
  }

  async function downloadProfessionalReport() {
    setIsExportingReport(true);
    setReportMessage(undefined);
    try {
      const previousIntervention = workflowApi.state.interventions
        .filter((item) =>
          item.id !== local.id &&
          item.representativeId === local.representativeId &&
          (item.plannedDate ?? item.createdAt) < (local.plannedDate ?? local.createdAt)
        )
        .sort((left, right) =>
          (left.plannedDate ?? left.createdAt).localeCompare(right.plannedDate ?? right.createdAt)
        )
        .at(-1);
      const { exportProfessionalCoachingReport } = await import(
        "@/lib/coaching/export-professional-report"
      );
      const result = await exportProfessionalCoachingReport({
        intervention: local,
        previousIntervention,
        approval,
        representative,
        leaderName: reportingUserName(local.ownerId, managedUsers),
        language: user.language,
      });
      void fetch(`/api/activity-history?actorId=${encodeURIComponent(user.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId: local.id, action: "pdf_exported" }),
      }).catch((auditError) => console.error("PDF-export kon niet worden gelogd", auditError));
      setReportMessage({
        type: "success",
        text: `${result.filename} is aangemaakt (${result.pageCount} pagina's).`,
      });
    } catch (error) {
      console.error("Professionele PDF-export mislukt", error);
      setReportMessage({
        type: "error",
        text: "Het professionele PDF-rapport kon niet worden aangemaakt.",
      });
    } finally {
      setIsExportingReport(false);
    }
  }

  async function persist(status: "in_uitvoering" | "gesloten" | "gefinaliseerd" | "voltooid" | "geannuleerd") {
    if (["gesloten", "gefinaliseerd", "voltooid"].includes(status)) {
      const newActions = local.actionPoints.filter((action) => action.isNew && action.title.trim());
      if (newActions.length < 1) {
        setMessage("Voeg minstens één nieuw actiepunt toe voordat je de begeleiding afsluit.");
        return;
      }
      if (newActions.some((action) => !action.tipsAndTricks?.trim() || !action.priority)) {
        setMessage("Titel, prioriteit en Tips & Tricks zijn verplicht voor elk nieuw actiepunt.");
        return;
      }
    }
    try {
      const saved = await workflowApi.saveCoachingStatus({
        id: local.id,
        representativeId: local.representativeId,
        initiatorId: user.id,
        ownerId: local.ownerId,
        plannedDate: local.plannedDate,
        startTime: local.startTime,
        endTime: local.endTime,
        notifyRepresentative: local.notifyRepresentative,
        subject: local.subject,
        internalNotes: local.internalNotes,
        focusNames: local.focusNames,
        scores: local.scores,
        actionPoints: toPersistableCoachingActionPoints(local.actionPoints),
        dossier: local.dossier,
        appointments: local.appointments,
      }, status);
      setLocal(saved);
      setMessage(
        status === "gefinaliseerd"
          ? "Begeleiding gefinaliseerd. Scores, opmerkingen en actiepunten zijn zichtbaar voor de vertegenwoordiger."
          : status === "geannuleerd"
            ? "Begeleiding geannuleerd. De gekoppelde Outlook-afspraak wordt verwijderd."
            : `Begeleiding opgeslagen als ${status.replace("_", " ")}.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Begeleiding kon niet worden opgeslagen.");
    }
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
        { id: `action-${Date.now()}`, title: "", type: "vaardigheid", due: "", status: "open", owner: user.id, priority: "normaal", tipsAndTricks: "", isNew: true },
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

  function selectHistoricalComparison(compareId: string) {
    setHistoricalComparisonId(compareId);
    void loadHistoricalComparison(compareId);
  }

  function removeAppointment(id: string) {
    setLocal((current) => ({
      ...current,
      appointments: (current.appointments ?? []).map((item) => item.id === id ? { ...item, isDeleted: true } : item),
    }));
    setOpenAppointmentId((current) => current === id ? undefined : current);
  }

  if (isCompleted || isApprovalLocked) {
    return (
      <CompletedCoachingSummary
        intervention={local}
        approval={approval}
        representative={representative}
        leaderName={reportingUserName(local.ownerId, managedUsers)}
        totalScore={totalCoachingScore}
        canManage={canManageCompleted}
        showHistory={["ADMIN", "SUPER_ADMIN"].includes(user.role)}
        isRepresentative={local.subject?.userId === user.id || local.representativeId === user.id || local.representativeId === user.representativeId}
        isBusy={transitioning || isExportingReport}
        message={message}
        onSendForApproval={() => void transition("send_for_approval")}
        onApprove={() => void transition("approve")}
        onDownload={() => void downloadProfessionalReport()}
        canDownload={can(user, "modulePdfExport")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/begeleidingen" className="text-sm font-semibold text-brand-700">← Terug naar begeleidingen</Link>
        <div className="flex flex-wrap items-center gap-2">
          {can(user, "modulePdfExport") && (
            <button
              type="button"
              className="btn-primary"
              disabled={isExportingReport}
              onClick={() => void downloadProfessionalReport()}
            >
              {isExportingReport ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {isExportingReport
                ? "PDF-rapport maken..."
                : "Professioneel PDF-rapport downloaden"}
            </button>
          )}
          <StatusBadge status={local.status} />
        </div>
      </div>
      <PageHeader
        eyebrow="Begeleidingsdossier"
        title={`${representative.firstName} ${representative.lastName}`}
        description={`${formatShortDate(local.plannedDate)} · ${local.startTime ?? ""}-${local.endTime ?? ""} · ${reportingUserName(local.ownerId, managedUsers)}`}
      />
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
      {reportMessage && (
        <div className={`rounded-2xl border p-4 text-sm font-semibold ${
          reportMessage.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-800"
        }`}>
          {reportMessage.text}
        </div>
      )}
      <CoachingOutlookSyncStatus intervention={local} />

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
          <ReadOnlyField label="Niveau" value={representative.level} />
          <ReadOnlyField label="Verkoopleider" value={reportingUserName(local.ownerId, managedUsers)} />
          <TextField label="Aankomsttijd" type="time" value={dossier.arrivalTime} disabled={readOnly} onChange={(arrivalTime) => updateDossier({ arrivalTime })} />
          <TextField label="Vertrektijd" type="time" value={dossier.departureTime} disabled={readOnly} onChange={(departureTime) => updateDossier({ departureTime })} />
          <TextField label="Aantal kilometers" value={dossier.kilometers} disabled={readOnly} onChange={(kilometers) => updateDossier({ kilometers })} />
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-950">I. Voorbereiding</h2>
        <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Categorieën</p><p className="mt-1 text-xs text-slate-500">Vooraf gekozen categorieën staan aan. Tijdens de begeleiding kun je altijd categorieën toevoegen.</p><div className="mt-3 flex flex-wrap gap-2">{coachingFramework.map((focus) => { const active = local.focusNames.includes(focus.name); return <button key={focus.name} type="button" disabled={readOnly} onClick={() => setLocal((current) => ({ ...current, focusNames: active ? current.focusNames.filter((name) => name !== focus.name) : [...current.focusNames, focus.name] }))} className={`rounded-full border px-3 py-2 text-xs font-bold ${active ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-500"}`}>{active ? "✓ " : "+ "}{focus.name}</button>; })}</div></div>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {representative.kpis.map((kpi) => <ReadOnlyField key={kpi.label} label={kpi.label} value={`${kpi.value} / doel ${kpi.target}`} />)}
        </div>
      </section>

      <HistoricalScoreComparisonPanel
        t={t}
        loading={historicalLoading}
        error={historicalError}
        options={historicalComparison.options}
        selectedId={historicalComparisonId}
        selected={historicalComparison.selected}
        currentHistory={currentHistoricalCoaching}
        wheelCoachings={comparisonWheelCoachings}
        onSelect={selectHistoricalComparison}
        onRetry={() => void loadHistoricalComparison(historicalComparisonId === "none" ? undefined : historicalComparisonId)}
      />

      <ScoreSection title="II. Evaluatie algemene punten" scores={dossier.generalScores} readOnly={readOnly} comparisonCategory="Dossier:Algemeen" historicalScores={historicalScoreLookup} t={t} onChange={(index, patch) => updateSimpleScore("generalScores", index, patch)} />
      <ScoreSection title="III. Persoonlijkheid" scores={dossier.personalityScores} readOnly={readOnly} comparisonCategory="Dossier:Persoonlijkheid" historicalScores={historicalScoreLookup} t={t} onChange={(index, patch) => updateSimpleScore("personalityScores", index, patch)} />

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
                  historicalScores={historicalScoreLookup}
                  t={t}
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
            <div key={action.id} className={`rounded-2xl border p-4 ${action.isNew ? "border-brand-200 bg-brand-50/40" : "border-slate-200 bg-slate-50"}`}>
              <div className="grid gap-3 md:grid-cols-[1fr_150px_150px]">
                {action.isNew ? <TextField label="Titel *" value={action.title} disabled={readOnly} onChange={(title) => setLocal((current) => ({ ...current, actionPoints: current.actionPoints.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) }))} /> : <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Actiepunt</p><p className="mt-2 font-bold text-slate-900">{action.title}</p><p className="mt-1 text-sm text-slate-500">{action.description}</p></div>}
                <ReadOnlyField label="Target" value={action.targetValue === undefined ? "Geen target" : String(action.targetValue)} />
                {action.isNew ? <label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Prioriteit *</span><select disabled={readOnly} className="field" value={action.priority ?? "normaal"} onChange={(event) => setLocal((current) => ({ ...current, actionPoints: current.actionPoints.map((item, itemIndex) => itemIndex === index ? { ...item, priority: event.target.value as "laag" | "normaal" | "hoog" } : item) }))}><option value="hoog">Hoog</option><option value="normaal">Normaal</option><option value="laag">Laag</option></select></label> : <ReadOnlyField label="Prioriteit" value={action.priority ?? "normaal"} />}
              </div>
              {!action.isNew && <div className="mt-3 max-w-xs"><TextField label="Behaalde score" type="number" value={action.achievedScore === undefined ? "" : String(action.achievedScore)} disabled={readOnly} onChange={(value) => setLocal((current) => ({ ...current, actionPoints: current.actionPoints.map((item, itemIndex) => itemIndex === index ? { ...item, achievedScore: value === "" ? undefined : Number(value) } : item) }))} /></div>}
              {action.isNew && <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]"><TextField label="Target (optioneel)" type="number" value={action.targetValue === undefined ? "" : String(action.targetValue)} disabled={readOnly} onChange={(value) => setLocal((current) => ({ ...current, actionPoints: current.actionPoints.map((item, itemIndex) => itemIndex === index ? { ...item, targetValue: value === "" ? undefined : Number(value) } : item) }))} /><ActionTipsEditor actionId={action.id} value={action.tipsAndTricks ?? ""} disabled={readOnly} onChange={updateActionTips} /></div>}
            </div>
          ))}
          {local.actionPoints.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nog geen actiepunten.</p>}
        </div>
      </section>

      {!readOnly && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:justify-end">
          {local.status === "gepland" && <button type="button" className="btn-secondary text-rose-700" onClick={() => persist("geannuleerd")}>Begeleiding verwijderen</button>}
          <button type="button" className="btn-secondary" onClick={() => persist("in_uitvoering")}>Opslaan</button>
          <button type="button" className="btn-secondary" onClick={() => persist("gesloten")}>Sluiten</button>
          <button type="button" className="btn-primary" onClick={() => persist("voltooid")}>Afwerken</button>
        </div>
      )}
    </div>
  );
}

function CompletedCoachingSummary({
  intervention,
  approval,
  representative,
  leaderName,
  totalScore,
  canManage,
  showHistory,
  isRepresentative,
  isBusy,
  message,
  onSendForApproval,
  onApprove,
  onDownload,
  canDownload,
}: {
  intervention: CoachingWorkflowItem;
  approval?: WorkflowApi["state"]["approvals"][number];
  representative: Representative;
  leaderName: string;
  totalScore?: number;
  canManage: boolean;
  showHistory: boolean;
  isRepresentative: boolean;
  isBusy: boolean;
  message?: string;
  onSendForApproval: () => void;
  onApprove: () => void;
  onDownload: () => void;
  canDownload: boolean;
}) {
  const { user } = useSession();
  const t = useCallback((key: TranslationKey) => translate(user.language, key), [user.language]);
  const [confirmation, setConfirmation] = useState<"send" | "approve">();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openAppointmentIds, setOpenAppointmentIds] = useState<Set<string>>(() => new Set());
  const dossier = intervention.dossier ?? defaultDossierState();
  const appointments = dedupeById(intervention.appointments ?? []).filter((item) => !item.isDeleted);
  const mainScoreRows = dedupeScoresByCriterion([...dossier.generalScores, ...dossier.personalityScores]);
  const workflowScoreRows = dedupeWorkflowScores(intervention.scores);
  const generalRemarks = [
    ...dossier.groupAttentionPoints.filter((item) => !isBlankRichText(item)).map((text, index) => ({ label: `Groepsaandachtspunt ${index + 1}`, text })),
    ...(!isBlankRichText(dossier.individualAttentionPoint) ? [{ label: "Individueel aandachtspunt / conclusie", text: dossier.individualAttentionPoint }] : []),
    ...mainScoreRows.filter((item) => !isBlankRichText(item.comment)).map((item) => ({ label: item.criterion, text: item.comment })),
    ...workflowScoreRows.filter((item) => !isBlankRichText(item.description)).map((item) => ({ label: `${item.focus} · ${item.criterion}`, text: item.description! })),
  ];
  const latestAudit = [...(intervention.auditTrail ?? [])]
    .sort((left, right) => right.at.localeCompare(left.at))[0];
  const locked = ["verzonden_ter_akkoord", "akkoord_door_vertegenwoordiger"].includes(intervention.status);

  function confirmTransition() {
    if (confirmation === "send") onSendForApproval();
    if (confirmation === "approve") onApprove();
    setConfirmation(undefined);
  }

  function toggleAppointment(id: string) {
    setOpenAppointmentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/begeleidingen" className="text-sm font-semibold text-brand-700">← Terug naar begeleidingen</Link>
        <div className="flex flex-wrap gap-2">
          {canDownload && <button id="rapport" type="button" className="btn-secondary scroll-mt-24" disabled={isBusy} onClick={onDownload}><FileDown className="h-4 w-4" /> PDF-rapport</button>}
          {canManage && !locked && <button type="button" className="btn-primary" disabled={isBusy} onClick={() => setConfirmation("send")}>Versturen naar vertegenwoordiger ter akkoord</button>}
          {isRepresentative && intervention.status === "verzonden_ter_akkoord" && <button type="button" className="btn-primary" disabled={isBusy} onClick={() => setConfirmation("approve")}>Voor akkoord bevestigen</button>}
          <StatusBadge status={intervention.status} />
        </div>
      </div>

      <PageHeader
        eyebrow="Afgewerkte begeleiding"
        title={`${representative.firstName} ${representative.lastName}`}
        description={`${formatShortDate(intervention.plannedDate)} · ${intervention.startTime ?? "--:--"}-${intervention.endTime ?? "--:--"}`}
        compact
      />

      {message && <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm font-semibold text-brand-900">{message}</div>}
      {locked && (
        <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 text-sm font-semibold text-fuchsia-900">
          {intervention.status === "akkoord_door_vertegenwoordiger"
            ? `Voor akkoord bevestigd${intervention.approvedByRepAt ? ` op ${formatDateTime(intervention.approvedByRepAt)}` : ""}.`
            : "Deze begeleiding werd doorgestuurd ter akkoord en kan niet meer aangepast worden."}
        </div>
      )}
      {latestAudit && (
        <p className="text-sm text-slate-500">
          Laatst aangepast op {formatDateTime(latestAudit.at)} door {latestAudit.userName ?? "een gebruiker"}.
        </p>
      )}

      {!isRepresentative && intervention.sentForApprovalAt && (
        <ApprovalReflectionReadOnly approval={approval} sentForApprovalAt={intervention.sentForApprovalAt} t={t} />
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-950">Algemene info</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryValue label="Vertegenwoordiger" value={`${representative.firstName} ${representative.lastName}`} />
            <SummaryValue label="Verkoopleider" value={leaderName} />
            <SummaryValue label="Team" value={representative.team} />
            <SummaryValue label="Rol / niveau" value={`Vertegenwoordiger · ${representative.level}`} />
            <SummaryValue label="Datum" value={formatShortDate(intervention.plannedDate)} />
            <SummaryValue label="Uren" value={`${intervention.startTime ?? "--:--"} – ${intervention.endTime ?? "--:--"}`} />
            <SummaryValue label="Status" value={<StatusBadge status={intervention.status} />} />
            <SummaryValue label="Effectieve aankomst / vertrek" value={`${dossier.arrivalTime || "--:--"} – ${dossier.departureTime || "--:--"}`} />
            <SummaryValue label="Gebied" value={dossier.area || "—"} />
            <SummaryValue label="Sector" value={dossier.sector || "—"} />
            <SummaryValue label="Kilometers" value={dossier.kilometers || "—"} />
            <SummaryValue label="Focus" value={intervention.focusNames.length ? intervention.focusNames.join(", ") : "Geen focus geregistreerd"} />
            <SummaryValue label="Vooraf verwittigd" value={intervention.notifyRepresentative ? "Ja" : "Nee"} />
          </dl>
        </div>
        <div className="card grid place-items-center p-5 text-center">
          <div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(#003B83 ${Math.max(0, Math.min(100, totalScore ?? 0))}%, #e2e8f0 0)` }}>
            <div className="grid h-28 w-28 place-items-center rounded-full bg-white">
              <div><p className="text-3xl font-black text-brand-950">{formatPercentage(totalScore)}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Prestatie</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="opmerkingen" className="card scroll-mt-24 p-5">
        <h2 className="text-lg font-bold text-slate-950">Samenvatting en conclusie</h2>
        <div className="mt-4 space-y-3">
          {generalRemarks.map((remark) => <div key={`${remark.label}:${remark.text}`} className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-brand-700">{remark.label}</p><OptionalCoachingRemark value={remark.text} className="mt-1 text-sm leading-6 text-slate-700" /></div>)}
          {!isRepresentative && !isBlankRichText(intervention.internalNotes) && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Interne opmerking</p><OptionalCoachingRemark value={intervention.internalNotes} className="mt-1 text-sm leading-6 text-amber-900" /></div>}
        </div>
      </section>

      <section id="scores" className="card scroll-mt-24 p-5">
        <h2 className="text-lg font-bold text-slate-950">Scores hoofdformulier</h2>
        <ReadOnlySimpleScoreTable scores={mainScoreRows} />
        <h3 className="mt-6 text-base font-bold text-slate-900">Gedetailleerde coachingscriteria</h3>
        <ReadOnlyWorkflowScoreTable scores={workflowScoreRows} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div id="actiepunten" className="card scroll-mt-24 p-5">
          <h2 className="text-lg font-bold text-slate-950">Actiepunten</h2>
          <div className="mt-4 space-y-2">
            {dedupeById(intervention.actionPoints).map((action) => <div key={action.id} className="rounded-xl bg-slate-50 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{action.title}</p><p className="mt-1 text-xs text-slate-500">Deadline {action.due ? formatShortDate(action.due) : "niet ingesteld"} · prioriteit {action.priority ?? "normaal"}</p></div><StatusBadge status={action.status} /></div>{!isBlankRichText(action.description) && <RichTextRenderer value={action.description} className="mt-3 text-sm leading-6 text-slate-600" />}</div>)}
            {intervention.actionPoints.length === 0 && <p className="text-sm text-slate-500">Geen actiepunten.</p>}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-950">Afspraken binnen de begeleiding</h2>
          <div className="mt-4 space-y-2">
            {appointments.map((appointment, index) => {
              const expanded = openAppointmentIds.has(appointment.id);
              return <article key={`report-${appointment.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button type="button" className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50" onClick={() => toggleAppointment(appointment.id)} aria-expanded={expanded}>
                  <div className="grid h-10 min-w-16 place-items-center rounded-xl bg-brand-50 px-2 text-xs font-bold text-brand-800">{appointment.arrivalTime || "--:--"}</div>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{index + 1}. {appointment.customer || "Onbenoemde afspraak"}</p><p className="mt-1 text-xs capitalize text-slate-500">{appointment.relationType} · {appointment.appointmentType} · {appointment.place || "Geen locatie"}</p></div>
                  <div className="hidden text-right sm:block"><p className="text-sm font-bold text-brand-800">{formatAppointmentAverage(appointment)} / 5</p><p className="text-xs text-slate-400">gemiddelde</p></div>
                  <ChevronRight className={`h-5 w-5 shrink-0 text-slate-400 transition ${expanded ? "rotate-90" : ""}`} />
                </button>
                {expanded && <AppointmentReadOnlyReport appointment={appointment} />}
              </article>;
            })}
            {appointments.length === 0 && <p className="text-sm text-slate-500">Geen afspraken geregistreerd.</p>}
          </div>
        </div>
      </section>

      {showHistory && (intervention.auditTrail?.length ?? 0) > 0 && (
        <section className="card p-5">
          <button type="button" className="flex w-full items-center justify-between text-left font-bold text-slate-950" onClick={() => setHistoryOpen((value) => !value)}>
            Wijzigingshistoriek bekijken <span>{historyOpen ? "−" : "+"}</span>
          </button>
          {historyOpen && <div className="mt-4 space-y-3">{intervention.auditTrail!.map((entry) => <div key={entry.id} className="border-l-2 border-brand-200 pl-4"><p className="text-sm font-semibold text-slate-800">{entry.summary}</p><p className="text-xs text-slate-500">{formatDateTime(entry.at)} · {entry.userName ?? entry.userId}</p></div>)}</div>}
        </section>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-950">Bevestiging</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {confirmation === "send"
                ? "Na het versturen kan deze begeleiding niet meer aangepast worden. Wil je doorgaan?"
                : "Wil je bevestigen dat je deze begeleiding hebt gelezen en voor akkoord bevestigt?"}
            </p>
            <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setConfirmation(undefined)}>Annuleren</button><button type="button" className="btn-primary" onClick={confirmTransition}>Bevestigen</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentReadOnlyReport({ appointment }: { appointment: CoachingAppointment }) {
  const scores = dedupeScoresByCriterion(appointment.scores);
  return (
    <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryValue label="Klant / prospect" value={appointment.customer || "Niet ingevuld"} />
        <SummaryValue label="Klantnummer" value={appointment.customerNumber || "Niet ingevuld"} />
        <SummaryValue label="Adres / locatie" value={appointment.place || "Niet ingevuld"} />
        <SummaryValue label="Tijdstip" value={`${appointment.arrivalTime || "--:--"} – ${appointment.departureTime || "--:--"}`} />
        <SummaryValue label="Type" value={`${appointment.relationType} · ${appointment.appointmentType}`} />
        <SummaryValue label="Gemiddelde score" value={`${formatAppointmentAverage(appointment)} / 5`} />
      </dl>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resultaat / activiteit</p><p className="mt-2 text-sm leading-6 text-slate-700">{appointment.activity?.trim() || "Geen resultaat ingevuld."}</p></div>
        <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Notities / opmerkingen</p><OptionalCoachingRemark value={appointment.remarks} className="mt-2 min-h-6 text-sm leading-6 text-slate-700" /></div>
      </div>
      <h4 className="mt-5 font-bold text-slate-900">Gedetailleerde scores</h4>
      <ReadOnlySimpleScoreTable scores={scores} splitCriterion />
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">Geen afzonderlijk aan deze afspraak gekoppelde actiepunten geregistreerd.</div>
    </div>
  );
}

function OptionalCoachingRemark({ value, className }: { value?: string | null; className: string }) {
  if (isBlankRichText(value)) return <div className={className} aria-hidden="true" />;
  const text = value ?? "";
  if (hasHtmlMarkup(text)) {
    return <RichTextRenderer value={text} className={className} />;
  }
  return <p className={className}>{richTextToPlainText(text)}</p>;
}

function ApprovalReflectionReadOnly({
  approval,
  sentForApprovalAt,
  t,
}: {
  approval?: WorkflowApi["state"]["approvals"][number];
  sentForApprovalAt: string;
  t: (key: TranslationKey) => string;
}) {
  const complete = approvalHasCompletedReflection(approval);
  const rows = [
    { label: t("approvalReflection.question.kpi"), value: approval?.reflectionKpiHtml },
    { label: t("approvalReflection.question.learning"), value: approval?.reflectionLearningHtml },
    { label: t("approvalReflection.question.goal"), value: approval?.reflectionGoalHtml },
  ];

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{t("approvalReflection.sectionTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {complete
              ? t("approvalReflection.completedManager")
              : `${t("approvalReflection.pendingManager")} ${t("approvalReflection.sentForApprovalAt")}: ${formatDateTime(sentForApprovalAt)}.`}
          </p>
        </div>
        <StatusBadge status={complete ? "ingediend" : "wacht_op_akkoord"} />
      </div>
      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{row.label}</p>
            {isBlankRichText(row.value) ? (
              <p className="mt-2 text-sm font-semibold text-slate-500">{t("approvalReflection.notFilled")}</p>
            ) : (
              <RichTextRenderer value={row.value} className="mt-2 text-sm leading-6 text-slate-700" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadOnlySimpleScoreTable({ scores, splitCriterion = false }: { scores: CoachingSimpleScore[]; splitCriterion?: boolean }) {
  if (scores.length === 0) return <p className="mt-4 text-sm text-slate-500">Geen scores geregistreerd.</p>;
  return (
    <div className="mt-4 space-y-2">
      {scores.map((score) => {
        const criterion = splitScoreCriterion(score.criterion);
        const trend = scoreTrend(score.score, score.previousScore);
        return <div key={score.criterion} className="grid gap-2 rounded-xl bg-slate-50 px-4 py-3 sm:grid-cols-[minmax(150px,1fr)_90px_minmax(180px,1.2fr)] sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">{splitCriterion ? criterion.group : "Criterium"}</p><p className="mt-1 text-sm font-semibold text-slate-800">{splitCriterion ? criterion.detail : score.criterion}</p></div>
          <div><p className="text-sm font-bold text-slate-950">{score.score === "nvt" ? "N.v.t." : `${score.score} / 5`}</p>{score.previousScore !== undefined && <p className={`text-xs font-semibold ${trend.tone}`}>{trend.label} · vorige {score.previousScore}</p>}</div>
          <OptionalCoachingRemark value={score.comment} className="min-h-5 text-sm leading-5 text-slate-600" />
        </div>;
      })}
    </div>
  );
}

function ReadOnlyWorkflowScoreTable({ scores }: { scores: WorkflowScore[] }) {
  if (scores.length === 0) return <p className="mt-4 text-sm text-slate-500">Geen gedetailleerde criteria geregistreerd.</p>;
  return (
    <div className="mt-4 space-y-2">
      {scores.map((score) => {
        const current = score.value === "NVT" ? undefined : score.value;
        const trend = scoreTrend(current, score.previousScore);
        return <div key={`${score.focus}:${score.criterion}:${score.criterionId ?? "vast"}`} className="grid gap-2 rounded-xl bg-slate-50 px-4 py-3 sm:grid-cols-[minmax(150px,1fr)_105px_minmax(180px,1.2fr)] sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">{score.focus || "Algemeen"}</p><p className="mt-1 text-sm font-semibold text-slate-800">{score.criterion}</p></div>
          <div><p className="text-sm font-bold text-slate-950">{current === undefined ? "N.v.t." : `${current}%`}</p>{score.previousScore !== undefined && <p className={`text-xs font-semibold ${trend.tone}`}>{trend.label} · vorige {score.previousScore}%</p>}</div>
          <OptionalCoachingRemark value={score.description} className="min-h-5 text-sm leading-5 text-slate-600" />
        </div>;
      })}
    </div>
  );
}

function dedupeScoresByCriterion(scores: CoachingSimpleScore[]) {
  return [...new Map(scores.map((score) => [score.criterion, score])).values()];
}

function dedupeWorkflowScores(scores: WorkflowScore[]) {
  return [...new Map(scores.map((score) => [`${score.focus}:${score.criterion}:${score.criterionId ?? "vast"}`, score])).values()];
}

function splitScoreCriterion(value: string) {
  const [group, ...detail] = value.split(/\s+-\s+/);
  return { group: detail.length ? group : "Criterium", detail: detail.length ? detail.join(" - ") : group };
}

function scoreTrend(current?: number | "nvt", previous?: number) {
  if (typeof current !== "number" || previous === undefined) return { label: "", tone: "text-slate-500" };
  if (current > previous) return { label: "↑ Beter", tone: "text-emerald-700" };
  if (current < previous) return { label: "↓ Lager", tone: "text-rose-700" };
  return { label: "→ Gelijk", tone: "text-slate-600" };
}

function SummaryValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function TextField({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><input type={type} className="field" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}

function coachingSubjectAsRepresentative(subject: NonNullable<CoachingWorkflowItem["subject"]>): Representative {
  return { id: subject.id, firstName: subject.firstName, lastName: subject.lastName, initials: subject.initials, country: subject.country, team: subject.team, teamId: subject.teamId, level: "Vertegenwoordiger", levelColor: "bg-brand-100 text-brand-800", lastCoaching: "Nog niet", openActions: 0, email: "", phone: "", kpis: [] };
}

const RichTextEditor = memo(function RichTextEditor({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValue = useRef<string | undefined>(undefined);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // A parent render after local typing must never rewrite the editable DOM:
    // doing so destroys the browser selection and moves the caret to the start.
    if (value === lastEmittedValue.current) {
      lastEmittedValue.current = undefined;
      return;
    }
    if (editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  const emitChange = useCallback(() => {
    const nextValue = editorRef.current?.innerHTML ?? "";
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  }, [onChange]);

  const command = useCallback((name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
  }, []);
  const controls = [
    ["B", "bold"], ["I", "italic"], ["U", "underline"], ["•", "insertUnorderedList"],
    ["1.", "insertOrderedList"], ["←", "justifyLeft"], ["↔", "justifyCenter"], ["→", "justifyRight"],
  ] as const;
  return <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    {!disabled && <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">{controls.map(([text, name]) => <button key={name} type="button" title={name} className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-xs font-bold hover:bg-white" onMouseDown={(event) => { event.preventDefault(); command(name); }}>{text}</button>)}<button type="button" className="h-8 rounded-md px-2 text-xs font-bold hover:bg-white" onMouseDown={(event) => { event.preventDefault(); const url = window.prompt("Link (https://…)"); if (url) command("createLink", url); }}>Link</button><input type="color" title="Tekstkleur" className="h-8 w-8" onChange={(event) => command("foreColor", event.target.value)} /></div>}
    <div ref={editorRef} className="rich-text-editor min-h-28 p-3 text-sm leading-6 outline-none" contentEditable={!disabled} suppressContentEditableWarning onInput={emitChange} />
  </div></div>;
});

const ActionTipsEditor = memo(function ActionTipsEditor({ actionId, value, disabled, onChange }: {
  actionId: string;
  value: string;
  disabled: boolean;
  onChange: (actionId: string, value: string) => void;
}) {
  const handleChange = useCallback((nextValue: string) => onChange(actionId, nextValue), [actionId, onChange]);
  return <RichTextEditor label="Tips & Tricks *" value={value} disabled={disabled} onChange={handleChange} />;
});

function CoachingOutlookSyncStatus({ intervention }: { intervention: CoachingWorkflowItem }) {
  const label = intervention.outlookSyncStatus === "SYNCED"
    ? "Gesynchroniseerd met Outlook"
    : intervention.outlookSyncStatus === "ERROR"
      ? "Outlook-syncfout"
      : "Nog niet gesynchroniseerd met Outlook";
  const tone = intervention.outlookSyncStatus === "SYNCED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : intervention.outlookSyncStatus === "ERROR"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`rounded-2xl border p-4 text-sm ${tone}`}>
      <p className="font-bold">{label}</p>
      {intervention.lastSyncedAt && (
        <p className="mt-1 text-xs opacity-80">Laatst gesynchroniseerd: {new Date(intervention.lastSyncedAt).toLocaleString("nl-BE")}</p>
      )}
      {intervention.syncError && <p className="mt-1 text-xs">{intervention.syncError}</p>}
    </div>
  );
}

function InlineOutlookSyncStatus({
  status,
  error,
}: {
  status: "NOT_SYNCED" | "SYNCED" | "ERROR";
  error?: string;
}) {
  const label = status === "SYNCED" ? "Gesynchroniseerd" : status === "ERROR" ? "Sync-fout" : "Nog niet gesynchroniseerd";
  const tone = status === "SYNCED"
    ? "bg-emerald-100 text-emerald-800"
    : status === "ERROR"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`} title={error ?? label}>{label}</span>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-900">{value || "-"}</p></div>;
}

function HistoricalScoreComparisonPanel({
  t,
  loading,
  error,
  options,
  selectedId,
  selected,
  currentHistory,
  wheelCoachings,
  onSelect,
  onRetry,
}: {
  t: (key: TranslationKey) => string;
  loading: boolean;
  error?: string;
  options: HistoricalComparisonResponse["options"];
  selectedId: string;
  selected?: HistoricalComparisonResponse["selected"];
  currentHistory: HistoricalCoaching;
  wheelCoachings: HistoricalCoaching[];
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">{t("coaching.scores.title")}</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">{t("coaching.scores.representativeScores")}</h2>
          {selected && (
            <p className="mt-1 text-sm text-slate-500">
              {t("coaching.scores.previousCoaching")}: {formatShortDate(selected.date)} - {selected.ownerName}
            </p>
          )}
        </div>
        {options.length > 0 ? (
          <label className="min-w-0 text-xs font-semibold text-slate-500 lg:max-w-md">
            {t("coaching.scores.compareWithPrevious")}
            <select
              className="field mt-1 w-full min-w-0"
              value={selectedId}
              disabled={loading}
              onChange={(event) => onSelect(event.target.value)}
            >
              <option value="none">{t("coaching.scores.noComparison")}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {formatShortDate(option.date)} - {option.ownerName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            {t("coaching.scores.noHistoricalScores")}
          </p>
        )}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {loading && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {t("coaching.scores.loadingHistoricalScores")}
          </div>
        )}
        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" className="btn-secondary bg-white py-2 text-xs" onClick={onRetry}>
              {t("coaching.scores.retry")}
            </button>
          </div>
        )}
        {selected && !error && (
          <div>
            <PerformanceWheel
              representativeId={currentHistory.representativeId}
              currentInterventionId={currentHistory.id}
              comparisonInterventionId={selected.id}
              type="kapstok"
              coachings={wheelCoachings}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ScoreSection({ title, scores, readOnly, comparisonCategory, historicalScores, t, onChange }: { title: string; scores: { criterion: string; score: 0 | 1 | 2 | 3 | 4 | 5 | "nvt"; comment: string }[]; readOnly: boolean; comparisonCategory?: string; historicalScores?: ReadonlyMap<string, HistoricalScoreReference>; t: (key: TranslationKey) => string; onChange: (index: number, patch: { score?: 0 | 1 | 2 | 3 | 4 | 5 | "nvt"; comment?: string }) => void }) {
  const options = [0, 1, 2, 3, 4, 5, "nvt"] as const;
  const showComparison = Boolean(comparisonCategory && historicalScores?.size);
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">
        {scores.map((item, index) => {
          const previousScore = comparisonCategory
            ? historicalScores?.get(historicalScoreKey(comparisonCategory, item.criterion))?.score
            : undefined;
          return (
          <div key={item.criterion} className={`grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:items-center ${showComparison ? "lg:grid-cols-[minmax(180px,1fr)_110px_minmax(260px,1.2fr)_100px_minmax(220px,1fr)]" : "lg:grid-cols-[220px_1fr_1.4fr]"}`}>
            <p className="font-semibold text-slate-900">{item.criterion}</p>
            {showComparison && <HistoricalScoreCell score={previousScore} t={t} />}
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <button key={option} type="button" disabled={readOnly} onClick={() => onChange(index, { score: option })} className={`rounded-lg border px-3 py-2 text-sm font-bold ${item.score === option ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{option === "nvt" ? "NVT" : option}</button>
              ))}
            </div>
            {showComparison && <ScoreDifferenceCell current={item.score} previous={previousScore} t={t} />}
            <input className="field" disabled={readOnly} placeholder="Opmerking" value={item.comment} onChange={(event) => onChange(index, { comment: event.target.value })} />
          </div>
          );
        })}
      </div>
    </section>
  );
}

function AppointmentEditor({
  appointment,
  readOnly,
  historicalScores,
  t,
  onChange,
  onScoreChange,
}: {
  appointment: CoachingAppointment;
  readOnly: boolean;
  historicalScores?: ReadonlyMap<string, HistoricalScoreReference>;
  t: (key: TranslationKey) => string;
  onChange: (patch: Partial<CoachingAppointment>) => void;
  onScoreChange: (index: number, patch: { score?: 0 | 1 | 2 | 3 | 4 | 5 | "nvt"; comment?: string }) => void;
}) {
  const options = [1, 2, 3, 4, 5, "nvt"] as const;
  const showComparison = Boolean(historicalScores?.size);
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
        {appointment.scores.map((score, index) => {
          const { group, detail } = splitScoreCriterion(score.criterion);
          const previousScore = historicalScores?.get(historicalScoreKey(group, detail))?.score;
          return (
          <div key={`${score.criterion}-${index}`} className={`grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:items-center ${showComparison ? "lg:grid-cols-[minmax(180px,1fr)_90px_260px_90px_minmax(220px,1fr)]" : "lg:grid-cols-[minmax(180px,1fr)_260px_minmax(220px,1fr)]"}`}>
            <p className="text-sm font-semibold text-slate-900">{score.criterion}</p>
            {showComparison && <HistoricalScoreCell score={previousScore} t={t} />}
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
            {showComparison && <ScoreDifferenceCell current={score.score} previous={previousScore} t={t} />}
            <input className="field" disabled={readOnly} placeholder="Opmerking per criterium" value={score.comment} onChange={(event) => onScoreChange(index, { comment: event.target.value })} />
          </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoricalScoreCell({ score, t }: { score?: number; t: (key: TranslationKey) => string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("coaching.scores.previousScore")}</p>
      <p className="mt-1 text-sm font-bold text-slate-700">{score === undefined ? "-" : score}</p>
    </div>
  );
}

function ScoreDifferenceCell({ current, previous, t }: { current: CoachingSimpleScore["score"]; previous?: number; t: (key: TranslationKey) => string }) {
  const difference = typeof current === "number" && previous !== undefined ? current - previous : undefined;
  const tone = difference === undefined
    ? "bg-slate-100 text-slate-600"
    : difference > 0
      ? "bg-emerald-100 text-emerald-800"
      : difference < 0
        ? "bg-rose-100 text-rose-800"
        : "bg-slate-200 text-slate-700";
  const label = difference === undefined
    ? (previous === undefined ? t("coaching.scores.noPreviousScore") : "-")
    : difference > 0
      ? `+${difference}`
      : String(difference);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("coaching.scores.difference")}</p>
      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{label}</span>
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

function coachingInterventionAsHistory(
  intervention: CoachingWorkflowItem,
  dossier: CoachingDossier,
  appointments: CoachingAppointment[],
  ownerName: string,
  totalScore?: number
): HistoricalCoaching {
  const appointmentCriterionScores = criterionScoresFromRows(
    appointments.flatMap((appointment) =>
      appointment.scores.map((score) => ({
        criterion: score.criterion,
        score: score.score === "nvt" ? null : score.score,
        notApplicable: score.score === "nvt",
      }))
    )
  );
  const dossierCriterionScores = [
    ...dossier.generalScores.map((score) => ({ ...score, category: "Dossier:Algemeen" })),
    ...dossier.personalityScores.map((score) => ({ ...score, category: "Dossier:Persoonlijkheid" })),
  ].flatMap((score) =>
    score.score === "nvt"
      ? []
      : [{
        focus: score.category,
        criterion: score.criterion,
        score: normalizePerformanceScore(score.score),
        scored: true,
      }]
  );
  const criterionScores = mergeCriterionScores(appointmentCriterionScores, dossierCriterionScores);
  const phaseScores = averageScoreDimensions(criterionScores
    .filter((score) => score.scored !== false)
    .map((score) => ({ label: score.focus, score: score.score })));

  return {
    id: intervention.id,
    representativeId: intervention.representativeId,
    date: intervention.plannedDate ?? intervention.createdAt.slice(0, 10),
    ownerId: intervention.ownerId,
    ownerName,
    status: intervention.status,
    overallScore: totalScore,
    focusNames: [...new Set([
      ...intervention.focusNames,
      ...criterionScores.map((score) => score.focus),
    ])],
    phaseScores: phaseScores.length
      ? phaseScores
      : totalScore !== undefined
        ? [{ label: "Algemene begeleiding", score: Math.round(totalScore) }]
        : [],
    generalScores: [...dossier.generalScores, ...dossier.personalityScores].flatMap((score) =>
      score.score === "nvt"
        ? []
        : [{ label: score.criterion, score: normalizePerformanceScore(score.score) }]
    ),
    criterionScores,
  };
}

function averageScoreDimensions(items: { label: string; score: number }[]) {
  const grouped = new Map<string, number[]>();
  for (const item of items) {
    const current = grouped.get(item.label) ?? [];
    current.push(item.score);
    grouped.set(item.label, current);
  }
  return [...grouped.entries()].map(([label, values]) => ({
    label,
    score: Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)),
  }));
}

function formatPercentage(value?: number) {
  return value === undefined ? "-" : `${Math.round(value)}%`;
}

type InterventionListRow = CoachingScopeGroupItem & {
  type: string;
  date: string;
  owner: string;
  status: string;
  editable: boolean;
  plannedDate: string;
  startTime: string;
  endTime: string;
  executionAt: number;
  outlookSyncStatus?: CoachingIntervention["outlookSyncStatus"];
  syncError?: string;
  detailHref?: string;
  openLabel: string;
  editPlanningHref?: string;
};

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
  const todayKey = localDateKey();
  const historicalRows: InterventionListRow[] = kind === "begeleidingen"
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
          representativeId: representative.id,
          country: representative.country,
          teamId: representative.teamId,
          team: representative.team,
          date: formatShortDate(item.date),
          owner: item.ownerName,
          status: item.status,
          editable: false,
          plannedDate: item.date,
          startTime: "",
          endTime: "",
          executionAt: executionTimestamp(item.date),
          outlookSyncStatus: undefined,
          syncError: undefined,
          detailHref: `/begeleidingen/${item.id}`,
          openLabel: "Bekijk verslag",
          editPlanningHref: undefined,
        };
      })
    : [];
  const workflowRows: InterventionListRow[] = kind === "begeleidingen"
    ? visibleInterventions(user).map((item) => {
      const representative = representatives.find((person) => person.id === item.representativeId);
      const personName = representative
        ? `${representative.firstName} ${representative.lastName}`
        : item.subject
          ? `${item.subject.firstName} ${item.subject.lastName}`
          : "Onbekend";
      const openHref = coachingOpenHref(user, item, todayKey);
      const editPlanningHref = canEditFutureCoachingPlanning(user, item, todayKey)
        ? `/begeleidingen/nieuw?id=${encodeURIComponent(item.id)}`
        : undefined;
      const openLabel = editPlanningHref
        ? "Wijzig planning"
        : completedCoachingStatuses.has(item.status)
          ? "Bekijk verslag"
          : canManageCoaching(user, item)
            ? "Open dossier"
            : openHref
              ? "Bekijk voorbereiding"
              : "Ingepland";
      return {
        id: item.id,
        type: "begeleiding",
        person: personName,
        representativeId: representative?.id ?? item.subject?.id ?? item.representativeId,
        country: item.country,
        teamId: representative?.teamId ?? item.subject?.teamId ?? item.teamId,
        team: representative?.team ?? item.subject?.team ?? "Geen team",
        date: formatShortDate(item.plannedDate ?? item.updatedAt.slice(0, 10)),
        owner: reportingUserName(item.ownerId, managedUsers),
        status: item.status,
        editable: Boolean(openHref),
        detailHref: openHref,
        openLabel,
        editPlanningHref,
        plannedDate: item.plannedDate ?? item.updatedAt.slice(0, 10),
        startTime: item.startTime ?? "",
        endTime: item.endTime ?? "",
        executionAt: executionTimestamp(`${item.plannedDate ?? item.updatedAt.slice(0, 10)}T${item.startTime ?? "00:00"}`),
        outlookSyncStatus: item.outlookSyncStatus,
        syncError: item.syncError,
      };
    })
    : [];
  const workflowIds = new Set(workflowRows.map((item) => item.id));
  const allRows: InterventionListRow[] = dedupeById([
    ...workflowRows,
    ...historicalRows.filter((item) => !workflowIds.has(item.id)),
  ]);
  const todayRows = allRows
    .filter((item) =>
      !completedCoachingStatuses.has(item.status) &&
      item.status !== "geannuleerd" &&
      item.plannedDate === todayKey
    )
    .sort((left, right) => left.executionAt - right.executionAt);
  const plannedRows = allRows
    .filter((item) =>
      !completedCoachingStatuses.has(item.status) &&
      item.status !== "geannuleerd" &&
      item.plannedDate > todayKey
    )
    .sort((left, right) => left.executionAt - right.executionAt);
  const completedRows = allRows
    .filter((item) => completedCoachingStatuses.has(item.status))
    .sort((left, right) => right.executionAt - left.executionAt);

  function renderRows(items: InterventionListRow[], emptyMessage: string) {
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      );
    }

    const scopeGroups = buildCoachingScopeGroups(user, items);
    if (scopeGroups.enabled) {
      if (scopeGroups.showCountry) {
        return (
          <div className="space-y-4">
            {scopeGroups.countries.map((country) => (
              <section key={country.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand-700 shadow-sm">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">Land</p>
                    <h3 className="truncate text-base font-bold text-slate-950">{countryName(country.id)}</h3>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">
                    {countCountryItems(country)} {countCountryItems(country) === 1 ? "begeleiding" : "begeleidingen"}
                  </span>
                </div>
                <div className="space-y-3">
                  {country.teams.map((team) => renderTeamGroup(team))}
                </div>
              </section>
            ))}
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {scopeGroups.countries.flatMap((country) => country.teams).map((team) => renderTeamGroup(team))}
        </div>
      );
    }

    return (
      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {items.map((item) => renderInterventionRow(item))}
        </div>
      </div>
    );
  }

  function renderTeamGroup(team: CoachingScopeTeamGroup<InterventionListRow>) {
    const count = countTeamItems(team);
    return (
      <section key={team.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2.5 bg-white px-3 py-3 sm:px-4">
          <UsersRound className="h-4 w-4 text-brand-700" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Team</p>
            <h4 className="truncate text-sm font-bold text-slate-900">{team.name}</h4>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {count} {count === 1 ? "begeleiding" : "begeleidingen"}
          </span>
        </div>
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/45 p-3 sm:p-4">
          {team.users.map((userGroup) => (
            <section key={userGroup.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{userGroup.name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                  {userGroup.items.length}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-100">
                  {userGroup.items.map((item) => renderInterventionRow(item))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
    );
  }

  function renderInterventionRow(item: InterventionListRow) {
    const timeLabel = [item.startTime, item.endTime].filter(Boolean).join(" - ");
    const rowClass = `grid gap-3 p-3.5 transition sm:grid-cols-[minmax(220px,1.5fr)_minmax(135px,0.65fr)_minmax(185px,0.85fr)_auto] sm:items-center sm:px-4 ${item.detailHref ? "hover:bg-brand-50/40" : ""}`;
    const actionClass = `inline-flex items-center gap-1 text-sm font-bold ${item.detailHref ? "text-brand-700" : "text-slate-400"}`;
    const content = (
      <>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{item.person}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{item.owner}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Datum</p>
          <p className="mt-1 text-sm text-slate-700">{item.date}</p>
          {timeLabel && <p className="mt-0.5 text-xs text-slate-500">{timeLabel}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={item.status} />
            {item.outlookSyncStatus && (
              <InlineOutlookSyncStatus status={item.outlookSyncStatus} error={item.syncError} />
            )}
          </div>
        </div>
        <span className={actionClass}>
          {item.openLabel}
          {item.detailHref && <ChevronRight className="h-4 w-4" />}
        </span>
      </>
    );

    return item.detailHref ? (
      <Link key={item.id} href={item.detailHref} className={rowClass}>
        {content}
      </Link>
    ) : (
      <div key={item.id} className={rowClass}>
        {content}
      </div>
    );
  }

  function countTeamItems(team: CoachingScopeTeamGroup<InterventionListRow>) {
    return team.users.reduce((total, userGroup) => total + userGroup.items.length, 0);
  }

  function countCountryItems(country: CoachingScopeCountryGroup<InterventionListRow>) {
    return country.teams.reduce((total, team) => total + countTeamItems(team), 0);
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
  const appointmentCriterionScores = criterionScoresFromRows(
    (intervention.appointments ?? [])
      .filter((appointment) => !appointment.isDeleted)
      .flatMap((appointment) => appointment.scores.map((score) => ({
        criterion: score.criterion,
        score: score.score === "nvt" ? null : score.score,
        notApplicable: score.score === "nvt",
      })))
  );
  const workflowCriterionScores = intervention.scores.map((score) => ({
    focus: score.focus,
    criterion: score.criterion,
    score: score.value === "NVT" ? 0 : normalizePerformanceScore(score.value),
    scored: score.value !== "NVT",
  }));
  const criterionScores = mergeCriterionScores(appointmentCriterionScores, workflowCriterionScores);
  for (const score of criterionScores) {
    if (score.scored === false) continue;
    scoreByFocus.set(score.focus, [...(scoreByFocus.get(score.focus) ?? []), score.score]);
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
    focusNames: [...new Set([...intervention.focusNames, ...criterionScores.map((score) => score.focus)])],
    phaseScores,
    generalScores: previous?.generalScores ?? [],
    criterionScores,
  };
}

function ActionPoints() {
  return <ScopedActionPoints />;
}

type ActionDefinitionDraft = {
  id?: string;
  title: string;
  tipsAndTricks: string;
  targetValue: string;
  priority: ScopedActionDefinition["priority"];
  scope: ScopedActionDefinition["scope"];
  country: string;
  teamId: string;
  userId: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
  productIds: string[];
};

function ScopedActionPoints() {
  const { user, managedUsers } = useSession();
  const { modules } = useModules();
  const { state } = useWorkflow();
  const { dataset: performanceDataset } = usePerformance();
  const { representatives } = useRepresentatives();
  const [definitions, setDefinitions] = useState<ScopedActionDefinition[]>([]);
  const [targetTypes, setTargetTypes] = useState<ActionPointTargetTypeOption[]>([]);
  const [products, setProducts] = useState<ActionPointProductOption[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [activeActionTab, setActiveActionTab] = useState<"actions" | "users">("actions");
  const [actionSearch, setActionSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [draft, setDraft] = useState<ActionDefinitionDraft>();
  const [detailAction, setDetailAction] = useState<ActionPointOverviewItem>();
  const [closeCandidate, setCloseCandidate] = useState<ActionPointOverviewItem>();
  const [closedWorkflowActions, setClosedWorkflowActions] = useState<Record<string, Pick<ActionPointOverviewItem, "status" | "closedAt" | "closedByUserId" | "closedByName" | "updatedAt">>>({});
  const allowed = canAccessActionPointsOverview(user, modules);
  const canCreateDefinitions = canCreateActionPointDefinition(user);
  const canManageDefinitions = canManageActionPointDefinitions(user);
  const showActionPointUserTab = canViewActionPointUserTab(user);
  const visibleActionTab = showActionPointUserTab ? activeActionTab : "actions";
  const workflowActionItems = useMemo<ActionPointOverviewItem[]>(() => {
    if (!allowed) return [];
    const scopedState = getVisibleWorkflowState(user, state, representatives);
    const scopedRepresentatives = getVisibleRepresentatives(user, representatives);
    const dataset = buildReportingDataset(scopedState, representatives, performanceDataset, managedUsers);
    const scopedDataset = filterReportingDataset(dataset, scopedRepresentatives, emptyReportingFilters, managedUsers);
    return scopedDataset.actions.flatMap((action) => {
      const representative = representatives.find((item) => item.id === action.representativeId);
      if (!representative) return [];
      const ownerName = action.ownerId ? reportingUserName(action.ownerId, managedUsers) : undefined;
      const representativeName = `${representative.firstName} ${representative.lastName}`;
      const actionPointId = action.id.includes(":") ? action.id.split(":")[0] : action.id;
      const override = closedWorkflowActions[`${actionPointId}:${action.representativeId}`] ?? closedWorkflowActions[actionPointId];
      return [{
        id: `workflow:${action.id}:${action.representativeId}`,
        source: "workflow",
        status: override?.status ?? action.status,
        due: action.due,
        closedAt: override?.closedAt ?? action.closedAt,
        closedByUserId: override?.closedByUserId ?? action.closedByUserId,
        closedByName: override?.closedByName ?? (action.closedByUserId ? reportingUserName(action.closedByUserId, managedUsers) : undefined),
        title: action.title,
        description: action.linkedKpi ? `KPI: ${action.linkedKpi}` : "",
        tipsAndTricks: "",
        priority: action.due && action.due < localDateKey() && !["afgerond", "behaald", "niet_behaald", "geannuleerd"].includes(action.status) ? "hoog" : "normaal",
        scope: "USER",
        scopeKey: `USER:${action.representativeId}`,
        country: representative.country,
        teamId: representative.teamId,
        userId: action.representativeId,
        active: !["afgerond", "behaald", "niet_behaald", "geannuleerd"].includes(action.status),
        validFrom: action.updatedAt.slice(0, 10),
        validUntil: action.due || undefined,
        updatedAt: override?.updatedAt ?? action.updatedAt,
        concreteActionPointId: actionPointId,
        ownerName,
        representativeId: action.representativeId,
        representativeName,
        originLabel: "Gekoppeld actiepunt",
      }];
    });
  }, [allowed, closedWorkflowActions, managedUsers, performanceDataset, representatives, state, user]);
  const actionPointItems = useMemo<ActionPointOverviewItem[]>(
    () => [
      ...definitions.map((definition) => ({ ...definition, source: "definition" as const })),
      ...workflowActionItems,
    ],
    [definitions, workflowActionItems],
  );
  const sections = useMemo(() => splitActionPointSections(actionPointItems), [actionPointItems]);
  const openActionPointItems = useMemo(
    () => sections.find((section) => section.id === "open")?.items ?? [],
    [sections],
  );
  const closedActionPointItems = useMemo(
    () => canManageDefinitions || canCloseConcreteActionPoint(user) ? sections.find((section) => section.id === "closed")?.items ?? [] : [],
    [canManageDefinitions, sections, user],
  );
  const filteredActionItems = openActionPointItems.filter((item) => matchesActionPointSearch(item, actionSearch));
  const filteredClosedActionItems = closedActionPointItems.filter((item) => matchesActionPointSearch(item, actionSearch));
  const actionScopeGroups = groupActionPointsByScope(filteredActionItems);
  const closedActionScopeGroups = groupActionPointsByScope(filteredClosedActionItems);
  const visibleActionPointRepresentatives = getVisibleRepresentatives(user, representatives);
  const userGroups = showActionPointUserTab
    ? groupActionPointsByRepresentative(openActionPointItems, visibleActionPointRepresentatives, managedUsers)
      .flatMap((group) => {
        const groupMatches = matchesText(`${group.title} ${group.subtitle}`, userSearch);
        const items = groupMatches
          ? group.items
          : group.items.filter((item) => matchesActionPointSearch(item, userSearch));
        return items.length ? [{ ...group, items }] : [];
      })
    : [];
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/action-definitions?actorId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
    const payload = await response.json() as {
      definitions?: ScopedActionDefinition[];
      targetTypes?: ActionPointTargetTypeOption[];
      products?: ActionPointProductOption[];
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error);
    setDefinitions(payload.definitions ?? []);
    setTargetTypes(payload.targetTypes ?? []);
    setProducts(payload.products ?? []);
  }, [user.id]);

  useEffect(() => {
    if (!allowed) return;
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Actiepunten konden niet worden geladen."));
  }, [allowed, refresh]);

  if (!allowed) {
    return <EmptyState title="Geen toegang" description="Actiepunten zijn niet actief of niet toegestaan voor jouw huidige rechten." />;
  }

  return <div className="space-y-6">
    <PageHeader
      eyebrow="Opvolging"
      title="Actiepunten"
      description="Uit te voeren opvolgacties binnen jouw globale, land-, team- of persoonlijke scope."
      actions={canCreateDefinitions ? (
        <button type="button" className="btn-primary" onClick={() => openCreateDialog()}>
          <Plus className="h-4 w-4" /> Actiepunt toevoegen
        </button>
      ) : undefined}
    />
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
    {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}

    {showActionPointUserTab && <section className="card p-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { id: "actions" as const, label: "Actiepunten", count: filteredActionItems.length },
          { id: "users" as const, label: "Gebruikers", count: userGroups.length },
        ].map((tab) => {
          const active = activeActionTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveActionTab(tab.id)}
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition ${active ? "bg-brand-700 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-brand-50 hover:text-brand-800"}`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${active ? "bg-white/20 text-white" : "bg-white text-brand-700"}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>
    </section>}

    {visibleActionTab === "actions" ? renderActionsTab() : renderUsersTab()}
    {detailAction && renderDetailModal(detailAction)}
    {closeCandidate && renderCloseDialog(closeCandidate)}
    {draft && renderActionDefinitionDialog()}
  </div>;

  function openCreateDialog() {
    const scope = allowedTargetTypes()[0]?.code ?? "USER";
    setProductSearch("");
    setFormError(undefined);
    setDraft(normalizeDraft({
      title: "",
      tipsAndTricks: "",
      targetValue: "",
      priority: "normaal",
      scope,
      country: "",
      teamId: "",
      userId: "",
      validFrom: localDateKey(),
      validUntil: "",
      active: true,
      productIds: [],
    }));
  }

  function openEditDialog(item: ActionPointOverviewItem) {
    setProductSearch("");
    setFormError(undefined);
    setDetailAction(undefined);
    setDraft(normalizeDraft({
      id: item.id,
      title: item.title,
      tipsAndTricks: item.tipsAndTricks || item.description,
      targetValue: item.targetValue === undefined ? "" : String(item.targetValue),
      priority: item.priority,
      scope: item.scope,
      country: item.country ?? "",
      teamId: item.teamId ?? "",
      userId: item.userId ?? "",
      validFrom: item.validFrom,
      validUntil: item.validUntil ?? "",
      active: item.active,
      productIds: item.productIds ?? [],
    }));
  }

  function updateDraft(update: Partial<ActionDefinitionDraft>) {
    setDraft((current) => current ? normalizeDraft({ ...current, ...update }) : current);
  }

  function normalizeDraft(value: ActionDefinitionDraft): ActionDefinitionDraft {
    const allowedScopes = allowedTargetTypes().map((item) => item.code);
    const scope = allowedScopes.includes(value.scope) ? value.scope : allowedScopes[0] ?? "USER";
    const countries = countryOptions();
    let country = value.country || countries[0] || user.country;
    let teamId = value.teamId;
    let userId = value.userId;

    if (scope === "GLOBAL") {
      return { ...value, scope, country: "", teamId: "", userId: "" };
    }

    if (scope === "COUNTRY") {
      if (!countries.includes(country)) country = countries[0] ?? user.country;
      return { ...value, scope, country, teamId: "", userId: "" };
    }

    if (scope === "TEAM") {
      const teams = teamOptions(country);
      if (!teams.some((team) => team.id === teamId)) {
        teamId = teams[0]?.id ?? "";
      }
      const selectedTeam = teams.find((team) => team.id === teamId);
      return { ...value, scope, country: selectedTeam?.country ?? country, teamId, userId: "" };
    }

    const users = userOptions(country, teamId);
    if (!users.some((member) => member.id === userId)) {
      userId = users[0]?.id ?? "";
    }
    const selectedUser = users.find((member) => member.id === userId);
    return {
      ...value,
      scope: "USER",
      country: selectedUser?.country ?? country,
      teamId: selectedUser?.teamId ?? teamId,
      userId,
    };
  }

  function allowedTargetTypes() {
    const activeTypes = targetTypes.filter((item) => item.isActive);
    return activeTypes.filter((item) => {
      if (user.role === "SALES_LEADER") return item.code === "USER";
      if (["SALES_MANAGER", "COUNTRY_MANAGER"].includes(user.role)) return item.code !== "GLOBAL";
      return canCreateDefinitions || canManageDefinitions;
    });
  }

  function countryOptions() {
    const countries = new Set<string>();
    if (["GROUP_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      managedUsers.forEach((member) => countries.add(member.country));
      countries.add(user.country);
    } else if (user.countryAccess?.length) {
      user.countryAccess.forEach((country) => countries.add(country));
    } else {
      countries.add(user.country);
    }
    return ["BE", "NL", "DE"].filter((country) => countries.has(country));
  }

  function teamOptions(country?: string) {
    const countries = new Set(country ? [country] : countryOptions());
    const teams = new Map<string, { id: string; name: string; country: string }>();
    managedUsers
      .filter((member) => member.active && member.teamId && countries.has(member.country))
      .forEach((member) => {
        if (!teams.has(member.teamId)) {
          teams.set(member.teamId, { id: member.teamId, name: member.teamName || member.teamId, country: member.country });
        }
      });
    return [...teams.values()].sort((left, right) =>
      left.country.localeCompare(right.country, "nl-BE") || left.name.localeCompare(right.name, "nl-BE")
    );
  }

  function userOptions(country?: string, teamId?: string) {
    const countries = new Set(country ? [country] : countryOptions());
    return managedUsers
      .filter((member) => member.active && member.role === "REPRESENTATIVE")
      .filter((member) => countries.has(member.country))
      .filter((member) => !teamId || member.teamId === teamId)
      .filter((member) => user.role !== "SALES_LEADER" || Boolean(user.teamId && member.teamId === user.teamId))
      .sort((left, right) =>
        left.country.localeCompare(right.country, "nl-BE") ||
        left.teamName.localeCompare(right.teamName, "nl-BE") ||
        left.lastName.localeCompare(right.lastName, "nl-BE") ||
        left.firstName.localeCompare(right.firstName, "nl-BE")
      );
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setFormError(undefined);
    try {
      const body = actionDefinitionPayload(draft);
      const response = await fetch("/api/action-definitions", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Actiepunt kon niet worden opgeslagen.");
      await refresh();
      setDraft(undefined);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Actiepunt kon niet worden opgeslagen.");
    } finally {
      setSaving(false);
    }
  }

  async function setDefinitionActive(item: ActionPointOverviewItem, active: boolean) {
    const nextDraft = normalizeDraft({
      id: item.id,
      title: item.title,
      tipsAndTricks: item.tipsAndTricks || item.description,
      targetValue: item.targetValue === undefined ? "" : String(item.targetValue),
      priority: item.priority,
      scope: item.scope,
      country: item.country ?? "",
      teamId: item.teamId ?? "",
      userId: item.userId ?? "",
      validFrom: item.validFrom,
      validUntil: item.validUntil ?? "",
      active,
      productIds: item.productIds ?? [],
    });
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const response = await fetch("/api/action-definitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionDefinitionPayload(nextDraft)),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Actiepunt kon niet worden bijgewerkt.");
      await refresh();
      setDetailAction(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Actiepunt kon niet worden bijgewerkt.");
    } finally {
      setSaving(false);
    }
  }

  async function closeConcreteActionPoint(item: ActionPointOverviewItem) {
    if (!item.concreteActionPointId) return;
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/action-points/${encodeURIComponent(item.concreteActionPointId)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: user.id,
          representativeId: item.representativeId,
        }),
      });
      const payload = await response.json() as {
        actionPoint?: {
          actionPointId: string;
          representativeId: string;
          status: "afgerond";
          closedAt: string;
          closedByUserId: string;
          closedByName: string;
        };
        error?: string;
      };
      if (!response.ok || !payload.actionPoint) throw new Error(payload.error ?? translate(user.language, "actionPoints.closeError"));
      const closedAction = payload.actionPoint;
      const key = `${closedAction.actionPointId}:${closedAction.representativeId}`;
      setClosedWorkflowActions((current) => ({
        ...current,
        [closedAction.actionPointId]: {
          status: "afgerond",
          closedAt: closedAction.closedAt,
          closedByUserId: closedAction.closedByUserId,
          closedByName: closedAction.closedByName,
          updatedAt: closedAction.closedAt,
        },
        [key]: {
          status: "afgerond",
          closedAt: closedAction.closedAt,
          closedByUserId: closedAction.closedByUserId,
          closedByName: closedAction.closedByName,
          updatedAt: closedAction.closedAt,
        },
      }));
      setCloseCandidate(undefined);
      setDetailAction((current) => current?.id === item.id ? {
        ...current,
        status: "afgerond",
        active: false,
        closedAt: closedAction.closedAt,
        closedByUserId: closedAction.closedByUserId,
        closedByName: closedAction.closedByName,
        updatedAt: closedAction.closedAt,
      } : current);
      setNotice(translate(user.language, "actionPoints.closeSuccess"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(user.language, "actionPoints.closeError"));
    } finally {
      setSaving(false);
    }
  }

  function actionDefinitionPayload(value: ActionDefinitionDraft) {
    return {
      actorId: user.id,
      id: value.id,
      title: value.title,
      description: value.tipsAndTricks,
      tipsAndTricks: value.tipsAndTricks,
      targetValue: value.targetValue,
      priority: value.priority,
      scope: value.scope,
      country: value.scope === "GLOBAL" ? undefined : value.country,
      teamId: ["TEAM", "USER"].includes(value.scope) ? value.teamId : undefined,
      userId: value.scope === "USER" ? value.userId : undefined,
      validFrom: value.validFrom,
      validUntil: value.validUntil || undefined,
      active: value.active,
      productIds: value.productIds,
    };
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderActionsTab() {
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Uit te voeren</p>
            <h2 className="text-xl font-bold text-slate-950">Actiepunten</h2>
            <p className="mt-1 text-sm text-slate-500">Gesorteerd per Globaal, Land, Team en Persoonlijk.</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{filteredActionItems.length}</span>
        </div>
        {renderSearchField("Zoek actiepunt, gebruiker, scope of eigenaar...", actionSearch, setActionSearch)}
        {renderScopeGroups(actionScopeGroups, "actions", "Geen uit te voeren actiepunten gevonden binnen deze zoekopdracht.")}
        {canManageDefinitions && (
          <div className="pt-2">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Beheer</p>
                <h3 className="text-lg font-bold text-slate-950">Niet-actief of buiten geldigheid</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{filteredClosedActionItems.length}</span>
            </div>
            {renderScopeGroups(closedActionScopeGroups, "closed-actions", "Geen niet-actieve of verlopen actiepunten gevonden.")}
          </div>
        )}
      </section>
    );
  }

  function renderUsersTab() {
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Uit te voeren</p>
            <h2 className="text-xl font-bold text-slate-950">Gebruikers</h2>
            <p className="mt-1 text-sm text-slate-500">Alle zichtbare actiepunten gegroepeerd per gebruiker.</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{userGroups.length}</span>
        </div>
        {renderSearchField("Zoek gebruiker, actiepunt, scope of eigenaar...", userSearch, setUserSearch)}
        {renderUserGroups(userGroups, "Geen gebruikers met uit te voeren actiepunten gevonden binnen deze zoekopdracht.")}
      </section>
    );
  }

  function renderSearchField(
    placeholder: string,
    value: string,
    onChange: (value: string) => void,
  ) {
    return (
      <label className="relative block">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input
          className="field pl-10"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  function renderScopeGroups(
    groups: ActionPointScopeGroup[],
    keyPrefix: string,
    emptyMessage: string,
  ) {
    if (groups.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {groups.map((group) => {
          const groupKey = `${keyPrefix}:${group.id}`;
          const groupOpen = !collapsedGroups.has(groupKey);
          return (
            <section key={groupKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                aria-expanded={groupOpen}
                className="flex w-full items-center gap-3 bg-slate-50/80 px-4 py-3.5 text-left transition hover:bg-brand-50/60 sm:px-5"
              >
                {groupOpen ? <ChevronDown className="h-5 w-5 text-brand-700" /> : <ChevronRight className="h-5 w-5 text-brand-700" />}
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Actiepunten</p>
                  <h3 className="truncate text-base font-bold text-slate-950">{group.title}</h3>
                </div>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">{group.items.length}</span>
              </button>
              {groupOpen && (
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => renderActionPointCard(item))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  function renderUserGroups(groups: ActionPointUserGroup[], emptyMessage: string) {
    if (groups.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {groups.map((group) => {
          const groupKey = `users:${group.id}`;
          const groupOpen = !collapsedGroups.has(groupKey);
          return (
            <section key={groupKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                aria-expanded={groupOpen}
                className="flex w-full items-center gap-3 bg-slate-50/80 px-4 py-3.5 text-left transition hover:bg-brand-50/60 sm:px-5"
              >
                {groupOpen ? <ChevronDown className="h-5 w-5 text-brand-700" /> : <ChevronRight className="h-5 w-5 text-brand-700" />}
                <Avatar initials={initialsFromName(group.title)} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{group.subtitle}</p>
                  <h3 className="truncate text-base font-bold text-slate-950">{group.title}</h3>
                </div>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">{group.items.length}</span>
              </button>
              {groupOpen && (
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => renderActionPointCard(item))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  function renderActionPointCard(item: ActionPointOverviewItem) {
    const scopeLabel = actionPointScopeLabel(item.scope);
    const status = item.status ?? (item.active ? "open" : "afgesloten");
    const meta = actionPointMetaParts(item).join(" · ");
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setDetailAction(item)}
        className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <Target className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="min-w-0 truncate text-sm font-bold text-slate-950">{item.title}</h4>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${scopeBadgeTone(item.scope)}`}>{scopeLabel}</span>
              <StatusBadge status={status} />
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityTone(item.priority)}`}>{priorityLabel(item.priority)}</span>
            </div>
          </div>
          <p className="mt-1 truncate text-xs leading-4 text-slate-500">{meta}</p>
        </div>
        {item.targetValue !== undefined && (
          <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800 sm:inline-flex">
            Target {item.targetValue}
          </span>
        )}
      </button>
    );
  }

  function renderDetailModal(item: ActionPointOverviewItem) {
    const canManageThis = item.source !== "workflow" && canManageScopedActionDefinition(user, item);
    const canCloseThis = item.source === "workflow" &&
      canCloseConcreteActionPoint(user) &&
      item.concreteActionPointId &&
      !["afgerond", "behaald", "niet_behaald", "geannuleerd"].includes(item.status ?? "");
    const body = item.tipsAndTricks || item.description;
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div className="min-w-0">
              <p className="eyebrow mb-1">{actionPointSourceLabel(item)}</p>
              <h2 className="text-xl font-bold text-slate-950">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{actionPointScopeDetail(item)}</p>
            </div>
            <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setDetailAction(undefined)} aria-label="Sluiten">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${scopeBadgeTone(item.scope)}`}>{actionPointScopeLabel(item.scope)}</span>
              <StatusBadge status={item.status ?? (item.active ? "open" : "afgesloten")} />
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityTone(item.priority)}`}>{priorityLabel(item.priority)}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Doelgroep" value={actionPointScopeDetail(item)} />
              <ReadOnlyField label="Periode" value={actionPointDateLabel(item)} />
              <ReadOnlyField label="Eigenaar" value={item.ownerName || "Niet toegewezen"} />
              <ReadOnlyField label="Target" value={item.targetValue === undefined ? "Geen target" : String(item.targetValue)} />
              {item.closedAt && <ReadOnlyField label={translate(user.language, "actionPoints.closedAt")} value={formatShortDate(item.closedAt.slice(0, 10))} />}
              {item.closedByName && <ReadOnlyField label={translate(user.language, "actionPoints.closedBy")} value={item.closedByName} />}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Producten</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(item.products ?? []).length > 0
                  ? item.products?.map((product) => <span key={product.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800">{product.name}</span>)
                  : <span className="text-sm text-slate-500">Geen producten gekoppeld.</span>}
              </div>
            </div>

            {!isBlankRichText(body) && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Omschrijving</p>
                <RichTextRenderer value={body} className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-5">
            {canManageThis && (
              <>
                <button type="button" className="btn-secondary" onClick={() => openEditDialog(item)} disabled={saving}>Bewerken</button>
                <button
                  type="button"
                  className={item.active ? "btn-secondary text-rose-700" : "btn-primary"}
                  onClick={() => void setDefinitionActive(item, !item.active)}
                  disabled={saving}
                >
                  {item.active ? "Inactief zetten" : "Activeren"}
                </button>
              </>
            )}
            {canCloseThis && (
              <button type="button" className="btn-primary" onClick={() => setCloseCandidate(item)} disabled={saving}>
                {translate(user.language, "actionPoints.actions.close")}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => setDetailAction(undefined)}>Sluiten</button>
          </div>
        </div>
      </div>
    );
  }

  function renderCloseDialog(item: ActionPointOverviewItem) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-950">{translate(user.language, "actionPoints.closeDialog.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{translate(user.language, "actionPoints.closeDialog.message")}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 p-5">
            <button type="button" className="btn-secondary" onClick={() => setCloseCandidate(undefined)} disabled={saving}>
              {translate(user.language, "actionPoints.closeDialog.cancel")}
            </button>
            <button type="button" className="btn-primary" onClick={() => void closeConcreteActionPoint(item)} disabled={saving}>
              {translate(user.language, "actionPoints.closeDialog.confirm")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderActionDefinitionDialog() {
    if (!draft) return null;
    const scopeOptions = allowedTargetTypes();
    const countries = countryOptions();
    const teams = teamOptions(draft.country);
    const users = userOptions(draft.country, draft.teamId);
    const visibleProducts = products
      .filter((product) => product.active)
      .filter((product) => draft.productIds.includes(product.id) || matchesText(product.name, productSearch))
      .sort((left, right) =>
        Number(draft.productIds.includes(right.id)) - Number(draft.productIds.includes(left.id)) ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "nl-BE")
      );

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
        <form
          className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDraft();
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <p className="eyebrow mb-1">Actiepunt</p>
              <h2 className="text-xl font-bold text-slate-950">{draft.id ? "Actiepunt bewerken" : "Actiepunt toevoegen"}</h2>
            </div>
            <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setDraft(undefined)} aria-label="Sluiten">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            {formError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{formError}</p>}
            {scopeOptions.length === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Geen actiepuntsoorten beschikbaar voor jouw rechten.</p>}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Naam</span>
                <input className="field" value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} disabled={saving} required />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Soort actiepunt</span>
                <select
                  className="field"
                  value={draft.scope}
                  onChange={(event) => updateDraft({ scope: event.target.value as ScopedActionDefinition["scope"] })}
                  disabled={saving || scopeOptions.length === 0}
                >
                  {scopeOptions.map((targetType) => (
                    <option key={targetType.id} value={targetType.code}>{targetType.name || actionPointScopeLabel(targetType.code)}</option>
                  ))}
                </select>
              </label>
            </div>

            {renderTargetFields(countries, teams, users)}

            <RichTextEditor label="Omschrijving" value={draft.tipsAndTricks} disabled={saving} onChange={(value) => updateDraft({ tipsAndTricks: value })} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Geldig vanaf</span>
                <input className="field" type="date" value={draft.validFrom} onChange={(event) => updateDraft({ validFrom: event.target.value })} disabled={saving} required />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Geldig tot</span>
                <input className="field" type="date" value={draft.validUntil} onChange={(event) => updateDraft({ validUntil: event.target.value })} disabled={saving} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Target</span>
                <input className="field" type="number" min="0" step="0.01" value={draft.targetValue} onChange={(event) => updateDraft({ targetValue: event.target.value })} disabled={saving} placeholder="Optioneel" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Prioriteit</span>
                <select className="field" value={draft.priority} onChange={(event) => updateDraft({ priority: event.target.value as ScopedActionDefinition["priority"] })} disabled={saving}>
                  <option value="laag">Laag</option>
                  <option value="normaal">Normaal</option>
                  <option value="hoog">Hoog</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={draft.active} onChange={(event) => updateDraft({ active: event.target.checked })} disabled={saving} />
              Actief
            </label>

            <div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Producten</span>
                <span className="relative block">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input className="field pl-10" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Zoek product..." disabled={saving} />
                </span>
              </label>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-200">
                {visibleProducts.map((product) => (
                  <label key={product.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 last:border-b-0 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={draft.productIds.includes(product.id)}
                      onChange={(event) => {
                        const productIds = event.target.checked
                          ? [...draft.productIds, product.id]
                          : draft.productIds.filter((id) => id !== product.id);
                        updateDraft({ productIds: [...new Set(productIds)] });
                      }}
                      disabled={saving}
                    />
                    <span>{product.name}</span>
                  </label>
                ))}
                {visibleProducts.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Geen producten gevonden.</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-5">
            <button type="button" className="btn-secondary" onClick={() => setDraft(undefined)} disabled={saving}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={saving || scopeOptions.length === 0}>
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Opslaan
            </button>
          </div>
        </form>
      </div>
    );
  }

  function renderTargetFields(
    countries: string[],
    teams: { id: string; name: string; country: string }[],
    users: typeof managedUsers,
  ) {
    if (!draft) return null;
    if (draft.scope === "GLOBAL") {
      return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Dit actiepunt geldt globaal voor alle toegestane gebruikers.</div>;
    }
    if (draft.scope === "COUNTRY") {
      return (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Land</span>
          <select className="field" value={draft.country} onChange={(event) => updateDraft({ country: event.target.value })} disabled={saving}>
            {countries.map((country) => <option key={country} value={country}>{countryName(country)}</option>)}
          </select>
        </label>
      );
    }
    if (draft.scope === "TEAM") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Land</span>
            <select className="field" value={draft.country} onChange={(event) => updateDraft({ country: event.target.value, teamId: "" })} disabled={saving}>
              {countries.map((country) => <option key={country} value={country}>{countryName(country)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Team</span>
            <select className="field" value={draft.teamId} onChange={(event) => updateDraft({ teamId: event.target.value })} disabled={saving} required>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        </div>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Land</span>
          <select className="field" value={draft.country} onChange={(event) => updateDraft({ country: event.target.value, teamId: "", userId: "" })} disabled={saving || user.role === "SALES_LEADER"}>
            {countries.map((country) => <option key={country} value={country}>{countryName(country)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Team</span>
          <select className="field" value={draft.teamId} onChange={(event) => updateDraft({ teamId: event.target.value, userId: "" })} disabled={saving || user.role === "SALES_LEADER"}>
            <option value="">Alle teams</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Gebruiker</span>
          <select className="field" value={draft.userId} onChange={(event) => updateDraft({ userId: event.target.value })} disabled={saving} required>
            {users.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
          </select>
        </label>
      </div>
    );
  }

  function actionPointScopeDetail(item: ActionPointOverviewItem) {
    if (item.scope === "GLOBAL") return "Alle toegestane gebruikers";
    if (item.scope === "COUNTRY") return item.country ? countryName(item.country) : "Land niet ingevuld";
    if (item.scope === "TEAM") {
      return managedUsers.find((member) => member.teamId === item.teamId)?.teamName ?? item.teamId ?? "Team niet ingevuld";
    }
    if (item.representativeName) return item.representativeName;
    const person = managedUsers.find((member) => member.id === item.userId || member.representativeId === item.userId);
    return person ? `${person.firstName} ${person.lastName}` : item.userId ?? "Gebruiker niet ingevuld";
  }

  function actionPointDateLabel(item: ActionPointOverviewItem) {
    if (item.source === "workflow") return item.due ? formatShortDate(item.due) : "Geen deadline";
    return `${formatShortDate(item.validFrom)} t/m ${item.validUntil ? formatShortDate(item.validUntil) : "onbepaald"}`;
  }

  function actionPointSourceLabel(item: ActionPointOverviewItem) {
    if (item.originLabel) return item.originLabel;
    return item.source === "workflow" ? "Gekoppeld actiepunt" : "Scope-actiepunt";
  }

  function actionPointMetaParts(item: ActionPointOverviewItem) {
    return [
      actionPointSourceLabel(item),
      actionPointScopeDetail(item),
      item.source === "workflow" ? `Deadline ${actionPointDateLabel(item)}` : actionPointDateLabel(item),
      item.ownerName ? `Eigenaar ${item.ownerName}` : undefined,
      richTextToPlainText(item.description).trim() || undefined,
    ].filter(Boolean) as string[];
  }

  function matchesActionPointSearch(item: ActionPointOverviewItem, query: string) {
    return matchesText([
      item.title,
      richTextToPlainText(item.description),
      item.priority,
      item.status,
      actionPointScopeLabel(item.scope),
      actionPointScopeDetail(item),
      actionPointDateLabel(item),
      actionPointSourceLabel(item),
      item.ownerName,
      item.representativeName,
      item.country ? countryName(item.country) : "",
      item.teamId,
    ].filter(Boolean).join(" "), query);
  }

  function matchesText(value: string, query: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase("nl-BE");
    if (!normalizedQuery) return true;
    return value.toLocaleLowerCase("nl-BE").includes(normalizedQuery);
  }

  function initialsFromName(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }
}

function scopeBadgeTone(scope: ScopedActionDefinition["scope"]) {
  if (scope === "GLOBAL") return "bg-slate-100 text-slate-700";
  if (scope === "COUNTRY") return "bg-blue-100 text-blue-800";
  if (scope === "TEAM") return "bg-brand-50 text-brand-800";
  return "bg-amber-100 text-amber-800";
}

function priorityTone(priority: ScopedActionDefinition["priority"]) {
  if (priority === "hoog") return "bg-rose-100 text-rose-800";
  if (priority === "laag") return "bg-slate-100 text-slate-700";
  return "bg-amber-100 text-amber-800";
}

function priorityLabel(priority: ScopedActionDefinition["priority"]) {
  if (priority === "hoog") return "Hoog";
  if (priority === "laag") return "Laag";
  return "Normaal";
}

// Legacy action-point screen retained until the final action-point lifecycle is defined.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyActionPoints() {
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

function MyProfilePage() {
  const { user, managedUsers } = useSession();
  const profile = managedUsers.find((item) => item.id === user.id);
  const initials = `${user.name.split(" ")[0]?.[0] ?? ""}${user.name.split(" ")[1]?.[0] ?? ""}`.toUpperCase();
  const details = [
    { label: "E-mailadres", value: user.email || profile?.email || "Onbekend" },
    { label: "Rol", value: roleLabels[user.role] },
    { label: "Land", value: user.country },
    { label: "Team", value: profile?.teamName || "Geen team" },
    { label: "Vertegenwoordiger", value: profile?.representativeId ? "Gekoppeld" : "Niet gekoppeld" },
    { label: "Taal", value: user.language.toUpperCase() },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Gebruiker"
        title="Mijn gegevens"
        description="Je persoonlijke profiel en accountgegevens in FieldForce."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <Avatar initials={initials} className="h-16 w-16 text-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Profiel</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">{user.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{roleLabels[user.role]} · {user.country}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status="open" label={roleLabels[user.role]} />
                <StatusBadge status={profile?.active ? "open" : "geannuleerd"} label={profile?.active ? "Actief" : "Niet-actief"} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{detail.label}</p>
                <p className="mt-2 break-words text-sm font-semibold text-slate-900">{detail.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Snelle acties</p>
          <div className="mt-3 space-y-2">
            <Link href="/dashboard" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
              Naar dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/mijn-team" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
              Mijn Team
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/begeleidingen" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
              Begeleidingen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodayTasksPage() {
  const { user, managedUsers } = useSession();
  const { isModuleEnabled } = useModules();
  const {
    visibleInterventions,
    visibleContactMoments,
    visibleHelpRequests,
    visibleRetrainings,
    visibleSalesTrainings,
  } = useWorkflow();
  const { representatives } = useRepresentatives();
  const today = localDateKey();
  const attentionSections = useMemo(
    () => buildDashboardAttentionSections({
      currentUser: user,
      today,
      interventions: isModuleEnabled("BEGELEIDINGEN") ? dedupeById(visibleInterventions(user)) : [],
      contactMoments: isModuleEnabled("CONTACTMOMENTEN") ? visibleContactMoments(user) : [],
      helpRequests: isModuleEnabled("HULPAANVRAGEN") ? visibleHelpRequests(user) : [],
      retrainings: isModuleEnabled("RETRAININGEN") ? visibleRetrainings(user) : [],
      salesTrainings: isModuleEnabled("SALESTRAININGEN") ? visibleSalesTrainings(user) : [],
      representativeName: (id) => {
        const representative = representatives.find((item) => item.id === id);
        return representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend";
      },
      ownerName: (id) => id ? reportingUserName(id, managedUsers) : undefined,
    }),
    [
      isModuleEnabled,
      managedUsers,
      representatives,
      today,
      user,
      visibleContactMoments,
      visibleHelpRequests,
      visibleInterventions,
      visibleRetrainings,
      visibleSalesTrainings,
    ],
  );
  const todayItemCount = attentionSections.todo.length + attentionSections.done.length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Werkdag"
        title="Taken vandaag"
        description="Een compacte weergave van wat vandaag in jouw scope aandacht vraagt."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Vandaag gepland</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{todayItemCount}</p>
          <p className="mt-1 text-sm text-slate-500">Items op {new Date(`${today}T12:00:00`).toLocaleDateString("nl-BE")}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Uit te voeren</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{attentionSections.todo.length}</p>
          <p className="mt-1 text-sm text-slate-500">Nog niet afgeronde items</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Uitgevoerd</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{attentionSections.done.length}</p>
          <p className="mt-1 text-sm text-slate-500">Afgewerkt of ingediend vandaag</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Totale scope</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{todayItemCount}</p>
          <p className="mt-1 text-sm text-slate-500">Zichtbare items voor vandaag</p>
        </div>
      </div>

      <DashboardAttentionCard sections={attentionSections} link={null} />
    </div>
  );
}

function PlaceholderWorkspace({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Voorbereiding" title={title} description={description} />
      <EmptyState title="Nog geen inhoud beschikbaar" description="Deze route is al gekoppeld aan het menu, maar de inhoud wordt later verder ingevuld." />
    </div>
  );
}

function Management({ section }: { section?: string }) {
  const { user } = useSession();
  const resolvedSection = section
    ? canAccessManagementSection(user, section)
      ? section
      : undefined
    : getDefaultManagementSection(user);
  if (!resolvedSection) return <ManagementRedirect />;

  if (resolvedSection === "gebruikers") return <UsersManagementPage />;
  if (resolvedSection === "modules") return <ModuleManagement />;
  if (resolvedSection === "log") return <ManagementLog />;
  if (resolvedSection === "instellingen") return <SettingsManagement />;
  if (["teams", "rollen", "kpis", "kapstok"].includes(resolvedSection)) {
    return <ConfigurationManagement section={resolvedSection as "teams" | "rollen" | "kpis" | "kapstok"} />;
  }
  return <ManagementRedirect />;
}

function ManagementLog() {
  const { user } = useSession();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Beheer"
        title="Log"
        description="Actiehistoriek binnen je toegelaten scope, met dezelfde filters en paginatie als de vroegere dashboardweergave."
      />
      <ActivityHistoryCard user={user} />
    </div>
  );
}

function ManagementRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}

// Legacy management prototype retained while Beheer sections are consolidated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SimpleManagementList({ items, icon: Icon }: { items: string[]; icon: typeof Users }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => <div key={item} className="card flex items-center gap-4 p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold">{item}</p><p className="mt-1 text-xs text-slate-500">Actief · volgorde {index + 1}</p></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><MoreHorizontal className="h-5 w-5" /></button></div>)}</div>;
}

// Legacy management prototype retained while Kapstok beheer lives in ConfigurationManagement.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function formatKpiValue(value: number, unit: "%" | "EUR" | "count" | "minutes" | "hours" | "km" | "number") {
  if (unit === "%") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 1 })}%`;
  if (unit === "EUR") return `€ ${value.toLocaleString("nl-BE", { maximumFractionDigits: 0 })}`;
  if (unit === "minutes") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} min`;
  if (unit === "hours") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} u`;
  if (unit === "km") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} km`;
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}

function SectionTitle({ title, subtitle, link }: { title: string; subtitle: string; link?: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></div>{link && <Link href={link} className="flex items-center gap-1 text-sm font-semibold text-brand-700">Alles <ArrowRight className="h-4 w-4" /></Link>}</div>;
}

