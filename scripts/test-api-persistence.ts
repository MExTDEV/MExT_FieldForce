import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import {
  createHelpRequest,
  saveCoaching,
  saveContactMoment,
  saveRetraining,
  saveSalesTraining,
} from "../lib/workflow-engine";
import type {
  AppModuleConfig,
  ManagedUser,
  PersonalCoachingCriterion,
  Representative,
  WorkflowState,
} from "../lib/types";

loadEnvFile();

const baseUrl = process.env.APP_URL?.replace(/\/+$/, "") || "http://localhost:3000";
const runId = `step9-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
const emptyState: WorkflowState = {
  interventions: [],
  reflections: [],
  approvals: [],
  contactMoments: [],
  helpRequests: [],
  linkedInterventions: [],
  retrainings: [],
  salesTrainings: [],
};

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json() as T & { error?: string; requestId?: string };
  assert.equal(
    response.ok,
    true,
    `${path} failed: ${payload.error ?? response.statusText} ${payload.requestId ?? ""}`
  );
  return payload;
}

async function main() {
  // The API smoke test uses the same explicit actorId mechanism as demo-mode
  // requests. This keeps the test deterministic and avoids borrowing a browser
  // session cookie. Start the dev server with NEXT_PUBLIC_AUTH_MODE=demo.
  const [{ users }, { modules }] = await Promise.all([
    json<{ users: ManagedUser[] }>("/api/users"),
    json<{ modules: AppModuleConfig[] }>("/api/modules"),
  ]);
  const enabledModules = new Set(
    modules.filter((module) => module.enabled).map((module) => module.code)
  );
  assert.ok(enabledModules.has("BEGELEIDINGEN"), "Begeleidingen must be active for this smoke test.");
  const actor =
    users.find((user) => user.role === "SUPER_ADMIN" && user.active) ??
    users.find((user) => user.role === "ADMIN" && user.active);
  assert.ok(actor, "No admin actor available.");
  const { representatives } = await json<{ representatives: Representative[] }>(
    `/api/representatives?actorId=${encodeURIComponent(actor.id)}`
  );
  const representative = representatives[0];
  assert.ok(representative, "No representative available.");
  const secondRepresentative =
    representatives.find((item) => item.country === representative.country && item.id !== representative.id) ??
    representative;

  const coaching = saveCoaching(emptyState, {
    id: `${runId}-coaching`,
    representativeId: representative.id,
    initiatorId: actor.id,
    ownerId: actor.id,
    plannedDate: "2026-07-15",
    startTime: "09:00",
    endTime: "11:00",
    notifyRepresentative: false,
    focusNames: ["Introductie"],
    scores: [{
      focus: "Introductie",
      criterion: "Zichzelf en MExT voorstellen",
      value: 75,
      previousScore: 50,
    }],
    actionPoints: [{
      title: `STEP9 actiepunt ${runId}`,
      type: "vaardigheid",
      due: "2026-07-31",
      owner: actor.id,
      priority: "hoog",
    }],
  }, "gepland", representatives);
  await json("/api/workflows/coaching", {
    method: "POST",
    body: JSON.stringify({ interventions: [coaching.intervention] }),
  });
  const updatedCoaching = saveCoaching(coaching.state, {
    id: coaching.intervention.id,
    representativeId: representative.id,
    initiatorId: actor.id,
    ownerId: actor.id,
    plannedDate: "2026-07-15",
    startTime: "09:00",
    endTime: "11:00",
    notifyRepresentative: false,
    focusNames: ["Introductie"],
    scores: coaching.intervention.scores,
    actionPoints: [{
      title: `STEP9 actiepunt bijgewerkt ${runId}`,
      type: "vaardigheid",
      due: "2026-08-01",
      owner: actor.id,
      priority: "hoog",
    }],
  }, "gepland", representatives);
  await json("/api/workflows/coaching", {
    method: "POST",
    body: JSON.stringify({ interventions: [updatedCoaching.intervention] }),
  });

  const contact = saveContactMoment(emptyState, {
    id: `${runId}-contact`,
    representativeId: representative.id,
    initiatorId: actor.id,
    plannedDate: "2026-07-17",
    startTime: "09:00",
    endTime: "10:00",
    reason: `STEP9 contact ${runId}`,
    reportedProblems: "Initiële smoketest",
    leaderThemes: ["KPI-opvolging"],
    representativeKpis: ["PV %"],
    representativeThemes: ["Prijsverdediging"],
    discussedThemes: ["KPI-opvolging"],
    conclusion: "Aangemaakt",
    actionPoints: [],
  }, "gepland", representatives);
  if (enabledModules.has("CONTACTMOMENTEN")) {
    await json("/api/workflows/contact-moments", {
      method: "POST",
      body: JSON.stringify({ contactMoments: [contact.contactMoment] }),
    });
  }
  const updatedContact = saveContactMoment(contact.state, {
    id: contact.contactMoment.id,
    representativeId: representative.id,
    initiatorId: actor.id,
    reason: `STEP9 contact bijgewerkt ${runId}`,
    reportedProblems: "Update bevestigd",
    leaderThemes: ["KPI-opvolging"],
    representativeKpis: ["PV %"],
    representativeThemes: ["Prijsverdediging"],
    discussedThemes: ["KPI-opvolging", "Prijsverdediging"],
    conclusion: "Bijgewerkt",
    actionPoints: [],
  }, "afgesloten", representatives);
  if (enabledModules.has("CONTACTMOMENTEN")) {
    await json("/api/workflows/contact-moments", {
      method: "POST",
      body: JSON.stringify({ contactMoments: [updatedContact.contactMoment] }),
    });
  }

  const help = createHelpRequest(emptyState, {
    representativeId: representative.id,
    requesterId: representative.id,
    subject: `STEP9 hulp ${runId}`,
    difficulty: "Integratietest",
    desiredResult: "Persistente opvolging",
    urgency: "normaal",
    explanation: "Aangemaakt via API-smoketest.",
  }, representatives);
  if (enabledModules.has("HULPAANVRAGEN")) {
    await json("/api/workflows/help-requests", {
      method: "POST",
      body: JSON.stringify({ helpRequests: [help.helpRequest] }),
    });
  }
  const updatedHelp = {
    ...help.helpRequest,
    subject: `STEP9 hulp bijgewerkt ${runId}`,
    urgency: "hoog" as const,
    status: "in_behandeling" as const,
    firstHandledByUserId: actor.id,
    firstHandledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (enabledModules.has("HULPAANVRAGEN")) {
    await json("/api/workflows/help-requests", {
      method: "POST",
      body: JSON.stringify({ helpRequests: [updatedHelp] }),
    });
  }

  const retraining = saveRetraining(emptyState, {
    id: `${runId}-retraining`,
    representativeId: representative.id,
    initiatorId: actor.id,
    theme: `STEP9 retraining ${runId}`,
    reason: "Integratietest",
    desiredImprovement: "Persistente training",
    kpi: "PV %",
    frameworkPhase: "Afsluiten",
    date: "2026-07-20",
    trainer: actor.firstName,
    actionPoints: [],
  }, "concept", representatives);
  if (enabledModules.has("RETRAININGEN")) {
    await json("/api/workflows/retrainings", {
      method: "POST",
      body: JSON.stringify({ retrainings: [retraining.retraining] }),
    });
  }
  const updatedRetraining = saveRetraining(retraining.state, {
    id: retraining.retraining.id,
    representativeId: representative.id,
    initiatorId: actor.id,
    theme: `STEP9 retraining bijgewerkt ${runId}`,
    reason: "Update",
    desiredImprovement: "Persistente training bevestigd",
    kpi: "PV %",
    frameworkPhase: "Afsluiten",
    date: "2026-07-21",
    trainer: actor.firstName,
    actionPoints: [],
  }, "gepland", representatives);
  if (enabledModules.has("RETRAININGEN")) {
    await json("/api/workflows/retrainings", {
      method: "POST",
      body: JSON.stringify({ retrainings: [updatedRetraining.retraining] }),
    });
  }

  const salesTraining = saveSalesTraining(emptyState, {
    id: `${runId}-sales-training`,
    initiatorId: actor.id,
    participantIds: [representative.id, secondRepresentative.id],
    theme: `STEP9 sales training ${runId}`,
    reason: "Integratietest",
    targetAudience: representative.team,
    kpi: "PV %",
    frameworkPhase: "Introductie",
    date: "2026-07-25",
    trainer: actor.firstName,
    conclusion: "",
    followUpAction: "",
  }, "concept", representatives);
  if (enabledModules.has("SALESTRAININGEN")) {
    await json("/api/workflows/sales-trainings", {
      method: "POST",
      body: JSON.stringify({ salesTrainings: [salesTraining.salesTraining] }),
    });
  }
  const updatedSalesTraining = saveSalesTraining(salesTraining.state, {
    id: salesTraining.salesTraining.id,
    initiatorId: actor.id,
    participantIds: salesTraining.salesTraining.participantIds,
    theme: `STEP9 sales training bijgewerkt ${runId}`,
    reason: "Update",
    targetAudience: representative.team,
    kpi: "PV %",
    frameworkPhase: "Introductie",
    date: "2026-07-26",
    trainer: actor.firstName,
    conclusion: "Bijgewerkt",
    followUpAction: "Opvolgen",
  }, "gepland", representatives);
  if (enabledModules.has("SALESTRAININGEN")) {
    await json("/api/workflows/sales-trainings", {
      method: "POST",
      body: JSON.stringify({ salesTrainings: [updatedSalesTraining.salesTraining] }),
    });
  }

  const now = new Date().toISOString();
  const criterion: PersonalCoachingCriterion = {
    id: `${runId}-criterion`,
    title: `STEP9 criterium ${runId}`,
    description: "Aangemaakt via integratiesmoketest.",
    focusName: "Introductie",
    representativeId: representative.id,
    createdByUserId: actor.id,
    teamId: representative.teamId,
    country: representative.country,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await json("/api/personal-criteria", {
    method: "POST",
    body: JSON.stringify({ criterion }),
  });
  await json(`/api/personal-criteria/${criterion.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      criterion: {
        title: `STEP9 criterium bijgewerkt ${runId}`,
        description: "Update via integratiesmoketest.",
        focusName: "Introductie",
      },
    }),
  });

  const [{ state }, { criteria }] = await Promise.all([
    json<{ state: WorkflowState }>(`/api/workflows?actorId=${encodeURIComponent(actor.id)}`),
    json<{ criteria: PersonalCoachingCriterion[] }>("/api/personal-criteria"),
  ]);
  assert.equal(state.interventions.find((item) => item.id === coaching.intervention.id)?.status, "gepland");
  assert.match(
    state.interventions.find((item) => item.id === coaching.intervention.id)?.actionPoints[0]?.title ?? "",
    /bijgewerkt/
  );
  if (enabledModules.has("CONTACTMOMENTEN")) {
    assert.equal(state.contactMoments.find((item) => item.id === contact.contactMoment.id)?.status, "afgesloten");
  }
  if (enabledModules.has("HULPAANVRAGEN")) {
    assert.equal(state.helpRequests.find((item) => item.id === help.helpRequest.id)?.status, "in_behandeling");
  }
  if (enabledModules.has("RETRAININGEN")) {
    assert.equal(state.retrainings.find((item) => item.id === retraining.retraining.id)?.status, "gepland");
  }
  if (enabledModules.has("SALESTRAININGEN")) {
    assert.equal(state.salesTrainings.find((item) => item.id === salesTraining.salesTraining.id)?.status, "gepland");
  }
  assert.match(criteria.find((item) => item.id === criterion.id)?.title ?? "", /bijgewerkt/);

  console.log(`STEP9 API persistence smoke test passed: ${runId} (${[...enabledModules].join(", ")})`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
