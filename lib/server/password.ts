import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const keyLength = 64;
const format = "scrypt";

export function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, keyLength).toString("hex");
  return `${format}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHex] = storedHash.split("$");
  if (algorithm !== format || !salt || !expectedHex) return false;

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function validatePassword(password: string) {
  if (password.length < 12) {
    throw new Error("Het wachtwoord moet minstens 12 tekens bevatten.");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Gebruik minstens één kleine letter, hoofdletter en cijfer.");
  }
}
