import { prisma } from "@/lib/server/db";
import { auth, authMode } from "@/auth";
import { headers } from "next/headers";

export type AuditInput = {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function writeAuditLog(input: AuditInput) {
  let impersonating = false;
  try {
    const impersonation = await resolveAuditIdentity();
    impersonating = Boolean(impersonation?.sessionId);
    const userId = impersonation?.actorUserId ?? await resolveAuditUserId(input.actorId);
    if (!userId) return;
    await prisma.auditLog.create({
      data: {
        userId,
        effectiveUserId: impersonation?.effectiveUserId ?? null,
        impersonationSessionId: impersonation?.sessionId ?? null,
        ipAddress: impersonation?.ipAddress ?? null,
        userAgent: impersonation?.userAgent ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
        newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
      },
    });
  } catch (error) {
    console.error("[audit]", error);
    if (impersonating) throw error;
  }
}

async function resolveAuditIdentity() {
  if (authMode === "demo") return null;
  const session = await auth();
  const loginSessionId = session?.user?.loginSessionId;
  const actorUserId = session?.user?.databaseUserId;
  if (!loginSessionId || !actorUserId) return null;
  const login = await prisma.userLoginSession.findUnique({ where: { sessionId: loginSessionId }, select: { id: true } });
  if (!login) return null;
  const impersonation = await prisma.impersonationSession.findFirst({ where: { loginSessionId: login.id, endedAt: null, expiresAt: { gt: new Date() } }, orderBy: { startedAt: "desc" }, select: { id: true, impersonatedUserId: true } });
  const metadata = await currentRequestMetadata();
  return impersonation
    ? { actorUserId, effectiveUserId: impersonation.impersonatedUserId, sessionId: impersonation.id, ...metadata }
    : { actorUserId, effectiveUserId: actorUserId, sessionId: null, ...metadata };
}

async function currentRequestMetadata() {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    return {
      ipAddress: (forwardedFor || requestHeaders.get("cf-connecting-ip") || requestHeaders.get("x-real-ip"))?.slice(0, 191) || null,
      userAgent: requestHeaders.get("user-agent")?.slice(0, 2000) || null,
    };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

export async function writeAuditLogs(inputs: AuditInput[]) {
  for (const input of inputs) {
    await writeAuditLog(input);
  }
}

async function resolveAuditUserId(actorId?: string | null) {
  if (actorId) {
    const actor = await prisma.user.findFirst({
      where: { OR: [{ id: actorId }, { representativeId: actorId }] },
      select: { id: true },
    });
    if (actor) return actor.id;
  }
  const fallback = await prisma.user.findFirst({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return fallback?.id;
}
