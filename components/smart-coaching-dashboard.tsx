"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type {
  CoachingRecommendation,
  RepresentativeCoachingInsight,
  RiskLevel,
  SmartCoachingResult,
} from "@/lib/smart-coaching";
import { useSession } from "@/components/session-provider";
import { translate } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function SmartDashboardPanel({
  result,
  personal = false,
}: {
  result: SmartCoachingResult;
  personal?: boolean;
}) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  if (personal) {
    const insight = result.insights[0];
    if (!insight) return null;
    return (
      <section id="smart-alerts" className="card overflow-hidden">
        <SmartHeader
          title={t("coaching.dashboard.personalAdvice")}
          description={t("coaching.dashboard.personalAdviceDescription")}
          icon={Sparkles}
        />
        <div className="grid gap-3 p-3.5 lg:grid-cols-[0.8fr_1.4fr]">
          <div className="rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-950">{t("coaching.dashboard.personalStatus")}</p>
              <RiskBadge risk={insight.risk} />
            </div>
            <ul className="mt-2.5 space-y-1 text-xs leading-4 text-slate-600">
              {insight.reasons.map((reason) => <li key={reason}>- {translateSmartText(language, reason)}</li>)}
            </ul>
          </div>
          <RecommendationList recommendations={insight.recommendations} language={language} />
        </div>
      </section>
    );
  }

  const priorities = result.insights.filter((item) => item.risk !== "green").slice(0, 3);
  return (
    <section className="card overflow-hidden">
      <SmartHeader
        title={t("coaching.dashboard.priorities")}
        description={t("coaching.dashboard.prioritiesDescription")}
        icon={CircleHelp}
      />
      <div className="grid gap-3 p-3.5 lg:grid-cols-3">
        {priorities.map((insight) => <PriorityCard key={insight.representative.id} insight={insight} />)}
        {priorities.length === 0 && (
          <div className="col-span-full flex items-center gap-3 rounded-xl bg-emerald-50 p-3.5 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <div><p className="font-bold">{t("coaching.dashboard.noExtraPriorities")}</p><p className="text-sm">{t("coaching.dashboard.noUrgentPriorities")}</p></div>
          </div>
        )}
      </div>
    </section>
  );
}

export function SmartManagementSections({ result }: { result: SmartCoachingResult }) {
  return (
    <div className="space-y-5">
      <SmartTeamHeatmap result={result} />
      <SmartReportingSections result={result} />
    </div>
  );
}

export function SmartTeamHeatmap({ result }: { result: SmartCoachingResult }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <section className="card overflow-hidden">
      <SmartHeader title={t("coaching.dashboard.heatmap")} description={t("coaching.dashboard.heatmapDescription")} icon={Users} />
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              {["coaching.dashboard.columnTeam", "coaching.dashboard.columnRisk", "coaching.dashboard.columnOpenActions", "coaching.dashboard.columnInterventions", "coaching.dashboard.columnRiskEvaluations", "coaching.dashboard.columnNotAgreed"].map((key) => (
                <th key={key} className="whitespace-nowrap px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t(key as TranslationKey)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.heatmap.map((team) => (
              <tr key={team.teamId} className="border-t border-slate-100">
                <td className="px-5 py-4 font-semibold text-slate-900">{team.team}<span className="block text-xs font-normal text-slate-400">{team.leader} - {team.country}</span></td>
                <td className="px-5 py-4"><RiskBadge risk={team.risk} /></td>
                <td className="px-5 py-4 text-slate-600">{team.openActionCount}</td>
                <td className="px-5 py-4 text-slate-600">{team.interventionCount}</td>
                <td className="px-5 py-4 text-slate-600">{team.riskUserCount}</td>
                <td className="px-5 py-4 text-slate-600">{team.notAgreedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SmartReportingSections({ result }: { result: SmartCoachingResult }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="card overflow-hidden">
        <SmartHeader title={t("coaching.dashboard.trends")} description={t("coaching.dashboard.trendsDescription")} icon={Target} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <TrendList title={t("coaching.dashboard.workPoints")} items={result.trends.workPoints} />
          <TrendList title={t("coaching.dashboard.focusPhases")} items={result.trends.focusPhases} />
          <TrendList title={t("coaching.dashboard.helpRequests")} items={result.trends.helpRequests} />
          <TrendList title={t("coaching.dashboard.retrainings")} items={result.trends.retrainings} />
        </div>
      </section>

      <section id="smart-alerts" className="card overflow-hidden">
        <SmartHeader title={t("coaching.dashboard.managementAlerts")} description={t("coaching.dashboard.managementAlertsDescription")} icon={Clock3} />
        <div className="divide-y divide-slate-100">
          {result.alerts.slice(0, 8).map((alert) => (
            (() => {
              const translated = translateSmartAlert(language, alert);
              return <Link key={alert.id} href={alert.href} className="flex items-start gap-3 p-4 transition hover:bg-slate-50">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${alert.severity === "red" ? "bg-rose-500" : "bg-amber-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{translated.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{translated.detail}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 text-slate-300" />
            </Link>;
            })()
          ))}
          {result.alerts.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{t("coaching.dashboard.noManagementAlerts")}</p>}
        </div>
      </section>
    </div>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const config = {
    green: { label: t("coaching.dashboard.riskGreen"), style: "bg-emerald-100 text-emerald-800" },
    orange: { label: t("coaching.dashboard.riskOrange"), style: "bg-amber-100 text-amber-800" },
    red: { label: t("coaching.dashboard.riskRed"), style: "bg-rose-100 text-rose-800" },
  }[risk];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${config.style}`}>{config.label}</span>;
}

function PriorityCard({ insight }: { insight: RepresentativeCoachingInsight }) {
  const { language } = useSession();
  const recommendation = insight.recommendations[0];
  return (
    <article className={`rounded-xl border p-3.5 ${insight.risk === "red" ? "border-rose-200 bg-rose-50/60" : "border-amber-200 bg-amber-50/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">{insight.representative.firstName} {insight.representative.lastName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{insight.representative.team}</p>
        </div>
        <RiskBadge risk={insight.risk} />
      </div>
      <ul className="mt-2.5 space-y-1 text-xs leading-4 text-slate-600">
        {insight.reasons.slice(0, 3).map((reason) => <li key={reason}>- {translateSmartText(language, reason)}</li>)}
      </ul>
      {recommendation && (
        <Link href={recommendation.href} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700">
          {translateSmartRecommendation(language, recommendation).title} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </article>
  );
}

function RecommendationList({ recommendations, language }: { recommendations: CoachingRecommendation[]; language: Language }) {
  return (
    <div className="space-y-2">
      {recommendations.map((item) => {
        const translated = translateSmartRecommendation(language, item);
        return (
          <Link key={item.id} href={item.href} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><ClipboardCheck className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold leading-4 text-slate-900">{translated.title}</p><p className="mt-0.5 line-clamp-1 text-xs leading-4 text-slate-500">{translated.reason}</p></div>
            <RiskBadge risk={item.priority} />
          </Link>
        );
      })}
    </div>
  );
}

function interpolate(language: Language, key: TranslationKey, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replace(`{${name}}`, value),
    translate(language, key),
  );
}

function translateSmartText(language: Language, value: string) {
  const exact: Record<string, TranslationKey> = {
    "nog geen geregistreerde begeleiding": "coaching.dashboard.reason.noCoaching",
    "alles op schema": "coaching.dashboard.reason.allOnTrack",
    "Er is nog geen geregistreerde begeleiding.": "coaching.dashboard.recommendation.noCoaching",
    "Er staat een hulpaanvraag open zonder gekozen vervolgactie.": "coaching.dashboard.recommendation.helpWithoutFollowUp",
    "Er is nog geen geregistreerd contactmoment terwijl actiepunten openstaan.": "coaching.dashboard.recommendation.noContact",
    "Focus op behoefteanalyse": "coaching.dashboard.recommendation.focusNeedsAnalysis",
    "Recente werkpunten verwijzen naar vragen stellen en behoefteanalyse.": "coaching.dashboard.recommendation.focusNeedsAnalysisReason",
    "Focus op koppelverkoop": "coaching.dashboard.recommendation.focusCrossSell",
    "Koppelverkoop komt terug in de open werkpunten.": "coaching.dashboard.recommendation.focusCrossSellReason",
    "Focus op afsluittechnieken": "coaching.dashboard.recommendation.focusClosing",
    "Afsluiten of prijsverdediging vraagt extra aandacht.": "coaching.dashboard.recommendation.focusClosingReason",
    "Blijf de huidige aanpak opvolgen": "coaching.dashboard.recommendation.keepCurrentApproach",
    "Er zijn geen urgente afwijkingen binnen de huidige gegevens.": "coaching.dashboard.recommendation.noUrgentDeviations",
  };
  const exactKey = exact[value];
  if (exactKey) return translate(language, exactKey);

  let match = value.match(/^geen begeleiding sinds (\d+) dagen$/);
  if (match) return interpolate(language, "coaching.dashboard.reason.coachingDays", { days: match[1] });
  match = value.match(/^(\d+) achterstallige actiepunten$/);
  if (match) return interpolate(language, "coaching.dashboard.reason.overdueActions", { count: match[1] });
  match = value.match(/^negatieve KPI-trend: (.+)$/);
  if (match) return interpolate(language, "coaching.dashboard.reason.negativeKpiTrend", { kpis: match[1] });
  match = value.match(/^(\d+) hulpaanvraag zonder opvolging$/);
  if (match) return interpolate(language, "coaching.dashboard.reason.helpWithoutFollowUp", { count: match[1] });
  match = value.match(/^(\d+) open actiepunten$/);
  if (match) return interpolate(language, "coaching.dashboard.reason.openActions", { count: match[1] });
  match = value.match(/^De laatste begeleiding is (\d+) dagen geleden\.$/);
  if (match) return interpolate(language, "coaching.dashboard.recommendation.lastCoaching", { days: match[1] });
  match = value.match(/^(\d+) KPI's evolueren negatief\.$/);
  if (match) return interpolate(language, "coaching.dashboard.recommendation.negativeKpis", { count: match[1] });
  match = value.match(/^(\d+) actiepunten zijn over deadline\.$/);
  if (match) return interpolate(language, "coaching.dashboard.recommendation.overdueActions", { count: match[1] });
  match = value.match(/^(.+) evolueert negatief en vraagt gerichte opvolging\.$/);
  if (match) return interpolate(language, "coaching.dashboard.recommendation.negativeKpiFollowUp", { kpi: match[1] });
  match = value.match(/^Er was (\d+) dagen geen contactmoment terwijl actiepunten openstaan\.$/);
  if (match) return interpolate(language, "coaching.dashboard.recommendation.noContactDays", { days: match[1] });
  match = value.match(/^(\d+) actiepunten vragen actieve opvolging\.$/);
  if (match) return interpolate(language, "coaching.dashboard.recommendation.openActionsFollowUp", { count: match[1] });
  return value;
}

function translateSmartRecommendation(language: Language, item: CoachingRecommendation) {
  const titleKeys: Record<string, TranslationKey> = {
    "Plan een nieuwe begeleiding": "coaching.dashboard.recommendation.planCoaching",
    "Plan een retraining": "coaching.dashboard.recommendation.planRetraining",
    "Plan een contactmoment": "coaching.dashboard.recommendation.planContact",
  };
  return {
    ...item,
    title: titleKeys[item.title] ? translate(language, titleKeys[item.title]) : item.title,
    reason: translateSmartText(language, item.reason),
  };
}

function translateSmartAlert(language: Language, alert: { title: string; detail: string }) {
  let title = alert.title;
  let detail = alert.detail;
  let match = alert.title.match(/^(.+) zonder recente begeleiding$/);
  if (match) title = interpolate(language, "coaching.dashboard.alert.coachingTitle", { name: match[1] });
  if (alert.title === "Actiepunt verlopen") title = translate(language, "coaching.dashboard.alert.overdueTitle");
  if (alert.title === "Hulpaanvraag zonder eigenaar") title = translate(language, "coaching.dashboard.alert.helpTitle");
  if (alert.title === "Retraining zonder opvolging") title = translate(language, "coaching.dashboard.alert.retrainingTitle");

  if (alert.detail === "Nog geen geregistreerde begeleiding.") {
    detail = translate(language, "coaching.dashboard.alert.noCoaching");
  } else if ((match = alert.detail.match(/^(\d+) dagen sinds de laatste begeleiding\.$/))) {
    detail = interpolate(language, "coaching.dashboard.alert.coachingDays", { days: match[1] });
  } else if ((match = alert.detail.match(/^(.+) · deadline (.+)\.$/))) {
    detail = `${match[1]} · ${interpolate(language, "coaching.dashboard.alert.deadline", { date: match[2] })}`;
  }
  return { title, detail };
}

function TrendList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{item.label}</span><span className="font-bold text-slate-900">{item.count}</span></div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-700" style={{ width: `${Math.max(10, item.count / maximum * 100)}%` }} /></div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400">{t("coaching.dashboard.insufficientData")}</p>}
      </div>
    </div>
  );
}

function SmartHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon className="h-4 w-4" /></div>
      <div><h2 className="text-sm font-bold text-slate-950">{title}</h2><p className="mt-0.5 text-xs leading-4 text-slate-500">{description}</p></div>
    </div>
  );
}
