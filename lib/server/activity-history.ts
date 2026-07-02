import {
  activityHistoryLabels,
  type ActivityHistoryItem,
  type ActivityHistoryKind,
  type ActivityHistoryResponse,
} from "@/lib/activity-history";
import { getVisibleRepresentatives } from "@/lib/data-access";
import { buildVisibleCoachingWhere } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { listRepresentativesFromDatabase } from "@/lib/server/representatives";
import type { MockUser } from "@/lib/types";

export type ActivityHistoryQuery = {
  from: Date;
  to: Date;
  teamId?: string;
  representativeId?: string;
  page: number;
  pageSize: number;
};

type ActivityContext = {
  interventionId: string;
  representativeId: string;
  representativeName: string;
  teamId: string;
  teamName: string;
  status: string;
  title: string;
  initiatorName: string;
  ownerName: string;
};

export async function listActivityHistory(
  actor: MockUser,
  query: ActivityHistoryQuery
): Promise<ActivityHistoryResponse> {
  const representatives = getVisibleRepresentatives(actor, await listRepresentativesFromDatabase());
  const filteredRepresentatives = representatives.filter((item) =>
    (!query.teamId || item.teamId === query.teamId) &&
    (!query.representativeId || item.id === query.representativeId)
  );
  const allowedRepresentativeIds = new Set(representatives.map((item) => item.id));
  if (query.representativeId && !allowedRepresentativeIds.has(query.representativeId)) {
    return emptyResponse(representatives, query);
  }
  if (query.teamId && !representatives.some((item) => item.teamId === query.teamId)) {
    return emptyResponse(representatives, query);
  }

  const databaseRepresentativeIds = await resolveDatabaseRepresentativeIds(filteredRepresentatives.map((item) => item.id));
  if (!databaseRepresentativeIds.length) return emptyResponse(representatives, query);

  const dateRange = { gte: query.from, lte: query.to };
  const visibleWhere = buildVisibleCoachingWhere(actor, {
    representativeId: { in: databaseRepresentativeIds },
    ...(query.teamId ? { teamId: query.teamId } : {}),
  });
  const interventions = await prisma.intervention.findMany({
    where: {
      ...visibleWhere,
      OR: [
        { createdAt: dateRange },
        { startedAt: dateRange },
        { completedAt: dateRange },
        { finalizedAt: dateRange },
        { sentForApprovalAt: dateRange },
        { approvedByRepAt: dateRange },
        { updatedAt: dateRange },
        { actionPoints: { some: { OR: [{ createdAt: dateRange }, { updatedAt: dateRange }] } } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      teamId: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      finalizedAt: true,
      sentForApprovalAt: true,
      approvedByRepAt: true,
      representative: { select: { id: true, representativeId: true, firstName: true, lastName: true, teamId: true, team: { select: { name: true } } } },
      initiator: { select: { firstName: true, lastName: true } },
      owner: { select: { firstName: true, lastName: true } },
      actionPoints: {
        where: { OR: [{ createdAt: dateRange }, { updatedAt: dateRange }] },
        select: { id: true, title: true, status: true, createdAt: true, updatedAt: true, owner: { select: { firstName: true, lastName: true } } },
      },
    },
    distinct: ["id"],
  });

  const contexts = new Map<string, ActivityContext>();
  const activities: ActivityHistoryItem[] = [];
  for (const intervention of interventions) {
    const context: ActivityContext = {
      interventionId: intervention.id,
      representativeId: intervention.representative.representativeId ?? intervention.representative.id,
      representativeName: fullName(intervention.representative),
      teamId: intervention.teamId ?? intervention.representative.teamId ?? "",
      teamName: intervention.representative.team?.name ?? "Geen team",
      status: intervention.status,
      title: intervention.title,
      initiatorName: fullName(intervention.initiator),
      ownerName: fullName(intervention.owner),
    };
    contexts.set(intervention.id, context);
    addTimedActivity(activities, context, "coaching_planned", intervention.createdAt, query, context.initiatorName, context.title);
    addTimedActivity(activities, context, "coaching_started", intervention.startedAt, query, context.ownerName, context.title);
    addTimedActivity(activities, context, "coaching_completed", intervention.completedAt ?? intervention.finalizedAt, query, context.ownerName, context.title);
    addTimedActivity(activities, context, "coaching_sent_for_approval", intervention.sentForApprovalAt, query, context.ownerName, context.title);
    addTimedActivity(activities, context, "coaching_approved", intervention.approvedByRepAt, query, context.representativeName, context.title);
    for (const action of intervention.actionPoints) {
      const performer = fullName(action.owner);
      addTimedActivity(activities, context, "action_point_added", action.createdAt, query, performer, action.title, action.id);
      if (["AFGEROND", "BEHAALD"].includes(action.status)) {
        addTimedActivity(activities, context, "action_point_completed", action.updatedAt, query, performer, action.title, action.id);
      }
    }
  }

  const candidateAuditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Intervention",
      createdAt: dateRange,
      action: { in: [
        "workflow.coaching.save",
        "coaching.reopened",
        "coaching.comment_added",
        "coaching.score_changed",
        "coaching.pdf_exported",
        "coaching.action_point_added",
        "coaching.action_point_completed",
      ] },
    },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const candidateIds = [...new Set(candidateAuditLogs.map((item) => item.entityId))];
  if (candidateIds.length) {
    const visibleAuditInterventions = await prisma.intervention.findMany({
      where: { ...visibleWhere, id: { in: candidateIds } },
      select: { id: true },
      distinct: ["id"],
    });
    const visibleAuditIds = new Set(visibleAuditInterventions.map((item) => item.id));
    const missingIds = [...visibleAuditIds].filter((id) => !contexts.has(id));
    if (missingIds.length) {
      const missing = await loadContexts(actor, missingIds);
      missing.forEach((value, key) => contexts.set(key, value));
    }
    for (const audit of candidateAuditLogs) {
      if (!visibleAuditIds.has(audit.entityId)) continue;
      const context = contexts.get(audit.entityId);
      if (!context) continue;
      const kind = auditKind(audit.action, audit.newValue);
      const detail = auditDescription(audit.action, audit.newValue, context.title);
      activities.push(makeActivity(context, kind, audit.createdAt, fullName(audit.user), detail, audit.id));
    }
  }

  const unique = [...new Map(activities.map((item) => [
    `${item.kind}|${item.href}|${item.description}|${item.occurredAt.slice(0, 16)}`,
    item,
  ])).values()]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const total = unique.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  return {
    activities: unique.slice(start, start + query.pageSize),
    teams: teamOptions(representatives),
    representatives: representatives.map((item) => ({ id: item.id, label: `${item.firstName} ${item.lastName}`, teamId: item.teamId })),
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
  };
}

async function resolveDatabaseRepresentativeIds(publicIds: string[]) {
  if (!publicIds.length) return [];
  const users = await prisma.user.findMany({
    where: { role: "REPRESENTATIVE", OR: [{ id: { in: publicIds } }, { representativeId: { in: publicIds } }] },
    select: { id: true },
  });
  return users.map((item) => item.id);
}

async function loadContexts(actor: MockUser, ids: string[]) {
  const rows = await prisma.intervention.findMany({
    where: buildVisibleCoachingWhere(actor, { id: { in: ids } }),
    select: {
      id: true, title: true, status: true, teamId: true,
      representative: { select: { id: true, representativeId: true, firstName: true, lastName: true, teamId: true, team: { select: { name: true } } } },
      initiator: { select: { firstName: true, lastName: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
  });
  return new Map(rows.map((row) => [row.id, {
    interventionId: row.id,
    representativeId: row.representative.representativeId ?? row.representative.id,
    representativeName: fullName(row.representative),
    teamId: row.teamId ?? row.representative.teamId ?? "",
    teamName: row.representative.team?.name ?? "Geen team",
    status: row.status,
    title: row.title,
    initiatorName: fullName(row.initiator),
    ownerName: fullName(row.owner),
  }] as const));
}

function addTimedActivity(
  target: ActivityHistoryItem[], context: ActivityContext, kind: ActivityHistoryKind,
  occurredAt: Date | null, query: ActivityHistoryQuery, performedBy: string, description: string, suffix = ""
) {
  if (!occurredAt || occurredAt < query.from || occurredAt > query.to) return;
  target.push(makeActivity(context, kind, occurredAt, performedBy, description, suffix));
}

function makeActivity(context: ActivityContext, kind: ActivityHistoryKind, occurredAt: Date, performedBy: string, description: string, suffix = ""): ActivityHistoryItem {
  const anchor = kind === "action_point_added" || kind === "action_point_completed" ? "actiepunten"
    : kind === "score_changed" ? "scores"
      : kind === "comment_added" ? "opmerkingen"
        : kind === "pdf_exported" ? "rapport"
          : "overzicht";
  return {
    id: `${kind}:${context.interventionId}:${suffix || occurredAt.toISOString()}`,
    occurredAt: occurredAt.toISOString(),
    kind,
    typeLabel: activityHistoryLabels[kind],
    representativeId: context.representativeId,
    representativeName: context.representativeName,
    teamId: context.teamId,
    teamName: context.teamName,
    status: context.status,
    description,
    performedBy,
    href: `/begeleidingen/${context.interventionId}#${anchor}`,
  };
}

function auditKind(action: string, value: string | null): ActivityHistoryKind {
  if (action === "coaching.comment_added") return "comment_added";
  if (action === "coaching.score_changed") return "score_changed";
  if (action === "coaching.pdf_exported") return "pdf_exported";
  if (action === "coaching.action_point_added") return "action_point_added";
  if (action === "coaching.action_point_completed") return "action_point_completed";
  if (action === "workflow.coaching.save") {
    try {
      const status = String(value ? (JSON.parse(value) as { status?: string }).status ?? "" : "").toLowerCase();
      if (status === "gepland") return "coaching_planned";
      if (status === "in_uitvoering") return "coaching_started";
      if (["voltooid", "gefinaliseerd", "gesloten", "afgesloten"].includes(status)) return "coaching_completed";
    } catch {
      return "coaching_updated";
    }
  }
  return "coaching_updated";
}

function auditDescription(action: string, value: string | null, fallback: string) {
  if (action === "coaching.reopened") return "Afgewerkte begeleiding opnieuw geopend voor aanpassing.";
  try {
    const parsed = value ? JSON.parse(value) as { description?: string; label?: string } : undefined;
    return parsed?.description ?? parsed?.label ?? fallback;
  } catch {
    return fallback;
  }
}

function teamOptions(representatives: Awaited<ReturnType<typeof listRepresentativesFromDatabase>>) {
  return [...new Map(representatives.filter((item) => item.teamId).map((item) => [item.teamId, { id: item.teamId, label: item.team || "Geen team" }])).values()]
    .sort((left, right) => left.label.localeCompare(right.label, "nl"));
}

function emptyResponse(representatives: Awaited<ReturnType<typeof listRepresentativesFromDatabase>>, query: ActivityHistoryQuery): ActivityHistoryResponse {
  return { activities: [], teams: teamOptions(representatives), representatives: representatives.map((item) => ({ id: item.id, label: `${item.firstName} ${item.lastName}`, teamId: item.teamId })), page: 1, pageSize: query.pageSize, total: 0, totalPages: 1 };
}

function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}
