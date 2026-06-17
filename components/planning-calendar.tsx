"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
} from "lucide-react";

import { useModules } from "@/components/module-provider";
import { PageHeader, StatusBadge } from "@/components/ui";
import { useSession } from "@/components/session-provider";
import { useWorkflow } from "@/components/workflow-provider";
import { representatives } from "@/lib/mock-data";
import { visibleStaticInterventions } from "@/lib/data-access";

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
  href: string;
  color: string;
};

const REFERENCE_DATE = new Date(2026, 5, 15);
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
  const hour = Number((value ?? "").split(":")[0]);
  return Number.isFinite(hour) ? Math.max(8, Math.min(18, hour)) : undefined;
}

function durationFromTimes(start?: string, end?: string) {
  const startHour = Number((start ?? "").split(":")[0]);
  const endHour = Number((end ?? "").split(":")[0]);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) return 1;
  return Math.max(1, Math.min(8, endHour - startHour));
}

function representativeName(id?: string) {
  const representative = representatives.find((item) => item.id === id);
  return representative
    ? `${representative.firstName} ${representative.lastName}`
    : "Team";
}

function eventColor(type: string) {
  return EVENT_COLORS[type] ?? "border-[#003B83] bg-blue-50 text-blue-950";
}

function staticEventType(type: string) {
  const labels: Record<string, string> = {
    begeleiding: "Begeleiding",
    contactmoment: "Contactmoment",
    retraining: "Retraining",
    sales_training: "Sales training",
    hulpaanvraag: "Hulpaanvraag",
  };
  return labels[type] ?? type;
}

function staticEventHref(type: string, id: string) {
  const routes: Record<string, string> = {
    begeleiding: "begeleidingen",
    contactmoment: "contactmomenten",
    retraining: "retrainingen",
    sales_training: "sales-trainingen",
    hulpaanvraag: "hulpaanvragen",
  };
  return `/${routes[type] ?? "planning"}/${id}`;
}

export function PlanningCalendar() {
  const { user } = useSession();
  const workflow = useWorkflow();
  const { isModuleEnabled } = useModules();
  const [view, setView] = useState<CalendarView>("week");
  const [selectedDate, setSelectedDate] = useState(new Date(REFERENCE_DATE));

  const events = useMemo<CalendarEvent[]>(() => {
    const staticEvents = visibleStaticInterventions(user).filter((item) => {
      if (item.type === "begeleiding") return isModuleEnabled("BEGELEIDINGEN");
      if (item.type === "contactmoment") return isModuleEnabled("CONTACTMOMENTEN");
      if (item.type === "retraining") return isModuleEnabled("RETRAININGEN");
      if (item.type === "sales_training") return isModuleEnabled("SALESTRAININGEN");
      if (item.type === "hulpaanvraag") return isModuleEnabled("HULPAANVRAGEN");
      return true;
    }).map((item) => {
      const eventDate = parseDate(item.date);
      const type = staticEventType(item.type);
      return {
        id: `static-${item.id}`,
        title: type,
        subtitle: item.person,
        date: dateKey(eventDate),
        hour: deterministicHour(item.id),
        duration: 1,
        type,
        status: item.status,
        href: staticEventHref(item.type, item.id),
        color: eventColor(type),
      };
    });

    const coachingEvents = workflow.visibleInterventions(user)
      .filter((item) => user.role !== "REPRESENTATIVE" || ["gefinaliseerd", "wacht_op_akkoord"].includes(item.status))
      .map((item) => ({
        id: `coaching-${item.id}`,
        title: "Begeleiding",
        subtitle: `${representativeName(item.representativeId)} · ${item.ownerId ? "Verkoopleider" : ""}`,
        date: dateKey(parseDate(item.plannedDate ?? item.finalizedAt ?? item.createdAt)),
        hour: hourFromTime(item.startTime) ?? deterministicHour(item.id),
        duration: durationFromTimes(item.startTime, item.endTime),
        type: "Begeleiding",
        status: item.status,
        href: `/begeleidingen/${item.id}`,
        color: eventColor("Begeleiding"),
      }));

    const contactEvents = isModuleEnabled("CONTACTMOMENTEN") ? workflow.visibleContactMoments(user).map((item) => ({
      id: `contact-${item.id}`,
      title: "Contactmoment",
      subtitle: representativeName(item.representativeId),
      date: dateKey(parseDate(item.createdAt)),
      hour: deterministicHour(item.id),
      duration: 1,
      type: "Contactmoment",
      status: item.status,
      href: `/contactmomenten/${item.id}`,
      color: eventColor("Contactmoment"),
    })) : [];

    const retrainingEvents = isModuleEnabled("RETRAININGEN") ? workflow.visibleRetrainings(user).map((item) => ({
      id: `retraining-${item.id}`,
      title: item.theme || "Retraining",
      subtitle: representativeName(item.representativeId),
      date: dateKey(parseDate(item.date)),
      hour: deterministicHour(item.id),
      duration: 1,
      type: "Retraining",
      status: item.status,
      href: `/retrainingen/${item.id}`,
      color: eventColor("Retraining"),
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
    })) : [];

    const helpRequestEvents = isModuleEnabled("HULPAANVRAGEN") ? workflow.visibleHelpRequests(user).map((item) => ({
      id: `help-${item.id}`,
      title: item.subject || "Hulpaanvraag",
      subtitle: representativeName(item.representativeId),
      date: dateKey(parseDate(item.createdAt)),
      hour: deterministicHour(item.id),
      duration: 1,
      type: "Hulpaanvraag",
      status: item.status,
      href: `/hulpaanvragen/${item.id}`,
      color: eventColor("Hulpaanvraag"),
    })) : [];

    return [
      ...staticEvents,
      ...coachingEvents,
      ...contactEvents,
      ...retrainingEvents,
      ...salesTrainingEvents,
      ...helpRequestEvents,
    ].filter(
      (event, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.href === event.href &&
            candidate.date === event.date &&
            candidate.type === event.type,
        ) === index,
    );
  }, [
    user,
    workflow,
    isModuleEnabled,
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
                      {String(event.hour).padStart(2, "0")}:00 {event.title}
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
  return (
    <Link
      href={event.href}
      style={style}
      className={`absolute z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 shadow-sm transition hover:z-20 hover:shadow-md ${event.color}`}
      title={`${event.title} - ${event.subtitle}`}
    >
      <p className="truncate text-[11px] font-bold">
        {String(event.hour).padStart(2, "0")}:00 {event.title}
      </p>
      <p className="truncate text-[10px] opacity-80">{event.subtitle}</p>
      {spacious && (
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] opacity-75">
            <Clock3 className="h-2.5 w-2.5" />
            {event.duration} uur
          </span>
          <StatusBadge status={event.status} />
        </div>
      )}
    </Link>
  );
}
