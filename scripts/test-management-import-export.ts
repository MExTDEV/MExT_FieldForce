import { strict as assert } from "node:assert";

import { decodeUtf8CsvBytes } from "@/lib/csv-encoding";
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

const utf8Csv = new TextEncoder().encode("name\r\nAurélie Milet\r\n");
const decoded = decodeUtf8CsvBytes(utf8Csv);
assert.equal(decoded.ok, true);
if (decoded.ok) assert.equal(decoded.text.includes("Aurélie"), true);

const invalidWindows1252Bytes = Uint8Array.from([0x6e, 0x61, 0x6d, 0x65, 0x0d, 0x0a, 0xe9]);
assert.deepEqual(decodeUtf8CsvBytes(invalidWindows1252Bytes), {
  ok: false,
  problem: "invalid-utf8",
});

assert.equal(parseCsv("name\r\nAur�lie Milet\r\n").errors.length, 1);
assert.equal(parseCsv("name\r\nAurÃ©lie Milet\r\n").errors.length, 1);

console.log("Management import/export CSV tests passed.");
