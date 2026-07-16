import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Prisma } from "@prisma/client";
import type { Language, MockUser } from "@/lib/types";
import { badRequest, forbidden, notFound } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { contractOwnerWhere, requireContractAccess, requireContractManagement } from "@/lib/contract/access";
import { OoxmlPackage, decodeXml } from "@/lib/contract/importer/ooxml";

type ParameterKind = "text" | "money" | "number" | "date" | "image" | "table";
type ParameterAudience = "customer" | "internal";

export type ContractLetterParameter = {
  key: string;
  kind: ParameterKind;
  audience: ParameterAudience;
  recommended?: boolean;
};

type TemplateValidation = {
  foundParameters: string[];
  unknownParameters: string[];
  missingRecommendedParameters: string[];
  internalParameters: string[];
  errors: string[];
  warnings: string[];
  productListValid: boolean;
  signatureValid: boolean;
};

export const CONTRACT_LETTER_GENERATOR_VERSION = "MEXT_CONTRACT_LETTER_2026_V1";

const maxTemplateBytes = 8_000_000;
const letterStorageFolder = "contract-letters";

export const contractLetterParameters: ContractLetterParameter[] = [
  { key: "KLANTNAAM", kind: "text", audience: "customer", recommended: true },
  { key: "CONTACTPERSOON", kind: "text", audience: "customer" },
  { key: "KLANTEMAIL", kind: "text", audience: "customer" },
  { key: "KLANTTELEFOON", kind: "text", audience: "customer" },
  { key: "KLANTADRES", kind: "text", audience: "customer" },
  { key: "STRAAT", kind: "text", audience: "customer" },
  { key: "HUISNUMMER", kind: "text", audience: "customer" },
  { key: "POSTCODE", kind: "text", audience: "customer" },
  { key: "PLAATS", kind: "text", audience: "customer" },
  { key: "LAND", kind: "text", audience: "customer" },
  { key: "LANDCODE", kind: "text", audience: "customer" },
  { key: "BTWNUMMER", kind: "text", audience: "customer" },
  { key: "KLANTTAAL", kind: "text", audience: "customer" },
  { key: "BEREKENINGSNUMMER", kind: "text", audience: "customer", recommended: true },
  { key: "BEREKENINGSNAAM", kind: "text", audience: "customer" },
  { key: "BEREKENINGSDATUM", kind: "date", audience: "customer" },
  { key: "CONTRACTDUUR", kind: "text", audience: "customer" },
  { key: "CONTRACTDUUR_JAREN", kind: "number", audience: "customer" },
  { key: "KORTINGSPERCENTAGE", kind: "number", audience: "customer" },
  { key: "SUBTOTAAL", kind: "money", audience: "customer" },
  { key: "KORTINGSBEDRAG", kind: "money", audience: "customer" },
  { key: "JAARPRIJS", kind: "money", audience: "customer", recommended: true },
  { key: "MAANDPRIJS", kind: "money", audience: "customer" },
  { key: "TOTALECONTRACTWAARDE", kind: "money", audience: "customer" },
  { key: "MODELNAAM", kind: "text", audience: "customer" },
  { key: "MODELVERSIE", kind: "text", audience: "customer" },
  { key: "VERKOPERNAAM", kind: "text", audience: "customer" },
  { key: "VERKOPERVOORNAAM", kind: "text", audience: "customer" },
  { key: "VERKOPERACHTERNAAM", kind: "text", audience: "customer" },
  { key: "VERKOPEREMAIL", kind: "text", audience: "customer" },
  { key: "VERKOPERTELEFOON", kind: "text", audience: "customer" },
  { key: "TEAMNAAM", kind: "text", audience: "customer" },
  { key: "VERKOPERLAND", kind: "text", audience: "customer" },
  { key: "VERKOPERLANDCODE", kind: "text", audience: "customer" },
  { key: "ONDERTEKENAAR", kind: "text", audience: "customer" },
  { key: "ONDERTEKENPLAATS", kind: "text", audience: "customer" },
  { key: "ONDERTEKENDATUM", kind: "date", audience: "customer" },
  { key: "HANDTEKENING", kind: "image", audience: "customer", recommended: true },
  { key: "PRODUCTLIST", kind: "table", audience: "customer", recommended: true },
  { key: "AANTAL_PRODUCTREGELS", kind: "number", audience: "customer" },
  { key: "TOTAALAANTAL_PRODUCTEN", kind: "number", audience: "customer" },
  { key: "TOTALEKOST", kind: "money", audience: "internal" },
];

const parameterMap = new Map(contractLetterParameters.map((item) => [item.key, item]));

export async function listContractLetterTemplates(actor: MockUser) {
  requireContractManagement(actor, "contractModelsManage");
  const templates = await prisma.contractLetterTemplate.findMany({
    orderBy: [{ language: "asc" }, { version: "desc" }],
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
      activatedBy: { select: { firstName: true, lastName: true } },
    },
  });
  return {
    parameterRegister: contractLetterParameters,
    templates: templates.map((template) => ({
      id: template.id,
      language: template.language,
      name: template.name,
      version: template.version,
      status: template.status,
      sourceFileName: template.sourceFileName,
      sourceFileSha256: template.sourceFileSha256,
      foundParameters: parseJson<string[]>(template.usedParametersJson, []),
      validation: parseJson<TemplateValidation>(template.validationJson, emptyValidation()),
      uploadedByName: `${template.uploadedBy.firstName} ${template.uploadedBy.lastName}`.trim(),
      activatedByName: template.activatedBy ? `${template.activatedBy.firstName} ${template.activatedBy.lastName}`.trim() : null,
      activatedAt: template.activatedAt?.toISOString() ?? null,
      createdAt: template.createdAt.toISOString(),
    })),
  };
}

export async function uploadContractLetterTemplate(
  actor: MockUser,
  input: { language: Language; fileName: string; mimeType?: string; buffer: Buffer }
) {
  requireContractManagement(actor, "contractModelsManage");
  if (!["nl", "fr", "de"].includes(input.language)) badRequest("contract.letter.error.language");
  assertDocxFile(input.fileName, input.buffer);
  const validation = validateContractLetterTemplate(input.buffer);
  const sourceFileSha256 = sha256Hex(input.buffer);
  const latest = await prisma.contractLetterTemplate.findFirst({
    where: { language: input.language },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const template = await prisma.contractLetterTemplate.create({
    data: {
      language: input.language,
      name: input.fileName.replace(/\.docx$/i, ""),
      version: (latest?.version ?? 0) + 1,
      status: validation.errors.length ? "FAILED" : "DRAFT",
      sourceFileName: sanitizeFileName(input.fileName),
      sourceFileSha256,
      sourceMimeType: input.mimeType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceContent: input.buffer.toString("base64"),
      usedParametersJson: JSON.stringify(validation.foundParameters),
      validationJson: JSON.stringify(validation),
      uploadedByUserId: actor.id,
    },
  });
  await writeAuditLog({
    actorId: actor.id,
    entityType: "ContractLetterTemplate",
    entityId: template.id,
    action: validation.errors.length ? "contract.letter.validation_failed" : "contract.letter.uploaded",
    newValue: { language: template.language, version: template.version, validation },
  });
  return { id: template.id, validation };
}

export async function activateContractLetterTemplate(actor: MockUser, id: string) {
  requireContractManagement(actor, "contractModelsManage");
  const template = await prisma.contractLetterTemplate.findUnique({ where: { id } });
  if (!template) notFound("contract.letter.error.notFound");
  const validation = parseJson<TemplateValidation>(template.validationJson, emptyValidation());
  if (validation.errors.length || validation.unknownParameters.length) {
    badRequest("contract.letter.error.invalidTemplate");
  }
  await prisma.$transaction([
    prisma.contractLetterTemplate.updateMany({
      where: { language: template.language, status: "ACTIVE", id: { not: id } },
      data: { status: "INACTIVE" },
    }),
    prisma.contractLetterTemplate.update({
      where: { id },
      data: { status: "ACTIVE", activatedByUserId: actor.id, activatedAt: new Date() },
    }),
  ]);
  await writeAuditLog({
    actorId: actor.id,
    entityType: "ContractLetterTemplate",
    entityId: id,
    action: "contract.letter.activated",
    newValue: { language: template.language, version: template.version },
  });
  return { ok: true };
}

export async function generateAndSignContractLetter(
  actor: MockUser,
  calculationId: string,
  input: { signedByName: string; signedPlace?: string; signatureData?: string }
) {
  requireContractAccess(actor);
  if (!input.signedByName.trim()) badRequest("contract.error.signedByRequired");
  const calculation = await prisma.contractCalculation.findFirst({
    where: { id: calculationId, ...contractOwnerWhere(actor) },
    include: {
      customer: true,
      lines: { orderBy: { sortOrder: "asc" } },
      owner: { select: { firstName: true, lastName: true, email: true, mobile: true, country: true } },
      teamSnapshot: { select: { name: true } },
      modelVersion: true,
      generatedDocuments: { select: { documentVersion: true }, orderBy: { documentVersion: "desc" }, take: 1 },
    },
  });
  if (!calculation) notFound("contract.error.calculationNotFound");
  if (calculation.status !== "DRAFT") forbidden("contract.error.signedLocked");
  if (!calculation.lines.length) badRequest("contract.letter.error.noLines");
  const language = calculation.customerLanguage;
  const template = await prisma.contractLetterTemplate.findFirst({
    where: { language, status: "ACTIVE" },
    orderBy: { activatedAt: "desc" },
  });
  if (!template) badRequest("contract.letter.error.noActiveTemplate");
  const signatureData = input.signatureData?.startsWith("data:image/png;base64,") ? input.signatureData : undefined;
  if (!signatureData) badRequest("contract.letter.error.signatureRequired");
  const snapshot = buildPlaceholderSnapshot(calculation, input);
  const pdfBytes = await renderSignedContractLetterPdf(calculation, snapshot, signatureData);
  const documentVersion = (calculation.generatedDocuments[0]?.documentVersion ?? 0) + 1;
  const generatedFileName = `contract-${calculation.calculationNumber}-signed-v${documentVersion}.pdf`;
  const stored = await storeContractLetterPdf(calculation.id, generatedFileName, pdfBytes);
  const updated = await prisma.$transaction(async (tx) => {
    const document = await tx.contractGeneratedDocument.create({
      data: {
        calculationId: calculation.id,
        templateId: template.id,
        language,
        documentVersion,
        placeholderSnapshotJson: JSON.stringify(snapshot),
        generatedFileName,
        signedPdfStorageKey: stored.storageKey,
        signedPdfSha256: stored.sha256,
        generatedByUserId: actor.id,
        signedAt: new Date(),
      },
    });
    const signed = await tx.contractCalculation.update({
      where: { id: calculation.id },
      data: {
        status: "SIGNED",
        contractLetterTemplateId: template.id,
        contractLetterLanguage: language,
        contractLetterGeneratedAt: new Date(),
        signedByName: input.signedByName.trim(),
        signedPlace: input.signedPlace?.trim() || null,
        signedAt: new Date(),
        signatureData,
      },
      include: { customer: true, lines: true, owner: { select: { firstName: true, lastName: true } } },
    });
    return { document, signed };
  });
  await writeAuditLog({
    actorId: actor.id,
    entityType: "ContractGeneratedDocument",
    entityId: updated.document.id,
    action: "contract.letter.signed",
    newValue: { calculationId: calculation.id, templateId: template.id, documentVersion },
  });
  return {
    calculation: updated.signed,
    document: {
      id: updated.document.id,
      downloadUrl: `/api/contract/documents/${updated.document.id}/download`,
      fileName: generatedFileName,
    },
  };
}

export async function getContractGeneratedDocumentForDownload(actor: MockUser, id: string) {
  requireContractAccess(actor);
  const document = await prisma.contractGeneratedDocument.findFirst({
    where: { id, calculation: contractOwnerWhere(actor) },
    include: { calculation: { select: { calculationNumber: true } } },
  });
  if (!document) notFound("contract.letter.error.documentNotFound");
  const bytes = await readStoredContractLetterPdf(document.signedPdfStorageKey);
  await writeAuditLog({
    actorId: actor.id,
    entityType: "ContractGeneratedDocument",
    entityId: document.id,
    action: "contract.letter.downloaded",
    newValue: { calculationNumber: document.calculation.calculationNumber },
  });
  return { bytes, fileName: document.generatedFileName, sha256: document.signedPdfSha256 };
}

export function validateContractLetterTemplate(buffer: Buffer): TemplateValidation {
  const validation = emptyValidation();
  if (buffer.length <= 0 || buffer.length > maxTemplateBytes) validation.errors.push("contract.letter.error.fileSize");
  const pkg = new OoxmlPackage(buffer);
  if (!pkg.has("[Content_Types].xml") || !pkg.has("word/document.xml")) {
    validation.errors.push("contract.letter.error.notDocx");
  }
  if (pkg.list("word/").some((name) => name.toLowerCase().endsWith("vbaproject.bin"))) {
    validation.errors.push("contract.letter.error.macros");
  }
  const xmlParts = [
    "word/document.xml",
    ...pkg.list("word/header"),
    ...pkg.list("word/footer"),
  ].filter((name) => name.endsWith(".xml") && pkg.has(name));
  const text = xmlParts.map((name) => extractText(pkg.text(name))).join("\n");
  const found = [...new Set([...text.matchAll(/\[[A-Z0-9_]+\]/g)].map((match) => match[0].slice(1, -1)))].sort();
  validation.foundParameters = found;
  validation.unknownParameters = found.filter((key) => !parameterMap.has(key));
  validation.internalParameters = found.filter((key) => parameterMap.get(key)?.audience === "internal");
  validation.missingRecommendedParameters = contractLetterParameters
    .filter((param) => param.recommended && !found.includes(param.key))
    .map((param) => param.key);
  validation.warnings.push(...validation.missingRecommendedParameters.map((key) => `contract.letter.warning.missing:${key}`));
  validation.warnings.push(...validation.internalParameters.map((key) => `contract.letter.warning.internal:${key}`));
  if (validation.unknownParameters.length) validation.errors.push("contract.letter.error.unknownParameters");
  const documentXml = pkg.text("word/document.xml");
  const paragraphs = [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match) => extractText(match[0]).trim());
  const productParagraphs = paragraphs.filter((paragraph) => paragraph.includes("[PRODUCTLIST]"));
  validation.productListValid = productParagraphs.length === 1 && productParagraphs[0] === "[PRODUCTLIST]";
  if (found.includes("PRODUCTLIST") && !validation.productListValid) validation.errors.push("contract.letter.error.productListPlacement");
  const signatureParagraphs = paragraphs.filter((paragraph) => paragraph.includes("[HANDTEKENING]"));
  validation.signatureValid = signatureParagraphs.length <= 1 && (!signatureParagraphs.length || signatureParagraphs[0] === "[HANDTEKENING]");
  if (found.includes("HANDTEKENING") && !validation.signatureValid) validation.errors.push("contract.letter.error.signaturePlacement");
  return validation;
}

function assertDocxFile(fileName: string, buffer: Buffer) {
  if (!/\.docx$/i.test(fileName) || /\.docm$/i.test(fileName)) badRequest("contract.letter.error.extension");
  if (buffer.length <= 0 || buffer.length > maxTemplateBytes) badRequest("contract.letter.error.fileSize");
}

function extractText(xml: string) {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("");
}

function emptyValidation(): TemplateValidation {
  return {
    foundParameters: [],
    unknownParameters: [],
    missingRecommendedParameters: [],
    internalParameters: [],
    errors: [],
    warnings: [],
    productListValid: false,
    signatureValid: false,
  };
}

function buildPlaceholderSnapshot(
  calculation: Awaited<ReturnType<typeof prisma.contractCalculation.findFirst>> & {
    customer: NonNullable<Awaited<ReturnType<typeof prisma.contractCustomer.findFirst>>>;
    lines: Array<{
      quantity: Prisma.Decimal;
      articleNumberSnapshot: string;
      descriptionNlSnapshot: string;
      descriptionFrSnapshot: string;
      descriptionDeSnapshot: string;
      sortOrder: number;
    }>;
    owner: { firstName: string; lastName: string; email: string; mobile: string | null; country: string };
    teamSnapshot: { name: string } | null;
    modelVersion: { label: string; sourceWorkbookVersion: string | null };
  },
  input: { signedByName: string; signedPlace?: string }
) {
  const language = calculation.customerLanguage;
  const annualPrice = new Prisma.Decimal(calculation.annualPrice);
  const duration = new Prisma.Decimal(calculation.durationYears);
  const values: Record<string, string> = {
    KLANTNAAM: calculation.customer.companyName,
    CONTACTPERSOON: calculation.customer.contactName ?? "",
    KLANTEMAIL: calculation.customer.email ?? "",
    KLANTTELEFOON: calculation.customer.phone ?? "",
    KLANTADRES: calculation.customer.address ?? "",
    STRAAT: calculation.customer.street ?? "",
    HUISNUMMER: calculation.customer.houseNumber ?? "",
    POSTCODE: calculation.customer.postalCode ?? "",
    PLAATS: calculation.customer.city ?? "",
    LAND: countryLabel(calculation.customer.countryCode, language),
    LANDCODE: calculation.customer.countryCode,
    BTWNUMMER: calculation.customer.vatNumber ?? "",
    KLANTTAAL: language.toUpperCase(),
    BEREKENINGSNUMMER: calculation.calculationNumber,
    BEREKENINGSNAAM: calculation.name,
    BEREKENINGSDATUM: formatDate(calculation.createdAt, language),
    CONTRACTDUUR: `${calculation.durationYears} ${yearsLabel(language)}`,
    CONTRACTDUUR_JAREN: String(calculation.durationYears),
    KORTINGSPERCENTAGE: `${calculation.discountPercentageSnapshot.toString()}%`,
    SUBTOTAAL: formatMoney(calculation.subtotal, language),
    KORTINGSBEDRAG: formatMoney(calculation.discountAmount, language),
    JAARPRIJS: formatMoney(calculation.annualPrice, language),
    MAANDPRIJS: formatMoney(annualPrice.div(12).toDecimalPlaces(2), language),
    TOTALECONTRACTWAARDE: formatMoney(annualPrice.mul(duration), language),
    MODELNAAM: calculation.modelVersion.label,
    MODELVERSIE: calculation.modelVersion.sourceWorkbookVersion ?? "",
    VERKOPERNAAM: `${calculation.owner.firstName} ${calculation.owner.lastName}`.trim(),
    VERKOPERVOORNAAM: calculation.owner.firstName,
    VERKOPERACHTERNAAM: calculation.owner.lastName,
    VERKOPEREMAIL: calculation.owner.email,
    VERKOPERTELEFOON: calculation.owner.mobile ?? "",
    TEAMNAAM: calculation.teamSnapshot?.name ?? "",
    VERKOPERLAND: countryLabel(calculation.countrySnapshot, language),
    VERKOPERLANDCODE: calculation.countrySnapshot,
    ONDERTEKENAAR: input.signedByName.trim(),
    ONDERTEKENPLAATS: input.signedPlace?.trim() ?? "",
    ONDERTEKENDATUM: formatDate(new Date(), language),
    AANTAL_PRODUCTREGELS: String(calculation.lines.length),
    TOTAALAANTAL_PRODUCTEN: calculation.lines.reduce((sum, line) => sum.add(line.quantity), new Prisma.Decimal(0)).toString(),
    TOTALEKOST: formatMoney(calculation.totalCost, language),
  };
  return {
    generatorVersion: CONTRACT_LETTER_GENERATOR_VERSION,
    language,
    values,
    products: calculation.lines.map((line) => ({
      articleNumber: line.articleNumberSnapshot,
      description: localizedSnapshot(line, language),
      quantity: line.quantity.toString(),
      sortOrder: line.sortOrder,
    })),
  };
}

async function renderSignedContractLetterPdf(
  calculation: {
    calculationNumber: string;
    name: string;
    durationYears: number;
    customerLanguage: Language;
    customer: { companyName: string };
  },
  snapshot: ReturnType<typeof buildPlaceholderSnapshot>,
  signatureData: string
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const language = calculation.customerLanguage;
  let y = 18;
  pdf.setFillColor("#003B83");
  pdf.rect(0, 0, 210, 24, "F");
  pdf.setTextColor("#FFFFFF");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(contractTitle(language), 14, 15);
  pdf.setTextColor("#0f172a");
  pdf.setFontSize(16);
  y = 38;
  pdf.text(snapshot.values.KLANTNAAM || calculation.customer.companyName, 14, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`${snapshot.values.BEREKENINGSNUMMER} - ${snapshot.values.CONTRACTDUUR}`, 14, y);
  y += 13;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(productListTitle(language), 14, y);
  y += 7;
  y = drawProductTable(pdf, snapshot.products, language, y);
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`${label("JAARPRIJS", language)}: ${snapshot.values.JAARPRIJS}`, 14, y);
  y += 6;
  pdf.text(`${label("TOTALECONTRACTWAARDE", language)}: ${snapshot.values.TOTALECONTRACTWAARDE}`, 14, y);
  y += 14;
  pdf.setFont("helvetica", "normal");
  pdf.text(`${label("ONDERTEKENAAR", language)}: ${snapshot.values.ONDERTEKENAAR}`, 14, y);
  y += 6;
  pdf.text(`${label("ONDERTEKENPLAATS", language)}: ${snapshot.values.ONDERTEKENPLAATS}`, 14, y);
  y += 6;
  pdf.text(`${label("ONDERTEKENDATUM", language)}: ${snapshot.values.ONDERTEKENDATUM}`, 14, y);
  y += 8;
  pdf.addImage(signatureData, "PNG", 14, y, 62, 28);
  pdf.setFontSize(8);
  pdf.setTextColor("#64748B");
  pdf.text("MExT FieldForce", 14, 288);
  return Buffer.from(pdf.output("arraybuffer"));
}

function drawProductTable(pdf: import("jspdf").jsPDF, products: Array<{ articleNumber: string; description: string; quantity: string }>, language: Language, startY: number) {
  let y = startY;
  const drawHeader = () => {
    pdf.setFillColor("#EFF6FF");
    pdf.rect(14, y, 182, 8, "F");
    pdf.setTextColor("#003B83");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(productHeaders(language)[0], 17, y + 5.5);
    pdf.text(productHeaders(language)[1], 55, y + 5.5);
    pdf.text(productHeaders(language)[2], 188, y + 5.5, { align: "right" });
    y += 9;
  };
  drawHeader();
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor("#0f172a");
  pdf.setFontSize(8);
  for (const product of products) {
    const lines = pdf.splitTextToSize(product.description, 102);
    const rowHeight = Math.max(8, lines.length * 4.2 + 3);
    if (y + rowHeight > 270) {
      pdf.addPage();
      y = 20;
      drawHeader();
    }
    pdf.setDrawColor("#E2E8F0");
    pdf.line(14, y - 1, 196, y - 1);
    pdf.text(product.articleNumber, 17, y + 4);
    pdf.text(lines, 55, y + 4);
    pdf.text(formatQuantity(product.quantity, language), 188, y + 4, { align: "right" });
    y += rowHeight;
  }
  return y;
}

async function storeContractLetterPdf(calculationId: string, fileName: string, bytes: Buffer) {
  const storedName = `${randomUUID()}-${sanitizeFileName(fileName)}`;
  const directory = contractLetterDirectory(calculationId);
  await mkdir(directory, { recursive: true });
  const fullPath = safeStoragePath(join(directory, storedName));
  await writeFile(fullPath, bytes, { flag: "wx" });
  return {
    storageKey: `${letterStorageFolder}/${safePathSegment(calculationId)}/${storedName}`,
    sha256: sha256Hex(bytes),
  };
}

async function readStoredContractLetterPdf(storageKey: string) {
  return readFile(storagePathFromKey(storageKey));
}

function storagePathFromKey(storageKey: string) {
  return safeStoragePath(resolve(uploadRoot(), storageKey.replaceAll("/", "\\")));
}

function contractLetterDirectory(calculationId: string) {
  return safeStoragePath(resolve(uploadRoot(), letterStorageFolder, safePathSegment(calculationId)));
}

function uploadRoot() {
  return resolve(process.env.FIELD_FORCE_UPLOAD_ROOT ?? join(process.cwd(), "storage", "uploads"));
}

function safeStoragePath(path: string) {
  const root = uploadRoot();
  const fullPath = resolve(path);
  if (!fullPath.startsWith(root)) forbidden("Ongeldig bestandspad.");
  return fullPath;
}

function safePathSegment(value: string) {
  const cleaned = value.replace(/[^\w.\-]/g, "");
  if (!cleaned) forbidden("Ongeldig bestandspad.");
  return cleaned;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^\w.\- ]/g, "").replace(/\s+/g, " ").trim() || "contractbrief";
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sha256Hex(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function localizedSnapshot(line: { descriptionNlSnapshot: string; descriptionFrSnapshot: string; descriptionDeSnapshot: string }, language: Language) {
  return language === "fr"
    ? line.descriptionFrSnapshot || line.descriptionNlSnapshot
    : language === "de"
      ? line.descriptionDeSnapshot || line.descriptionNlSnapshot
      : line.descriptionNlSnapshot;
}

function formatMoney(value: Prisma.Decimal.Value, language: Language) {
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  return Number(value || 0).toLocaleString(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function formatDate(value: Date, language: Language) {
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  return value.toLocaleDateString(locale);
}

function formatQuantity(value: string, language: Language) {
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  return Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 3 });
}

function yearsLabel(language: Language) {
  return language === "fr" ? "ans" : language === "de" ? "Jahre" : "jaar";
}

function countryLabel(country: string, language: Language) {
  const labels = {
    BE: { nl: "België", fr: "Belgique", de: "Belgien" },
    NL: { nl: "Nederland", fr: "Pays-Bas", de: "Niederlande" },
    DE: { nl: "Duitsland", fr: "Allemagne", de: "Deutschland" },
  } as const;
  return labels[country as keyof typeof labels]?.[language] ?? country;
}

function contractTitle(language: Language) {
  return language === "fr" ? "Contrat" : language === "de" ? "Vertrag" : "Contract";
}

function productListTitle(language: Language) {
  return language === "fr" ? "Produits" : language === "de" ? "Produkte" : "Producten";
}

function productHeaders(language: Language) {
  if (language === "fr") return ["Article", "Description", "Quantité"];
  if (language === "de") return ["Artikel", "Beschreibung", "Anzahl"];
  return ["Artikelnummer", "Omschrijving", "Aantal"];
}

function label(key: string, language: Language) {
  const labels: Record<string, Record<Language, string>> = {
    JAARPRIJS: { nl: "Jaarprijs", fr: "Prix annuel", de: "Jahrespreis" },
    TOTALECONTRACTWAARDE: { nl: "Totale contractwaarde", fr: "Valeur totale du contrat", de: "Gesamter Vertragswert" },
    ONDERTEKENAAR: { nl: "Ondertekenaar", fr: "Signataire", de: "Unterzeichner" },
    ONDERTEKENPLAATS: { nl: "Plaats", fr: "Lieu", de: "Ort" },
    ONDERTEKENDATUM: { nl: "Datum", fr: "Date", de: "Datum" },
  };
  return labels[key]?.[language] ?? key;
}
