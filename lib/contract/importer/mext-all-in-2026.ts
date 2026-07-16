import { createHash } from "node:crypto";
import { OoxmlPackage, columnIndex, decodeXml, xmlAttr } from "@/lib/contract/importer/ooxml";
import { defaultContractTerms } from "@/lib/contract/calculation-engine";

export const MEXT_CONTRACT_MODEL_CODE = "MEXT_ALL_IN_2026_V1";

export type ImportedContractArticle = {
  articleNumber: string;
  stemNumber: string;
  descriptionNl: string;
  descriptionFr: string;
  descriptionDe: string;
  unitPrice: string;
  unitCost: string;
};

export type ContractWorkbookImport = {
  adapterCode: typeof MEXT_CONTRACT_MODEL_CODE;
  sourceFileSha256: string;
  sourceWorkbookVersion: string | null;
  articles: ImportedContractArticle[];
  termRules: ReturnType<typeof defaultContractTerms>;
  warnings: string[];
};

const REQUIRED_COLUMNS = ["No_", "Stam", "Description", "Unit Price", "Unit Cost", "Total Amount", "Total Quantity"];
const SUPPORTED_TOTAL_AMOUNT_FORMULA = "MExTBE_Item[[#This Row],[Total Quantity]]*MExTBE_Item[[#This Row],[Unit Price]]";

export function parseMextAllInWorkbook(buffer: Buffer): ContractWorkbookImport {
  if (buffer.length > 15_000_000) throw new Error("contract.import.error.fileTooLarge");
  const pkg = new OoxmlPackage(buffer);
  if (!pkg.has("xl/workbook.xml")) throw new Error("contract.import.error.missingWorkbook");
  const workbook = pkg.text("xl/workbook.xml");
  const rels = pkg.text("xl/_rels/workbook.xml.rels");
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((match) => ({
    name: decodeXml(xmlAttr(match[0], "name")),
    rid: xmlAttr(match[0], "r:id"),
    state: xmlAttr(match[0], "state") || "visible",
  }));
  const inputSheet = sheets.find((sheet) => sheet.name === "Input");
  if (!inputSheet) throw new Error("contract.import.error.missingInputSheet");
  if (!sheets.some((sheet) => sheet.name === "Legende")) throw new Error("contract.import.error.missingLegendSheet");
  if (!sheets.some((sheet) => sheet.name === "Template" && sheet.state === "hidden")) {
    throw new Error("contract.import.error.missingTemplateSheet");
  }
  const relTarget = relationTarget(rels, inputSheet.rid);
  const sheetPath = `xl/${relTarget.replace(/^\/?xl\//, "")}`;
  const tablePath = pkg.list("xl/tables/").find((name) => {
    if (!name.endsWith(".xml")) return false;
    const tableXml = pkg.text(name);
    return xmlAttr(tableXml.slice(0, 500), "name") === "MExTBE_Item";
  });
  if (!tablePath) throw new Error("contract.import.error.missingTable");
  const tableXml = pkg.text(tablePath);
  const tableRef = xmlAttr(tableXml.slice(0, 800), "ref");
  const columns = [...tableXml.matchAll(/<tableColumn\b[^>]*>/g)].map((match) => decodeXml(xmlAttr(match[0], "name")));
  for (const column of REQUIRED_COLUMNS) {
    if (!columns.includes(column)) throw new Error(`contract.import.error.missingColumn:${column}`);
  }
  const sharedStrings = readSharedStrings(pkg);
  const sheetXml = pkg.text(sheetPath);
  const version = readLegendVersion(pkg, workbook, rels);
  const articles = readArticleRows(sheetXml, sharedStrings, tableRef);
  const duplicate = findDuplicate(articles.map((article) => article.articleNumber));
  if (duplicate) throw new Error(`contract.import.error.duplicateArticle:${duplicate}`);
  const totalAmountFormulas = [...sheetXml.matchAll(/<c\b[^>]*r="F\d+"[^>]*>[\s\S]*?<f[^>]*>([\s\S]*?)<\/f>[\s\S]*?<\/c>/g)]
    .map((match) => decodeXml(match[1].trim()));
  if (!totalAmountFormulas.length || totalAmountFormulas.some((formula) => formula !== SUPPORTED_TOTAL_AMOUNT_FORMULA)) {
    throw new Error("contract.import.error.unsupportedFormula");
  }
  return {
    adapterCode: MEXT_CONTRACT_MODEL_CODE,
    sourceFileSha256: createHash("sha256").update(buffer).digest("hex"),
    sourceWorkbookVersion: version,
    articles,
    termRules: defaultContractTerms(),
    warnings: [],
  };
}

function relationTarget(relsXml: string, rid: string) {
  const rel = [...relsXml.matchAll(/<Relationship\b[^>]*>/g)]
    .find((match) => xmlAttr(match[0], "Id") === rid);
  if (!rel) throw new Error("contract.import.error.missingRelationship");
  return xmlAttr(rel[0], "Target");
}

function readSharedStrings(pkg: OoxmlPackage) {
  if (!pkg.has("xl/sharedStrings.xml")) return [];
  const xml = pkg.text("xl/sharedStrings.xml");
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => text[1]).join(""))
  );
}

function readLegendVersion(pkg: OoxmlPackage, workbookXml: string, relsXml: string) {
  const legend = [...workbookXml.matchAll(/<sheet\b[^>]*>/g)]
    .find((match) => decodeXml(xmlAttr(match[0], "name")) === "Legende");
  if (!legend) return null;
  const target = relationTarget(relsXml, xmlAttr(legend[0], "r:id"));
  const xml = pkg.text(`xl/${target.replace(/^\/?xl\//, "")}`);
  return readCellText(xml, "A1", readSharedStrings(pkg)) || null;
}

function readArticleRows(sheetXml: string, sharedStrings: string[], tableRef: string) {
  const [startRef, endRef] = tableRef.split(":");
  const startRow = Number(startRef.replace(/\D/g, "")) + 1;
  const endRow = Number(endRef.replace(/\D/g, ""));
  if (!startRow || !endRow || endRow - startRow > 5000) throw new Error("contract.import.error.invalidTableRange");
  const rows: ImportedContractArticle[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const values = [1, 2, 3, 4, 5].map((column) => readCellByColumn(sheetXml, row, column, sharedStrings));
    if (values.every((value) => !value.trim())) continue;
    const [articleNumber, stemNumber, description, unitPriceRaw, unitCostRaw] = values.map((value) => value.trim());
    const unitPrice = unitPriceRaw || "0";
    const unitCost = unitCostRaw || "0";
    if (!articleNumber) throw new Error(`contract.import.error.emptyArticle:${row}`);
    if (!stemNumber) throw new Error(`contract.import.error.emptyStem:${articleNumber}`);
    if (!description) throw new Error(`contract.import.error.emptyDescription:${articleNumber}`);
    if (!isNonNegativeDecimal(unitPrice)) throw new Error(`contract.import.error.invalidUnitPrice:${articleNumber}`);
    if (!isNonNegativeDecimal(unitCost)) throw new Error(`contract.import.error.invalidUnitCost:${articleNumber}`);
    rows.push({
      articleNumber,
      stemNumber,
      descriptionNl: description,
      descriptionFr: description,
      descriptionDe: description,
      unitPrice,
      unitCost,
    });
  }
  if (!rows.length) throw new Error("contract.import.error.noArticles");
  return rows;
}

function readCellByColumn(sheetXml: string, row: number, column: number, sharedStrings: string[]) {
  const rowMatch = sheetXml.match(new RegExp(`<row\\b[^>]*r="${row}"[^>]*>([\\s\\S]*?)<\\/row>`));
  if (!rowMatch) return "";
  for (const cell of rowMatch[1].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)) {
    const ref = xmlAttr(cell[0], "r");
    if (columnIndex(ref) === column) return cellValue(cell[0], sharedStrings);
  }
  return "";
}

function readCellText(sheetXml: string, ref: string, sharedStrings: string[]) {
  const match = sheetXml.match(new RegExp(`<c\\b[^>]*r="${ref}"[^>]*>[\\s\\S]*?<\\/c>`));
  return match ? cellValue(match[0], sharedStrings) : "";
}

function cellValue(cellXml: string, sharedStrings: string[]) {
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (xmlAttr(cellXml, "t") === "s") return sharedStrings[Number(value)] ?? "";
  if (xmlAttr(cellXml, "t") === "inlineStr") {
    return decodeXml([...cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(""));
  }
  return decodeXml(value);
}

function isNonNegativeDecimal(value: string) {
  return /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}
