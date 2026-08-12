import assert from "node:assert/strict";
import fs from "node:fs";

import { calculateCoachingDossierScore } from "../lib/coaching/score";

assert.equal(
  calculateCoachingDossierScore([4, null, "nvt", 5]),
  90,
  "Lege en NVT-scores mogen het hoofdformuliergemiddelde niet beïnvloeden."
);
assert.equal(
  calculateCoachingDossierScore([0, 5]),
  50,
  "Een expliciete nulscore moet wel meetellen."
);
assert.equal(
  calculateCoachingDossierScore([null, "NVT"]),
  undefined,
  "Een hoofdformulier zonder geldige scores moet geen score opleveren."
);

const source = fs.readFileSync("components/workspace-pages.tsx", "utf8");
const start = source.indexOf("function ReadOnlySimpleScoreTable");
const end = source.indexOf("function ReadOnlyWorkflowScoreTable", start);
assert.ok(start >= 0 && end > start, "De gedeelde read-only scoretabel moet bestaan.");
const tableSource = source.slice(start, end);
assert.match(tableSource, /md:grid-cols-2/, "De scoretabel moet op tablet en desktop twee kolommen gebruiken.");
assert.match(tableSource, /normalizePerformanceScore/, "De scoreweergave moet de centrale scoreconversie gebruiken.");
assert.doesNotMatch(tableSource, /Criterium/, "De score-entry mag geen overbodig criteriumlabel tonen.");
assert.doesNotMatch(tableSource, /\/ 5/, "De gedeelde scoretabel mag geen punten-op-vijfweergave tonen.");

console.log("Hoofdformulierscore en gedeelde scorepresentatie gecontroleerd.");
