import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isBlankRichText, richTextToPlainText } from "@/lib/rich-text";

const blankValues = [
  undefined,
  null,
  "",
  "   ",
  "<p></p>",
  "<p><br></p>",
  "&nbsp;",
  "<p>&nbsp;</p>",
  "<div> &#160; </div>",
];

for (const value of blankValues) {
  assert.equal(isBlankRichText(value), true, `${String(value)} moet als lege opmerking gelden.`);
}

assert.equal(isBlankRichText("Bestaande opmerking"), false);
assert.equal(isBlankRichText("<p>Bestaande <strong>opmerking</strong></p>"), false);
assert.equal(richTextToPlainText("<p>Bestaande&nbsp;opmerking</p>"), "Bestaande opmerking");

const root = process.cwd();
const dossierSource = readFileSync(join(root, "components", "workspace-pages.tsx"), "utf8");

assert.equal(dossierSource.includes("Geen opmerking ingevuld."), false);
assert.equal(dossierSource.includes("Geen opmerkingen ingevuld."), false);

console.log("Lege begeleidingsopmerkingen worden zonder placeholder weergegeven.");
