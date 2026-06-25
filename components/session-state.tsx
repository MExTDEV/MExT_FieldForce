"use client";

import { signOut } from "next-auth/react";
import { useSession } from "@/components/session-provider";

export function SessionFailure() {
  const { error, retry } = useSession();
  return (
    <section className="mx-auto mt-12 max-w-xl rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-950">Sessie kon niet worden geladen</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {error ?? "De gebruikerssessie is niet beschikbaar."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-primary" onClick={retry}>
          Opnieuw proberen
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            await signOut({ redirect: false });
            window.location.assign("/login");
          }}
        >
          Naar login
        </button>
      </div>
    </section>
  );
}
