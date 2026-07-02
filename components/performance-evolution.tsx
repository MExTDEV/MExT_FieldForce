"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FileDown, Info, LoaderCircle, Play, UserRound, X } from "lucide-react";
import { PerformanceWheel, WheelTrendBadge } from "@/components/charts/PerformanceWheel";
import {
  getPerformanceWheelData,
  type PerformanceWheelCriterion,
  type PerformanceWheelType,
} from "@/lib/performance/performance-wheel";
import type { HistoricalCoaching } from "@/lib/performance-data";

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
      setExportError("De prestatiecirkel is nog niet klaar om te exporteren.");
      return;
    }

    setIsExporting(true);
    setExportError(undefined);
    setExportSuccess(undefined);
    try {
      const { exportPerformancePdf } = await import("@/lib/performance/export-performance-pdf");
      const result = await exportPerformancePdf({
        representativeName,
        coachingDate: formatDate(selected.date),
        comparisonDate: data.comparisonDate ? formatDate(data.comparisonDate) : undefined,
        modeLabel: mode === "kapstok" ? "Kapstok-prestaties" : "Algemene competenties",
        data,
        svgElement,
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
          ? `PDF-preview geopend (${result.pageCount} pagina's).`
          : `PDF aangemaakt: ${result.filename} (${result.pageCount} pagina's).`
      );
    } catch (error) {
      console.error("PDF-export mislukt", error);
      setExportError("De PDF kon niet worden aangemaakt. Probeer het opnieuw.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!selected || !data) {
    return <div className="card p-8 text-center text-sm text-slate-500">Nog geen begeleidingsscores beschikbaar.</div>;
  }

  return (
    <div className="space-y-5">
      {!compact && (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Begeleidingsmoment</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{formatDate(selected.date)}</h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-2"><UserRound className="h-4 w-4" /> {selected.ownerName}</span>
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Begeleiding {selectedIndex + 1} van {coachings.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Vorige begeleiding"
                disabled={selectedIndex === 0}
                onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}
                className="btn-secondary px-3"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <select
                aria-label="Selecteer begeleiding"
                className="field min-w-52"
                value={selected.id}
                onChange={(event) => setSelectedIndex(coachings.findIndex((item) => item.id === event.target.value))}
              >
                {coachings.map((item, index) => (
                  <option key={item.id} value={item.id}>{index + 1}. {formatDate(item.date)}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Volgende begeleiding"
                disabled={selectedIndex === coachings.length - 1}
                onClick={() => setSelectedIndex((index) => Math.min(coachings.length - 1, index + 1))}
                className="btn-secondary px-3"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <input
            aria-label="Begeleiding door de tijd"
            type="range"
            min={0}
            max={Math.max(0, coachings.length - 1)}
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            className="mt-5 w-full accent-brand-700"
          />
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{formatDate(coachings[0].date)}</span>
            <span>{formatDate(coachings.at(-1)!.date)}</span>
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between sm:p-6">
          <div>
            <p className="eyebrow">Competentiewiel</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {mode === "kapstok" ? "Kapstok-prestaties" : "Algemene competenties"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(selected.date)}
              {data.comparisonDate ? ` vergeleken met ${formatDate(data.comparisonDate)}` : " · eerste meting"}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <label className="text-xs font-semibold text-slate-500">
              Vergelijk met
              <select
                aria-label="Vergelijk met begeleiding"
                className="field mt-1 min-w-56"
                value={comparisonId}
                disabled={selectedIndex === 0}
                onChange={(event) => setComparisonId(event.target.value)}
              >
                <option value="auto">{selectedIndex === 0 ? "Geen vorige begeleiding" : "Automatisch vorige begeleiding"}</option>
                {comparisonOptions.map((item) => (
                  <option key={item.id} value={item.id}>{formatDate(item.date)}</option>
                ))}
              </select>
            </label>
            <div className="flex self-end rounded-xl bg-slate-100 p-1">
              <ModeButton active={mode === "kapstok"} onClick={() => setMode("kapstok")}>Kapstok</ModeButton>
              <ModeButton active={mode === "algemeen"} onClick={() => setMode("algemeen")}>Algemeen</ModeButton>
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
                  PDF wordt aangemaakt...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Exporteren naar PDF
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
              PDF bekijken
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
            />
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <Info className="h-4 w-4 text-brand-700" />
              Hoe verder een score naar buiten ligt, hoe sterker de prestatie.
            </p>
          </div>

          <ScoreOverview criteria={data.criteria} />
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
          Categorieën: {data.categories.map((item) => displayCategory(item.name)).join(", ")}
        </div>
      </section>
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="font-bold text-slate-950">Prestatiecirkel · {representativeName}</p>
                <p className="text-xs text-slate-500">PDF-preview</p>
              </div>
              <button
                type="button"
                aria-label="PDF-preview sluiten"
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
              title={`Prestatiecirkel PDF voor ${representativeName}`}
              src={pdfPreviewUrl}
              className="min-h-0 flex-1 bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreOverview({ criteria }: { criteria: PerformanceWheelCriterion[] }) {
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
            <h3 className="text-sm font-bold text-brand-800">{displayCategory(group.category)}</h3>
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
                    V: {row.previousTen === undefined ? "-" : formatScore(row.previousTen)}
                  </span>
                  <span className="whitespace-nowrap font-bold text-slate-950">
                    H: {row.currentScored ? formatScore(row.currentTen) : "niet gescoord"}
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

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function displayCategory(category: string) {
  return category === "Koffercontrole" ? "Klantcontrole" : category;
}
