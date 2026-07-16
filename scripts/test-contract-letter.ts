import assert from "node:assert/strict";
import { contractLetterParameters, validateContractLetterTemplate } from "../lib/contract/letter";

const parameterKeys = contractLetterParameters.map((parameter) => parameter.key);

assert.ok(parameterKeys.includes("KLANTNAAM"));
assert.ok(parameterKeys.includes("PRODUCTLIST"));
assert.ok(parameterKeys.includes("HANDTEKENING"));
assert.ok(parameterKeys.includes("TOTALEKOST"));
assert.equal(parameterKeys.includes("MARGEBEDRAG"), false);
assert.equal(parameterKeys.includes("MARGEPERCENTAGE"), false);

const valid = validateContractLetterTemplate(docx([
  ["[KLANTNAAM]"],
  ["[PRO", "DUCTLIST]"],
  ["[HANDTEKENING]"],
]));
assert.deepEqual(valid.unknownParameters, []);
assert.equal(valid.productListValid, true);
assert.equal(valid.signatureValid, true);
assert.equal(valid.errors.length, 0);

const unknown = validateContractLetterTemplate(docx([["[ONBEKEND]"], ["[PRODUCTLIST]"]]));
assert.ok(unknown.unknownParameters.includes("ONBEKEND"));
assert.ok(unknown.errors.includes("contract.letter.error.unknownParameters"));

const misplacedProductList = validateContractLetterTemplate(docx([["Producten: [PRODUCTLIST]"]]));
assert.equal(misplacedProductList.productListValid, false);
assert.ok(misplacedProductList.errors.includes("contract.letter.error.productListPlacement"));

const internal = validateContractLetterTemplate(docx([["[TOTALEKOST]"], ["[PRODUCTLIST]"]]));
assert.ok(internal.internalParameters.includes("TOTALEKOST"));
assert.equal(internal.errors.includes("contract.letter.error.unknownParameters"), false);

console.log("Contractbrief: parameterregister en DOCX-validatie gevalideerd.");

function docx(paragraphs: string[][]) {
  return zip({
    "[Content_Types].xml": Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    "word/document.xml": Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((paragraph) => `<w:p>${paragraph.map((text) => `<w:r><w:t>${escapeXml(text)}</w:t></w:r>`).join("")}</w:p>`).join("\n")}
  </w:body>
</w:document>`),
  });
}

function zip(entries: Record<string, Buffer>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
