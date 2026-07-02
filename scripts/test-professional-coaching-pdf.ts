import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exportProfessionalCoachingReport } from "@/lib/coaching/export-professional-report";
import type { CoachingIntervention, Representative } from "@/lib/types";

const representative: Representative = {
  id: "rep-pdf-test",
  firstName: "Sofie",
  lastName: "Vermeulen",
  initials: "SV",
  country: "BE",
  team: "BE Team 1",
  teamId: "team-be-1",
  level: "Professional",
  levelColor: "blue",
  lastCoaching: "2026-06-20",
  openActions: 2,
  email: "sofie.vermeulen@example.com",
  phone: "+32 470 00 00 00",
  kpis: [
    { label: "Sales / Day", value: "€ 1.240", target: "€ 1.100", trend: 7 },
    { label: "Orders", value: "18", target: "16", trend: 4 },
    { label: "Conversie", value: "42%", target: "40%", trend: 2 },
  ],
};

const scoreNames = [
  "Voorbereiding van het bezoek",
  "Openingsfase",
  "Behoefteanalyse",
  "Productpresentatie",
  "Omgaan met bezwaren",
  "Prijsverdediging",
  "Afsluittechniek",
  "Koppelverkoop",
  "Administratieve afwerking",
  "Afspraken voor opvolging",
];

const intervention: CoachingIntervention = {
  id: "coaching-pdf-test",
  representativeId: representative.id,
  initiatorId: "leader-1",
  ownerId: "leader-1",
  country: "BE",
  teamId: representative.teamId,
  title: "Begeleiding Sofie Vermeulen",
  status: "akkoord_door_vertegenwoordiger",
  plannedDate: "2026-06-30",
  startTime: "08:30",
  endTime: "17:00",
  notifyRepresentative: true,
  outlookSyncStatus: "SYNCED",
  focusNames: ["Voorbereiding", "Gesprek", "Afsluiting"],
  scores: scoreNames.map((criterion, index) => ({
    criterion,
    focus: index < 3 ? "Voorbereiding" : index < 8 ? "Gesprek" : "Afsluiting",
    value: [75, 100, 75, 75, 50, 75, 75, 50, 100, 75][index] as 0 | 25 | 50 | 75 | 100,
    previousScore: [50, 75, 75, 50, 75, 75, 50, 50, 75, 75][index],
    description: index % 3 === 0 ? "Duidelijke vooruitgang zichtbaar tijdens het klantenbezoek." : "",
  })),
  actionPoints: [
    { id: "action-1", title: "Bij elk bezoek drie open vragen voorbereiden", description: "De vragen vooraf noteren en na het bezoek kort evalueren.", type: "vaardigheid", due: "2026-07-15", status: "in_uitvoering", owner: "Sofie Vermeulen", priority: "hoog" },
    { id: "action-2", title: "Koppelverkoop structureel voorstellen", type: "kpi", due: "2026-07-31", status: "open", owner: "Sofie Vermeulen", priority: "normaal" },
  ],
  dossier: {
    arrivalTime: "08:20",
    departureTime: "17:10",
    kilometers: "186",
    area: "Antwerpen - Kempen",
    sector: "Retail en horeca",
    groupAttentionPoints: ["Koppelverkoop", "Afsluittechniek", "Planning"],
    individualAttentionPoint: "Meer stilte laten na een open vraag.",
    generalScores: scoreNames.slice(0, 5).map((criterion, index) => ({ criterion, score: (index % 5 + 1) as 1 | 2 | 3 | 4 | 5, comment: "Heldere observatie met concreet voorbeeld." })),
    personalityScores: scoreNames.slice(5).map((criterion, index) => ({ criterion, score: ((index + 2) % 5 + 1) as 1 | 2 | 3 | 4 | 5, comment: "Professionele en rustige houding." })),
  },
  appointments: Array.from({ length: 8 }, (_, appointmentIndex) => ({
    id: `appointment-${appointmentIndex + 1}`,
    customer: `Klant ${appointmentIndex + 1} - Demozaak`,
    customerNumber: `K-${1000 + appointmentIndex}`,
    place: appointmentIndex % 2 ? "Turnhout" : "Antwerpen",
    relationType: appointmentIndex % 3 ? "klant" as const : "prospect" as const,
    appointmentType: appointmentIndex % 4 ? "vast" as const : "rood" as const,
    arrivalTime: `${9 + appointmentIndex}:00`,
    departureTime: `${9 + appointmentIndex}:45`,
    activity: "Klantenbezoek met productpresentatie, behoefteanalyse en concrete vervolgafspraak.",
    scores: scoreNames.map((criterion, scoreIndex) => ({
      criterion,
      score: ((scoreIndex + appointmentIndex) % 5 + 1) as 1 | 2 | 3 | 4 | 5,
      previousScore: ((scoreIndex + appointmentIndex + 4) % 5 + 1) as 1 | 2 | 3 | 4 | 5,
      comment: scoreIndex % 3 === 0 ? "Sterk uitgevoerd; volgende keer nog gerichter samenvatten." : "",
    })),
    remarks: "De klant reageerde positief. Volgende week volgt een offerte en telefonische opvolging.",
  })),
  createdAt: "2026-06-25T08:00:00.000Z",
  updatedAt: "2026-06-30T17:15:00.000Z",
  finalizedAt: "2026-06-30T17:15:00.000Z",
  sentForApprovalAt: "2026-06-30T17:20:00.000Z",
  sentForApprovalById: "leader-1",
  approvedByRepAt: "2026-07-01T08:15:00.000Z",
  approvedByRepId: representative.id,
};

async function main() {
  const logo = await readFile(resolve("public/assets/fieldforce-logo-tight.png"));
  const result = await exportProfessionalCoachingReport(
    {
      intervention,
      representative,
      leaderName: "Charlotte Maes",
      language: "nl",
      logoDataUrl: `data:image/png;base64,${logo.toString("base64")}`,
    },
    { download: false }
  );
  if (result.pageCount > 14) throw new Error(`Rapport is onvoldoende compact: ${result.pageCount} pagina's`);
  if (result.pageCount < 8) throw new Error(`Onverwacht laag pagina-aantal: ${result.pageCount}`);
  const signature = Buffer.from(result.arrayBuffer).subarray(0, 4).toString("utf8");
  if (signature !== "%PDF") throw new Error("Ongeldige PDF-signatuur.");
  const outputDirectory = resolve("output/pdf");
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = resolve(outputDirectory, "professioneel-begeleidingsrapport-test.pdf");
  await writeFile(outputPath, Buffer.from(result.arrayBuffer));
  console.log(JSON.stringify({ outputPath, pageCount: result.pageCount, bytes: result.arrayBuffer.byteLength }));
}

void main();
