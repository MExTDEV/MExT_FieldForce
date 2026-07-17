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
type CashSheet = {
  businessDate?: string;
  firstEffectiveBusinessDate?: string;
  block?: { confirmedBalance?: string | null; currency?: string | null; missingCashBalance?: boolean } | null;
  methods?: Array<{ id: string; code: string; labelNl: string; affectsCashBalance: boolean }>;
  balances?: Array<{ id: string; currency: string; confirmedBalance: string; lastDepositConfirmedAt?: string | null }>;
  entries?: Array<{ id: string; type: string; amount: string; currency: string; occurredAt: string; comment?: string | null }>;
};
type InventoryLocation = {
  id: string;
  name: string;
  type: string;
  balances?: Array<{
    id: string;
    articleExternalId: string;
    quantity: string;
    unit: string;
    lotNumber?: string | null;
    expiryDate?: string | null;
    expiryWarning?: boolean;
  }>;
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
  locations?: InventoryLocation[];
} & OperationalDashboard;
type CashJsonPayload = JsonPayload & CashSheet;
type JsonState = { loading: boolean; error: string | null; value: JsonPayload | null };
type SalesDayWorkspaceLanguage = "nl" | "fr" | "de";

export function SalesDayWorkspace({ section, appointmentId }: { section?: string; appointmentId?: string }) {
  const { user } = useSession();
  const runtime = useSalesDayDeviceRuntime();
  const [state, setState] = useState<JsonState>({ loading: true, error: null, value: null });
  const isRepresentative = user.role === "REPRESENTATIVE";
  const t = (key: TranslationKey) => translate(user.language, key);
  const genericLoadError = t("salesday.workspace.genericLoadError");
  const unknownError = t("salesday.workspace.unknownError");
  const isDashboard = !section || section === "dashboard" || section === "overzicht";
  const title = isDashboard
    ? t("salesday.dashboard.title")
    : section === "mijn-voorbereiding"
    ? t("salesday.nav.preparation")
    : section === "mijn-team"
      ? t("salesday.nav.team")
      : section === "mijn-voorraad"
        ? t("salesday.nav.stock")
        : section === "cash"
          ? t("salesday.nav.cash")
      : section === "dagafsluiting"
        ? t("salesday.nav.dayClosure")
        : section === "documenten"
          ? t("salesday.appointments.documents")
          : t("salesday.nav.agenda");

  useEffect(() => {
    if (!user.id || (isRepresentative && runtime.phase !== "READY")) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ actorId: user.id });
    if (runtime.deviceId) query.set("deviceId", runtime.deviceId);
    const endpoint = isDashboard
      ? `/api/salesday/operational-dashboard?${query}`
      : section === "mijn-voorbereiding"
      ? `/api/salesday/preparations?${query}`
      : section === "cash"
        ? `/api/salesday/cash?${query}`
      : section === "mijn-voorraad"
        ? `/api/inventory/balances?${query}`
      : section === "mijn-team"
        ? `/api/salesday/team?${query}`
        : section === "documenten" && appointmentId
          ? `/api/salesday/appointments/${encodeURIComponent(appointmentId)}/documents?${query}`
          : `/api/salesday/appointments?${query}`;

    setState({ loading: true, error: null, value: null });
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as JsonPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? genericLoadError);
        setState({ loading: false, error: null, value: payload });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, error: error instanceof Error ? error.message : unknownError, value: null });
        }
      });
    return () => controller.abort();
  }, [appointmentId, genericLoadError, isDashboard, isRepresentative, runtime.deviceId, runtime.phase, section, unknownError, user.id]);

  const appointments = useMemo(() => state.value?.appointments ?? [], [state.value]);
  if (isRepresentative && runtime.phase !== "READY") {
    return <EmptyState title={t("salesday.workspace.devicePreparingTitle")} description={runtime.error ?? t("salesday.workspace.devicePreparingDescription")} />;
  }
  if (state.loading) return <EmptyState title={`${title} — ${t("salesday.workspace.loadingTitle")}`} description={t("salesday.workspace.loadingDescription")} />;
  if (state.error) return <EmptyState title={`${title} — ${t("salesday.workspace.loadErrorTitle")}`} description={state.error} />;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="SalesDay" title={title} description={isDashboard ? t("salesday.dashboard.description") : t("salesday.workspace.scopeDescription")} />
      <nav className="flex flex-wrap gap-2" aria-label="SalesDay">
        <Link className="btn-secondary" href="/salesday">{t("salesday.dashboard.navOverview")}</Link>
        <Link className="btn-secondary" href="/salesday/mijn-voorbereiding">{t("salesday.nav.preparation")}</Link>
        <Link className="btn-secondary" href="/salesday/mijn-agenda">{t("salesday.nav.agenda")}</Link>
        <Link className="btn-secondary" href="/salesday/mijn-voorraad">{t("salesday.nav.stock")}</Link>
        <Link className="btn-secondary" href="/salesday/cash">{t("salesday.nav.cash")}</Link>
        {!isRepresentative && <Link className="btn-secondary" href="/salesday/mijn-team">{t("salesday.nav.team")}</Link>}
        {isRepresentative && <Link className="btn-secondary" href="/salesday/dagafsluiting">{t("salesday.nav.dayClosure")}</Link>}
      </nav>
      {isDashboard
        ? <OperationalDashboardSummary dashboard={state.value ?? {}} language={user.language} />
        : section === "mijn-team"
        ? <TeamSummary members={state.value?.members ?? []} language={user.language} />
        : section === "cash"
          ? <CashSummary cashSheet={(state.value ?? {}) as CashJsonPayload} language={user.language} />
        : section === "mijn-voorraad"
          ? <StockSummary locations={state.value?.locations ?? []} language={user.language} />
        : section === "mijn-voorbereiding"
          ? <PreparationSummary preparations={state.value?.appointments ?? []} language={user.language} />
          : section === "documenten"
            ? <DocumentSummary documents={state.value?.documents ?? []} appointmentId={appointmentId} language={user.language} />
            : <AgendaSummary appointments={appointments} appointmentId={appointmentId} language={user.language} />}
    </div>
  );
}

function OperationalDashboardSummary({ dashboard, language }: { dashboard: OperationalDashboard; language: SalesDayWorkspaceLanguage }) {
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

function AgendaSummary({ appointments, appointmentId, language }: { appointments: AgendaAppointment[]; appointmentId?: string; language: SalesDayWorkspaceLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  if (!appointments.length) return <EmptyState title={t("salesday.appointments.emptyTitle")} description={t("salesday.appointments.emptyDescription")} />;
  return (
    <div className="grid gap-3">
      {appointments.map((appointment) => (
        <article key={appointment.id} id={appointment.id === appointmentId ? "appointment" : undefined} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">#{appointment.sequence}</p>
              <h2 className="font-semibold text-slate-900">{appointment.relation?.displayName ?? t("salesday.appointments.customerFallback")}</h2>
            </div>
            <StatusBadge status={appointment.status?.toLowerCase() ?? "open"} label={appointment.status ?? t("salesday.appointments.planned")} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="btn-secondary min-h-10" href={`/salesday/documenten/${appointment.id}`}>{t("salesday.appointments.documents")}</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function PreparationSummary({ preparations, language }: { preparations: PreparationAppointment[]; language: SalesDayWorkspaceLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  return preparations.length ? (
    <div className="grid gap-3">
      {preparations.map((item) => (
        <article key={item.appointment?.id ?? item.id} className="card p-4">
          <h2 className="font-semibold">{item.appointment?.relation?.displayName ?? t("salesday.appointments.customerFallback")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("salesday.preparation.description")}</p>
        </article>
      ))}
    </div>
  ) : <EmptyState title={t("salesday.preparation.emptyTitle")} description={t("salesday.preparation.emptyDescription")} />;
}

function TeamSummary({ members, language }: { members: TeamMember[]; language: SalesDayWorkspaceLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  return members.length ? (
    <div className="grid gap-3 md:grid-cols-2">
      {members.map((member) => (
        <article key={member.id} className="card p-4">
          <h2 className="font-semibold">{member.firstName} {member.lastName}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {member.appointmentCount} {t("salesday.dashboard.appointments").toLowerCase()} - {member.completedCount} {t("salesday.dashboard.completed").toLowerCase()} - {member.unresolvedCount} {t("salesday.dashboard.open")}
          </p>
          <p className="mt-2 text-xs text-slate-500">{t("salesday.team.readOnly")}</p>
        </article>
      ))}
    </div>
  ) : <EmptyState title={t("salesday.team.emptyTitle")} description={t("salesday.team.emptyDescription")} />;
}

function CashSummary({ cashSheet, language }: { cashSheet: CashJsonPayload; language: SalesDayWorkspaceLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  const balances = cashSheet.balances ?? [];
  const entries = cashSheet.entries ?? [];
  const methods = cashSheet.methods ?? [];
  return (
    <div className="space-y-4">
      {cashSheet.block && (
        <section className="card border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">{t("salesday.cash.blockedTitle")}</h2>
          <p className="mt-1 text-sm text-amber-900">
            {t("salesday.cash.blockedDescription")}
          </p>
          <p className="mt-2 text-sm font-semibold text-amber-950">
            {t("salesday.cash.balance")}: {cashSheet.block.missingCashBalance ? t("salesday.cash.notAvailable") : `${cashSheet.block.confirmedBalance ?? "-"} ${cashSheet.block.currency ?? ""}`}
          </p>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <DashboardMetric label={t("salesday.cash.workday")} value={cashSheet.businessDate ?? "-"} detail={`${t("salesday.cash.firstWorkday")}: ${cashSheet.firstEffectiveBusinessDate ?? "-"}`} />
        <DashboardMetric label={t("salesday.cash.balances")} value={balances.length} detail={balances.map((balance) => `${balance.confirmedBalance} ${balance.currency}`).join(" | ") || t("salesday.cash.noBalance")} tone={cashSheet.block ? "warning" : "default"} />
        <DashboardMetric label={t("salesday.cash.paymentMethods")} value={methods.length} detail={`${methods.filter((method) => method.affectsCashBalance).length} ${t("salesday.cash.cashImpact")}`} />
      </div>

      <section className="card p-4">
        <h2 className="font-semibold text-slate-950">{t("salesday.cash.latestEntries")}</h2>
        {entries.length ? (
          <div className="mt-3 divide-y divide-slate-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{entry.type.replaceAll("_", " ")}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(entry.occurredAt, language)} {entry.comment ? `- ${entry.comment}` : ""}</p>
                </div>
                <span className="font-bold text-slate-950">{entry.amount} {entry.currency}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t("salesday.cash.noEntries")}</p>
        )}
      </section>
    </div>
  );
}

function StockSummary({ locations, language }: { locations: InventoryLocation[]; language: SalesDayWorkspaceLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  const balances = locations.flatMap((location) =>
    (location.balances ?? []).map((balance) => ({ ...balance, locationName: location.name })),
  );
  if (!locations.length) {
    return <EmptyState title={t("salesday.stock.emptyTitle")} description={t("salesday.stock.emptyDescription")} />;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <DashboardMetric label={t("salesday.stock.locations")} value={locations.length} detail={t("salesday.stock.locationsDetail")} />
        <DashboardMetric label={t("salesday.stock.balanceLines")} value={balances.length} detail={t("salesday.stock.balanceLinesDetail")} />
        <DashboardMetric label={t("salesday.stock.expiryWarnings")} value={balances.filter((balance) => balance.expiryWarning).length} detail={t("salesday.stock.expiryWarningsDetail")} tone={balances.some((balance) => balance.expiryWarning) ? "warning" : "default"} />
      </div>
      <div className="grid gap-3">
        {locations.map((location) => (
          <article key={location.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{location.type.replaceAll("_", " ")}</p>
                <h2 className="font-semibold text-slate-900">{location.name}</h2>
              </div>
              <StatusBadge status="open" label={`${location.balances?.length ?? 0} ${t("salesday.stock.lines")}`} />
            </div>
            {(location.balances?.length ?? 0) > 0 && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {location.balances?.map((balance) => (
                  <div key={balance.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{balance.articleExternalId}</span>
                      <span className="font-bold text-slate-950">{balance.quantity} {balance.unit}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("salesday.stock.lot")} {balance.lotNumber ?? "-"} · {t("salesday.stock.expiry")} {formatDate(balance.expiryDate, language)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function DocumentSummary({ documents, appointmentId, language }: { documents: SalesDocument[]; appointmentId?: string; language: SalesDayWorkspaceLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  if (!appointmentId) return <EmptyState title={t("salesday.documents.emptySelectionTitle")} description={t("salesday.documents.emptySelectionDescription")} />;
  return documents.length ? (
    <div className="grid gap-3">
      {documents.map((document) => (
        <article key={document.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{document.documentType}</p>
              <h2 className="font-semibold text-slate-900">{document.documentNumber}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("salesday.documents.totalInclVat")}: {document.amountIncludingVat}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={document.status.toLowerCase()} label={document.status} />
              <StatusBadge status={document.deliveryStatus.toLowerCase()} label={document.deliveryStatus} />
              <Link className="btn-secondary min-h-10" href={`/api/salesday/documents/${document.id}/print`}>{t("salesday.documents.printShare")}</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  ) : <EmptyState title={t("salesday.documents.emptyTitle")} description={t("salesday.documents.emptyDescription")} />;
}

function localeForLanguage(language: SalesDayWorkspaceLanguage) {
  if (language === "fr") return "fr-BE";
  if (language === "de") return "de-DE";
  return "nl-BE";
}

function formatDate(value?: string | null, language: SalesDayWorkspaceLanguage = "nl") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(localeForLanguage(language));
}

function formatDateTime(value?: string | null, language: SalesDayWorkspaceLanguage = "nl") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(localeForLanguage(language), { dateStyle: "short", timeStyle: "short" });
}
