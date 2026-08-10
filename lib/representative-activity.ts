import type { CoachingIntervention, ContactMoment, HelpRequest, Retraining, SalesTraining, WorkflowActionPoint } from "@/lib/types";
import type { HistoricalActionPoint, HistoricalCoaching, HistoricalContactMoment } from "@/lib/performance-data";

export type RepresentativeActivityType =
  | "coaching"
  | "actionPoint"
  | "contactMoment"
  | "helpRequest"
  | "evaluation"
  | "retraining"
  | "salesTraining";

export type RepresentativeActivity = {
  id: string;
  type: RepresentativeActivityType;
  date: string;
  title: string;
  description?: string;
  status?: string;
  targetUrl: string;
};

export type RepresentativeEvaluationActivity = {
  id: string;
  date: string;
  title: string;
  status?: string;
  targetUrl: string;
};

type ActivityInput = {
  representativeId: string;
  coachings: HistoricalCoaching[];
  workflowCoachings: CoachingIntervention[];
  historicalActionPoints: HistoricalActionPoint[];
  contactMoments: ContactMoment[];
  historicalContactMoments: HistoricalContactMoment[];
  helpRequests: HelpRequest[];
  retrainings: Retraining[];
  salesTrainings: SalesTraining[];
  evaluations?: RepresentativeEvaluationActivity[];
};

const closedActionPointStatuses = new Set(["afgerond", "behaald", "niet_behaald", "geannuleerd"]);

export function buildRepresentativeActivities(input: ActivityInput): RepresentativeActivity[] {
  const activities: RepresentativeActivity[] = [];

  for (const coaching of input.coachings.filter((item) => item.representativeId === input.representativeId)) {
    activities.push({
      id: `coaching:${coaching.id}`,
      type: "coaching",
      date: coaching.date,
      title: "Begeleiding",
      status: coaching.status,
      targetUrl: `/begeleidingen/${encodeURIComponent(coaching.id)}`,
    });
  }

  for (const coaching of input.workflowCoachings.filter((item) => item.representativeId === input.representativeId)) {
    activities.push({
      id: `coaching:${coaching.id}`,
      type: "coaching",
      date: coaching.actualStartedAt ?? coaching.finalizedAt ?? coaching.plannedDate ?? coaching.updatedAt,
      title: coaching.title || "Begeleiding",
      status: coaching.status,
      targetUrl: `/begeleidingen/${encodeURIComponent(coaching.id)}`,
    });
    addWorkflowActionPoints(activities, coaching.actionPoints, `/begeleidingen/${encodeURIComponent(coaching.id)}#actiepunten`, coaching.actualStartedAt ?? coaching.finalizedAt ?? coaching.plannedDate ?? coaching.updatedAt);
  }

  for (const actionPoint of input.historicalActionPoints.filter((item) => item.representativeId === input.representativeId)) {
    activities.push({
      id: `actionPoint:${actionPoint.id}`,
      type: "actionPoint",
      date: actionPoint.closedAt ?? actionPoint.updatedAt ?? actionPoint.due,
      title: actionPoint.title,
      status: actionPoint.status,
      targetUrl: actionPointHref(input.representativeId, actionPoint.id),
    });
  }

  for (const contact of input.historicalContactMoments.filter((item) => item.representativeId === input.representativeId)) {
    activities.push({
      id: `contactMoment:${contact.id}`,
      type: "contactMoment",
      date: contact.date,
      title: contact.reason || "Contactmoment",
      status: contact.status,
      targetUrl: `/contactmomenten/${encodeURIComponent(contact.id)}`,
    });
  }

  for (const contact of input.contactMoments.filter((item) => item.representativeId === input.representativeId)) {
    activities.push({
      id: `contactMoment:${contact.id}`,
      type: "contactMoment",
      date: contact.closedAt ?? contact.sharedAt ?? contact.plannedDate ?? contact.updatedAt,
      title: contact.subject || contact.reason || "Contactmoment",
      status: contact.status,
      targetUrl: `/contactmomenten/${encodeURIComponent(contact.id)}`,
    });
    addWorkflowActionPoints(activities, contact.actionPoints, `/contactmomenten/${encodeURIComponent(contact.id)}#actiepunten`, contact.closedAt ?? contact.sharedAt ?? contact.plannedDate ?? contact.updatedAt);
  }

  for (const request of input.helpRequests.filter((item) => item.representativeId === input.representativeId)) {
    activities.push({
      id: `helpRequest:${request.id}`,
      type: "helpRequest",
      date: request.firstHandledAt ?? request.updatedAt ?? request.createdAt,
      title: request.subject || "Hulpaanvraag",
      status: request.status,
      targetUrl: `/hulpaanvragen/${encodeURIComponent(request.id)}`,
    });
  }

  for (const retraining of input.retrainings.filter((item) => item.representativeId === input.representativeId)) {
    activities.push({
      id: `retraining:${retraining.id}`,
      type: "retraining",
      date: retraining.completedAt ?? retraining.date ?? retraining.updatedAt,
      title: retraining.theme || "Retraining",
      status: retraining.status,
      targetUrl: `/retrainingen/${encodeURIComponent(retraining.id)}`,
    });
    addWorkflowActionPoints(activities, retraining.actionPoints, `/retrainingen/${encodeURIComponent(retraining.id)}#actiepunten`, retraining.completedAt ?? retraining.date ?? retraining.updatedAt);
  }

  for (const training of input.salesTrainings.filter((item) => item.participantIds.includes(input.representativeId))) {
    activities.push({
      id: `salesTraining:${training.id}`,
      type: "salesTraining",
      date: training.completedAt ?? training.date ?? training.updatedAt,
      title: training.theme || "Salestraining",
      status: training.status,
      targetUrl: `/sales-trainingen/${encodeURIComponent(training.id)}`,
    });
    for (const actionPoint of training.actionPoints) {
      if (!actionPoint.representativeIds.includes(input.representativeId)) continue;
      addWorkflowActionPoints(activities, [actionPoint], `/sales-trainingen/${encodeURIComponent(training.id)}#actiepunten`, training.completedAt ?? training.date ?? training.updatedAt);
    }
  }

  for (const evaluation of input.evaluations ?? []) {
    activities.push({
      id: `evaluation:${evaluation.id}`,
      type: "evaluation",
      date: evaluation.date,
      title: evaluation.title,
      status: evaluation.status,
      targetUrl: evaluation.targetUrl,
    });
  }

  const unique = new Map<string, RepresentativeActivity>();
  for (const activity of activities) {
    if (!unique.has(activity.id)) unique.set(activity.id, activity);
  }
  return [...unique.values()]
    .filter((activity) => !Number.isNaN(new Date(activity.date).getTime()))
    .sort((left, right) => {
      const dateOrder = new Date(right.date).getTime() - new Date(left.date).getTime();
      return dateOrder || left.id.localeCompare(right.id);
    });
}

function addWorkflowActionPoints(
  target: RepresentativeActivity[],
  actionPoints: WorkflowActionPoint[],
  targetUrl: string,
  parentDate: string,
) {
  for (const actionPoint of actionPoints) {
    target.push({
      id: `actionPoint:${actionPoint.id}`,
      type: "actionPoint",
      date: actionPoint.closedAt ?? parentDate ?? actionPoint.due,
      title: actionPoint.title,
      status: actionPoint.status,
      targetUrl,
    });
  }
}

export function isOpenRepresentativeActionPoint(status?: string) {
  return !closedActionPointStatuses.has(status ?? "");
}

export function actionPointHref(representativeId: string, actionPointId: string) {
  const params = new URLSearchParams({ representativeId, actionPointId });
  return `/actiepunten?${params.toString()}`;
}
