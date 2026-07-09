export type ParsedCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedCsv = {
  headers: string[];
  rows: ParsedCsvRow[];
  errors: { row: number; message: string }[];
};

export function parseCsv(input: string): ParsedCsv {
  const records = parseCsvRecords(input.replace(/^\uFEFF/, ""));
  const nonEmptyRecords = records.filter((record) =>
    record.some((cell) => cell.trim() !== "")
  );
  if (!nonEmptyRecords.length) {
    return { headers: [], rows: [], errors: [{ row: 1, message: "CSV-bestand is leeg." }] };
  }

  const headers = nonEmptyRecords[0].map((header) => header.trim());
  const errors: ParsedCsv["errors"] = [];
  const seenHeaders = new Set<string>();
  for (const header of headers) {
    if (!header) errors.push({ row: 1, message: "CSV bevat een lege kolomnaam." });
    const normalized = header.toLowerCase();
    if (seenHeaders.has(normalized)) {
      errors.push({ row: 1, message: `CSV bevat dubbele kolom '${header}'.` });
    }
    seenHeaders.add(normalized);
  }

  const rows = nonEmptyRecords.slice(1).map((record, index) => {
    const values: Record<string, string> = {};
    for (const [columnIndex, header] of headers.entries()) {
      values[header] = record[columnIndex]?.trim() ?? "";
    }
    if (record.length > headers.length) {
      errors.push({
        row: index + 2,
        message: "CSV-rij bevat meer waarden dan kolommen.",
      });
    }
    return { rowNumber: index + 2, values };
  });

  return { headers, rows, errors };
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvCell(row[header])).join(",")
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

function parseCsvRecords(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length || input.endsWith(",")) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
