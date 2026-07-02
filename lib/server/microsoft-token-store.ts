import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/server/db";

const refreshWindowMs = 60_000;
const graphScope = "openid profile email offline_access User.Read Calendars.ReadWrite";

export type MicrosoftTokenInput = {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
};

export async function storeMicrosoftTokens(userId: string, input: MicrosoftTokenInput) {
  if (!input.accessToken) return;
  const existing = await prisma.microsoftAuthToken.findUnique({ where: { userId } });
  const refreshTokenEncrypted = input.refreshToken
    ? encryptSecret(input.refreshToken)
    : existing?.refreshTokenEncrypted;
  await prisma.microsoftAuthToken.upsert({
    where: { userId },
    create: {
      userId,
      accessTokenEncrypted: encryptSecret(input.accessToken),
      refreshTokenEncrypted,
      expiresAt: new Date(input.expiresAt ? input.expiresAt * 1000 : Date.now() + 55 * 60 * 1000),
      scopes: input.scope ?? graphScope,
      lastError: null,
    },
    update: {
      accessTokenEncrypted: encryptSecret(input.accessToken),
      refreshTokenEncrypted,
      expiresAt: new Date(input.expiresAt ? input.expiresAt * 1000 : Date.now() + 55 * 60 * 1000),
      scopes: input.scope ?? existing?.scopes ?? graphScope,
      lastError: null,
    },
  });
}

export async function getValidMicrosoftAccessToken(userId: string) {
  try {
    const stored = await prisma.microsoftAuthToken.findUnique({ where: { userId } });
    if (!stored) return undefined;
    if (stored.expiresAt.getTime() > Date.now() + refreshWindowMs) {
      return decryptSecret(stored.accessTokenEncrypted);
    }
    if (!stored.refreshTokenEncrypted) return undefined;
    return refreshMicrosoftAccessToken(userId, decryptSecret(stored.refreshTokenEncrypted), stored.scopes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microsoft-token kon niet worden gelezen.";
    console.error("[auth:microsoft-token-store]", message);
    return undefined;
  }
}

async function refreshMicrosoftAccessToken(userId: string, refreshToken: string, scope: string) {
  try {
    const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.replace(/\/+$/, "");
    const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
    const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
    if (!issuer || !clientId || !clientSecret) throw new Error("Microsoft Entra-configuratie ontbreekt.");
    const authority = issuer.replace(/\/v2\.0$/, "");
    const response = await fetch(`${authority}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: scope || graphScope,
      }),
    });
    const refreshed = await response.json() as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
      error_description?: string;
    };
    if (!response.ok || !refreshed.access_token) {
      throw new Error(refreshed.error_description ?? "Microsoft-token kon niet worden vernieuwd.");
    }
    await storeMicrosoftTokens(userId, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
      scope: refreshed.scope ?? scope,
    });
    return refreshed.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microsoft-token kon niet worden vernieuwd.";
    await prisma.microsoftAuthToken.update({ where: { userId }, data: { lastError: message.slice(0, 1000) } }).catch(() => undefined);
    console.error("[auth:microsoft-refresh]", message);
    return undefined;
  }
}

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ontbreekt; Microsoft-tokens kunnen niet veilig worden opgeslagen.");
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Ongeldig versleuteld Microsoft-token.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
