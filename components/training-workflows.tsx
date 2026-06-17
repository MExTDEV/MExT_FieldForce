"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Play,
  Plus,
  Save,
  Sparkles,
} from "lucide-react";
import { ActionPointEditor, toEditableActionPoint, type EditableActionPoint } from "@/components/action-point-editor";
import { useSession } from "@/components/session-provider";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { useWorkflow } from "@/components/workflow-provider";
import { coachingFramework, kpiDefinitions, representatives } from "@/lib/mock-data";
import { canAccessRepresentative } from "@/lib/permissions";
import type { Retraining, SalesTraining, TrainingStatus } from "@/lib/types";

type TrainingKind = "retraining" | "sales_training";

const trainingStatusOrder: TrainingStatus[] = [
  "concept",
  "gepland",
  "in_uitvoering",
  "afgerond",
  "geannuleerd",
];

function canInitiate(role: string) {
  return ["REPRESENTATIVE", "SALES_LEADER", "COUNTRY_MANAGER", "GROUP_MANAGER", "SUPER_ADMIN"].includes(role);
}

export function TrainingWorkflowPage({
  kind,
  id,
  isNew,
}: {
  kind: TrainingKind;
  id?: string;
  isNew?: boolean;
}) {
  const { user } = useSession();
  const workflow = useWorkflow();
  const items = kind === "retraining"
    ? workflow.visibleRetrainings(user)
    : workflow.visibleSalesTrainings(user);

  if (isNew) {
    if (!canInitiate(user.role)) {
      return <EmptyState title="Geen toegang" description="Je rol kan geen training starten." />;
    }
    return kind === "retraining" ? <RetrainingEditor /> : <SalesTrainingEditor />;
  }

  if (id) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) {
      return <EmptyState title="Training niet beschikbaar" description="Deze training bestaat niet of valt buiten jouw scope." />;
    }
    return kind === "retraining"
      ? <RetrainingEditor record={item as Retraining} />
      : <SalesTrainingEditor record={item as SalesTraining} />;
  }

  return <TrainingList kind={kind} />;
}

function TrainingList({ kind }: { kind: TrainingKind }) {
  const { user } = useSession();
  const { visibleRetrainings, visibleSalesTrainings } = useWorkflow();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const isRetraining = kind === "retraining";
  const items = isRetraining ? visibleRetrainings(user) : visibleSalesTrainings(user);
  const basePath = isRetraining ? "/retrainingen" : "/sales-trainingen";
  const filtered = items.filter((item) => {
    const haystack = isRetraining
      ? `${(item as Retraining).theme} ${(item as Retraining).trainer}`
      : `${(item as SalesTraining).theme} ${(item as SalesTraining).trainer} ${(item as SalesTraining).targetAudience}`;
    return (status === "all" || item.status === status) &&
      haystack.toLowerCase().includes(query.toLowerCase());
  });
  const plannedItems = filtered
    .filter((item) => !["afgerond", "geannuleerd"].includes(item.status))
    .sort((left, right) => trainingTimestamp(left.date) - trainingTimestamp(right.date));
  const completedItems = filtered
    .filter((item) => ["afgerond", "geannuleerd"].includes(item.status))
    .sort((left, right) => trainingTimestamp(right.date) - trainingTimestamp(left.date));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leren en ontwikkelen"
        title={isRetraining ? "Retrainingen" : "Sales trainingen"}
        description={isRetraining
          ? "Gerichte individuele heropleiding met concrete verbetering en opvolging."
          : "Groepsopleidingen plannen, deelnemers beheren en opvolgacties vastleggen."}
        actions={canInitiate(user.role) ? (
          <Link href={`${basePath}/nieuw`} className="btn-primary">
            <Plus className="h-4 w-4" /> Nieuw
          </Link>
        ) : undefined}
      />
      <div className="card grid gap-3 p-4 md:grid-cols-[1fr_220px]">
        <input
          className="field"
          placeholder="Zoek op thema, trainer of doelgroep..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Alle statussen</option>
          {trainingStatusOrder.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <TrainingSection
        eyebrow="Komende planning"
        title={`Geplande ${isRetraining ? "retrainingen" : "sales trainingen"}`}
        description="Chronologisch volgens het eerstvolgende uitvoeringsmoment."
        items={plannedItems}
        isRetraining={isRetraining}
        basePath={basePath}
        emptyMessage={`Er zijn momenteel geen geplande ${isRetraining ? "retrainingen" : "sales trainingen"}.`}
      />
      <TrainingSection
        eyebrow="Historiek"
        title={`Afgeronde ${isRetraining ? "retrainingen" : "sales trainingen"}`}
        description="Meest recent uitgevoerde training eerst."
        items={completedItems}
        isRetraining={isRetraining}
        basePath={basePath}
        emptyMessage={`Er zijn nog geen afgeronde ${isRetraining ? "retrainingen" : "sales trainingen"}.`}
        historical
      />
    </div>
  );
}

function TrainingSection({
  eyebrow,
  title,
  description,
  items,
  isRetraining,
  basePath,
  emptyMessage,
  historical = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: (Retraining | SalesTraining)[];
  isRetraining: boolean;
  basePath: string;
  emptyMessage: string;
  historical?: boolean;
}) {
  return (
    <section className={`space-y-4 ${historical ? "border-t border-slate-200 pt-6" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">{eyebrow}</p>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${historical ? "bg-slate-100 text-slate-700" : "bg-brand-50 text-brand-700"}`}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const retraining = isRetraining ? item as Retraining : undefined;
            const salesTraining = !isRetraining ? item as SalesTraining : undefined;
            const representative = retraining
              ? representatives.find((person) => person.id === retraining.representativeId)
              : undefined;
            return (
              <Link key={item.id} href={`${basePath}/${item.id}`} className="card group p-5 transition hover:-translate-y-0.5 hover:border-brand-100">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    {isRetraining ? <GraduationCap className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-950">{item.theme}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {retraining
                        ? `${representative?.firstName ?? ""} ${representative?.lastName ?? ""}`
                        : `${salesTraining?.participantIds.length ?? 0} deelnemers · ${salesTraining?.targetAudience}`}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDate(item.date)}</span>
                  <span>Trainer: {item.trainer || "Nog te bepalen"}</span>
                  {item.sourceHelpRequestId && <span className="font-semibold text-brand-700">Via hulpaanvraag</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RetrainingEditor({ record }: { record?: Retraining }) {
  const { user } = useSession();
  const { saveRetraining } = useWorkflow();
  const available = representatives.filter((item) => canAccessRepresentative(user, item));
  const initialRepresentative = record?.representativeId ?? user.representativeId ?? available[0]?.id ?? "";
  const [form, setForm] = useState({
    representativeId: initialRepresentative,
    theme: record?.theme ?? "",
    reason: record?.reason ?? "",
    desiredImprovement: record?.desiredImprovement ?? "",
    kpi: record?.kpi ?? "",
    frameworkPhase: record?.frameworkPhase ?? "",
    date: record?.date ?? new Date().toISOString().slice(0, 10),
    trainer: record?.trainer ?? user.name,
    result: record?.result ?? "",
  });
  const [actions, setActions] = useState<EditableActionPoint[]>(record?.actionPoints.map(toEditableActionPoint) ?? []);
  const [current, setCurrent] = useState(record);
  const [message, setMessage] = useState("");
  const canEdit = !current || (
    !["afgerond", "geannuleerd"].includes(current.status) &&
    (user.role !== "REPRESENTATIVE" || current.initiatorId === user.id)
  );

  function persist(status: TrainingStatus) {
    if (!form.representativeId || form.theme.trim().length < 3 || form.reason.trim().length < 3 || form.desiredImprovement.trim().length < 3) {
      setMessage("Vul vertegenwoordiger, thema, reden en gewenste verbetering in.");
      return;
    }
    if (status !== "concept" && (!form.date || !form.trainer.trim())) {
      setMessage("Datum en trainer zijn verplicht om te plannen.");
      return;
    }
    if (status === "afgerond" && form.result.trim().length < 3) {
      setMessage("Vul eerst het resultaat van de retraining in.");
      return;
    }
    const saved = saveRetraining({
      id: current?.id,
      initiatorId: current?.initiatorId ?? user.id,
      ...form,
      actionPoints: actions,
      sourceHelpRequestId: current?.sourceHelpRequestId,
    }, status);
    setCurrent(saved);
    setMessage(status === "afgerond"
      ? "Retraining afgerond. De actiepunten staan in de centrale opvolging."
      : "Retraining opgeslagen.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink href="/retrainingen" label="Terug naar retrainingen" />
      <PageHeader
        eyebrow={current ? "Retraining" : "Nieuwe retraining"}
        title={current?.theme || "Individuele heropleiding"}
        description="Leg de ontwikkelbehoefte, planning, het resultaat en concrete opvolging compact vast."
        actions={current ? <StatusBadge status={current.status} /> : undefined}
      />
      {current?.sourceHelpRequestId && <SourceHelpRequest id={current.sourceHelpRequestId} />}
      {message && <Notice message={message} />}
      <fieldset disabled={!canEdit} className="grid gap-5 lg:grid-cols-2 disabled:opacity-80">
        <section className="card space-y-5 p-5 sm:p-7">
          <SectionHeading title="Voorbereiding" description="Wie krijgt de retraining en waarom?" />
          <SelectField label="Vertegenwoordiger" value={form.representativeId} onChange={(representativeId) => setForm({ ...form, representativeId })}>
            {available.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.team}</option>)}
          </SelectField>
          <TextField label="Thema" value={form.theme} onChange={(theme) => setForm({ ...form, theme })} />
          <TextArea label="Reden" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} />
          <TextArea label="Gewenste verbetering" value={form.desiredImprovement} onChange={(desiredImprovement) => setForm({ ...form, desiredImprovement })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Gekoppelde KPI" optional value={form.kpi} onChange={(kpi) => setForm({ ...form, kpi })}>
              <option value="">Geen KPI</option>
              {kpiDefinitions.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <SelectField label="Kapstokfase" optional value={form.frameworkPhase} onChange={(frameworkPhase) => setForm({ ...form, frameworkPhase })}>
              <option value="">Geen fase</option>
              {coachingFramework.map((item) => <option key={item.name}>{item.name}</option>)}
            </SelectField>
          </div>
        </section>
        <section className="card space-y-5 p-5 sm:p-7">
          <SectionHeading title="Uitvoering en resultaat" description="Plan de sessie en leg na uitvoering het resultaat vast." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Datum" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
            <TextField label="Trainer / begeleider" value={form.trainer} onChange={(trainer) => setForm({ ...form, trainer })} />
          </div>
          <TextArea label="Resultaat" optional value={form.result} onChange={(result) => setForm({ ...form, result })} />
          <ActionPointEditor
            actions={actions}
            onChange={setActions}
            description="Bij afronden worden deze automatisch zichtbaar in de centrale actiepuntenmodule."
          />
        </section>
      </fieldset>
      {canEdit && (
        <StatusActions
          status={current?.status}
          onSave={() => persist(current?.status ?? "concept")}
          onConcept={() => persist("concept")}
          onPlan={() => persist("gepland")}
          onStart={() => persist("in_uitvoering")}
          onComplete={() => persist("afgerond")}
          onCancel={() => persist("geannuleerd")}
        />
      )}
    </div>
  );
}

function SalesTrainingEditor({ record }: { record?: SalesTraining }) {
  const { user } = useSession();
  const { saveSalesTraining } = useWorkflow();
  const scoped = representatives.filter((item) => canAccessRepresentative(user, item));
  const initialParticipants = record?.participantIds ?? (user.representativeId ? [user.representativeId] : []);
  const [form, setForm] = useState({
    theme: record?.theme ?? "",
    reason: record?.reason ?? "",
    targetAudience: record?.targetAudience ?? "",
    participantIds: initialParticipants,
    kpi: record?.kpi ?? "",
    frameworkPhase: record?.frameworkPhase ?? "",
    date: record?.date ?? new Date().toISOString().slice(0, 10),
    trainer: record?.trainer ?? user.name,
    conclusion: record?.conclusion ?? "",
    followUpAction: record?.followUpAction ?? "",
    createIndividualActions: record?.createIndividualActions ?? false,
    createGroupAction: record?.createGroupAction ?? false,
    actionDue: record?.actionDue ?? "",
  });
  const [filters, setFilters] = useState({ country: "", team: "", level: "" });
  const [current, setCurrent] = useState(record);
  const [message, setMessage] = useState("");
  const canEdit = !current || (
    !["afgerond", "geannuleerd"].includes(current.status) &&
    (user.role !== "REPRESENTATIVE" || current.initiatorId === user.id)
  );
  const countries = [...new Set(scoped.map((item) => item.country))];
  const teams = [...new Set(scoped.filter((item) => !filters.country || item.country === filters.country).map((item) => item.team))];
  const levels = [...new Set(scoped.map((item) => item.level))];
  const filteredParticipants = scoped.filter((item) =>
    (!filters.country || item.country === filters.country) &&
    (!filters.team || item.team === filters.team) &&
    (!filters.level || item.level === filters.level)
  );

  function toggleParticipant(id: string) {
    setForm((value) => ({
      ...value,
      participantIds: value.participantIds.includes(id)
        ? value.participantIds.filter((participantId) => participantId !== id)
        : [...value.participantIds, id],
    }));
  }

  function persist(status: TrainingStatus) {
    if (form.theme.trim().length < 3 || form.reason.trim().length < 3 || form.targetAudience.trim().length < 2 || form.participantIds.length === 0) {
      setMessage("Vul thema, reden en doelgroep in en selecteer minstens één deelnemer.");
      return;
    }
    if (status !== "concept" && (!form.date || !form.trainer.trim())) {
      setMessage("Datum en trainer zijn verplicht om te plannen.");
      return;
    }
    if (status === "afgerond" && form.conclusion.trim().length < 3) {
      setMessage("Vul eerst de conclusie van de sales training in.");
      return;
    }
    if (status === "afgerond" && (form.createIndividualActions || form.createGroupAction) && form.followUpAction.trim().length < 3) {
      setMessage("Beschrijf de opvolgactie voordat je actiepunten aanmaakt.");
      return;
    }
    try {
      const saved = saveSalesTraining({
        id: current?.id,
        initiatorId: current?.initiatorId ?? user.id,
        ...form,
        sourceHelpRequestId: current?.sourceHelpRequestId,
      }, status);
      setCurrent(saved);
      setMessage(status === "afgerond"
        ? "Sales training afgerond. Tijdlijnen en gekozen actiepunten zijn bijgewerkt."
        : "Sales training opgeslagen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opslaan is niet gelukt.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackLink href="/sales-trainingen" label="Terug naar sales trainingen" />
      <PageHeader
        eyebrow={current ? "Sales training" : "Nieuwe sales training"}
        title={current?.theme || "Groepsopleiding"}
        description="Selecteer de juiste deelnemers, plan de training en leg conclusie en opvolging vast."
        actions={current ? <StatusBadge status={current.status} /> : undefined}
      />
      {current?.sourceHelpRequestId && <SourceHelpRequest id={current.sourceHelpRequestId} />}
      {message && <Notice message={message} />}
      <fieldset disabled={!canEdit} className="grid gap-5 xl:grid-cols-[0.95fr_1.3fr] disabled:opacity-80">
        <section className="card space-y-5 p-5 sm:p-7">
          <SectionHeading title="Training" description="Inhoud, doelgroep en planning." />
          <TextField label="Thema" value={form.theme} onChange={(theme) => setForm({ ...form, theme })} />
          <TextArea label="Reden" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} />
          <TextField label="Doelgroep" value={form.targetAudience} onChange={(targetAudience) => setForm({ ...form, targetAudience })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Gekoppelde KPI" optional value={form.kpi} onChange={(kpi) => setForm({ ...form, kpi })}>
              <option value="">Geen KPI</option>
              {kpiDefinitions.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <SelectField label="Kapstokfase" optional value={form.frameworkPhase} onChange={(frameworkPhase) => setForm({ ...form, frameworkPhase })}>
              <option value="">Geen fase</option>
              {coachingFramework.map((item) => <option key={item.name}>{item.name}</option>)}
            </SelectField>
            <TextField label="Datum" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
            <TextField label="Trainer" value={form.trainer} onChange={(trainer) => setForm({ ...form, trainer })} />
          </div>
        </section>
        <section className="card p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <SectionHeading title="Deelnemers" description="Filter op land, team en niveau; selecteer daarna één of meer vertegenwoordigers." />
            <span className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700">
              {form.participantIds.length} geselecteerd
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <select className="field" value={filters.country} onChange={(event) => setFilters({ country: event.target.value, team: "", level: filters.level })}>
              <option value="">Alle landen</option>
              {countries.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="field" value={filters.team} onChange={(event) => setFilters({ ...filters, team: event.target.value })}>
              <option value="">Alle teams</option>
              {teams.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="field" value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })}>
              <option value="">Alle niveaus</option>
              {levels.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {filteredParticipants.map((item) => {
              const selected = form.participantIds.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggleParticipant(item.id)}
                  className={`flex min-h-16 items-center justify-between rounded-2xl border p-4 text-left transition ${
                    selected ? "border-brand-700 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{item.firstName} {item.lastName}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.team} · {item.level}</span>
                  </span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full border ${selected ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300"}`}>
                    {selected && <CheckCircle2 className="h-4 w-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="card space-y-5 p-5 sm:p-7 xl:col-span-2">
          <SectionHeading title="Conclusie en opvolging" description="Deze velden worden bij afronden gebruikt voor tijdlijnen en optionele actiepunten." />
          <div className="grid gap-5 lg:grid-cols-2">
            <TextArea label="Conclusie" optional value={form.conclusion} onChange={(conclusion) => setForm({ ...form, conclusion })} />
            <TextArea label="Opvolgactie" optional value={form.followUpAction} onChange={(followUpAction) => setForm({ ...form, followUpAction })} />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px]">
            <CheckOption
              label="Actiepunt per deelnemer"
              checked={form.createIndividualActions}
              onChange={(createIndividualActions) => setForm({ ...form, createIndividualActions })}
            />
            <CheckOption
              label="Eén groepsactiepunt"
              checked={form.createGroupAction}
              onChange={(createGroupAction) => setForm({ ...form, createGroupAction })}
            />
            <TextField label="Deadline actiepunten" type="date" value={form.actionDue} onChange={(actionDue) => setForm({ ...form, actionDue })} />
          </div>
        </section>
      </fieldset>
      {canEdit && (
        <StatusActions
          status={current?.status}
          onSave={() => persist(current?.status ?? "concept")}
          onConcept={() => persist("concept")}
          onPlan={() => persist("gepland")}
          onStart={() => persist("in_uitvoering")}
          onComplete={() => persist("afgerond")}
          onCancel={() => persist("geannuleerd")}
        />
      )}
    </div>
  );
}

function StatusActions({
  status,
  onSave,
  onConcept,
  onPlan,
  onStart,
  onComplete,
  onCancel,
}: {
  status?: TrainingStatus;
  onSave: () => void;
  onConcept: () => void;
  onPlan: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-20 z-20 flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-card backdrop-blur lg:bottom-4">
      {!status && <button type="button" onClick={onConcept} className="btn-secondary"><Save className="h-4 w-4" /> Concept bewaren</button>}
      {status && <button type="button" onClick={onSave} className="btn-secondary"><Save className="h-4 w-4" /> Wijzigingen bewaren</button>}
      {(!status || status === "concept") && <button type="button" onClick={onPlan} className="btn-primary"><CalendarDays className="h-4 w-4" /> Plannen</button>}
      {status === "gepland" && <button type="button" onClick={onStart} className="btn-primary"><Play className="h-4 w-4" /> Start uitvoering</button>}
      {status === "in_uitvoering" && <button type="button" onClick={onComplete} className="btn-primary"><CheckCircle2 className="h-4 w-4" /> Afronden</button>}
      {status && !["afgerond", "geannuleerd"].includes(status) && <button type="button" onClick={onCancel} className="btn-secondary text-rose-700">Annuleren</button>}
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> {label}</Link>;
}

function SourceHelpRequest({ id }: { id: string }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
      <div><p className="font-bold text-blue-950">Gekoppeld aan een hulpaanvraag</p><p className="mt-1 text-sm text-blue-800">De voorbereiding werd automatisch overgenomen uit de oorspronkelijke hulpvraag.</p></div>
      <Link href={`/hulpaanvragen/${id}`} className="btn-secondary shrink-0 border-blue-200">Hulpaanvraag bekijken</Link>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h2 className="font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>;
}

function Notice({ message }: { message: string }) {
  return <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm font-semibold text-brand-800">{message}</div>;
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="text-sm font-bold text-slate-900">{label}</span><input className="field mt-2" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  return <label className="block"><span className="text-sm font-bold text-slate-900">{label} {optional && <span className="font-normal text-slate-400">(optioneel)</span>}</span><textarea rows={4} className="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, onChange, children, optional = false }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; optional?: boolean }) {
  return <label className="block"><span className="text-sm font-bold text-slate-900">{label} {optional && <span className="font-normal text-slate-400">(optioneel)</span>}</span><select className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-4 ${checked ? "border-brand-700 bg-brand-50" : "border-slate-200"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#003B83]" />
      <span className="text-sm font-bold text-slate-900">{label}</span>
    </label>
  );
}

function formatDate(value: string) {
  if (!value) return "Nog niet gepland";
  return new Date(`${value}T12:00:00`).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
}

function trainingTimestamp(value: string) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}
