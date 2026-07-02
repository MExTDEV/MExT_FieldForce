import type { JWT } from "next-auth/jwt";

export function compactSessionToken(token: JWT, databaseUserId?: string): JWT {
  return {
    ...(token.sub ? { sub: token.sub } : {}),
    ...(token.name ? { name: token.name } : {}),
    ...(token.email ? { email: token.email } : {}),
    ...(typeof token.iat === "number" ? { iat: token.iat } : {}),
    ...(typeof token.exp === "number" ? { exp: token.exp } : {}),
    ...(token.jti ? { jti: token.jti } : {}),
    ...(databaseUserId || token.databaseUserId
      ? { databaseUserId: databaseUserId ?? token.databaseUserId }
      : {}),
  };
}

export function authPayloadDiagnostics(label: "jwt" | "session", payload: object) {
  if (process.env.NODE_ENV !== "development" && process.env.AUTH_SESSION_DEBUG !== "true") return;
  const serialized = JSON.stringify(payload);
  const byteSize = Buffer.byteLength(serialized, "utf8");
  const estimatedEncryptedCookieBytes = Math.ceil(byteSize * 1.4) + 250;
  console.info(`[auth:${label}]`, {
    fields: Object.keys(payload).sort(),
    payloadBytes: byteSize,
    estimatedEncryptedCookieBytes,
  });
}
