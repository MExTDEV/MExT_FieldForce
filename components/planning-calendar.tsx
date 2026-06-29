"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { useModules } from "@/components/module-provider";
import { PageHeader, StatusBadge } from "@/components/ui";
import { useRepresentatives } from "@/components/representatives-provider";
import { useSession } from "@/components/session-provider";
import { useWorkflow } from "@/components/workflow-provider";
import type { Representative } from "@/lib/types";

type CalendarView = "day" | "week" | "month";

type CalendarEvent = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  hour: number;
  duration: number;
  type: string;
  status: string;
  href?: string;
  color: string;
  source: "fieldforce" | "outlook";
  syncStatus?: "NOT_SYNCED" | "SYNCED" | "ERROR";
  syncError?: string;
};

type OutlookEventResponse = {
  id: string;
  iCalUId?: string;
  title: string;
  preview: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string;
};

const REFERENCE_DATE = new Date();
const DAY_NAMES = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTH_NAMES = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];
const HOURS = Array.from({ length: 11 }, (_, index) => index + 8);

const EVENT_COLORS: Record<string, string> = {
  Begeleiding: "border-blue-500 bg-blue-50 text-blue-950",
  Contactmoment: "border-violet-500 bg-violet-50 text-violet-950",
  Retraining: "border-amber-500 bg-amber-50 text-amber-950",
  "Sales training": "border-cyan-500 bg-cyan-50 text-cyan-950",
  Hulpaanvraag: "border-rose-500 bg-rose-50 text-rose-950",
  Outlook: "border-slate-400 bg-slate-100 text-slate-800",
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value?: string) {
  if (!value) return new Date(REFERENCE_DATE);
  if (value.toLowerCase() === "vandaag") return new Date(REFERENCE_DATE);

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const dutch = value
    .toLowerCase()
    .match(/(\d{1,2})\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)(?:\s+(\d{4}))?/);
  if (dutch) {
    const monthMap: Record<string, number> = {
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
    return new Date(
      dutch[3] ? Number(dutch[3]) : REFERENCE_DATE.getFullYear(),
      monthMap[dutch[2]],
      Number(dutch[1]),
    );
  }

  return new Date(REFERENCE_DATE);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatLongDate(date: Date) {
  return `${DAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDate(date: Date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
}

function deterministicHour(id: string) {
  return 8 + [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % 9;
}

function hourFromTime(value?: string) {
  const hour = decimalHour(value);
  return Number.isFinite(hour) ? Math.max(8, Math.min(18, hour)) : undefined;
}

function durationFromTimes(start?: string, end?: string) {
  const startHour = decimalHour(start);
  const endHour = decimalHour(end);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) return 1;
  return Math.max(0.5, Math.min(11, endHour - startHour));
}

function decimalHour(value?: string) {
  const [hours, minutes] = (value ?? "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours + minutes / 60;
}

function formatEventTime(hour: number) {
  const hours = Math.floor(hour);
  const minutes = Math.round((hour - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function representativeName(representatives: Representative[], id?: string) {
  const representative = representatives.find((item) => item.id === id);
  return representative
    ? `${representative.firstName} ${representative.lastName}`
    : "Team";
}

function eventColor(type: string) {
  return EVENT_COLORS[type] ?? "border-[#003B83] bg-blue-50 text-blue-950";
}

export function PlanningCalendar() {
  const { user } = useSession();
  const workflow = useWorkflow();
  const { isModuleEnabled } = useModules();
  const { representatives } = useRepresentatives();
  const [view, setView] = useState<CalendarView>("week");
  const [selectedDate, setSelectedDate] = useState(new Date(REFERENCE_DATE));
  const [outlookEvents, setOutlookEvents] = useState<OutlookEventResponse[]>([]);
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [outlookError, setOutlookError] = useState<string>();

  const outlookRange = useMemo(() => calendarRange(selectedDate, view), [selectedDate, view]);

  useEffect(() => {
    const controller = new AbortController();
    setOutlookLoading(true);
    setOutlookError(undefined);
    const params = new URLSearchParams({
      start: outlookRange.start.toISOString(),
      end: outlookRange.end.toISOString(),
    });
    void fetch(`/api/outlook/events?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { events?: OutlookEventResponse[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Outlook-agenda kon niet worden geladen.");
        setOutlookEvents(payload.events ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOutlookEvents([]);
        setOutlookError(error instanceof Error ? error.message : "Outlook-agenda kon niet worden geladen.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOutlookLoading(false);
      });
    return () => controller.abort();
  }, [outlookRange.end, outlookRange.start]);

  const events = useMemo<CalendarEvent[]>(() => {
    const coachingEvents = workflow.visibleInterventions(user)
      .filter((item) => user.role !== "REPRESENTATIVE" || ["gefinaliseerd", "wacht_op_akkoord"].includes(item.status))
      .map((item) => ({
        id: `coaching-${item.id}`,
        title: "Begeleiding",
        subtitle: `${representativeName(representatives, item.representativeId)} · ${item.ownerId ? "Verkoopleider" : ""}`,
        date: dateKey(parseDate(item.plannedDate ?? item.finalizedAt ?? item.createdAt)),
        hour: hourFromTime(item.startTime) ?? deterministicHour(item.id),
        duration: durationFromTimes(item.startTime, item.endTime),
        type: "Begeleiding",
        status: item.status,
        href: `/begeleidingen/${item.id}`,
        color: eventColor("Begeleiding"),
        source: "fieldforce" as const,
        syncStatus: item.outlookSyncStatus,
        syncError: item.syncError,
      }));

    const contactEvents = isModuleEnabled("CONTACTMOMENTEN") ? workflow.visibleContactMoments(user).map((item) => ({
      id: `contact-${item.id}`,
      title: "Contactmoment",
      subtitle: representativeName(representatives, item.representativeId),
      date: dateKey(parseDate(item.createdAt)),
      hour: deterministicHour(item.id),
      duration: 1,
      type: "Contactmoment",
      status: item.status,
      href: `/contactmomenten/${item.id}`,
      color: eventColor("Contactmoment"),
      source: "fieldforce" as const,
    })) : [];

    const retrainingEvents = isModuleEnabled("RETRAININGEN") ? workflow.visibleRetrainings(user).map((item) => ({
      id: `retraining-${item.id}`,
      title: item.theme || "Retraining",
      subtitle: representativeName(representatives, item.representativeId),
      date: dateKey(parseDate(item.date)),
      hour: deterministicHour(item.id),
      duration: 1,
      type: "Retraining",
      status: item.status,
      href: `/retrainingen/${item.id}`,
      color: eventColor("Retraining"),
      source: "fieldforce" as const,
    })) : [];

    const salesTrainingEvents = isModuleEnabled("SALESTRAININGEN") ? workflow.visibleSalesTrainings(user).map((item) => ({
      id: `sales-training-${item.id}`,
      title: item.theme || "Sales training",
      subtitle: `${item.participantIds.length} deelnemers`,
      date: dateKey(parseDate(item.date)),
      hour: deterministicHour(item.id),
      duration: 1,
      type: "Sales training",
      status: item.status,
      href: `/sales-trainingen/${item.id}`,
      color: eventColor("Sales training"),
      source: "fieldforce" as const,
    })) : [];

    const helpRequestEvents = isModuleEnabled("HULPAANVRAGEN") ? workflow.visibleHelpRequests(user).map((item) => ({
      id: `help-${item.id}`,
      title: item.subject || "Hulpaanvraag",
      subtitle: representativeName(representatives, item.representativeId),
      date: dateKey(parseDate(item.createdAt)),
      hour: deterministicHour(item.id),
      duration: 1,
      type: "Hulpaanvraag",
      status: item.status,
      href: `/hulpaanvragen/${item.id}`,
      color: eventColor("Hulpaanvraag"),
      source: "fieldforce" as const,
    })) : [];

    const linkedOutlookIds = new Set(
      workflow.state.interventions.map((item) => item.outlookEventId).filter(Boolean)
    );
    const externalEvents = outlookEvents
      .filter((item) => !linkedOutlookIds.has(item.id))
      .map((item) => {
        const start = new Date(item.start);
        const end = new Date(item.end);
        const startHour = item.isAllDay ? 8 : start.getHours() + start.getMinutes() / 60;
        const duration = item.isAllDay
          ? 1
          : Math.max(0.5, Math.min(11, (end.getTime() - start.getTime()) / 3_600_000));
        return {
          id: `outlook-${item.id}`,
          title: item.title,
          subtitle: item.location ? `Outlook · ${item.location}` : "Outlook · Alleen lezen",
          date: dateKey(start),
          hour: Math.max(8, Math.min(18, startHour)),
          duration,
          type: "Outlook",
          status: "read_only",
          color: eventColor("Outlook"),
          source: "outlook" as const,
        };
      });

    return [
      ...coachingEvents,
      ...contactEvents,
      ...retrainingEvents,
      ...salesTrainingEvents,
      ...helpRequestEvents,
      ...externalEvents,
    ].filter(
      (event, index, list) =>
        list.findIndex((candidate) => candidate.id === event.id) === index,
    );
  }, [
    user,
    workflow,
    isModuleEnabled,
    representatives,
    outlookEvents,
  ]);

  const periodLabel = useMemo(() => {
    if (view === "day") return formatLongDate(selectedDate);
    if (view === "week") {
      const start = startOfWeek(selectedDate);
      const end = addDays(start, 6);
      return `${formatShortDate(start)} - ${formatShortDate(end)} ${end.getFullYear()}`;
    }
    return `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }, [selectedDate, view]);

  function movePeriod(direction: number) {
    const next = new Date(selectedDate);
    if (view === "day") next.setDate(next.getDate() + direction);
    if (view === "week") next.setDate(next.getDate() + direction * 7);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    setSelectedDate(next);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Planning"
        description="Plan en volg coachingmomenten in een overzichtelijke agenda."
        actions={
          <Link
            href="/begeleidingen/nieuw"
            className="inline-flex items-center gap-2 rounded-xl bg-[#003B83] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002f69]"
          >
            <Plus className="h-[18px] w-[18px]" />
            Nieuw moment
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {(outlookLoading || outlookError) && (
          <div className={`flex items-center gap-2 border-b px-4 py-2.5 text-xs font-semibold ${
            outlookError
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-blue-100 bg-blue-50 text-blue-800"
          }`}>
            {outlookLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {outlookLoading ? "Outlook-agenda laden…" : `${outlookError} Fieldforce-planning blijft beschikbaar.`}
          </div>
        )}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date(REFERENCE_DATE))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vandaag
            </button>
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              <button
                type="button"
                aria-label="Vorige periode"
                onClick={() => movePeriod(-1)}
                className="p-2 text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                aria-label="Volgende periode"
                onClick={() => movePeriod(1)}
                className="border-l border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
              >
                <ChevronRight className="h-[18px] w-[18px]" />
              </button>
            </div>
            <h2 className="min-w-[210px] text-base font-bold capitalize text-slate-900">
              {periodLabel}
            </h2>
          </div>

          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
            {(["day", "week", "month"] as CalendarView[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  view === option
                    ? "bg-white text-[#003B83] shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {option === "day" ? "Dag" : option === "week" ? "Week" : "Maand"}
              </button>
            ))}
          </div>
        </div>

        {view === "day" && <DayView date={selectedDate} events={events} />}
        {view === "week" && <WeekView date={selectedDate} events={events} />}
        {view === "month" && (
          <MonthView
            date={selectedDate}
            events={events}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setView("day");
            }}
          />
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <span key={type} className="inline-flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm border-l-4 ${color}`} />
              {type}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function DayView({ date, events }: { date: Date; events: CalendarEvent[] }) {
  const dayEvents = events.filter((event) => event.date === dateKey(date));

  return (
    <div className="min-h-[620px] overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[72px_1fr] border-b border-slate-200 bg-slate-50">
          <div className="border-r border-slate-200" />
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase text-[#003B83]">
              {DAY_NAMES[(date.getDay() + 6) % 7]}
            </p>
            <p className="text-xl font-bold text-slate-900">{date.getDate()}</p>
          </div>
        </div>
        <div className="relative grid grid-cols-[72px_1fr]">
          <div className="border-r border-slate-200">
            {HOURS.map((hour) => (
              <div key={hour} className="h-14 border-b border-slate-100 pr-3 pt-1 text-right text-xs text-slate-400">
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="h-14 border-b border-slate-100" />
            ))}
            {dayEvents.map((event, index) => (
              <CalendarEventCard
                key={event.id}
                event={event}
                style={{
                  top: `${(event.hour - 8) * 56 + 3}px`,
                  left: `${12 + (index % 3) * 10}px`,
                  right: `${12 + ((index + 1) % 3) * 8}px`,
                  height: `${event.duration * 56 - 6}px`,
                }}
                spacious
              />
            ))}
            {dayEvents.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                Geen momenten gepland.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({ date, events }: { date: Date; events: CalendarEvent[] }) {
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[58px_repeat(7,minmax(126px,1fr))] border-b border-slate-200 bg-slate-50">
          <div className="border-r border-slate-200" />
          {days.map((day) => {
            const isToday = dateKey(day) === dateKey(REFERENCE_DATE);
            return (
              <div key={dateKey(day)} className="border-r border-slate-200 px-2 py-2 text-center last:border-r-0">
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  {DAY_NAMES[(day.getDay() + 6) % 7]}
                </p>
                <span
                  className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? "bg-[#003B83] text-white" : "text-slate-800"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[58px_repeat(7,minmax(126px,1fr))]">
          <div className="border-r border-slate-200">
            {HOURS.map((hour) => (
              <div key={hour} className="h-14 border-b border-slate-100 pr-2 pt-1 text-right text-[11px] text-slate-400">
                {String(hour).padStart(2, "0")}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayEvents = events.filter((event) => event.date === dateKey(day));
            return (
              <div key={dateKey(day)} className="relative border-r border-slate-200 last:border-r-0">
                {HOURS.map((hour) => (
                  <div key={hour} className="h-14 border-b border-slate-100" />
                ))}
                {dayEvents.map((event, index) => (
                  <CalendarEventCard
                    key={event.id}
                    event={event}
                    style={{
                      top: `${(event.hour - 8) * 56 + 2}px`,
                      left: `${3 + (index % 2) * 4}px`,
                      right: `${3 + ((index + 1) % 2) * 4}px`,
                      height: `${event.duration * 56 - 4}px`,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthView({
  date,
  events,
  onSelectDate,
}: {
  date: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
}) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const calendarStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAY_NAMES.map((day) => (
            <div key={day} className="border-r border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((event) => event.date === dateKey(day));
            const inMonth = day.getMonth() === date.getMonth();
            const isToday = dateKey(day) === dateKey(REFERENCE_DATE);
            return (
              <button
                key={dateKey(day)}
                type="button"
                onClick={() => onSelectDate(day)}
                className={`min-h-28 border-b border-r border-slate-200 p-2 text-left hover:bg-blue-50/40 ${
                  inMonth ? "bg-white" : "bg-slate-50/70"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isToday
                      ? "bg-[#003B83] text-white"
                      : inMonth
                        ? "text-slate-700"
                        : "text-slate-300"
                  }`}
                >
                  {day.getDate()}
                </span>
                <span className="mt-1 block space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={`block truncate rounded border-l-4 px-1.5 py-1 text-[11px] font-semibold ${event.color}`}
                    >
                      {formatEventTime(event.hour)} {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="block px-1 text-[11px] font-semibold text-[#003B83]">
                      +{dayEvents.length - 3} meer
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarEventCard({
  event,
  style,
  spacious = false,
}: {
  event: CalendarEvent;
  style: React.CSSProperties;
  spacious?: boolean;
}) {
  const content = (
    <>
      <p className="truncate text-[11px] font-bold">
        {formatEventTime(event.hour)} {event.title}
      </p>
      <p className="truncate text-[10px] opacity-80">{event.subtitle}</p>
      {event.source === "outlook" && (
        <span className="mt-1 inline-flex rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700">
          Outlook · read-only
        </span>
      )}
      {event.syncStatus && <SyncIndicator status={event.syncStatus} error={event.syncError} />}
      {spacious && (
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] opacity-75">
            <Clock3 className="h-2.5 w-2.5" />
            {event.duration} uur
          </span>
          {event.source === "fieldforce" && <StatusBadge status={event.status} />}
        </div>
      )}
    </>
  );
  const className = `absolute z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 shadow-sm ${event.color}`;
  if (event.source === "outlook" || !event.href) {
    return <div style={style} className={className} title={`${event.title} - externe Outlook-afspraak, alleen lezen`}>{content}</div>;
  }
  return (
    <Link
      href={event.href}
      style={style}
      className={`${className} transition hover:z-20 hover:shadow-md`}
      title={`${event.title} - ${event.subtitle}`}
    >
      {content}
    </Link>
  );
}

function SyncIndicator({
  status,
  error,
}: {
  status: "NOT_SYNCED" | "SYNCED" | "ERROR";
  error?: string;
}) {
  const label = status === "SYNCED"
    ? "Gesynchroniseerd"
    : status === "ERROR"
      ? "Sync-fout"
      : "Nog niet gesynchroniseerd";
  const tone = status === "SYNCED"
    ? "bg-emerald-100 text-emerald-800"
    : status === "ERROR"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
  return (
    <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${tone}`} title={error ?? label}>
      {label}
    </span>
  );
}

function calendarRange(date: Date, view: CalendarView) {
  if (view === "day") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return { start, end: addDays(start, 1) };
  }
  if (view === "week") {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 7) };
  }
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  return { start, end: addDays(start, 42) };
}
