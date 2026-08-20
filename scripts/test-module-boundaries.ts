import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractsPath = path.join(root, "modules", "contracts", "index.ts");
const architecturePath = path.join(
  root,
  "docs",
  "architecture",
  "FIELDFORCE-MODULE-BOUNDARIES.md"
);

const contracts = fs.readFileSync(contractsPath, "utf8");
const architecture = fs.readFileSync(architecturePath, "utf8");

assert(!/^\s*import\s/m.test(contracts), "Contractlaag mag geen imports bevatten.");
assert(!/\b(prisma|PrismaClient|components\/|app\/|lib\/)/.test(contracts), "Contractlaag mag geen runtime-internals kennen.");

for (const moduleId of ["coaching", "sales", "inventory", "service", "pst", "contract"]) {
  assert(
    contracts.includes(`"${moduleId}"`),
    `Module ontbreekt in de contractlaag: ${moduleId}`
  );
}

for (const section of ["Coaching", "Sales", "Inventory", "Service", "PST", "Contract"]) {
  assert(
    architecture.includes(section),
    `Architectuurdocument mist modulegrens: ${section}`
  );
}

console.log("FieldForce module boundaries: type-only contractlaag en modulegrenzen gevalideerd.");
