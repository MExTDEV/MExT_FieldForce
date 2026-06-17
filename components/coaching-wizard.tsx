"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Save,
  Target,
  UserRound,
} from "lucide-react";
import { ActionPointEditor, type EditableActionPoint } from "@/components/action-point-editor";
import { Avatar, EmptyState, PageHeader, Trend } from "@/components/ui";
import { usePersonalCriteria } from "@/components/personal-criteria-provider";
import { useModules } from "@/components/module-provider";
import { useSession } from "@/components/session-provider";
import { useWorkflow } from "@/components/workflow-provider";
import { actionPoints, coachingFramework, representatives } from "@/lib/mock-data";
import { canAccessRepresentative } from "@/lib/permissions";
import { offlineStorageKeys, saveLocalDraft } from "@/lib/storage";
import type { ScoreValue } from "@/lib/types";

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
  plannedDate: string;
  startTime: string;
  endTime: string;
  notifyRepresentative: boolean;
  focusNames: string[];
  scores: Record<string, ScoreValue>;
  actions: EditableActionPoint[];
};

const steps = [
  "Vertegenwoordiger",
  "Voorbereiding",
  "Focus",
  "Criteria",
  "Scoren",
  "Actiepunten",
  "Afronden",
];

export function CoachingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { user } = useSession();
  const { state, saveCoachingStatus, finalizeCoaching } = useWorkflow();
  const personalCriteria = usePersonalCriteria();
  const { isModuleEnabled } = useModules();
  const available = representatives.filter((representative) => canAccessRepresentative(user, representative));
  const existing = editId ? state.interventions.find((item) => {
    if (item.id !== editId || item.status === "gefinaliseerd") return false;
    const representative = representatives.find((person) => person.id === item.representativeId);
    return representative ? canAccessRepresentative(user, representative) : false;
  }) : undefined;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({
    representativeId: available[0]?.id ?? "",
    plannedDate: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "11:00",
    notifyRepresentative: false,
    focusNames: [],
    scores: {},
    actions: [],
  });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string>();
  const [completedFor, setCompletedFor] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setDraft({
      id: existing.id,
      representativeId: existing.representativeId,
      plannedDate: existing.plannedDate ?? new Date().toISOString().slice(0, 10),
      startTime: existing.startTime ?? "09:00",
      endTime: existing.endTime ?? "11:00",
      notifyRepresentative: existing.notifyRepresentative ?? false,
      focusNames: existing.focusNames,
      scores: Object.fromEntries(existing.scores.map((score) => [scoreKeyFromStoredScore(score), score.value])),
      actions: existing.actionPoints.map((action) => ({
        title: action.title,
        type: action.type,
        due: action.due,
      })),
    });
    setLoadedId(existing.id);
  }, [existing, loadedId]);

  const representative = representatives.find((item) => item.id === draft.representativeId);
  const selectedFocus = coachingFramework.filter((focus) => draft.focusNames.includes(focus.name));
  const representativePersonalCriteria = useMemo(
    () => representative
      ? personalCriteria.activeForRepresentative(user, representative.id)
      : [],
    [personalCriteria, representative, user]
  );
  const criteria = useMemo<ScoreCriterion[]>(
    () => selectedFocus.flatMap((focus) => {
      const fixed = focus.criteria.map((criterion, index) => ({
        key: fixedScoreKey(focus.name, criterion),
        focus: focus.name,
        criterion,
        previousScore: [75, 50, 100, 75, 25][index % 5],
        kind: "fixed" as const,
      }));
      const personal = representativePersonalCriteria
        .filter((criterion) => criterion.focusName === focus.name)
        .map((criterion, index) => ({
          key: personalScoreKey(criterion.id),
          focus: focus.name,
          criterion: criterion.title,
          previousScore: [50, 75, 50][index % 3],
          kind: "personal" as const,
          criterionId: criterion.id,
          description: criterion.description,
        }));
      return [...fixed, ...personal];
    }),
    [selectedFocus, representativePersonalCriteria]
  );
  const scoredCount = criteria.filter((item) => draft.scores[item.key] !== undefined).length;

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

  if (!["SALES_LEADER", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return <EmptyState title="Geen rechten om een begeleiding te maken" description="Een begeleiding kan in deze fase worden aangemaakt door een verkoopleider of Super Admin." />;
  }

  function toggleFocus(name: string) {
    setDraft((current) => {
      const focusNames = current.focusNames.includes(name)
        ? current.focusNames.filter((item) => item !== name)
        : [...current.focusNames, name];
      const allowedCriteria = new Set(
        [
          ...coachingFramework
            .filter((focus) => focusNames.includes(focus.name))
            .flatMap((focus) => focus.criteria.map((criterion) => fixedScoreKey(focus.name, criterion))),
          ...representativePersonalCriteria
            .filter((criterion) => focusNames.includes(criterion.focusName))
            .map((criterion) => personalScoreKey(criterion.id)),
        ]
      );
      return {
        ...current,
        focusNames,
        scores: Object.fromEntries(
          Object.entries(current.scores).filter(([criterion]) => allowedCriteria.has(criterion))
        ),
      };
    });
  }

  function setScore(criterion: string, score: ScoreValue) {
    setDraft((current) => ({ ...current, scores: { ...current.scores, [criterion]: score } }));
  }

  function workflowInput() {
    return {
      id: draft.id,
      representativeId: draft.representativeId,
      initiatorId: user.id,
      plannedDate: draft.plannedDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      notifyRepresentative: draft.notifyRepresentative,
      focusNames: draft.focusNames,
      scores: criteria
        .filter((item) => draft.scores[item.key] !== undefined)
        .map((item) => ({
          criterion: item.criterion,
          focus: item.focus,
          value: draft.scores[item.key],
          previousScore: item.previousScore,
          criterionKind: item.kind,
          criterionId: item.criterionId,
          description: item.description,
        })),
      actionPoints: draft.actions,
    };
  }

  function handleSaveConcept() {
    setError(undefined);
    if (!draft.representativeId) {
      setError("Selecteer eerst een vertegenwoordiger.");
      return;
    }
    const intervention = saveCoachingStatus(workflowInput(), "gepland");
    router.push(`/begeleidingen/nieuw?id=${intervention.id}`);
    setDraft((current) => ({ ...current, id: intervention.id }));
    setSavedAt(new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }));
  }

  function handleFinalize() {
    setError(undefined);
    if (!representative || draft.focusNames.length === 0) {
      setError("Kies een vertegenwoordiger en minstens één focusfase.");
      return;
    }
    if (scoredCount !== criteria.length) {
      setError(`Vul alle ${criteria.length} criteria in. Er ontbreken nog ${criteria.length - scoredCount} scores.`);
      setStep(5);
      return;
    }
    finalizeCoaching(workflowInput());
    setCompletedFor(`${representative.firstName} ${representative.lastName}`);
  }

  if (completedFor) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8 text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="eyebrow mt-6">Begeleiding gefinaliseerd</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">De reflectietaak staat klaar</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
            Begeleiding gefinaliseerd. De vertegenwoordiger kan nu zijn reflectie invullen.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{completedFor}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/begeleidingen" className="btn-primary">Naar begeleidingen</Link>
            <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={draft.id ? "Concept verderzetten" : "Nieuwe interventie"}
        title="Nieuwe begeleiding"
        description="Werk focusgestuurd. Alleen gekozen fasen en criteria verschijnen in het verslag."
        actions={
          <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Save className="h-4 w-4" />
            {savedAt ? `Lokale autosave om ${savedAt}` : "Autosave voorbereid"}
          </span>
        }
      />

      <div className="card overflow-x-auto p-3">
        <div className="flex min-w-[860px] items-center">
          {steps.map((label, index) => {
            const number = index + 1;
            const done = number < step;
            const active = number === step;
            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <button type="button" onClick={() => number <= step && setStep(number)} className="flex items-center gap-2">
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                    done ? "bg-emerald-600 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {done ? <Check className="h-4 w-4" /> : number}
                  </span>
                  <span className={`text-xs font-semibold ${active ? "text-brand-700" : "text-slate-500"}`}>{label}</span>
                </button>
                {number < steps.length && <div className={`mx-3 h-px flex-1 ${done ? "bg-emerald-300" : "bg-slate-200"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="card min-h-[480px] p-5 sm:p-7">
        {step === 1 && (
          <RepresentativeStep
            available={available}
            selected={draft.representativeId}
            onSelect={(representativeId) => setDraft((current) => ({ ...current, representativeId }))}
            plannedDate={draft.plannedDate}
            startTime={draft.startTime}
            endTime={draft.endTime}
            notifyRepresentative={draft.notifyRepresentative}
            onPlanningChange={(planning) => setDraft((current) => ({ ...current, ...planning }))}
          />
        )}
        {step === 2 && representative && <PreparationStep representative={representative} />}
        {step === 3 && <FocusStep selected={draft.focusNames} onToggle={toggleFocus} />}
        {step === 4 && <CriteriaStep selectedFocus={selectedFocus} personalCriteria={representativePersonalCriteria} />}
        {step === 5 && <ScoreStep criteria={criteria} scores={draft.scores} onScore={setScore} />}
        {step === 6 && (
          <ActionsStep
            actions={draft.actions}
            onChange={(actions) => setDraft((current) => ({ ...current, actions }))}
          />
        )}
        {step === 7 && representative && (
          <SummaryStep
            representative={representative}
            selectedFocus={draft.focusNames}
            scoreCount={scoredCount}
            totalCriteria={criteria.length}
            actionCount={draft.actions.filter((item) => item.title.trim()).length}
          />
        )}
      </div>

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Vorige
        </button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={handleSaveConcept} className="btn-secondary">
            <Save className="h-4 w-4" /> Inplannen
          </button>
          {step < 7 ? (
            <button
              type="button"
              onClick={() => {
                setError(undefined);
                setStep((current) => Math.min(7, current + 1));
              }}
              disabled={
                (step === 1 && !draft.representativeId) ||
                (step === 3 && draft.focusNames.length === 0) ||
                (step === 5 && scoredCount !== criteria.length)
              }
              className="btn-primary"
            >
              Volgende <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={handleFinalize} className="btn-primary">
              <CheckCircle2 className="h-4 w-4" /> Finaliseren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RepresentativeStep({
  available,
  selected,
  onSelect,
  plannedDate,
  startTime,
  endTime,
  notifyRepresentative,
  onPlanningChange,
}: {
  available: typeof representatives;
  selected: string;
  onSelect: (id: string) => void;
  plannedDate: string;
  startTime: string;
  endTime: string;
  notifyRepresentative: boolean;
  onPlanningChange: (planning: Partial<Pick<Draft, "plannedDate" | "startTime" | "endTime" | "notifyRepresentative">>) => void;
}) {
  return (
    <div>
      <StepHeading icon={UserRound} title="Wie ga je begeleiden?" description="Je ziet alleen vertegenwoordigers binnen jouw huidige teamscope." />
      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
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
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={notifyRepresentative} onChange={(event) => onPlanningChange({ notifyRepresentative: event.target.checked })} />
          Vertegenwoordiger vooraf verwittigen
        </label>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {available.map((representative) => (
          <button
            type="button"
            key={representative.id}
            onClick={() => onSelect(representative.id)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
              selected === representative.id
                ? "border-brand-700 bg-brand-50 ring-4 ring-brand-50"
                : "border-slate-200 hover:border-brand-200"
            }`}
          >
            <Avatar initials={representative.initials} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{representative.firstName} {representative.lastName}</p>
              <p className="mt-1 text-xs text-slate-500">{representative.team} · {representative.level}</p>
            </div>
            {selected === representative.id && <CheckCircle2 className="h-5 w-5 text-brand-700" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreparationStep({ representative }: { representative: (typeof representatives)[number] }) {
  const previousActions = actionPoints.filter((item) => item.person === `${representative.firstName} ${representative.lastName}`);
  return (
    <div>
      <StepHeading icon={ClipboardCheck} title={`Voorbereiding voor ${representative.firstName}`} description="Recente resultaten en afspraken geven richting aan de focus van vandaag." />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Niveau" value={representative.level} detail="Huidig ontwikkelniveau" />
        <SummaryCard label="Team" value={representative.team} detail={representative.country} />
        <SummaryCard label="Laatste begeleiding" value={representative.lastCoaching} detail="Meest recente coachingmoment" />
        <SummaryCard label="Open actiepunten" value={`${representative.openActions}`} detail="Actief in opvolging" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
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
    </div>
  );
}

function FocusStep({ selected, onToggle }: { selected: string[]; onToggle: (name: string) => void }) {
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

function CriteriaStep({
  selectedFocus,
  personalCriteria,
}: {
  selectedFocus: typeof coachingFramework;
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
  selectedFocus,
  scoreCount,
  totalCriteria,
  actionCount,
}: {
  representative: (typeof representatives)[number];
  selectedFocus: string[];
  scoreCount: number;
  totalCriteria: number;
  actionCount: number;
}) {
  return (
    <div>
      <StepHeading icon={CheckCircle2} title="Controleer en rond af" description="Bewaar als concept of finaliseer en stuur automatisch een reflectietaak naar de vertegenwoordiger." />
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <SummaryCard label="Vertegenwoordiger" value={`${representative.firstName} ${representative.lastName}`} detail={`${representative.team} · ${representative.country}`} />
        <SummaryCard label="Focus" value={`${selectedFocus.length} fasen`} detail={selectedFocus.join(", ")} />
        <SummaryCard label="Scores" value={`${scoreCount} van ${totalCriteria}`} detail="Alle gekozen criteria zijn beoordeeld" />
        <SummaryCard label="Actiepunten" value={`${actionCount} afspraken`} detail="Direct zichtbaar in de opvolging" />
      </div>
      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
        <strong>Bij finaliseren:</strong> status wordt Wacht op VT en er ontstaat automatisch een reflectie met status Niet gestart.
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
