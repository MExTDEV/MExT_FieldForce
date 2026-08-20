"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ClipboardCheck, Contact, RefreshCw } from "lucide-react";

import { useSalesDayDeviceRuntime } from "@/components/salesday/device-runtime-provider";
import { useSession } from "@/components/session-provider";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { translate, type TranslationKey } from "@/lib/i18n";

type InventoryBalance = {
  id: string;
  articleExternalId: string;
  quantity: string;
  unit: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  expiryWarning?: boolean;
};

type InventoryLocation = {
  id: string;
  name: string;
  type: string;
  balances?: InventoryBalance[];
};

type ReplenishmentLine = {
  id: string;
  articleNumberSnapshot?: string | null;
  articleExternalId: string;
  expectedQuantity: string;
  unit: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
};

type Replenishment = {
  id: string;
  shipmentNumber: string;
  status: string;
  expectedAt?: string | null;
  shippedAt?: string | null;
  lines: ReplenishmentLine[];
  receipts?: Array<{ id: string; receivedAt: string }>;
};

type ConsumablesRequest = {
  id: string;
  status?: string;
  businessDate: string;
  submittedAt: string;
  comment?: string | null;
  lines: Array<{ id: string; articleExternalId: string; articleNumberSnapshot?: string | null; descriptionSnapshot?: string | null; quantity: string; unit: string }>;
};

type InventoryState = {
  loading: boolean;
  error: string | null;
  locations: InventoryLocation[];
  replenishments: Replenishment[];
  requests: ConsumablesRequest[];
};

type InventoryLanguage = "nl" | "fr" | "de";

export function InventoryWorkspace({ section }: { section?: string }) {
  const { user } = useSession();
  const runtime = useSalesDayDeviceRuntime();
  const language = user.language as InventoryLanguage;
  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);
  const [state, setState] = useState<InventoryState>({ loading: true, error: null, locations: [], replenishments: [], requests: [] });
  const [reload, setReload] = useState(0);
  const activeSection = section === "bevoorrading" || section === "verbruiksgoederen" ? section : "mijn-voorraad";
  const title = activeSection === "bevoorrading" ? t("inventory.nav.replenishments") : activeSection === "verbruiksgoederen" ? t("inventory.nav.consumables") : t("inventory.nav.stock");

  useEffect(() => {
    const controller = new AbortController();
    const query = `?actorId=${encodeURIComponent(user.id)}`;
    const endpoint = activeSection === "bevoorrading" ? `/api/inventory/replenishments${query}` : activeSection === "verbruiksgoederen" ? `/api/inventory/consumables${query}` : `/api/inventory/balances${query}`;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as Partial<InventoryState> & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? t("inventory.workspace.loadError"));
        setState({ loading: false, error: null, locations: payload.locations ?? [], replenishments: payload.replenishments ?? [], requests: payload.requests ?? [] });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : t("inventory.workspace.loadError") }));
      });
    return () => controller.abort();
  }, [activeSection, reload, t, user.id]);

  if (state.loading) return <EmptyState title={t("inventory.workspace.loadingTitle")} description={t("inventory.workspace.loadingDescription")} />;
  if (state.error) return <EmptyState title={t("inventory.workspace.loadErrorTitle")} description={state.error} />;

  return <div className="space-y-5">
    <PageHeader eyebrow={t("inventory.eyebrow")} title={title} description={t("inventory.description")} />
    <nav className="flex flex-wrap gap-2" aria-label={t("inventory.eyebrow")}>
      <Link className={activeSection === "mijn-voorraad" ? "btn-primary" : "btn-secondary"} href="/inventory/mijn-voorraad">{t("inventory.nav.stock")}</Link>
      <Link className={activeSection === "bevoorrading" ? "btn-primary" : "btn-secondary"} href="/inventory/bevoorrading">{t("inventory.nav.replenishments")}</Link>
      <Link className={activeSection === "verbruiksgoederen" ? "btn-primary" : "btn-secondary"} href="/inventory/verbruiksgoederen">{t("inventory.nav.consumables")}</Link>
      <button className="btn-secondary" type="button" onClick={() => setReload((value) => value + 1)}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t("inventory.workspace.refresh")}</button>
    </nav>
    {activeSection === "mijn-voorraad" ? <StockView locations={state.locations} language={language} /> : activeSection === "bevoorrading" ? <ReplenishmentsView replenishments={state.replenishments} language={language} /> : <ConsumablesView requests={state.requests} language={language} runtimeReady={runtime.phase === "READY"} />}
  </div>;
}

function StockView({ locations, language }: { locations: InventoryLocation[]; language: InventoryLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  const balances = locations.flatMap((location) => (location.balances ?? []).map((balance) => ({ ...balance, locationName: location.name })));
  const warnings = balances.filter((balance) => balance.expiryWarning).length;
  if (!locations.length) return <EmptyState title={t("inventory.stock.emptyTitle")} description={t("inventory.stock.emptyDescription")} />;
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3"><Metric icon={<Contact className="h-5 w-5" aria-hidden="true" />} label={t("inventory.stock.locations")} value={locations.length} /><Metric icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />} label={t("inventory.stock.lines")} value={balances.length} /><Metric icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />} label={t("inventory.stock.warnings")} value={warnings} warning={warnings > 0} /></div>
    {locations.map((location) => <section className="card p-4" key={location.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{location.type.replaceAll("_", " ")}</p><h2 className="font-semibold text-slate-950">{location.name}</h2></div><StatusBadge status="open" label={`${location.balances?.length ?? 0} ${t("inventory.stock.lines").toLowerCase()}`} /></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{(location.balances ?? []).map((balance) => <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" key={balance.id}><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{balance.articleExternalId}</span><span className="font-bold text-slate-950">{balance.quantity} {balance.unit}</span></div><p className="mt-1 text-xs text-slate-500">{balance.lotNumber ?? t("inventory.stock.noLot")} · {formatDate(balance.expiryDate, language)}</p>{balance.expiryWarning && <p className="mt-1 text-xs font-semibold text-amber-700">{t("inventory.stock.expiryWarning")}</p>}</article>)}</div></section>)}
  </div>;
}

function ReplenishmentsView({ replenishments, language }: { replenishments: Replenishment[]; language: InventoryLanguage }) {
  const t = (key: TranslationKey) => translate(language, key);
  if (!replenishments.length) return <EmptyState title={t("inventory.replenishments.emptyTitle")} description={t("inventory.replenishments.emptyDescription")} />;
  return <div className="grid gap-3">{replenishments.map((item) => <article className="card p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{t("inventory.replenishments.shipment")}</p><h2 className="font-semibold text-slate-950">{item.shipmentNumber}</h2><p className="mt-1 text-sm text-slate-500">{item.expectedAt ? formatDate(item.expectedAt, language) : t("inventory.replenishments.noDate")}</p></div><StatusBadge status={item.status.toLowerCase()} label={item.status} /></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{item.lines.map((line) => <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" key={line.id}><p className="font-semibold text-slate-900">{line.articleNumberSnapshot ?? line.articleExternalId}</p><p className="mt-1 text-slate-600">{line.expectedQuantity} {line.unit}</p></div>)}</div></article>)}</div>;
}

function ConsumablesView({ requests, language, runtimeReady }: { requests: ConsumablesRequest[]; language: InventoryLanguage; runtimeReady: boolean }) {
  const t = (key: TranslationKey) => translate(language, key);
  if (!requests.length) return <EmptyState title={t("inventory.consumables.emptyTitle")} description={runtimeReady ? t("inventory.consumables.emptyDescription") : t("inventory.consumables.deviceDescription")} />;
  return <div className="grid gap-3">{requests.map((request) => <article className="card p-4" key={request.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{t("inventory.consumables.request")}</p><h2 className="font-semibold text-slate-950">{formatDate(request.submittedAt, language)}</h2><p className="mt-1 text-sm text-slate-500">{request.comment ?? t("inventory.consumables.noComment")}</p></div><StatusBadge status={(request.status ?? "submitted").toLowerCase()} label={request.status ?? t("inventory.consumables.submitted")} /></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{request.lines.map((line) => <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" key={line.id}><p className="font-semibold text-slate-900">{line.articleNumberSnapshot ?? line.articleExternalId}</p><p className="mt-1 text-slate-600">{line.descriptionSnapshot ?? line.articleExternalId} · {line.quantity} {line.unit}</p></div>)}</div></article>)}</div>;
}

function Metric({ icon, label, value, warning = false }: { icon: ReactNode; label: string; value: number; warning?: boolean }) {
  return <article className={`card flex items-center gap-3 border p-4 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700">{icon}</div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-950">{value}</p></div></article>;
}

function formatDate(value: string | null | undefined, language: InventoryLanguage) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE");
}
