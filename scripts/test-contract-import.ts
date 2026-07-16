import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMextAllInWorkbook } from "../lib/contract/importer/mext-all-in-2026";

const workbookPath = process.env.CONTRACT_XLSM_PATH ?? "C:/Users/jand/Downloads/Contractberkening_Tool_09062026_NL (1).xlsm";
const parsed = parseMextAllInWorkbook(readFileSync(workbookPath));

assert.equal(parsed.adapterCode, "MEXT_ALL_IN_2026_V1");
assert.equal(parsed.sourceWorkbookVersion, "Version 28/04/2026");
assert.equal(parsed.articles.length, 289);
assert.equal(parsed.articles[0].articleNumber, "000/0010.013/20");
assert.equal(parsed.articles[0].stemNumber, "0010.013");
assert.equal(parsed.termRules.length, 2);
assert.equal(parsed.termRules[0].durationYears, 3);
assert.equal(parsed.termRules[0].discountPercentage, "35.00");
assert.equal(parsed.termRules[1].durationYears, 5);
assert.equal(parsed.termRules[1].priceMultiplier, "0.6000");

console.log("Contractimport: officiële Excelstructuur, formules, artikelen en modeladapter gevalideerd.");
