"use client";

import { AlertTriangle, CheckCircle2, Cloud, RefreshCw, WifiOff } from "lucide-react";

import { translate, type TranslationKey } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import type { SalesDaySyncRuntimeSnapshot } from "@/lib/device/sync-runtime";

export function SalesDaySyncStatusCard({
  language,
  snapshot,
  onSync,
  onRetry,
}: {
  language: Language;
  snapshot: SalesDaySyncRuntimeSnapshot;
  onSync: () => void;
  onRetry: (commandId: string) => void;
}) {
  const t = (key: TranslationKey) => translate(language, key);
  const presentation = phasePresentation(snapshot.phase, t);
  const Icon = presentation.icon;
  const issues = snapshot.local?.issues ?? [];

  return (
    <section className="card p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${presentation.iconClass}`}>
            <Icon className={`h-5 w-5 ${snapshot.phase === "SYNCING" ? "animate-spin" : ""}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-950">{t("salesday.sync.title")}</h2>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.badgeClass}`}>
                {presentation.label}
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-slate-500">{presentation.description}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary min-h-11 justify-center"
          disabled={snapshot.phase === "SYNCING"}
          onClick={onSync}
        >
          <RefreshCw className={`h-4 w-4 ${snapshot.phase === "SYNCING" ? "animate-spin" : ""}`} />
          {t(snapshot.phase === "SYNCING" ? "salesday.sync.syncing" : "salesday.sync.syncNow")}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("salesday.sync.localOpen")} value={snapshot.local?.open ?? 0} />
        <Metric label={t("salesday.sync.serverOpen")} value={snapshot.server?.openCommandCount ?? 0} />
        <Metric label={t("salesday.sync.lastAccepted")} value={formatDateTime(snapshot.server?.lastLedgerAcceptedAt, language)} />
        <Metric label={t("salesday.sync.replicaFreshness")} value={formatDateTime(snapshot.server?.lastReplicaSyncAt, language)} />
      </div>

      {snapshot.lastError && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <span className="font-semibold">{t("salesday.sync.error")}</span> {snapshot.lastError}
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">{t("salesday.sync.attentionTitle")}</h3>
          <div className="mt-2 space-y-2">
            {issues.map((issue) => (
              <div key={issue.commandId} className="flex flex-col gap-2 rounded-xl bg-amber-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-amber-950">{issue.commandType}</p>
                  <p className="truncate text-amber-800">{issue.lastErrorMessage ?? issue.lastErrorCode ?? t("salesday.sync.unknownError")}</p>
                </div>
                <button type="button" className="btn-secondary min-h-10 shrink-0" onClick={() => onRetry(issue.commandId)}>
                  <RefreshCw className="h-4 w-4" />
                  {t("salesday.sync.retry")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">{t("salesday.sync.pendingNotice")}</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function phasePresentation(
  phase: SalesDaySyncRuntimeSnapshot["phase"],
  t: (key: TranslationKey) => string,
) {
  if (phase === "OFFLINE") return {
    icon: WifiOff,
    iconClass: "bg-slate-100 text-slate-600",
    badgeClass: "bg-slate-100 text-slate-700",
    label: t("salesday.sync.phase.offline"),
    description: t("salesday.sync.description.offline"),
  };
  if (phase === "SYNCING") return {
    icon: RefreshCw,
    iconClass: "bg-blue-50 text-blue-700",
    badgeClass: "bg-blue-100 text-blue-800",
    label: t("salesday.sync.phase.syncing"),
    description: t("salesday.sync.description.syncing"),
  };
  if (phase === "ATTENTION" || phase === "ERROR") return {
    icon: AlertTriangle,
    iconClass: "bg-amber-50 text-amber-700",
    badgeClass: "bg-amber-100 text-amber-900",
    label: t(phase === "ERROR" ? "salesday.sync.phase.error" : "salesday.sync.phase.attention"),
    description: t(phase === "ERROR" ? "salesday.sync.description.error" : "salesday.sync.description.attention"),
  };
  if (phase === "IDLE") return {
    icon: CheckCircle2,
    iconClass: "bg-emerald-50 text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-800",
    label: t("salesday.sync.phase.ready"),
    description: t("salesday.sync.description.ready"),
  };
  return {
    icon: Cloud,
    iconClass: "bg-slate-100 text-slate-600",
    badgeClass: "bg-slate-100 text-slate-700",
    label: t("salesday.sync.phase.stopped"),
    description: t("salesday.sync.description.stopped"),
  };
}

function formatDateTime(value: string | null | undefined, language: Language) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language === "nl" ? "nl-BE" : language === "fr" ? "fr-BE" : "de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
