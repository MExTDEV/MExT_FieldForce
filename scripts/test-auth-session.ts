import type { JWT } from "next-auth/jwt";
import { encode } from "next-auth/jwt";
import { compactSessionToken } from "@/lib/server/auth-session";

const legacyToken = {
  sub: "microsoft-object-id",
  name: "Test User",
  email: "test.user@mext.be",
  databaseUserId: "fieldforce-user-id",
  microsoftAccessToken: "a".repeat(12_000),
  microsoftRefreshToken: "r".repeat(4_000),
  id_token: "i".repeat(8_000),
  permissions: Array.from({ length: 100 }, (_, index) => ({ id: index, name: `permission-${index}` })),
} as JWT;

const compact = compactSessionToken(legacyToken);
const serialized = JSON.stringify(compact);
const forbiddenFields = [
  "microsoftAccessToken",
  "microsoftRefreshToken",
  "access_token",
  "refresh_token",
  "id_token",
  "permissions",
];

for (const field of forbiddenFields) {
  if (field in compact || serialized.includes(field)) {
    throw new Error(`Gevoelig of groot veld bleef aanwezig in de sessie: ${field}`);
  }
}
if (compact.databaseUserId !== "fieldforce-user-id") {
  throw new Error("De database-user-ID ontbreekt in de compacte sessie.");
}
const bytes = Buffer.byteLength(serialized, "utf8");
if (bytes > 1_000) throw new Error(`De compacte JWT-payload is onverwacht groot: ${bytes} bytes.`);
async function main() {
  const encoded = await encode({
    token: compact,
    secret: "test-secret-that-is-at-least-32-characters-long",
    salt: "authjs.session-token",
    maxAge: 8 * 60 * 60,
  });
  const encodedCookieBytes = Buffer.byteLength(encoded, "utf8");
  if (encodedCookieBytes > 2_000) {
    throw new Error(`De versleutelde Auth.js-cookie is onverwacht groot: ${encodedCookieBytes} bytes.`);
  }
  console.log(JSON.stringify({ fields: Object.keys(compact).sort(), payloadBytes: bytes, encodedCookieBytes }));
}

void main();
