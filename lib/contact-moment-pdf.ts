import { translate } from "@/lib/i18n";
import { richTextToPlainText } from "@/lib/rich-text";
import type { ContactMoment, ContactMomentPhoto, Language, Representative } from "@/lib/types";

type Pdf = import("jspdf").jsPDF;

export type ContactMomentPdfPhoto = ContactMomentPhoto & {
  dataUrl?: string;
};

type ContactMomentPdfInput = {
  contact: ContactMoment;
  representative?: Representative;
  language: Language;
  photos?: ContactMomentPdfPhoto[];
};

type ContactMomentPdfOptions = {
  download?: boolean;
};

const margin = 16;
const pageWidth = 210;
const contentWidth = pageWidth - margin * 2;
const brandBlue = "#1D4ED8";
const slate950 = "#0F172A";
const slate700 = "#334155";
const slate500 = "#64748B";
const slate200 = "#E2E8F0";
const lightBlue = "#EFF6FF";

export async function exportContactMomentPdf(
  input: ContactMomentPdfInput,
  options: ContactMomentPdfOptions = {}
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const t = (key: Parameters<typeof translate>[1]) => translate(input.language, key);
  const representativeName = input.representative
    ? `${input.representative.firstName} ${input.representative.lastName}`
    : t("contactHelp.common.representative");
  const photos = input.photos ?? input.contact.photos ?? [];

  drawHeader(pdf, t("contactHelp.contact.pdfTitle"), representativeName);
  let y = 44;
  y = drawMeta(pdf, input, representativeName, y);
  y = drawSection(pdf, t("contactHelp.field.report"), reportText(input.contact), y + 4);

  if (input.contact.actionPoints.length) {
    drawListSection(
      pdf,
      t("contactHelp.contact.pdfActionPoints"),
      input.contact.actionPoints.map((action) => `${action.title}${action.due ? ` - ${formatDate(action.due, input.language)}` : ""}`),
      y + 2
    );
  }

  if (photos.length) {
    await drawPhotoPages(pdf, photos, input.language);
  }

  drawFooters(pdf);
  const filename = `Contactmoment_${slugify(representativeName)}_${input.contact.plannedDate ?? input.contact.createdAt.slice(0, 10)}.pdf`;
  const arrayBuffer = pdf.output("arraybuffer");
  if (options.download !== false) pdf.save(filename);
  return { arrayBuffer, filename, pageCount: pdf.getNumberOfPages() };
}

function drawHeader(pdf: Pdf, title: string, subtitle: string) {
  pdf.setFillColor(brandBlue);
  pdf.rect(0, 0, pageWidth, 30, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor("#FFFFFF");
  pdf.text(title, margin, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(subtitle, margin, 25);
}

function drawMeta(pdf: Pdf, input: ContactMomentPdfInput, representativeName: string, y: number) {
  const t = (key: Parameters<typeof translate>[1]) => translate(input.language, key);
  const rows = [
    [t("contactHelp.field.employee"), representativeName],
    [t("contactHelp.field.date"), input.contact.plannedDate ? formatDate(input.contact.plannedDate, input.language) : "-"],
    [t("contactHelp.field.time"), [input.contact.startTime, input.contact.endTime].filter(Boolean).join(" - ") || "-"],
    [t("contactHelp.field.subject"), input.contact.subject || input.contact.reason || "-"],
    [t("contactHelp.field.type"), input.contact.contactType || "-"],
    [t("contactHelp.field.location"), input.contact.location || "-"],
    [t("contactHelp.field.status"), statusLabel(input.language, input.contact.status)],
    [t("contactHelp.field.sharedAt"), input.contact.sharedAt ? formatDateTime(input.contact.sharedAt, input.language) : "-"],
  ];

  pdf.setFillColor(lightBlue);
  pdf.roundedRect(margin, y, contentWidth, 52, 2, 2, "F");
  pdf.setFontSize(8);
  rows.forEach((row, index) => {
    const column = index % 2;
    const line = Math.floor(index / 2);
    const x = margin + 6 + column * 88;
    const rowY = y + 10 + line * 11;
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(slate500);
    pdf.text(row[0].toUpperCase(), x, rowY);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(slate950);
    pdf.text(truncate(row[1], 46), x, rowY + 4.2);
  });
  return y + 58;
}

function drawSection(pdf: Pdf, title: string, body: string, y: number) {
  y = ensureSpace(pdf, y, 32);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(slate950);
  pdf.text(title, margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(slate700);
  const lines = pdf.splitTextToSize(body || "-", contentWidth);
  for (const line of lines) {
    y = ensureSpace(pdf, y, 7);
    pdf.text(line, margin, y);
    y += 5;
  }
  return y + 4;
}

function drawListSection(pdf: Pdf, title: string, items: string[], y: number) {
  y = ensureSpace(pdf, y, 28);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(slate950);
  pdf.text(title, margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(slate700);
  for (const item of items) {
    const lines = pdf.splitTextToSize(`- ${item}`, contentWidth);
    for (const line of lines) {
      y = ensureSpace(pdf, y, 7);
      pdf.text(line, margin, y);
      y += 5;
    }
  }
  return y + 4;
}

async function drawPhotoPages(pdf: Pdf, photos: ContactMomentPdfPhoto[], language: Language) {
  const title = translate(language, "contactHelp.contact.pdfPhotos");
  const fallback = translate(language, "contactHelp.contact.pdfPhotoUnavailable");
  for (const [index, photo] of photos.entries()) {
    pdf.addPage();
    drawHeader(pdf, title, `${index + 1}/${photos.length} - ${photo.originalName}`);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(slate500);
    pdf.text(`${photo.originalName} - ${formatBytes(photo.size)} - ${formatDateTime(photo.uploadedAt, language)}`, margin, 42);
    if (!photo.dataUrl) {
      drawPhotoFallback(pdf, fallback);
      continue;
    }
    try {
      const box = fitImage(await imageDimensions(photo.dataUrl), contentWidth, 190);
      pdf.addImage(
        photo.dataUrl,
        imageFormat(photo.mimeType),
        margin + (contentWidth - box.width) / 2,
        50,
        box.width,
        box.height,
        undefined,
        "FAST"
      );
    } catch {
      drawPhotoFallback(pdf, fallback);
    }
  }
}

function drawPhotoFallback(pdf: Pdf, label: string) {
  pdf.setDrawColor(slate200);
  pdf.setFillColor("#F8FAFC");
  pdf.roundedRect(margin, 50, contentWidth, 85, 2, 2, "FD");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(slate500);
  pdf.text(label, pageWidth / 2, 94, { align: "center" });
}

function drawFooters(pdf: Pdf) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(slate200);
    pdf.line(margin, 282, pageWidth - margin, 282);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(slate500);
    pdf.text(`FieldForce - ${page}/${pages}`, margin, 288);
  }
}

function ensureSpace(pdf: Pdf, y: number, needed: number) {
  if (y + needed <= 276) return y;
  pdf.addPage();
  return 24;
}

function reportText(contact: ContactMoment) {
  return richTextToPlainText(contact.finalSnapshot ?? contact.reportHtml ?? contact.conclusion);
}

function formatDate(value: string, language: Language) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(localeFor(language));
}

function formatDateTime(value: string, language: Language) {
  return new Date(value).toLocaleString(localeFor(language));
}

function localeFor(language: Language) {
  return language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
}

function statusLabel(language: Language, status: ContactMoment["status"]) {
  const key = `status.${status}` as Parameters<typeof translate>[1];
  const label = translate(language, key);
  return label === key ? status.replaceAll("_", " ") : label;
}

function imageFormat(mimeType: string) {
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/webp") return "WEBP";
  return "JPEG";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function imageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    image.onerror = () => reject(new Error("Afbeelding kon niet worden gelezen."));
    image.src = dataUrl;
  });
}

function fitImage(
  dimensions: { width: number; height: number },
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
  return {
    width: dimensions.width * ratio,
    height: dimensions.height * ratio,
  };
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80) || "contactmoment";
}
