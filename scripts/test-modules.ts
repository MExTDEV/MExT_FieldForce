import assert from "node:assert/strict";
import { appModuleRegistry, defaultAppModules, moduleForRoute } from "../lib/modules";

const enabled = new Set(defaultAppModules.filter((module) => module.enabled).map((module) => module.code));

assert.deepEqual([...enabled].sort(), ["BEGELEIDINGEN", "PLANNING"]);
assert.equal(moduleForRoute("planning")?.code, "PLANNING");
assert.equal(moduleForRoute("begeleidingen")?.code, "BEGELEIDINGEN");
assert.equal(moduleForRoute("contactmomenten")?.code, "CONTACTMOMENTEN");
assert.equal(moduleForRoute("rapportering")?.code, "RAPPORTERING");
assert.equal(appModuleRegistry.length, defaultAppModules.length);

console.log("Module configuration checks passed.");
