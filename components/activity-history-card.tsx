"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  Filter,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  Gauge,
  Play,
  Save,
  Send,
  X,
} from "lucide-react";
import type {
  ActivityHistoryItem,
  ActivityHistoryKind,
  ActivityHistoryResponse,
} from "@/lib/activity-history";
import type { MockUser } from "@/lib/types";

type Filters = {
  from: string;
  to: string;
  teamId: string;
  representativeId: string;
};

const pageSize = 25;

export function ActivityHistoryCard({ user }: { user: MockUser }) {
  const defaults = useMemo(defaultFilters, []);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityHistoryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        actorId: user.id,
        from: filters.from,
        to: filters.to,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.teamId) params.set("teamId", filters.teamId);
      if (filters.representativeId) params.set("representativeId", filters.representativeId);
      try {
        const response = await fetch(`/api/activity-history?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as ActivityHistoryResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "De actiehistoriek kon niet worden geladen.");
        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "De actiehistoriek kon niet worden geladen.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, page, user.id]);

  const representativeOptions = (data?.representatives ?? []).filter((option) =>
    !filters.teamId || option.teamId === filters.teamId
  );

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "teamId" && current.representativeId && !data?.representatives.some((item) => item.id === current.representativeId && (!value || item.teamId === value))
        ? { representativeId: "" }
        : {}),
    }));
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="activity-history-title">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <ListChecks className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="activity-history-title" className="text-base font-bold text-slate-950">Actiehistoriek</h2>
            <p className="text-xs text-slate-500">Uitgevoerde acties binnen je toegelaten scope</p>
          </div>
          {data && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{data.total}</span>}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.4fr_auto]">
          <FilterField label="Van datum">
            <input type="date" value={filters.from} max={filters.to} onChange={(event) => updateFilter("from", event.target.value)} className="input h-9 py-1.5 text-xs" />
          </FilterField>
          <FilterField label="Tot datum">
            <input type="date" value={filters.to} min={filters.from} onChange={(event) => updateFilter("to", event.target.value)} className="input h-9 py-1.5 text-xs" />
          </FilterField>
          <FilterField label="Team">
            <select value={filters.teamId} onChange={(event) => updateFilter("teamId", event.target.value)} className="input h-9 py-1.5 text-xs">
              <option value="">Alle teams</option>
              {(data?.teams ?? []).map((team) => <option key={team.id} value={team.id}>{team.label}</option>)}
            </select>
          </FilterField>
          <FilterField label="Vertegenwoordiger">
            <select value={filters.representativeId} onChange={(event) => updateFilter("representativeId", event.target.value)} className="input h-9 py-1.5 text-xs">
              <option value="">Alle vertegenwoordigers</option>
              {representativeOptions.map((representative) => <option key={representative.id} value={representative.id}>{representative.label}</option>)}
            </select>
          </FilterField>
          <div className="flex items-end sm:col-span-2 xl:col-span-1">
            <button type="button" onClick={() => { setFilters(defaults); setPage(1); }} className="btn-secondary h-9 w-full justify-center px-3 text-xs xl:w-auto">
              <X className="h-3.5 w-3.5" /> Filters wissen
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-sm text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-600" /> Acties laden…
        </div>
      ) : error ? (
        <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : !data?.activities.length ? (
        <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
          <Filter className="mb-2 h-6 w-6 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Geen acties gevonden voor de gekozen filters.</p>
        </div>
      ) : (
        <>
          <div className="hidden xl:block">
            <div className="grid grid-cols-[78px_58px_168px_1.15fr_0.8fr_112px_1.5fr_1fr] gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <span>Datum</span><span>Tijd</span><span>Type</span><span>Vertegenwoordiger</span><span>Team</span><span>Status</span><span>Korte omschrijving</span><span>Uitgevoerd door</span>
            </div>
            <div className="divide-y divide-slate-100">
              {data.activities.map((activity) => <ActivityTableRow key={activity.id} activity={activity} />)}
            </div>
          </div>
          <div className="divide-y divide-slate-100 xl:hidden">
            {data.activities.map((activity) => <ActivityCompactRow key={activity.id} activity={activity} />)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
            <p className="text-xs text-slate-500">Pagina {data.page} van {data.totalPages} · {data.total} acties</p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary h-8 px-2.5 text-xs" disabled={data.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-3.5 w-3.5" /> Vorige</button>
              <button type="button" className="btn-secondary h-8 px-2.5 text-xs" disabled={data.page >= data.totalPages} onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}>Volgende <ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ActivityTableRow({ activity }: { activity: ActivityHistoryItem }) {
  const date = new Date(activity.occurredAt);
  return (
    <Link href={activity.href} className="grid grid-cols-[78px_58px_168px_1.15fr_0.8fr_112px_1.5fr_1fr] items-center gap-2 px-5 py-2.5 text-xs transition hover:bg-brand-50/40 focus-visible:bg-brand-50">
      <span className="font-medium text-slate-700">{formatDate(date)}</span>
      <span className="text-slate-500">{formatTime(date)}</span>
      <ActivityType activity={activity} />
      <span className="truncate font-semibold text-slate-800">{activity.representativeName}</span>
      <span className="truncate text-slate-600">{activity.teamName}</span>
      <StatusPill status={activity.status} />
      <span className="truncate text-slate-600" title={activity.description}>{activity.description}</span>
      <span className="truncate text-slate-600">{activity.performedBy}</span>
    </Link>
  );
}

function ActivityCompactRow({ activity }: { activity: ActivityHistoryItem }) {
  const date = new Date(activity.occurredAt);
  return (
    <Link href={activity.href} className="block px-4 py-3 transition hover:bg-slate-50 sm:px-5">
      <div className="flex items-start gap-3">
        <ActivityIcon kind={activity.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold text-slate-900">{activity.typeLabel}</p>
            <StatusPill status={activity.status} />
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800">{activity.representativeName} · {activity.teamName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{activity.description}</p>
          <p className="mt-1 text-[11px] text-slate-400">{formatDate(date)} · {formatTime(date)} · {activity.performedBy}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
      </div>
    </Link>
  );
}

function ActivityType({ activity }: { activity: ActivityHistoryItem }) {
  return <span className="flex min-w-0 items-center gap-2"><ActivityIcon kind={activity.kind} /><span className="truncate font-semibold text-slate-700">{activity.typeLabel}</span></span>;
}

function ActivityIcon({ kind }: { kind: ActivityHistoryKind }) {
  const { icon: Icon, tone } = activityAppearance[kind];
  return <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="h-3.5 w-3.5" /></span>;
}

function StatusPill({ status }: { status: string }) {
  return <span className="w-fit max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600">{status.toLowerCase().replaceAll("_", " ")}</span>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

const activityAppearance: Record<ActivityHistoryKind, { icon: typeof CalendarCheck; tone: string }> = {
  coaching_planned: { icon: CalendarCheck, tone: "bg-blue-50 text-blue-700" },
  coaching_started: { icon: Play, tone: "bg-cyan-50 text-cyan-700" },
  coaching_completed: { icon: ClipboardCheck, tone: "bg-emerald-50 text-emerald-700" },
  coaching_sent_for_approval: { icon: Send, tone: "bg-violet-50 text-violet-700" },
  coaching_approved: { icon: CheckCircle2, tone: "bg-green-50 text-green-700" },
  coaching_updated: { icon: Save, tone: "bg-slate-100 text-slate-700" },
  action_point_added: { icon: ListChecks, tone: "bg-amber-50 text-amber-700" },
  action_point_completed: { icon: CheckCircle2, tone: "bg-lime-50 text-lime-700" },
  comment_added: { icon: MessageSquareText, tone: "bg-sky-50 text-sky-700" },
  score_changed: { icon: Gauge, tone: "bg-orange-50 text-orange-700" },
  pdf_exported: { icon: FileDown, tone: "bg-rose-50 text-rose-700" },
};

function defaultFilters(): Filters {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: toInputDate(from), to: toInputDate(to), teamId: "", representativeId: "" };
}

function toInputDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}
