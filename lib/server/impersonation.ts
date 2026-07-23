import { badRequest, forbidden } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { can } from "@/lib/permissions";
import { auth, authMode } from "@/auth";
import type { Country, ImpersonationHistoryRecord, MockUser, Role } from "@/lib/types";

const MAX_SESSION_MS = 60 * 60 * 1000;
const reasonTypes = new Set(["USER_SUPPORT", "REPRODUCE_ERROR", "CHECK_PERMISSIONS", "FUNCTIONAL_TEST", "OTHER"]);

const securityLevel: Record<Role, number> = {
  REPRESENTATIVE: 1,
  SERVICE_OPERATOR: 1,
  SALES_LEADER: 2,
  SALES_MANAGER: 3,
  COUNTRY_MANAGER: 3,
  GROUP_MANAGER: 4,
  ADMIN: 5,
  SUPER_ADMIN: 6,
};

export type ImpersonationDecision = { allowed: true } | { allowed: false; reason: string };

export function canImpersonateUser(actor: MockUser, target: MockUser & { active?: boolean }): ImpersonationDecision {
  if (!can(actor, "users.impersonate")) return denied("Het recht users.impersonate ontbreekt.");
  if (!target.id || target.active === false) return denied("Doelgebruiker bestaat niet of is niet actief.");
  if (actor.id === target.id) return denied("Je kunt jezelf niet impersonaten.");
  if (actor.role !== "SUPER_ADMIN" && securityLevel[target.role] > securityLevel[actor.role]) {
    return denied("De doelgebruiker heeft een hoger beveiligingsniveau.");
  }
  if (["GROUP_MANAGER", "SUPER_ADMIN"].includes(actor.role)) return { allowed: true };
  if (["SALES_MANAGER", "ADMIN"].includes(actor.role)) {
    const countries = actor.countryAccess?.length ? actor.countryAccess : actor.role === "ADMIN" ? [actor.country] : [];
    return countries.includes(target.country) ? { allowed: true } : denied("De doelgebruiker valt buiten je landenscope.");
  }
  if (actor.role === "COUNTRY_MANAGER") {
    return actor.country === target.country ? { allowed: true } : denied("De doelgebruiker valt buiten je land.");
  }
  if (actor.role === "SALES_LEADER") {
    return Boolean(actor.teamId && target.teamId === actor.teamId)
      ? { allowed: true }
      : denied("De doelgebruiker valt buiten je teamscope.");
  }
  return denied("Binnen je gebruikersscope is geen geldig doel beschikbaar.");
}

export function validateImpersonationReason(reasonType: string, reasonText?: string) {
  if (!reasonTypes.has(reasonType)) badRequest("Selecteer een geldige reden.");
  const normalizedText = reasonText?.trim() ?? "";
  if (reasonType === "OTHER" && !normalizedText) badRequest("Geef bij Andere een omschrijving op.");
  if (normalizedText.length > 1000) badRequest("De omschrijving mag maximaal 1000 tekens bevatten.");
  return { reasonType, reasonText: normalizedText || null };
}

export function requestMetadata(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: (forwardedFor || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip"))?.slice(0, 191) || null,
    userAgent: request.headers.get("user-agent")?.slice(0, 2000) || null,
  };
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (new URL(origin).host !== new URL(request.url).host) forbidden("Ongeldige aanvraagbron.");
}

export async function listImpersonationCandidates(actor: MockUser) {
  if (!can(actor, "users.impersonate")) forbidden();
  const users = await prisma.user.findMany({
    where: { active: true },
    include: {
      team: { select: { name: true } },
      countryAccess: { select: { country: true } },
      permissions: { include: { permission: { select: { key: true } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const { applyPermissionOverrides, resolveRolePermissions } = await import("@/lib/role-permissions");
  const roleGrants = await prisma.rolePermission.findMany({ include: { permission: { select: { key: true } } } });
  return users.flatMap((user) => {
    const role = user.role as Role;
    const target: MockUser = {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role,
      country: user.country as Country,
      countryAccess: user.countryAccess.map((item) => item.country as Country),
      language: user.language,
      teamId: user.teamId ?? undefined,
      representativeId: user.representativeId ?? undefined,
      permissions: applyPermissionOverrides(resolveRolePermissions(role, roleGrants), user.permissions),
    };
    if (!canImpersonateUser(actor, target).allowed) return [];
    return [{
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role,
      country: user.country,
      teamId: user.teamId ?? "",
      teamName: user.team?.name ?? "",
      avatarUrl: user.avatarUrl ?? "",
    }];
  });
}

export async function startImpersonation(input: {
  actor: MockUser;
  loginSessionDatabaseId: string;
  targetUserId: string;
  reasonType: string;
  reasonText?: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const target = await loadTarget(input.targetUserId);
  if (!target) {
    const reason = "Doelgebruiker bestaat niet of is niet actief.";
    await prisma.impersonationEvent.create({ data: {
      actorUserId: input.actor.id,
      type: "IMPERSONATION_DENIED",
      reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    } });
    forbidden(reason);
  }
  const decision = canImpersonateUser(input.actor, target.mockUser);
  if (!decision.allowed) {
    await prisma.impersonationEvent.create({ data: {
      actorUserId: input.actor.id,
      impersonatedUserId: target?.id,
      type: "IMPERSONATION_DENIED",
      reason: decision.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    } });
    forbidden(decision.reason);
  }
  const reason = validateImpersonationReason(input.reasonType, input.reasonText);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAX_SESSION_MS);
  return prisma.$transaction(async (tx) => {
    const replaced = await tx.impersonationSession.findMany({
      where: { loginSessionId: input.loginSessionDatabaseId, endedAt: null },
      select: { id: true, impersonatedUserId: true },
    });
    await tx.impersonationSession.updateMany({
      where: { loginSessionId: input.loginSessionDatabaseId, endedAt: null },
      data: { endedAt: now, endReason: "REPLACED" },
    });
    if (replaced.length) {
      await tx.impersonationEvent.createMany({ data: replaced.map((item) => ({
        sessionId: item.id,
        actorUserId: input.actor.id,
        impersonatedUserId: item.impersonatedUserId,
        type: "IMPERSONATION_STOPPED" as const,
        reason: "REPLACED",
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })) });
    }
    const session = await tx.impersonationSession.create({ data: {
      loginSessionId: input.loginSessionDatabaseId,
      actorUserId: input.actor.id,
      impersonatedUserId: target.id,
      ...reason,
      expiresAt,
      targetCountry: target.country,
      targetTeamId: target.teamId,
      targetTeamName: target.team?.name,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    } });
    await tx.impersonationEvent.create({ data: {
      sessionId: session.id,
      actorUserId: input.actor.id,
      impersonatedUserId: target.id,
      type: "IMPERSONATION_STARTED",
      reason: reason.reasonText ?? reason.reasonType,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    } });
    return { sessionId: session.id, expiresAt: session.expiresAt.toISOString() };
  });
}

export async function stopImpersonation(loginSessionDatabaseId: string, actorUserId: string, metadata?: { ipAddress: string | null; userAgent: string | null }, endReason: "MANUAL" | "LOGOUT" | "ADMINISTRATIVE" = "MANUAL") {
  const active = await prisma.impersonationSession.findFirst({ where: { loginSessionId: loginSessionDatabaseId, endedAt: null }, orderBy: { startedAt: "desc" } });
  if (!active) return false;
  const endedAt = new Date();
  await prisma.$transaction([
    prisma.impersonationSession.update({ where: { id: active.id }, data: { endedAt, endReason } }),
    prisma.impersonationEvent.create({ data: {
      sessionId: active.id,
      actorUserId,
      impersonatedUserId: active.impersonatedUserId,
      type: "IMPERSONATION_STOPPED",
      reason: endReason,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    } }),
  ]);
  return true;
}

export async function getImpersonationStatus(loginSessionDatabaseId: string) {
  const session = await prisma.impersonationSession.findFirst({
    where: { loginSessionId: loginSessionDatabaseId, endedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { startedAt: "desc" },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true, role: true } },
      impersonatedUser: { include: { team: { select: { name: true } } } },
    },
  });
  if (!session) return { active: false } as const;
  return { active: true, sessionId: session.id, startedAt: session.startedAt.toISOString(), expiresAt: session.expiresAt.toISOString(), reasonType: session.reasonType, reasonText: session.reasonText,
    realUser: session.actor,
    impersonatedUser: { id: session.impersonatedUser.id, firstName: session.impersonatedUser.firstName, lastName: session.impersonatedUser.lastName, role: session.impersonatedUser.role, country: session.impersonatedUser.country, teamId: session.impersonatedUser.teamId ?? "", teamName: session.impersonatedUser.team?.name ?? "", avatarUrl: session.impersonatedUser.avatarUrl ?? "" },
  };
}

export async function getCurrentImpersonationMailContext() {
  if (authMode === "demo") return null;
  try {
    const authenticated = await auth();
    const loginSessionId = authenticated?.user?.loginSessionId;
    if (!loginSessionId) return null;
    const login = await prisma.userLoginSession.findUnique({ where: { sessionId: loginSessionId }, select: { id: true } });
    if (!login) return null;
    const session = await prisma.impersonationSession.findFirst({
      where: { loginSessionId: login.id, endedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { startedAt: "desc" },
      include: {
        actor: { select: { firstName: true, lastName: true } },
        impersonatedUser: { select: { firstName: true, lastName: true } },
      },
    });
    return session ? {
      sessionId: session.id,
      actorName: `${session.actor.firstName} ${session.actor.lastName}`.trim(),
      effectiveUserName: `${session.impersonatedUser.firstName} ${session.impersonatedUser.lastName}`.trim(),
    } : null;
  } catch {
    return null;
  }
}

export async function listImpersonationHistory(actor: MockUser, filters: {
  from?: string; to?: string; actorUserId?: string; impersonatedUserId?: string;
  country?: Country; teamId?: string; status?: "ACTIVE" | "ENDED"; reasonType?: string;
}) {
  if (!can(actor, "audit.impersonation.read")) forbidden();
  const startedAt = {
    ...(filters.from ? { gte: parseDate(filters.from) } : {}),
    ...(filters.to ? { lt: addDays(parseDate(filters.to), 1) } : {}),
  };
  const allowedCountries = historyCountries(actor);
  const sessions = await prisma.impersonationSession.findMany({
    where: {
      ...(Object.keys(startedAt).length ? { startedAt } : {}),
      ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      ...(filters.impersonatedUserId ? { impersonatedUserId: filters.impersonatedUserId } : {}),
      ...(filters.country ? { targetCountry: filters.country } : allowedCountries ? { targetCountry: { in: allowedCountries } } : {}),
      ...(filters.teamId ? { targetTeamId: filters.teamId } : {}),
      ...(filters.reasonType ? { reasonType: filters.reasonType } : {}),
      ...(filters.status === "ACTIVE" ? { endedAt: null, expiresAt: { gt: new Date() } } : {}),
      ...(filters.status === "ENDED" ? { OR: [{ endedAt: { not: null } }, { expiresAt: { lte: new Date() } }] } : {}),
    },
    include: {
      actor: { select: { firstName: true, lastName: true } },
      impersonatedUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 250,
  });
  const now = new Date();
  return sessions.map((session): ImpersonationHistoryRecord => ({
    id: session.id,
    actorName: `${session.actor.firstName} ${session.actor.lastName}`.trim(),
    impersonatedUserName: `${session.impersonatedUser.firstName} ${session.impersonatedUser.lastName}`.trim(),
    country: session.targetCountry,
    teamName: session.targetTeamName ?? "",
    reasonType: session.reasonType,
    reasonText: session.reasonText,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? (session.expiresAt <= now ? session.expiresAt.toISOString() : null),
    expiresAt: session.expiresAt.toISOString(),
    endReason: session.endReason ?? (session.expiresAt <= now ? "EXPIRED" : null),
    durationSeconds: Math.max(0, Math.floor(((session.endedAt ?? (session.expiresAt <= now ? session.expiresAt : now)).getTime() - session.startedAt.getTime()) / 1000)),
    ipAddress: session.ipAddress,
  }));
}

function historyCountries(actor: MockUser): Country[] | null {
  if (["GROUP_MANAGER", "SUPER_ADMIN"].includes(actor.role)) return null;
  if (["SALES_MANAGER", "ADMIN"].includes(actor.role)) return actor.countryAccess?.length ? actor.countryAccess : actor.role === "ADMIN" ? [actor.country] : [];
  return [actor.country];
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ongeldige datumfilter.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Ongeldige datumfilter.");
  return date;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function loadTarget(id: string) {
  const user = await prisma.user.findFirst({ where: { id, active: true }, include: { team: { select: { name: true } }, countryAccess: true } });
  if (!user) return null;
  return { ...user, mockUser: { id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, role: user.role, country: user.country, countryAccess: user.countryAccess.map((item) => item.country), language: user.language, teamId: user.teamId ?? undefined, representativeId: user.representativeId ?? undefined } satisfies MockUser };
}

function denied(reason: string): ImpersonationDecision { return { allowed: false, reason }; }
