import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exportContactMomentPdf } from "@/lib/contact-moment-pdf";
import type { ContactMoment, Representative } from "@/lib/types";

const representative: Representative = {
  id: "rep-contact-pdf",
  firstName: "Aurelie",
  lastName: "Milet",
  initials: "AM",
  country: "BE",
  team: "BE Team 1",
  teamId: "team-be-1",
  level: "Sales Executive",
  levelColor: "blue",
  lastCoaching: "2026-06-20",
  openActions: 1,
  email: "aurelie.milet@example.test",
  phone: "+32 470 00 00 00",
  kpis: [],
};

const contact: ContactMoment = {
  id: "contact-pdf-test",
  representativeId: representative.id,
  initiatorId: "leader-1",
  ownerId: "leader-1",
  country: "BE",
  teamId: representative.teamId,
  status: "afgesloten",
  plannedDate: "2026-08-10",
  startTime: "09:00",
  endTime: "10:00",
  notifyRepresentative: true,
  subject: "Pipeline opvolging",
  contactType: "Telefonisch",
  location: "Antwerpen",
  reason: "Pipeline opvolging",
  reportedProblems: "",
  leaderThemes: ["Planning en organisatie"],
  representativeKpis: [],
  representativeThemes: [],
  discussedThemes: ["Planning en organisatie"],
  conclusion: "<p>Definitief verslag met concrete afspraken.</p>",
  reportHtml: "<p>Definitief verslag met concrete afspraken.</p>",
  finalSnapshot: "<p>Definitief verslag met concrete afspraken.</p>",
  actionPoints: [{
    id: "action-contact-pdf",
    title: "Bel twee slapende klanten opnieuw op",
    type: "vaardigheid",
    due: "2026-08-20",
    status: "open",
    priority: "normaal",
  }],
  photos: [{
    id: "photo-1",
    originalName: "toonbank.jpg",
    storedName: "photo-1.jpg",
    mimeType: "image/jpeg",
    size: 1024,
    uploadedById: "leader-1",
    uploadedAt: "2026-08-10T08:30:00.000Z",
  }],
  sharedAt: "2026-08-10T10:15:00.000Z",
  sharedById: "leader-1",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-10T10:15:00.000Z",
};

async function main() {
  const result = await exportContactMomentPdf(
    { contact, representative, language: "nl" },
    { download: false }
  );
  assert.ok(result.pageCount >= 2, `Onverwacht laag pagina-aantal: ${result.pageCount}`);
  const signature = Buffer.from(result.arrayBuffer).subarray(0, 4).toString("utf8");
  assert.equal(signature, "%PDF", "Ongeldige PDF-signatuur.");
  const outputDirectory = resolve("output/pdf");
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = resolve(outputDirectory, "contactmomentrapport-test.pdf");
  await writeFile(outputPath, Buffer.from(result.arrayBuffer));
  console.log(JSON.stringify({ outputPath, pageCount: result.pageCount, bytes: result.arrayBuffer.byteLength }));
}

void main();
