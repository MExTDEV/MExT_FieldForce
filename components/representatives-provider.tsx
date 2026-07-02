"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/session-provider";
import type { Representative } from "@/lib/types";

type RepresentativesContextValue = {
  representatives: Representative[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const RepresentativesContext = createContext<RepresentativesContextValue | null>(null);

export function RepresentativesProvider({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, user } = useSession();
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRepresentatives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/representatives?actorId=${encodeURIComponent(user.id)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        representatives?: Representative[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Vertegenwoordigers konden niet worden geladen.");
      }
      setRepresentatives(payload.representatives ?? []);
    } catch (loadError) {
      console.error("[representatives]", loadError);
      setError("Vertegenwoordigers konden niet uit de database worden geladen.");
      setRepresentatives([]);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (sessionLoading || !user.id) {
      setLoading(sessionLoading);
      setError(null);
      setRepresentatives([]);
      return;
    }
    let active = true;
    async function loadIfActive() {
      await loadRepresentatives();
      if (!active) return;
    }
    loadIfActive();
    return () => {
      active = false;
    };
  }, [loadRepresentatives, sessionLoading, user.id]);

  const value = useMemo(
    () => ({
      representatives,
      loading,
      error,
      refresh: loadRepresentatives,
    }),
    [error, loadRepresentatives, loading, representatives]
  );

  return (
    <RepresentativesContext.Provider value={value}>
      {children}
    </RepresentativesContext.Provider>
  );
}

export function useRepresentatives() {
  const context = useContext(RepresentativesContext);
  if (!context) {
    throw new Error("useRepresentatives must be used within RepresentativesProvider");
  }
  return context;
}
