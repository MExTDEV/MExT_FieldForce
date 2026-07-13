import type { ContactMomentPhoto } from "@/lib/types";

export const allowedContactMomentPhotoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxContactMomentPhotoSize = 8 * 1024 * 1024;
export const maxContactMomentPhotos = 20;

export function parseContactMomentPhotos(value: string | null | undefined): ContactMomentPhoto[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeContactMomentPhoto)
      .filter((item): item is ContactMomentPhoto => Boolean(item));
  } catch {
    return [];
  }
}

export function serializeContactMomentPhotos(photos: ContactMomentPhoto[]) {
  return JSON.stringify(photos.map(normalizeContactMomentPhoto).filter(Boolean));
}

export function sanitizeOriginalPhotoName(name: string) {
  const fallback = "contactmoment-foto";
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || fallback;
}

export function extensionForPhotoMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return "";
}

export function isAllowedContactMomentPhotoType(mimeType: string) {
  return allowedContactMomentPhotoTypes.includes(mimeType as typeof allowedContactMomentPhotoTypes[number]);
}

function normalizeContactMomentPhoto(value: unknown): ContactMomentPhoto | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ContactMomentPhoto>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.originalName !== "string" ||
    typeof candidate.storedName !== "string" ||
    typeof candidate.mimeType !== "string" ||
    typeof candidate.size !== "number" ||
    typeof candidate.uploadedById !== "string" ||
    typeof candidate.uploadedAt !== "string"
  ) {
    return undefined;
  }
  return {
    id: candidate.id,
    originalName: sanitizeOriginalPhotoName(candidate.originalName),
    storedName: candidate.storedName.replace(/[^\w.\-]/g, ""),
    mimeType: candidate.mimeType,
    size: candidate.size,
    uploadedById: candidate.uploadedById,
    uploadedAt: candidate.uploadedAt,
  };
}
