"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  ClipboardCheck,
  FileDown,
  LoaderCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { useSession } from "@/components/session-provider";
import { translate, type TranslationKey } from "@/lib/i18n";
import type { Language } from "@/lib/types";

type Article = {
  id: string;
  articleNumber: string;
  stemNumber: string;
  descriptionNl: string;
  descriptionFr: string;
  descriptionDe: string;
  unitPrice: string;
  unitCost: string;
};

type Customer = {
  id: string;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  countryCode: string;
  preferredLanguage: Language;
};

type Calculation = {
  id: string;
  calculationNumber: string;
  name: string;
  status: "DRAFT" | "SIGNED";
  customer: Customer;
  ownerName: string;
  durationYears: number;
  discountPercentage: string;
  subtotal: string;
  discountAmount: string;
  annualPrice: string;
  totalCost: string;
  signedByName?: string | null;
  signedAt?: string | null;
  signedPlace?: string | null;
  generatedDocument?: {
    id: string;
    downloadUrl: string;
    fileName: string;
  };
  createdAt: string;
  lines: Array<{
    articleNumberSnapshot: string;
    stemNumberSnapshot: string;
    descriptionNlSnapshot: string;
    descriptionFrSnapshot: string;
    descriptionDeSnapshot: string;
    quantity: string;
    unitPriceSnapshot: string;
    unitCostSnapshot: string;
    lineAmount: string;
    lineCost: string;
  }>;
};

type Overview = {
  calculations: Calculation[];
  customers: Customer[];
  activeModel: null | {
    id: string;
    label: string;
    sourceWorkbookVersion: string | null;
    termRules: Array<{ durationYears: number; discountPercentage: string; priceMultiplier: string }>;
  };
  metrics: {
    calculationCount: number;
    annualPrice: string;
    totalCost: string;
  };
};

type DraftLine = {
  id: string;
  article: Article | null;
  quantity: string;
};

type ImportPreview = {
  id: string;
  sourceFileName: string;
  sourceFileSha256: string;
  sourceWorkbookVersion: string | null;
  duplicateSha: boolean;
  foundArticles: number;
  newArticles: number;
  changedArticles: number;
  deactivatedArticles: number;
  unchangedArticles: number;
  changedPriceRows: Array<{
    articleNumber: string;
    description: string;
    oldUnitPrice?: string;
    newUnitPrice: string;
    oldUnitCost?: string;
    newUnitCost: string;
  }>;
};

type ContractLetterTemplate = {
  id: string;
  language: Language;
  name: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "FAILED";
  sourceFileName: string;
  sourceFileSha256: string;
  foundParameters: string[];
  validation: {
    unknownParameters: string[];
    missingRecommendedParameters: string[];
    internalParameters: string[];
    errors: string[];
    warnings: string[];
    productListValid: boolean;
    signatureValid: boolean;
  };
  uploadedByName: string;
  activatedAt: string | null;
  createdAt: string;
};

export function ContractWorkspace({ segments }: { segments: string[] }) {
  const { user, language } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const section = segments[0] ?? "dashboard";

  const t = (key: TranslationKey) => translate(language, key);

  async function refresh() {
    if (!user.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/contract/overview?actorId=${encodeURIComponent(user.id)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("contract.error.generic"));
      setOverview(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("contract.error.generic"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  if (loading && !overview) {
    return <EmptyState title={t("contract.loading.title")} description={t("contract.loading.description")} />;
  }
  if (error && !overview) {
    return <EmptyState title={t("contract.error.title")} description={error} />;
  }

  const data = overview;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {section === "new" ? (
        <ContractWizard overview={data} onSaved={refresh} />
      ) : section === "calculations" ? (
        <CalculationsPage calculations={data.calculations} onSigned={refresh} />
      ) : section === "customers" ? (
        <CustomersPage customers={data.customers} calculations={data.calculations} />
      ) : section === "reporting" ? (
        <ReportingPage overview={data} />
      ) : section === "manage" ? (
        <ManagePage onImported={refresh} />
      ) : (
        <DashboardPage overview={data} />
      )}
    </div>
  );
}

function DashboardPage({ overview }: { overview: Overview }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <>
      <PageHeader
        eyebrow={t("contract.eyebrow")}
        title={t("contract.dashboard.title")}
        description={t("contract.dashboard.description")}
        actions={<Link href="/contract/new" className="btn-primary"><Plus className="h-4 w-4" />{t("contract.action.new")}</Link>}
      />
      {!overview.activeModel && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("contract.model.empty")}
        </div>
      )}
      <MetricGrid overview={overview} />
      <RecentCalculations calculations={overview.calculations.slice(0, 8)} />
    </>
  );
}

function MetricGrid({ overview }: { overview: Overview }) {
  const { language } = useSession();
  const cards = [
    ["contract.metric.count", overview.metrics.calculationCount.toString(), ClipboardCheck],
    ["contract.metric.annual", formatCurrency(overview.metrics.annualPrice, language), BarChart3],
    ["contract.metric.cost", formatCurrency(overview.metrics.totalCost, language), FileDown],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(([key, value, Icon]) => (
        <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{translate(language, key as TranslationKey)}</p>
            <Icon className="h-4 w-4 text-brand-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ContractWizard({ overview, onSaved }: { overview: Overview; onSaved: () => Promise<void> }) {
  const { user, language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState({ companyName: "", contactName: "", email: "", phone: "", address: "", city: "", countryCode: user.country, preferredLanguage: language });
  const [durationYears, setDurationYears] = useState(overview.activeModel?.termRules[0]?.durationYears ?? 3);
  const [lines, setLines] = useState<DraftLine[]>([{ id: crypto.randomUUID(), article: null, quantity: "1" }]);
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedCalculation, setSavedCalculation] = useState<Calculation | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/contract/articles?actorId=${encodeURIComponent(user.id)}&q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setArticles(Array.isArray(payload) ? payload : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [query, user.id]);

  const preview = useMemo(() => localPreview(lines, durationYears, overview.activeModel), [lines, durationYears, overview.activeModel]);
  const canContinue = step === 1
    ? Boolean(customerId || customer.companyName.trim())
    : step === 2
      ? lines.some((line) => line.article && Number(line.quantity) > 0)
      : true;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/contract/calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: user.id,
          name,
          customerId: customerId || undefined,
          customer: customerId ? undefined : customer,
          durationYears,
          lines: lines.filter((line) => line.article).map((line) => ({ articleId: line.article?.id, quantity: line.quantity })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("contract.error.generic"));
      setSavedCalculation(payload);
      await onSaved();
      setStep(4);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("contract.error.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow={t("contract.eyebrow")} title={t("contract.new.title")} description={t("contract.new.description")} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <StepBar step={step} setStep={setStep} />
          {message && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{message}</div>}
          {step === 1 && (
            <Card title={t("contract.step.customer")}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  {t("contract.field.existingCustomer")}
                  <select className="field mt-1 w-full" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                    <option value="">{t("contract.customer.newManual")}</option>
                    {overview.customers.map((item) => <option key={item.id} value={item.id}>{item.companyName}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  {t("contract.field.language")}
                  <select className="field mt-1 w-full" value={customer.preferredLanguage} onChange={(event) => setCustomer((value) => ({ ...value, preferredLanguage: event.target.value as Language }))}>
                    <option value="nl">Nederlands</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </label>
                {!customerId && (
                  <>
                    <Field label={t("contract.field.companyName")} value={customer.companyName} onChange={(value) => setCustomer((current) => ({ ...current, companyName: value }))} required />
                    <Field label={t("contract.field.contactName")} value={customer.contactName} onChange={(value) => setCustomer((current) => ({ ...current, contactName: value }))} />
                    <Field label={t("contract.field.email")} value={customer.email} onChange={(value) => setCustomer((current) => ({ ...current, email: value }))} />
                    <Field label={t("contract.field.phone")} value={customer.phone} onChange={(value) => setCustomer((current) => ({ ...current, phone: value }))} />
                    <Field label={t("contract.field.address")} value={customer.address} onChange={(value) => setCustomer((current) => ({ ...current, address: value }))} />
                    <Field label={t("contract.field.city")} value={customer.city} onChange={(value) => setCustomer((current) => ({ ...current, city: value }))} />
                  </>
                )}
              </div>
            </Card>
          )}
          {step === 2 && (
            <Card title={t("contract.step.articles")}>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input className="w-full bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("contract.article.search")} />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {articles.slice(0, 8).map((article) => (
                  <button key={article.id} type="button" className="rounded-xl border border-slate-200 p-3 text-left text-sm hover:border-brand-300 hover:bg-brand-50" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), article, quantity: "1" }])}>
                    <p className="font-semibold text-slate-950">{article.articleNumber}</p>
                    <p className="text-xs text-slate-500">{article.stemNumber} · {description(article, language)}</p>
                    <p className="mt-1 text-xs font-semibold text-brand-700">{formatCurrency(article.unitPrice, language)}</p>
                  </button>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                {lines.map((line, index) => (
                  <div key={line.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_120px_auto]">
                    <select className="field" value={line.article?.id ?? ""} onChange={(event) => {
                      const article = articles.find((item) => item.id === event.target.value) ?? null;
                      setLines((current) => current.map((item) => item.id === line.id ? { ...item, article } : item));
                    }}>
                      <option value="">{t("contract.article.choose")}</option>
                      {articles.map((article) => <option key={article.id} value={article.id}>{article.articleNumber} · {description(article, language)}</option>)}
                    </select>
                    <input className="field" type="number" min="0" step="0.001" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} />
                    <button type="button" className="btn-secondary" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>{t("contract.action.remove")}</button>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {step === 3 && (
            <Card title={t("contract.step.contract")}>
              <div className="grid gap-3 md:grid-cols-2">
                {overview.activeModel?.termRules.map((rule) => (
                  <button key={rule.durationYears} type="button" className={`rounded-2xl border p-4 text-left ${durationYears === rule.durationYears ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white"}`} onClick={() => setDurationYears(rule.durationYears)}>
                    <p className="text-lg font-bold text-slate-950">{rule.durationYears} {t("contract.unit.years")}</p>
                    <p className="text-sm text-slate-500">{rule.discountPercentage}% {t("contract.field.discount")}</p>
                  </button>
                ))}
              </div>
            </Card>
          )}
          {step === 4 && (
            <Card title={t("contract.step.finish")}>
              <Field label={t("contract.field.calculationName")} value={name} onChange={setName} required />
              <div className="mt-4 flex flex-wrap gap-2">
                {!savedCalculation ? (
                  <button type="button" className="btn-primary" disabled={saving || !name.trim()} onClick={() => void save()}>
                    {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {t("contract.action.saveDraft")}
                  </button>
                ) : (
                  <>
                    <DownloadPdfButton calculation={savedCalculation} kind="internal" />
                    <SignatureButton calculation={savedCalculation} onSigned={onSaved} />
                  </>
                )}
              </div>
            </Card>
          )}
          <div className="flex justify-between">
            <button type="button" className="btn-secondary" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}>{t("contract.action.previous")}</button>
            {step < 4 && <button type="button" className="btn-primary" disabled={!canContinue} onClick={() => setStep((value) => Math.min(4, value + 1))}>{t("contract.action.next")}</button>}
          </div>
        </section>
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("contract.preview.title")}</p>
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow label={t("contract.metric.subtotal")} value={formatCurrency(preview.subtotal, language)} />
            <SummaryRow label={t("contract.field.discount")} value={`-${formatCurrency(preview.discountAmount, language)}`} />
            <SummaryRow label={t("contract.metric.annual")} value={formatCurrency(preview.annualPrice, language)} strong />
            <SummaryRow label={t("contract.metric.cost")} value={formatCurrency(preview.totalCost, language)} />
          </div>
          <p className="mt-4 text-xs text-slate-500">{t("contract.preview.vat")}</p>
        </aside>
      </div>
    </>
  );
}

function StepBar({ step, setStep }: { step: number; setStep: (step: number) => void }) {
  const { language } = useSession();
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {["contract.step.customer", "contract.step.articles", "contract.step.contract", "contract.step.finish"].map((key, index) => (
        <button key={key} type="button" className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${step === index + 1 ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"}`} onClick={() => setStep(index + 1)}>
          {index + 1}. {translate(language, key as TranslationKey)}
        </button>
      ))}
    </div>
  );
}

function CalculationsPage({ calculations, onSigned }: { calculations: Calculation[]; onSigned: () => Promise<void> }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <>
      <PageHeader eyebrow={t("contract.eyebrow")} title={t("contract.calculations.title")} description={t("contract.calculations.description")} />
      <RecentCalculations calculations={calculations} onSigned={onSigned} />
    </>
  );
}

function RecentCalculations({ calculations, onSigned }: { calculations: Calculation[]; onSigned?: () => Promise<void> }) {
  const { language } = useSession();
  if (!calculations.length) return <EmptyState title={translate(language, "contract.calculations.empty")} description={translate(language, "contract.calculations.emptyDescription")} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">{translate(language, "contract.column.number")}</th>
            <th className="px-4 py-3">{translate(language, "contract.column.name")}</th>
            <th className="px-4 py-3">{translate(language, "contract.column.customer")}</th>
            <th className="px-4 py-3">{translate(language, "contract.column.duration")}</th>
            <th className="px-4 py-3 text-right">{translate(language, "contract.metric.annual")}</th>
            <th className="px-4 py-3">{translate(language, "contract.column.status")}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {calculations.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-mono text-xs">{item.calculationNumber}</td>
              <td className="px-4 py-3 font-semibold text-slate-950">{item.name}</td>
              <td className="px-4 py-3">{item.customer.companyName}</td>
              <td className="px-4 py-3">{item.durationYears}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.annualPrice, language)}</td>
              <td className="px-4 py-3"><StatusBadge status={item.status.toLowerCase()} label={translate(language, `contract.status.${item.status}` as TranslationKey)} /></td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <DownloadPdfButton calculation={item} kind="customer" />
                  {item.status === "DRAFT" && onSigned && <SignatureButton calculation={item} onSigned={onSigned} compact />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomersPage({ customers, calculations }: { customers: Customer[]; calculations: Calculation[] }) {
  const { language } = useSession();
  return (
    <>
      <PageHeader eyebrow={translate(language, "contract.eyebrow")} title={translate(language, "contract.customers.title")} description={translate(language, "contract.customers.description")} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => (
          <div key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Users className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-slate-950">{customer.companyName}</p>
                <p className="text-sm text-slate-500">{customer.contactName || customer.email || "-"}</p>
                <p className="mt-2 text-xs text-slate-400">{calculations.filter((item) => item.customer.id === customer.id).length} {translate(language, "contract.customers.calculations")}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ReportingPage({ overview }: { overview: Overview }) {
  const { language } = useSession();
  const byDuration = [3, 5].map((duration) => ({
    duration,
    count: overview.calculations.filter((item) => item.durationYears === duration).length,
    value: overview.calculations.filter((item) => item.durationYears === duration).reduce((sum, item) => sum + Number(item.annualPrice), 0),
  }));
  return (
    <>
      <PageHeader eyebrow={translate(language, "contract.eyebrow")} title={translate(language, "contract.reporting.title")} description={translate(language, "contract.reporting.description")} />
      <MetricGrid overview={overview} />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="font-bold text-slate-950">{translate(language, "contract.reporting.durationDistribution")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {byDuration.map((item) => (
            <div key={item.duration} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">{item.duration} {translate(language, "contract.unit.years")}</p>
              <p className="mt-2 text-2xl font-bold text-brand-800">{item.count}</p>
              <p className="text-sm text-slate-500">{formatCurrency(item.value, language)}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ManagePage({ onImported }: { onImported: () => Promise<void> }) {
  const { user, language } = useSession();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return <EmptyState title={translate(language, "contract.manage.noAccess")} description={translate(language, "contract.manage.noAccessDescription")} />;
  }
  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("actorId", user.id);
      form.set("file", file);
      const response = await fetch("/api/contract/import/preview", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setPreview(payload);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : translate(language, "contract.error.generic"));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview) return;
    setBusy(true);
    const response = await fetch(`/api/contract/import/${preview.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: user.id }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? translate(language, "contract.error.generic"));
      return;
    }
    setMessage(translate(language, "contract.import.imported"));
    setPreview(null);
    await onImported();
  }
  return (
    <>
      <PageHeader eyebrow={translate(language, "contract.eyebrow")} title={translate(language, "contract.manage.title")} description={translate(language, "contract.manage.description")} />
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card title={translate(language, "contract.import.title")}>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm hover:border-brand-300 hover:bg-brand-50">
            <Plus className="mb-3 h-8 w-8 text-brand-700" />
            <span className="font-semibold text-slate-950">{translate(language, "contract.import.choose")}</span>
            <span className="mt-1 text-xs text-slate-500">.xlsx / .xlsm</span>
            <input type="file" accept=".xlsx,.xlsm" className="sr-only" disabled={busy} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }} />
          </label>
          {busy && <p className="mt-3 text-sm text-slate-500">{translate(language, "contract.loading.title")}</p>}
          {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
        </Card>
        <Card title={translate(language, "contract.import.preview")}>
          {!preview ? (
            <p className="text-sm text-slate-500">{translate(language, "contract.import.noPreview")}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                <SummaryTile label={translate(language, "contract.import.found")} value={preview.foundArticles} />
                <SummaryTile label={translate(language, "contract.import.new")} value={preview.newArticles} />
                <SummaryTile label={translate(language, "contract.import.changed")} value={preview.changedArticles} />
                <SummaryTile label={translate(language, "contract.import.deactivated")} value={preview.deactivatedArticles} />
                <SummaryTile label={translate(language, "contract.import.unchanged")} value={preview.unchangedArticles} />
              </div>
              <p className="text-xs text-slate-500">{preview.sourceWorkbookVersion ?? "-"} · {preview.sourceFileSha256}</p>
              <button type="button" className="btn-primary" disabled={busy || preview.duplicateSha} onClick={() => void confirm()}>{translate(language, "contract.import.confirm")}</button>
              {preview.duplicateSha && <p className="text-sm text-amber-700">{translate(language, "contract.import.duplicateSha")}</p>}
            </div>
          )}
        </Card>
      </div>
      <ContractLetterManager />
    </>
  );
}

function ContractLetterManager() {
  const { user, language } = useSession();
  const [templates, setTemplates] = useState<ContractLetterTemplate[]>([]);
  const [templateLanguage, setTemplateLanguage] = useState<Language>(language);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch(`/api/contract/letter/templates?actorId=${encodeURIComponent(user.id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? translate(language, "contract.error.generic"));
    setTemplates(payload.templates ?? []);
  }

  useEffect(() => {
    void load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function uploadTemplate(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("actorId", user.id);
      form.set("language", templateLanguage);
      form.set("file", file);
      const response = await fetch("/api/contract/letter/templates", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? translate(language, "contract.error.generic"));
      setMessage(payload.validation?.errors?.length ? translate(language, "contract.letter.validationFailed") : translate(language, "contract.letter.uploaded"));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : translate(language, "contract.error.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function activateTemplate(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/contract/letter/templates/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? translate(language, "contract.error.generic"));
      setMessage(translate(language, "contract.letter.activated"));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : translate(language, "contract.error.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={translate(language, "contract.letter.title")}>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            {translate(language, "contract.field.language")}
            <select className="field mt-1 w-full" value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value as Language)}>
              <option value="nl">Nederlands</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm hover:border-brand-300 hover:bg-brand-50">
            <Plus className="mb-3 h-8 w-8 text-brand-700" />
            <span className="font-semibold text-slate-950">{translate(language, "contract.letter.choose")}</span>
            <span className="mt-1 text-xs text-slate-500">.docx</span>
            <input type="file" accept=".docx" className="sr-only" disabled={busy} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadTemplate(file);
            }} />
          </label>
          {message && <p className="text-sm text-slate-600">{message}</p>}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(["nl", "fr", "de"] as Language[]).map((itemLanguage) => {
            const active = templates.find((template) => template.language === itemLanguage && template.status === "ACTIVE");
            const latest = templates.find((template) => template.language === itemLanguage);
            const shown = active ?? latest;
            return (
              <div key={itemLanguage} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold uppercase text-slate-950">{itemLanguage}</p>
                  <FileDown className="h-4 w-4 text-brand-700" />
                </div>
                {!shown ? (
                  <p className="mt-3 text-slate-500">{translate(language, "contract.letter.none")}</p>
                ) : (
                  <>
                    <p className="mt-3 font-semibold text-slate-950">{shown.name}</p>
                    <p className="text-xs text-slate-500">v{shown.version} · {shown.status}</p>
                    <p className="mt-2 text-xs text-slate-500">{shown.foundParameters.join(", ") || "-"}</p>
                    {shown.validation.errors.length > 0 && <p className="mt-2 text-xs text-rose-700">{translate(language, "contract.letter.hasErrors")}</p>}
                    {shown.validation.internalParameters.length > 0 && <p className="mt-2 text-xs text-amber-700">{translate(language, "contract.letter.internalWarning")}</p>}
                    {shown.status !== "ACTIVE" && shown.validation.errors.length === 0 && (
                      <button type="button" className="btn-secondary mt-3" disabled={busy} onClick={() => void activateTemplate(shown.id)}>
                        {translate(language, "contract.letter.activate")}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function DownloadPdfButton({ calculation, kind }: { calculation: Calculation; kind: "internal" | "customer" }) {
  const { language } = useSession();
  return (
    <button type="button" className="btn-secondary" onClick={() => void downloadPdf(calculation, kind, language)}>
      <FileDown className="h-4 w-4" />
      {translate(language, kind === "internal" ? "contract.pdf.internal" : "contract.pdf.customer")}
    </button>
  );
}

function SignatureButton({ calculation, onSigned, compact }: { calculation: Calculation; onSigned: () => Promise<void>; compact?: boolean }) {
  const { user, language } = useSession();
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signedByName, setSignedByName] = useState(calculation.customer.contactName ?? "");
  const [signedPlace, setSignedPlace] = useState(calculation.customer.city ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [open]);
  function pointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  async function confirm() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/contract/calculations/${calculation.id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: user.id,
        signedByName,
        signedPlace,
        signatureData: canvasRef.current?.toDataURL("image/png"),
      }),
    });
    setBusy(false);
    if (response.ok) {
      const payload = await response.json() as Calculation;
      setOpen(false);
      await onSigned();
      if (payload.generatedDocument?.downloadUrl) {
        window.open(`${payload.generatedDocument.downloadUrl}?actorId=${encodeURIComponent(user.id)}`, "_blank", "noopener,noreferrer");
      }
    } else {
      const payload = await response.json().catch(() => undefined) as { error?: string } | undefined;
      setError(payload?.error ?? translate(language, "contract.error.generic"));
    }
  }
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        <Check className="h-4 w-4" />
        {compact ? "" : translate(language, "contract.action.sign")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <p className="text-lg font-bold text-slate-950">{translate(language, "contract.signature.title")}</p>
              <p className="text-sm text-slate-500">{calculation.customer.companyName} · {formatCurrency(calculation.annualPrice, language)}</p>
            </div>
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-3">
                {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
                <Field label={translate(language, "contract.signature.name")} value={signedByName} onChange={setSignedByName} />
                <Field label={translate(language, "contract.signature.place")} value={signedPlace} onChange={setSignedPlace} />
                <canvas
                  ref={canvasRef}
                  className="h-48 w-full touch-none rounded-xl border border-slate-300 bg-white"
                  onPointerDown={(event) => {
                    const ctx = event.currentTarget.getContext("2d");
                    const point = pointer(event);
                    ctx?.beginPath();
                    ctx?.moveTo(point.x, point.y);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (event.buttons !== 1) return;
                    const ctx = event.currentTarget.getContext("2d");
                    const point = pointer(event);
                    ctx?.lineTo(point.x, point.y);
                    ctx?.stroke();
                  }}
                />
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-950">{calculation.name}</p>
                <p className="mt-1 text-slate-500">{calculation.durationYears} {translate(language, "contract.unit.years")}</p>
                <div className="mt-4 max-h-60 overflow-auto">
                  {calculation.lines.map((line) => <p key={line.articleNumberSnapshot} className="border-b border-slate-200 py-2">{line.articleNumberSnapshot} · {line.quantity}</p>)}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{translate(language, "contract.action.cancel")}</button>
              <button type="button" className="btn-primary" disabled={busy || !signedByName.trim()} onClick={() => void confirm()}>{translate(language, "contract.action.confirmSignature")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

async function downloadPdf(calculation: Calculation, kind: "internal" | "customer", language: Language) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const customer = kind === "customer";
  let y = 18;
  pdf.setFillColor("#003B83");
  pdf.rect(0, 0, 210, 24, "F");
  pdf.setTextColor("#FFFFFF");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(customer ? translate(calculation.customer.preferredLanguage, "contract.pdf.customerTitle") : translate(language, "contract.pdf.internalTitle"), 14, 15);
  pdf.setTextColor("#0f172a");
  y = 38;
  pdf.setFontSize(16);
  pdf.text(calculation.customer.companyName, 14, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`${calculation.calculationNumber} · ${calculation.durationYears} ${translate(language, "contract.unit.years")}`, 14, y);
  y += 12;
  const headers = customer
    ? ["Artikel", "Omschrijving", "Aantal"]
    : ["Artikel", "Omschrijving", "Aantal", "Prijs", "Totaal", "Kost"];
  pdf.setFont("helvetica", "bold");
  pdf.text(headers.join("    "), 14, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  for (const line of calculation.lines) {
    if (y > 265) {
      pdf.addPage();
      y = 20;
    }
    const desc = localizedSnapshot(line, customer ? calculation.customer.preferredLanguage : language);
    const row = customer
      ? [line.articleNumberSnapshot, desc.slice(0, 52), line.quantity]
      : [line.articleNumberSnapshot, desc.slice(0, 36), line.quantity, formatCurrency(line.unitPriceSnapshot, language), formatCurrency(line.lineAmount, language), formatCurrency(line.lineCost, language)];
    pdf.text(row.join("    "), 14, y, { maxWidth: 182 });
    y += 6;
  }
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.text(`${translate(language, "contract.metric.annual")}: ${formatCurrency(calculation.annualPrice, language)}`, 14, y);
  y += 7;
  pdf.text(`${translate(language, "contract.pdf.totalContract")}: ${formatCurrency(Number(calculation.annualPrice) * calculation.durationYears, language)}`, 14, y);
  if (!customer) {
    y += 7;
    pdf.text(`${translate(language, "contract.metric.cost")}: ${formatCurrency(calculation.totalCost, language)}`, 14, y);
  }
  if (calculation.signedByName) {
    y += 16;
    pdf.text(`${translate(language, "contract.signature.name")}: ${calculation.signedByName}`, 14, y);
    y += 6;
    pdf.text(`${translate(language, "contract.signature.place")}: ${calculation.signedPlace ?? "-"}`, 14, y);
  }
  pdf.setFontSize(8);
  pdf.setTextColor("#64748B");
  pdf.text(translate(language, "contract.preview.vat"), 14, 288);
  pdf.save(`contract-${calculation.calculationNumber}-${kind}.pdf`);
}

function localPreview(lines: DraftLine[], durationYears: number, model: Overview["activeModel"]) {
  const term = model?.termRules.find((rule) => rule.durationYears === durationYears);
  const subtotal = lines.reduce((sum, line) => sum + (line.article ? Number(line.article.unitPrice) * Number(line.quantity || 0) : 0), 0);
  const totalCost = lines.reduce((sum, line) => sum + (line.article ? Number(line.article.unitCost) * Number(line.quantity || 0) : 0), 0);
  const multiplier = Number(term?.priceMultiplier ?? 1);
  const annualPrice = subtotal * multiplier;
  return {
    subtotal,
    discountAmount: subtotal - annualPrice,
    annualPrice,
    totalCost,
  };
}

function description(article: Article, language: Language) {
  return language === "fr" ? article.descriptionFr || article.descriptionNl : language === "de" ? article.descriptionDe || article.descriptionNl : article.descriptionNl;
}

function localizedSnapshot(line: Calculation["lines"][number], language: Language) {
  return language === "fr" ? line.descriptionFrSnapshot || line.descriptionNlSnapshot : language === "de" ? line.descriptionDeSnapshot || line.descriptionNlSnapshot : line.descriptionNlSnapshot;
}

function formatCurrency(value: string | number, language: Language) {
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  return Number(value || 0).toLocaleString(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}{required ? " *" : ""}
      <input className="field mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${strong ? "text-lg font-bold text-slate-950" : "font-semibold text-slate-800"}`}>{value}</span>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
