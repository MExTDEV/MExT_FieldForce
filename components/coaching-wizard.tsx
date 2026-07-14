"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Info,
  ListChecks,
  Save,
  Target,
  UserRound,
} from "lucide-react";
import { ActionPointEditor, type EditableActionPoint } from "@/components/action-point-editor";
import { PerformanceWheel } from "@/components/charts/PerformanceWheel";
import { Avatar, EmptyState, PageHeader, Trend } from "@/components/ui";
import { useConfiguration } from "@/components/configuration-provider";
import { useModules } from "@/components/module-provider";
import { usePersonalCriteria } from "@/components/personal-criteria-provider";
import { usePerformance } from "@/components/performance-provider";
import { useRepresentatives } from "@/components/representatives-provider";
import { useSession } from "@/components/session-provider";
import { useWorkflow } from "@/components/workflow-provider";
import { coachingsForRepresentative, latestHistoricalCoaching } from "@/lib/performance-data";
import { getPerformanceWheelData, type PerformanceWheelCriterion } from "@/lib/performance/performance-wheel";
import { canEditFutureCoachingPlanning } from "@/lib/coaching/access";
import { canCreateCoachingIntervention } from "@/lib/permissions";
import { translate } from "@/lib/i18n";
import {
  isPeerCoachingRepresentativeLevel,
  representativeLevelBadgeClass,
  representativeLevelLabels,
} from "@/lib/representative-levels";
import { offlineStorageKeys, saveLocalDraft } from "@/lib/storage";
import type { CoachingFrameworkFocus, CoachingParticipant, Representative, ScoreValue } from "@/lib/types";

type ScoreCriterion = {
  key: string;
  focus: string;
  criterion: string;
  previousScore: number;
  kind: "fixed" | "personal";
  criterionId?: string;
  description?: string;
};

type Draft = {
  id?: string;
  representativeId: string;
  ownerId: string;
  plannedDate: string;
  startTime: string;
  endTime: string;
  notifyRepresentative: boolean;
  notifyCoachedRepresentative: boolean;
  notifyCoachedTeamLeaders: boolean;
  notifyExecutorTeamLeaders: boolean;
  deviationReason: string;
  focusNames: string[];
  scores: Record<string, ScoreValue>;
  actions: EditableActionPoint[];
};

const wizardSteps = [
  { id: "representative", label: "Vertegenwoordiger" },
  { id: "focus", label: "Focusfasen" },
  { id: "preparation", label: "Voorbereiding" },
  { id: "summary", label: "Afronden" },
] as const;

type WizardStep = (typeof wizardSteps)[number]["id"];

export function CoachingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const helpRequestId = searchParams.get("helpRequestId");
  const { user, managedUsers } = useSession();
  const { hydrated, state, saveCoachingStatus, scheduleHelpRequestCoaching } = useWorkflow();
  const { isModuleEnabled } = useModules();
  const { representatives } = useRepresentatives();
  const [participants, setParticipants] = useState<CoachingParticipant[]>([]);
  const existing = editId ? state.interventions.find((item) => item.id === editId && item.status === "gepland") : undefined;
  const [step, setStep] = useState<WizardStep>("representative");
  const [draft, setDraft] = useState<Draft>({
    representativeId: "",
    ownerId: user.id,
    plannedDate: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "11:00",
    notifyRepresentative: false,
    notifyCoachedRepresentative: false,
    notifyCoachedTeamLeaders: false,
    notifyExecutorTeamLeaders: false,
    deviationReason: "",
    focusNames: [],
    scores: {},
    actions: [],
  });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const editMissing = Boolean(editId && hydrated && !existing);
  const editForbidden = Boolean(existing && !canEditFutureCoachingPlanning(user, existing));
  const sourceHelpRequest = helpRequestId ? state.helpRequests.find((item) => item.id === helpRequestId) : undefined;
  const helpRequestMissing = Boolean(helpRequestId && hydrated && !sourceHelpRequest);
  const helpRequestHandled = Boolean(sourceHelpRequest && (
    sourceHelpRequest.linkedInterventionId ||
    sourceHelpRequest.followUpType ||
    !["open", "nieuw", "in_behandeling"].includes(sourceHelpRequest.status)
  ));

  useEffect(() => {
    let active = true;
    fetch(`/api/coaching-participants?actorId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { participants?: CoachingParticipant[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Begeleidbare personen konden niet worden geladen.");
        if (!active) return;
        setParticipants(payload.participants ?? []);
        setDraft((current) => ({ ...current, representativeId: current.representativeId || payload.participants?.[0]?.id || "" }));
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Begeleidbare personen konden niet worden geladen."));
    return () => { active = false; };
  }, [user.id]);

  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setDraft({
      id: existing.id,
      representativeId: existing.representativeId,
      ownerId: existing.ownerId,
      plannedDate: existing.plannedDate ?? new Date().toISOString().slice(0, 10),
      startTime: existing.startTime ?? "09:00",
      endTime: existing.endTime ?? "11:00",
      notifyRepresentative: existing.notifyRepresentative ?? false,
      notifyCoachedRepresentative: existing.notifyCoachedRepresentative ?? false,
      notifyCoachedTeamLeaders: existing.notifyCoachedTeamLeaders ?? false,
      notifyExecutorTeamLeaders: existing.notifyExecutorTeamLeaders ?? false,
      deviationReason: existing.deviationReason ?? "",
      focusNames: existing.focusNames,
      scores: {},
      actions: [],
    });
    setLoadedId(existing.id);
  }, [existing, loadedId]);

  useEffect(() => {
    if (!sourceHelpRequest) return;
    setDraft((current) => ({
      ...current,
      representativeId: sourceHelpRequest.representativeId,
    }));
  }, [sourceHelpRequest]);

  const selectedParticipant = participants.find((item) => item.id === draft.representativeId);
  const selectableParticipants = sourceHelpRequest
    ? participants.filter((item) => item.id === sourceHelpRequest.representativeId)
    : participants;
  const selectedOwner = managedUsers.find((item) => item.id === draft.ownerId);
  const teamDeviation = Boolean(selectedOwner?.teamId && selectedParticipant?.teamId && selectedOwner.teamId !== selectedParticipant.teamId);
  const countryDeviation = Boolean(selectedOwner && selectedParticipant && selectedOwner.country !== selectedParticipant.country);
  const requiresDeviationReason = teamDeviation || countryDeviation;
  const representative = representatives.find((item) => item.id === draft.representativeId) ?? (selectedParticipant ? participantAsRepresentative(selectedParticipant) : undefined);
  const currentStepIndex = wizardSteps.findIndex((item) => item.id === step);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveLocalDraft(offlineStorageKeys.draftIntervention, draft);
      setSavedAt(new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft]);

  if (!isModuleEnabled("BEGELEIDINGEN")) {
    return <EmptyState title="Module niet actief" description="Begeleidingen is momenteel gedeactiveerd in FieldForce." />;
  }

  if (!canCreateCoachingIntervention(user)) {
    return <EmptyState title="Geen rechten om een begeleiding te maken" description="Je rol mag geen begeleiding aanmaken." />;
  }

  if (editId && !hydrated) {
    return <EmptyState title="Begeleiding laden" description="De bestaande planning wordt opgehaald." />;
  }

  if (editMissing) {
    return <EmptyState title="Begeleiding niet gevonden" description="Deze begeleiding bestaat niet, is niet gepland of valt buiten jouw bewerkingsscope." />;
  }

  if (editForbidden) {
    return <EmptyState title="Alleen bekijken" description="Deze geplande begeleiding mag door jouw rol niet worden aangepast." />;
  }

  if (helpRequestId && !hydrated) {
    return <EmptyState title="Hulpaanvraag laden" description="De gekoppelde hulpaanvraag wordt opgehaald." />;
  }

  if (helpRequestMissing) {
    return <EmptyState title="Hulpaanvraag niet gevonden" description="Deze hulpaanvraag bestaat niet of valt buiten jouw scope." />;
  }

  if (helpRequestHandled) {
    return <EmptyState title="Hulpaanvraag al behandeld" description="Deze hulpaanvraag heeft al een vervolgactie of is afgesloten." />;
  }

  function workflowInput() {
    return {
      id: draft.id,
      representativeId: draft.representativeId,
      initiatorId: user.id,
      ownerId: draft.ownerId,
      plannedDate: draft.plannedDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      notifyRepresentative: draft.notifyRepresentative,
      notifyCoachedRepresentative: draft.notifyCoachedRepresentative,
      notifyCoachedTeamLeaders: draft.notifyCoachedTeamLeaders,
      notifyExecutorTeamLeaders: draft.notifyExecutorTeamLeaders,
      peerCoach: selectedOwner?.role === "REPRESENTATIVE",
      teamDeviation,
      countryDeviation,
      deviationReason: draft.deviationReason,
      subject: selectedParticipant,
      focusNames: draft.focusNames,
      scores: [],
      actionPoints: [],
    };
  }

  async function handleSchedule() {
    setError(undefined);
    if (!draft.representativeId) {
      setError("Selecteer eerst een persoon.");
      return;
    }
    if (requiresDeviationReason && !draft.deviationReason.trim()) {
      setError("Geef een afwijkingsreden op wanneer uitvoerder en begeleide persoon niet in hetzelfde team of land zitten.");
      return;
    }
    if (draft.endTime <= draft.startTime) {
      setError("Het einduur moet later zijn dan het beginuur.");
      return;
    }
    try {
      setSaving(true);
      if (helpRequestId) {
        const intervention = await scheduleHelpRequestCoaching(helpRequestId, user.id, workflowInput());
        setSavedAt(new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }));
        router.push(`/begeleidingen/${intervention.id}`);
        return;
      }
      await saveCoachingStatus(workflowInput(), "gepland");
      setSavedAt(new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }));
      router.push("/begeleidingen");
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "De begeleiding kon niet worden ingepland.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    router.push("/dashboard");
  }

  function goToNextStep() {
    setError(undefined);
    if (step === "representative" && !draft.representativeId) {
      setError("Selecteer eerst een vertegenwoordiger of verkoopleider.");
      return;
    }
    if (step === "representative" && requiresDeviationReason && !draft.deviationReason.trim()) {
      setError("Geef een afwijkingsreden op voor deze team- of landafwijking.");
      return;
    }
    if (step === "focus" && draft.focusNames.length === 0) {
      setError("Selecteer minstens één focusfase voordat je verdergaat.");
      return;
    }
    const nextStep = wizardSteps[currentStepIndex + 1];
    if (nextStep) setStep(nextStep.id);
  }

  function goToPreviousStep() {
    setError(undefined);
    const previousStep = wizardSteps[currentStepIndex - 1];
    if (previousStep) setStep(previousStep.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={draft.id ? "Concept verderzetten" : "Nieuwe interventie"}
        title="Nieuwe begeleiding"
        description="Bereid het coachingsmoment voor, plan het in en vul de evaluatie later in tijdens de effectieve begeleiding."
        actions={
          <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Save className="h-4 w-4" />
            {savedAt ? `Lokale autosave om ${savedAt}` : "Autosave voorbereid"}
          </span>
        }
      />

      <div className="card overflow-x-auto p-3">
        <div className="flex min-w-[520px] items-center">
          {wizardSteps.map(({ id, label }, index) => {
            const number = index + 1;
            const done = index < currentStepIndex;
            const active = id === step;
            return (
              <div key={id} className="flex flex-1 items-center last:flex-none">
                <button type="button" onClick={() => index <= currentStepIndex && setStep(id)} className="flex items-center gap-2">
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                    done ? "bg-emerald-600 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {done ? <Check className="h-4 w-4" /> : number}
                  </span>
                  <span className={`text-xs font-semibold ${active ? "text-brand-700" : "text-slate-500"}`}>{label}</span>
                </button>
                {index < wizardSteps.length - 1 && <div className={`mx-3 h-px flex-1 ${done ? "bg-emerald-300" : "bg-slate-200"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="card min-h-[480px] p-5 sm:p-7">
        {step === "representative" && (
          <RepresentativeStep
            available={selectableParticipants}
            coaches={managedUsers.filter((profile) => profile.active && (
              ["SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(profile.role) ||
              (profile.role === "REPRESENTATIVE" && isPeerCoachingRepresentativeLevel(profile.representativeLevel) && ["SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(user.role))
            ) && (user.role === "SALES_LEADER" ? profile.id === user.id : ["COUNTRY_MANAGER", "ADMIN"].includes(user.role) ? (profile.role === "REPRESENTATIVE" && isPeerCoachingRepresentativeLevel(profile.representativeLevel)) || profile.country === user.country : user.role === "SALES_MANAGER" ? (profile.role === "REPRESENTATIVE" && isPeerCoachingRepresentativeLevel(profile.representativeLevel)) || user.countryAccess?.includes(profile.country) : true))}
            selected={draft.representativeId}
            ownerId={draft.ownerId}
            onSelect={(representativeId) => {
              if (sourceHelpRequest) return;
              setDraft((current) => ({ ...current, representativeId }));
            }}
            plannedDate={draft.plannedDate}
            startTime={draft.startTime}
            endTime={draft.endTime}
            notifyRepresentative={draft.notifyRepresentative}
            notifyCoachedRepresentative={draft.notifyCoachedRepresentative}
            notifyCoachedTeamLeaders={draft.notifyCoachedTeamLeaders}
            notifyExecutorTeamLeaders={draft.notifyExecutorTeamLeaders}
            deviationReason={draft.deviationReason}
            requiresDeviationReason={requiresDeviationReason}
            teamDeviation={teamDeviation}
            countryDeviation={countryDeviation}
            lockedRepresentative={Boolean(sourceHelpRequest)}
            onPlanningChange={(planning) => setDraft((current) => ({ ...current, ...planning }))}
          />
        )}
        {step === "focus" && representative && (
          <FocusStep selected={draft.focusNames} onToggle={(name) => setDraft((current) => ({ ...current, focusNames: current.focusNames.includes(name) ? current.focusNames.filter((item) => item !== name) : [...current.focusNames, name] }))} />
        )}
        {step === "preparation" && representative && <PreparationStep representative={representative} />}
        {step === "summary" && representative && (
          <SummaryStep
            representative={representative}
            plannedDate={draft.plannedDate}
            startTime={draft.startTime}
            endTime={draft.endTime}
          />
        )}
      </div>

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <button type="button" onClick={goToPreviousStep} disabled={currentStepIndex === 0} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Vorige
        </button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {currentStepIndex < wizardSteps.length - 1 ? (
            <button
              type="button"
              onClick={goToNextStep}
              className="btn-primary"
            >
              Volgende
            </button>
          ) : (
            <>
              <button type="button" onClick={handleCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50">
                Annuleren
              </button>
              <button type="button" onClick={handleSchedule} disabled={saving} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                <Save className="h-4 w-4" /> {saving ? "Inplannen..." : "Inplannen"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RepresentativeStep({
  available,
  coaches,
  selected,
  ownerId,
  onSelect,
  plannedDate,
  startTime,
  endTime,
  notifyRepresentative,
  notifyCoachedRepresentative,
  notifyCoachedTeamLeaders,
  notifyExecutorTeamLeaders,
  deviationReason,
  requiresDeviationReason,
  teamDeviation,
  countryDeviation,
  lockedRepresentative,
  onPlanningChange,
}: {
  available: CoachingParticipant[];
  coaches: ReturnType<typeof useSession>["managedUsers"];
  selected: string;
  ownerId: string;
  onSelect: (id: string) => void;
  plannedDate: string;
  startTime: string;
  endTime: string;
  notifyRepresentative: boolean;
  notifyCoachedRepresentative: boolean;
  notifyCoachedTeamLeaders: boolean;
  notifyExecutorTeamLeaders: boolean;
  deviationReason: string;
  requiresDeviationReason: boolean;
  teamDeviation: boolean;
  countryDeviation: boolean;
  lockedRepresentative: boolean;
  onPlanningChange: (planning: Partial<Pick<Draft, "plannedDate" | "startTime" | "endTime" | "notifyRepresentative" | "notifyCoachedRepresentative" | "notifyCoachedTeamLeaders" | "notifyExecutorTeamLeaders" | "deviationReason" | "ownerId">>) => void;
}) {
  return (
    <div>
      <StepHeading icon={UserRound} title="Wie ga je begeleiden?" description="Je ziet alleen vertegenwoordigers en verkoopleiders binnen jouw toegestane scope." />
      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Datum</span>
          <input type="date" className="field" value={plannedDate} onChange={(event) => onPlanningChange({ plannedDate: event.target.value })} />
        </label>
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Beginuur</span>
          <input type="time" className="field" value={startTime} onChange={(event) => onPlanningChange({ startTime: event.target.value })} />
        </label>
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Einduur</span>
          <input type="time" className="field" value={endTime} onChange={(event) => onPlanningChange({ endTime: event.target.value })} />
        </label>
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Begeleider</span>
          <select className="field" value={ownerId} onChange={(event) => onPlanningChange({ ownerId: event.target.value })}>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.firstName} {coach.lastName}
                {coach.role === "REPRESENTATIVE" ? ` — ${representativeLevelLabels[coach.representativeLevel]}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <input className="mt-1" type="checkbox" checked={notifyCoachedRepresentative || notifyRepresentative} onChange={(event) => onPlanningChange({ notifyCoachedRepresentative: event.target.checked, notifyRepresentative: event.target.checked })} />
          <span>Begeleide vertegenwoordiger vooraf op de hoogte brengen</span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <input className="mt-1" type="checkbox" checked={notifyCoachedTeamLeaders} onChange={(event) => onPlanningChange({ notifyCoachedTeamLeaders: event.target.checked })} />
          <span>Verkoopleider(s) van de begeleide vertegenwoordiger informeren</span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <input className="mt-1" type="checkbox" checked={notifyExecutorTeamLeaders} onChange={(event) => onPlanningChange({ notifyExecutorTeamLeaders: event.target.checked })} />
          <span>Verkoopleider(s) van de uitvoerende Professional/Expert informeren</span>
        </label>
      </div>
      {requiresDeviationReason && (
        <label className="mt-4 block rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-700">
            Afwijkingsreden verplicht
          </span>
          <p className="mb-3 text-sm text-amber-800">
            {teamDeviation && countryDeviation
              ? "De uitvoerder zit in een ander team en ander land dan de begeleide persoon."
              : teamDeviation
                ? "De uitvoerder zit in een ander team dan de begeleide persoon."
                : "De uitvoerder zit in een ander land dan de begeleide persoon."}
          </p>
          <textarea
            className="field min-h-24"
            value={deviationReason}
            onChange={(event) => onPlanningChange({ deviationReason: event.target.value })}
            placeholder="Leg kort uit waarom deze afwijkende combinatie gekozen wordt."
          />
        </label>
      )}
      {lockedRepresentative && (
        <p className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          Deze begeleiding is gekoppeld aan de vertegenwoordiger van de hulpaanvraag.
        </p>
      )}
      <ParticipantTree available={available} selected={selected} onSelect={onSelect} locked={lockedRepresentative} />
    </div>
  );
}

function ParticipantTree({ available, selected, onSelect, locked = false }: { available: CoachingParticipant[]; selected: string; onSelect: (id: string) => void; locked?: boolean }) {
  const [collapsedOverride, setCollapsedOverride] = useState<Set<string> | null>(null);
  const [query, setQuery] = useState("");
  const availableTeams = useMemo(() => [...new Set(available.map((item) => item.teamId))], [available]);
  const collapseSignature = useMemo(() => [...new Set(available.map((item) => `${item.country}:${item.teamId}`))].sort().join("|"), [available]);
  const defaultCollapsed = useMemo(() => {
    const next = new Set<string>();
    if (availableTeams.length <= 1) {
      return next;
    }

    for (const country of [...new Set(available.map((item) => item.country))]) {
      next.add(`country:${country}`);
    }
    for (const teamId of availableTeams) {
      next.add(`team:${teamId}`);
    }
    return next;
  }, [available, availableTeams]);
  const collapsed = collapsedOverride ?? defaultCollapsed;
  const normalizedQuery = query.trim().toLocaleLowerCase("nl-BE");
  const filtered = useMemo(
    () => available.filter((person) => participantMatchesQuery(person, normalizedQuery)),
    [available, normalizedQuery],
  );
  const countries = useMemo(() => [...new Set(filtered.map((item) => item.country))], [filtered]);
  const forceOpen = Boolean(normalizedQuery);

  useEffect(() => {
    setCollapsedOverride(null);
  }, [collapseSignature]);

  const toggle = (key: string) =>
    setCollapsedOverride((current) => {
      const next = new Set(current ?? defaultCollapsed);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  return (
    <div className="mt-6 space-y-3">
      <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Vertegenwoordiger zoeken</span>
        <input
          type="search"
          className="field"
          value={query}
          placeholder="Typ een naam om de lijst te filteren"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
          Geen begeleidbare gebruiker gevonden.
        </div>
      ) : (
        countries.map((country) => {
          const countryKey = `country:${country}`;
          const countryOpen = forceOpen || !collapsed.has(countryKey);
          const countryPeople = filtered.filter((item) => item.country === country);
          const teams = [...new Map(countryPeople.map((item) => [item.teamId, item.team])).entries()];

          return (
            <section key={country} className="overflow-hidden rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => toggle(countryKey)}
                className="flex w-full items-center gap-2 bg-slate-50 px-4 py-3 text-left font-bold text-slate-900"
              >
                {countryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="flex-1">{countryDisplayName(country)}</span>
                <span className="text-xs text-slate-500">{countryPeople.length}</span>
              </button>

              {countryOpen && (
                <div className="space-y-2 p-3">
                  {teams.map(([teamId, team]) => {
                    const key = `team:${teamId}`;
                    const teamOpen = forceOpen || !collapsed.has(key);
                    const people = countryPeople.filter((item) => item.teamId === teamId);

                    return (
                      <section key={teamId} className="overflow-hidden rounded-xl border border-slate-200">
                        <button type="button" onClick={() => toggle(key)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold">
                          {teamOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="flex-1">{team}</span>
                          <span className="text-xs text-slate-400">{people.length}</span>
                        </button>

                        {teamOpen && (
                          <div className="grid gap-2 border-t border-slate-100 p-2 sm:grid-cols-2 xl:grid-cols-3">
                            {people.map((person) => (
                              <button
                                type="button"
                                key={person.id}
                                disabled={locked}
                                onClick={() => onSelect(person.id)}
                                className={`flex items-center gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed ${
                                  selected === person.id ? "border-brand-700 bg-brand-50" : "border-slate-200 hover:border-brand-200"
                                }`}
                              >
                                <Avatar initials={person.initials} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">
                                    {person.firstName} {person.lastName}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {person.role === "SALES_LEADER" ? "Verkoopleider" : "Vertegenwoordiger"}
                                  </p>
                                  {person.role === "REPRESENTATIVE" && person.representativeLevel && (
                                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${representativeLevelBadgeClass[person.representativeLevel]}`}>
                                      {representativeLevelLabels[person.representativeLevel]}
                                    </span>
                                  )}
                                </div>
                                {person.role === "SALES_LEADER" && (
                                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">Verkoopleider</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function participantMatchesQuery(person: CoachingParticipant, query: string) {
  if (!query) {
    return true;
  }

  return [person.firstName, person.lastName, `${person.firstName} ${person.lastName}`, person.initials].some((value) =>
    value.toLocaleLowerCase("nl-BE").includes(query),
  );
}

function countryDisplayName(country: string) {
  if (country === "BE") {
    return "België";
  }
  if (country === "NL") {
    return "Nederland";
  }
  if (country === "DE") {
    return "Duitsland";
  }
  return country;
}

function participantAsRepresentative(person: CoachingParticipant): Representative {
  return { id: person.id, firstName: person.firstName, lastName: person.lastName, initials: person.initials, country: person.country, team: person.team, teamId: person.teamId, level: "Vertegenwoordiger", levelColor: "bg-brand-100 text-brand-800", lastCoaching: "Nog niet", openActions: 0, email: "", phone: "", kpis: [] };
}

function PreparationStep({ representative }: { representative: Representative }) {
  const { language } = useSession();
  const { dataset: performanceDataset } = usePerformance();
  const previousActions = performanceDataset.historicalActionPoints.filter((item) => item.representativeId === representative.id);
  const coachings = useMemo(() => coachingsForRepresentative(performanceDataset, representative.id), [performanceDataset, representative.id]);
  const latestCoaching = latestHistoricalCoaching(performanceDataset, representative.id);
  const previousWheelData = latestCoaching
    ? getPerformanceWheelData(representative.id, latestCoaching.id, "kapstok", undefined, coachings)
    : undefined;
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [activeTab, setActiveTab] = useState<"algemeen" | "prestatiecirkel" | "scoretabellen">("algemeen");

  async function handlePreparationExport() {
    setExportError(undefined);
    if (!latestCoaching || !previousWheelData) {
      setExportError("Er is nog geen vorige prestatiecirkel beschikbaar om te exporteren.");
      return;
    }
    const svgElement = wheelRef.current?.querySelector("svg");
    if (!svgElement) {
      setExportError("De prestatiecirkel kon niet gevonden worden voor de PDF-export.");
      return;
    }
    try {
      setIsExporting(true);
      await exportPreparationPdf({
        representative,
        previousActions,
        latestCoaching,
        wheelData: previousWheelData,
        svgElement,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "De voorbereiding kon niet geëxporteerd worden.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StepHeading
          icon={ClipboardCheck}
          title="Voorbereiding vertegenwoordiger"
          description={translate(language, "coaching.preparation.previousScoresDescription").replace("{name}", representative.firstName)}
        />
        <button type="button" onClick={handlePreparationExport} disabled={isExporting} className="btn-secondary whitespace-nowrap">
          <Save className="h-4 w-4" />
          {isExporting ? "PDF wordt aangemaakt..." : "Voorbereiding exporteren"}
        </button>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
        {[
          { key: "algemeen", label: "Algemeen" },
          { key: "prestatiecirkel", label: "Prestatiecirkel" },
          { key: "scoretabellen", label: "Scoretabellen" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              activeTab === tab.key ? "bg-brand-700 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-brand-50 hover:text-brand-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={activeTab === "algemeen" ? "mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "hidden"}>
        <SummaryCard label="Niveau" value={representative.level} detail="Huidig ontwikkelniveau" />
        <SummaryCard label="Team" value={representative.team} detail={representative.country} />
        <SummaryCard label="Laatste begeleiding" value={representative.lastCoaching} detail="Meest recente coachingmoment" />
        <SummaryCard label="Open actiepunten" value={`${representative.openActions}`} detail="Actief in opvolging" />
      </div>
      <div className={activeTab === "algemeen" ? "mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" : "hidden"}>
        {representative.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex justify-between">
              <p className="text-sm font-semibold text-slate-500">{kpi.label}</p>
              <Trend value={kpi.trend} />
            </div>
            <p className="mt-3 text-2xl font-bold">{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-400">Doel: {kpi.target}</p>
          </div>
        ))}
      </div>
      <div className={activeTab === "algemeen" ? "mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5" : "hidden"}>
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <p className="font-bold text-amber-950">Vorige actiepunten</p>
            <p className="mt-1 text-sm text-amber-800">
              {previousActions.length
                ? previousActions.map((item) => item.title).join(" · ")
                : "Geen open actiepunten uit een vorige begeleiding."}
            </p>
          </div>
        </div>
      </div>
      <section className={activeTab === "algemeen" ? "hidden" : "mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">{activeTab === "prestatiecirkel" ? "Prestatiecirkel" : "Scoretabellen"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === "prestatiecirkel"
                ? "Huidige meting tegenover de vorige begeleiding, inclusief vergelijkingskleuren en legenda."
                : "Huidige scores, vorige scores, verschillen en kleurcodering."}
            </p>
          </div>
          {latestCoaching && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{formatIsoDate(latestCoaching.date)}</span>}
        </div>
        {previousWheelData && latestCoaching ? (
          <div className="mt-5 space-y-5">
            <div ref={wheelRef} className={activeTab === "prestatiecirkel" ? "mx-auto max-w-4xl" : "hidden"}>
              <PerformanceWheel
                representativeId={representative.id}
                currentInterventionId={latestCoaching.id}
                comparisonInterventionId={previousWheelData.comparisonInterventionId}
                type="kapstok"
                coachings={coachings}
              />
              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
                <Info className="h-4 w-4 text-brand-700" />
                Hoe verder een score naar buiten ligt, hoe sterker de prestatie.
              </p>
            </div>
            {activeTab === "scoretabellen" && <PreparationScoreOverview criteria={previousWheelData.criteria} coachingDate={latestCoaching.date} />}
          </div>
        ) : (
          <EmptyState title="Nog geen vorige prestatiecirkel beschikbaar." description="Zodra er een afgeronde begeleiding is, verschijnt hier de vorige prestatiecirkel met scoredetails." />
        )}
        {exportError && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {exportError}
          </div>
        )}
      </section>
    </div>
  );
}

function PreparationScoreOverview({
  criteria,
  coachingDate,
}: {
  criteria: PerformanceWheelCriterion[];
  coachingDate: string;
}) {
  const groups = criteria.reduce<Array<{ category: string; rows: PerformanceWheelCriterion[] }>>((result, row) => {
    const group = result.find((item) => item.category === row.category);
    if (group) group.rows.push(row);
    else result.push({ category: row.category, rows: [row] });
    return result;
  }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {groups.map((group) => (
        <section key={group.category} className="rounded-xl border border-slate-200 bg-slate-50/70">
          <div className="border-b border-slate-200 px-3.5 py-2.5">
            <h4 className="text-sm font-bold text-brand-800">{group.category}</h4>
          </div>
          <div className="divide-y divide-slate-200/80">
            {group.rows.map((row) => (
              <div key={row.id} className="grid gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <p className="break-words text-xs font-semibold leading-4 text-slate-700">{row.criterion}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatIsoDate(coachingDate)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:justify-end">
                  <span className="whitespace-nowrap text-slate-500">Categorie: {row.category}</span>
                  <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 font-bold text-slate-700 ring-1 ring-slate-200">Score: {formatScore(row.currentTen)}</span>
                  <span className="whitespace-nowrap text-slate-400">Opmerking: -</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

async function exportPreparationPdf({
  representative,
  previousActions,
  latestCoaching,
  wheelData,
  svgElement,
}: {
  representative: Representative;
  previousActions: { title: string }[];
  latestCoaching: ReturnType<typeof latestHistoricalCoaching> extends infer T ? NonNullable<T> : never;
  wheelData: NonNullable<ReturnType<typeof getPerformanceWheelData>>;
  svgElement: SVGSVGElement;
}) {
  const [{ jsPDF }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const exportDate = new Date();
  const exportDateLabel = exportDate.toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
  const representativeName = `${representative.firstName} ${representative.lastName}`;

  drawPreparationHeader(pdf, representativeName, exportDateLabel);
  pdf.setTextColor("#003B83");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Voorbereiding begeleiding", 14, 34);

  pdf.setFontSize(12);
  pdf.setTextColor("#172033");
  pdf.text(representativeName, 14, 43);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor("#64748B");
  pdf.text(`Team: ${representative.team} · Niveau: ${representative.level}`, 14, 49);
  pdf.text(`Vorige begeleiding: ${formatIsoDate(latestCoaching.date)}`, 14, 55);

  let y = 68;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor("#003B83");
  pdf.text("KPI-snapshot", 14, y);
  y += 5;
  representative.kpis.forEach((kpi, index) => {
    const x = 14 + (index % 2) * 91;
    const rowY = y + Math.floor(index / 2) * 27;
    drawPreparationCard(pdf, x, rowY, 86, 22, kpi.label, `${kpi.value}`, `Doel: ${kpi.target} · Trend: ${kpi.trend > 0 ? "+" : ""}${kpi.trend}`);
  });

  y += Math.ceil(representative.kpis.length / 2) * 27 + 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor("#003B83");
  pdf.text("Vorige actiepunten", 14, y);
  y += 5;
  const actionLines = previousActions.length
    ? previousActions.flatMap((action) => pdf.splitTextToSize(`- ${action.title}`, 176))
    : ["Geen open actiepunten uit een vorige begeleiding."];
  drawPreparationBox(pdf, 14, y, 182, Math.max(22, actionLines.length * 5 + 9));
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor("#334155");
  pdf.text(actionLines, 19, y + 8);

  pdf.addPage();
  drawPreparationHeader(pdf, representativeName, exportDateLabel);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor("#003B83");
  pdf.setFontSize(18);
  pdf.text("Vorige prestatiecirkel", 14, 34);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor("#64748B");
  pdf.setFontSize(9.5);
  pdf.text("Overzicht van de scores tijdens het vorige coachingmoment.", 14, 41);

  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgClone.setAttribute("width", "1000");
  svgClone.setAttribute("height", "1000");
  await pdf.svg(svgClone, { x: 18, y: 48, width: 174, height: 174 });

  const average = wheelData.criteria.reduce((sum, row) => sum + row.currentTen, 0) / Math.max(1, wheelData.criteria.length);
  drawPreparationCard(pdf, 62, 229, 86, 26, "Gemiddelde score", formatScore(average), `Begeleiding ${formatIsoDate(latestCoaching.date)}`);

  pdf.addPage();
  drawPreparationHeader(pdf, representativeName, exportDateLabel);
  drawPreparationScoreTable(pdf, wheelData.criteria, latestCoaching.date);

  const filename = `FieldForce_voorbereiding_${slugify(representativeName)}_${exportDate.toISOString().slice(0, 10)}.pdf`;
  const output = pdf.output("arraybuffer");
  const signature = new TextDecoder().decode(new Uint8Array(output, 0, 4));
  if (signature !== "%PDF" || output.byteLength < 1_000) {
    throw new Error("De gegenereerde PDF is ongeldig.");
  }
  pdf.save(filename);
}

function drawPreparationHeader(pdf: import("jspdf").jsPDF, representativeName: string, exportDate: string) {
  pdf.setFillColor("#003B83");
  pdf.rect(0, 0, 210, 18, "F");
  pdf.setTextColor("#FFFFFF");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("MExT FieldForce", 14, 11);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Grow. Coach. Perform.", 105, 11, { align: "center" });
  pdf.text(`${representativeName} · Exportdatum: ${exportDate}`, 196, 11, { align: "right" });
}

function drawPreparationCard(pdf: import("jspdf").jsPDF, x: number, y: number, width: number, height: number, label: string, value: string, detail: string) {
  drawPreparationBox(pdf, x, y, width, height);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor("#64748B");
  pdf.text(label.toUpperCase(), x + 5, y + 7);
  pdf.setFontSize(14);
  pdf.setTextColor("#172033");
  pdf.text(value, x + 5, y + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor("#94A3B8");
  pdf.text(pdf.splitTextToSize(detail, width - 10), x + 5, y + 19);
}

function drawPreparationBox(pdf: import("jspdf").jsPDF, x: number, y: number, width: number, height: number) {
  pdf.setFillColor("#FFFFFF");
  pdf.setDrawColor("#DCE3EC");
  pdf.roundedRect(x, y, width, height, 3, 3, "FD");
}

function drawPreparationScoreTable(pdf: import("jspdf").jsPDF, rows: PerformanceWheelCriterion[], coachingDate: string) {
  let y = 34;
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor("#003B83");
  pdf.setFontSize(17);
  pdf.text("Gedetailleerde scoretabel", 14, y);
  y += 10;

  const drawTableHeader = () => {
    pdf.setFillColor("#EFF6FF");
    pdf.setDrawColor("#DCE3EC");
    pdf.roundedRect(14, y, 182, 9, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor("#003B83");
    pdf.text("CRITERIUM", 18, y + 6);
    pdf.text("FASE", 92, y + 6);
    pdf.text("SCORE", 137, y + 6, { align: "center" });
    pdf.text("OPMERKING", 157, y + 6);
    pdf.text("DATUM", 188, y + 6, { align: "right" });
    y += 11;
  };

  drawTableHeader();
  for (const row of rows) {
    const criterionLines = pdf.splitTextToSize(row.criterion, 68);
    const categoryLines = pdf.splitTextToSize(row.category, 38);
    const height = Math.max(9, criterionLines.length * 4.2, categoryLines.length * 4.2) + 4;
    if (y + height > 274) {
      pdf.addPage();
      y = 34;
      drawTableHeader();
    }
    pdf.setDrawColor("#E8EDF3");
    pdf.line(14, y - 2, 196, y - 2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.8);
    pdf.setTextColor("#172033");
    pdf.text(criterionLines, 18, y + 3);
    pdf.setTextColor("#64748B");
    pdf.text(categoryLines, 92, y + 3);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor("#172033");
    pdf.text(formatScore(row.currentTen), 137, y + 3, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor("#64748B");
    pdf.text("-", 157, y + 3);
    pdf.text(formatIsoDate(coachingDate), 188, y + 3, { align: "right" });
    y += height;
  }
}

function formatScore(value: number) {
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 1 });
}

function formatIsoDate(value?: string) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" });
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function FocusStep({ selected, onToggle }: { selected: string[]; onToggle: (name: string) => void }) {
  const { coachingFramework } = useConfiguration();
  return (
    <div>
      <StepHeading icon={Target} title="Kies de focusfasen" description="Niet-geselecteerde fasen blijven uit de criteria, scoreflow en het eindverslag." />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {coachingFramework.map((focus) => {
          const active = selected.includes(focus.name);
          return (
            <button
              type="button"
              key={focus.name}
              onClick={() => onToggle(focus.name)}
              className={`relative overflow-hidden rounded-2xl border p-5 text-left transition ${
                active ? "border-brand-700 bg-brand-50 ring-4 ring-brand-50" : "border-slate-200 hover:border-brand-200"
              }`}
            >
              <div className={`absolute inset-y-0 left-0 w-1.5 ${focus.color}`} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-950">{focus.name}</p>
                  <p className="mt-2 text-sm text-slate-500">{focus.criteria.length} criteria</p>
                </div>
                <span className={`grid h-7 w-7 place-items-center rounded-full border ${
                  active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 text-transparent"
                }`}>
                  <Check className="h-4 w-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Kept for the later full execution flow; the current wizard only plans coachings.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CriteriaStep({
  selectedFocus,
  personalCriteria,
}: {
  selectedFocus: CoachingFrameworkFocus[];
  personalCriteria: ReturnType<typeof usePersonalCriteria>["criteria"];
}) {
  return (
    <div>
      <StepHeading icon={ListChecks} title="Geselecteerde criteria" description="Controleer de compacte beoordelingsset voordat je begint te scoren." />
      <div className="mt-6 space-y-4">
        {selectedFocus.map((focus) => {
          const personal = personalCriteria.filter((criterion) => criterion.focusName === focus.name);
          return (
            <section key={focus.name} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 bg-slate-50 px-5 py-4">
                <span className={`h-8 w-1.5 rounded-full ${focus.color}`} />
                <div>
                  <h3 className="font-bold text-slate-900">{focus.name}</h3>
                  <p className="text-xs text-slate-500">{focus.criteria.length} vaste criteria{personal.length ? ` · ${personal.length} persoonlijk` : ""}</p>
                </div>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {focus.criteria.map((criterion) => (
                  <div key={criterion} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-700" />
                    <span className="flex-1">{criterion}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Vast</span>
                  </div>
                ))}
                {personal.map((criterion) => (
                  <div key={criterion.id} className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-700" />
                      <span className="flex-1 font-semibold">{criterion.title}</span>
                      <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Persoonlijk</span>
                    </div>
                    {criterion.description && <p className="mt-2 pl-6 text-xs leading-5 text-slate-500">{criterion.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Kept for the later full execution flow; the current wizard only plans coachings.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ScoreStep({
  criteria,
  scores,
  onScore,
}: {
  criteria: ScoreCriterion[];
  scores: Record<string, ScoreValue>;
  onScore: (criterion: string, score: ScoreValue) => void;
}) {
  const scoreOptions: ScoreValue[] = [100, 75, 50, 25, 0, "NVT"];
  return (
    <div>
      <StepHeading icon={ClipboardCheck} title="Score per criterium" description="De vorige score staat naast elk criterium; kies met één tik de huidige score." />
      <div className="mt-6 space-y-4">
        {criteria.map((item) => (
          <div key={item.key} className={`rounded-2xl border p-4 sm:p-5 ${item.kind === "personal" ? "border-brand-100 bg-brand-50/40" : "border-slate-200"}`}>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{item.focus}</p>
                  {item.kind === "personal" && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Persoonlijk</span>}
                </div>
                <p className="mt-1 font-semibold text-slate-900">{item.criterion}</p>
                {item.description && <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>}
              </div>
              <p className="text-xs text-slate-400">
                Vorige score: <span className="font-bold text-slate-600">{item.previousScore}%</span>
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {scoreOptions.map((score) => (
                <button
                  type="button"
                  key={score}
                  onClick={() => onScore(item.key, score)}
                  className={`min-h-14 rounded-xl border text-base font-bold transition ${
                    scores[item.key] === score
                      ? "border-brand-700 bg-brand-700 text-white shadow-md"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50"
                  }`}
                >
                  {score === "NVT" ? score : `${score}%`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fixedScoreKey(focus: string, criterion: string) {
  return `fixed:${focus}:${criterion}`;
}

function personalScoreKey(id: string) {
  return `personal:${id}`;
}

// Kept for restoring score drafts when the full execution flow is re-enabled.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function scoreKeyFromStoredScore(score: {
  criterion: string;
  focus: string;
  criterionKind?: "fixed" | "personal";
  criterionId?: string;
}) {
  if (score.criterionKind === "personal" && score.criterionId) {
    return personalScoreKey(score.criterionId);
  }
  return fixedScoreKey(score.focus, score.criterion);
}

// Kept for the later full execution flow; the current wizard only plans coachings.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ActionsStep({
  actions,
  onChange,
}: {
  actions: Draft["actions"];
  onChange: (actions: Draft["actions"]) => void;
}) {
  return (
    <div>
      <StepHeading icon={Target} title="Maak afspraken concreet" description="Voeg alleen duidelijke, opvolgbare KPI-, vaardigheids- of gedragsacties toe." />
      <div className="mt-6">
        <ActionPointEditor actions={actions} onChange={onChange} />
      </div>
    </div>
  );
}

function SummaryStep({
  representative,
  plannedDate,
  startTime,
  endTime,
}: {
  representative: Representative;
  plannedDate: string;
  startTime: string;
  endTime: string;
}) {
  return (
    <div>
      <StepHeading icon={CheckCircle2} title="Controleer en plan in" description="De begeleiding wordt ingepland. Evaluatie, scores, criteria en actiepunten vul je later in tijdens de effectieve begeleiding." />
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <SummaryCard label="Vertegenwoordiger" value={`${representative.firstName} ${representative.lastName}`} detail={`${representative.team} · ${representative.country}`} />
        <SummaryCard label="Datum" value={formatIsoDate(plannedDate)} detail={`${startTime} - ${endTime}`} />
        <SummaryCard label="Status na inplannen" value="Gepland" detail="Zichtbaar in Planning en Begeleidingen" />
        <SummaryCard label="Volgende stap" value="Begeleiden" detail="Afspraken, scores en actiepunten worden in het dossier geregistreerd" />
      </div>
      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
        <strong>Flow:</strong> Voorbereiden → Inplannen → Begeleiden → Evalueren.
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function StepHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
