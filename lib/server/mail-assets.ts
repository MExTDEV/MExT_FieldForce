import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { badRequest, forbidden, notFound } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { can } from "@/lib/permissions";
import type { MockUser } from "@/lib/types";

export const mailAssetMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxMailAssetSize = 8 * 1024 * 1024;

export async function uploadMailAsset(actor: MockUser, file: File, altText: string) {
  if (!can(actor, "mail.templates.edit")) forbidden("Je hebt geen toestemming voor dit e-mailbeheer.");
  if (!mailAssetMimeTypes.includes(file.type as typeof mailAssetMimeTypes[number])) {
    badRequest("Alleen JPG-, PNG- en WebP-afbeeldingen zijn toegestaan.");
  }
  if (file.size <= 0 || file.size > maxMailAssetSize) {
    badRequest("Een mailafbeelding mag maximaal 8 MB groot zijn.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(bytes, file.type)) badRequest("Het bestand is geen geldige afbeelding.");

  const id = randomUUID();
  const extension = extensionForMimeType(file.type);
  const storageKey = `mail-assets/${id}${extension}`;
  const path = assetPath(storageKey);
  await mkdir(resolve(uploadRoot(), "mail-assets"), { recursive: true });
  await writeFile(path, bytes, { flag: "wx" });
  try {
    const publicUrl = `${publicAppUrl()}/api/mail/assets/${encodeURIComponent(id)}`;
    const asset = await prisma.mailAsset.create({
      data: {
        id,
        storageKey,
        publicUrl,
        originalName: sanitizeOriginalName(file.name),
        mimeType: file.type,
        byteSize: bytes.length,
        altText: altText.trim().slice(0, 191),
        uploadedById: actor.id,
      },
      select: { id: true, publicUrl: true, originalName: true, mimeType: true, byteSize: true, altText: true },
    });
    return asset;
  } catch (error) {
    await rm(path, { force: true });
    throw error;
  }
}

export async function getMailAssetForRequest(id: string) {
  const asset = await prisma.mailAsset.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, active: true } });
  if (!asset?.active) notFound("Mailafbeelding niet gevonden.");
  let bytes: Buffer;
  try {
    bytes = await readFile(assetPath(asset.storageKey));
  } catch {
    notFound("Mailafbeelding niet gevonden.");
  }
  return { bytes, mimeType: asset.mimeType };
}

export function mailAssetEtag(bytes: Buffer) {
  return `"${createHash("sha256").update(bytes).digest("hex")}"`;
}

function uploadRoot() {
  return resolve(process.env.FIELD_FORCE_UPLOAD_ROOT ?? join(process.cwd(), "storage", "uploads"));
}

function assetPath(storageKey: string) {
  const root = uploadRoot();
  const path = resolve(root, storageKey.split("/").map(safePathSegment).join("/"));
  if (!path.startsWith(`${root}${sep}`) && path !== root) forbidden("Ongeldig bestandspad.");
  return path;
}

function publicAppUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) badRequest("APP_URL is niet geconfigureerd voor mailafbeeldingen.");
  return value.replace(/\/$/, "");
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return ".webp";
}

function hasValidImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function sanitizeOriginalName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim().slice(0, 191) || "mailafbeelding";
}

function safePathSegment(value: string) {
  const cleaned = value.replace(/[^\w.\-]/g, "");
  if (!cleaned) forbidden("Ongeldig bestandspad.");
  return cleaned;
}
