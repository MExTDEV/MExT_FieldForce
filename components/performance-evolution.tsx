"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FileDown, Info, LoaderCircle, Play, UserRound, X } from "lucide-react";
import { PerformanceWheel, WheelTrendBadge } from "@/components/charts/PerformanceWheel";
import {
  getPerformanceWheelData,
  formatPerformancePercentage,
  type PerformanceWheelCategory,
  type PerformanceWheelCriterion,
  type PerformanceWheelType,
} from "@/lib/performance/performance-wheel";
import type { HistoricalCoaching } from "@/lib/performance-data";
import { useSession } from "@/components/session-provider";
import { translate, type TranslationKey } from "@/lib/i18n";

export function PerformanceEvolution({
  coachings,
  representativeName,
  initialCoachingId,
  compact = false,
}: {
  coachings: HistoricalCoaching[];
  representativeName: string;
  initialCoachingId?: string;
  compact?: boolean;
}) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const initialIndex = Math.max(
    0,
    initialCoachingId ? coachings.findIndex((item) => item.id === initialCoachingId) : coachings.length - 1
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [mode, setMode] = useState<PerformanceWheelType>("kapstok");
  const [comparisonId, setComparisonId] = useState("auto");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [exportSuccess, setExportSuccess] = useState<string>();
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>();
  const wheelRef = useRef<HTMLDivElement>(null);
  const selected = coachings[selectedIndex];
  const comparisonOptions = coachings.slice(0, selectedIndex).reverse();
  const effectiveComparisonId = comparisonId !== "auto" &&
    comparisonOptions.some((item) => item.id === comparisonId)
    ? comparisonId
    : undefined;

  useEffect(() => {
    setComparisonId("auto");
  }, [selectedIndex]);

  const data = useMemo(() => {
    if (!selected) return undefined;
    return getPerformanceWheelData(
      selected.representativeId,
      selected.id,
      mode,
      effectiveComparisonId,
      coachings
    );
  }, [coachings, effectiveComparisonId, mode, selected]);

  async function handleExport(preview = false) {
    const svgElement = wheelRef.current?.querySelector<SVGSVGElement>('[data-testid="performance-wheel-svg"]');
    if (!selected || !data || !svgElement) {
      setExportError(t("coaching.performance.exportReady"));
      return;
    }

    setIsExporting(true);
    setExportError(undefined);
    setExportSuccess(undefined);
    try {
      const { exportPerformancePdf } = await import("@/lib/performance/export-performance-pdf");
      const result = await exportPerformancePdf({
        representativeName,
        coachingDate: formatDate(selected.date, language),
        comparisonDate: data.comparisonDate ? formatDate(data.comparisonDate, language) : undefined,
        modeLabel: mode === "kapstok" ? t("coaching.performance.framework") : t("coaching.performance.general"),
        data,
        svgElement,
        notScoredLabel: t("coaching.performance.notScored"),
        totalScoreLabel: t("coaching.performance.totalScore"),
        preview,
      });
      if (result.previewUrl) {
        setPdfPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return result.previewUrl;
        });
      }
      setExportSuccess(
        preview
          ? t("coaching.performance.previewOpened").replace("{count}", String(result.pageCount))
          : t("coaching.performance.pdfCreated").replace("{filename}", result.filename).replace("{count}", String(result.pageCount))
      );
    } catch (error) {
      console.error("PDF-export mislukt", error);
      setExportError(t("coaching.performance.exportError"));
    } finally {
      setIsExporting(false);
    }
  }

  if (!selected || !data) {
    return <div className="card p-8 text-center text-sm text-slate-500">{t("coaching.performance.noScores")}</div>;
  }

  return (
    <div className="space-y-5">
      {!compact && (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">{t("coaching.performance.moment")}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{formatDate(selected.date, language)}</h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-2"><UserRound className="h-4 w-4" /> {selected.ownerName}</span>
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {t("coaching.list.coachings")} {selectedIndex + 1} / {coachings.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("coaching.performance.previous")}
                disabled={selectedIndex === 0}
                onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}
                className="btn-secondary px-3"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <select
                aria-label={t("coaching.performance.select")}
                className="field min-w-52"
                value={selected.id}
                onChange={(event) => setSelectedIndex(coachings.findIndex((item) => item.id === event.target.value))}
              >
                {coachings.map((item, index) => (
                  <option key={item.id} value={item.id}>{index + 1}. {formatDate(item.date, language)}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label={t("coaching.performance.next")}
                disabled={selectedIndex === coachings.length - 1}
                onClick={() => setSelectedIndex((index) => Math.min(coachings.length - 1, index + 1))}
                className="btn-secondary px-3"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <input
            aria-label={t("coaching.performance.timeline")}
            type="range"
            min={0}
            max={Math.max(0, coachings.length - 1)}
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            className="mt-5 w-full accent-brand-700"
          />
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{formatDate(coachings[0].date, language)}</span>
            <span>{formatDate(coachings.at(-1)!.date, language)}</span>
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between sm:p-6">
          <div>
            <p className="eyebrow">{t("coaching.performance.competencyWheel")}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {mode === "kapstok" ? t("coaching.performance.framework") : t("coaching.performance.general")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(selected.date, language)}
              {data.comparisonDate ? ` ${t("coaching.performance.compareWith")} ${formatDate(data.comparisonDate, language)}` : ` · ${t("coaching.performance.firstMeasurement")}`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <label className="text-xs font-semibold text-slate-500">
              {t("coaching.performance.compareWith")}
              <select
                aria-label={t("coaching.performance.compare")}
                className="field mt-1 min-w-56"
                value={comparisonId}
                disabled={selectedIndex === 0}
                onChange={(event) => setComparisonId(event.target.value)}
              >
                <option value="auto">{selectedIndex === 0 ? t("coaching.performance.noPrevious") : t("coaching.performance.autoPrevious")}</option>
                {comparisonOptions.map((item) => (
                  <option key={item.id} value={item.id}>{formatDate(item.date, language)}</option>
                ))}
              </select>
            </label>
            <div className="flex self-end rounded-xl bg-slate-100 p-1">
              <ModeButton active={mode === "kapstok"} onClick={() => setMode("kapstok")}>{t("coaching.performance.framework")}</ModeButton>
              <ModeButton active={mode === "algemeen"} onClick={() => setMode("algemeen")}>{t("coaching.performance.general")}</ModeButton>
            </div>
            <button
              type="button"
              onClick={() => handleExport(false)}
              disabled={isExporting}
              className="btn-primary self-end whitespace-nowrap"
            >
              {isExporting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {t("coaching.preparation.exporting")}
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  {t("coaching.performance.exportPdf")}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleExport(true)}
              disabled={isExporting}
              className="btn-secondary self-end whitespace-nowrap"
            >
              <Play className="h-4 w-4" />
              {t("coaching.performance.viewPdf")}
            </button>
          </div>
        </div>

        <div className="space-y-8 p-4 sm:p-6">
          <div ref={wheelRef}>
            <PerformanceWheel
              representativeId={selected.representativeId}
              currentInterventionId={selected.id}
              comparisonInterventionId={effectiveComparisonId}
              type={mode}
              coachings={coachings}
              notScoredLabel={t("coaching.performance.notScored")}
              totalScoreLabel={t("coaching.performance.totalScore")}
            />
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <Info className="h-4 w-4 text-brand-700" />
              {t("coaching.performance.wheelHelp")}
            </p>
          </div>

          <ScoreOverview criteria={data.criteria} categories={data.categories} />
          {exportError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {exportError}
            </div>
          )}
          {exportSuccess && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {exportSuccess}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 text-xs text-slate-500 sm:px-6">
          {t("coaching.performance.categoriesLabel")}: {data.categories.map((item) => displayCategory(item.name)).join(", ")}
        </div>
      </section>
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="font-bold text-slate-950">{t("coaching.performance.competencyWheel")} · {representativeName}</p>
                <p className="text-xs text-slate-500">{t("coaching.performance.pdfPreview")}</p>
              </div>
              <button
                type="button"
                aria-label={t("coaching.performance.closePreview")}
                onClick={() => {
                  URL.revokeObjectURL(pdfPreviewUrl);
                  setPdfPreviewUrl(undefined);
                }}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              title={t("coaching.performance.pdfTitle").replace("{name}", representativeName)}
              src={pdfPreviewUrl}
              className="min-h-0 flex-1 bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreOverview({ criteria, categories }: { criteria: PerformanceWheelCriterion[]; categories: PerformanceWheelCategory[] }) {
  const { language } = useSession();
  const t = (key: TranslationKey) => translate(language, key);
  const groups = criteria.reduce<Array<{ category: string; rows: PerformanceWheelCriterion[] }>>((result, row) => {
    const group = result.find((item) => item.category === row.category);
    if (group) {
      group.rows.push(row);
    } else {
      result.push({ category: row.category, rows: [row] });
    }
    return result;
  }, []);

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      {groups.map((group) => (
        <section key={group.category} className="rounded-xl border border-slate-200 bg-slate-50/70">
          <div className="border-b border-slate-200 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-brand-800">{displayCategory(group.category)}</h3>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-extrabold text-brand-800 ring-1 ring-slate-200">
                {(() => {
                  const percentage = categories.find((category) => category.name === group.category)?.currentPercentage;
                  return formatPerformancePercentage(percentage, t("coaching.performance.notScored"));
                })()}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-200/80">
            {group.rows.map((row) => (
              <div
                key={row.id}
                className="grid min-w-0 gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <p className="min-w-0 break-words text-xs font-semibold leading-4 text-slate-700">
                  {row.criterion}
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] sm:justify-end">
                  <span className="whitespace-nowrap text-slate-500">
                    {t("coaching.performance.previousShort")}: {row.previousTen === undefined ? "-" : formatScore(row.previousTen)}
                  </span>
                  <span className="whitespace-nowrap font-bold text-slate-950">
                    {t("coaching.performance.currentShort")}: {row.currentScored ? formatScore(row.currentTen) : t("coaching.performance.notScored")}
                  </span>
                  <DifferenceBadge difference={row.differenceTen} trend={row.trend} />
                  <WheelTrendBadge trend={row.trend} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DifferenceBadge({
  difference,
  trend,
}: {
  difference?: number;
  trend: PerformanceWheelCriterion["trend"];
}) {
  const styles = {
    better: "bg-emerald-100 text-emerald-800",
    worse: "bg-rose-100 text-rose-800",
    equal: "bg-slate-200 text-slate-700",
    first: "bg-blue-100 text-blue-800",
  };

  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-bold ${styles[trend]}`}>
      {formatDifference(difference)}
    </span>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-white text-brand-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function formatDifference(difference?: number) {
  if (difference === undefined) return "-";
  if (difference > 0) return `+${formatScore(difference)}`;
  return formatScore(difference);
}

function formatScore(value: number) {
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 1 });
}

function formatDate(value: string, language: "nl" | "fr" | "de") {
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function displayCategory(category: string) {
  return category === "Koffercontrole" ? "Klantcontrole" : category;
}
