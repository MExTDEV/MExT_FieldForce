import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import { deleteStoredUserAvatar, storeUserAvatarBytes } from "@/lib/server/user-avatar";
import { isAllowedUserAvatarType, maxUserAvatarSize, type UserAvatarMimeType } from "@/lib/user-avatar";

const graphRoot = "https://graph.microsoft.com/v1.0";
const maxAttempts = 3;
const defaultConcurrency = 4;
const supportedAccept = "image/jpeg,image/png,image/webp";

type SyncTrigger = "NIGHTLY" | "MANUAL";
type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL_ERROR" | "ERROR" | "SKIPPED";

type SyncCounts = {
  checkedUsers: number;
  updatedPhotos: number;
  unchangedPhotos: number;
  noPhotoUsers: number;
  skippedUsers: number;
  errorUsers: number;
};

type GraphPhoto =
  | { status: "PHOTO"; bytes: Buffer; mimeType: UserAvatarMimeType; hash: string }
  | { status: "NO_PHOTO" };

type UserPhotoTarget = {
  id: string;
  email: string;
  entraId: string | null;
  microsoftEmail: string | null;
  profilePhotoHash: string | null;
};

export async function startProfilePhotoSyncRun(input: {
  trigger: SyncTrigger;
  actorId?: string | null;
  runInBackground?: boolean;
}) {
  const active = await findActiveRun();
  if (active) return { run: summarizeRun(active), started: false };
  const run = await prisma.profilePhotoSyncRun.create({
    data: {
      trigger: input.trigger,
      status: "QUEUED",
      startedByUserId: input.actorId ?? null,
    },
  });
  const execute = () => runProfilePhotoSync(run.id).catch((error) => {
    console.error("[profile-photo-sync] run failed", safeErrorMessage(error));
  });
  if (input.runInBackground === false) {
    await execute();
  } else {
    setTimeout(execute, 0);
  }
  return { run: summarizeRun(await getProfilePhotoSyncRun(run.id)), started: true };
}

export async function runNightlyProfilePhotoSync() {
  return startProfilePhotoSyncRun({ trigger: "NIGHTLY", runInBackground: false });
}

export async function getLatestProfilePhotoSyncRun() {
  const run = await prisma.profilePhotoSyncRun.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return run ? summarizeRun(run) : undefined;
}

export async function getProfilePhotoSyncRun(id: string) {
  const run = await prisma.profilePhotoSyncRun.findUnique({ where: { id } });
  if (!run) throw new Error("Synchronisatierun niet gevonden.");
  return run;
}

async function runProfilePhotoSync(runId: string) {
  const claimed = await prisma.profilePhotoSyncRun.updateMany({
    where: { id: runId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  if (claimed.count !== 1) return;

  const counts: SyncCounts = {
    checkedUsers: 0,
    updatedPhotos: 0,
    unchangedPhotos: 0,
    noPhotoUsers: 0,
    skippedUsers: 0,
    errorUsers: 0,
  };
  const errors: Array<{ userId: string; message: string }> = [];

  try {
    const accessToken = await getApplicationGraphToken();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        entraId: true,
        microsoftEmail: true,
        profilePhotoHash: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    await processWithConcurrency(users, graphConcurrency(), async (user) => {
      const result = await syncOneUser(user, accessToken).catch(async (error) => {
        counts.errorUsers += 1;
        const message = safeErrorMessage(error);
        errors.push({ userId: user.id, message });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            profilePhotoSyncedAt: new Date(),
            profilePhotoSyncStatus: "ERROR",
            profilePhotoSyncError: message.slice(0, 4000),
          },
        });
        return "ERROR" as const;
      });
      counts.checkedUsers += 1;
      if (result === "UPDATED") counts.updatedPhotos += 1;
      if (result === "UNCHANGED") counts.unchangedPhotos += 1;
      if (result === "NO_PHOTO") counts.noPhotoUsers += 1;
      if (result === "SKIPPED") counts.skippedUsers += 1;
    });
    await finishRun(runId, counts, errors, errors.length ? "PARTIAL_ERROR" : "COMPLETED");
  } catch (error) {
    await finishRun(runId, counts, errors, "ERROR", safeErrorMessage(error));
  }
}

async function syncOneUser(user: UserPhotoTarget, accessToken: string) {
  const graphUserId = user.entraId?.trim() || user.microsoftEmail?.trim() || user.email.trim();
  if (!graphUserId) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profilePhotoSyncedAt: new Date(),
        profilePhotoSyncStatus: "SKIPPED",
        profilePhotoSyncError: "Geen bruikbaar Microsoft-ID of e-mailadres.",
      },
    });
    return "SKIPPED" as const;
  }

  const photo = await downloadUserPhoto(accessToken, graphUserId);
  if (photo.status === "NO_PHOTO") {
    await deleteStoredUserAvatar(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: null,
        profilePhotoStorageKey: null,
        profilePhotoMimeType: null,
        profilePhotoHash: null,
        profilePhotoSyncedAt: new Date(),
        profilePhotoSyncStatus: "NO_PHOTO",
        profilePhotoSyncError: null,
      },
    });
    return "NO_PHOTO" as const;
  }

  if (photo.hash === user.profilePhotoHash) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profilePhotoSyncedAt: new Date(),
        profilePhotoSyncStatus: "SYNCED",
        profilePhotoSyncError: null,
      },
    });
    return "UNCHANGED" as const;
  }

  await storeUserAvatarBytes(user.id, photo.bytes, photo.mimeType, { updateSyncMetadata: true });
  return "UPDATED" as const;
}

async function downloadUserPhoto(accessToken: string, graphUserId: string): Promise<GraphPhoto> {
  const path = `${graphRoot}/users/${encodeURIComponent(graphUserId)}/photo/$value`;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(path, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: supportedAccept,
      },
      cache: "no-store",
    });
    if (response.status === 404) return { status: "NO_PHOTO" };
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxAttempts) throw new Error(`Microsoft Graph gaf status ${response.status}.`);
      await delay(retryDelayMs(response, attempt));
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Microsoft Graph-toegang geweigerd (${response.status}). Controleer ProfilePhoto.Read.All admin consent.`);
    }
    if (!response.ok) throw new Error(`Microsoft Graph gaf status ${response.status}.`);
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!isAllowedUserAvatarType(mimeType)) {
      throw new Error(`Microsoft Graph gaf een niet-ondersteund afbeeldingsformaat (${mimeType || "onbekend"}).`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length <= 0 || bytes.length > maxUserAvatarSize) {
      throw new Error("Microsoft-profielfoto is leeg of groter dan 2 MB.");
    }
    return {
      status: "PHOTO",
      bytes,
      mimeType,
      hash: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  throw new Error("Microsoft-profielfoto kon niet worden opgehaald.");
}

async function getApplicationGraphToken() {
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim();
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim();
  const tenantId = microsoftTenantId();
  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("Microsoft Entra client-credentialsconfiguratie ontbreekt.");
  }
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => undefined) as { access_token?: string; error_description?: string } | undefined;
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || `Microsoft-tokenaanvraag gaf status ${response.status}.`);
  }
  return payload.access_token;
}

function microsoftTenantId() {
  const explicit = process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID?.trim();
  if (explicit) return explicit;
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  const match = issuer?.match(/login\.microsoftonline\.com\/([^/]+)\/v2\.0/i);
  return match?.[1];
}

async function findActiveRun() {
  return prisma.profilePhotoSyncRun.findFirst({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
}

async function finishRun(
  runId: string,
  counts: SyncCounts,
  errors: Array<{ userId: string; message: string }>,
  status: RunStatus,
  errorMessage?: string
) {
  await prisma.profilePhotoSyncRun.update({
    where: { id: runId },
    data: {
      ...counts,
      status,
      finishedAt: new Date(),
      errorMessage: errorMessage?.slice(0, 4000) ?? null,
      userErrorsJson: errors.length ? JSON.stringify(errors.slice(0, 200)) : null,
    },
  });
  const run = await prisma.profilePhotoSyncRun.findUniqueOrThrow({ where: { id: runId } });
  try {
    const auditUserId = run.startedByUserId ?? await systemAuditUserId();
    await prisma.auditLog.create({
      data: {
        userId: auditUserId,
        entityType: "ProfilePhotoSyncRun",
        entityId: run.id,
        action: `profile_photo_sync.${run.trigger.toLowerCase()}`,
        newValue: JSON.stringify({
          status,
          ...counts,
          errorMessage: errorMessage ? "redacted technical error" : undefined,
        }),
      },
    });
  } catch (error) {
    console.warn("[profile-photo-sync] audit log skipped", safeErrorMessage(error));
  }
}

async function systemAuditUserId() {
  const user = await prisma.user.findFirst({
    where: { active: true, role: "SUPER_ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (user) return user.id;
  const fallback = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  if (!fallback) throw new Error("Geen gebruiker beschikbaar voor systeemlog.");
  return fallback.id;
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function graphConcurrency() {
  const value = Number(process.env.PROFILE_PHOTO_SYNC_CONCURRENCY);
  if (Number.isInteger(value) && value >= 1 && value <= 8) return value;
  return defaultConcurrency;
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30_000);
  return Math.min(500 * 2 ** (attempt - 1), 5000);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `Databasefout ${error.code}.`;
  if (error instanceof Error) return error.message.slice(0, 4000);
  return "Onbekende fout.";
}

function summarizeRun(run: Awaited<ReturnType<typeof prisma.profilePhotoSyncRun.findFirst>>) {
  if (!run) throw new Error("Synchronisatierun niet gevonden.");
  return {
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    startedByUserId: run.startedByUserId,
    startedAt: run.startedAt?.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    checkedUsers: run.checkedUsers,
    updatedPhotos: run.updatedPhotos,
    unchangedPhotos: run.unchangedPhotos,
    noPhotoUsers: run.noPhotoUsers,
    skippedUsers: run.skippedUsers,
    errorUsers: run.errorUsers,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}
