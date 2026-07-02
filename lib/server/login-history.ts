import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";

type LoginRequestMetadata = {
  requestKey: string;
  ipAddress?: string;
  userAgent?: string;
};

type SuccessfulLoginInput = {
  provider?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  providerAccountId?: string | null;
  profile?: Record<string, unknown> | null;
};

const loginRequestMetadata = new AsyncLocalStorage<LoginRequestMetadata>();

export function withLoginRequestContext<T>(
  request: Request,
  action: () => Promise<T>
) {
  const forwardedFor = request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ipAddress = forwardedFor || request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim();

  return loginRequestMetadata.run(
    {
      requestKey: randomUUID(),
      ipAddress: compactOptional(ipAddress, 191),
      userAgent: compactOptional(userAgent, 2000),
    },
    action
  );
}

export async function recordSuccessfulLogin(input: SuccessfulLoginInput) {
  const provider = input.provider === "microsoft-entra-id"
    ? "microsoft"
    : input.provider ?? "onbekend";
  const profile = input.profile ?? {};
  const microsoftEmail = provider === "microsoft"
    ? firstString(
        profile.email,
        profile.preferred_username,
        profile.upn,
        profile.unique_name,
        input.userEmail
      )?.toLowerCase()
    : undefined;
  const entraIds = provider === "microsoft"
    ? uniqueStrings(profile.oid, profile.sub, input.providerAccountId)
    : [];

  const databaseUser = provider === "microsoft"
    ? await prisma.user.findFirst({
        where: {
          active: true,
          OR: [
            ...(entraIds.length ? [{ entraId: { in: entraIds } }] : []),
            ...(microsoftEmail ? [{ email: microsoftEmail }] : []),
          ],
        },
        select: { id: true, email: true },
      })
    : input.userId
      ? await prisma.user.findFirst({
          where: { id: input.userId, active: true },
          select: { id: true, email: true },
        })
      : null;

  if (!databaseUser) {
    console.warn(`[auth:login-history] Geen actieve FieldForce-gebruiker gevonden voor provider ${provider}.`);
    return;
  }

  const metadata = loginRequestMetadata.getStore();
  const loginAt = new Date();
  const email = microsoftEmail ?? input.userEmail?.trim().toLowerCase() ?? databaseUser.email;
  const requestKey = metadata?.requestKey ?? randomUUID();

  await prisma.$transaction([
    prisma.userLoginSession.upsert({
      where: { requestKey },
      update: {},
      create: {
        userId: databaseUser.id,
        requestKey,
        loginAt,
        provider,
        email: compactOptional(email, 191),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    }),
    prisma.user.update({
      where: { id: databaseUser.id },
      data: {
        lastLoginAt: loginAt,
        ...(provider === "microsoft" && microsoftEmail
          ? { microsoftEmail }
          : {}),
      },
    }),
  ]);
}

export async function listUserLoginSessions({
  userId,
  from,
  to,
  page,
  pageSize = 25,
}: {
  userId: string;
  from?: string;
  to?: string;
  page: number;
  pageSize?: number;
}) {
  const loginAt = {
    ...(from ? { gte: parseDateBoundary(from) } : {}),
    ...(to ? { lt: addDays(parseDateBoundary(to), 1) } : {}),
  };
  const where = {
    userId,
    ...(Object.keys(loginAt).length ? { loginAt } : {}),
  };
  const [sessions, total] = await Promise.all([
    prisma.userLoginSession.findMany({
      where,
      orderBy: [{ loginAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        loginAt: true,
        provider: true,
        email: true,
        ipAddress: true,
        userAgent: true,
      },
    }),
    prisma.userLoginSession.count({ where }),
  ]);

  return {
    sessions,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

function parseDateBoundary(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Ongeldige datumfilter.");
  }
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

function uniqueStrings(...values: unknown[]) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))];
}

function firstString(...values: unknown[]) {
  return uniqueStrings(...values)[0];
}

function compactOptional(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}
