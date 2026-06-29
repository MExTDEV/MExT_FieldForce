import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID, {
  type MicrosoftEntraIDProfile,
} from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";

const entraConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);

export const authMode =
  process.env.NEXT_PUBLIC_AUTH_MODE === "demo"
    ? "demo"
    : "credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === "production",
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "E-mailadres en wachtwoord",
      credentials: {
        email: { label: "E-mailadres", type: "email" },
        password: { label: "Wachtwoord", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const databaseUser = await prisma.user.findFirst({
          where: { email, active: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            passwordHash: true,
          },
        });
        if (
          !databaseUser?.passwordHash ||
          !verifyPassword(password, databaseUser.passwordHash)
        ) {
          return null;
        }

        return {
          id: databaseUser.id,
          email: databaseUser.email,
          name: `${databaseUser.firstName} ${databaseUser.lastName}`.trim(),
        };
      },
    }),
    ...(entraConfigured
      ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!.replace(/\/+$/, ""),
          authorization: {
            params: {
              scope: "openid profile email offline_access User.Read Calendars.ReadWrite",
              prompt: "select_account",
            },
          },
        }),
      ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "microsoft-entra-id") {
        console.warn("[auth] Login geweigerd: onverwachte provider.");
        return false;
      }
      const entraProfile = profile as (MicrosoftEntraIDProfile & {
        sub?: string;
        upn?: string;
        unique_name?: string;
      }) | undefined;
      const entraIds = [...new Set([
        entraProfile?.oid,
        entraProfile?.sub,
        account.providerAccountId,
      ].filter((value): value is string => Boolean(value)))];
      const emails = [...new Set([
        entraProfile?.email,
        entraProfile?.preferred_username,
        entraProfile?.upn,
        entraProfile?.unique_name,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean))];
      if (!entraIds.length) {
        console.warn("[auth] Login geweigerd: Entra-ID ontbreekt.");
        return false;
      }

      const linkedUser = await prisma.user.findFirst({
        where: { active: true, entraId: { in: entraIds } },
        select: { id: true },
      });
      if (linkedUser) return true;
      if (!emails.length) {
        console.warn("[auth] Login geweigerd: account is niet gekoppeld en e-mailclaim ontbreekt.");
        return false;
      }
      const aliasUser = linkedUser
        ? null
        : await prisma.user.findFirst({
            where: {
              active: true,
              loginAliases: {
                some: { email: { in: emails }, provider: "microsoft-entra-id" },
              },
            },
            select: { id: true, entraId: true },
          });
      const unlinkedUser = linkedUser || aliasUser
        ? null
        : await prisma.user.findFirst({
            where: { active: true, email: { in: emails }, entraId: null },
            select: { id: true },
          });
      const user = aliasUser ?? unlinkedUser;
      if (!user) {
        console.warn(`[auth] Login geweigerd: geen actieve FieldForce-gebruiker voor ${emails.join(", ")}.`);
        return false;
      }
      const entraId = entraIds[0];
      if (aliasUser?.entraId && !entraIds.includes(aliasUser.entraId)) {
        console.warn("[auth] Login geweigerd: de alias hoort bij een andere Microsoft-identiteit.");
        return false;
      }
      if (!aliasUser?.entraId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { entraId },
        });
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "credentials" && user?.id) {
        token.databaseUserId = user.id;
      }
      if (account?.provider === "microsoft-entra-id") {
        const entraProfile = profile as MicrosoftEntraIDProfile | undefined;
        const entraId = entraProfile?.oid ?? account.providerAccountId;
        const databaseUser = await prisma.user.findFirst({
          where: { entraId, active: true },
          select: { id: true },
        });
        token.databaseUserId = databaseUser?.id;
        token.entraId = entraId;
        token.microsoftAccessToken = account.access_token;
        token.microsoftAccessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 55 * 60 * 1000;
        token.microsoftRefreshToken = account.refresh_token;
        token.microsoftTokenError = undefined;
      }
      if (
        token.microsoftAccessToken &&
        token.microsoftAccessTokenExpires &&
        Date.now() >= token.microsoftAccessTokenExpires - 60_000 &&
        token.microsoftRefreshToken
      ) {
        return refreshMicrosoftToken(token);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.databaseUserId =
          typeof token.databaseUserId === "string" ? token.databaseUserId : undefined;
        session.user.entraId =
          typeof token.entraId === "string" ? token.entraId : undefined;
      }
      return session;
    },
  },
});

export function isEntraConfigured() {
  return entraConfigured;
}

export async function refreshMicrosoftToken(token: import("next-auth/jwt").JWT) {
  try {
    const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!.replace(/\/+$/, "");
    const authority = issuer.replace(/\/v2\.0$/, "");
    const response = await fetch(`${authority}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
        client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.microsoftRefreshToken!,
        scope: "openid profile email offline_access User.Read Calendars.ReadWrite",
      }),
    });
    const refreshed = await response.json() as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error_description?: string;
    };
    if (!response.ok || !refreshed.access_token) {
      throw new Error(refreshed.error_description ?? "Microsoft-token kon niet worden vernieuwd.");
    }
    return {
      ...token,
      microsoftAccessToken: refreshed.access_token,
      microsoftAccessTokenExpires: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      microsoftRefreshToken: refreshed.refresh_token ?? token.microsoftRefreshToken,
      microsoftTokenError: undefined,
    };
  } catch (error) {
    console.error("[auth:microsoft-refresh]", error);
    return { ...token, microsoftTokenError: "RefreshAccessTokenError" as const };
  }
}
