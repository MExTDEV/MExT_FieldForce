import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      databaseUserId?: string;
      entraId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    databaseUserId?: string;
    entraId?: string;
    microsoftAccessToken?: string;
    microsoftAccessTokenExpires?: number;
    microsoftRefreshToken?: string;
    microsoftTokenError?: "RefreshAccessTokenError";
  }
}
