"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MapPin, Phone, Plus, UserRound, X } from "lucide-react";

import { useSession } from "@/components/session-provider";
import { useSalesDayDeviceRuntime } from "@/components/salesday/device-runtime-provider";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { SalesDayTeamWorkspace, type SalesDayTeamMember } from "@/components/salesday/salesday-team-workspace";
import { translate, type TranslationKey } from "@/lib/i18n";

type AgendaAppointment = {
  id: string;
  sequence: number;
  status?: string;
  externalId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  outcomeReasonExternalId?: string | null;
  relation?: {
    displayName?: string | null;
    type?: string | null;
    externalLinks?: Array<{ externalId: string }>;
    contacts?: Array<{ name: string; phone?: string | null; mobile?: string | null; primary?: boolean }>;
    addresses?: Array<{ street: string; houseNumber?: string | null; postalCode: string; city: string; primary?: boolean }>;
  } | null;
  salesDocuments?: Array<{
    id: string;
    documentNumber: string;
    documentType: string;
    status: string;
    deliveryStatus: string;
    amountIncludingVat: string;
    currency: string;
  }>;
  representative?: {
    id: string;
    firstName: string;
    lastName: string;
    country: string;
    team?: { name?: string | null } | null;
  } | null;
};
type PreparationAppointment = AgendaAppointment & { appointment?: AgendaAppointment };
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
  balances?: Array<{ id: string; currency: string; confirmedBalance: string; lastDepositConfirmedAt?: string | null; representative?: AgendaAppointment["representative"] }>;
  entries?: Array<{ id: string; type: string; amount: string; currency: string; occurredAt: string; comment?: string | null; representative?: AgendaAppointment["representative"] }>;
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
  members?: SalesDayTeamMember[];
  documents?: SalesDocument[];
  locations?: InventoryLocation[];
} & OperationalDashboard;
type CashJsonPayload = JsonPayload & CashSheet;
type JsonState = { loading: boolean; error: string | null; value: JsonPayload | null };
type SalesDayWorkspaceLanguage = "nl" | "fr" | "de";
type OutcomeReason = {
  externalId: string;
  labelNl: string;
  labelFr: string;
  labelDe: string;
  requiresComment: boolean;
};

export function SalesDayWorkspace({ section, appointmentId }: { section?: string; appointmentId?: string }) {
  const { user } = useSession();
  const runtime = useSalesDayDeviceRuntime();
  const [state, setState] = useState<JsonState>({ loading: true, error: null, value: null });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [teamDate, setTeamDate] = useState<string | undefined>();
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
    if (section === "mijn-team" && teamDate) query.set("businessDate", teamDate);
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
  }, [appointmentId, genericLoadError, isDashboard, isRepresentative, reloadVersion, runtime.deviceId, runtime.phase, section, teamDate, unknownError, user.id]);

  const appointments = useMemo(() => state.value?.appointments ?? [], [state.value]);
  if (isRepresentative && runtime.phase !== "READY") {
    return <EmptyState title={t("salesday.workspace.devicePreparingTitle")} description={runtime.error ?? t("salesday.workspace.devicePreparingDescription")} />;
  }
  if (state.loading) return <EmptyState title={`${title} — ${t("salesday.workspace.loadingTitle")}`} description={t("salesday.workspace.loadingDescription")} />;
  if (state.error) return <EmptyState title={`${title} — ${t("salesday.workspace.loadErrorTitle")}`} description={state.error} />;

  return (
    <div className="space-y-5">
      {section === "mijn-agenda" ? (
        <AgendaSummary
          actorId={user.id}
          appointments={appointments}
          appointmentId={appointmentId}
          businessDate={state.value?.businessDate}
          canMutate={isRepresentative}
          deviceId={runtime.deviceId ?? ""}
          language={user.language}
          onRefresh={() => setReloadVersion((value) => value + 1)}
        />
      ) : <>
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
        ? <SalesDayTeamWorkspace members={state.value?.members ?? []} businessDate={state.value?.businessDate} date={teamDate} language={user.language} onDateChange={setTeamDate} />
        : section === "cash"
          ? <CashSummary cashSheet={(state.value ?? {}) as CashJsonPayload} language={user.language} />
        : section === "mijn-voorraad"
          ? <StockSummary locations={state.value?.locations ?? []} language={user.language} />
        : section === "mijn-voorbereiding"
          ? <PreparationSummary preparations={state.value?.appointments ?? []} language={user.language} />
          : section === "documenten"
            ? <DocumentSummary documents={state.value?.documents ?? []} appointmentId={appointmentId} language={user.language} />
            : <AgendaSummary
              actorId={user.id}
              appointments={appointments}
              appointmentId={appointmentId}
              canMutate={isRepresentative}
              deviceId={runtime.deviceId ?? ""}
              language={user.language}
              onRefresh={() => setReloadVersion((value) => value + 1)}
            />}
      </>}
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

function AgendaSummary({ actorId, appointments, appointmentId, businessDate, canMutate, deviceId, language, onRefresh }: { actorId: string; appointments: AgendaAppointment[]; appointmentId?: string; businessDate?: string; canMutate: boolean; deviceId: string; language: SalesDayWorkspaceLanguage; onRefresh: () => void }) {
  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);
  const [noTimeAppointment, setNoTimeAppointment] = useState<AgendaAppointment | null>(null);
  const [duplicateAppointment, setDuplicateAppointment] = useState<AgendaAppointment | null>(null);
  const [outcomeReasons, setOutcomeReasons] = useState<OutcomeReason[]>([]);
  const [selectedReason, setSelectedReason] = useState("");
  const [comment, setComment] = useState("");
  const [mutationState, setMutationState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const openAppointments = appointments.filter(isOpenAppointment);
  const closedAppointments = appointments.filter((appointment) => !isOpenAppointment(appointment));
  const grouped = groupAppointmentsByRepresentative(openAppointments);
  const noTimeCount = appointments.filter(isNoTimeAppointment).length;
  const absentCount = appointments.filter(isCustomerAbsentAppointment).length;
  const closedCount = closedAppointments.length;

  useEffect(() => {
    if (!noTimeAppointment || !canMutate) return;
    const controller = new AbortController();
    fetch(`/api/salesday/appointments/outcome-reasons?actorId=${encodeURIComponent(actorId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { reasons?: OutcomeReason[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? t("salesday.agenda.actionError"));
        const reasons = payload.reasons ?? [];
        setOutcomeReasons(reasons);
        setSelectedReason(reasons[0]?.externalId ?? "");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMutationState({ busy: false, error: error instanceof Error ? error.message : t("salesday.agenda.actionError") });
      });
    return () => controller.abort();
  }, [actorId, canMutate, noTimeAppointment, t]);

  async function submitNoTime() {
    if (!noTimeAppointment || !selectedReason) return;
    setMutationState({ busy: true, error: null });
    try {
      const response = await fetch(`/api/salesday/appointments/${encodeURIComponent(noTimeAppointment.id)}/outcome`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actorId, deviceId, outcome: "NOT_COMPLETED", reasonExternalId: selectedReason, comment }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("salesday.agenda.actionError"));
      setNoTimeAppointment(null);
      setComment("");
      setOutcomeReasons([]);
      setMutationState({ busy: false, error: null });
      onRefresh();
    } catch (error) {
      setMutationState({ busy: false, error: error instanceof Error ? error.message : t("salesday.agenda.actionError") });
    }
  }

  async function submitDuplicate() {
    if (!duplicateAppointment) return;
    setMutationState({ busy: true, error: null });
    try {
      const response = await fetch(`/api/salesday/appointments/${encodeURIComponent(duplicateAppointment.id)}/duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actorId, deviceId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("salesday.agenda.actionError"));
      setDuplicateAppointment(null);
      setMutationState({ busy: false, error: null });
      onRefresh();
    } catch (error) {
      setMutationState({ busy: false, error: error instanceof Error ? error.message : t("salesday.agenda.actionError") });
    }
  }

  return (
    <div className="space-y-4">
      <header className="card border-brand-100 p-3 sm:p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
              <CalendarDays className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow mb-1">{t("salesday.agenda.eyebrow")}</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">{t("salesday.agenda.title")}</h1>
              <p className="mt-1 text-sm text-slate-500">{t("salesday.agenda.description")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <time dateTime={businessDate} className="inline-flex min-h-10 items-center rounded-xl border border-brand-100 bg-brand-50 px-3 text-sm font-semibold text-brand-800">
              {formatBusinessDate(businessDate, language)}
            </time>
            <Link className="btn-secondary min-h-10" href="/salesday/mijn-agenda?new=appointment"><Plus className="h-4 w-4" aria-hidden="true" />{t("salesday.agenda.newAppointment")}</Link>
            <Link className="btn-secondary min-h-10" href="/salesday/mijn-agenda?new=prospect"><Plus className="h-4 w-4" aria-hidden="true" />{t("salesday.agenda.newProspect")}</Link>
          </div>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <AgendaMetric icon={CalendarDays} label={t("salesday.agenda.totalAppointments")} value={appointments.length} />
        <AgendaMetric icon={Clock3} label={t("salesday.agenda.toDo")} value={openAppointments.length} />
        <AgendaMetric icon={CheckCircle2} label={t("salesday.agenda.completed")} value={appointments.filter((appointment) => appointment.status === "COMPLETED").length} />
        <AgendaMetric icon={Clock3} label={t("salesday.agenda.noTime")} value={noTimeCount} />
        <AgendaMetric icon={UserRound} label={t("salesday.agenda.customerAbsent")} value={absentCount} />
      </div>

      {!appointments.length ? (
        <EmptyState title={t("salesday.appointments.emptyTitle")} description={t("salesday.appointments.emptyDescription")} />
      ) : (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="eyebrow">{t("salesday.agenda.openAppointments")}</h2>
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">{openAppointments.length}</span>
          </div>
          {openAppointments.length ? grouped.map((group) => (
            <div key={group.key} className="space-y-2">
              {grouped.length > 1 && group.representative && (
                <div className="flex items-center justify-between border-b border-slate-200 px-1 pb-2 pt-2">
                  <div>
                    <h3 className="font-semibold text-slate-950">{representativeName(group.representative, t("salesday.appointments.customerFallback"))}</h3>
                    <p className="text-xs text-slate-500">{group.representative.team?.name ?? group.representative.country}</p>
                  </div>
                  <StatusBadge status="open" label={`${group.items.length} ${t("salesday.dashboard.appointments").toLowerCase()}`} />
                </div>
              )}
              {group.items.map((appointment) => (
                <AgendaAppointmentCard key={appointment.id} appointment={appointment} appointmentId={appointmentId} canMutate={canMutate} language={language} onDuplicate={() => setDuplicateAppointment(appointment)} onNoTime={() => setNoTimeAppointment(appointment)} />
              ))}
            </div>
          )) : <EmptyState title={t("salesday.agenda.noOpenTitle")} description={t("salesday.agenda.noOpenDescription")} />}
        </section>
      )}

      {appointments.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="eyebrow">{t("salesday.agenda.closedAppointments")}</h2>
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">{closedCount}</span>
          </div>
          {closedAppointments.length ? closedAppointments.map((appointment) => (
            <AgendaAppointmentCard key={appointment.id} appointment={appointment} appointmentId={appointmentId} canMutate={false} language={language} />
          )) : <EmptyState title={t("salesday.agenda.noClosedTitle")} description={t("salesday.agenda.noClosedDescription")} />}
        </section>
      )}

      {mutationState.error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{mutationState.error}</p>}

      {noTimeAppointment && (
        <Modal title={t("salesday.agenda.noTimeConfirmTitle")} closeLabel={t("salesday.agenda.closeDialog")} onClose={() => setNoTimeAppointment(null)}>
          <p className="text-sm leading-6 text-slate-600">{t("salesday.agenda.noTimeConfirmDescription")}</p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            {t("salesday.agenda.reason")}
            <select className="input mt-1.5 w-full" value={selectedReason} onChange={(event) => setSelectedReason(event.target.value)} disabled={mutationState.busy || !outcomeReasons.length}>
              {!outcomeReasons.length && <option value="">{t("salesday.agenda.loadingReasons")}</option>}
              {outcomeReasons.map((reason) => <option key={reason.externalId} value={reason.externalId}>{reasonLabel(reason, language)}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            {t("salesday.agenda.comment")}
            <textarea className="input mt-1.5 min-h-24 w-full" value={comment} onChange={(event) => setComment(event.target.value)} disabled={mutationState.busy} />
          </label>
          <ModalActions cancelLabel={t("common.cancel")} confirmLabel={t("salesday.agenda.confirmNoTime")} busy={mutationState.busy} disabled={!selectedReason} onCancel={() => setNoTimeAppointment(null)} onConfirm={() => void submitNoTime()} />
        </Modal>
      )}

      {duplicateAppointment && (
        <Modal title={t("salesday.agenda.duplicateTitle")} closeLabel={t("salesday.agenda.closeDialog")} onClose={() => setDuplicateAppointment(null)}>
          <p className="text-sm leading-6 text-slate-600">{t("salesday.agenda.duplicateDescription")} {duplicateAppointment.relation?.displayName ?? t("salesday.appointments.customerFallback")}</p>
          <ModalActions cancelLabel={t("common.cancel")} confirmLabel={t("salesday.agenda.confirmDuplicate")} busy={mutationState.busy} onCancel={() => setDuplicateAppointment(null)} onConfirm={() => void submitDuplicate()} />
        </Modal>
      )}
    </div>
  );
}

function AgendaMetric({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: number }) {
  return (
    <article className="card flex items-center gap-3 rounded-xl border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-bold leading-5 text-slate-950">{value}</p>
      </div>
    </article>
  );
}

function PreparationSummary({ preparations, language }: { preparations: PreparationAppointment[]; language: SalesDayWorkspaceLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  const grouped = groupAppointmentsByRepresentative(preparations);
  return preparations.length ? (
    <div className="grid gap-4">
      {grouped.map((group) => (
        <section key={group.key} className="space-y-2">
          {group.representative && (
            <div className="border-b border-slate-200 pb-2">
              <h2 className="font-semibold text-slate-950">{representativeName(group.representative, t("salesday.appointments.customerFallback"))}</h2>
              <p className="text-sm text-slate-500">{group.representative.team?.name ?? group.representative.country}</p>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <article key={item.appointment?.id ?? item.id} className="card p-4">
                <h3 className="font-semibold">{item.appointment?.relation?.displayName ?? item.relation?.displayName ?? t("salesday.appointments.customerFallback")}</h3>
                <p className="mt-1 text-sm text-slate-600">{t("salesday.preparation.description")}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  ) : <EmptyState title={t("salesday.preparation.emptyTitle")} description={t("salesday.preparation.emptyDescription")} />;
}

function AgendaAppointmentCard({ appointment, appointmentId, canMutate, language, onDuplicate, onNoTime }: { appointment: AgendaAppointment; appointmentId?: string; canMutate: boolean; language: SalesDayWorkspaceLanguage; onDuplicate?: () => void; onNoTime?: () => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  const address = appointment.relation?.addresses?.find((item) => item.primary) ?? appointment.relation?.addresses?.[0];
  const contact = appointment.relation?.contacts?.find((item) => item.primary) ?? appointment.relation?.contacts?.[0];
  const phone = contact?.phone ?? contact?.mobile;
  const document = appointment.salesDocuments?.[0];
  const relationType = appointment.relation?.type === "PROSPECT" ? t("salesday.agenda.prospect") : t("salesday.agenda.customer");
  const identifier = appointment.externalId ?? appointment.relation?.externalLinks?.[0]?.externalId;
  const isOpen = isOpenAppointment(appointment);
  return (
    <article id={appointment.id === appointmentId ? "appointment" : undefined} className={`card border-l-4 p-2.5 sm:p-3 ${appointmentAccent(appointment)}`}>
      <div className="grid gap-3 lg:grid-cols-[4.75rem_minmax(0,1fr)_13rem_13.5rem] lg:items-center">
        <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center lg:self-stretch lg:pt-2.5">
          <p className="text-sm font-bold leading-5 text-slate-950">{formatTime(appointment.startsAt, language)}</p>
          <p className="text-sm font-bold leading-5 text-slate-950">{formatTime(appointment.endsAt, language)}</p>
          <span className="mt-1 inline-flex rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 ring-1 ring-slate-200">{isOpen ? t("salesday.agenda.open") : appointmentStatusLabel(appointment, t)}</span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${relationType === t("salesday.agenda.prospect") ? "bg-amber-100 text-amber-800" : "bg-cyan-100 text-cyan-800"}`}>{relationType}</span>
            {identifier && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{identifier}</span>}
            <StatusBadge status={isOpen ? "gepland" : (appointment.status ?? "afgerond").toLowerCase()} label={appointmentStatusLabel(appointment, t)} />
          </div>
          <h3 className="mt-1.5 truncate text-sm font-bold text-slate-950">{appointment.relation?.displayName ?? t("salesday.appointments.customerFallback")}</h3>
          {address && <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />{formatAddress(address)}</p>}
          {document && <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">{documentTypeLabel(document.documentType, t)} {document.documentNumber} · {document.amountIncludingVat} {document.currency} · {documentStatusLabel(document.status, t)}</div>}
        </div>

        <div className="text-xs text-slate-600">
          <p className="flex items-center gap-1.5"><UserRound className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />{contact?.name ?? representativeName(appointment.representative, t("salesday.agenda.noContact"))}</p>
          {phone && <p className="mt-1 flex items-center gap-1.5"><Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />{phone}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Link className="btn-primary min-h-9 w-full px-3 py-2" href={`/salesday/documenten/${appointment.id}`}><ArrowUpRight className="h-4 w-4" aria-hidden="true" />{t("salesday.agenda.openAppointment")}</Link>
          {isOpen && canMutate && <div className="grid grid-cols-2 gap-1.5">
            <button className="btn-secondary min-h-9 px-2 py-2 text-xs" type="button" onClick={onNoTime}><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{t("salesday.agenda.noTime")}</button>
            <button className="btn-secondary min-h-9 px-2 py-2 text-xs" type="button" onClick={onDuplicate}><Plus className="h-3.5 w-3.5" aria-hidden="true" />{t("salesday.agenda.duplicate")}</button>
          </div>}
        </div>
      </div>
    </article>
  );
}

function Modal({ title, children, closeLabel, onClose }: { title: string; children: ReactNode; closeLabel: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black text-slate-950">{title}</h3><button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" type="button" onClick={onClose} aria-label={closeLabel}><X className="h-5 w-5" aria-hidden="true" /></button></div>
      <div className="mt-3">{children}</div>
    </section>
  </div>;
}

function ModalActions({ cancelLabel, confirmLabel, busy, disabled, onCancel, onConfirm }: { cancelLabel: string; confirmLabel: string; busy: boolean; disabled?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="mt-5 flex flex-wrap justify-end gap-2"><button className="btn-secondary min-h-11" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button><button className="btn-primary min-h-11" type="button" onClick={onConfirm} disabled={busy || disabled}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{confirmLabel}</button></div>;
}

function isOpenAppointment(appointment: AgendaAppointment) {
  return !appointment.status || appointment.status === "PLANNED";
}

function isCustomerAbsentAppointment(appointment: AgendaAppointment) {
  return /absent|afwezig|customer.?not|klant.?niet/i.test(appointment.outcomeReasonExternalId ?? "");
}

function isNoTimeAppointment(appointment: AgendaAppointment) {
  return appointment.status === "NOT_COMPLETED" && !isCustomerAbsentAppointment(appointment);
}

function appointmentStatusLabel(appointment: AgendaAppointment, t: (key: TranslationKey) => string) {
  if (isOpenAppointment(appointment)) return t("salesday.agenda.planned");
  if (isCustomerAbsentAppointment(appointment)) return t("salesday.agenda.customerAbsent");
  if (appointment.status === "NOT_COMPLETED") return t("salesday.agenda.noTime");
  if (appointment.status === "MOVED") return t("salesday.agenda.moved");
  if (appointment.status === "CANCELLED") return t("salesday.agenda.cancelled");
  return t("salesday.agenda.completed");
}

function appointmentAccent(appointment: AgendaAppointment) {
  if (isCustomerAbsentAppointment(appointment)) return "border-l-slate-500";
  if (appointment.status === "NOT_COMPLETED") return "border-l-amber-500";
  if (appointment.status === "MOVED") return "border-l-orange-500";
  if (appointment.status === "CANCELLED") return "border-l-red-500";
  if (appointment.status === "COMPLETED") return "border-l-emerald-500";
  return "border-l-brand-700";
}

function reasonLabel(reason: OutcomeReason, language: SalesDayWorkspaceLanguage) {
  if (language === "fr") return reason.labelFr;
  if (language === "de") return reason.labelDe;
  return reason.labelNl;
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
        <DashboardMetric label={t("salesday.cash.balances")} value={balances.length} detail={balances.length ? t("salesday.cash.balances").toLowerCase() : t("salesday.cash.noBalance")} tone={cashSheet.block ? "warning" : "default"} />
        <DashboardMetric label={t("salesday.cash.paymentMethods")} value={methods.length} detail={`${methods.filter((method) => method.affectsCashBalance).length} ${t("salesday.cash.cashImpact")}`} />
      </div>

      {balances.length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold text-slate-950">{t("salesday.cash.balances")}</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {balances.map((balance) => (
              <div key={balance.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-900">{representativeName(balance.representative, t("salesday.appointments.customerFallback"))}</p>
                <p className="mt-1 text-slate-600">{balance.confirmedBalance} {balance.currency}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card p-4">
        <h2 className="font-semibold text-slate-950">{t("salesday.cash.latestEntries")}</h2>
        {entries.length ? (
          <div className="mt-3 divide-y divide-slate-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{entry.type.replaceAll("_", " ")}</p>
                  <p className="text-xs text-slate-500">
                    {[representativeName(entry.representative, ""), formatDateTime(entry.occurredAt, language), entry.comment].filter(Boolean).join(" - ")}
                  </p>
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

function groupAppointmentsByRepresentative<T extends AgendaAppointment>(appointments: T[]) {
  const groups = new Map<string, { key: string; representative: AgendaAppointment["representative"]; items: T[] }>();
  for (const appointment of appointments) {
    const key = appointment.representative?.id ?? "own";
    const group = groups.get(key);
    if (group) group.items.push(appointment);
    else groups.set(key, { key, representative: appointment.representative ?? null, items: [appointment] });
  }
  return [...groups.values()];
}

function representativeName(representative: AgendaAppointment["representative"], fallback: string) {
  if (!representative) return fallback;
  return `${representative.firstName} ${representative.lastName}`.trim() || fallback;
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

function formatBusinessDate(value: string | undefined, language: SalesDayWorkspaceLanguage) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(localeForLanguage(language), { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(value: string | null | undefined, language: SalesDayWorkspaceLanguage) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(localeForLanguage(language), { hour: "2-digit", minute: "2-digit" });
}

function formatAddress(address: { street: string; houseNumber?: string | null; postalCode: string; city: string }) {
  return `${address.street}${address.houseNumber ? ` ${address.houseNumber}` : ""}, ${address.postalCode} ${address.city}`;
}

function documentTypeLabel(documentType: string, t: (key: TranslationKey) => string) {
  if (documentType === "OFFER") return t("salesday.agenda.offer");
  if (documentType === "ORDER") return t("salesday.agenda.order");
  if (documentType === "INVOICE") return t("salesday.agenda.invoice");
  return documentType.replaceAll("_", " ");
}

function documentStatusLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "SENT") return t("salesday.agenda.sent");
  if (status === "ACCEPTED") return t("salesday.agenda.accepted");
  return status.replaceAll("_", " ");
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
