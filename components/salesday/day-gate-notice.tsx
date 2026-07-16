"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

import { translate, type TranslationKey } from "@/lib/i18n";
import type { SalesDayEffectiveDayGate } from "@/lib/salesday/day-access";
import type { Language } from "@/lib/types";

export function SalesDayDayGateNotice({
  gate,
  language,
}: {
  gate: SalesDayEffectiveDayGate;
  language: Language;
}) {
  const t = (key: TranslationKey) => translate(language, key);
  if (gate.mode === "NORMAL") return null;
  if (gate.mode === "EMERGENCY" && gate.emergency) {
    return (
      <section className="card border-amber-300 bg-amber-50 p-4 sm:p-5" role="status">
        <div className="flex gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-amber-950">{t("salesday.dayGate.emergencyTitle")}</h2>
            <p className="mt-1 text-sm leading-5 text-amber-900">{t("salesday.dayGate.emergencyDescription")}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <GateDetail label={t("salesday.dayGate.reason")} value={gate.emergency.reason} />
              <GateDetail label={t("salesday.dayGate.until")} value={formatDateTime(gate.emergency.endsAt, language)} />
            </dl>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="card border-rose-300 bg-rose-50 p-4 sm:p-5" role="alert">
      <div className="flex gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-rose-950">{t("salesday.dayGate.blockedTitle")}</h2>
          <p className="mt-1 text-sm leading-5 text-rose-900">{t("salesday.dayGate.blockedDescription")}</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <GateDetail label={t("salesday.dayGate.localPending")} value={String(gate.localOpenPreviousCommandCount)} />
            <GateDetail label={t("salesday.dayGate.serverPending")} value={String(gate.serverOpenPreviousCommandCount)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/salesday/sync" className="btn-primary min-h-11">
              <RefreshCw className="h-4 w-4" />
              {t("salesday.dayGate.openSync")}
            </Link>
            <Link href="/salesday/support" className="btn-secondary min-h-11">
              {t("salesday.dayGate.openSupport")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function GateDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <dt className="text-xs font-medium opacity-70">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "nl" ? "nl-BE" : language === "fr" ? "fr-BE" : "de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
