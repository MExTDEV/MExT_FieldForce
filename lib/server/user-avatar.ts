import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { forbidden, notFound, badRequest } from "@/lib/server/api";
import { actorCanAccessCountry, requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { listManagedUsers } from "@/lib/server/users";
import { userManagementCapabilities } from "@/lib/user-management";
import {
  extensionForUserAvatarMimeType,
  isAllowedUserAvatarType,
  maxUserAvatarSize,
  userAvatarMimeTypeForExtension,
  type UserAvatarMimeType,
} from "@/lib/user-avatar";
import type { ManagedUser, MockUser } from "@/lib/types";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const avatarExtensions = [".jpg", ".png", ".webp"] as const;
const avatarStorageFolder = "user-avatars";

type AvatarTarget = {
  id: string;
  active: boolean;
  country: string;
  teamId: string | null;
  representativeId: string | null;
  avatarUrl: string | null;
  profilePhotoMimeType: string | null;
  profilePhotoHash: string | null;
};

export async function getUserAvatarForRequest(userId: string, actor?: MockUser) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      active: true,
      country: true,
      teamId: true,
      representativeId: true,
      avatarUrl: true,
      profilePhotoMimeType: true,
      profilePhotoHash: true,
    },
  });
  if (!target?.active || !canViewUserAvatar(actor, target)) notFound("Gebruikersfoto niet gevonden.");
  if (!target.avatarUrl?.startsWith(userAvatarRoute(target.id))) notFound("Gebruikersfoto niet gevonden.");
  const stored = await readStoredAvatar(target.id, {
    mimeType: target.profilePhotoMimeType,
    hash: target.profilePhotoHash,
  });
  if (!stored) notFound("Gebruikersfoto niet gevonden.");
  return stored;
}

export async function uploadManagedUserAvatar(
  userId: string,
  file: File,
  actorId?: string | null
): Promise<ManagedUser> {
  const actor = await requireAuthenticatedUser(actorId);
  const users = await listManagedUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) notFound("Gebruiker niet gevonden.");
  if (!userManagementCapabilities(actor, target).canEditPersonal) {
    forbidden("Je mag de foto van deze gebruiker niet wijzigen.");
  }
  assertValidAvatar(file.type, file.size);
  const stored = await storeUserAvatarBytes(
    userId,
    Buffer.from(await file.arrayBuffer()),
    file.type
  );
  return {
    ...target,
    avatarUrl: stored.avatarUrl,
  };
}

export async function syncUserAvatarFromMicrosoft(userId: string, accessToken: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!target || target.avatarUrl?.trim()) return false;
  const photo = await downloadMicrosoftProfilePhoto(accessToken);
  if (!photo) return false;
  await storeUserAvatarBytes(userId, photo.bytes, photo.mimeType);
  return true;
}

async function downloadMicrosoftProfilePhoto(accessToken: string) {
  const response = await fetch(`${GRAPH_ROOT}/me/photo/$value`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "image/jpeg,image/png,image/webp",
    },
    cache: "no-store",
  });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Microsoft-accountfoto kon niet worden opgehaald (${response.status}).`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!isAllowedUserAvatarType(mimeType)) return undefined;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > maxUserAvatarSize) return undefined;
  return { bytes, mimeType };
}

export async function storeUserAvatarBytes(
  userId: string,
  bytes: Buffer,
  mimeType: UserAvatarMimeType | string,
  options: { updateSyncMetadata?: boolean } = {}
) {
  if (!isAllowedUserAvatarType(mimeType)) {
    badRequest("Alleen JPG-, PNG- en WebP-foto's zijn toegestaan.");
  }
  if (bytes.length <= 0 || bytes.length > maxUserAvatarSize) {
    badRequest("Een gebruikersfoto mag maximaal 2 MB groot zijn.");
  }
  const hash = sha256Hex(bytes);
  const extension = extensionForUserAvatarMimeType(mimeType);
  const storedName = `avatar${extension}`;
  const tempName = `.avatar-${randomUUID()}${extension}`;
  await mkdir(avatarDirectory(userId), { recursive: true });
  await writeFile(avatarPath(userId, tempName), bytes, { flag: "wx" });
  await rename(avatarPath(userId, tempName), avatarPath(userId, storedName));
  await Promise.all(avatarExtensions
    .filter((candidate) => candidate !== extension)
    .map((candidate) => rm(avatarPath(userId, `avatar${candidate}`), { force: true }))
  );
  const avatarUrl = `${userAvatarRoute(userId)}?v=${hash}`;
  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl,
      profilePhotoStorageKey: storageKey(userId, storedName),
      profilePhotoMimeType: mimeType,
      profilePhotoHash: hash,
      ...(options.updateSyncMetadata
        ? {
            profilePhotoSyncedAt: new Date(),
            profilePhotoSyncStatus: "SYNCED",
            profilePhotoSyncError: null,
          }
        : {}),
    },
  });
  return { avatarUrl, hash, storageKey: storageKey(userId, storedName) };
}

export async function deleteStoredUserAvatar(userId: string) {
  await Promise.all(avatarExtensions.map((extension) =>
    rm(avatarPath(userId, `avatar${extension}`), { force: true })
  ));
}

async function readStoredAvatar(userId: string, metadata?: { mimeType?: string | null; hash?: string | null }) {
  const extensions = metadata?.mimeType
    ? [extensionForUserAvatarMimeType(metadata.mimeType as UserAvatarMimeType), ...avatarExtensions]
    : avatarExtensions;
  for (const extension of [...new Set(extensions)]) {
    const mimeType = userAvatarMimeTypeForExtension(extension);
    if (!mimeType || (metadata?.mimeType && mimeType !== metadata.mimeType && extension !== extensions[0])) continue;
    try {
      const bytes = await readFile(avatarPath(userId, `avatar${extension}`));
      if (metadata?.hash && sha256Hex(bytes) !== metadata.hash) continue;
      return {
        bytes,
        mimeType,
      };
    } catch {
      // Try the next allowed extension.
    }
  }
  return undefined;
}

function canViewUserAvatar(actor: MockUser | undefined, target: AvatarTarget) {
  if (!actor) return true;
  if (actor.id === target.id || actor.representativeId === target.representativeId) return true;
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return true;
  if (["SALES_MANAGER", "COUNTRY_MANAGER", "ADMIN"].includes(actor.role)) {
    return actorCanAccessCountry(actor, target.country);
  }
  if (actor.role === "SALES_LEADER") {
    return Boolean(actor.teamId && actor.teamId === target.teamId);
  }
  return false;
}

function assertValidAvatar(mimeType: string, size: number) {
  if (!isAllowedUserAvatarType(mimeType)) {
    badRequest("Alleen JPG-, PNG- en WebP-foto's zijn toegestaan.");
  }
  if (size <= 0 || size > maxUserAvatarSize) {
    badRequest("Een gebruikersfoto mag maximaal 2 MB groot zijn.");
  }
}

function userAvatarRoute(userId: string) {
  return `/api/users/${encodeURIComponent(userId)}/avatar`;
}

function uploadRoot() {
  return resolve(process.env.FIELD_FORCE_UPLOAD_ROOT ?? join(process.cwd(), "storage", "uploads"));
}

function avatarDirectory(userId: string) {
  return resolve(uploadRoot(), avatarStorageFolder, safePathSegment(userId));
}

function avatarPath(userId: string, storedName: string) {
  const fullPath = resolve(avatarDirectory(userId), safePathSegment(storedName));
  const root = uploadRoot();
  if (!fullPath.startsWith(root)) forbidden("Ongeldig bestandspad.");
  return fullPath;
}

function storageKey(userId: string, storedName: string) {
  return `${avatarStorageFolder}/${safePathSegment(userId)}/${safePathSegment(storedName)}`;
}

function sha256Hex(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safePathSegment(value: string) {
  const cleaned = value.replace(/[^\w.\-]/g, "");
  if (!cleaned) forbidden("Ongeldig bestandspad.");
  return cleaned;
}
