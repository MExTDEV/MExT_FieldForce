"use client";

import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { branding } from "@/config/branding";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");
  const entraMode = process.env.NEXT_PUBLIC_AUTH_MODE === "entra";
  const entraConfigured =
    process.env.NEXT_PUBLIC_ENTRA_CONFIGURED === "true";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const requestedCallback = params.get("callbackUrl");
    if (requestedCallback?.startsWith("/")) setCallbackUrl(requestedCallback);
    setLoginError(
      error === "AccessDenied"
        ? "Dit Microsoft-account is niet gekoppeld aan een actieve FieldForce-gebruiker."
        : error === "Configuration"
          ? "De Microsoft-login is technisch niet correct geconfigureerd. Neem contact op met de beheerder."
          : error
            ? "Aanmelden is niet gelukt. Probeer opnieuw."
            : null
    );
  }, []);

  useEffect(() => {
    if (!entraMode || status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [entraMode, router, status]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-xl">
        <Image
          src={branding.logoPath}
          alt={branding.fullAppName}
          width={1774}
          height={887}
          priority
          className="mx-auto h-auto max-h-28 w-full object-contain"
        />
        <h1 className="mt-7 text-center text-2xl font-bold text-slate-950">
          Aanmelden bij FieldForce
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">
          Gebruik je zakelijke Microsoft-account.
        </p>
        {loginError && (
          <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {loginError}
          </p>
        )}
        {entraConfigured ? (
          <button
            type="button"
            onClick={() => signIn("microsoft-entra-id", { callbackUrl })}
            className="btn-primary mt-7 w-full justify-center"
          >
            <ShieldCheck className="h-4 w-4" />
            Aanmelden met Microsoft
          </button>
        ) : (
          <p className="mt-7 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Microsoft Entra ID is nog niet geconfigureerd.
          </p>
        )}
      </section>
    </main>
  );
}
