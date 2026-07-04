import assert from "node:assert/strict";
import {
  isKpiUnit,
  parseOptionalKpiNumber,
  parseRequiredKpiNumber,
  validateKpiRange,
} from "../lib/kpi-settings";
import { resolveKpiTargetFromDefinition } from "../lib/server/kpi-targets";

assert.equal(parseRequiredKpiNumber("75.5", "Doelwaarde"), 75.5);
assert.equal(parseOptionalKpiNumber("", "Minimumwaarde"), null);
assert.throws(() => parseRequiredKpiNumber("", "Doelwaarde"), /verplicht/);
assert.throws(() => parseRequiredKpiNumber("abc", "Doelwaarde"), /numeriek/);
assert.throws(() => validateKpiRange(20, 25, 30), /minimumwaarde/);
for (const unit of ["%", "EUR", "count", "minutes", "hours", "km", "number"]) {
  assert.equal(isKpiUnit(unit), true);
}

const settings = resolveKpiTargetFromDefinition({
  targetValue: 10,
  minValue: 0,
  maxValue: 20,
  evaluationDirection: "HIGHER_IS_BETTER",
  targetOverrides: [
    { scopeKey: "COUNTRY:BE", targetValue: 12, minValue: 0, maxValue: 24, evaluationDirection: "HIGHER_IS_BETTER" },
    { scopeKey: "TEAM:team-1", targetValue: 14, minValue: 0, maxValue: 28, evaluationDirection: "HIGHER_IS_BETTER" },
    { scopeKey: "USER:user-1", targetValue: 16, minValue: 0, maxValue: 32, evaluationDirection: "TARGET" },
  ],
}, { country: "BE", teamId: "team-1", userId: "user-1" });
assert.equal(settings.targetValue, 16);
assert.equal(settings.evaluationDirection, "TARGET");

console.log("KPI-instellingen en scopeprioriteit getest.");
