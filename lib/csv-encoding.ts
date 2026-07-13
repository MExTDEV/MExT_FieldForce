export type CsvEncodingProblem = "invalid-utf8" | "replacement-character";

export type CsvDecodingResult =
  | { ok: true; text: string }
  | { ok: false; problem: CsvEncodingProblem };

export function decodeUtf8CsvBytes(bytes: ArrayBuffer | Uint8Array): CsvDecodingResult {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch {
    return { ok: false, problem: "invalid-utf8" };
  }

  if (text.includes("\uFFFD")) {
    return { ok: false, problem: "replacement-character" };
  }

  return { ok: true, text };
}
