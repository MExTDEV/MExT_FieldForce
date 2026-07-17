"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/session-provider";
import { useSalesDayDeviceRuntime } from "@/components/salesday/device-runtime-provider";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

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
type JsonPayload = {
  appointments?: AgendaAppointment[];
  members?: TeamMember[];
  documents?: SalesDocument[];
};
type JsonState = { loading: boolean; error: string | null; value: JsonPayload | null };

export function SalesDayWorkspace({ section, appointmentId }: { section?: string; appointmentId?: string }) {
  const { user } = useSession();
  const runtime = useSalesDayDeviceRuntime();
  const [state, setState] = useState<JsonState>({ loading: true, error: null, value: null });
  const isRepresentative = user.role === "REPRESENTATIVE";
  const title = section === "mijn-voorbereiding"
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
    const endpoint = section === "mijn-voorbereiding"
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
  }, [appointmentId, isRepresentative, runtime.deviceId, runtime.phase, section, user.id]);

  const appointments = useMemo(() => state.value?.appointments ?? [], [state.value]);
  if (isRepresentative && runtime.phase !== "READY") {
    return <EmptyState title="SalesDay-toestel wordt voorbereid" description={runtime.error ?? "Een actief toestel is vereist voordat je agenda kan openen."} />;
  }
  if (state.loading) return <EmptyState title={`${title} laden`} description="De actuele SalesDay-gegevens worden opgehaald." />;
  if (state.error) return <EmptyState title={`${title} kon niet worden geladen`} description={state.error} />;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="SalesDay" title={title} description="ERP-volgorde en server-afgedwongen scope blijven leidend." />
      <nav className="flex flex-wrap gap-2" aria-label="SalesDay">
        <Link className="btn-secondary" href="/salesday/mijn-voorbereiding">Voorbereiding</Link>
        <Link className="btn-secondary" href="/salesday/mijn-agenda">Mijn agenda</Link>
        {!isRepresentative && <Link className="btn-secondary" href="/salesday/mijn-team">Mijn Team</Link>}
        {isRepresentative && <Link className="btn-secondary" href="/salesday/dagafsluiting">Dagafsluiting</Link>}
      </nav>
      {section === "mijn-team"
        ? <TeamSummary members={state.value?.members ?? []} />
        : section === "mijn-voorbereiding"
          ? <PreparationSummary preparations={state.value?.appointments ?? []} />
          : section === "documenten"
            ? <DocumentSummary documents={state.value?.documents ?? []} appointmentId={appointmentId} />
            : <AgendaSummary appointments={appointments} appointmentId={appointmentId} />}
    </div>
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
