import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  hasValidContactMomentPhotoSignature,
  parseContactMomentPhotos,
} from "@/lib/contact-moment-photo-metadata";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

assert.equal(hasValidContactMomentPhotoSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), true);
assert.equal(hasValidContactMomentPhotoSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
assert.equal(hasValidContactMomentPhotoSignature(Buffer.from("RIFFxxxxWEBP"), "image/webp"), true);
assert.equal(hasValidContactMomentPhotoSignature(Buffer.from("not an image"), "image/png"), false);

const sorted = parseContactMomentPhotos(JSON.stringify([
  {
    id: "second",
    originalName: "second.jpg",
    storedName: "second.jpg",
    mimeType: "image/jpeg",
    size: 1,
    uploadedById: "leader",
    uploadedAt: "2026-07-14T09:00:00.000Z",
    sortOrder: 2,
  },
  {
    id: "first",
    originalName: "first.jpg",
    storedName: "first.jpg",
    mimeType: "image/jpeg",
    size: 1,
    uploadedById: "leader",
    uploadedAt: "2026-07-14T09:00:00.000Z",
    sortOrder: 1,
  },
]));
assert.deepEqual(sorted.map((photo) => photo.id), ["first", "second"]);

const service = read("lib/server/contact-moment-photos.ts");
assert.match(service, /uploadContactMomentPhotos/);
assert.match(service, /hasValidContactMomentPhotoSignature/);
assert.match(service, /assertCanManageMutableContactMoment/);
assert.match(service, /maxContactMomentPhotos/);

const route = read("app/api/workflows/contact-moments/[id]/photos/route.ts");
assert.match(route, /formData\.getAll\("file"\)/);

const component = read("components/contact-help-workflows.tsx");
assert.match(component, /function PendingPhotoPicker/);
assert.match(component, /saveContactMomentAsync/);
assert.match(component, /multiple/);
assert.match(component, /photoUnavailable/);
assert.match(component, /photosReadOnly/);

for (const locale of ["nl", "fr", "de"]) {
  const messages = JSON.parse(read(`locales/${locale}.json`)) as Record<string, string>;
  for (const key of [
    "contactHelp.contact.addPhotos",
    "contactHelp.contact.uploading",
    "contactHelp.contact.photoTooLarge",
    "contactHelp.contact.photoUnsupportedType",
    "contactHelp.contact.photosReadOnly",
    "contactHelp.contact.photoUnavailable",
  ]) {
    assert.ok(messages[key], `${locale} mist ${key}`);
  }
}

console.log("Contactmoment-afbeeldingen voorbereiding statisch gecontroleerd.");
