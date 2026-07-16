import { inflateRawSync } from "node:zlib";

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export class OoxmlPackage {
  private entries = new Map<string, ZipEntry>();

  constructor(private readonly data: Buffer) {
    if (data.length < 22 || data[0] !== 0x50 || data[1] !== 0x4b) {
      throw new Error("contract.import.error.invalidZip");
    }
    this.readCentralDirectory();
  }

  has(name: string) {
    return this.entries.has(normalizePath(name));
  }

  list(prefix = "") {
    const normalized = normalizePath(prefix);
    return [...this.entries.keys()].filter((name) => name.startsWith(normalized));
  }

  text(name: string) {
    return this.file(name).toString("utf8");
  }

  file(name: string) {
    const entry = this.entries.get(normalizePath(name));
    if (!entry) throw new Error(`contract.import.error.missing:${name}`);
    const offset = entry.localHeaderOffset;
    if (this.data.readUInt32LE(offset) !== 0x04034b50) {
      throw new Error("contract.import.error.invalidZip");
    }
    const fileNameLength = this.data.readUInt16LE(offset + 26);
    const extraLength = this.data.readUInt16LE(offset + 28);
    const start = offset + 30 + fileNameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > this.data.length || entry.uncompressedSize > 20_000_000) {
      throw new Error("contract.import.error.zipSize");
    }
    const compressed = this.data.subarray(start, end);
    if (entry.compression === 0) return Buffer.from(compressed);
    if (entry.compression === 8) return inflateRawSync(compressed);
    throw new Error("contract.import.error.unsupportedCompression");
  }

  private readCentralDirectory() {
    const eocdOffset = findEndOfCentralDirectory(this.data);
    if (eocdOffset < 0) throw new Error("contract.import.error.invalidZip");
    const totalEntries = this.data.readUInt16LE(eocdOffset + 10);
    const centralSize = this.data.readUInt32LE(eocdOffset + 12);
    let offset = this.data.readUInt32LE(eocdOffset + 16);
    if (totalEntries > 5000 || centralSize > 50_000_000) {
      throw new Error("contract.import.error.zipSize");
    }
    for (let index = 0; index < totalEntries; index += 1) {
      if (this.data.readUInt32LE(offset) !== 0x02014b50) {
        throw new Error("contract.import.error.invalidZip");
      }
      const compression = this.data.readUInt16LE(offset + 10);
      const compressedSize = this.data.readUInt32LE(offset + 20);
      const uncompressedSize = this.data.readUInt32LE(offset + 24);
      const fileNameLength = this.data.readUInt16LE(offset + 28);
      const extraLength = this.data.readUInt16LE(offset + 30);
      const commentLength = this.data.readUInt16LE(offset + 32);
      const localHeaderOffset = this.data.readUInt32LE(offset + 42);
      const name = this.data.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
      const normalized = normalizePath(name);
      if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes("\\")) {
        throw new Error("contract.import.error.pathTraversal");
      }
      this.entries.set(normalized, {
        name: normalized,
        compression,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
  }
}

function findEndOfCentralDirectory(data: Buffer) {
  const min = Math.max(0, data.length - 66_000);
  for (let offset = data.length - 22; offset >= min; offset -= 1) {
    if (data.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function normalizePath(name: string) {
  return name.replace(/^\/+/, "").replaceAll("\\", "/");
}

export function xmlAttr(tag: string, attr: string) {
  const match = tag.match(new RegExp(`\\s${attr}="([^"]*)"`));
  return match?.[1] ?? "";
}

export function decodeXml(value: string) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

export function columnIndex(cellRef: string) {
  const letters = cellRef.replace(/[^A-Z]/gi, "").toUpperCase();
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result;
}
