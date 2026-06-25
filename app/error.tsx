"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <section className="w-full max-w-xl rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">FieldForce kon niet worden geladen</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Er ging technisch iets mis. Je gegevens zijn niet gewijzigd.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={reset}>
            Opnieuw proberen
          </button>
          <button type="button" className="btn-secondary" onClick={async () => {
            await signOut({ redirect: false });
            window.location.assign("/login");
          }}>
            Naar login
          </button>
        </div>
      </section>
    </main>
  );
}
