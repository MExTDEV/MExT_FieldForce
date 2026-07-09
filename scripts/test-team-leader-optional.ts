import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  optionalTeamLeaderLabel,
  normalizeOptionalTeamLeaderId,
} from "../lib/team-management";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const migrationPath = join(
  root,
  "prisma",
  "migrations",
  "0018_make_team_primary_leader_optional",
  "migration.sql"
);

assert.match(
  schema,
  /primaryLeaderId\s+String\?/,
  "Team.primaryLeaderId moet nullable zijn."
);
assert.match(
  schema,
  /primaryLeader\s+User\?/,
  "Team.primaryLeader-relatie moet optioneel zijn."
);
assert.ok(
  existsSync(migrationPath),
  "Prisma-migratie voor optionele Team.primaryLeaderId ontbreekt."
);

const nullSafeTeamReadFiles = [
  "lib/server/my-team.ts",
  "lib/server/users.ts",
  "lib/server/representatives.ts",
  "lib/server/workflows.ts",
  "lib/server/management-import-export.ts",
];

for (const file of nullSafeTeamReadFiles) {
  const source = readFileSync(join(root, file), "utf8");
  assert.doesNotMatch(
    source,
    /\bteam:\s*true\b/,
    `${file} mag geen volledige Team-relatie laden; gebruik een minimale select.`
  );
}

assert.doesNotMatch(
  readFileSync(join(root, "lib/server/my-team.ts"), "utf8"),
  /prisma\.team\.findMany/,
  "Mijn Team moet teams zonder primaryLeaderId via een null-safe query kunnen laden."
);

assert.match(
  readFileSync(join(root, "components/configuration-management.tsx"), "utf8"),
  /\/api\/management\?section=/,
  "Beheerpagina's moeten sectie-specifiek laden zodat Teams niet afhankelijk is van KPI/Rollen/Kapstok-data."
);

assert.match(
  readFileSync(join(root, "app/api/management/route.ts"), "utf8"),
  /getManagementConfiguration\(actor,\s*section\)/,
  "De beheer-API moet de gevraagde sectie doorgeven aan de serverhelper."
);

assert.match(
  readFileSync(join(root, "lib/server/management.ts"), "utf8"),
  /const needsKpis = !section \|\| section === "kpis"/,
  "Teambeheer mag de KPI-configuratie niet laden wanneer alleen section=teams is gevraagd."
);

assert.equal(normalizeOptionalTeamLeaderId(""), null);
assert.equal(normalizeOptionalTeamLeaderId("   "), null);
assert.equal(normalizeOptionalTeamLeaderId("user-1"), "user-1");
assert.equal(optionalTeamLeaderLabel(""), "Geen verkoopleider toegewezen");
assert.equal(optionalTeamLeaderLabel("Sophie Vermeulen"), "Sophie Vermeulen");

console.log("Optionele verkoopleider voor teams gecontroleerd.");
