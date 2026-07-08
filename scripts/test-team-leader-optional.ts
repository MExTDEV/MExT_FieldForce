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

assert.equal(normalizeOptionalTeamLeaderId(""), null);
assert.equal(normalizeOptionalTeamLeaderId("   "), null);
assert.equal(normalizeOptionalTeamLeaderId("user-1"), "user-1");
assert.equal(optionalTeamLeaderLabel(""), "Geen verkoopleider toegewezen");
assert.equal(optionalTeamLeaderLabel("Sophie Vermeulen"), "Sophie Vermeulen");

console.log("Optionele verkoopleider voor teams gecontroleerd.");
