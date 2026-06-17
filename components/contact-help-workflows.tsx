"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Play,
  Plus,
  Save,
  Send,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useWorkflow } from "@/components/workflow-provider";
import {
  ActionPointEditor,
  toEditableActionPoint,
  type EditableActionPoint,
} from "@/components/action-point-editor";
import { Avatar, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { kpiDefinitions, representatives } from "@/lib/mock-data";
import { canAccessRepresentative } from "@/lib/permissions";
import type {
  ContactMoment,
  FollowUpType,
  HelpRequest,
} from "@/lib/types";

const themeOptions = [
  "KPI-opvolging",
  "Behoefteanalyse",
  "Demonstratie",
  "Prijsverdediging",
  "Afsluiten",
  "Planning en organisatie",
];

export function ContactMomentsPage({ id, isNew }: { id?: string; isNew?: boolean }) {
  const { user } = useSession();
  const workflow = useWorkflow();
  const contacts = workflow.visibleContactMoments(user);
  const openContacts = [...contacts]
    .filter((contact) => contact.status !== "afgesloten")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const closedContacts = [...contacts]
    .filter((contact) => contact.status === "afgesloten")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (isNew) return <NewContactMoment />;
  if (id) {
    const contact = workflow.state.contactMoments.find((item) => item.id === id);
    if (!contact || !contacts.some((item) => item.id === id)) {
      return <EmptyState title="Contactmoment niet beschikbaar" description="Dit contactmoment bestaat niet of valt buiten jouw scope." />;
    }
    return <ContactMomentDetail contact={contact} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Opvolging"
        title="Contactmomenten"
        description="Korte, gerichte afstemming tussen vertegenwoordiger en verkoopleider."
        actions={["SALES_LEADER", "SUPER_ADMIN"].includes(user.role) ? (
          <Link href="/contactmomenten/nieuw" className="btn-primary"><Plus className="h-4 w-4" /> Nieuw contactmoment</Link>
        ) : undefined}
      />
      <ContactMomentSection
        eyebrow="Actuele opvolging"
        title="Nieuwe en lopende contactmomenten"
        description="Concepten, momenten die wachten op VT-input en contactmomenten in uitvoering."
        contacts={openContacts}
        emptyMessage="Er zijn momenteel geen nieuwe of lopende contactmomenten."
      />
      <ContactMomentSection
        eyebrow="Historiek"
        title="Afgesloten contactmomenten"
        description="Reeds uitgevoerde contactmomenten, met de meest recente afsluiting eerst."
        contacts={closedContacts}
        emptyMessage="Er zijn nog geen afgesloten contactmomenten."
        historical
      />
    </div>
  );
}

function ContactMomentSection({
  eyebrow,
  title,
  description,
  contacts,
  emptyMessage,
  historical = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  contacts: ContactMoment[];
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
          {contacts.length}
        </span>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {contacts.map((contact) => {
            const representative = representatives.find((item) => item.id === contact.representativeId);
            return (
              <Link key={contact.id} href={`/contactmomenten/${contact.id}`} className="card group p-5 transition hover:border-brand-200">
                <div className="flex items-start gap-4">
                  <Avatar initials={representative?.initials ?? "VT"} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-950">{representative?.firstName} {representative?.lastName}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{contact.reason}</p>
                  </div>
                  <StatusBadge status={contact.status} />
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-400">{new Date(contact.updatedAt).toLocaleDateString("nl-BE")}</span>
                  <span className="text-sm font-semibold text-brand-700 group-hover:underline">Openen</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NewContactMoment() {
  const { user } = useSession();
  const { saveContactMoment } = useWorkflow();
  const [savedId, setSavedId] = useState<string>();
  const available = representatives.filter((item) => canAccessRepresentative(user, item));
  const [form, setForm] = useState({
    representativeId: available[0]?.id ?? "",
    reason: "",
    reportedProblems: "",
    leaderThemes: [] as string[],
  });
  const [savedMode, setSavedMode] = useState<"concept" | "wacht_op_vt_input">();

  if (!["SALES_LEADER", "SUPER_ADMIN"].includes(user.role)) {
    return <EmptyState title="Geen rechten" description="Alleen een verkoopleider kan een contactmoment voorbereiden." />;
  }
  if (savedId) {
    return <SuccessCard title="Contactmoment aangemaakt" description={savedMode === "concept" ? "Het concept is bewaard en kan later worden verdergezet." : "De vertegenwoordiger kan nu vooraf KPI's en thema's toevoegen."} href={`/contactmomenten/${savedId}`} linkLabel="Contactmoment openen" />;
  }
  const valid = form.representativeId && form.reason.trim().length >= 3;
  const save = (status: "concept" | "wacht_op_vt_input") => {
    const contact = saveContactMoment({ ...form, initiatorId: user.id }, status);
    setSavedMode(status);
    setSavedId(contact.id);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink href="/contactmomenten" label="Terug naar contactmomenten" />
      <PageHeader eyebrow="Nieuw" title="Contactmoment voorbereiden" description="Leg compact vast waarom je contact opneemt en waarover je wilt afstemmen." />
      <div className="card space-y-6 p-5 sm:p-7">
        <RepresentativePicker available={available} value={form.representativeId} onChange={(representativeId) => setForm((current) => ({ ...current, representativeId }))} />
        <TextArea label="Reden contactmoment" value={form.reason} onChange={(reason) => setForm((current) => ({ ...current, reason }))} />
        <TextArea label="Gemelde problemen" value={form.reportedProblems} onChange={(reportedProblems) => setForm((current) => ({ ...current, reportedProblems }))} optional />
        <TagPicker label="Thema's die je wilt bespreken" options={themeOptions} value={form.leaderThemes} onChange={(leaderThemes) => setForm((current) => ({ ...current, leaderThemes }))} />
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={!valid} onClick={() => save("concept")} className="btn-secondary"><Save className="h-4 w-4" /> Concept bewaren</button>
          <button type="button" disabled={!valid} onClick={() => save("wacht_op_vt_input")} className="btn-primary"><Send className="h-4 w-4" /> Vraag VT-input</button>
        </div>
      </div>
    </div>
  );
}

function ContactMomentDetail({ contact }: { contact: ContactMoment }) {
  const { user } = useSession();
  const { saveContactMoment, submitContactInput } = useWorkflow();
  const representative = representatives.find((item) => item.id === contact.representativeId)!;
  const isOwnerRepresentative = user.role === "REPRESENTATIVE" && user.representativeId === contact.representativeId;
  const canManage = ["SALES_LEADER", "SUPER_ADMIN"].includes(user.role);
  const [kpis, setKpis] = useState(contact.representativeKpis);
  const [themes, setThemes] = useState(contact.representativeThemes);
  const [discussedThemes, setDiscussedThemes] = useState(contact.discussedThemes);
  const [conclusion, setConclusion] = useState(contact.conclusion);
  const [actions, setActions] = useState<EditableActionPoint[]>(
    contact.actionPoints.map(toEditableActionPoint)
  );
  const [saved, setSaved] = useState(false);

  if (saved) {
    return <SuccessCard title="Contactmoment afgesloten" description="De actiepunten staan nu automatisch in de centrale actiepuntenlijst." href="/contactmomenten" linkLabel="Naar contactmomenten" />;
  }

  const updateStatus = (status: ContactMoment["status"]) => {
    saveContactMoment({
      id: contact.id,
      representativeId: contact.representativeId,
      initiatorId: contact.ownerId,
      reason: contact.reason,
      reportedProblems: contact.reportedProblems,
      leaderThemes: contact.leaderThemes,
      representativeKpis: kpis,
      representativeThemes: themes,
      discussedThemes,
      conclusion,
      actionPoints: actions,
      sourceHelpRequestId: contact.sourceHelpRequestId,
    }, status);
    if (status === "afgesloten") setSaved(true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink href="/contactmomenten" label="Terug naar contactmomenten" />
      <PageHeader
        eyebrow="Contactmoment"
        title={`${representative.firstName} ${representative.lastName}`}
        description={contact.reason}
        actions={<StatusBadge status={contact.status} />}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="font-bold text-slate-950">Voorbereiding verkoopleider</h2>
          <InfoBlock label="Reden" value={contact.reason} />
          <InfoBlock label="Gemelde problemen" value={contact.reportedProblems || "Geen gemelde problemen"} />
          <InfoBlock label="Thema's" value={contact.leaderThemes.join(", ") || "Nog geen thema's gekozen"} />
        </section>

        {isOwnerRepresentative && contact.status === "wacht_op_vt_input" ? (
          <section className="card p-5 sm:p-6">
            <h2 className="font-bold text-slate-950">Jouw voorbereiding</h2>
            <TagPicker label="Aan welke KPI's besteed je extra aandacht?" options={kpiDefinitions} value={kpis} onChange={setKpis} />
            <TagPicker label="Welke thema's wil je bespreken?" options={themeOptions} value={themes} onChange={setThemes} />
            <button type="button" onClick={() => submitContactInput(contact.id, representative.id, kpis, themes)} className="btn-primary mt-6">
              <Send className="h-4 w-4" /> Input indienen
            </button>
          </section>
        ) : (
          <section className="card p-5 sm:p-6">
            <h2 className="font-bold text-slate-950">Input vertegenwoordiger</h2>
            <InfoBlock label="KPI's" value={contact.representativeKpis.join(", ") || "Nog geen input"} />
            <InfoBlock label="Thema's" value={contact.representativeThemes.join(", ") || "Nog geen input"} />
          </section>
        )}
      </div>

      {canManage && contact.status === "gepland" && (
        <button type="button" onClick={() => updateStatus("in_uitvoering")} className="btn-primary">
          <Play className="h-4 w-4" /> Contactmoment starten
        </button>
      )}

      {canManage && contact.status === "concept" && (
        <button type="button" onClick={() => updateStatus("wacht_op_vt_input")} className="btn-primary">
          <Send className="h-4 w-4" /> Vraag VT-input
        </button>
      )}

      {canManage && contact.status === "in_uitvoering" && (
        <section className="card space-y-6 p-5 sm:p-7">
          <h2 className="text-lg font-bold text-slate-950">Contactmoment afronden</h2>
          <TagPicker label="Besproken thema's" options={themeOptions} value={discussedThemes} onChange={setDiscussedThemes} />
          <TextArea label="Conclusie" value={conclusion} onChange={setConclusion} />
          <ActionPointEditor actions={actions} onChange={setActions} />
          <button type="button" disabled={conclusion.trim().length < 3} onClick={() => updateStatus("afgesloten")} className="btn-primary">
            <CheckCircle2 className="h-4 w-4" /> Afsluiten
          </button>
        </section>
      )}
    </div>
  );
}

export function HelpRequestsWorkflowPage({ id, isNew }: { id?: string; isNew?: boolean }) {
  const { user } = useSession();
  const workflow = useWorkflow();
  const requests = workflow.visibleHelpRequests(user);
  if (isNew) return <NewHelpRequest />;
  if (id) {
    const request = workflow.state.helpRequests.find((item) => item.id === id);
    if (!request || !requests.some((item) => item.id === id)) {
      return <EmptyState title="Hulpaanvraag niet beschikbaar" description="Deze hulpaanvraag bestaat niet of valt buiten jouw scope." />;
    }
    return <HelpRequestDetail request={request} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ondersteuning"
        title="Hulpaanvragen"
        description="Van hulpvraag naar een duidelijke en gekoppelde vervolgactie."
        actions={<Link href="/hulpaanvragen/nieuw" className="btn-primary"><Plus className="h-4 w-4" /> Nieuwe hulpaanvraag</Link>}
      />
      {requests.length === 0 ? (
        <EmptyState title="Nog geen hulpaanvragen" description="Maak een hulpaanvraag aan om ondersteuning zichtbaar en opvolgbaar te maken." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[...requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((request) => {
            const representative = representatives.find((item) => item.id === request.representativeId);
            return (
              <Link key={request.id} href={`/hulpaanvragen/${request.id}`} className="card group p-5 transition hover:border-brand-200">
                <div className="flex items-center justify-between gap-3">
                  <UrgencyBadge urgency={request.urgency} />
                  <StatusBadge status={request.status} />
                </div>
                <h2 className="mt-5 font-bold text-slate-950">{request.subject}</h2>
                <p className="mt-1 text-sm text-slate-500">{representative?.firstName} {representative?.lastName}</p>
                <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{request.desiredResult}</p>
                <p className="mt-5 text-sm font-semibold text-brand-700 group-hover:underline">Bekijken</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewHelpRequest() {
  const { user } = useSession();
  const { createHelpRequest } = useWorkflow();
  const available = representatives.filter((item) => canAccessRepresentative(user, item));
  const lockedRepresentative = user.role === "REPRESENTATIVE" ? user.representativeId : undefined;
  const [createdId, setCreatedId] = useState<string>();
  const [form, setForm] = useState({
    representativeId: lockedRepresentative ?? available[0]?.id ?? "",
    subject: "",
    difficulty: "",
    desiredResult: "",
    urgency: "normaal" as HelpRequest["urgency"],
    explanation: "",
  });
  const valid = form.representativeId && [form.subject, form.difficulty, form.desiredResult].every((value) => value.trim().length >= 3);
  const allowed = ["REPRESENTATIVE", "SALES_LEADER", "COUNTRY_MANAGER", "GROUP_MANAGER", "SUPER_ADMIN"].includes(user.role);

  if (!allowed) {
    return <EmptyState title="Geen rechten" description="Hulpaanvragen kunnen worden gestart door een vertegenwoordiger, verkoopleider of manager." />;
  }

  if (createdId) {
    return <SuccessCard title="Hulpaanvraag aangemaakt" description="De hulpvraag staat klaar voor opvolging door de verkoopleider of het management." href={`/hulpaanvragen/${createdId}`} linkLabel="Hulpaanvraag openen" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink href="/hulpaanvragen" label="Terug naar hulpaanvragen" />
      <PageHeader eyebrow="Nieuw" title="Hulp aanvragen" description="Beschrijf compact waar ondersteuning nodig is en welk resultaat je wilt bereiken." />
      <div className="card grid gap-6 p-5 sm:p-7 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <RepresentativePicker available={available} value={form.representativeId} disabled={Boolean(lockedRepresentative)} onChange={(representativeId) => setForm((current) => ({ ...current, representativeId }))} />
        </div>
        <TextInput label="Onderwerp" value={form.subject} onChange={(subject) => setForm((current) => ({ ...current, subject }))} />
        <label>
          <span className="text-sm font-bold text-slate-900">Urgentie</span>
          <select className="field mt-2" value={form.urgency} onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value as HelpRequest["urgency"] }))}>
            <option value="laag">Laag</option><option value="normaal">Normaal</option><option value="hoog">Hoog</option>
          </select>
        </label>
        <TextArea label="Moeilijkheid" value={form.difficulty} onChange={(difficulty) => setForm((current) => ({ ...current, difficulty }))} />
        <TextArea label="Gewenst resultaat" value={form.desiredResult} onChange={(desiredResult) => setForm((current) => ({ ...current, desiredResult }))} />
        <div className="lg:col-span-2">
          <TextArea label="Toelichting" value={form.explanation} onChange={(explanation) => setForm((current) => ({ ...current, explanation }))} optional />
        </div>
        <div className="lg:col-span-2 flex justify-end">
          <button type="button" disabled={!valid} onClick={() => {
            const request = createHelpRequest({ ...form, requesterId: user.id });
            setCreatedId(request.id);
          }} className="btn-primary"><CircleHelp className="h-4 w-4" /> Hulpaanvraag indienen</button>
        </div>
      </div>
    </div>
  );
}

function HelpRequestDetail({ request }: { request: HelpRequest }) {
  const { user } = useSession();
  const { planHelpFollowUp, setHelpStatus } = useWorkflow();
  const representative = representatives.find((item) => item.id === request.representativeId)!;
  const canManage = ["SALES_LEADER", "COUNTRY_MANAGER", "GROUP_MANAGER", "SUPER_ADMIN"].includes(user.role);
  const [followUp, setFollowUp] = useState<FollowUpType>(request.followUpType ?? "contactmoment");
  const [updated, setUpdated] = useState(false);
  const followUpLabels: Record<FollowUpType, string> = {
    begeleiding: "Begeleiding",
    contactmoment: "Contactmoment",
    retraining: "Retraining",
    sales_training: "Sales training",
    enkel_opvolging: "Enkel opvolging",
    geen_actie: "Geen actie",
  };

  if (updated) {
    return <SuccessCard title="Vervolgactie opgeslagen" description="De hulpaanvraag en eventuele gekoppelde interventie zijn bijgewerkt." href="/hulpaanvragen" linkLabel="Naar hulpaanvragen" />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink href="/hulpaanvragen" label="Terug naar hulpaanvragen" />
      <PageHeader eyebrow="Hulpaanvraag" title={request.subject} description={`${representative.firstName} ${representative.lastName} · ${representative.team}`} actions={<StatusBadge status={request.status} />} />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5 sm:p-7">
          <div className="flex items-center gap-3"><CircleHelp className="h-5 w-5 text-brand-700" /><h2 className="font-bold text-slate-950">De hulpvraag</h2></div>
          <InfoBlock label="Moeilijkheid" value={request.difficulty} />
          <InfoBlock label="Gewenst resultaat" value={request.desiredResult} />
          <InfoBlock label="Toelichting" value={request.explanation || "Geen extra toelichting"} />
          <div className="mt-5"><UrgencyBadge urgency={request.urgency} /></div>
        </section>
        <section className="card p-5 sm:p-7">
          <h2 className="font-bold text-slate-950">Opvolging</h2>
          {request.followUpType ? (
            <>
              <InfoBlock label="Gekozen vervolgactie" value={followUpLabels[request.followUpType]} />
              {request.linkedInterventionId && (
                <Link href={
                  request.followUpType === "contactmoment"
                    ? `/contactmomenten/${request.linkedInterventionId}`
                    : request.followUpType === "retraining"
                      ? `/retrainingen/${request.linkedInterventionId}`
                      : request.followUpType === "sales_training"
                        ? `/sales-trainingen/${request.linkedInterventionId}`
                        : `/vertegenwoordigers/${request.representativeId}`
                } className="btn-secondary mt-5 w-full">
                  Gekoppelde interventie bekijken
                </Link>
              )}
              {canManage && request.status === "vervolgactie_gepland" && (
                <button type="button" onClick={() => {
                  setHelpStatus(request.id, "afgesloten");
                  setUpdated(true);
                }} className="btn-primary mt-3 w-full">
                  <CheckCircle2 className="h-4 w-4" /> Hulpaanvraag afsluiten
                </button>
              )}
            </>
          ) : canManage ? (
            <>
              {request.status === "nieuw" && (
                <button type="button" onClick={() => setHelpStatus(request.id, "in_behandeling")} className="btn-secondary mt-4 w-full">In behandeling nemen</button>
              )}
              <label className="mt-5 block">
                <span className="text-sm font-bold text-slate-900">Kies vervolgactie</span>
                <select className="field mt-2" value={followUp} onChange={(event) => setFollowUp(event.target.value as FollowUpType)}>
                  {Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => {
                planHelpFollowUp(request.id, user.id, followUp);
                setUpdated(true);
              }} className="btn-primary mt-5 w-full"><ClipboardCheck className="h-4 w-4" /> Vervolgactie opslaan</button>
              <button type="button" onClick={() => {
                setHelpStatus(request.id, "geannuleerd");
                setUpdated(true);
              }} className="btn-secondary mt-3 w-full">Hulpaanvraag annuleren</button>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">Je verkoopleider of het management kiest hier de passende vervolgactie.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function RepresentativePicker({ available, value, onChange, disabled = false }: { available: typeof representatives; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">Vertegenwoordiger</span>
      <select disabled={disabled} className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {available.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.team}</option>)}
      </select>
    </label>
  );
}

function TagPicker({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-slate-900">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option);
          return <button type="button" key={option} onClick={() => onChange(active ? value.filter((item) => item !== option) : [...value, option])} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`}>{option}</button>;
        })}
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{label} {optional && <span className="font-normal text-slate-400">(optioneel)</span>}</span>
      <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="text-sm font-bold text-slate-900">{label}</span><input className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm leading-6 text-slate-700">{value}</p></div>;
}

function UrgencyBadge({ urgency }: { urgency: HelpRequest["urgency"] }) {
  const style = urgency === "hoog" ? "bg-rose-100 text-rose-800" : urgency === "laag" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${style}`}>{urgency}</span>;
}

function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="h-4 w-4" /> {label}</Link>;
}

function SuccessCard({ title, description, href, linkLabel }: { title: string; description: string; href: string; linkLabel: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8 text-center sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
        <h1 className="mt-6 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
        <Link href={href} className="btn-primary mt-7">{linkLabel}</Link>
      </div>
    </div>
  );
}
