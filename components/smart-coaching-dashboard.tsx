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

export function SmartDashboardPanel({
  result,
  personal = false,
}: {
  result: SmartCoachingResult;
  personal?: boolean;
}) {
  if (personal) {
    const insight = result.insights[0];
    if (!insight) return null;
    return (
      <section id="smart-alerts" className="card overflow-hidden">
        <SmartHeader
          title="Mijn coachingadvies"
          description="Automatisch berekend op basis van je KPI's, actiepunten en recente opvolging."
          icon={Sparkles}
        />
        <div className="grid gap-3 p-3.5 lg:grid-cols-[0.8fr_1.4fr]">
          <div className="rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-950">Persoonlijke status</p>
              <RiskBadge risk={insight.risk} />
            </div>
            <ul className="mt-2.5 space-y-1 text-xs leading-4 text-slate-600">
              {insight.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
            </ul>
          </div>
          <RecommendationList recommendations={insight.recommendations} />
        </div>
      </section>
    );
  }

  const priorities = result.insights.filter((item) => item.risk !== "green").slice(0, 3);
  return (
    <section className="card overflow-hidden">
      <SmartHeader
        title="Coachingprioriteiten"
        description="Risico's en opvolging binnen je huidige team- of managementscope."
        icon={CircleHelp}
      />
      <div className="grid gap-3 p-3.5 lg:grid-cols-3">
        {priorities.map((insight) => <PriorityCard key={insight.representative.id} insight={insight} />)}
        {priorities.length === 0 && (
          <div className="col-span-full flex items-center gap-3 rounded-xl bg-emerald-50 p-3.5 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <div><p className="font-bold">Geen extra prioriteiten</p><p className="text-sm">Er zijn vandaag geen urgente coachingprioriteiten.</p></div>
          </div>
        )}
      </div>
    </section>
  );
}

export function SmartManagementSections({ result }: { result: SmartCoachingResult }) {
  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <SmartHeader title="Team heatmap" description="Risico, activiteit en opvolging per team." icon={Users} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50">
                {["Team", "Risico", "Open acties", "Interventies", "Risico VT's", "Niet akkoord"].map((label) => (
                  <th key={label} className="whitespace-nowrap px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.heatmap.map((team) => (
                <tr key={team.teamId} className="border-t border-slate-100">
                  <td className="px-5 py-4 font-semibold text-slate-900">{team.team}<span className="block text-xs font-normal text-slate-400">{team.leader} · {team.country}</span></td>
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

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="card overflow-hidden">
          <SmartHeader title="Coaching trends" description="Meest voorkomende thema's in de huidige scope." icon={Target} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <TrendList title="Werkpunten" items={result.trends.workPoints} />
            <TrendList title="Focusfasen" items={result.trends.focusPhases} />
            <TrendList title="Hulpaanvragen" items={result.trends.helpRequests} />
            <TrendList title="Retrainingen" items={result.trends.retrainings} />
          </div>
        </section>

        <section id="smart-alerts" className="card overflow-hidden">
          <SmartHeader title="Management alerts" description="Concrete uitzonderingen die opvolging vragen." icon={Clock3} />
          <div className="divide-y divide-slate-100">
            {result.alerts.slice(0, 8).map((alert) => (
              <Link key={alert.id} href={alert.href} className="flex items-start gap-3 p-4 transition hover:bg-slate-50">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${alert.severity === "red" ? "bg-rose-500" : "bg-amber-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{alert.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{alert.detail}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-slate-300" />
              </Link>
            ))}
            {result.alerts.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Geen actieve management alerts.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const config = {
    green: { label: "Groen", style: "bg-emerald-100 text-emerald-800" },
    orange: { label: "Oranje", style: "bg-amber-100 text-amber-800" },
    red: { label: "Rood", style: "bg-rose-100 text-rose-800" },
  }[risk];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${config.style}`}>{config.label}</span>;
}

function PriorityCard({ insight }: { insight: RepresentativeCoachingInsight }) {
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
        {insight.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
      </ul>
      {recommendation && (
        <Link href={recommendation.href} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700">
          {recommendation.title} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </article>
  );
}

function RecommendationList({ recommendations }: { recommendations: CoachingRecommendation[] }) {
  return (
    <div className="space-y-2">
      {recommendations.map((item) => (
        <Link key={item.id} href={item.href} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><ClipboardCheck className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold leading-4 text-slate-900">{item.title}</p><p className="mt-0.5 line-clamp-1 text-xs leading-4 text-slate-500">{item.reason}</p></div>
          <RiskBadge risk={item.priority} />
        </Link>
      ))}
    </div>
  );
}

function TrendList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
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
        {items.length === 0 && <p className="text-xs text-slate-400">Nog onvoldoende gegevens.</p>}
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
