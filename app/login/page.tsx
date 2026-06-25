"use client";

import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { branding } from "@/config/branding";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  async function handleCredentialsLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setLoginError("Het e-mailadres of wachtwoord is niet correct.");
        return;
      }
      window.location.assign(result?.url ?? callbackUrl);
    } catch {
      setLoginError("Aanmelden is tijdelijk niet mogelijk. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

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
          Meld je aan met je FieldForce-account.
        </p>
        {loginError && (
          <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {loginError}
          </p>
        )}
        <form className="mt-7 space-y-4" onSubmit={handleCredentialsLogin}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              E-mailadres
            </span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Wachtwoord
            </span>
            <span className="relative block">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full justify-center disabled:cursor-wait disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? "Aanmelden..." : "Aanmelden"}
          </button>
        </form>
        {entraConfigured && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              of
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          <button
            type="button"
            onClick={() => signIn("microsoft-entra-id", { callbackUrl })}
            className="btn-secondary w-full justify-center"
          >
            <ShieldCheck className="h-4 w-4" />
            Aanmelden met Microsoft
          </button>
          </>
        )}
      </section>
    </main>
  );
}
