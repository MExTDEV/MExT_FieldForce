"use client";

import { useEffect, useState } from "react";
import { translate } from "@/lib/i18n";
import type { Country, ImpersonationHistoryRecord, Language, ManagedUser } from "@/lib/types";

export function ImpersonationHistory({ language, users }: { language: Language; users: ManagedUser[] }) {
  const [sessions, setSessions] = useState<ImpersonationHistoryRecord[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", actorUserId: "", impersonatedUserId: "", country: "", teamId: "", status: "", reasonType: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    setLoading(true);
    setError(undefined);
    void fetch(`/api/admin/impersonation-history?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { sessions?: ImpersonationHistoryRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? translate(language, "impersonation.history.error"));
        setSessions(payload.sessions ?? []);
      })
      .catch((cause) => { if (cause instanceof Error && cause.name !== "AbortError") setError(cause.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, language]);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-amber-50/70 p-5">
        <h2 className="font-bold text-slate-950">{translate(language, "impersonation.history.title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{translate(language, "impersonation.history.description")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="field" type="date" aria-label={translate(language, "impersonation.history.from")} value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          <input className="field" type="date" aria-label={translate(language, "impersonation.history.to")} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          <select className="field" aria-label={translate(language, "impersonation.history.actor")} value={filters.actorUserId} onChange={(event) => setFilters({ ...filters, actorUserId: event.target.value })}>
            <option value="">{translate(language, "impersonation.history.allActors")}</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}
          </select>
          <select className="field" aria-label={translate(language, "impersonation.history.target")} value={filters.impersonatedUserId} onChange={(event) => setFilters({ ...filters, impersonatedUserId: event.target.value })}>
            <option value="">{translate(language, "impersonation.history.allTargets")}</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}
          </select>
          <select className="field" aria-label={translate(language, "impersonation.history.country")} value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })}>
            <option value="">{translate(language, "impersonation.history.allCountries")}</option>
            {(["BE", "NL", "DE"] as Country[]).map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
          <select className="field" aria-label={translate(language, "impersonation.history.team")} value={filters.teamId} onChange={(event) => setFilters({ ...filters, teamId: event.target.value })}>
            <option value="">{translate(language, "impersonation.history.allTeams")}</option>
            {[...new Map(users.filter((user) => user.teamId).map((user) => [user.teamId, user.teamName || user.teamId])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select className="field" aria-label={translate(language, "impersonation.history.status")} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">{translate(language, "impersonation.history.allStatuses")}</option>
            <option value="ACTIVE">{translate(language, "impersonation.history.active")}</option>
            <option value="ENDED">{translate(language, "impersonation.history.ended")}</option>
          </select>
          <select className="field" aria-label={translate(language, "impersonation.reason")} value={filters.reasonType} onChange={(event) => setFilters({ ...filters, reasonType: event.target.value })}>
            <option value="">{translate(language, "impersonation.history.allReasons")}</option>
            {(["USER_SUPPORT", "REPRODUCE_ERROR", "CHECK_PERMISSIONS", "FUNCTIONAL_TEST", "OTHER"] as const).map((reason) => <option key={reason} value={reason}>{translate(language, `impersonation.reason.${reason}` as Parameters<typeof translate>[1])}</option>)}
          </select>
        </div>
      </div>
      {error ? <p className="p-5 text-sm font-semibold text-rose-700">{error}</p> : loading ? <p className="p-5 text-sm text-slate-500">{translate(language, "impersonation.history.loading")}</p> : sessions.length === 0 ? <p className="p-5 text-sm text-slate-500">{translate(language, "impersonation.history.empty")}</p> : (
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">{translate(language, "impersonation.history.date")}</th><th className="px-4 py-3">{translate(language, "impersonation.history.actor")}</th><th className="px-4 py-3">{translate(language, "impersonation.history.target")}</th><th className="px-4 py-3">{translate(language, "impersonation.history.scope")}</th><th className="px-4 py-3">{translate(language, "impersonation.reason")}</th><th className="px-4 py-3">{translate(language, "impersonation.history.duration")}</th><th className="px-4 py-3">{translate(language, "impersonation.history.status")}</th></tr></thead><tbody className="divide-y divide-slate-100">{sessions.map((session) => <tr key={session.id}><td className="whitespace-nowrap px-4 py-3">{new Date(session.startedAt).toLocaleString()}</td><td className="px-4 py-3 font-semibold">{session.actorName}</td><td className="px-4 py-3">{session.impersonatedUserName}</td><td className="px-4 py-3">{session.country}{session.teamName ? ` · ${session.teamName}` : ""}</td><td className="px-4 py-3">{translate(language, `impersonation.reason.${session.reasonType}` as Parameters<typeof translate>[1])}{session.reasonText ? ` · ${session.reasonText}` : ""}</td><td className="px-4 py-3">{Math.max(1, Math.round(session.durationSeconds / 60))} min</td><td className="px-4 py-3">{session.endedAt ? translate(language, "impersonation.history.ended") : translate(language, "impersonation.history.active")}</td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}
