"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  Send,
  Target,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useRepresentatives } from "@/components/representatives-provider";
import { useWorkflow } from "@/components/workflow-provider";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import type { ApprovalStatus } from "@/lib/types";

export function MyReflectionsPage({ id }: { id?: string }) {
  const { user } = useSession();
  const { state, openReflections, submitReflection } = useWorkflow();
  const [submitted, setSubmitted] = useState(false);

  if (user.role !== "REPRESENTATIVE") {
    return <EmptyState title="Alleen voor vertegenwoordigers" description="Schakel via de gebruikerswisselaar naar een vertegenwoordiger om eigen reflecties te bekijken." />;
  }

  const reflections = openReflections(user);
  if (!id) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Mijn taken" title="Mijn reflecties" description="Vul na een begeleiding kort in wat je meeneemt en waarop je verder werkt." />
        {reflections.length === 0 ? (
          <EmptyState title="Geen open reflecties" description="Nieuwe reflectietaken verschijnen hier automatisch zodra een begeleiding is gefinaliseerd." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {reflections.map((reflection) => {
              const intervention = state.interventions.find((item) => item.id === reflection.interventionId);
              return (
                <Link key={reflection.id} href={`/mijn-reflecties/${reflection.id}`} className="card group p-5 transition hover:border-brand-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                      <MessageSquareText className="h-6 w-6" />
                    </div>
                    <StatusBadge status="wacht_op_vt" label="Niet gestart" />
                  </div>
                  <h2 className="mt-5 font-bold text-slate-950">{intervention?.title ?? "Begeleiding"}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {intervention?.focusNames.join(", ")} · {intervention?.scores.length ?? 0} scores
                  </p>
                  <p className="mt-5 text-sm font-semibold text-brand-700 group-hover:underline">Reflectie invullen</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const reflection = state.reflections.find((item) => item.id === id);
  const intervention = reflection
    ? state.interventions.find((item) => item.id === reflection.interventionId)
    : undefined;
  const ownsReflection = reflection?.representativeId === user.representativeId;

  if (!reflection || !intervention || !ownsReflection) {
    return <EmptyState title="Reflectie niet beschikbaar" description="Deze reflectie bestaat niet of hoort niet bij de ingelogde vertegenwoordiger." />;
  }

  return (
    <ReflectionForm
      initial={{
        learnedText: reflection.learnedText,
        workOnText: reflection.workOnText,
        concreteGoalText: reflection.concreteGoalText,
      }}
      title={intervention.title}
      submitted={submitted || reflection.status === "ingediend"}
      onSubmit={(answers) => {
        submitReflection(reflection.id, answers);
        setSubmitted(true);
      }}
    />
  );
}

function ReflectionForm({
  initial,
  title,
  submitted,
  onSubmit,
}: {
  initial: { learnedText: string; workOnText: string; concreteGoalText: string };
  title: string;
  submitted: boolean;
  onSubmit: (answers: typeof initial) => void;
}) {
  const [answers, setAnswers] = useState(initial);
  const complete = Object.values(answers).every((value) => value.trim().length >= 3);

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8 text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-950">Reflectie ingediend</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Het verslag staat nu klaar onder Mijn verslagen om te lezen en te bevestigen.</p>
          <Link href="/mijn-verslagen" className="btn-primary mt-7">Naar mijn verslagen</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/mijn-reflecties" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Terug naar reflecties
      </Link>
      <PageHeader eyebrow="Reflectie" title={title} description="Drie korte antwoorden volstaan. Formuleer vooral concreet wat je in de praktijk gaat doen." />
      <div className="card space-y-6 p-5 sm:p-7">
        <ReflectionQuestion
          number="1"
          label="Wat heb je geleerd?"
          value={answers.learnedText}
          onChange={(value) => setAnswers((current) => ({ ...current, learnedText: value }))}
        />
        <ReflectionQuestion
          number="2"
          label="Waaraan ga je werken?"
          value={answers.workOnText}
          onChange={(value) => setAnswers((current) => ({ ...current, workOnText: value }))}
        />
        <ReflectionQuestion
          number="3"
          label="Welk concreet doel wil je bereiken?"
          value={answers.concreteGoalText}
          onChange={(value) => setAnswers((current) => ({ ...current, concreteGoalText: value }))}
        />
        <button type="button" disabled={!complete} onClick={() => onSubmit(answers)} className="btn-primary w-full sm:w-auto">
          <Send className="h-4 w-4" /> Indienen
        </button>
      </div>
    </div>
  );
}

function ReflectionQuestion({
  number,
  label,
  value,
  onChange,
}: {
  number: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-3 font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-sm text-brand-700">{number}</span>
        {label}
      </span>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        placeholder="Schrijf een kort, concreet antwoord..."
      />
    </label>
  );
}

export function MyReportsPage({ id }: { id?: string }) {
  const { user } = useSession();
  const { state, pendingApprovals, confirmApproval } = useWorkflow();
  const [confirmed, setConfirmed] = useState(false);

  if (user.role !== "REPRESENTATIVE") {
    return <EmptyState title="Alleen voor vertegenwoordigers" description="Schakel via de gebruikerswisselaar naar een vertegenwoordiger om eigen verslagen te bekijken." />;
  }

  const approvals = pendingApprovals(user);
  if (!id) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Mijn taken" title="Mijn verslagen" description="Lees het afgewerkte coachingsverslag en bevestig of je akkoord bent." />
        {approvals.length === 0 ? (
          <EmptyState title="Geen verslagen wachten op akkoord" description="Na het indienen van een reflectie verschijnt het bijbehorende verslag hier." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {approvals.map((approval) => {
              const intervention = state.interventions.find((item) => item.id === approval.interventionId);
              return (
                <Link key={approval.id} href={`/mijn-verslagen/${approval.id}`} className="card group p-5 transition hover:border-brand-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-fuchsia-50 text-fuchsia-700">
                      <ClipboardCheck className="h-6 w-6" />
                    </div>
                    <StatusBadge status="wacht_op_akkoord" />
                  </div>
                  <h2 className="mt-5 font-bold text-slate-950">{intervention?.title ?? "Coachingsverslag"}</h2>
                  <p className="mt-2 text-sm text-slate-500">{intervention?.focusNames.length ?? 0} focusfasen · {intervention?.actionPoints.length ?? 0} actiepunten</p>
                  <p className="mt-5 text-sm font-semibold text-brand-700 group-hover:underline">Verslag bekijken</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const approval = state.approvals.find((item) => item.id === id);
  const intervention = approval
    ? state.interventions.find((item) => item.id === approval.interventionId)
    : undefined;
  const reflection = intervention
    ? state.reflections.find((item) => item.interventionId === intervention.id)
    : undefined;
  const ownsApproval = approval?.representativeId === user.representativeId;

  if (!approval || !intervention || !reflection || !ownsApproval) {
    return <EmptyState title="Verslag niet beschikbaar" description="Dit verslag bestaat niet of hoort niet bij de ingelogde vertegenwoordiger." />;
  }

  if (confirmed || approval.status) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8 text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-950">Verslag bevestigd</h1>
          <p className="mt-3 text-sm text-slate-500">De begeleiding is afgesloten en blijft beschikbaar in de historiek.</p>
          <Link href="/dashboard" className="btn-primary mt-7">Naar dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <ReportDetail
      intervention={intervention}
      reflection={reflection}
      onConfirm={(status, comment) => {
        confirmApproval(approval.id, status, comment);
        setConfirmed(true);
      }}
    />
  );
}

function ReportDetail({
  intervention,
  reflection,
  onConfirm,
}: {
  intervention: ReturnType<typeof useWorkflow>["state"]["interventions"][number];
  reflection: ReturnType<typeof useWorkflow>["state"]["reflections"][number];
  onConfirm: (status: ApprovalStatus, comment: string) => void;
}) {
  const [choice, setChoice] = useState<ApprovalStatus>("gelezen_akkoord");
  const [comment, setComment] = useState("");
  const { representatives } = useRepresentatives();
  const representative = representatives.find((item) => item.id === intervention.representativeId);
  const valid = choice === "gelezen_akkoord" || comment.trim().length >= 3;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/mijn-verslagen" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Terug naar verslagen
      </Link>
      <PageHeader eyebrow="Coachingsverslag" title={intervention.title} description={`${representative?.team ?? ""} · ${new Date(intervention.updatedAt).toLocaleDateString("nl-BE")}`} />

      <section className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Scores</h2>
          <StatusBadge status={intervention.status} />
        </div>
        <div className="mt-5 space-y-3">
          {intervention.scores.map((score) => (
            <div key={score.criterion} className="grid gap-2 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1fr_100px_100px] sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{score.focus}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{score.criterion}</p>
              </div>
              <p className="text-xs text-slate-500">Vorige: <strong>{score.previousScore}%</strong></p>
              <p className="text-lg font-bold text-slate-950">{score.value === "NVT" ? "NVT" : `${score.value}%`}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-brand-700" />
            <h2 className="font-bold text-slate-950">Actiepunten</h2>
          </div>
          <div className="mt-5 space-y-3">
            {intervention.actionPoints.length ? intervention.actionPoints.map((action) => (
              <div key={action.id} className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{action.title}</p>
                <p className="mt-1 text-xs text-slate-500">{action.type} · tegen {action.due || "geen datum"}</p>
              </div>
            )) : <p className="text-sm text-slate-500">Geen actiepunten toegevoegd.</p>}
          </div>
        </section>
        <section className="card p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <MessageSquareText className="h-5 w-5 text-brand-700" />
            <h2 className="font-bold text-slate-950">Jouw reflectie</h2>
          </div>
          <dl className="mt-5 space-y-4 text-sm">
            <ReflectionAnswer label="Geleerd" value={reflection.learnedText} />
            <ReflectionAnswer label="Werken aan" value={reflection.workOnText} />
            <ReflectionAnswer label="Concreet doel" value={reflection.concreteGoalText} />
          </dl>
        </section>
      </div>

      <section className="card p-5 sm:p-7">
        <h2 className="font-bold text-slate-950">Bevestig het verslag</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ChoiceButton
            active={choice === "gelezen_akkoord"}
            label="Gelezen en akkoord"
            onClick={() => setChoice("gelezen_akkoord")}
          />
          <ChoiceButton
            active={choice === "gelezen_niet_akkoord"}
            label="Gelezen maar niet akkoord"
            onClick={() => setChoice("gelezen_niet_akkoord")}
          />
        </div>
        {choice === "gelezen_niet_akkoord" && (
          <label className="mt-5 block">
            <span className="text-sm font-bold text-slate-900">Waarom ben je niet akkoord?</span>
            <textarea
              rows={4}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              placeholder="Commentaar is verplicht bij niet akkoord..."
            />
          </label>
        )}
        <button type="button" disabled={!valid} onClick={() => onConfirm(choice, comment)} className="btn-primary mt-6">
          <CheckCircle2 className="h-4 w-4" /> Bevestigen en afsluiten
        </button>
      </section>
    </div>
  );
}

function ChoiceButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-16 rounded-2xl border px-5 text-left text-sm font-bold transition ${
        active ? "border-brand-700 bg-brand-50 text-brand-800 ring-4 ring-brand-50" : "border-slate-200 text-slate-600 hover:border-brand-200"
      }`}
    >
      {label}
    </button>
  );
}

function ReflectionAnswer({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 leading-6 text-slate-700">{value}</dd>
    </div>
  );
}
