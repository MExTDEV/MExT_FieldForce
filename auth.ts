import NextAuth from "next-auth";
import MicrosoftEntraID, {
  type MicrosoftEntraIDProfile,
} from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@/lib/server/db";

const entraConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);

export const authMode = process.env.NEXT_PUBLIC_AUTH_MODE === "entra" ? "entra" : "demo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: entraConfigured
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!.replace(/\/+$/, ""),
        }),
      ]
    : [],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "microsoft-entra-id") {
        console.warn("[auth] Login geweigerd: onverwachte provider.");
        return false;
      }
      const entraProfile = profile as MicrosoftEntraIDProfile | undefined;
      const entraId = entraProfile?.oid ?? account.providerAccountId;
      const email = (entraProfile?.email ?? entraProfile?.preferred_username)?.trim().toLowerCase();
      if (!entraId || !email) {
        console.warn("[auth] Login geweigerd: Entra-ID of e-mailadres ontbreekt.");
        return false;
      }

      const linkedUser = await prisma.user.findFirst({
        where: { active: true, entraId },
        select: { id: true },
      });
      const aliasUser = linkedUser
        ? null
        : await prisma.user.findFirst({
            where: {
              active: true,
              loginAliases: {
                some: { email, provider: "microsoft-entra-id" },
              },
            },
            select: { id: true, entraId: true },
          });
      const unlinkedUser = linkedUser || aliasUser
        ? null
        : await prisma.user.findFirst({
            where: { active: true, email, entraId: null },
            select: { id: true },
          });
      const user = linkedUser ?? aliasUser ?? unlinkedUser;
      if (!user) {
        console.warn(`[auth] Login geweigerd: geen actieve FieldForce-gebruiker voor ${email}.`);
        return false;
      }
      if (!linkedUser) {
        await prisma.user.update({
          where: { id: user.id },
          data: { entraId },
        });
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "microsoft-entra-id") {
        const entraProfile = profile as MicrosoftEntraIDProfile | undefined;
        const entraId = entraProfile?.oid ?? account.providerAccountId;
        const databaseUser = await prisma.user.findFirst({
          where: { entraId, active: true },
          select: { id: true },
        });
        token.databaseUserId = databaseUser?.id;
        token.entraId = entraId;
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
