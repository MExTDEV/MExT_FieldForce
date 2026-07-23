import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";

const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type LoginRequestMetadata = {
  requestKey: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
};

type SuccessfulLoginInput = {
  provider?: string | null;
  userId: string;
  userEmail?: string | null;
  sessionId?: string;
  expiresAt?: Date;
};

export type LoginSessionStatus = "active" | "logged-out" | "expired";

const loginRequestMetadata = new AsyncLocalStorage<LoginRequestMetadata>();

export function withLoginRequestContext<T>(request: Request, action: () => Promise<T>) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwardedFor
    || request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim();
  const id = randomUUID();
  return loginRequestMetadata.run({
    requestKey: id,
    sessionId: id,
    ipAddress: compactOptional(ipAddress, 191),
    userAgent: compactOptional(request.headers.get("user-agent"), 2000),
  }, action);
}

export function getLoginRequestSessionId() {
  return loginRequestMetadata.getStore()?.sessionId;
}

export async function recordSuccessfulLogin(input: SuccessfulLoginInput) {
  const metadata = loginRequestMetadata.getStore();
  const provider = normalizeProvider(input.provider);
  const sessionId = input.sessionId ?? metadata?.sessionId ?? randomUUID();
  const requestKey = metadata?.requestKey ?? sessionId;
  const loginAt = new Date();
  const expiresAt = input.expiresAt
    ?? new Date(loginAt.getTime() + DEFAULT_SESSION_MAX_AGE_SECONDS * 1000);
  const client = parseUserAgent(metadata?.userAgent);

  if (process.env.NODE_ENV === "development" || process.env.AUTH_SESSION_DEBUG === "true") {
    console.info("[auth:login-audit] Succesvolle login ontvangen.", {
      userId: input.userId,
      provider,
      sessionId,
      ipAddress: metadata?.ipAddress ?? null,
    });
  }

  try {
    const session = await prisma.$transaction(async (database) => {
      const user = await database.user.findFirst({
        where: { id: input.userId, active: true },
        select: { id: true, email: true },
      });
      if (!user) throw new Error(`Actieve gebruiker ${input.userId} niet gevonden.`);

      const stored = await database.userLoginSession.upsert({
        where: { sessionId },
        update: {},
        create: {
          userId: user.id,
          requestKey,
          sessionId,
          loginAt,
          lastActivityAt: loginAt,
          expiresAt,
          provider,
          email: compactOptional(input.userEmail ?? user.email, 191),
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          browser: client.browser,
          operatingSystem: client.operatingSystem,
          deviceType: client.deviceType,
        },
        select: { id: true, sessionId: true },
      });
      await database.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: loginAt,
          ...(provider === "microsoft" && input.userEmail
            ? { microsoftEmail: compactOptional(input.userEmail.toLowerCase(), 191) }
            : {}),
        },
      });
      return stored;
    });
    console.info("[auth:login-audit] LoginSession opgeslagen.", {
      userId: input.userId,
      provider,
      sessionId: session.sessionId,
      recordId: session.id,
    });
    return session;
  } catch (error) {
    console.error("[auth:login-audit] KRITIEK: LoginSession kon niet worden opgeslagen; login wordt afgebroken.", {
      userId: input.userId,
      provider,
      sessionId,
      database: databaseIdentity(),
      error: describeError(error),
    });
    throw error;
  }
}

export async function touchLoginSession(sessionId: string) {
  const now = new Date();
  const session = await prisma.userLoginSession.findUnique({
    where: { sessionId },
    select: { loginAt: true, logoutAt: true },
  });
  if (!session || session.logoutAt) return false;
  await prisma.userLoginSession.update({
    where: { sessionId },
    data: {
      lastActivityAt: now,
      durationSeconds: durationBetween(session.loginAt, now),
    },
  });
  return true;
}

export async function closeLoginSession(sessionId: string) {
  const now = new Date();
  const session = await prisma.userLoginSession.findUnique({
    where: { sessionId },
    select: { id: true, userId: true, loginAt: true, logoutAt: true },
  });
  if (!session || session.logoutAt) return false;
  await prisma.$transaction(async (tx) => {
    const activeImpersonations = await tx.impersonationSession.findMany({
      where: { loginSessionId: session.id, endedAt: null },
      select: { id: true, impersonatedUserId: true },
    });
    await tx.userLoginSession.update({
      where: { sessionId },
      data: {
        logoutAt: now,
        lastActivityAt: now,
        durationSeconds: durationBetween(session.loginAt, now),
      },
    });
    if (activeImpersonations.length) {
      await tx.impersonationSession.updateMany({
        where: { id: { in: activeImpersonations.map((item) => item.id) }, endedAt: null },
        data: { endedAt: now, endReason: "LOGOUT" },
      });
      await tx.impersonationEvent.createMany({
        data: activeImpersonations.map((item) => ({
          sessionId: item.id,
          actorUserId: session.userId,
          impersonatedUserId: item.impersonatedUserId,
          type: "IMPERSONATION_STOPPED" as const,
          reason: "LOGOUT",
        })),
      });
    }
  });
  console.info("[auth:login-audit] Sessie afgemeld.", { sessionId });
  return true;
}

export async function listUserLoginSessions({
  userId, from, to, provider, browser, ipAddress, deviceType, status, page, pageSize = 25,
}: {
  userId: string;
  from?: string;
  to?: string;
  provider?: string;
  browser?: string;
  ipAddress?: string;
  deviceType?: string;
  status?: LoginSessionStatus;
  page: number;
  pageSize?: number;
}) {
  const now = new Date();
  const loginAt = {
    ...(from ? { gte: parseDateBoundary(from) } : {}),
    ...(to ? { lt: addDays(parseDateBoundary(to), 1) } : {}),
  };
  const where: Prisma.UserLoginSessionWhereInput = {
    userId,
    ...(Object.keys(loginAt).length ? { loginAt } : {}),
    ...(provider ? { provider } : {}),
    ...(browser ? { browser } : {}),
    ...(deviceType ? { deviceType } : {}),
    ...(ipAddress ? { ipAddress: { contains: ipAddress } } : {}),
    ...(status === "logged-out" ? { logoutAt: { not: null } } : {}),
    ...(status === "expired" ? { logoutAt: null, expiresAt: { lte: now } } : {}),
    ...(status === "active" ? { logoutAt: null, expiresAt: { gt: now } } : {}),
  };
  const [sessions, total] = await Promise.all([
    prisma.userLoginSession.findMany({
      where,
      orderBy: [{ loginAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, sessionId: true, loginAt: true, logoutAt: true,
        lastActivityAt: true, expiresAt: true, durationSeconds: true,
        provider: true, email: true, ipAddress: true, userAgent: true,
        browser: true, operatingSystem: true, deviceType: true,
      },
    }),
    prisma.userLoginSession.count({ where }),
  ]);
  return {
    sessions: sessions.map((session) => ({
      ...session,
      status: session.logoutAt ? "logged-out" : session.expiresAt <= now ? "expired" : "active",
      durationSeconds: session.logoutAt || session.expiresAt <= now
        ? session.durationSeconds
        : durationBetween(session.loginAt, session.lastActivityAt),
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

function normalizeProvider(provider?: string | null) {
  return provider === "microsoft-entra-id" ? "microsoft" : provider || "unknown";
}

function parseUserAgent(userAgent?: string) {
  if (!userAgent) return {};
  const browser = /Edg\//.test(userAgent) ? "Edge"
    : /Firefox\//.test(userAgent) ? "Firefox"
      : /(?:Chrome|CriOS)\//.test(userAgent) ? "Chrome"
        : /Safari\//.test(userAgent) ? "Safari" : "Other";
  const operatingSystem = /Windows NT/.test(userAgent) ? "Windows"
    : /Android/.test(userAgent) ? "Android"
      : /iPhone|iPad|iPod/.test(userAgent) ? "iOS"
        : /Mac OS X|Macintosh/.test(userAgent) ? "macOS"
          : /Linux/.test(userAgent) ? "Linux" : "Other";
  const deviceType = /iPad|Tablet/.test(userAgent) ? "Tablet"
    : /Mobile|iPhone|iPod|Android/.test(userAgent) ? "Mobile" : "Desktop";
  return { browser, operatingSystem, deviceType };
}

function parseDateBoundary(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ongeldige datumfilter.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) throw new Error("Ongeldige datumfilter.");
  return date;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function durationBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

function compactOptional(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function databaseIdentity() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "DATABASE_URL ongeldig of ontbrekend";
  }
}

function describeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { message: String(error) };
}
