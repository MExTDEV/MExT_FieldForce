import assert from "node:assert/strict";
import {
  kpiScopeKey,
  isKpiUnit,
  parseOptionalKpiNumber,
  parseRequiredKpiNumber,
  validateKpiRange,
} from "../lib/kpi-settings";
import { detectKpiTargetConflicts, resolveKpiTargetFromDefinition } from "../lib/server/kpi-targets";

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

const periodStart = new Date("2026-07-01T00:00:00.000Z");
const periodEnd = new Date("2026-07-31T23:59:59.999Z");
const periodic = resolveKpiTargetFromDefinition({
  targetValue: 10,
  minValue: 0,
  maxValue: 20,
  evaluationDirection: "HIGHER_IS_BETTER",
  targetOverrides: [
    { scopeKey: "COUNTRY:BE", targetValue: 12, minValue: 0, maxValue: 24, evaluationDirection: "HIGHER_IS_BETTER" },
  ],
  targets: [
    { scopeKey: "GLOBAL", targetValue: 8, periodStart, periodEnd, active: true },
    { scopeKey: "ROLE:REPRESENTATIVE", targetValue: 9, periodStart, periodEnd, active: true },
    { scopeKey: "COUNTRY:BE", targetValue: 11, periodStart, periodEnd, active: true },
    { scopeKey: "TEAM:team-1", targetValue: 13, periodStart, periodEnd, active: true },
    { scopeKey: "USER:user-1", targetValue: 17, periodStart, periodEnd, active: true },
  ],
}, { country: "BE", teamId: "team-1", userId: "user-1", role: "REPRESENTATIVE", periodStart, periodEnd });
assert.equal(periodic.targetValue, 17);
assert.equal(kpiScopeKey("ROLE", { role: "SALES_LEADER" }), "ROLE:SALES_LEADER");
assert.equal(kpiScopeKey("GLOBAL", {}), "GLOBAL");

const conflicts = detectKpiTargetConflicts([
  { id: "a", kpiDefinitionId: "kpi-1", scopeKey: "TEAM:1", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), active: true },
  { id: "b", kpiDefinitionId: "kpi-1", scopeKey: "TEAM:1", periodStart: new Date("2026-01-15"), periodEnd: new Date("2026-02-15"), active: true },
  { id: "c", kpiDefinitionId: "kpi-1", scopeKey: "TEAM:2", periodStart: new Date("2026-01-15"), periodEnd: new Date("2026-02-15"), active: true },
]);
assert.equal(conflicts.has("a"), true);
assert.equal(conflicts.has("b"), true);
assert.equal(conflicts.has("c"), false);

console.log("KPI-instellingen en scopeprioriteit getest.");
