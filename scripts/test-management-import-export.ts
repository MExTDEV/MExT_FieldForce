import { strict as assert } from "node:assert";

import { parseCsv, toCsv } from "@/lib/csv";

const csv = toCsv(
  ["name", "description", "active"],
  [
    { name: "Team Alpha", description: "Eerste lijn", active: true },
    { name: "Team, Beta", description: 'Quote "test"', active: false },
    { name: "Team Gamma", description: "Regel 1\nRegel 2", active: true },
  ]
);

const parsed = parseCsv(csv);

assert.deepEqual(parsed.headers, ["name", "description", "active"]);
assert.equal(parsed.errors.length, 0);
assert.equal(parsed.rows.length, 3);
assert.equal(parsed.rows[1].values.name, "Team, Beta");
assert.equal(parsed.rows[1].values.description, 'Quote "test"');
assert.equal(parsed.rows[2].values.description, "Regel 1\nRegel 2");

const duplicateHeader = parseCsv("email,email\none@example.com,two@example.com\n");
assert.equal(duplicateHeader.errors.length, 1);
assert.match(duplicateHeader.errors[0].message, /dubbele kolom/);

const empty = parseCsv("");
assert.equal(empty.errors.length, 1);
assert.match(empty.errors[0].message, /leeg/);

console.log("Management import/export CSV tests passed.");
