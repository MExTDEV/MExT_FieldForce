import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const entraConfigured = Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
  );
  const publicAuthMode =
    process.env.NEXT_PUBLIC_AUTH_MODE === "demo"
      ? "demo"
      : entraConfigured
        ? "entra"
        : "demo";
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    env: {
      NEXT_PUBLIC_AUTH_MODE: publicAuthMode,
      NEXT_PUBLIC_ENTRA_CONFIGURED: String(entraConfigured),
    },
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ],
        },
      ];
    },
    // Keep development and production artifacts isolated. Running `next build`
    // while the dev server is active can otherwise invalidate Windows chunks.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
