import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID, {
  type MicrosoftEntraIDProfile,
} from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@/lib/server/db";
import { authPayloadDiagnostics, compactSessionToken } from "@/lib/server/auth-session";
import { storeMicrosoftTokens } from "@/lib/server/microsoft-token-store";
import {
  closeLoginSession,
  getLoginRequestSessionId,
  recordSuccessfulLogin,
} from "@/lib/server/login-history";
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
      let databaseUserId = typeof token.databaseUserId === "string"
        ? token.databaseUserId
        : undefined;
      if (account?.provider === "credentials" && user?.id) {
        databaseUserId = user.id;
      }
      if (account?.provider === "microsoft-entra-id") {
        const entraProfile = profile as MicrosoftEntraIDProfile | undefined;
        const entraId = entraProfile?.oid ?? account.providerAccountId;
        const databaseUser = await prisma.user.findFirst({
          where: { entraId, active: true },
          select: { id: true },
        });
        databaseUserId = databaseUser?.id;
        if (databaseUser?.id) {
          await storeMicrosoftTokens(databaseUser.id, {
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
            scope: account.scope,
          });
        }
      }
      let loginSessionId = token.loginSessionId;
      if (account && databaseUserId) {
        const auditSessionId = getLoginRequestSessionId();
        try {
          const loginSession = await recordSuccessfulLogin({
            provider: account.provider,
            userId: databaseUserId,
            userEmail: user?.email ?? token.email,
            sessionId: auditSessionId,
          });
          loginSessionId = loginSession.sessionId;
        } catch (error) {
          console.error("[auth] Login afgebroken omdat de verplichte auditregistratie mislukte.", {
            userId: databaseUserId,
            provider: account.provider,
            sessionId: auditSessionId,
            error,
          });
          throw error;
        }
      }
      const compactToken = compactSessionToken(token, databaseUserId, loginSessionId);
      authPayloadDiagnostics("jwt", compactToken);
      return compactToken;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.databaseUserId =
          typeof token.databaseUserId === "string" ? token.databaseUserId : undefined;
        session.user.loginSessionId =
          typeof token.loginSessionId === "string" ? token.loginSessionId : undefined;
      }
      authPayloadDiagnostics("session", session);
      return session;
    },
  },
  events: {
    async signOut(message) {
      const sessionId = "token" in message && typeof message.token?.loginSessionId === "string"
        ? message.token.loginSessionId
        : undefined;
      if (!sessionId) return;
      try {
        await closeLoginSession(sessionId);
      } catch (error) {
        console.error("[auth:login-audit] Logout kon niet worden geregistreerd.", { sessionId, error });
      }
    },
  },
});

export function isEntraConfigured() {
  return entraConfigured;
}
