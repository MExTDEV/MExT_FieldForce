import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { Prisma } from "@prisma/client";

import {
  extensionForPhotoMimeType,
  hasValidContactMomentPhotoSignature,
  isAllowedContactMomentPhotoType,
  maxContactMomentPhotos,
  maxContactMomentPhotoSize,
  parseContactMomentPhotos,
  sanitizeOriginalPhotoName,
  serializeContactMomentPhotos,
} from "@/lib/contact-moment-photo-metadata";
import { forbidden, notFound, badRequest } from "@/lib/server/api";
import { actorCanAccessCountry, requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { columnsExist } from "@/lib/server/schema-inspection";
import type { ContactMomentPhoto, MockUser } from "@/lib/types";

type StoredContactMoment = {
  id: string;
  status: string;
  representativeId: string;
  initiatorId: string;
  ownerId: string;
  teamId: string | null;
  country: string;
  notifyRepresentative: boolean;
  representative: { id: string; representativeId: string | null; role: string };
  contactMoment: { photosJson: string | null } | null;
};

type PhotoJsonRow = {
  interventionId: string;
  photosJson: string | null;
};

export async function loadContactMomentPhotosByInterventionIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, ContactMomentPhoto[]>();
  if (!uniqueIds.length || !await contactMomentPhotosColumnExists()) return result;
  const rows = await prisma.$queryRaw<PhotoJsonRow[]>(Prisma.sql`
    SELECT interventionId, photosJson
    FROM ContactMomentDetail
    WHERE interventionId IN (${Prisma.join(uniqueIds)})
  `);
  for (const row of rows) result.set(row.interventionId, parseContactMomentPhotos(row.photosJson));
  return result;
}

export async function getContactMomentPhotoForRequest(
  contactMomentId: string,
  photoId: string,
  actorId?: string | null
) {
  const actor = await requireAuthenticatedUser(actorId);
  const contact = await loadStoredContactMoment(contactMomentId);
  if (!contact || !canViewStoredContactMoment(actor, contact)) notFound("Foto niet gevonden.");
  const photos = parseContactMomentPhotos(contact.contactMoment?.photosJson);
  const photo = photos.find((item) => item.id === photoId);
  if (!photo) notFound("Foto niet gevonden.");
  return {
    photo,
    bytes: await readFile(photoPath(contactMomentId, photo.storedName)),
  };
}

export async function uploadContactMomentPhoto(
  contactMomentId: string,
  file: File,
  actorId?: string | null
) {
  const result = await uploadContactMomentPhotos(contactMomentId, [file], actorId);
  return { photo: result.photos[result.photos.length - 1], photos: result.photos };
}

export async function uploadContactMomentPhotos(
  contactMomentId: string,
  files: File[],
  actorId?: string | null
) {
  if (!await contactMomentPhotosColumnExists()) {
    badRequest("De database ondersteunt contactmomentfoto's nog niet. Voer eerst de migratie uit.");
  }
  const actor = await requireAuthenticatedUser(actorId);
  const contact = await loadStoredContactMoment(contactMomentId);
  if (!contact) notFound("Contactmoment niet gevonden.");
  assertCanManageMutableContactMoment(actor, contact);
  if (!files.length) {
    badRequest("Selecteer minstens één afbeelding om te uploaden.");
  }
  let photos = parseContactMomentPhotos(contact.contactMoment?.photosJson);
  if (photos.length + files.length > maxContactMomentPhotos) {
    badRequest("Er kunnen maximaal 20 foto's aan een contactmoment gekoppeld worden.");
  }
  await mkdir(photoDirectory(contactMomentId), { recursive: true });
  for (const file of files) {
    if (!isAllowedContactMomentPhotoType(file.type)) {
      badRequest("Alleen JPG-, PNG- en WebP-foto's zijn toegestaan.");
    }
    if (file.size <= 0 || file.size > maxContactMomentPhotoSize) {
      badRequest("Een foto mag maximaal 8 MB groot zijn.");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasValidContactMomentPhotoSignature(bytes, file.type)) {
      badRequest("Het bestand is geen geldige afbeelding.");
    }
    const id = randomUUID();
    const storedName = `${id}${extensionForPhotoMimeType(file.type)}`;
    const photo: ContactMomentPhoto = {
      id,
      originalName: sanitizeOriginalPhotoName(file.name),
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: actor.id,
      uploadedAt: new Date().toISOString(),
      sortOrder: photos.length,
    };
    await writeFile(photoPath(contactMomentId, storedName), bytes, { flag: "wx" });
    photos = [...photos, photo];
    await storePhotosJson(contactMomentId, photos);
  }
  return { photos };
}

export async function deleteContactMomentPhoto(
  contactMomentId: string,
  photoId: string,
  actorId?: string | null
) {
  if (!await contactMomentPhotosColumnExists()) {
    badRequest("De database ondersteunt contactmomentfoto's nog niet. Voer eerst de migratie uit.");
  }
  const actor = await requireAuthenticatedUser(actorId);
  const contact = await loadStoredContactMoment(contactMomentId);
  if (!contact) notFound("Contactmoment niet gevonden.");
  assertCanManageMutableContactMoment(actor, contact);
  const photos = parseContactMomentPhotos(contact.contactMoment?.photosJson);
  const photo = photos.find((item) => item.id === photoId);
  if (!photo) notFound("Foto niet gevonden.");
  const nextPhotos = photos.filter((item) => item.id !== photoId);
  await storePhotosJson(contactMomentId, nextPhotos);
  await rm(photoPath(contactMomentId, photo.storedName), { force: true });
  return { photos: nextPhotos };
}

async function contactMomentPhotosColumnExists() {
  return columnsExist("ContactMomentDetail", ["photosJson"]);
}

async function loadStoredContactMoment(id: string): Promise<StoredContactMoment | null> {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    status: string;
    representativeId: string;
    initiatorId: string;
    ownerId: string;
    teamId: string | null;
    country: string;
    notifyRepresentative: number | boolean;
    representativeUserId: string;
    representativePublicId: string | null;
    representativeRole: string;
    photosJson: string | null;
  }>>(Prisma.sql`
    SELECT
      i.id,
      i.status,
      i.representativeId,
      i.initiatorId,
      i.ownerId,
      i.teamId,
      i.country,
      i.notifyRepresentative,
      u.id AS representativeUserId,
      u.representativeId AS representativePublicId,
      u.role AS representativeRole,
      d.photosJson
    FROM Intervention i
    INNER JOIN \`User\` u ON u.id = i.representativeId
    LEFT JOIN ContactMomentDetail d ON d.interventionId = i.id
    WHERE i.id = ${id}
      AND i.type = 'CONTACTMOMENT'
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    representativeId: row.representativeId,
    initiatorId: row.initiatorId,
    ownerId: row.ownerId,
    teamId: row.teamId,
    country: row.country,
    notifyRepresentative: Boolean(row.notifyRepresentative),
    representative: {
      id: row.representativeUserId,
      representativeId: row.representativePublicId,
      role: row.representativeRole,
    },
    contactMoment: { photosJson: row.photosJson },
  };
}

function canViewStoredContactMoment(actor: MockUser, contact: StoredContactMoment) {
  if (actor.role === "REPRESENTATIVE") {
    const isTarget = [actor.id, actor.representativeId].includes(contact.representative.representativeId ?? contact.representativeId);
    if (!isTarget) return false;
    if (contact.status === "AFGESLOTEN") return true;
    return contact.notifyRepresentative === true;
  }
  return canManageStoredContactMoment(actor, contact);
}

function assertCanManageMutableContactMoment(actor: MockUser, contact: StoredContactMoment) {
  if (!canManageStoredContactMoment(actor, contact)) {
    forbidden("Je mag dit contactmoment niet beheren.");
  }
  if (["AFGESLOTEN", "GEANNULEERD", "NIET_UITGEVOERD"].includes(contact.status)) {
    forbidden("Een definitief contactmoment is volledig read-only.");
  }
}

function canManageStoredContactMoment(actor: MockUser, contact: StoredContactMoment) {
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return true;
  if (["SALES_MANAGER", "COUNTRY_MANAGER", "ADMIN"].includes(actor.role)) {
    return actorCanAccessCountry(actor, contact.country);
  }
  if (actor.role === "SALES_LEADER") {
    return contact.ownerId === actor.id ||
      contact.initiatorId === actor.id ||
      Boolean(actor.teamId && contact.teamId === actor.teamId);
  }
  return false;
}

async function storePhotosJson(contactMomentId: string, photos: ContactMomentPhoto[]) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE ContactMomentDetail
    SET photosJson = ${serializeContactMomentPhotos(photos)}
    WHERE interventionId = ${contactMomentId}
  `);
}

function uploadRoot() {
  return resolve(process.env.FIELD_FORCE_UPLOAD_ROOT ?? join(process.cwd(), "storage", "uploads"));
}

function photoDirectory(contactMomentId: string) {
  return resolve(uploadRoot(), "contact-moments", safePathSegment(contactMomentId));
}

function photoPath(contactMomentId: string, storedName: string) {
  const fullPath = resolve(photoDirectory(contactMomentId), safePathSegment(storedName));
  const root = uploadRoot();
  if (!fullPath.startsWith(root)) forbidden("Ongeldig bestandspad.");
  return fullPath;
}

function safePathSegment(value: string) {
  const cleaned = value.replace(/[^\w.\-]/g, "");
  if (!cleaned) forbidden("Ongeldig bestandspad.");
  return cleaned;
}
