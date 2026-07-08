import { coachingOpenHref } from "@/lib/coaching/access";
import {
  completedCoachingStatuses,
  isCurrentUserCoachingTarget,
  localDateKey,
} from "@/lib/coaching/visibility";
import {
  sortPlanningItems,
  type PlanningItemType,
  type SortablePlanningItem,
} from "@/lib/planning-items";
import type {
  CoachingIntervention,
  ContactMoment,
  HelpRequest,
  MockUser,
  Retraining,
  SalesTraining,
} from "@/lib/types";

export type DashboardAttentionType =
  | "begeleiding"
  | "contactmoment"
  | "retraining"
  | "sales_training"
  | "hulpaanvraag";

export type DashboardAttentionSection = "todo" | "done";

export type DashboardAttentionItem = SortablePlanningItem & {
  recordId: string;
  type: DashboardAttentionType;
  typeLabel: string;
  title: string;
  subtitle: string;
  owner?: string;
  status: string;
  section: DashboardAttentionSection;
  timeLabel: string;
  href?: string;
};

export type HeaderTodoKind = "execution" | "approval";

export type HeaderTodoItem = DashboardAttentionItem & {
  todoKind: HeaderTodoKind;
};

export type DashboardAttentionSections = {
  todo: DashboardAttentionItem[];
  done: DashboardAttentionItem[];
};

type BuildDashboardAttentionInput = {
  currentUser: MockUser;
  today?: string;
  interventions?: CoachingIntervention[];
  contactMoments?: ContactMoment[];
  helpRequests?: HelpRequest[];
  retrainings?: Retraining[];
  salesTrainings?: SalesTraining[];
  representativeName?: (id?: string) => string;
  ownerName?: (id?: string) => string | undefined;
};

const cancelledStatuses = new Set(["geannuleerd"]);
const completedContactStatuses = new Set(["afgesloten"]);
const completedHelpRequestStatuses = new Set(["afgesloten"]);
const completedTrainingStatuses = new Set(["afgerond"]);
const pendingApprovalCoachingStatuses = new Set(["wacht_op_akkoord", "verzonden_ter_akkoord"]);

const typeLabels: Record<DashboardAttentionType, string> = {
  begeleiding: "Begeleiding",
  contactmoment: "Contactmoment",
  retraining: "Retraining",
  sales_training: "Sales training",
  hulpaanvraag: "Hulpaanvraag",
};

const planningTypes: Record<DashboardAttentionType, PlanningItemType> = {
  begeleiding: "COACHING",
  contactmoment: "CONTACT_MOMENT",
  retraining: "RETRAINING",
  sales_training: "SALES_TRAINING",
  hulpaanvraag: "HELP_REQUEST",
};

export function buildDashboardAttentionSections(
  input: BuildDashboardAttentionInput,
): DashboardAttentionSections {
  const today = input.today ?? localDateKey();
  const representativeName = input.representativeName ?? (() => "Onbekend");
  const ownerName = input.ownerName ?? (() => undefined);

  const items = sortPlanningItems([
    ...(input.interventions ?? []).flatMap((item) => {
      if (item.deletedAt || cancelledStatuses.has(item.status)) return [];
      const date = dateOnly(item.plannedDate ?? item.updatedAt);
      if (date !== today) return [];
      const participantName = item.subject
        ? `${item.subject.firstName} ${item.subject.lastName}`
        : representativeName(item.representativeId);
      return [
        attentionItem({
          recordId: item.id,
          type: "begeleiding",
          date,
          title: participantName,
          subtitle: item.title,
          owner: ownerName(item.ownerId),
          status: item.status,
          section: completedCoachingStatuses.has(item.status) ? "done" : "todo",
          startTime: item.startTime,
          endTime: item.endTime,
          href: coachingOpenHref(input.currentUser, item, today),
        }),
      ];
    }),
    ...(input.contactMoments ?? []).flatMap((item) => {
      const date = dateOnly(item.createdAt);
      if (date !== today) return [];
      return [
        attentionItem({
          recordId: item.id,
          type: "contactmoment",
          date,
          title: representativeName(item.representativeId),
          subtitle: item.reason,
          owner: ownerName(item.ownerId),
          status: item.status,
          section: completedContactStatuses.has(item.status) ? "done" : "todo",
          href: `/contactmomenten/${item.id}`,
        }),
      ];
    }),
    ...(input.retrainings ?? []).flatMap((item) => {
      if (cancelledStatuses.has(item.status)) return [];
      const date = dateOnly(item.date);
      if (date !== today) return [];
      return [
        attentionItem({
          recordId: item.id,
          type: "retraining",
          date,
          title: item.theme || "Retraining",
          subtitle: representativeName(item.representativeId),
          owner: item.trainer || ownerName(item.initiatorId),
          status: item.status,
          section: completedTrainingStatuses.has(item.status) ? "done" : "todo",
          href: `/retrainingen/${item.id}`,
        }),
      ];
    }),
    ...(input.salesTrainings ?? []).flatMap((item) => {
      if (cancelledStatuses.has(item.status)) return [];
      const date = dateOnly(item.date);
      if (date !== today) return [];
      return [
        attentionItem({
          recordId: item.id,
          type: "sales_training",
          date,
          title: item.theme || "Sales training",
          subtitle: `${item.participantIds.length} deelnemers`,
          owner: item.trainer || ownerName(item.initiatorId),
          status: item.status,
          section: completedTrainingStatuses.has(item.status) ? "done" : "todo",
          href: `/sales-trainingen/${item.id}`,
        }),
      ];
    }),
    ...(input.helpRequests ?? []).flatMap((item) => {
      if (cancelledStatuses.has(item.status)) return [];
      const date = dateOnly(item.createdAt);
      if (date !== today) return [];
      return [
        attentionItem({
          recordId: item.id,
          type: "hulpaanvraag",
          date,
          title: item.subject || "Hulpaanvraag",
          subtitle: representativeName(item.representativeId),
          owner: ownerName(item.requesterId),
          status: item.status,
          section: completedHelpRequestStatuses.has(item.status) ? "done" : "todo",
          href: `/hulpaanvragen/${item.id}`,
        }),
      ];
    }),
  ]);

  return {
    todo: items.filter((item) => item.section === "todo"),
    done: items.filter((item) => item.section === "done"),
  };
}

export function buildHeaderTodoItems(input: BuildDashboardAttentionInput): HeaderTodoItem[] {
  const today = input.today ?? localDateKey();
  const representativeName = input.representativeName ?? (() => "Onbekend");
  const ownerName = input.ownerName ?? (() => undefined);
  const personalInput = {
    ...input,
    interventions: (input.interventions ?? []).filter((item) =>
      isCurrentUserCoachingTarget(input.currentUser, item)
    ),
    contactMoments: (input.contactMoments ?? []).filter((item) =>
      isCurrentUserLinkedToRepresentative(input.currentUser, item.representativeId)
    ),
    helpRequests: (input.helpRequests ?? []).filter((item) =>
      isCurrentUserLinkedToRepresentative(input.currentUser, item.representativeId) ||
      isCurrentUserLinkedToRepresentative(input.currentUser, item.requesterId)
    ),
    retrainings: (input.retrainings ?? []).filter((item) =>
      isCurrentUserLinkedToRepresentative(input.currentUser, item.representativeId)
    ),
    salesTrainings: (input.salesTrainings ?? []).filter((item) =>
      item.participantIds.some((id) => isCurrentUserLinkedToRepresentative(input.currentUser, id))
    ),
  };
  const executionTodos = buildDashboardAttentionSections(personalInput).todo.map((item) => ({
    ...item,
    todoKind: "execution" as const,
  }));
  const approvalTodos = (personalInput.interventions ?? []).flatMap((item): HeaderTodoItem[] => {
    if (
      item.deletedAt ||
      item.approvedByRepAt ||
      item.approvedByRepId ||
      !pendingApprovalCoachingStatuses.has(item.status)
    ) {
      return [];
    }

    const participantName = item.subject
      ? `${item.subject.firstName} ${item.subject.lastName}`
      : representativeName(item.representativeId);
    const date = dateOnly(item.plannedDate ?? item.sentForApprovalAt ?? item.finalizedAt ?? item.updatedAt);

    return [{
      ...attentionItem({
        recordId: item.id,
        type: "begeleiding",
        date,
        title: participantName,
        subtitle: item.title,
        owner: ownerName(item.ownerId),
        status: item.status,
        section: "todo",
        startTime: item.startTime,
        endTime: item.endTime,
        href: coachingOpenHref(input.currentUser, item, today),
      }),
      todoKind: "approval",
    }];
  });

  return sortPlanningItems([...executionTodos, ...approvalTodos]);
}

export function shouldAnimateTodoBell(openTodoCount: number, prefersReducedMotion: boolean) {
  return openTodoCount > 0 && !prefersReducedMotion;
}

function attentionItem(input: {
  recordId: string;
  type: DashboardAttentionType;
  date: string;
  title: string;
  subtitle: string;
  owner?: string;
  status: string;
  section: DashboardAttentionSection;
  startTime?: string;
  endTime?: string;
  href?: string;
}): DashboardAttentionItem {
  return {
    id: `${input.type}-${input.recordId}`,
    recordId: input.recordId,
    type: input.type,
    typeLabel: typeLabels[input.type],
    title: input.title,
    subtitle: input.subtitle,
    owner: input.owner,
    status: input.status,
    section: input.section,
    date: input.date,
    planningSource: "FIELD_FORCE",
    planningType: planningTypes[input.type],
    startTime: input.startTime,
    endTime: input.endTime,
    timeLabel: formatTimeLabel(input.startTime, input.endTime),
    href: input.href,
  };
}

function dateOnly(value?: string) {
  return value?.slice(0, 10) ?? "";
}

function formatTimeLabel(startTime?: string, endTime?: string) {
  if (startTime && endTime) return `${startTime}-${endTime}`;
  if (startTime) return startTime;
  return "Hele dag";
}

function isCurrentUserLinkedToRepresentative(currentUser: MockUser, representativeId?: string) {
  return Boolean(
    representativeId &&
    [currentUser.id, currentUser.representativeId].filter(Boolean).includes(representativeId)
  );
}
