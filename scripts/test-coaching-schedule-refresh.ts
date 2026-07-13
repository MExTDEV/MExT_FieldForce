import assert from "node:assert/strict";

import {
  applyOutlookSyncToWorkflowStatePatch,
  mergeWorkflowStatePatch,
} from "@/lib/workflow-state-patch";
import type { CoachingIntervention, WorkflowState } from "@/lib/types";

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

function plannedCoaching(id: string, plannedDate: string, startTime: string): CoachingIntervention {
  return {
    id,
    representativeId: "rep-1",
    initiatorId: "leader-1",
    ownerId: "leader-1",
    country: "BE",
    teamId: "team-1",
    title: `Begeleiding ${id}`,
    status: "gepland",
    plannedDate,
    startTime,
    endTime: "11:00",
    notifyRepresentative: false,
    outlookSyncStatus: "NOT_SYNCED",
    focusNames: ["Introductie"],
    scores: [],
    actionPoints: [],
    createdAt: "2026-07-13T08:00:00.000Z",
    updatedAt: "2026-07-13T08:00:00.000Z",
  };
}

const existingEarly = plannedCoaching("coaching-early", "2026-07-15", "09:00");
const existingLate = plannedCoaching("coaching-late", "2026-07-20", "09:00");
const scheduled = plannedCoaching("coaching-middle", "2026-07-17", "09:00");

const withScheduled = mergeWorkflowStatePatch({
  ...emptyState,
  interventions: [existingEarly, existingLate],
}, {
  interventions: [scheduled],
});

assert.deepEqual(
  withScheduled.interventions
    .slice()
    .sort((left, right) => `${left.plannedDate}T${left.startTime}`.localeCompare(`${right.plannedDate}T${right.startTime}`))
    .map((item) => item.id),
  ["coaching-early", "coaching-middle", "coaching-late"],
  "Een ingeplande begeleiding blijft sorteerbaar volgens dezelfde datum/tijdvelden als na refetch."
);

const syncErrorPatch = applyOutlookSyncToWorkflowStatePatch({
  interventions: [scheduled],
}, [{
  interventionId: scheduled.id,
  outlookSyncStatus: "ERROR",
  syncError: "Outlook-sync mislukt in regressietest.",
}]);
const withSyncError = mergeWorkflowStatePatch(withScheduled, syncErrorPatch);
const syncedRecord = withSyncError.interventions.find((item) => item.id === scheduled.id);

assert.ok(syncedRecord);
assert.equal(syncedRecord.outlookSyncStatus, "ERROR");
assert.equal(syncedRecord.syncError, "Outlook-sync mislukt in regressietest.");

const afterRefetch = mergeWorkflowStatePatch(withSyncError, {
  interventions: [{ ...scheduled, outlookSyncStatus: "ERROR", syncError: "Outlook-sync mislukt in regressietest." }],
});

assert.equal(
  afterRefetch.interventions.filter((item) => item.id === scheduled.id).length,
  1,
  "Een lokale update gevolgd door refetch mag geen dubbele begeleiding tonen."
);

console.log("Begeleiding refresh-state merge, sorteerdata, Outlook-foutstatus en deduplicatie zijn correct.");
