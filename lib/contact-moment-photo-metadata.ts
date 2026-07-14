import type { ContactMomentPhoto } from "@/lib/types";

export const allowedContactMomentPhotoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxContactMomentPhotoSize = 8 * 1024 * 1024;
export const maxContactMomentPhotos = 20;
export const contactMomentPhotoAccept = allowedContactMomentPhotoTypes.join(",");

export function parseContactMomentPhotos(value: string | null | undefined): ContactMomentPhoto[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeContactMomentPhoto)
      .filter((item): item is ContactMomentPhoto => Boolean(item))
      .sort((left, right) => left.sortOrder - right.sortOrder);
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

export function hasValidContactMomentPhotoSignature(bytes: Buffer | Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
  }
  return false;
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
    sortOrder: typeof candidate.sortOrder === "number" ? candidate.sortOrder : 0,
  };
}
