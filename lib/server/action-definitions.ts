import { prisma } from "@/lib/server/db";
import type { Country, MockUser, ScopedActionDefinition } from "@/lib/types";
import type { ActionScope, Priority } from "@prisma/client";
import { sanitizeRichText } from "@/lib/rich-text";
import { actorCanAccessCountry, actorCountryWhere } from "@/lib/server/authenticated-user";

export async function listEffectiveActionDefinitions(userId: string, date: Date): Promise<ScopedActionDefinition[]> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, country: true, teamId: true } });
  const keys = ["GLOBAL", `COUNTRY:${user.country}`, ...(user.teamId ? [`TEAM:${user.teamId}`] : []), `USER:${user.id}`];
  const definitions = await prisma.actionDefinition.findMany({
    where: {
      active: true, deletedAt: null, scopeKey: { in: keys }, validFrom: { lte: date },
      OR: [{ validUntil: null }, { validUntil: { gte: date } }],
    },
    include: { targetOverrides: { where: { scopeKey: { in: keys } } } },
    orderBy: [{ priority: "desc" }, { title: "asc" }],
  });
  return definitions.map((definition) => {
    const target = [`USER:${user.id}`, ...(user.teamId ? [`TEAM:${user.teamId}`] : []), `COUNTRY:${user.country}`]
      .map((key) => definition.targetOverrides.find((item) => item.scopeKey === key))
      .find(Boolean)?.targetValue ?? definition.targetValue;
    return {
      id: definition.id, title: definition.title, description: definition.description,
      tipsAndTricks: definition.tipsAndTricks, targetValue: target === null ? undefined : Number(target),
      priority: fromPriority(definition.priority), scope: definition.scope, scopeKey: definition.scopeKey,
      country: definition.country ?? undefined, teamId: definition.teamId ?? undefined, userId: definition.userId ?? undefined,
      active: definition.active, validFrom: definition.validFrom.toISOString().slice(0, 10),
      validUntil: definition.validUntil?.toISOString().slice(0, 10),
    };
  });
}

export async function listVisibleActionDefinitions(actor: MockUser) {
  return prisma.actionDefinition.findMany({
    where: {
      deletedAt: null,
      ...(["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role) ? {} : actor.role === "SALES_MANAGER" ? {
        OR: [{ scope: "GLOBAL" }, actorCountryWhere(actor), ...(actor.teamId ? [{ teamId: actor.teamId }] : []), { userId: actor.id }],
      } : {
        OR: [{ scope: "GLOBAL" }, { country: actor.country }, ...(actor.teamId ? [{ teamId: actor.teamId }] : []), { userId: actor.id }],
      }),
    },
    orderBy: [{ active: "desc" }, { priority: "desc" }, { title: "asc" }],
  });
}

export async function saveActionDefinition(actor: MockUser, input: {
  id?: string; title: string; description: string; tipsAndTricks: string; targetValue?: number;
  priority: "laag" | "normaal" | "hoog"; scope: ActionScope; country?: Country; teamId?: string; userId?: string;
  validFrom: string; validUntil?: string; active?: boolean;
}) {
  if (!input.title.trim()) throw new Error("Titel is verplicht.");
  if (!input.tipsAndTricks.trim()) throw new Error("Tips & Tricks is verplicht.");
  const validFrom = new Date(`${input.validFrom}T00:00:00.000Z`);
  const validUntil = input.validUntil ? new Date(`${input.validUntil}T23:59:59.999Z`) : null;
  if (!Number.isFinite(validFrom.getTime()) || (validUntil && validUntil < validFrom)) throw new Error("De geldigheidsperiode is ongeldig.");
  const scopeData = actionScopeData(input.scope, input);
  if (!["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) {
    if (input.scope === "GLOBAL") throw new Error("Alleen globaal beheer kan globale actiepunten aanmaken.");
    if (scopeData.country && !actorCanAccessCountry(actor, scopeData.country)) throw new Error("Dit actiepunt valt buiten je landenscope.");
    if (actor.role === "SALES_LEADER" && scopeData.teamId !== actor.teamId && scopeData.userId !== actor.id) throw new Error("Dit actiepunt valt buiten je teamscope.");
  }
  const data = {
    title: input.title.trim(), description: input.description.trim(), tipsAndTricks: sanitizeRichText(input.tipsAndTricks),
    targetValue: input.targetValue, priority: toPriority(input.priority), scope: input.scope, ...scopeData,
    active: input.active ?? true, validFrom, validUntil, updatedById: actor.id,
  };
  return input.id
    ? prisma.actionDefinition.update({ where: { id: input.id }, data })
    : prisma.actionDefinition.create({ data: { ...data, createdById: actor.id } });
}

export async function softDeleteActionDefinition(actor: MockUser, id: string) {
  const item = await prisma.actionDefinition.findUniqueOrThrow({ where: { id } });
  if (!["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role) && item.country && !actorCanAccessCountry(actor, item.country)) throw new Error("Geen toegang tot dit actiepunt.");
  return prisma.actionDefinition.update({ where: { id }, data: { active: false, deletedAt: new Date(), updatedById: actor.id } });
}

function actionScopeData(scope: ActionScope, input: { country?: Country; teamId?: string; userId?: string }) {
  if (scope === "GLOBAL") return { scopeKey: "GLOBAL", country: null, teamId: null, userId: null };
  if (scope === "COUNTRY" && input.country) return { scopeKey: `COUNTRY:${input.country}`, country: input.country, teamId: null, userId: null };
  if (scope === "TEAM" && input.teamId) return { scopeKey: `TEAM:${input.teamId}`, country: input.country ?? null, teamId: input.teamId, userId: null };
  if (scope === "USER" && input.userId) return { scopeKey: `USER:${input.userId}`, country: input.country ?? null, teamId: input.teamId ?? null, userId: input.userId };
  throw new Error("Selecteer een geldige scope.");
}

export function toPriority(value: "laag" | "normaal" | "hoog"): Priority {
  return value === "hoog" ? "HIGH" : value === "laag" ? "LOW" : "NORMAL";
}
export function fromPriority(value: Priority) { return value === "HIGH" ? "hoog" : value === "LOW" ? "laag" : "normaal"; }
