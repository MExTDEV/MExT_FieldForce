import assert from "node:assert/strict";

import { groupAppointmentScores } from "../lib/coaching/appointment-scores";
import type { CoachingFrameworkFocus, CoachingSimpleScore } from "../lib/types";

const framework: CoachingFrameworkFocus[] = [
  { id: "intro", code: "intro", name: "Introductie", color: "bg-blue-500", criteria: ["Begroeten", "Voorstellen"] },
  { id: "need", code: "need", name: "Behoefteanalyse", color: "bg-violet-500", criteria: ["Open vraag", "Samenvatten"] },
  { id: "close", code: "close", name: "Afsluiting", color: "bg-emerald-500", criteria: ["Afspraken vastleggen"] },
];

const score = (criterion: string, value: CoachingSimpleScore["score"]): CoachingSimpleScore => ({ criterion, score: value, comment: "" });
const groups = groupAppointmentScores([
  score("Behoefteanalyse - Samenvatten", 2),
  score("Introductie - Voorstellen", "nvt"),
  score("Introductie - Begroeten", 4),
  score("Behoefteanalyse - Open vraag", 5),
  score("Afsluiting - Afspraken vastleggen", null),
], framework);

assert.deepEqual(groups.map((group) => group.name), ["Introductie", "Behoefteanalyse", "Afsluiting"]);
assert.deepEqual(groups[0].scores.map((item) => item.criterion), ["Introductie - Begroeten", "Introductie - Voorstellen"]);
assert.equal(groups[0].average, 80, "NVT mag het groepsgemiddelde niet beïnvloeden.");
assert.equal(groups[1].average, 70, "Het groepsgemiddelde moet als geheel percentage worden afgerond.");
assert.equal(groups[2].average, undefined, "Een groep zonder geldige scores mag geen 0% tonen.");

console.log("Afspraakscoregroepering, volgorde en percentagegemiddelden gecontroleerd.");
