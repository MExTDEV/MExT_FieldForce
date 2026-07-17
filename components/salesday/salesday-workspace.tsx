"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/session-provider";
import { useSalesDayDeviceRuntime } from "@/components/salesday/device-runtime-provider";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { translate, type TranslationKey } from "@/lib/i18n";

type AgendaAppointment = {
  id: string;
  sequence: number;
  status?: string;
  relation?: { displayName?: string | null } | null;
};
type PreparationAppointment = AgendaAppointment & { appointment?: AgendaAppointment };
type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  appointmentCount: number;
  completedCount: number;
  unresolvedCount: number;
};
type SalesDocument = {
  id: string;
  documentNumber: string;
  documentType: string;
  status: string;
  deliveryStatus: string;
  amountIncludingVat: string;
};
type OperationalDashboard = {
  businessDate?: string;
  generatedAt?: string;
  indicators?: {
    appointments: { total: number; open: number; completed: number; notCompleted: number; moved: number; cancelled: number };
    documents: { total: number; amountIncludingVat: string };
    cash: { balanceCount: number; nonZeroBalanceCount: number };
    inventory: { expiringOwnStockCount: number; openReplenishmentCount: number; openConsumablesRequestCount: number };
    sync: { openCommandCount: number; openIncidentCount: number; lastReplicaSyncAt: string | null };
    dayClosure: { closedRepresentativeCount: number };
    pilot: { activeFlagCount: number };
  };
  warnings?: Array<{ code: string; severity: "OK" | "ATTENTION" | "BLOCKED"; label: string; detail: string }>;
  powerBi?: { configured: boolean; label: string | null; href: string | null };
  readiness?: { status: "OK" | "ATTENTION" | "BLOCKED"; checks: Array<{ code: string; status: string; label: string; detail: string }> } | null;
};
type JsonPayload = {
  appointments?: AgendaAppointment[];
  members?: TeamMember[];
  documents?: SalesDocument[];
} & OperationalDashboard;
type JsonState = { loading: boolean; error: string | null; value: JsonPayload | null };

export function SalesDayWorkspace({ section, appointmentId }: { section?: string; appointmentId?: string }) {
  const { user } = useSession();
  const runtime = useSalesDayDeviceRuntime();
  const [state, setState] = useState<JsonState>({ loading: true, error: null, value: null });
  const isRepresentative = user.role === "REPRESENTATIVE";
  const t = (key: TranslationKey) => translate(user.language, key);
  const isDashboard = !section || section === "dashboard" || section === "overzicht";
  const title = isDashboard
    ? t("salesday.dashboard.title")
    : section === "mijn-voorbereiding"
    ? "Mijn voorbereiding"
    : section === "mijn-team"
      ? "Mijn Team"
      : section === "dagafsluiting"
        ? "Dagafsluiting"
        : section === "documenten"
          ? "Documenten"
          : "Mijn agenda";

  useEffect(() => {
    if (!user.id || (isRepresentative && runtime.phase !== "READY")) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ actorId: user.id });
    if (runtime.deviceId) query.set("deviceId", runtime.deviceId);
    const endpoint = isDashboard
      ? `/api/salesday/operational-dashboard?${query}`
      : section === "mijn-voorbereiding"
      ? `/api/salesday/preparations?${query}`
      : section === "mijn-team"
        ? `/api/salesday/team?${query}`
        : section === "documenten" && appointmentId
          ? `/api/salesday/appointments/${encodeURIComponent(appointmentId)}/documents?${query}`
          : `/api/salesday/appointments?${query}`;

    setState({ loading: true, error: null, value: null });
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as JsonPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "SalesDay-gegevens konden niet worden geladen.");
        setState({ loading: false, error: null, value: payload });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, error: error instanceof Error ? error.message : "Onbekende fout", value: null });
        }
      });
    return () => controller.abort();
  }, [appointmentId, isDashboard, isRepresentative, runtime.deviceId, runtime.phase, section, user.id]);

  const appointments = useMemo(() => state.value?.appointments ?? [], [state.value]);
  if (isRepresentative && runtime.phase !== "READY") {
    return <EmptyState title="SalesDay-toestel wordt voorbereid" description={runtime.error ?? "Een actief toestel is vereist voordat je agenda kan openen."} />;
  }
  if (state.loading) return <EmptyState title={`${title} laden`} description="De actuele SalesDay-gegevens worden opgehaald." />;
  if (state.error) return <EmptyState title={`${title} kon niet worden geladen`} description={state.error} />;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="SalesDay" title={title} description={isDashboard ? t("salesday.dashboard.description") : "ERP-volgorde en server-afgedwongen scope blijven leidend."} />
      <nav className="flex flex-wrap gap-2" aria-label="SalesDay">
        <Link className="btn-secondary" href="/salesday">{t("salesday.dashboard.navOverview")}</Link>
        <Link className="btn-secondary" href="/salesday/mijn-voorbereiding">Voorbereiding</Link>
        <Link className="btn-secondary" href="/salesday/mijn-agenda">Mijn agenda</Link>
        {!isRepresentative && <Link className="btn-secondary" href="/salesday/mijn-team">Mijn Team</Link>}
        {isRepresentative && <Link className="btn-secondary" href="/salesday/dagafsluiting">Dagafsluiting</Link>}
      </nav>
      {isDashboard
        ? <OperationalDashboardSummary dashboard={state.value ?? {}} language={user.language} />
        : section === "mijn-team"
        ? <TeamSummary members={state.value?.members ?? []} />
        : section === "mijn-voorbereiding"
          ? <PreparationSummary preparations={state.value?.appointments ?? []} />
          : section === "documenten"
            ? <DocumentSummary documents={state.value?.documents ?? []} appointmentId={appointmentId} />
            : <AgendaSummary appointments={appointments} appointmentId={appointmentId} />}
    </div>
  );
}

function OperationalDashboardSummary({ dashboard, language }: { dashboard: OperationalDashboard; language: "nl" | "fr" | "de" }) {
  const t = (key: TranslationKey) => translate(language, key);
  const indicators = dashboard.indicators;
  if (!indicators) return <EmptyState title={t("salesday.dashboard.emptyTitle")} description={t("salesday.dashboard.emptyDescription")} />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric label={t("salesday.dashboard.appointments")} value={indicators.appointments.total} detail={`${indicators.appointments.open} ${t("salesday.dashboard.open")}`} />
        <DashboardMetric label={t("salesday.dashboard.completed")} value={indicators.appointments.completed} detail={`${indicators.appointments.notCompleted} ${t("salesday.dashboard.notCompleted")}`} />
        <DashboardMetric label={t("salesday.dashboard.documents")} value={indicators.documents.total} detail={`${indicators.documents.amountIncludingVat} EUR`} />
        <DashboardMetric label={t("salesday.dashboard.sync")} value={indicators.sync.openCommandCount} detail={`${indicators.sync.openIncidentCount} ${t("salesday.dashboard.incidents")}`} tone={indicators.sync.openIncidentCount > 0 ? "danger" : indicators.sync.openCommandCount > 0 ? "warning" : "default"} />
        <DashboardMetric label={t("salesday.dashboard.cash")} value={indicators.cash.nonZeroBalanceCount} detail={`${indicators.cash.balanceCount} ${t("salesday.dashboard.balances")}`} tone={indicators.cash.nonZeroBalanceCount > 0 ? "warning" : "default"} />
        <DashboardMetric label={t("salesday.dashboard.inventory")} value={indicators.inventory.expiringOwnStockCount} detail={`${indicators.inventory.openReplenishmentCount} ${t("salesday.dashboard.replenishments")}`} tone={indicators.inventory.expiringOwnStockCount > 0 ? "warning" : "default"} />
        <DashboardMetric label={t("salesday.dashboard.dayClosure")} value={indicators.dayClosure.closedRepresentativeCount} detail={t("salesday.dashboard.closedDays")} />
        <DashboardMetric label={t("salesday.dashboard.pilotControls")} value={indicators.pilot.activeFlagCount} detail={t("salesday.dashboard.activeFlags")} />
      </div>

      <section className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">{t("salesday.dashboard.powerBiTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("salesday.dashboard.powerBiDescription")}</p>
          </div>
          {dashboard.powerBi?.configured && dashboard.powerBi.href ? (
            <a className="btn-primary min-h-11" href={dashboard.powerBi.href} target="_blank" rel="noreferrer">
              {dashboard.powerBi.label ?? "Power BI"}
            </a>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">{t("salesday.dashboard.powerBiNotConfigured")}</span>
          )}
        </div>
      </section>

      {dashboard.warnings && dashboard.warnings.length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold text-slate-950">{t("salesday.dashboard.attentionTitle")}</h2>
          <div className="mt-3 grid gap-2">
            {dashboard.warnings.map((warning) => (
              <div key={warning.code} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span className="font-semibold">{warning.label}</span> — {warning.detail}
              </div>
            ))}
          </div>
        </section>
      )}

      {dashboard.readiness && (
        <section className="card p-4">
          <h2 className="font-semibold text-slate-950">{t("salesday.dashboard.readinessTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("salesday.dashboard.readinessDescription")}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {dashboard.readiness.checks.map((check) => (
              <div key={check.code} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{check.label}</p>
                  <StatusBadge status={check.status.toLowerCase()} label={check.status} />
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{check.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DashboardMetric({ label, value, detail, tone = "default" }: { label: string; value: number | string; detail: string; tone?: "default" | "warning" | "danger" }) {
  const toneClass = tone === "danger"
    ? "border-rose-200 bg-rose-50"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-white";
  return (
    <article className={`card border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </article>
  );
}

function AgendaSummary({ appointments, appointmentId }: { appointments: AgendaAppointment[]; appointmentId?: string }) {
  if (!appointments.length) return <EmptyState title="Geen afspraken" description="Er zijn geen afspraken voor deze werkdag in de ERP-replica." />;
  return (
    <div className="grid gap-3">
      {appointments.map((appointment) => (
        <article key={appointment.id} id={appointment.id === appointmentId ? "appointment" : undefined} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">#{appointment.sequence}</p>
              <h2 className="font-semibold text-slate-900">{appointment.relation?.displayName ?? "Klant"}</h2>
            </div>
            <StatusBadge status={appointment.status?.toLowerCase() ?? "open"} label={appointment.status ?? "Gepland"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="btn-secondary min-h-10" href={`/salesday/documenten/${appointment.id}`}>Documenten</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function PreparationSummary({ preparations }: { preparations: PreparationAppointment[] }) {
  return preparations.length ? (
    <div className="grid gap-3">
      {preparations.map((item) => (
        <article key={item.appointment?.id ?? item.id} className="card p-4">
          <h2 className="font-semibold">{item.appointment?.relation?.displayName ?? "Klant"}</h2>
          <p className="mt-1 text-sm text-slate-600">Voorbereiding voor de volgende effectieve werkdag.</p>
        </article>
      ))}
    </div>
  ) : <EmptyState title="Geen voorbereiding" description="Er zijn geen afspraken in de volgende effectieve werkdag." />;
}

function TeamSummary({ members }: { members: TeamMember[] }) {
  return members.length ? (
    <div className="grid gap-3 md:grid-cols-2">
      {members.map((member) => (
        <article key={member.id} className="card p-4">
          <h2 className="font-semibold">{member.firstName} {member.lastName}</h2>
          <p className="mt-1 text-sm text-slate-600">{member.appointmentCount} afspraken - {member.completedCount} uitgevoerd - {member.unresolvedCount} open</p>
          <p className="mt-2 text-xs text-slate-500">Alleen-lezen teamstatus.</p>
        </article>
      ))}
    </div>
  ) : <EmptyState title="Geen teamleden" description="Er zijn geen vertegenwoordigers binnen je scope." />;
}

function DocumentSummary({ documents, appointmentId }: { documents: SalesDocument[]; appointmentId?: string }) {
  if (!appointmentId) return <EmptyState title="Geen afspraak geselecteerd" description="Open documenten vanuit een afspraak in Mijn agenda." />;
  return documents.length ? (
    <div className="grid gap-3">
      {documents.map((document) => (
        <article key={document.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{document.documentType}</p>
              <h2 className="font-semibold text-slate-900">{document.documentNumber}</h2>
              <p className="mt-1 text-sm text-slate-600">Totaal incl. BTW: {document.amountIncludingVat}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={document.status.toLowerCase()} label={document.status} />
              <StatusBadge status={document.deliveryStatus.toLowerCase()} label={document.deliveryStatus} />
              <Link className="btn-secondary min-h-10" href={`/api/salesday/documents/${document.id}/print`}>Print/share</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  ) : <EmptyState title="Geen documenten" description="Voor deze afspraak zijn nog geen Order, Order-Reeds-Geleverd of Factuur gemaakt." />;
}
